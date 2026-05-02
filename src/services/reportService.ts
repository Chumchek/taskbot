import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { assignments, media, reports, tasks, users } from '../db/schema';

export type Report = typeof reports.$inferSelect;
export type Media = typeof media.$inferSelect;

export interface ReportWithContext {
  report: Report;
  userName: string;
  userTelegramId: string;
  taskTitle: string;
  priceUah: string;
  mediaFiles: Media[];
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createReport(assignmentId: number): Promise<Report> {
  const [report] = await db.insert(reports).values({ assignmentId }).returning();
  return report;
}

export interface AddMediaInput {
  reportId: number;
  storageKey: string;
  telegramFileId: string;
  fileType: string;
  fileSize?: number;
  checksum?: string;
}

export async function addReportMedia(input: AddMediaInput): Promise<Media> {
  const [m] = await db.insert(media).values(input).returning();
  return m;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getPendingReports(): Promise<ReportWithContext[]> {
  const rows = await db
    .select({
      report: reports,
      user: { telegramId: users.telegramId, username: users.username, firstName: users.firstName },
      task: { title: tasks.title, priceUah: tasks.priceUah },
    })
    .from(reports)
    .innerJoin(assignments, eq(reports.assignmentId, assignments.id))
    .innerJoin(users, eq(assignments.userId, users.id))
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .where(eq(reports.status, 'pending'));

  const result: ReportWithContext[] = [];
  for (const row of rows) {
    const mediaFiles = await db
      .select()
      .from(media)
      .where(eq(media.reportId, row.report.id));

    result.push({
      report: row.report,
      userName: row.user.username ? `@${row.user.username}` : row.user.firstName ?? 'Unknown',
      userTelegramId: row.user.telegramId,
      taskTitle: row.task.title,
      priceUah: row.task.priceUah,
      mediaFiles,
    });
  }

  return result;
}

export async function getReportWithContext(reportId: number): Promise<ReportWithContext | null> {
  const [row] = await db
    .select({
      report: reports,
      user: { telegramId: users.telegramId, username: users.username, firstName: users.firstName },
      task: { title: tasks.title, priceUah: tasks.priceUah },
    })
    .from(reports)
    .innerJoin(assignments, eq(reports.assignmentId, assignments.id))
    .innerJoin(users, eq(assignments.userId, users.id))
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .where(eq(reports.id, reportId));

  if (!row) return null;

  const mediaFiles = await db.select().from(media).where(eq(media.reportId, reportId));

  return {
    report: row.report,
    userName: row.user.username ? `@${row.user.username}` : row.user.firstName ?? 'Unknown',
    userTelegramId: row.user.telegramId,
    taskTitle: row.task.title,
    priceUah: row.task.priceUah,
    mediaFiles,
  };
}

// ── Approve ─────────────────────────────────────────────────────────────────

export interface ApprovalResult {
  userTelegramId: string;
  taskTitle: string;
  priceUah: string;
  newBalance: string;
}

export async function approveReport(
  reportId: number,
  adminUserId: number,
): Promise<ApprovalResult | null> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        report: reports,
        assignment: assignments,
        task: { id: tasks.id, title: tasks.title, priceUah: tasks.priceUah },
        user: { id: users.id, telegramId: users.telegramId },
      })
      .from(reports)
      .innerJoin(assignments, eq(reports.assignmentId, assignments.id))
      .innerJoin(tasks, eq(assignments.taskId, tasks.id))
      .innerJoin(users, eq(assignments.userId, users.id))
      .where(eq(reports.id, reportId));

    if (!row || row.report.status !== 'pending') return null;

    // Mark report approved
    await tx
      .update(reports)
      .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: adminUserId })
      .where(eq(reports.id, reportId));

    // Mark assignment completed
    await tx
      .update(assignments)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(assignments.id, row.assignment.id));

    // Credit balance (cast price string to numeric for safe arithmetic)
    const [updatedUser] = await tx
      .update(users)
      .set({
        balance: sql`cast(${users.balance} as numeric) + cast(${row.task.priceUah} as numeric)`,
      })
      .where(eq(users.id, row.user.id))
      .returning({ balance: users.balance });

    return {
      userTelegramId: row.user.telegramId,
      taskTitle: row.task.title,
      priceUah: row.task.priceUah,
      newBalance: updatedUser?.balance ?? '0',
    };
  });
}

// ── Reject ──────────────────────────────────────────────────────────────────

export interface RejectionResult {
  userTelegramId: string;
  taskTitle: string;
}

export async function rejectReport(
  reportId: number,
  adminUserId: number,
  comment?: string,
): Promise<RejectionResult | null> {
  const [row] = await db
    .select({
      report: reports,
      user: { telegramId: users.telegramId },
      task: { title: tasks.title },
    })
    .from(reports)
    .innerJoin(assignments, eq(reports.assignmentId, assignments.id))
    .innerJoin(users, eq(assignments.userId, users.id))
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .where(eq(reports.id, reportId));

  if (!row || row.report.status !== 'pending') return null;

  await db
    .update(reports)
    .set({
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: adminUserId,
      adminComment: comment ?? null,
    })
    .where(eq(reports.id, reportId));

  return {
    userTelegramId: row.user.telegramId,
    taskTitle: row.task.title,
  };
}

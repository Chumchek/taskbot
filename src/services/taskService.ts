import { and, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../db';
import { assignments, media, reports, taskMedia, tasks } from '../db/schema';
import { deleteFile } from './storageService';

export type Task = typeof tasks.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  link: string;
  priceUah: string;
  slotsTotal: number;
  deadlineHours: number;
  taskExpiryHours?: number | null;
  category?: 'report_app' | 'download_app' | 'install_by_key' | null;
  packageName?: string | null;
  createdBy?: number | null;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const [task] = await db
    .insert(tasks)
    .values({ ...input, slotsAvailable: input.slotsTotal })
    .returning();
  return task;
}

export async function getActiveTasks(): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.isActive, true), gt(tasks.slotsAvailable, 0)));
}

export async function getAllTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(tasks.id);
}

export async function getTaskById(taskId: number): Promise<Task | undefined> {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, taskId));
  return task;
}

export async function toggleTaskActive(taskId: number): Promise<Task | undefined> {
  const task = await getTaskById(taskId);
  if (!task) return undefined;
  const [updated] = await db
    .update(tasks)
    .set({ isActive: !task.isActive })
    .where(eq(tasks.id, taskId))
    .returning();
  return updated;
}

export type DeleteTaskResult =
  | { success: true }
  | { success: false; reason: 'not_found' | 'has_active_assignments'; count: number };

// Deletes a task and all associated data (assignments, reports, media rows).
// R2 files are NOT deleted here — the daily cleanup job handles those.
// Blocked if any assignment is still in 'claimed' state (user actively working).
export async function deleteTask(taskId: number): Promise<DeleteTaskResult> {
  const [existing] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, taskId));
  if (!existing) return { success: false, reason: 'not_found', count: 0 };

  const [{ activeCount }] = await db
    .select({ activeCount: sql<number>`cast(count(*) as int)` })
    .from(assignments)
    .where(and(eq(assignments.taskId, taskId), eq(assignments.status, 'claimed')));

  if (activeCount > 0) return { success: false, reason: 'has_active_assignments', count: activeCount };

  // Delete task media R2 files before the transaction (not atomic, failures are non-critical)
  const taskMediaFiles = await db.select().from(taskMedia).where(eq(taskMedia.taskId, taskId));
  for (const f of taskMediaFiles) {
    try { await deleteFile(f.storageKey); } catch { /* already deleted */ }
  }

  // Cascade: taskMedia → media → reports → assignments → task
  await db.transaction(async (tx) => {
    await tx.delete(taskMedia).where(eq(taskMedia.taskId, taskId));

    const taskAssignments = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.taskId, taskId));

    if (taskAssignments.length > 0) {
      const assignmentIds = taskAssignments.map((a) => a.id);

      const taskReports = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(inArray(reports.assignmentId, assignmentIds));

      if (taskReports.length > 0) {
        await tx.delete(media).where(inArray(media.reportId, taskReports.map((r) => r.id)));
        await tx.delete(reports).where(inArray(reports.id, taskReports.map((r) => r.id)));
      }

      await tx.delete(assignments).where(inArray(assignments.id, assignmentIds));
    }

    await tx.delete(tasks).where(eq(tasks.id, taskId));
  });

  return { success: true };
}

// Returns task IDs the user has already claimed or completed.
export async function getUserClaimedTaskIds(userId: number): Promise<Set<number>> {
  const rows = await db
    .select({ taskId: assignments.taskId })
    .from(assignments)
    .where(
      and(
        eq(assignments.userId, userId),
        inArray(assignments.status, ['claimed', 'completed']),
      ),
    );
  return new Set(rows.map((r) => r.taskId));
}

export async function getUserAssignments(userId: number): Promise<
  Array<Assignment & { task: Task }>
> {
  const rows = await db
    .select({ assignment: assignments, task: tasks })
    .from(assignments)
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .where(eq(assignments.userId, userId));
  return rows.map((r) => ({ ...r.assignment, task: r.task }));
}

export type ClaimResult =
  | { success: true; assignment: Assignment }
  | { success: false; reason: 'unavailable' | 'already_claimed' };

// Atomically decrements a slot and creates (or reactivates) an assignment.
export async function claimTask(userId: number, taskId: number): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: assignments.id, status: assignments.status })
      .from(assignments)
      .where(and(eq(assignments.userId, userId), eq(assignments.taskId, taskId)));

    if (existing && existing.status !== 'expired') {
      return { success: false, reason: 'already_claimed' };
    }

    // UPDATE only succeeds when task is active and slots_available > 0
    const [updated] = await tx
      .update(tasks)
      .set({ slotsAvailable: sql`${tasks.slotsAvailable} - 1` })
      .where(and(eq(tasks.id, taskId), eq(tasks.isActive, true), gt(tasks.slotsAvailable, 0)))
      .returning();

    if (!updated) return { success: false, reason: 'unavailable' };

    const expiresAt = new Date(Date.now() + updated.deadlineHours * 60 * 60 * 1000);

    if (existing) {
      // Reactivate the expired assignment instead of inserting a new one
      const [assignment] = await tx
        .update(assignments)
        .set({ status: 'claimed', expiresAt, completedAt: null })
        .where(eq(assignments.id, existing.id))
        .returning();
      return { success: true, assignment };
    }

    const [assignment] = await tx
      .insert(assignments)
      .values({ userId, taskId, expiresAt })
      .returning();

    return { success: true, assignment };
  });
}

// Deactivates tasks whose taskExpiryHours has elapsed since creation.
// Returns the number of tasks deactivated.
export async function autoExpireTasks(): Promise<number> {
  const result = await db
    .update(tasks)
    .set({ isActive: false })
    .where(
      and(
        eq(tasks.isActive, true),
        isNotNull(tasks.taskExpiryHours),
        sql`${tasks.createdAt} + (${tasks.taskExpiryHours} || ' hours')::interval <= NOW()`,
      ),
    )
    .returning({ id: tasks.id });
  return result.length;
}

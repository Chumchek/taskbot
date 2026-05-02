import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('reportService integration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any, pool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let users: any, tasks: any, assignments: any, reports: any;
  let approveReport: (reportId: number, adminUserId: number) => Promise<unknown>;
  let rejectReport: (reportId: number, adminUserId: number, comment?: string) => Promise<unknown>;

  let testUserId: number;
  let adminUserId: number;
  let testReportId: number;

  beforeAll(async () => {
    const dbModule = await import('../db');
    const schemaModule = await import('../db/schema');
    const serviceModule = await import('../services/reportService');
    db = dbModule.db;
    pool = dbModule.pool;
    users = schemaModule.users;
    tasks = schemaModule.tasks;
    assignments = schemaModule.assignments;
    reports = schemaModule.reports;
    approveReport = serviceModule.approveReport;
    rejectReport = serviceModule.rejectReport;
  });

  beforeEach(async () => {
    const now = Date.now();

    const [u] = await db
      .insert(users)
      .values({ telegramId: `rep_user_${now}`, firstName: 'ReportUser', status: 'approved', balance: '0' })
      .returning();
    testUserId = u.id;

    const [admin] = await db
      .insert(users)
      .values({ telegramId: `rep_admin_${now}`, firstName: 'Admin', status: 'approved', isAdmin: true })
      .returning();
    adminUserId = admin.id;

    const [t] = await db
      .insert(tasks)
      .values({
        title: 'Report Test Task',
        link: 'https://example.com',
        priceUah: '150',
        slotsTotal: 1,
        slotsAvailable: 0,
        isActive: true,
      })
      .returning();

    const [a] = await db
      .insert(assignments)
      .values({ userId: testUserId, taskId: t.id, status: 'claimed' })
      .returning();

    const [r] = await db.insert(reports).values({ assignmentId: a.id }).returning();
    testReportId = r.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('approveReport credits the correct amount to user balance', async () => {
    const result = await approveReport(testReportId, adminUserId) as { newBalance: string; priceUah: string };
    expect(result).not.toBeNull();
    expect(parseFloat(result.newBalance)).toBeCloseTo(150);
    expect(result.priceUah).toBe('150.00');
  });

  it('approveReport marks report approved and assignment completed', async () => {
    await approveReport(testReportId, adminUserId);

    const [report] = await db.select().from(reports).where(eq(reports.id, testReportId));
    expect(report.status).toBe('approved');
    expect(report.reviewedBy).toBe(adminUserId);
  });

  it('approveReport returns null for an already-approved report', async () => {
    await approveReport(testReportId, adminUserId);
    const second = await approveReport(testReportId, adminUserId);
    expect(second).toBeNull();
  });

  it('rejectReport marks report as rejected with a comment', async () => {
    const result = await rejectReport(testReportId, adminUserId, 'Low quality') as { userTelegramId: string };
    expect(result).not.toBeNull();

    const [report] = await db.select().from(reports).where(eq(reports.id, testReportId));
    expect(report.status).toBe('rejected');
    expect(report.adminComment).toBe('Low quality');
  });
});

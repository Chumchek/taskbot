import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('taskService integration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any, pool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let users: any, tasks: any, assignments: any;
  let claimTask: (userId: number, taskId: number) => Promise<unknown>;

  let testUserId1: number;
  let testUserId2: number;
  let testTaskId: number;

  beforeAll(async () => {
    const dbModule = await import('../db');
    const schemaModule = await import('../db/schema');
    const serviceModule = await import('../services/taskService');
    db = dbModule.db;
    pool = dbModule.pool;
    users = schemaModule.users;
    tasks = schemaModule.tasks;
    assignments = schemaModule.assignments;
    claimTask = serviceModule.claimTask;
  });

  beforeEach(async () => {
    // Seed two test users
    const now = Date.now();
    const [u1] = await db
      .insert(users)
      .values({ telegramId: `test_u1_${now}`, firstName: 'Test1', status: 'approved' })
      .returning();
    const [u2] = await db
      .insert(users)
      .values({ telegramId: `test_u2_${now}`, firstName: 'Test2', status: 'approved' })
      .returning();
    testUserId1 = u1.id;
    testUserId2 = u2.id;

    // Seed a 1-slot task
    const [t] = await db
      .insert(tasks)
      .values({
        title: 'Integration Test Task',
        link: 'https://example.com',
        priceUah: '100',
        slotsTotal: 1,
        slotsAvailable: 1,
        isActive: true,
      })
      .returning();
    testTaskId = t.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('allows a single user to claim an available task', async () => {
    const result = await claimTask(testUserId1, testTaskId);
    expect(result).toMatchObject({ success: true });

    const [task] = await db.select().from(tasks).where(eq(tasks.id, testTaskId));
    expect(task.slotsAvailable).toBe(0);
  });

  it('prevents claiming an already-claimed task (same user)', async () => {
    await claimTask(testUserId1, testTaskId);
    const result = await claimTask(testUserId1, testTaskId);
    expect(result).toMatchObject({ success: false, reason: 'already_claimed' });
  });

  it('race condition: only one of two concurrent claims on a 1-slot task succeeds', async () => {
    const [r1, r2] = await Promise.all([
      claimTask(testUserId1, testTaskId),
      claimTask(testUserId2, testTaskId),
    ]);

    const results = [r1, r2] as Array<{ success: boolean }>;
    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    // Confirm the slot count is exactly 0
    const [task] = await db.select().from(tasks).where(eq(tasks.id, testTaskId));
    expect(task.slotsAvailable).toBe(0);
  });

  it('returns unavailable for an inactive task', async () => {
    await db.update(tasks).set({ isActive: false }).where(eq(tasks.id, testTaskId));
    const result = await claimTask(testUserId1, testTaskId);
    expect(result).toMatchObject({ success: false, reason: 'unavailable' });
  });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)('payoutService integration', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any, pool: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let users: any;
  let getPayoutQueue: () => Promise<unknown[]>;
  let processUserPayout: (userId: number, adminId: number) => Promise<unknown>;

  let richUserId: number;
  let poorUserId: number;
  let adminUserId: number;

  beforeAll(async () => {
    const dbModule = await import('../db');
    const schemaModule = await import('../db/schema');
    const serviceModule = await import('../services/payoutService');
    db = dbModule.db;
    pool = dbModule.pool;
    users = schemaModule.users;
    getPayoutQueue = serviceModule.getPayoutQueue;
    processUserPayout = serviceModule.processUserPayout;
  });

  beforeEach(async () => {
    const now = Date.now();

    const [rich] = await db
      .insert(users)
      .values({ telegramId: `payout_rich_${now}`, firstName: 'Rich', status: 'approved', balance: '250.00' })
      .returning();
    richUserId = rich.id;

    const [poor] = await db
      .insert(users)
      .values({ telegramId: `payout_poor_${now}`, firstName: 'Poor', status: 'approved', balance: '50.00' })
      .returning();
    poorUserId = poor.id;

    const [admin] = await db
      .insert(users)
      .values({ telegramId: `payout_admin_${now}`, firstName: 'Admin', status: 'approved', isAdmin: true })
      .returning();
    adminUserId = admin.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('getPayoutQueue includes users at or above 200 UAH threshold', async () => {
    const queue = await getPayoutQueue() as Array<{ user: { id: number } }>;
    const ids = queue.map((q) => q.user.id);
    expect(ids).toContain(richUserId);
    expect(ids).not.toContain(poorUserId);
  });

  it('processUserPayout resets balance to 0 and returns payout details', async () => {
    const result = await processUserPayout(richUserId, adminUserId) as {
      amount: string;
      payoutId: number;
    };

    expect(result).not.toBeNull();
    expect(parseFloat(result.amount)).toBeCloseTo(250);
    expect(typeof result.payoutId).toBe('number');

    const [user] = await db.select().from(users).where(eq(users.id, richUserId));
    expect(parseFloat(user.balance)).toBe(0);
  });

  it('processUserPayout returns null when balance is below threshold', async () => {
    const result = await processUserPayout(poorUserId, adminUserId);
    expect(result).toBeNull();
  });

  it('user no longer appears in payout queue after being paid out', async () => {
    await processUserPayout(richUserId, adminUserId);
    const queue = await getPayoutQueue() as Array<{ user: { id: number } }>;
    const ids = queue.map((q) => q.user.id);
    expect(ids).not.toContain(richUserId);
  });
});

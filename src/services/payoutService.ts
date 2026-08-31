import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import { assignments, payouts, tasks, users } from '../db/schema';
import { decrypt, maskCard } from './crypto';

export type User = typeof users.$inferSelect;
export type Payout = typeof payouts.$inferSelect;

const PAYOUT_THRESHOLD = 200;

// ── Queue ───────────────────────────────────────────────────────────────────

export interface PayoutQueueItem {
  user: User;
  balance: string;
}

export async function getPayoutQueue(): Promise<PayoutQueueItem[]> {
  const eligible = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.status, 'approved'),
        sql`cast(${users.balance} as numeric) >= ${PAYOUT_THRESHOLD}`,
      ),
    );

  return eligible.map((u) => ({ user: u, balance: u.balance }));
}

// ── Completed tasks (since last payout) ────────────────────────────────────

export interface CompletedTaskSummary {
  taskTitle: string;
  priceUah: string;
  completedAt: Date | null;
}

export async function getUnpaidCompletedTasks(userId: number): Promise<CompletedTaskSummary[]> {
  // Find the date of the last payout to only show tasks completed since then
  const [lastPayout] = await db
    .select({ paidAt: payouts.paidAt })
    .from(payouts)
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.paidAt))
    .limit(1);

  const since = lastPayout?.paidAt ?? new Date(0);

  return db
    .select({
      taskTitle: tasks.title,
      priceUah: tasks.priceUah,
      completedAt: assignments.completedAt,
    })
    .from(assignments)
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .where(
      and(
        eq(assignments.userId, userId),
        eq(assignments.status, 'completed'),
        gt(assignments.completedAt, since),
      ),
    )
    .orderBy(desc(assignments.completedAt));
}

// ── Payment info (for admin view) ──────────────────────────────────────────

export interface PaymentInfo {
  binanceId: string | null;
  maskedCard: string | null;
  hasEncryptedCard: boolean;
}

export function getPaymentInfo(user: User): PaymentInfo {
  const card = getDecryptedCard(user);
  return {
    binanceId: user.binanceId ?? null,
    maskedCard: card ? maskCard(card) : null,
    hasEncryptedCard: !!user.cardEncrypted,
  };
}

/**
 * Returns null instead of throwing when the stored ciphertext cannot be read
 * (malformed value, or ENCRYPTION_KEY rotated since it was written). Throwing
 * here used to take down the whole payout-detail handler, leaving the admin
 * with a button that appears to do nothing.
 */
export function getDecryptedCard(user: User): string | null {
  if (!user.cardEncrypted) return null;
  try {
    return decrypt(user.cardEncrypted);
  } catch (err) {
    console.error(`[payout] failed to decrypt card for user ${user.id}`, err);
    return null;
  }
}

// ── Process payout ──────────────────────────────────────────────────────────

export interface PayoutResult {
  payoutId: number;
  amount: string;
  userTelegramId: string;
  userName: string;
}

export async function processUserPayout(
  userId: number,
  adminId: number,
  proofTelegramFileId?: string,
): Promise<PayoutResult | null> {
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId));

    if (!user || parseFloat(user.balance) < PAYOUT_THRESHOLD) return null;

    const amount = user.balance;

    const [payout] = await tx
      .insert(payouts)
      .values({ userId, amount, processedBy: adminId, paidAt: new Date(), proofTelegramFileId: proofTelegramFileId ?? null })
      .returning();

    await tx.update(users).set({ balance: '0' }).where(eq(users.id, userId));

    return {
      payoutId: payout.id,
      amount,
      userTelegramId: user.telegramId,
      userName: user.username ? `@${user.username}` : user.firstName ?? user.telegramId,
    };
  });
}

// ── Payout history ──────────────────────────────────────────────────────────

export async function getUserPayoutHistory(userId: number): Promise<Payout[]> {
  return db
    .select()
    .from(payouts)
    .where(eq(payouts.userId, userId))
    .orderBy(desc(payouts.createdAt));
}

export { PAYOUT_THRESHOLD };

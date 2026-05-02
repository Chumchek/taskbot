import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { config } from '../config';

export type User = typeof users.$inferSelect;

export async function getUserByTelegramId(telegramId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
  return user;
}

export async function getPendingUsers(): Promise<User[]> {
  return db.select().from(users).where(eq(users.status, 'pending'));
}

export async function approveUser(telegramId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ status: 'approved' })
    .where(eq(users.telegramId, telegramId))
    .returning();
  return user;
}

export async function rejectUser(telegramId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ status: 'rejected' })
    .where(eq(users.telegramId, telegramId))
    .returning();
  return user;
}

export async function promoteUser(telegramId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ isAdmin: true })
    .where(eq(users.telegramId, telegramId))
    .returning();
  return user;
}

export async function demoteUser(telegramId: string): Promise<User | undefined> {
  const [user] = await db
    .update(users)
    .set({ isAdmin: false })
    .where(eq(users.telegramId, telegramId))
    .returning();
  return user;
}

// Returns true if telegramId is an env-based super-admin OR has is_admin flag in DB.
export async function isAdmin(telegramId: string): Promise<boolean> {
  if (config.admins.includes(telegramId)) return true;
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.telegramId, telegramId));
  return user?.isAdmin ?? false;
}

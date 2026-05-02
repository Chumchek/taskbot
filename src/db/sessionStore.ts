import { eq, lt } from 'drizzle-orm';
import { db } from './index';
import { sessions } from './schema';

// Implements grammY's StorageAdapter<T> interface backed by PostgreSQL.
// Survives bot restarts — no more lost registration/task-creation flows.
export function makeSessionStorage<T>() {
  return {
    async read(key: string): Promise<T | undefined> {
      const [row] = await db.select().from(sessions).where(eq(sessions.key, key));
      return row ? (row.data as unknown as T) : undefined;
    },

    async write(key: string, value: T): Promise<void> {
      await db
        .insert(sessions)
        .values({ key, data: value as Record<string, unknown> })
        .onConflictDoUpdate({
          target: sessions.key,
          set: {
            data: value as Record<string, unknown>,
            updatedAt: new Date(),
          },
        });
    },

    async delete(key: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.key, key));
    },
  };
}

// Deletes sessions that haven't been touched in over `days` days.
// Call periodically to prevent unbounded table growth.
export async function cleanupOldSessions(days = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.updatedAt, cutoff))
    .returning({ key: sessions.key });
  return deleted.length;
}

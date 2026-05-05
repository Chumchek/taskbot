import { and, eq, isNotNull, notExists, sql } from 'drizzle-orm';
import { Api } from 'grammy';
import { db } from '../db';
import { assignments, reports, tasks, users } from '../db/schema';
import { cleanupOldSessions } from '../db/sessionStore';
import { deadlineLabel } from '../i18n/ru';

// Finds all claimed assignments past their deadline, marks them expired,
// and restores the slot on the corresponding task.
// Runs inside a single transaction so slot counts stay consistent.
export async function expireAssignments(api?: Api): Promise<void> {
  const now = new Date();

  const expired = await db
    .select({
      id: assignments.id,
      taskId: assignments.taskId,
      taskTitle: tasks.title,
      taskDeadlineHours: tasks.deadlineHours,
      userTelegramId: users.telegramId,
    })
    .from(assignments)
    .innerJoin(tasks, eq(assignments.taskId, tasks.id))
    .innerJoin(users, eq(assignments.userId, users.id))
    .where(
      and(
        eq(assignments.status, 'claimed'),
        isNotNull(assignments.expiresAt),
        sql`${assignments.expiresAt} < ${now}`,
        notExists(
          db.select({ id: reports.id })
            .from(reports)
            .where(and(eq(reports.assignmentId, assignments.id), eq(reports.status, 'pending'))),
        ),
      ),
    );

  if (expired.length > 0) {
    console.log(`[expiry] Expiring ${expired.length} assignment(s)`);

    await db.transaction(async (tx) => {
      for (const a of expired) {
        await tx
          .update(assignments)
          .set({ status: 'expired' })
          .where(eq(assignments.id, a.id));

        // Restore the slot so other users can claim it
        await tx
          .update(tasks)
          .set({ slotsAvailable: sql`${tasks.slotsAvailable} + 1` })
          .where(eq(tasks.id, a.taskId));
      }
    });

    // Notify each affected user (non-critical — don't let failures abort the job)
    if (api) {
      for (const a of expired) {
        try {
          await api.sendMessage(
            a.userTelegramId,
            `⏰ <b>Время вышло</b>\n\n` +
              `Ваше время (${deadlineLabel(a.taskDeadlineHours)}) на выполнение задания <b>${a.taskTitle}</b> истекло.\n\n` +
              `Место освобождено. Вы можете взять задание снова, если ещё есть свободные места.`,
            { parse_mode: 'HTML' },
          );
        } catch {
          // User may have blocked the bot
        }
      }
    }
  }

  // Piggyback: clean up stale sessions older than 7 days
  const cleaned = await cleanupOldSessions(7);
  if (cleaned > 0) {
    console.log(`[expiry] Cleaned up ${cleaned} stale session(s)`);
  }
}

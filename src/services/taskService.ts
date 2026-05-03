import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { assignments, tasks } from '../db/schema';

export type Task = typeof tasks.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  link: string;
  priceUah: string;
  slotsTotal: number;
  deadlineHours: number;
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

export async function deleteTask(taskId: number): Promise<boolean> {
  const result = await db.delete(tasks).where(eq(tasks.id, taskId)).returning();
  return result.length > 0;
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

// Atomically decrements a slot and creates an assignment in a single transaction.
export async function claimTask(userId: number, taskId: number): Promise<ClaimResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(and(eq(assignments.userId, userId), eq(assignments.taskId, taskId)));

    if (existing) return { success: false, reason: 'already_claimed' };

    // UPDATE only succeeds when task is active and slots_available > 0
    const [updated] = await tx
      .update(tasks)
      .set({ slotsAvailable: sql`${tasks.slotsAvailable} - 1` })
      .where(and(eq(tasks.id, taskId), eq(tasks.isActive, true), gt(tasks.slotsAvailable, 0)))
      .returning();

    if (!updated) return { success: false, reason: 'unavailable' };

    const expiresAt = new Date(Date.now() + updated.deadlineHours * 60 * 60 * 1000);
    const [assignment] = await tx
      .insert(assignments)
      .values({ userId, taskId, expiresAt })
      .returning();

    return { success: true, assignment };
  });
}

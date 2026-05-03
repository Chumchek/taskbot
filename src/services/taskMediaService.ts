import { eq } from 'drizzle-orm';
import { db } from '../db';
import { taskMedia } from '../db/schema';
import { deleteFile } from './storageService';

export type TaskMedia = typeof taskMedia.$inferSelect;

export async function getTaskMedia(taskId: number): Promise<TaskMedia[]> {
  return db.select().from(taskMedia).where(eq(taskMedia.taskId, taskId));
}

export interface AddTaskMediaInput {
  taskId: number;
  storageKey: string;
  telegramFileId: string;
  fileType: string;
  fileSize?: number;
}

export async function addTaskMedia(input: AddTaskMediaInput): Promise<TaskMedia> {
  const [m] = await db.insert(taskMedia).values(input).returning();
  return m;
}

export async function deleteAllTaskMedia(taskId: number): Promise<void> {
  const files = await getTaskMedia(taskId);
  for (const f of files) {
    try { await deleteFile(f.storageKey); } catch { /* already deleted */ }
  }
  if (files.length > 0) {
    await db.delete(taskMedia).where(eq(taskMedia.taskId, taskId));
  }
}

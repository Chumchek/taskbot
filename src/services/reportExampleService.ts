import { eq } from 'drizzle-orm';
import { db } from '../db';
import { reportExamples, reportExampleMedia } from '../db/schema';
import { deleteFile } from './storageService';

export type CategoryKey = 'report_app' | 'download_app' | 'install_by_key' | 'none';
export const ALL_CATEGORY_KEYS: CategoryKey[] = [
  'report_app',
  'download_app',
  'install_by_key',
  'none',
];

export type ReportExample = typeof reportExamples.$inferSelect;
export type ReportExampleMedia = typeof reportExampleMedia.$inferSelect;

export function toCategoryKey(category: string | null | undefined): CategoryKey {
  if (!category) return 'none';
  return category as CategoryKey;
}

export async function getAllExamples(): Promise<ReportExample[]> {
  return db.select().from(reportExamples);
}

export async function getExampleById(id: number): Promise<ReportExample | null> {
  const [row] = await db.select().from(reportExamples).where(eq(reportExamples.id, id));
  return row ?? null;
}

export async function getExampleByCategoryKey(categoryKey: string): Promise<ReportExample | null> {
  const [row] = await db
    .select()
    .from(reportExamples)
    .where(eq(reportExamples.categoryKey, categoryKey));
  return row ?? null;
}

export async function getExampleMedia(exampleId: number): Promise<ReportExampleMedia[]> {
  return db
    .select()
    .from(reportExampleMedia)
    .where(eq(reportExampleMedia.exampleId, exampleId));
}

export async function createExample(categoryKey: string): Promise<ReportExample> {
  const [row] = await db.insert(reportExamples).values({ categoryKey }).returning();
  return row;
}

export async function updateExampleComment(
  exampleId: number,
  comment: string | null,
): Promise<void> {
  await db.update(reportExamples).set({ comment }).where(eq(reportExamples.id, exampleId));
}

export interface AddExampleMediaInput {
  exampleId: number;
  storageKey: string;
  telegramFileId: string;
  fileType: string;
  fileSize?: number;
}

export async function addExampleMedia(input: AddExampleMediaInput): Promise<ReportExampleMedia> {
  const [row] = await db.insert(reportExampleMedia).values(input).returning();
  return row;
}

export async function deleteAllExampleMedia(exampleId: number): Promise<void> {
  const files = await getExampleMedia(exampleId);
  for (const f of files) {
    try { await deleteFile(f.storageKey); } catch { /* already deleted */ }
  }
  await db.delete(reportExampleMedia).where(eq(reportExampleMedia.exampleId, exampleId));
}

export async function deleteExample(exampleId: number): Promise<void> {
  await deleteAllExampleMedia(exampleId);
  await db.delete(reportExamples).where(eq(reportExamples.id, exampleId));
}

export async function getExampleForUser(
  categoryKey: CategoryKey,
): Promise<{ example: ReportExample; media: ReportExampleMedia[] } | null> {
  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return null;
  const media = await getExampleMedia(example.id);
  if (!media.length && !example.comment) return null;
  return { example, media };
}

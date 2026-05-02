import { and, eq, inArray, isNotNull, lt } from 'drizzle-orm';
import { db } from '../db';
import { media, reports } from '../db/schema';
import { deleteFile } from '../services/storageService';

const MEDIA_TTL_DAYS = 7;
const RECORD_TTL_DAYS = 30;

// Runs once per day:
//   - Deletes R2 files + media rows for reviewed reports older than 7 days
//   - Deletes report DB records older than 30 days
// Applies to both approved and rejected reports (no reason to keep media forever).
export async function cleanupApprovedReports(): Promise<void> {
  const now = new Date();

  // ── Step 1: Delete R2 files + media rows (7-day TTL) ────────────────────
  const mediaCutoff = new Date(now.getTime() - MEDIA_TTL_DAYS * 24 * 60 * 60 * 1000);

  const staleMedia = await db
    .select({ id: media.id, storageKey: media.storageKey })
    .from(media)
    .innerJoin(reports, eq(media.reportId, reports.id))
    .where(
      and(
        isNotNull(reports.reviewedAt),
        lt(reports.reviewedAt, mediaCutoff),
      ),
    );

  if (staleMedia.length > 0) {
    console.log(`[cleanup] Deleting ${staleMedia.length} R2 file(s) from reviewed reports`);

    for (const m of staleMedia) {
      try {
        await deleteFile(m.storageKey);
      } catch {
        // Already deleted or never uploaded — safe to ignore
      }
    }

    await db.delete(media).where(inArray(media.id, staleMedia.map((m) => m.id)));
  }

  // ── Step 2: Delete report records (30-day TTL) ───────────────────────────
  const recordCutoff = new Date(now.getTime() - RECORD_TTL_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(reports)
    .where(
      and(
        isNotNull(reports.reviewedAt),
        lt(reports.reviewedAt, recordCutoff),
      ),
    )
    .returning({ id: reports.id });

  if (deleted.length > 0) {
    console.log(`[cleanup] Deleted ${deleted.length} old report record(s)`);
  }
}

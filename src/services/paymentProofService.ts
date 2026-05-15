import { desc } from 'drizzle-orm';
import { db } from '../db';
import { paymentProofs } from '../db/schema';

export type PaymentProof = typeof paymentProofs.$inferSelect;

export async function getAllProofs(): Promise<PaymentProof[]> {
  return db.select().from(paymentProofs).orderBy(desc(paymentProofs.uploadedAt));
}

export async function addProof(telegramFileId: string, uploadedBy?: number | null): Promise<PaymentProof> {
  const [proof] = await db
    .insert(paymentProofs)
    .values({ telegramFileId, uploadedBy: uploadedBy ?? null })
    .returning();
  return proof;
}

export async function deleteAllProofs(): Promise<void> {
  await db.delete(paymentProofs);
}

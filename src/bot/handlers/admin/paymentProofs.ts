import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { adminProofsKeyboard } from '../../keyboards';
import { getAllProofs, addProof, deleteAllProofs } from '../../../services/paymentProofService';
import { getUserByTelegramId } from '../../../services/userService';
import {
  KB,
  ADMIN_PROOFS_HEADER,
  ADMIN_PROOFS_UPLOAD_PROMPT,
  ADMIN_PROOFS_ADDED,
  ADMIN_PROOFS_SAVED,
  ADMIN_PROOFS_UPLOAD_FAILED,
  ADMIN_PROOFS_CLEAR_CONFIRM,
  ADMIN_PROOFS_CLEARED,
  ADMIN_TASK_MEDIA_NO_FILES_PREVIEW,
} from '../../../i18n/ru';

// ── List / management screen ────────────────────────────────────────────────

export async function handleAdminProofList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.adminProofUploadStep = undefined;
  ctx.session.pendingProofCount = undefined;

  const proofs = await getAllProofs();

  await ctx.editMessageText(ADMIN_PROOFS_HEADER(proofs.length), {
    parse_mode: 'HTML',
    reply_markup: adminProofsKeyboard(proofs.length),
  });
}

// ── Start upload session ────────────────────────────────────────────────────

export async function handleAdminProofUpload(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const proofs = await getAllProofs();
  ctx.session.adminProofUploadStep = 'awaiting_proof_photo';
  ctx.session.pendingProofCount = proofs.length;

  const sent = await ctx.editMessageText(
    ADMIN_PROOFS_UPLOAD_PROMPT(proofs.length),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(ADMIN_PROOFS_SAVED, 'admin:proofs:done')
        .row()
        .text(KB.CANCEL, 'admin:proofs'),
    },
  );

  if (sent !== true) {
    // store prompt message id for live counter updates
    ctx.session.pendingProofCount = proofs.length;
  }
}

// ── Receive uploaded photo ──────────────────────────────────────────────────

export async function handleAdminProofPhoto(ctx: MyContext): Promise<void> {
  if (ctx.session.adminProofUploadStep !== 'awaiting_proof_photo') return;

  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  const photo = photos[photos.length - 1];

  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  try {
    await addProof(photo.file_id, adminUser?.id ?? null);
    ctx.session.pendingProofCount = (ctx.session.pendingProofCount ?? 0) + 1;
    const count = ctx.session.pendingProofCount;

    await ctx.reply(ADMIN_PROOFS_ADDED, {
      reply_markup: new InlineKeyboard()
        .text(ADMIN_PROOFS_SAVED, 'admin:proofs:done')
        .row()
        .text(KB.CANCEL, 'admin:proofs'),
    });
    // Re-send upload prompt so admin sees the updated count
    await ctx.reply(ADMIN_PROOFS_UPLOAD_PROMPT(count), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(ADMIN_PROOFS_SAVED, 'admin:proofs:done')
        .row()
        .text(KB.CANCEL, 'admin:proofs'),
    });
  } catch {
    await ctx.reply(ADMIN_PROOFS_UPLOAD_FAILED);
  }
}

// ── Done uploading ──────────────────────────────────────────────────────────

export async function handleAdminProofDone(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_PROOFS_SAVED });
  ctx.session.adminProofUploadStep = undefined;
  ctx.session.pendingProofCount = undefined;

  const proofs = await getAllProofs();

  await ctx.editMessageText(ADMIN_PROOFS_HEADER(proofs.length), {
    parse_mode: 'HTML',
    reply_markup: adminProofsKeyboard(proofs.length),
  });
}

// ── Preview ─────────────────────────────────────────────────────────────────

export async function handleAdminProofPreview(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const proofs = await getAllProofs();

  if (proofs.length === 0) {
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_MEDIA_NO_FILES_PREVIEW, show_alert: true });
    return;
  }

  for (const proof of proofs) {
    try {
      await ctx.replyWithPhoto(proof.telegramFileId);
    } catch {
      // File may no longer be accessible
    }
  }
}

// ── Clear confirm ───────────────────────────────────────────────────────────

export async function handleAdminProofClearConfirm(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(ADMIN_PROOFS_CLEAR_CONFIRM, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.YES_REMOVE_ALL, 'admin:proofs:clear')
      .text(KB.CANCEL, 'admin:proofs'),
  });
}

// ── Clear all ───────────────────────────────────────────────────────────────

export async function handleAdminProofClear(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_PROOFS_CLEARED });
  await deleteAllProofs();

  await ctx.editMessageText(ADMIN_PROOFS_HEADER(0), {
    parse_mode: 'HTML',
    reply_markup: adminProofsKeyboard(0),
  });
}

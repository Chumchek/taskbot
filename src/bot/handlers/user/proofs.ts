import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { getAllProofs } from '../../../services/paymentProofService';
import { KB, USER_PROOFS_EMPTY, USER_PROOFS_HEADER } from '../../../i18n/ru';

export async function handleUserProofGallery(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const proofs = await getAllProofs();

  if (proofs.length === 0) {
    await ctx.editMessageText(USER_PROOFS_EMPTY, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.BACK, 'user:menu'),
    });
    return;
  }

  await ctx.editMessageText(USER_PROOFS_HEADER(proofs.length), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.BACK, 'user:menu'),
  });

  for (const proof of proofs) {
    try {
      await ctx.replyWithPhoto(proof.telegramFileId);
    } catch {
      // File may no longer be accessible
    }
  }
}

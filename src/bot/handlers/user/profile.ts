import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { getUserByTelegramId, updateUserBinanceId, updateUserCard } from '../../../services/userService';
import { encrypt, decrypt, maskCard } from '../../../services/crypto';
import { userProfileKeyboard } from '../../keyboards';
import {
  KB,
  USER_PROFILE_HEADER,
  USER_PROFILE_BINANCE_PROMPT,
  USER_PROFILE_CARD_PROMPT,
  USER_PROFILE_BINANCE_SAVED,
  USER_PROFILE_CARD_SAVED,
  USER_PROFILE_INVALID_CARD,
} from '../../../i18n/ru';

export async function handleUserProfile(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.paymentEditStep = undefined;

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const maskedCard = dbUser.cardEncrypted
    ? maskCard(decrypt(dbUser.cardEncrypted))
    : null;

  await ctx.editMessageText(
    USER_PROFILE_HEADER(dbUser.binanceId ?? null, maskedCard),
    {
      parse_mode: 'HTML',
      reply_markup: userProfileKeyboard(),
    },
  );
}

export async function handleUserProfileEditBinance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.paymentEditStep = 'awaiting_binance_update';

  await ctx.editMessageText(USER_PROFILE_BINANCE_PROMPT, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.CANCEL, 'user:profile'),
  });
}

export async function handleUserProfileEditCard(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.paymentEditStep = 'awaiting_card_update';

  await ctx.editMessageText(USER_PROFILE_CARD_PROMPT, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.CANCEL, 'user:profile'),
  });
}

export async function handleProfileUpdateText(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const telegramId = ctx.from!.id.toString();
  const { paymentEditStep } = ctx.session;

  if (paymentEditStep === 'awaiting_binance_update') {
    ctx.session.paymentEditStep = undefined;
    await updateUserBinanceId(telegramId, text);
    await ctx.reply(USER_PROFILE_BINANCE_SAVED(text), {
      parse_mode: 'HTML',
      reply_markup: userProfileKeyboard(),
    });
    return;
  }

  if (paymentEditStep === 'awaiting_card_update') {
    const digits = text.replace(/\s+/g, '');
    if (!/^\d{16}$/.test(digits)) {
      await ctx.reply(USER_PROFILE_INVALID_CARD);
      return;
    }
    ctx.session.paymentEditStep = undefined;
    await updateUserCard(telegramId, encrypt(digits));
    await ctx.reply(USER_PROFILE_CARD_SAVED(maskCard(digits)), {
      parse_mode: 'HTML',
      reply_markup: userProfileKeyboard(),
    });
  }
}

import { db } from '../../db';
import { users } from '../../db/schema';
import { encrypt, maskCard } from '../../services/crypto';
import { getAllAdminIds } from '../../services/userService';
import { MyContext } from '../context';
import {
  approveUserKeyboard,
  registrationStep1Keyboard,
  registrationStep2Keyboard,
} from '../keyboards';
import {
  REG_STEP1_BINANCE,
  REG_STEP2_CARD,
  REG_INVALID_CARD,
  REG_MUST_PROVIDE_PAYMENT,
  REG_SUBMITTED,
  REG_ADMIN_NEW_USER,
} from '../../i18n/ru';

export async function handleRegistrationText(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const { step } = ctx.session;

  if (step === 'awaiting_binance') {
    ctx.session.pendingBinanceId = text;
    ctx.session.step = 'awaiting_card';
    await ctx.reply(REG_STEP2_CARD, {
      parse_mode: 'HTML',
      reply_markup: registrationStep2Keyboard(),
    });
    return;
  }

  if (step === 'awaiting_card') {
    const digits = text.replace(/\s+/g, '');
    if (!/^\d{16}$/.test(digits)) {
      await ctx.reply(REG_INVALID_CARD);
      return;
    }
    await completeRegistration(ctx, ctx.session.pendingBinanceId, digits);
  }
}

export async function completeRegistration(
  ctx: MyContext,
  binanceId: string | undefined,
  cardNumber: string | undefined,
): Promise<void> {
  const telegramId = ctx.from!.id.toString();

  await db.insert(users).values({
    telegramId,
    username: ctx.from?.username ?? null,
    firstName: ctx.from?.first_name ?? null,
    binanceId: binanceId ?? null,
    cardEncrypted: cardNumber ? encrypt(cardNumber) : null,
    status: 'pending',
  });

  ctx.session.step = 'idle';
  ctx.session.pendingBinanceId = undefined;

  const userName = ctx.from?.username
    ? `@${ctx.from.username}`
    : ctx.from?.first_name ?? 'Unknown';

  const paymentLines = [
    binanceId ? `Binance ID: <code>${binanceId}</code>` : null,
    cardNumber ? `Карта: <code>${maskCard(cardNumber)}</code>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  for (const adminId of await getAllAdminIds()) {
    try {
      await ctx.api.sendMessage(
        adminId,
        REG_ADMIN_NEW_USER(userName, telegramId, paymentLines),
        {
          parse_mode: 'HTML',
          reply_markup: approveUserKeyboard(telegramId),
        },
      );
    } catch {
      // Admin may not have started the bot
    }
  }

  await ctx.reply(REG_SUBMITTED, { parse_mode: 'HTML' });
}

export async function handleRegSkipBinance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.step = 'awaiting_card';
  ctx.session.pendingBinanceId = undefined;
  await ctx.editMessageText(REG_STEP2_CARD, {
    parse_mode: 'HTML',
    reply_markup: registrationStep2Keyboard(),
  });
}

export async function handleRegSkipCard(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.session.pendingBinanceId) {
    ctx.session.step = 'awaiting_binance';
    await ctx.editMessageText(REG_MUST_PROVIDE_PAYMENT, {
      parse_mode: 'HTML',
      reply_markup: registrationStep1Keyboard(),
    });
    return;
  }

  await completeRegistration(ctx, ctx.session.pendingBinanceId, undefined);
}

export async function handleRegBackToBinance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.step = 'awaiting_binance';
  ctx.session.pendingBinanceId = undefined;
  await ctx.editMessageText(REG_STEP1_BINANCE, {
    parse_mode: 'HTML',
    reply_markup: registrationStep1Keyboard(),
  });
}

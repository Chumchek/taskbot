import { InlineKeyboard } from 'grammy';
import { db } from '../../db';
import { users } from '../../db/schema';
import { encrypt, maskCard } from '../../services/crypto';
import { config } from '../../config';
import { MyContext } from '../context';
import {
  approveUserKeyboard,
  registrationStep1Keyboard,
  registrationStep2Keyboard,
} from '../keyboards';

export async function handleRegistrationText(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const { step } = ctx.session;

  if (step === 'awaiting_binance') {
    ctx.session.pendingBinanceId = text;
    ctx.session.step = 'awaiting_card';
    await ctx.reply(
      `<b>Step 2/2:</b> Enter your <b>bank card number</b> (16 digits):\n` +
        `<i>(spaces are OK, e.g. 1234 5678 9012 3456)</i>`,
      { parse_mode: 'HTML', reply_markup: registrationStep2Keyboard() },
    );
    return;
  }

  if (step === 'awaiting_card') {
    const digits = text.replace(/\s+/g, '');
    if (!/^\d{16}$/.test(digits)) {
      await ctx.reply('❌ Invalid card number. Please enter exactly 16 digits (spaces are OK):');
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
    cardNumber ? `Card: <code>${maskCard(cardNumber)}</code>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  for (const adminId of config.admins) {
    try {
      await ctx.api.sendMessage(
        adminId,
        `🆕 <b>New user registration</b>\n\n` +
          `User: ${userName}\n` +
          `Telegram ID: <code>${telegramId}</code>\n` +
          `${paymentLines}`,
        {
          parse_mode: 'HTML',
          reply_markup: approveUserKeyboard(telegramId),
        },
      );
    } catch {
      // Admin may have not started the bot
    }
  }

  await ctx.reply(
    `✅ <b>Registration submitted!</b>\n\n` +
      `An admin will review your application. You will be notified once approved.`,
    { parse_mode: 'HTML' },
  );
}

// Callback handlers for registration inline buttons
export async function handleRegSkipBinance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.step = 'awaiting_card';
  ctx.session.pendingBinanceId = undefined;
  await ctx.editMessageText(
    `<b>Step 2/2:</b> Enter your <b>bank card number</b> (16 digits):\n` +
      `<i>(spaces are OK, e.g. 1234 5678 9012 3456)</i>`,
    { parse_mode: 'HTML', reply_markup: registrationStep2Keyboard() },
  );
}

export async function handleRegSkipCard(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  if (!ctx.session.pendingBinanceId) {
    ctx.session.step = 'awaiting_binance';
    await ctx.editMessageText(
      `❌ You must provide at least one payment method.\n\n` +
        `<b>Step 1/2:</b> Enter your <b>Binance Pay ID</b>:`,
      { parse_mode: 'HTML', reply_markup: registrationStep1Keyboard() },
    );
    return;
  }

  await completeRegistration(ctx, ctx.session.pendingBinanceId, undefined);
}

export async function handleRegBackToBinance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.step = 'awaiting_binance';
  ctx.session.pendingBinanceId = undefined;
  await ctx.editMessageText(
    `<b>Step 1/2:</b> Enter your <b>Binance Pay ID</b>:\n` +
      `<i>(9-digit number from your Binance → Pay → Receive screen)</i>`,
    { parse_mode: 'HTML', reply_markup: registrationStep1Keyboard() },
  );
}

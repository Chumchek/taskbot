import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { MyContext } from '../context';
import { mainMenuKeyboard, registrationStep1Keyboard } from '../keyboards';

export async function handleStart(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  // Reset any in-progress registration when user sends /start again
  ctx.session.step = 'idle';
  ctx.session.pendingBinanceId = undefined;

  const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));

  if (user) {
    if (user.status === 'approved') {
      await ctx.reply(
        `Welcome back, <b>${ctx.from?.first_name}</b>! 👋\n\nUse the menu below to get started.`,
        { parse_mode: 'HTML', reply_markup: mainMenuKeyboard() },
      );
    } else if (user.status === 'pending') {
      await ctx.reply('⏳ Your registration is pending admin approval. You will be notified once approved.');
    } else {
      await ctx.reply('❌ Your registration was rejected. Please contact an admin.');
    }
    return;
  }

  // New user — start registration
  ctx.session.step = 'awaiting_binance';
  await ctx.reply(
    `👋 <b>Welcome to TaskBot!</b>\n\n` +
      `To register, we need at least one payment method.\n\n` +
      `<b>Step 1/2:</b> Enter your <b>Binance Pay ID</b>:\n` +
      `<i>(9-digit number from your Binance → Pay → Receive screen)</i>`,
    { parse_mode: 'HTML', reply_markup: registrationStep1Keyboard() },
  );
}

import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { MyContext } from '../context';
import { mainMenuKeyboard, registrationStep1Keyboard } from '../keyboards';
import { REG_WELCOME_BACK, REG_PENDING, REG_REJECTED, REG_START } from '../../i18n/ru';

export async function handleStart(ctx: MyContext): Promise<void> {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  ctx.session.step = 'idle';
  ctx.session.pendingBinanceId = undefined;

  const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));

  if (user) {
    if (user.status === 'approved') {
      await ctx.reply(REG_WELCOME_BACK(ctx.from?.first_name ?? ''), {
        parse_mode: 'HTML',
        reply_markup: mainMenuKeyboard(),
      });
    } else if (user.status === 'pending') {
      await ctx.reply(REG_PENDING);
    } else {
      await ctx.reply(REG_REJECTED);
    }
    return;
  }

  ctx.session.step = 'awaiting_binance';
  await ctx.reply(REG_START, {
    parse_mode: 'HTML',
    reply_markup: registrationStep1Keyboard(),
  });
}

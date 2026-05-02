import { NextFunction } from 'grammy';
import { MyContext } from '../context';
import { isAdmin } from '../../services/userService';

export async function adminOnly(ctx: MyContext, next: NextFunction): Promise<void> {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId || !(await isAdmin(telegramId))) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: '⛔ Admins only', show_alert: true });
    } else {
      await ctx.reply('⛔ This command is for admins only.');
    }
    return;
  }

  await next();
}

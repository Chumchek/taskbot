import { NextFunction } from 'grammy';
import { MyContext } from '../context';
import { isAdmin, getUserByTelegramId } from '../../services/userService';
import { AUTH_NOT_REGISTERED, AUTH_PENDING, AUTH_REJECTED, AUTH_BANNED } from '../../i18n/ru';

// Global guard that runs on every update (after session middleware).
// Blocks unapproved/unregistered users from accessing bot features.
//
// Exceptions (always allowed through):
//   - /start command
//   - reg:* callbacks (registration flow inline buttons)
//   - Users mid-registration (session.step !== 'idle')
//   - Admins (env ADMIN_IDS or DB is_admin flag)
export async function approvedOnly(ctx: MyContext, next: NextFunction): Promise<void> {
  const telegramId = ctx.from?.id.toString();

  if (!telegramId) return next();

  const messageText = ctx.message?.text ?? '';
  if (messageText.startsWith('/start')) return next();

  const cbData = ctx.callbackQuery?.data ?? '';
  if (cbData.startsWith('reg:')) return next();

  if (ctx.session.step !== 'idle') return next();

  if (await isAdmin(telegramId)) return next();

  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await replyOrAlert(ctx, AUTH_NOT_REGISTERED);
    return;
  }

  if (user.status === 'pending') {
    await replyOrAlert(ctx, AUTH_PENDING);
    return;
  }

  if (user.status === 'rejected') {
    await replyOrAlert(ctx, AUTH_REJECTED);
    return;
  }

  if (user.status === 'banned') {
    await replyOrAlert(ctx, AUTH_BANNED);
    return;
  }

  return next();
}

async function replyOrAlert(ctx: MyContext, text: string): Promise<void> {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text, show_alert: true });
  } else {
    await ctx.reply(text);
  }
}

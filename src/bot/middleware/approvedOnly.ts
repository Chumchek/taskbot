import { NextFunction } from 'grammy';
import { MyContext } from '../context';
import { isAdmin, getUserByTelegramId } from '../../services/userService';

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

  // No identifiable sender (channel posts, etc.) — pass through
  if (!telegramId) return next();

  // /start is always allowed so users can see their status or begin registration
  const messageText = ctx.message?.text ?? '';
  if (messageText.startsWith('/start')) return next();

  // Registration inline buttons are always allowed
  const cbData = ctx.callbackQuery?.data ?? '';
  if (cbData.startsWith('reg:')) return next();

  // Users actively in the registration text flow (entering Binance ID / card)
  if (ctx.session.step !== 'idle') return next();

  // Admins bypass the approved check entirely
  if (await isAdmin(telegramId)) return next();

  // Everyone else: look up user status
  const user = await getUserByTelegramId(telegramId);

  if (!user) {
    await replyOrAlert(ctx, '⚠️ Please use /start to register first.');
    return;
  }

  if (user.status === 'pending') {
    await replyOrAlert(ctx, '⏳ Your registration is pending admin approval. You will be notified once approved.');
    return;
  }

  if (user.status === 'rejected') {
    await replyOrAlert(ctx, '❌ Your registration was rejected. Please contact an admin.');
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

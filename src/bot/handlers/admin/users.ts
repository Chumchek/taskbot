import { MyContext } from '../../context';
import { adminMenuKeyboard, approveUserKeyboard } from '../../keyboards';
import { approveUser, getPendingUsers, promoteUser, rejectUser } from '../../../services/userService';
import { decrypt, maskCard } from '../../../services/crypto';
import {
  ADMIN_NO_PENDING_USERS,
  ADMIN_PENDING_USERS_HEADER,
  ADMIN_USER_NO_PAYMENT,
  ADMIN_USER_APPROVED,
  ADMIN_USER_REJECTED,
  ADMIN_USER_NOT_FOUND,
  ADMIN_PROMOTE_USAGE,
  ADMIN_PROMOTE_NOT_FOUND,
  ADMIN_PROMOTED,
  REG_APPROVED_NOTIFY,
  REG_REJECTED_NOTIFY,
} from '../../../i18n/ru';

export async function handlePendingUsers(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const pending = await getPendingUsers();

  if (pending.length === 0) {
    await ctx.editMessageText(ADMIN_NO_PENDING_USERS, {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  await ctx.editMessageText(ADMIN_PENDING_USERS_HEADER(pending.length), {
    parse_mode: 'HTML',
  });

  for (const user of pending) {
    const name = user.username ? `@${user.username}` : user.firstName ?? `ID ${user.telegramId}`;
    const paymentLines = [
      user.binanceId ? `Binance: <code>${user.binanceId}</code>` : null,
      user.cardEncrypted
        ? `Карта: <code>${maskCard(decrypt(user.cardEncrypted))}</code>`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    await ctx.reply(
      `👤 <b>${name}</b>\nTelegram ID: <code>${user.telegramId}</code>\n${paymentLines || ADMIN_USER_NO_PAYMENT}`,
      { parse_mode: 'HTML', reply_markup: approveUserKeyboard(user.telegramId) },
    );
  }
}

export async function handleApproveUser(ctx: MyContext, telegramId: string): Promise<void> {
  const user = await approveUser(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: ADMIN_USER_NOT_FOUND, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ Одобрено!' });
  const name = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(ADMIN_USER_APPROVED(name), { parse_mode: 'HTML' });

  try {
    await ctx.api.sendMessage(telegramId, REG_APPROVED_NOTIFY, { parse_mode: 'HTML' });
  } catch {
    // User may have blocked the bot
  }
}

export async function handleRejectUser(ctx: MyContext, telegramId: string): Promise<void> {
  const user = await rejectUser(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: ADMIN_USER_NOT_FOUND, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '❌ Отклонено' });
  const name = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(ADMIN_USER_REJECTED(name), { parse_mode: 'HTML' });

  try {
    await ctx.api.sendMessage(telegramId, REG_REJECTED_NOTIFY);
  } catch {
    // User may have blocked the bot
  }
}

export async function handlePromoteCommand(ctx: MyContext): Promise<void> {
  const args = ctx.message?.text?.split(' ').slice(1).join(' ').trim();

  if (!args) {
    await ctx.reply(ADMIN_PROMOTE_USAGE);
    return;
  }

  const user = await promoteUser(args);

  if (!user) {
    await ctx.reply(ADMIN_PROMOTE_NOT_FOUND(args), { parse_mode: 'HTML' });
    return;
  }

  const name = user.username ? `@${user.username}` : user.firstName ?? args;
  await ctx.reply(ADMIN_PROMOTED(name), { parse_mode: 'HTML' });
}

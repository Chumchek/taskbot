import { MyContext } from '../../context';
import { adminMenuKeyboard, approveUserKeyboard } from '../../keyboards';
import { approveUser, getPendingUsers, promoteUser, rejectUser } from '../../../services/userService';
import { decrypt, maskCard } from '../../../services/crypto';

export async function handlePendingUsers(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const pending = await getPendingUsers();

  if (pending.length === 0) {
    await ctx.editMessageText('✅ No pending registrations.', {
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  await ctx.editMessageText(`👥 <b>Pending Users</b> — ${pending.length} awaiting approval`, {
    parse_mode: 'HTML',
  });

  for (const user of pending) {
    const name = user.username ? `@${user.username}` : user.firstName ?? `ID ${user.telegramId}`;
    const paymentLines = [
      user.binanceId ? `Binance: <code>${user.binanceId}</code>` : null,
      user.cardEncrypted
        ? `Card: <code>${maskCard(decrypt(user.cardEncrypted))}</code>`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    await ctx.reply(
      `👤 <b>${name}</b>\nTelegram ID: <code>${user.telegramId}</code>\n${paymentLines || '<i>No payment info</i>'}`,
      { parse_mode: 'HTML', reply_markup: approveUserKeyboard(user.telegramId) },
    );
  }
}

export async function handleApproveUser(ctx: MyContext, telegramId: string): Promise<void> {
  const user = await approveUser(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ Approved!' });
  const name = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(`✅ <b>Approved:</b> ${name}`, { parse_mode: 'HTML' });

  try {
    await ctx.api.sendMessage(
      telegramId,
      `🎉 <b>Registration approved!</b>\n\nYou can now use the bot. Send /start to begin.`,
      { parse_mode: 'HTML' },
    );
  } catch {
    // User may have blocked the bot
  }
}

export async function handleRejectUser(ctx: MyContext, telegramId: string): Promise<void> {
  const user = await rejectUser(telegramId);

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '❌ Rejected' });
  const name = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(`❌ <b>Rejected:</b> ${name}`, { parse_mode: 'HTML' });

  try {
    await ctx.api.sendMessage(
      telegramId,
      `❌ Your registration was rejected. Please contact an admin for more information.`,
    );
  } catch {
    // User may have blocked the bot
  }
}

export async function handlePromoteCommand(ctx: MyContext): Promise<void> {
  const args = ctx.message?.text?.split(' ').slice(1).join(' ').trim();

  if (!args) {
    await ctx.reply('Usage: /promote <telegram_id>\n\nExample: /promote 123456789');
    return;
  }

  const user = await promoteUser(args);

  if (!user) {
    await ctx.reply(`❌ No user found with Telegram ID <code>${args}</code>.\n\nNote: user must be registered first.`, {
      parse_mode: 'HTML',
    });
    return;
  }

  const name = user.username ? `@${user.username}` : user.firstName ?? args;
  await ctx.reply(`👑 <b>${name}</b> is now an admin.`, { parse_mode: 'HTML' });
}

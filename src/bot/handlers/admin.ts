import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { users } from '../../db/schema';
import { decrypt, maskCard } from '../../services/crypto';
import { MyContext } from '../context';
import { adminMenuKeyboard, approveUserKeyboard, mainMenuKeyboard } from '../keyboards';

export async function handleAdminCommand(ctx: MyContext): Promise<void> {
  await ctx.reply('<b>🔧 Admin Panel</b>\n\nWhat would you like to manage?', {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}

export async function handlePendingUsers(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const pendingUsers = await db.select().from(users).where(eq(users.status, 'pending'));

  if (pendingUsers.length === 0) {
    await ctx.editMessageText('✅ No pending registrations.', { reply_markup: adminMenuKeyboard() });
    return;
  }

  await ctx.editMessageText(
    `👥 <b>Pending Users</b> — ${pendingUsers.length} awaiting approval`,
    { parse_mode: 'HTML' },
  );

  for (const user of pendingUsers) {
    const displayName = user.username
      ? `@${user.username}`
      : user.firstName ?? `ID ${user.telegramId}`;

    const paymentLines = [
      user.binanceId ? `Binance: <code>${user.binanceId}</code>` : null,
      user.cardEncrypted
        ? `Card: <code>${maskCard(decrypt(user.cardEncrypted))}</code>`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    await ctx.reply(
      `👤 <b>${displayName}</b>\n` +
        `Telegram ID: <code>${user.telegramId}</code>\n` +
        `${paymentLines || '<i>No payment info</i>'}`,
      {
        parse_mode: 'HTML',
        reply_markup: approveUserKeyboard(user.telegramId),
      },
    );
  }
}

export async function handleApproveUser(ctx: MyContext, telegramId: string): Promise<void> {
  const [user] = await db
    .update(users)
    .set({ status: 'approved' })
    .where(eq(users.telegramId, telegramId))
    .returning();

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ User approved!' });

  const displayName = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(`✅ <b>Approved:</b> ${displayName}`, { parse_mode: 'HTML' });

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
  const [user] = await db
    .update(users)
    .set({ status: 'rejected' })
    .where(eq(users.telegramId, telegramId))
    .returning();

  if (!user) {
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '❌ User rejected' });

  const displayName = user.username ? `@${user.username}` : user.firstName ?? telegramId;
  await ctx.editMessageText(`❌ <b>Rejected:</b> ${displayName}`, { parse_mode: 'HTML' });

  try {
    await ctx.api.sendMessage(
      telegramId,
      `❌ Your registration was rejected. Please contact an admin for more information.`,
    );
  } catch {
    // User may have blocked the bot
  }
}

// Stubs for future phases — prevents "query is not handled" errors
export async function handleAdminStub(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: '🚧 Coming in the next phase', show_alert: false });
}

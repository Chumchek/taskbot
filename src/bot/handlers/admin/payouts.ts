import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { adminMenuKeyboard } from '../../keyboards';
import { getUserByTelegramId } from '../../../services/userService';
import {
  getDecryptedCard,
  getPaymentInfo,
  getPayoutQueue,
  getUnpaidCompletedTasks,
  processUserPayout,
  PAYOUT_THRESHOLD,
} from '../../../services/payoutService';

// ── Payout queue list ───────────────────────────────────────────────────────

export async function handleAdminPayoutQueue(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();

  if (queue.length === 0) {
    await ctx.editMessageText(
      `💰 <b>Payout Queue</b>\n\nNo users have reached the ${PAYOUT_THRESHOLD} UAH threshold yet.`,
      { parse_mode: 'HTML', reply_markup: adminMenuKeyboard() },
    );
    return;
  }

  const kb = new InlineKeyboard();
  for (const item of queue) {
    const name = item.user.username
      ? `@${item.user.username}`
      : item.user.firstName ?? item.user.telegramId;
    kb.text(`👤 ${name} — ${parseFloat(item.balance).toFixed(2)} UAH`, `admin:payout:view:${item.user.id}`).row();
  }
  kb.text('◀ Back', 'admin:menu');

  await ctx.editMessageText(
    `💰 <b>Payout Queue</b> (${queue.length} user${queue.length === 1 ? '' : 's'})\n\n` +
      `These users have reached the ${PAYOUT_THRESHOLD} UAH threshold and are waiting for payment.`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── User payout detail ──────────────────────────────────────────────────────

export async function handleAdminPayoutView(ctx: MyContext, userId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  // Find user by their DB id
  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: '❌ User not found or no longer eligible', show_alert: true });
    await handleAdminPayoutQueue(ctx);
    return;
  }

  const { user, balance } = item;
  const name = user.username ? `@${user.username}` : user.firstName ?? user.telegramId;
  const paymentInfo = getPaymentInfo(user);
  const completedTasks = await getUnpaidCompletedTasks(user.id);

  // Payment methods
  const paymentLines = [
    paymentInfo.binanceId
      ? `• Binance ID: <code>${paymentInfo.binanceId}</code>`
      : null,
    paymentInfo.maskedCard
      ? `• Card: <code>${paymentInfo.maskedCard}</code>`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Task breakdown
  const taskLines =
    completedTasks.length > 0
      ? completedTasks
          .map((t) => {
            const date = t.completedAt
              ? new Date(t.completedAt).toLocaleDateString('uk-UA')
              : '';
            return `• ${t.taskTitle} — ${t.priceUah} UAH${date ? ` (${date})` : ''}`;
          })
          .join('\n')
      : '<i>No task details available.</i>';

  const kb = new InlineKeyboard()
    .text(`✅ Mark as Paid (${parseFloat(balance).toFixed(2)} UAH)`, `admin:payout:confirm:${user.id}`)
    .row();

  if (paymentInfo.hasEncryptedCard) {
    kb.text('🔓 Show Full Card', `admin:payout:show_card:${user.id}`).row();
  }

  kb.text('◀ Back to Queue', 'admin:payouts');

  await ctx.editMessageText(
    `👤 <b>${name}</b>\n` +
      `Telegram ID: <code>${user.telegramId}</code>\n\n` +
      `💰 Balance due: <b>${parseFloat(balance).toFixed(2)} UAH</b>\n\n` +
      `<b>Payment methods:</b>\n${paymentLines || '<i>None on file</i>'}\n\n` +
      `<b>Completed tasks (current cycle):</b>\n${taskLines}`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Confirm payout ──────────────────────────────────────────────────────────

export async function handleAdminPayoutConfirm(ctx: MyContext, userId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);
  if (!item) {
    await ctx.answerCallbackQuery({ text: '❌ User no longer eligible', show_alert: true });
    return;
  }

  const name = item.user.username
    ? `@${item.user.username}`
    : item.user.firstName ?? item.user.telegramId;

  await ctx.editMessageText(
    `⚠️ <b>Confirm Payout</b>\n\n` +
      `User: <b>${name}</b>\n` +
      `Amount: <b>${parseFloat(item.balance).toFixed(2)} UAH</b>\n\n` +
      `Have you already sent the payment outside the bot?\n` +
      `Clicking confirm will reset their balance to 0 UAH.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Yes, Paid', `admin:payout:mark_paid:${userId}`)
        .text('❌ Cancel', `admin:payout:view:${userId}`),
    },
  );
}

// ── Mark as paid ────────────────────────────────────────────────────────────

export async function handleAdminPayoutMarkPaid(ctx: MyContext, userId: number): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await processUserPayout(userId, adminUser?.id ?? 0);

  if (!result) {
    await ctx.answerCallbackQuery({
      text: '❌ Payout failed — user may no longer be eligible',
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ Payout recorded!' });

  await ctx.editMessageText(
    `✅ <b>Payout #${result.payoutId} recorded</b>\n\n` +
      `User: ${result.userName}\n` +
      `Amount: <b>${parseFloat(result.amount).toFixed(2)} UAH</b>\n` +
      `Balance reset to 0.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('💰 Back to Queue', 'admin:payouts')
        .row()
        .text('◀ Admin Menu', 'admin:menu'),
    },
  );

  // Notify user
  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      `💸 <b>Payment sent!</b>\n\n` +
        `You have received <b>${parseFloat(result.amount).toFixed(2)} UAH</b>.\n` +
        `Your balance has been reset to 0.\n\n` +
        `Keep completing tasks to earn more!`,
      { parse_mode: 'HTML' },
    );
  } catch {
    // User may have blocked the bot
  }
}

// ── Show full card (auto-deletes after 60s) ─────────────────────────────────

export async function handleAdminPayoutShowCard(ctx: MyContext, userId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  const card = getDecryptedCard(item.user);

  if (!card) {
    await ctx.answerCallbackQuery({ text: 'No card on file', show_alert: true });
    return;
  }

  const formatted = card.replace(/(\d{4})/g, '$1 ').trim();

  const msg = await ctx.reply(
    `🔓 <b>Full Card Number</b>\n\n<code>${formatted}</code>\n\n⚠️ This message will be deleted in 60 seconds.`,
    { parse_mode: 'HTML' },
  );

  // Schedule deletion
  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id);
    } catch {
      // Message may already be deleted
    }
  }, 60_000);
}

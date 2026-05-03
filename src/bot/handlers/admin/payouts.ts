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
import {
  KB,
  ADMIN_PAYOUT_EMPTY,
  ADMIN_PAYOUT_QUEUE_HEADER,
  ADMIN_PAYOUT_USER_NOT_FOUND,
  ADMIN_PAYOUT_NO_LONGER_ELIGIBLE,
  ADMIN_PAYOUT_DETAIL,
  ADMIN_PAYOUT_NO_TASK_DETAILS,
  ADMIN_PAYOUT_CONFIRM,
  ADMIN_PAYOUT_FAILED,
  ADMIN_PAYOUT_RECORDED_LABEL,
  ADMIN_PAYOUT_RECORDED_TEXT,
  ADMIN_PAYOUT_NOTIFY,
  ADMIN_PAYOUT_SHOW_CARD,
  ADMIN_PAYOUT_NO_CARD,
} from '../../../i18n/ru';

// ── Payout queue list ───────────────────────────────────────────────────────

export async function handleAdminPayoutQueue(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();

  if (queue.length === 0) {
    await ctx.editMessageText(ADMIN_PAYOUT_EMPTY(PAYOUT_THRESHOLD), {
      parse_mode: 'HTML',
      reply_markup: adminMenuKeyboard(),
    });
    return;
  }

  const kb = new InlineKeyboard();
  for (const item of queue) {
    const name = item.user.username
      ? `@${item.user.username}`
      : item.user.firstName ?? item.user.telegramId;
    kb.text(
      `👤 ${name} — ${parseFloat(item.balance).toFixed(2)} грн`,
      `admin:payout:view:${item.user.id}`,
    ).row();
  }
  kb.text(KB.BACK, 'admin:menu');

  await ctx.editMessageText(ADMIN_PAYOUT_QUEUE_HEADER(queue.length, PAYOUT_THRESHOLD), {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

// ── User payout detail ──────────────────────────────────────────────────────

export async function handleAdminPayoutView(ctx: MyContext, userId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_USER_NOT_FOUND, show_alert: true });
    await handleAdminPayoutQueue(ctx);
    return;
  }

  const { user, balance } = item;
  const name = user.username ? `@${user.username}` : user.firstName ?? user.telegramId;
  const paymentInfo = getPaymentInfo(user);
  const completedTasks = await getUnpaidCompletedTasks(user.id);

  const paymentLines = [
    paymentInfo.binanceId
      ? `• Binance ID: <code>${paymentInfo.binanceId}</code>`
      : null,
    paymentInfo.maskedCard
      ? `• Карта: <code>${paymentInfo.maskedCard}</code>`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const taskLines =
    completedTasks.length > 0
      ? completedTasks
          .map((t) => {
            const date = t.completedAt
              ? new Date(t.completedAt).toLocaleDateString('ru-RU')
              : '';
            return `• ${t.taskTitle} — ${t.priceUah} грн${date ? ` (${date})` : ''}`;
          })
          .join('\n')
      : ADMIN_PAYOUT_NO_TASK_DETAILS;

  const kb = new InlineKeyboard()
    .text(
      KB.MARK_PAID(parseFloat(balance).toFixed(2)),
      `admin:payout:confirm:${user.id}`,
    )
    .row();

  if (paymentInfo.hasEncryptedCard) {
    kb.text(KB.SHOW_FULL_CARD, `admin:payout:show_card:${user.id}`).row();
  }

  kb.text(KB.BACK_QUEUE, 'admin:payouts');

  await ctx.editMessageText(
    ADMIN_PAYOUT_DETAIL(name, user.telegramId, parseFloat(balance).toFixed(2), paymentLines, taskLines),
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Confirm payout ──────────────────────────────────────────────────────────

export async function handleAdminPayoutConfirm(ctx: MyContext, userId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);
  if (!item) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_NO_LONGER_ELIGIBLE, show_alert: true });
    return;
  }

  const name = item.user.username
    ? `@${item.user.username}`
    : item.user.firstName ?? item.user.telegramId;

  await ctx.editMessageText(
    ADMIN_PAYOUT_CONFIRM(name, parseFloat(item.balance).toFixed(2)),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.YES_PAID, `admin:payout:mark_paid:${userId}`)
        .text(KB.CANCEL, `admin:payout:view:${userId}`),
    },
  );
}

// ── Mark as paid ────────────────────────────────────────────────────────────

export async function handleAdminPayoutMarkPaid(ctx: MyContext, userId: number): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await processUserPayout(userId, adminUser?.id ?? 0);

  if (!result) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_FAILED, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_RECORDED_LABEL });

  await ctx.editMessageText(
    ADMIN_PAYOUT_RECORDED_TEXT(result.payoutId, result.userName, parseFloat(result.amount).toFixed(2)),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.BACK_QUEUE, 'admin:payouts')
        .row()
        .text(KB.BACK_ADMIN_MENU, 'admin:menu'),
    },
  );

  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      ADMIN_PAYOUT_NOTIFY(parseFloat(result.amount).toFixed(2)),
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
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_USER_NOT_FOUND, show_alert: true });
    return;
  }

  const card = getDecryptedCard(item.user);

  if (!card) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_NO_CARD, show_alert: true });
    return;
  }

  const formatted = card.replace(/(\d{4})/g, '$1 ').trim();

  const msg = await ctx.reply(ADMIN_PAYOUT_SHOW_CARD(formatted), { parse_mode: 'HTML' });

  setTimeout(async () => {
    try {
      await ctx.api.deleteMessage(ctx.chat!.id, msg.message_id);
    } catch {
      // Message may already be deleted
    }
  }, 60_000);
}

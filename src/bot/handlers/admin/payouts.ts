import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { adminMenuKeyboard } from '../../keyboards';
import { getUserByTelegramId } from '../../../services/userService';
import { buildBoundedList, escapeHtml, truncate } from '../../../utils/html';
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
  ADMIN_PAYOUT_NOTIFY_WITH_PROOF,
  ADMIN_PAYOUT_PROOF_PROMPT,
  ADMIN_PAYOUT_SHOW_CARD,
  ADMIN_PAYOUT_NO_CARD,
} from '../../../i18n/ru';


const TASKS_PAGE_SIZE = 10;

function displayName(user: { username: string | null; firstName: string | null; telegramId: string }): string {
  return user.username ? `@${user.username}` : user.firstName ?? user.telegramId;
}

// ── Payout queue list ───────────────────────────────────────────────────────

export async function handleAdminPayoutQueue(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await renderPayoutQueue(ctx);
}

/** Renders the queue without touching the callback query — see handleAdminPayoutView. */
async function renderPayoutQueue(ctx: MyContext): Promise<void> {
  ctx.session.pendingPayoutUserId = undefined;

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
    const name = displayName(item.user);
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

export async function handleAdminPayoutView(
  ctx: MyContext,
  userId: number,
  page = 0,
): Promise<void> {
  ctx.session.pendingPayoutUserId = undefined;

  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);

  if (!item) {
    // Answer once, with the alert — a second answerCallbackQuery on an
    // already-answered query throws and leaves the admin with no feedback.
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_USER_NOT_FOUND, show_alert: true });
    await renderPayoutQueue(ctx);
    return;
  }

  await ctx.answerCallbackQuery();

  const { user, balance } = item;
  const name = escapeHtml(displayName(user));
  const paymentInfo = getPaymentInfo(user);
  const completedTasks = await getUnpaidCompletedTasks(user.id);

  const paymentLines = [
    paymentInfo.binanceId
      ? `• Binance ID: <code>${escapeHtml(paymentInfo.binanceId)}</code>`
      : null,
    paymentInfo.maskedCard
      ? `• Карта: <code>${escapeHtml(paymentInfo.maskedCard)}</code>`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  const totalPages = Math.max(1, Math.ceil(completedTasks.length / TASKS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTasks = completedTasks.slice(
    safePage * TASKS_PAGE_SIZE,
    (safePage + 1) * TASKS_PAGE_SIZE,
  );

  // One page always fits, but titles are unbounded `text` — keep the budget
  // guard so a few very long ones still cannot trip MESSAGE_TOO_LONG.
  const taskLines =
    pageTasks.length > 0
      ? buildBoundedList(
          pageTasks,
          (t) => {
            const date = t.completedAt
              ? new Date(t.completedAt).toLocaleDateString('ru-RU')
              : '';
            return `• ${escapeHtml(truncate(t.taskTitle))} — ${t.priceUah} грн${date ? ` (${date})` : ''}`;
          },
          { maxRows: TASKS_PAGE_SIZE },
        )
      : ADMIN_PAYOUT_NO_TASK_DETAILS;

  const kb = new InlineKeyboard();

  // Task pagination row — same shape as the admin task list
  if (totalPages > 1) {
    if (safePage > 0) {
      kb.text(KB.PAGE_PREV, `admin:payout:view:${user.id}:${safePage - 1}`);
    }
    kb.text(`${safePage + 1} / ${totalPages}`, 'admin:payout:noop');
    if (safePage < totalPages - 1) {
      kb.text(KB.PAGE_NEXT, `admin:payout:view:${user.id}:${safePage + 1}`);
    }
    kb.row();
  }

  kb.text(
    KB.MARK_PAID(parseFloat(balance).toFixed(2)),
    `admin:payout:confirm:${user.id}`,
  ).row();

  if (paymentInfo.hasEncryptedCard) {
    kb.text(KB.SHOW_FULL_CARD, `admin:payout:show_card:${user.id}`).row();
  }

  kb.text(KB.BACK_QUEUE, 'admin:payouts');

  await ctx.editMessageText(
    ADMIN_PAYOUT_DETAIL(
      name,
      escapeHtml(user.telegramId),
      parseFloat(balance).toFixed(2),
      paymentLines,
      taskLines,
      completedTasks.length,
    ),
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Confirm payout ──────────────────────────────────────────────────────────

export async function handleAdminPayoutConfirm(ctx: MyContext, userId: number): Promise<void> {
  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);
  if (!item) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_NO_LONGER_ELIGIBLE, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const name = escapeHtml(displayName(item.user));

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

// ── Mark as paid — ask for proof screenshot ─────────────────────────────────

export async function handleAdminPayoutMarkPaid(ctx: MyContext, userId: number): Promise<void> {
  const queue = await getPayoutQueue();
  const item = queue.find((q) => q.user.id === userId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_NO_LONGER_ELIGIBLE, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const name = escapeHtml(displayName(item.user));

  ctx.session.pendingPayoutUserId = userId;

  await ctx.editMessageText(
    ADMIN_PAYOUT_PROOF_PROMPT(name, parseFloat(item.balance).toFixed(2)),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.SKIP_NO_PROOF, `admin:payout:proof_skip:${userId}`)
        .row()
        .text(KB.CANCEL, `admin:payout:view:${userId}`),
    },
  );
}

// ── Skip proof — record payout without screenshot ───────────────────────────

export async function handleAdminPayoutProofSkip(ctx: MyContext, userId: number): Promise<void> {
  // finalisePayout answers the callback query itself (with the success toast or
  // the failure alert) — answering here too would make that second call throw.
  ctx.session.pendingPayoutUserId = undefined;
  await finalisePayout(ctx, userId);
}

// ── Proof photo received ────────────────────────────────────────────────────

export async function handleAdminPayoutProofPhoto(ctx: MyContext): Promise<void> {
  const userId = ctx.session.pendingPayoutUserId;
  if (!userId) return;

  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  const photo = photos[photos.length - 1];
  ctx.session.pendingPayoutUserId = undefined;

  await finalisePayout(ctx, userId, photo.file_id);
}

// ── Shared payout finalisation ──────────────────────────────────────────────

async function finalisePayout(
  ctx: MyContext,
  userId: number,
  proofTelegramFileId?: string,
): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await processUserPayout(userId, adminUser?.id ?? 0, proofTelegramFileId);

  if (!result) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_FAILED, show_alert: true });
    } else {
      await ctx.reply(ADMIN_PAYOUT_FAILED);
    }
    return;
  }

  const successText = ADMIN_PAYOUT_RECORDED_TEXT(
    result.payoutId, escapeHtml(result.userName), parseFloat(result.amount).toFixed(2),
  );
  const successKb = new InlineKeyboard()
    .text(KB.BACK_QUEUE, 'admin:payouts')
    .row()
    .text(KB.BACK_ADMIN_MENU, 'admin:menu');

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: ADMIN_PAYOUT_RECORDED_LABEL });
    await ctx.editMessageText(successText, { parse_mode: 'HTML', reply_markup: successKb });
  } else {
    await ctx.reply(successText, { parse_mode: 'HTML', reply_markup: successKb });
  }

  try {
    const notifyText = proofTelegramFileId
      ? ADMIN_PAYOUT_NOTIFY_WITH_PROOF(parseFloat(result.amount).toFixed(2))
      : ADMIN_PAYOUT_NOTIFY(parseFloat(result.amount).toFixed(2));

    if (proofTelegramFileId) {
      await ctx.api.sendPhoto(result.userTelegramId, proofTelegramFileId, {
        caption: notifyText,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.api.sendMessage(result.userTelegramId, notifyText, { parse_mode: 'HTML' });
    }
  } catch {
    // User may have blocked the bot
  }
}

// ── Show full card (auto-deletes after 60s) ─────────────────────────────────

export async function handleAdminPayoutShowCard(ctx: MyContext, userId: number): Promise<void> {
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

  await ctx.answerCallbackQuery();

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

import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { buildBoundedList, escapeHtml, truncate } from '../../../utils/html';
import { getUserByTelegramId } from '../../../services/userService';
import {
  getPaymentInfo,
  getUnpaidCompletedTasks,
  getUserPayoutHistory,
  PAYOUT_THRESHOLD,
} from '../../../services/payoutService';
import {
  KB,
  USER_BALANCE_HEADER,
  USER_BALANCE_IN_QUEUE,
  USER_BALANCE_NEED_MORE,
  USER_BALANCE_COMPLETED_SINCE_PAYOUT,
  USER_BALANCE_NO_COMPLETED,
  USER_BALANCE_PAYMENT_METHOD,
  USER_BALANCE_TOTAL_PAID,
} from '../../../i18n/ru';

const TASKS_PAGE_SIZE = 10;

export async function handleUserBalance(ctx: MyContext, page = 0): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const user = await getUserByTelegramId(telegramId);
  if (!user) return;

  const balance = parseFloat(user.balance);
  const [completedTasks, payoutHistory] = await Promise.all([
    getUnpaidCompletedTasks(user.id),
    getUserPayoutHistory(user.id),
  ]);

  const totalPages = Math.max(1, Math.ceil(completedTasks.length / TASKS_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTasks = completedTasks.slice(
    safePage * TASKS_PAGE_SIZE,
    (safePage + 1) * TASKS_PAGE_SIZE,
  );

  const taskLines =
    pageTasks.length > 0
      ? USER_BALANCE_COMPLETED_SINCE_PAYOUT(completedTasks.length) +
        buildBoundedList(
          pageTasks,
          (t) => {
            const date = t.completedAt
              ? new Date(t.completedAt).toLocaleDateString('ru-RU')
              : '';
            return `• ${escapeHtml(truncate(t.taskTitle))} — <b>${t.priceUah} грн</b>${date ? ` (${date})` : ''}`;
          },
          { maxRows: TASKS_PAGE_SIZE },
        )
      : USER_BALANCE_NO_COMPLETED;

  const remaining = PAYOUT_THRESHOLD - balance;
  const payoutStatus =
    balance >= PAYOUT_THRESHOLD
      ? USER_BALANCE_IN_QUEUE
      : USER_BALANCE_NEED_MORE(remaining.toFixed(2), PAYOUT_THRESHOLD);

  const info = getPaymentInfo(user);
  const paymentLines = [
    info.binanceId ? `• Binance ID: <code>${escapeHtml(info.binanceId)}</code>` : null,
    info.maskedCard ? `• Карта: <code>${escapeHtml(info.maskedCard)}</code>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const historyLine =
    payoutHistory.length > 0
      ? USER_BALANCE_TOTAL_PAID(
          payoutHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2),
          payoutHistory.length,
        )
      : '';

  const kb = new InlineKeyboard();
  if (totalPages > 1) {
    if (safePage > 0) kb.text(KB.PAGE_PREV, `user:balance:${safePage - 1}`);
    kb.text(`${safePage + 1} / ${totalPages}`, 'user:balance:noop');
    if (safePage < totalPages - 1) kb.text(KB.PAGE_NEXT, `user:balance:${safePage + 1}`);
    kb.row();
  }
  kb.text(KB.BACK, 'user:menu');

  await ctx.editMessageText(
    USER_BALANCE_HEADER(balance.toFixed(2)) +
      payoutStatus +
      taskLines +
      (paymentLines ? USER_BALANCE_PAYMENT_METHOD + paymentLines : '') +
      historyLine,
    {
      parse_mode: 'HTML',
      reply_markup: kb,
    },
  );
}

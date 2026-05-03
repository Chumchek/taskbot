import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
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

export async function handleUserBalance(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const user = await getUserByTelegramId(telegramId);
  if (!user) return;

  const balance = parseFloat(user.balance);
  const [completedTasks, payoutHistory] = await Promise.all([
    getUnpaidCompletedTasks(user.id),
    getUserPayoutHistory(user.id),
  ]);

  let taskLines = '';
  if (completedTasks.length > 0) {
    taskLines =
      USER_BALANCE_COMPLETED_SINCE_PAYOUT +
      completedTasks
        .map((t) => {
          const date = t.completedAt
            ? new Date(t.completedAt).toLocaleDateString('ru-RU')
            : '';
          return `• ${t.taskTitle} — <b>${t.priceUah} грн</b>${date ? ` (${date})` : ''}`;
        })
        .join('\n');
  } else {
    taskLines = USER_BALANCE_NO_COMPLETED;
  }

  const remaining = PAYOUT_THRESHOLD - balance;
  const payoutStatus =
    balance >= PAYOUT_THRESHOLD
      ? USER_BALANCE_IN_QUEUE
      : USER_BALANCE_NEED_MORE(remaining.toFixed(2), PAYOUT_THRESHOLD);

  const info = getPaymentInfo(user);
  const paymentLines = [
    info.binanceId ? `• Binance ID: <code>${info.binanceId}</code>` : null,
    info.maskedCard ? `• Карта: <code>${info.maskedCard}</code>` : null,
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

  await ctx.editMessageText(
    USER_BALANCE_HEADER(balance.toFixed(2)) +
      payoutStatus +
      taskLines +
      (paymentLines ? USER_BALANCE_PAYMENT_METHOD + paymentLines : '') +
      historyLine,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.BACK, 'user:menu'),
    },
  );
}

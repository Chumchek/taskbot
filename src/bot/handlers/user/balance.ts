import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { getUserByTelegramId } from '../../../services/userService';
import {
  getPaymentInfo,
  getUnpaidCompletedTasks,
  getUserPayoutHistory,
  PAYOUT_THRESHOLD,
} from '../../../services/payoutService';
import { mainMenuKeyboard } from '../../keyboards';

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

  // Build task breakdown
  let taskLines = '';
  if (completedTasks.length > 0) {
    taskLines =
      '\n\n<b>Completed since last payout:</b>\n' +
      completedTasks
        .map((t) => {
          const date = t.completedAt
            ? new Date(t.completedAt).toLocaleDateString('uk-UA')
            : '';
          return `• ${t.taskTitle} — <b>${t.priceUah} UAH</b>${date ? ` (${date})` : ''}`;
        })
        .join('\n');
  } else {
    taskLines = '\n\n<i>No completed tasks in current cycle.</i>';
  }

  // Payout status
  const remaining = PAYOUT_THRESHOLD - balance;
  const payoutStatus =
    balance >= PAYOUT_THRESHOLD
      ? `\n\n✅ <b>You're in the payout queue!</b> An admin will process your payment soon.`
      : `\n\n⏳ You need <b>${remaining.toFixed(2)} UAH</b> more to reach the payout threshold (${PAYOUT_THRESHOLD} UAH).`;

  // Payment method
  const info = getPaymentInfo(user);
  const paymentLines = [
    info.binanceId ? `• Binance ID: <code>${info.binanceId}</code>` : null,
    info.maskedCard ? `• Card: <code>${info.maskedCard}</code>` : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Payout history summary
  const historyLine =
    payoutHistory.length > 0
      ? `\n\n<b>Total paid out:</b> ${payoutHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(2)} UAH (${payoutHistory.length} payout${payoutHistory.length === 1 ? '' : 's'})`
      : '';

  await ctx.editMessageText(
    `💰 <b>My Balance</b>\n\n` +
      `Current balance: <b>${balance.toFixed(2)} UAH</b>` +
      payoutStatus +
      taskLines +
      (paymentLines ? `\n\n<b>Payment method on file:</b>\n${paymentLines}` : '') +
      historyLine,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('◀ Back', 'user:menu'),
    },
  );
}

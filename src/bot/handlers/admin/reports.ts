import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { adminMenuKeyboard } from '../../keyboards';
import {
  approveReport,
  getPendingReports,
  getReportWithContext,
  rejectReport,
} from '../../../services/reportService';
import { getUserByTelegramId } from '../../../services/userService';

// ── Pending reports list ────────────────────────────────────────────────────

export async function handleAdminReportList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const pending = await getPendingReports();

  if (pending.length === 0) {
    await ctx.editMessageText('✅ No pending reports.', { reply_markup: adminMenuKeyboard() });
    return;
  }

  const kb = new InlineKeyboard();
  for (const item of pending) {
    kb.text(
      `📊 #${item.report.id} — ${item.userName}: ${item.taskTitle}`,
      `admin:report:view:${item.report.id}`,
    ).row();
  }
  kb.text('◀ Back', 'admin:menu');

  await ctx.editMessageText(
    `📊 <b>Pending Reports</b> (${pending.length})`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── View report detail + forward media ─────────────────────────────────────

export async function handleAdminReportView(ctx: MyContext, reportId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const item = await getReportWithContext(reportId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: '❌ Report not found', show_alert: true });
    return;
  }

  const fileWord = item.mediaFiles.length === 1 ? 'file' : 'files';
  const submittedAt = item.report.submittedAt.toLocaleString('uk-UA', {
    timeZone: 'Europe/Kiev',
  });

  await ctx.editMessageText(
    `📊 <b>Report #${reportId}</b>\n\n` +
      `Task: <b>${item.taskTitle}</b>\n` +
      `User: ${item.userName}\n` +
      `Reward: <b>${item.priceUah} UAH</b>\n` +
      `Submitted: ${submittedAt}\n` +
      `Files: ${item.mediaFiles.length} ${fileWord}\n\n` +
      `<i>Files will be sent below. Use the buttons to approve or reject.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Approve', `admin:report:approve:${reportId}`)
        .text('❌ Reject', `admin:report:reject_ask:${reportId}`)
        .row()
        .text('◀ Back to Reports', 'admin:reports'),
    },
  );

  // Forward each media file to the admin
  for (const file of item.mediaFiles) {
    if (!file.telegramFileId) continue;
    try {
      if (file.fileType === 'photo') {
        await ctx.replyWithPhoto(file.telegramFileId);
      } else if (file.fileType === 'video') {
        await ctx.replyWithVideo(file.telegramFileId);
      }
    } catch {
      // file_id expired or unavailable — send presigned URL fallback
      const { getPresignedUrl } = await import('../../../services/storageService');
      const url = await getPresignedUrl(file.storageKey, 600);
      await ctx.reply(`🔗 <a href="${url}">View file (expires in 10 min)</a>`, {
        parse_mode: 'HTML',
      });
    }
  }
}

// ── Approve ─────────────────────────────────────────────────────────────────

export async function handleAdminReportApprove(ctx: MyContext, reportId: number): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await approveReport(reportId, adminUser?.id ?? 0);

  if (!result) {
    await ctx.answerCallbackQuery({ text: '❌ Report not found or already reviewed', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ Report approved!' });

  await ctx.editMessageText(
    `✅ <b>Report #${reportId} approved</b>\n\n` +
      `Task: ${result.taskTitle}\n` +
      `User: ${result.userTelegramId}\n` +
      `+${result.priceUah} UAH credited | New balance: ${result.newBalance} UAH`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📊 Back to Reports', 'admin:reports')
        .row()
        .text('◀ Admin Menu', 'admin:menu'),
    },
  );

  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      `🎉 <b>Report approved!</b>\n\n` +
        `Task: <b>${result.taskTitle}</b>\n` +
        `Reward: <b>+${result.priceUah} UAH</b>\n` +
        `Balance: <b>${result.newBalance} UAH</b>`,
      { parse_mode: 'HTML' },
    );
  } catch {
    // User may have blocked the bot
  }
}

// ── Reject — ask for optional comment ──────────────────────────────────────

export async function handleAdminReportRejectAsk(ctx: MyContext, reportId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  ctx.session.adminRejectReportId = reportId;

  await ctx.editMessageText(
    `❌ <b>Reject Report #${reportId}</b>\n\n` +
      `Send a reason for rejection (optional), or press <b>Skip</b> to reject without comment.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('Skip (no comment)', `admin:report:reject:${reportId}`)
        .row()
        .text('◀ Cancel', `admin:report:view:${reportId}`),
    },
  );
}

// ── Reject — execute (no comment or with comment from session) ──────────────

export async function handleAdminReportReject(
  ctx: MyContext,
  reportId: number,
  comment?: string,
): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await rejectReport(reportId, adminUser?.id ?? 0, comment);

  if (!result) {
    await ctx.answerCallbackQuery({ text: '❌ Report not found or already reviewed', show_alert: true });
    return;
  }

  ctx.session.adminRejectReportId = undefined;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: '❌ Report rejected' });
    await ctx.editMessageText(
      `❌ <b>Report #${reportId} rejected</b>\n` +
        (comment ? `Reason: ${comment}` : '<i>No reason given.</i>'),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('📊 Back to Reports', 'admin:reports')
          .row()
          .text('◀ Admin Menu', 'admin:menu'),
      },
    );
  }

  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      `❌ <b>Report rejected</b>\n\n` +
        `Task: <b>${result.taskTitle}</b>\n` +
        (comment ? `Reason: ${comment}` : '<i>No reason provided.</i>') +
        `\n\nPlease review the task requirements and resubmit if needed.`,
      { parse_mode: 'HTML' },
    );
  } catch {
    // User may have blocked the bot
  }
}

// ── Handle reject comment text (called from text router in bot/index.ts) ────

export async function handleAdminRejectCommentText(
  ctx: MyContext,
  reportId: number,
): Promise<void> {
  const comment = ctx.message?.text?.trim();
  if (!comment) return;

  await handleAdminReportReject(ctx, reportId, comment);

  await ctx.reply(
    `❌ <b>Report #${reportId} rejected</b>\nReason: ${comment}`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📊 Back to Reports', 'admin:reports')
        .row()
        .text('◀ Admin Menu', 'admin:menu'),
    },
  );
}

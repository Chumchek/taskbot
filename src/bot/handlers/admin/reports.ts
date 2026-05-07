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
import {
  KB,
  ADMIN_NO_PENDING_REPORTS,
  ADMIN_REPORTS_HEADER,
  ADMIN_REPORT_NOT_FOUND,
  ADMIN_REPORT_ALREADY_REVIEWED,
  ADMIN_REPORT_DETAIL,
  ADMIN_REPORT_APPROVED_LABEL,
  ADMIN_REPORT_APPROVED_TEXT,
  ADMIN_REPORT_APPROVED_NOTIFY,
  ADMIN_REPORT_REJECT_ASK,
  ADMIN_REPORT_REJECTED_LABEL,
  ADMIN_REPORT_REJECTED_TEXT,
  ADMIN_REPORT_REJECTED_NOTIFY,
} from '../../../i18n/ru';

// ── Pending reports list ────────────────────────────────────────────────────

export async function handleAdminReportList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const pending = await getPendingReports();

  if (pending.length === 0) {
    await ctx.editMessageText(ADMIN_NO_PENDING_REPORTS, { reply_markup: adminMenuKeyboard() });
    return;
  }

  const kb = new InlineKeyboard();
  for (const item of pending) {
    kb.text(
      `📊 #${item.report.id} — ${item.userName}: ${item.taskTitle}`,
      `admin:report:view:${item.report.id}`,
    ).row();
  }
  kb.text(KB.BACK, 'admin:menu');

  await ctx.editMessageText(ADMIN_REPORTS_HEADER(pending.length), {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

// ── View report detail + forward media ─────────────────────────────────────

export async function handleAdminReportView(ctx: MyContext, reportId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const item = await getReportWithContext(reportId);

  if (!item) {
    await ctx.answerCallbackQuery({ text: ADMIN_REPORT_NOT_FOUND, show_alert: true });
    return;
  }

  const submittedAt = item.report.submittedAt.toLocaleString('ru-RU', {
    timeZone: 'Europe/Kiev',
  });

  await ctx.editMessageText(
    ADMIN_REPORT_DETAIL(
      reportId,
      item.taskTitle,
      item.userName,
      item.priceUah,
      submittedAt,
      item.mediaFiles.length,
      item.packageName,
    ),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Одобрить', `admin:report:approve:${reportId}`)
        .text('❌ Отклонить', `admin:report:reject_ask:${reportId}`)
        .row()
        .text(KB.BACK_REPORTS_ADMIN, 'admin:reports'),
    },
  );

  for (const file of item.mediaFiles) {
    if (!file.telegramFileId) continue;
    try {
      if (file.fileType === 'photo') {
        await ctx.replyWithPhoto(file.telegramFileId);
      } else if (file.fileType === 'video') {
        await ctx.replyWithVideo(file.telegramFileId);
      }
    } catch {
      const { getPresignedUrl } = await import('../../../services/storageService');
      const url = await getPresignedUrl(file.storageKey, 600);
      await ctx.reply(`🔗 <a href="${url}">Открыть файл (ссылка на 10 мин.)</a>`, {
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
    await ctx.answerCallbackQuery({ text: ADMIN_REPORT_ALREADY_REVIEWED, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: ADMIN_REPORT_APPROVED_LABEL });

  await ctx.editMessageText(
    ADMIN_REPORT_APPROVED_TEXT(
      reportId,
      result.taskTitle,
      result.userTelegramId,
      result.priceUah,
      result.newBalance,
    ),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.BACK_REPORTS_ADMIN, 'admin:reports')
        .row()
        .text(KB.BACK_ADMIN_MENU, 'admin:menu'),
    },
  );

  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      ADMIN_REPORT_APPROVED_NOTIFY(result.taskTitle, result.priceUah, result.newBalance),
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

  await ctx.editMessageText(ADMIN_REPORT_REJECT_ASK(reportId), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.SKIP_NO_COMMENT, `admin:report:reject:${reportId}`)
      .row()
      .text(KB.CANCEL_REJECT, `admin:report:view:${reportId}`),
  });
}

// ── Reject — execute ────────────────────────────────────────────────────────

export async function handleAdminReportReject(
  ctx: MyContext,
  reportId: number,
  comment?: string,
): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const adminUser = await getUserByTelegramId(telegramId);

  const result = await rejectReport(reportId, adminUser?.id ?? 0, comment);

  if (!result) {
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: ADMIN_REPORT_ALREADY_REVIEWED, show_alert: true });
    } else {
      await ctx.reply(ADMIN_REPORT_ALREADY_REVIEWED);
    }
    return;
  }

  ctx.session.adminRejectReportId = undefined;

  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: ADMIN_REPORT_REJECTED_LABEL });
    await ctx.editMessageText(ADMIN_REPORT_REJECTED_TEXT(reportId, comment), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.BACK_REPORTS_ADMIN, 'admin:reports')
        .row()
        .text(KB.BACK_ADMIN_MENU, 'admin:menu'),
    });
  }

  try {
    await ctx.api.sendMessage(
      result.userTelegramId,
      ADMIN_REPORT_REJECTED_NOTIFY(result.taskTitle, comment),
      { parse_mode: 'HTML' },
    );
  } catch {
    // User may have blocked the bot
  }
}

// ── Handle reject comment text ──────────────────────────────────────────────

export async function handleAdminRejectCommentText(
  ctx: MyContext,
  reportId: number,
): Promise<void> {
  const comment = ctx.message?.text?.trim();
  if (!comment) return;

  await handleAdminReportReject(ctx, reportId, comment);

  await ctx.reply(ADMIN_REPORT_REJECTED_TEXT(reportId, comment), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.BACK_REPORTS_ADMIN, 'admin:reports')
      .row()
      .text(KB.BACK_ADMIN_MENU, 'admin:menu'),
  });
}

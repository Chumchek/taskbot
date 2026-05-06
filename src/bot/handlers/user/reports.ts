import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { getUserByTelegramId, getAllAdminIds } from '../../../services/userService';
import { getTaskById, getUserAssignments } from '../../../services/taskService';
import { toCategoryKey, getExampleForUser } from '../../../services/reportExampleService';
import { getPresignedUrl } from '../../../services/storageService';
import { createReport, addReportMedia, getUserReports, getActiveReportForAssignment } from '../../../services/reportService';
import {
  downloadTelegramFile,
  makeStorageKey,
  uploadFile,
} from '../../../services/storageService';
import {
  KB,
  MENU,
  USER_REPORT_EXAMPLE_HEADER,
  USER_REPORT_ASSIGNMENT_NOT_FOUND,
  USER_REPORT_ALREADY_SUBMITTED,
  USER_REPORT_WRONG_STATUS,
  USER_REPORT_START_PROMPT,
  USER_REPORT_FILE_TOO_LARGE,
  USER_REPORT_VIDEO_TOO_LARGE,
  USER_REPORT_MAX_FILES,
  USER_REPORT_RETRIEVE_FAILED,
  USER_REPORT_UPLOAD_FAILED,
  USER_REPORT_PHOTO_RECEIVED,
  USER_REPORT_VIDEO_RECEIVED,
  USER_REPORT_SUBMIT_BTN,
  USER_REPORT_NO_FILES,
  USER_REPORT_CANCEL_LABEL,
  USER_REPORT_CANCELLED,
  USER_REPORT_SUBMITTED,
  USER_REPORT_ADMIN_NOTIFY,
  USER_MY_REPORTS_EMPTY,
  USER_MY_REPORTS_HEADER,
  USER_REPORT_DETAIL,
  USER_REPORT_ADMIN_COMMENT,
  USER_REPORT_APPROVED_HINT,
  REPORT_STATUS_RU,
  REPORT_STATUS_EMOJI,
  TASK_STATUS_RU,
} from '../../../i18n/ru';
import { PAYOUT_THRESHOLD } from '../../../services/payoutService';

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ── Start report submission ──────────────────────────────────────────────────

export async function handleReportStart(ctx: MyContext, assignmentId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const assignments = await getUserAssignments(dbUser.id);
  const assignment = assignments.find((a) => a.id === assignmentId);

  if (!assignment) {
    await ctx.editMessageText(USER_REPORT_ASSIGNMENT_NOT_FOUND, {
      reply_markup: new InlineKeyboard().text(KB.BACK_MY_TASKS, 'user:my_tasks'),
    });
    return;
  }

  if (assignment.status !== 'claimed') {
    await ctx.editMessageText(
      USER_REPORT_WRONG_STATUS(TASK_STATUS_RU[assignment.status] ?? assignment.status),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text(KB.BACK_MY_TASKS, 'user:my_tasks'),
      },
    );
    return;
  }

  const existingReport = await getActiveReportForAssignment(assignmentId);
  if (existingReport) {
    await ctx.editMessageText(USER_REPORT_ALREADY_SUBMITTED, {
      reply_markup: new InlineKeyboard().text(KB.BACK_MY_TASKS, 'user:my_tasks'),
    });
    return;
  }

  ctx.session.reportStep = 'awaiting_media';
  ctx.session.pendingReport = {
    assignmentId,
    taskId: assignment.taskId,
    taskTitle: assignment.task.title,
    files: [],
  };

  const sent = await ctx.editMessageText(
    USER_REPORT_START_PROMPT(assignment.task.title, MAX_FILES, 0),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(USER_REPORT_SUBMIT_BTN(0), 'user:report:submit')
        .row()
        .text(KB.CANCEL, 'user:report:cancel'),
    },
  );

  if (sent !== true) {
    ctx.session.pendingReport.promptMsgId = sent.message_id;
  }

  const exampleData = await getExampleForUser(toCategoryKey(assignment.task.category));
  if (exampleData) {
    const { example, media } = exampleData;
    await ctx.reply(USER_REPORT_EXAMPLE_HEADER(example.comment), { parse_mode: 'HTML' });
    for (const f of media) {
      try {
        if (f.telegramFileId) {
          if (f.fileType === 'photo') await ctx.replyWithPhoto(f.telegramFileId);
          else await ctx.replyWithVideo(f.telegramFileId);
        } else {
          const url = await getPresignedUrl(f.storageKey, 600);
          await ctx.reply(`🔗 <a href="${url}">Открыть файл</a>`, { parse_mode: 'HTML' });
        }
      } catch {
        const url = await getPresignedUrl(f.storageKey, 600);
        await ctx.reply(`🔗 <a href="${url}">Открыть файл</a>`, { parse_mode: 'HTML' });
      }
    }
  }
}

// ── Handle incoming photo ────────────────────────────────────────────────────

export async function handleReportPhoto(ctx: MyContext): Promise<void> {
  if (ctx.session.reportStep !== 'awaiting_media' || !ctx.session.pendingReport) return;

  const { pendingReport } = ctx.session;

  if (pendingReport.files.length >= MAX_FILES) {
    await ctx.reply(USER_REPORT_MAX_FILES(MAX_FILES));
    return;
  }

  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;
  const photo = photos[photos.length - 1];

  if (photo.file_size && photo.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply(USER_REPORT_FILE_TOO_LARGE);
    return;
  }

  await processMediaFile(ctx, photo.file_id, 'photo', 'jpg', photo.file_size);
}

// ── Handle incoming video ────────────────────────────────────────────────────

export async function handleReportVideo(ctx: MyContext): Promise<void> {
  if (ctx.session.reportStep !== 'awaiting_media' || !ctx.session.pendingReport) return;

  const { pendingReport } = ctx.session;

  if (pendingReport.files.length >= MAX_FILES) {
    await ctx.reply(USER_REPORT_MAX_FILES(MAX_FILES));
    return;
  }

  const video = ctx.message?.video;
  if (!video) return;

  if (video.file_size && video.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply(USER_REPORT_VIDEO_TOO_LARGE);
    return;
  }

  await processMediaFile(ctx, video.file_id, 'video', 'mp4', video.file_size);
}

// ── Shared upload logic ──────────────────────────────────────────────────────

async function processMediaFile(
  ctx: MyContext,
  fileId: string,
  fileType: 'photo' | 'video',
  ext: string,
  fileSize?: number,
): Promise<void> {
  const { pendingReport } = ctx.session;
  if (!pendingReport) return;

  const telegramId = ctx.from!.id.toString();

  try {
    const fileObj = await ctx.api.getFile(fileId);
    if (!fileObj.file_path) {
      await ctx.reply(USER_REPORT_RETRIEVE_FAILED);
      return;
    }

    const buffer = await downloadTelegramFile(fileObj.file_path);
    const storageKey = makeStorageKey(telegramId, pendingReport.taskId, ext);
    const contentType = fileType === 'photo' ? 'image/jpeg' : 'video/mp4';
    const { checksum } = await uploadFile(buffer, storageKey, contentType);

    pendingReport.files.push({ telegramFileId: fileId, fileType, fileSize, storageKey, checksum });

    const fileCount = pendingReport.files.length;

    if (pendingReport.promptMsgId) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        pendingReport.promptMsgId,
        USER_REPORT_START_PROMPT(pendingReport.taskTitle, MAX_FILES, fileCount),
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(USER_REPORT_SUBMIT_BTN(fileCount), 'user:report:submit')
            .row()
            .text(KB.CANCEL, 'user:report:cancel'),
        },
      );
    }

    const received =
      fileType === 'photo'
        ? USER_REPORT_PHOTO_RECEIVED(fileCount, MAX_FILES)
        : USER_REPORT_VIDEO_RECEIVED(fileCount, MAX_FILES);
    await ctx.reply(received, {
      reply_markup: new InlineKeyboard()
        .text(USER_REPORT_SUBMIT_BTN(fileCount), 'user:report:submit')
        .row()
        .text(KB.CANCEL, 'user:report:cancel'),
    });
  } catch (err) {
    console.error('Media upload error:', err);
    await ctx.reply(USER_REPORT_UPLOAD_FAILED);
  }
}

// ── Submit report ────────────────────────────────────────────────────────────

export async function handleReportSubmit(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const { pendingReport } = ctx.session;

  if (!pendingReport || pendingReport.files.length === 0) {
    await ctx.answerCallbackQuery({ text: USER_REPORT_NO_FILES, show_alert: true });
    return;
  }

  const report = await createReport(pendingReport.assignmentId);

  for (const file of pendingReport.files) {
    await addReportMedia({
      reportId: report.id,
      storageKey: file.storageKey,
      telegramFileId: file.telegramFileId,
      fileType: file.fileType,
      fileSize: file.fileSize,
      checksum: file.checksum,
    });
  }

  for (const adminId of await getAllAdminIds()) {
    try {
      const userName = ctx.from?.username
        ? `@${ctx.from.username}`
        : ctx.from?.first_name ?? '';
      await ctx.api.sendMessage(
        adminId,
        USER_REPORT_ADMIN_NOTIFY(report.id, pendingReport.taskTitle, userName, pendingReport.files.length),
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('👁 Проверить', `admin:report:view:${report.id}`),
        },
      );
    } catch {
      // Admin may not have started the bot
    }
  }

  ctx.session.reportStep = undefined;
  ctx.session.pendingReport = undefined;

  await ctx.editMessageText(USER_REPORT_SUBMITTED(pendingReport.taskTitle), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(MENU.MY_TASKS, 'user:my_tasks')
      .row()
      .text(KB.BROWSE_TASKS, 'user:tasks'),
  });
}

// ── Cancel report ────────────────────────────────────────────────────────────

export async function handleReportCancel(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: USER_REPORT_CANCEL_LABEL });
  ctx.session.reportStep = undefined;
  ctx.session.pendingReport = undefined;

  await ctx.editMessageText(USER_REPORT_CANCELLED, {
    reply_markup: new InlineKeyboard().text(KB.BACK_MY_TASKS, 'user:my_tasks'),
  });
}

// ── My reports list ──────────────────────────────────────────────────────────

export async function handleUserReports(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const userReports = await getUserReports(dbUser.id);

  if (userReports.length === 0) {
    await ctx.editMessageText(USER_MY_REPORTS_EMPTY, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(MENU.MY_TASKS, 'user:my_tasks')
        .row()
        .text(KB.BACK, 'user:menu'),
    });
    return;
  }

  const kb = new InlineKeyboard();
  for (const r of userReports) {
    const emoji = REPORT_STATUS_EMOJI[r.status] ?? '•';
    kb.text(`${emoji} ${r.taskTitle}`, `user:report:detail:${r.reportId}`).row();
  }
  kb.text(KB.BACK, 'user:menu');

  const lines = userReports
    .map((r) => {
      const emoji = REPORT_STATUS_EMOJI[r.status] ?? '•';
      const statusRu = REPORT_STATUS_RU[r.status] ?? r.status;
      return `${emoji} <b>${r.taskTitle}</b> — ${statusRu}`;
    })
    .join('\n');

  await ctx.editMessageText(
    `${USER_MY_REPORTS_HEADER(userReports.length)}\n\n${lines}`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Report detail (user view) ────────────────────────────────────────────────

export async function handleUserReportDetail(ctx: MyContext, reportId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const userReports = await getUserReports(dbUser.id);
  const report = userReports.find((r) => r.reportId === reportId);

  if (!report) {
    await ctx.answerCallbackQuery({ text: '❌ Отчёт не найден', show_alert: true });
    return;
  }

  const emoji = REPORT_STATUS_EMOJI[report.status] ?? '•';
  const statusRu = REPORT_STATUS_RU[report.status] ?? report.status;
  const submittedDate = report.submittedAt.toLocaleDateString('ru-RU');

  let text = USER_REPORT_DETAIL(emoji, report.taskTitle, statusRu, submittedDate, report.priceUah);

  if (report.status === 'rejected' && report.adminComment) {
    text += USER_REPORT_ADMIN_COMMENT(report.adminComment);
  }

  if (report.status === 'approved') {
    text += USER_REPORT_APPROVED_HINT(PAYOUT_THRESHOLD);
  }

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.BACK_REPORTS, 'user:reports'),
  });
}

import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { getUserByTelegramId } from '../../../services/userService';
import { getTaskById, getUserAssignments } from '../../../services/taskService';
import { createReport, addReportMedia, getUserReports } from '../../../services/reportService';
import {
  downloadTelegramFile,
  makeStorageKey,
  uploadFile,
} from '../../../services/storageService';
import { config } from '../../../config';

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// ── Start report submission ──────────────────────────────────────────────────

export async function handleReportStart(ctx: MyContext, assignmentId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const assignments = await getUserAssignments(dbUser.id);
  const assignment = assignments.find((a) => a.id === assignmentId);

  if (!assignment) {
    await ctx.editMessageText('❌ Assignment not found.', {
      reply_markup: new InlineKeyboard().text('◀ Back', 'user:my_tasks'),
    });
    return;
  }

  if (assignment.status !== 'claimed') {
    await ctx.editMessageText(
      `❌ This task is already in status: <b>${assignment.status}</b>.\n\nYou can only submit a report for claimed tasks.`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('◀ Back', 'user:my_tasks') },
    );
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
    `📎 <b>Submit Report — ${assignment.task.title}</b>\n\n` +
      `Send your proof photos or videos (up to ${MAX_FILES} files, max 20 MB each).\n\n` +
      `Files received: <b>0</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Submit Report (0 files)', 'user:report:submit')
        .row()
        .text('❌ Cancel', 'user:report:cancel'),
    },
  );

  // Track the message ID so we can edit the file counter in-place
  if (sent !== true) {
    ctx.session.pendingReport.promptMsgId = sent.message_id;
  }
}

// ── Handle incoming photo ────────────────────────────────────────────────────

export async function handleReportPhoto(ctx: MyContext): Promise<void> {
  if (ctx.session.reportStep !== 'awaiting_media' || !ctx.session.pendingReport) return;

  const { pendingReport } = ctx.session;

  if (pendingReport.files.length >= MAX_FILES) {
    await ctx.reply(`❌ Maximum ${MAX_FILES} files per report.`);
    return;
  }

  // Pick the highest-resolution version of the photo
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;
  const photo = photos[photos.length - 1];

  if (photo.file_size && photo.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply('❌ File too large (max 20 MB). Please compress it and try again.');
    return;
  }

  await processMediaFile(ctx, photo.file_id, 'photo', 'jpg', photo.file_size);
}

// ── Handle incoming video ────────────────────────────────────────────────────

export async function handleReportVideo(ctx: MyContext): Promise<void> {
  if (ctx.session.reportStep !== 'awaiting_media' || !ctx.session.pendingReport) return;

  const { pendingReport } = ctx.session;

  if (pendingReport.files.length >= MAX_FILES) {
    await ctx.reply(`❌ Maximum ${MAX_FILES} files per report.`);
    return;
  }

  const video = ctx.message?.video;
  if (!video) return;

  if (video.file_size && video.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply('❌ File too large (max 20 MB). Please compress the video and try again.');
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
      await ctx.reply('❌ Could not retrieve file from Telegram. Please try again.');
      return;
    }

    const buffer = await downloadTelegramFile(fileObj.file_path);
    const storageKey = makeStorageKey(telegramId, pendingReport.taskId, ext);
    const contentType = fileType === 'photo' ? 'image/jpeg' : 'video/mp4';
    const { checksum } = await uploadFile(buffer, storageKey, contentType);

    pendingReport.files.push({
      telegramFileId: fileId,
      fileType,
      fileSize,
      storageKey,
      checksum,
    });

    // Update the counter on the original prompt message
    const fileCount = pendingReport.files.length;
    const fileWord = fileCount === 1 ? 'file' : 'files';

    if (pendingReport.promptMsgId) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        pendingReport.promptMsgId,
        `📎 <b>Submit Report — ${pendingReport.taskTitle}</b>\n\n` +
          `Send your proof photos or videos (up to ${MAX_FILES} files, max 20 MB each).\n\n` +
          `Files received: <b>${fileCount}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(`✅ Submit Report (${fileCount} ${fileWord})`, 'user:report:submit')
            .row()
            .text('❌ Cancel', 'user:report:cancel'),
        },
      );
    }

    await ctx.reply(`✅ ${fileType === 'photo' ? 'Photo' : 'Video'} received (${fileCount}/${MAX_FILES}).`);
  } catch (err) {
    console.error('Media upload error:', err);
    await ctx.reply('❌ Upload failed. Please try again.');
  }
}

// ── Submit report ────────────────────────────────────────────────────────────

export async function handleReportSubmit(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const { pendingReport } = ctx.session;

  if (!pendingReport || pendingReport.files.length === 0) {
    await ctx.answerCallbackQuery({
      text: '❌ Please send at least one photo or video first.',
      show_alert: true,
    });
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

  // Notify admins
  for (const adminId of config.admins) {
    try {
      const fileWord = pendingReport.files.length === 1 ? 'file' : 'files';
      await ctx.api.sendMessage(
        adminId,
        `📊 <b>New Report #${report.id}</b>\n\n` +
          `Task: <b>${pendingReport.taskTitle}</b>\n` +
          `User: ${ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name}\n` +
          `Files: ${pendingReport.files.length} ${fileWord}`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('👁 Review', `admin:report:view:${report.id}`),
        },
      );
    } catch {
      // Admin may not have started the bot
    }
  }

  // Clear report session state
  ctx.session.reportStep = undefined;
  ctx.session.pendingReport = undefined;

  await ctx.editMessageText(
    `✅ <b>Report submitted!</b>\n\n` +
      `Your report for <b>${pendingReport.taskTitle}</b> is now under review.\n` +
      `You'll be notified once an admin approves or rejects it.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🎯 My Tasks', 'user:my_tasks')
        .row()
        .text('📋 Browse Tasks', 'user:tasks'),
    },
  );
}

// ── Cancel report ────────────────────────────────────────────────────────────

export async function handleReportCancel(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Cancelled' });
  ctx.session.reportStep = undefined;
  ctx.session.pendingReport = undefined;

  await ctx.editMessageText('❌ Report submission cancelled.', {
    reply_markup: new InlineKeyboard().text('◀ My Tasks', 'user:my_tasks'),
  });
}

// ── My reports list ──────────────────────────────────────────────────────────

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳',
  approved: '✅',
  rejected: '❌',
};

export async function handleUserReports(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const userReports = await getUserReports(dbUser.id);

  if (userReports.length === 0) {
    await ctx.editMessageText(
      `📊 <b>My Reports</b>\n\nYou haven't submitted any reports yet.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('🎯 My Tasks', 'user:my_tasks')
          .row()
          .text('◀ Back', 'user:menu'),
      },
    );
    return;
  }

  const kb = new InlineKeyboard();
  for (const r of userReports) {
    const emoji = STATUS_EMOJI[r.status] ?? '•';
    kb.text(`${emoji} ${r.taskTitle}`, `user:report:detail:${r.reportId}`).row();
  }
  kb.text('◀ Back', 'user:menu');

  const lines = userReports
    .map((r) => `${STATUS_EMOJI[r.status] ?? '•'} <b>${r.taskTitle}</b> — ${r.status}`)
    .join('\n');

  await ctx.editMessageText(
    `📊 <b>My Reports</b> (${userReports.length})\n\n${lines}`,
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
    await ctx.answerCallbackQuery({ text: '❌ Report not found', show_alert: true });
    return;
  }

  const emoji = STATUS_EMOJI[report.status] ?? '•';
  const submittedDate = report.submittedAt.toLocaleDateString('uk-UA');

  let text =
    `${emoji} <b>Report — ${report.taskTitle}</b>\n\n` +
    `Status: <b>${report.status}</b>\n` +
    `Submitted: ${submittedDate}\n` +
    `Reward: <b>${report.priceUah} UAH</b>`;

  if (report.status === 'rejected' && report.adminComment) {
    text += `\n\n💬 <b>Admin comment:</b>\n${report.adminComment}`;
  }

  if (report.status === 'approved') {
    text += `\n\n✅ <i>Payment will be processed once your balance reaches 200 UAH.</i>`;
  }

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text('◀ Back to Reports', 'user:reports'),
  });
}

import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import {
  getTaskMedia,
  addTaskMedia,
  deleteAllTaskMedia,
} from '../../../services/taskMediaService';
import { getTaskById } from '../../../services/taskService';
import {
  downloadTelegramFile,
  makeTaskMediaKey,
  uploadFile,
  getPresignedUrl,
} from '../../../services/storageService';

const MAX_TASK_MEDIA = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ── Media management screen ─────────────────────────────────────────────────

export async function handleAdminTaskMedia(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const [task, files] = await Promise.all([getTaskById(taskId), getTaskMedia(taskId)]);
  if (!task) {
    await ctx.answerCallbackQuery({ text: '❌ Task not found', show_alert: true });
    return;
  }

  const kb = new InlineKeyboard();
  if (files.length < MAX_TASK_MEDIA) {
    kb.text('➕ Add Media', `admin:task:media:upload:${taskId}`).row();
  }
  if (files.length > 0) {
    kb.text('👁 Preview', `admin:task:media:preview:${taskId}`)
      .text('🗑 Remove All', `admin:task:media:clear_confirm:${taskId}`)
      .row();
  }
  kb.text('◀ Back to Task', `admin:task:view:${taskId}`);

  await ctx.editMessageText(
    `📎 <b>Help Media — ${task.title}</b>\n\n` +
      (files.length === 0
        ? `No help media yet. Add photos or videos to help users complete this task.`
        : `${files.length} file${files.length === 1 ? '' : 's'} attached.`),
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Start upload session ────────────────────────────────────────────────────

export async function handleAdminTaskMediaStartUpload(
  ctx: MyContext,
  taskId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const task = await getTaskById(taskId);
  if (!task) return;

  ctx.session.taskMediaStep = 'awaiting_media';
  ctx.session.pendingTaskMedia = { taskId, taskTitle: task.title, count: 0 };

  const sent = await ctx.editMessageText(
    `📎 <b>Add Help Media — ${task.title}</b>\n\n` +
      `Send photos or videos (up to ${MAX_TASK_MEDIA} files, max 20 MB each).\n\n` +
      `Files received: <b>0</b>`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Done', 'admin:task:media:done')
        .row()
        .text('❌ Cancel', `admin:task:media:${taskId}`),
    },
  );

  if (sent !== true) {
    ctx.session.pendingTaskMedia.promptMsgId = sent.message_id;
  }
}

// ── Handle photo upload ─────────────────────────────────────────────────────

export async function handleTaskMediaPhoto(ctx: MyContext): Promise<void> {
  await processTaskMediaFile(ctx, 'photo');
}

export async function handleTaskMediaVideo(ctx: MyContext): Promise<void> {
  await processTaskMediaFile(ctx, 'video');
}

async function processTaskMediaFile(ctx: MyContext, fileType: 'photo' | 'video'): Promise<void> {
  const { pendingTaskMedia } = ctx.session;
  if (!pendingTaskMedia) return;

  if (pendingTaskMedia.count >= MAX_TASK_MEDIA) {
    await ctx.reply(`❌ Maximum ${MAX_TASK_MEDIA} files per task.`);
    return;
  }

  const file =
    fileType === 'photo'
      ? ctx.message?.photo?.[ctx.message.photo.length - 1]
      : ctx.message?.video;

  if (!file) return;

  if (file.file_size && file.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply('❌ File too large (max 20 MB).');
    return;
  }

  try {
    const fileObj = await ctx.api.getFile(file.file_id);
    if (!fileObj.file_path) return;

    const ext = fileType === 'photo' ? 'jpg' : 'mp4';
    const buffer = await downloadTelegramFile(fileObj.file_path);
    const storageKey = makeTaskMediaKey(pendingTaskMedia.taskId, ext);
    const contentType = fileType === 'photo' ? 'image/jpeg' : 'video/mp4';
    await uploadFile(buffer, storageKey, contentType);

    await addTaskMedia({
      taskId: pendingTaskMedia.taskId,
      storageKey,
      telegramFileId: file.file_id,
      fileType,
      fileSize: file.file_size,
    });

    pendingTaskMedia.count += 1;
    const count = pendingTaskMedia.count;

    if (pendingTaskMedia.promptMsgId) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        pendingTaskMedia.promptMsgId,
        `📎 <b>Add Help Media — ${pendingTaskMedia.taskTitle}</b>\n\n` +
          `Send photos or videos (up to ${MAX_TASK_MEDIA} files, max 20 MB each).\n\n` +
          `Files received: <b>${count}</b>`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(`✅ Done (${count} file${count === 1 ? '' : 's'})`, 'admin:task:media:done')
            .row()
            .text('❌ Cancel', `admin:task:media:${pendingTaskMedia.taskId}`),
        },
      );
    }

    await ctx.reply(`✅ ${fileType === 'photo' ? 'Photo' : 'Video'} added (${count}/${MAX_TASK_MEDIA}).`);
  } catch {
    await ctx.reply('❌ Upload failed. Please try again.');
  }
}

// ── Done uploading ──────────────────────────────────────────────────────────

export async function handleAdminTaskMediaDone(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: '✅ Media saved' });
  const taskId = ctx.session.pendingTaskMedia?.taskId;
  ctx.session.taskMediaStep = undefined;
  ctx.session.pendingTaskMedia = undefined;

  if (taskId) {
    await handleAdminTaskMedia(ctx, taskId);
  }
}

// ── Preview existing media ──────────────────────────────────────────────────

export async function handleAdminTaskMediaPreview(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const files = await getTaskMedia(taskId);

  if (files.length === 0) {
    await ctx.answerCallbackQuery({ text: 'No files to preview', show_alert: true });
    return;
  }

  for (const f of files) {
    try {
      if (f.telegramFileId) {
        if (f.fileType === 'photo') await ctx.replyWithPhoto(f.telegramFileId);
        else await ctx.replyWithVideo(f.telegramFileId);
      } else {
        const url = await getPresignedUrl(f.storageKey, 600);
        await ctx.reply(`🔗 <a href="${url}">View file</a>`, { parse_mode: 'HTML' });
      }
    } catch {
      const url = await getPresignedUrl(f.storageKey, 600);
      await ctx.reply(`🔗 <a href="${url}">View file</a>`, { parse_mode: 'HTML' });
    }
  }
}

// ── Clear confirmation ──────────────────────────────────────────────────────

export async function handleAdminTaskMediaClearConfirm(
  ctx: MyContext,
  taskId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `🗑 <b>Remove all help media?</b>\n\nThis cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Yes, Remove All', `admin:task:media:clear:${taskId}`)
        .text('❌ Cancel', `admin:task:media:${taskId}`),
    },
  );
}

export async function handleAdminTaskMediaClear(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery({ text: '🗑 Media removed' });
  await deleteAllTaskMedia(taskId);
  await handleAdminTaskMedia(ctx, taskId);
}

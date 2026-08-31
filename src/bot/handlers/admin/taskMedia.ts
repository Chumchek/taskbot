import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { escapeHtml, truncate } from '../../../utils/html';
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
import {
  KB,
  ADMIN_TASK_NOT_FOUND,
  ADMIN_TASK_MEDIA_HEADER,
  ADMIN_TASK_MEDIA_UPLOAD_PROMPT,
  ADMIN_TASK_MEDIA_ADDED,
  ADMIN_TASK_MEDIA_MAX_FILES,
  ADMIN_TASK_MEDIA_TOO_LARGE,
  ADMIN_TASK_MEDIA_UPLOAD_FAILED,
  ADMIN_TASK_MEDIA_SAVED,
  ADMIN_TASK_MEDIA_NO_FILES_PREVIEW,
  ADMIN_TASK_MEDIA_CLEAR_CONFIRM,
  ADMIN_TASK_MEDIA_CLEARED,
  ADMIN_TASK_MEDIA_DONE_BTN,
} from '../../../i18n/ru';

const MAX_TASK_MEDIA = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ── Media management screen ─────────────────────────────────────────────────

export async function handleAdminTaskMedia(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const [task, files] = await Promise.all([getTaskById(taskId), getTaskMedia(taskId)]);
  if (!task) {
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_NOT_FOUND, show_alert: true });
    return;
  }

  const kb = new InlineKeyboard();
  if (files.length < MAX_TASK_MEDIA) {
    kb.text(KB.ADD_MEDIA, `admin:task:media:upload:${taskId}`).row();
  }
  if (files.length > 0) {
    kb.text(KB.PREVIEW, `admin:task:media:preview:${taskId}`)
      .text(KB.REMOVE_ALL, `admin:task:media:clear_confirm:${taskId}`)
      .row();
  }
  kb.text('◀ К заданию', `admin:task:view:${taskId}`);

  await ctx.editMessageText(ADMIN_TASK_MEDIA_HEADER(escapeHtml(truncate(task.title)), files.length), {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
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
    ADMIN_TASK_MEDIA_UPLOAD_PROMPT(escapeHtml(truncate(task.title)), MAX_TASK_MEDIA, 0),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TASK_MEDIA_DONE_BTN(0), 'admin:task:media:done')
        .row()
        .text(KB.CANCEL, `admin:task:media:${taskId}`),
    },
  );

  if (sent !== true) {
    ctx.session.pendingTaskMedia.promptMsgId = sent.message_id;
  }
}

// ── Handle photo/video upload ───────────────────────────────────────────────

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
    await ctx.reply(ADMIN_TASK_MEDIA_MAX_FILES(MAX_TASK_MEDIA));
    return;
  }

  const file =
    fileType === 'photo'
      ? ctx.message?.photo?.[ctx.message.photo.length - 1]
      : ctx.message?.video;

  if (!file) return;

  if (file.file_size && file.file_size > MAX_FILE_SIZE_BYTES) {
    await ctx.reply(ADMIN_TASK_MEDIA_TOO_LARGE);
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
        ADMIN_TASK_MEDIA_UPLOAD_PROMPT(escapeHtml(truncate(pendingTaskMedia.taskTitle)), MAX_TASK_MEDIA, count),
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TASK_MEDIA_DONE_BTN(count), 'admin:task:media:done')
            .row()
            .text(KB.CANCEL, `admin:task:media:${pendingTaskMedia.taskId}`),
        },
      );
    }

    await ctx.reply(ADMIN_TASK_MEDIA_ADDED(fileType, count, MAX_TASK_MEDIA));
  } catch {
    await ctx.reply(ADMIN_TASK_MEDIA_UPLOAD_FAILED);
  }
}

// ── Done uploading ──────────────────────────────────────────────────────────

export async function handleAdminTaskMediaDone(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_TASK_MEDIA_SAVED });
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
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_MEDIA_NO_FILES_PREVIEW, show_alert: true });
    return;
  }

  for (const f of files) {
    try {
      if (f.telegramFileId) {
        if (f.fileType === 'photo') await ctx.replyWithPhoto(f.telegramFileId);
        else await ctx.replyWithVideo(f.telegramFileId);
      } else {
        const url = await getPresignedUrl(f.storageKey, 600);
        await ctx.reply(`🔗 <a href="${escapeHtml(url)}">Открыть файл</a>`, { parse_mode: 'HTML' });
      }
    } catch {
      const url = await getPresignedUrl(f.storageKey, 600);
      await ctx.reply(`🔗 <a href="${escapeHtml(url)}">Открыть файл</a>`, { parse_mode: 'HTML' });
    }
  }
}

// ── Clear confirmation ──────────────────────────────────────────────────────

export async function handleAdminTaskMediaClearConfirm(
  ctx: MyContext,
  taskId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ADMIN_TASK_MEDIA_CLEAR_CONFIRM, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.YES_REMOVE_ALL, `admin:task:media:clear:${taskId}`)
      .text(KB.CANCEL, `admin:task:media:${taskId}`),
  });
}

export async function handleAdminTaskMediaClear(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_TASK_MEDIA_CLEARED });
  await deleteAllTaskMedia(taskId);
  await handleAdminTaskMedia(ctx, taskId);
}

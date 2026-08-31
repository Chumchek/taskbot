import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { escapeHtml, escapeOptional, MAX_DESCRIPTION } from '../../../utils/html';
import {
  getAllExamples,
  getExampleById,
  getExampleByCategoryKey,
  getExampleMedia,
  createExample,
  updateExampleComment,
  addExampleMedia,
  deleteAllExampleMedia,
  deleteExample,
} from '../../../services/reportExampleService';
import {
  downloadTelegramFile,
  makeReportExampleKey,
  uploadFile,
  getPresignedUrl,
} from '../../../services/storageService';
import {
  KB,
  CATEGORY_KEY_LABELS,
  ADMIN_REX_LIST_HEADER,
  ADMIN_REX_NO_EXAMPLE,
  ADMIN_REX_DETAIL,
  ADMIN_REX_CREATED,
  ADMIN_REX_COMMENT_PROMPT,
  ADMIN_REX_COMMENT_SAVED,
  ADMIN_REX_DELETE_CONFIRM,
  ADMIN_REX_DELETED,
  ADMIN_REX_MEDIA_HEADER,
  ADMIN_REX_MEDIA_UPLOAD_PROMPT,
  ADMIN_REX_MEDIA_SAVED,
  ADMIN_REX_MEDIA_CLEARED,
  ADMIN_REX_MEDIA_CLEAR_CONFIRM,
  ADMIN_TASK_MEDIA_ADDED,
  ADMIN_TASK_MEDIA_TOO_LARGE,
  ADMIN_TASK_MEDIA_MAX_FILES,
  ADMIN_TASK_MEDIA_UPLOAD_FAILED,
  ADMIN_TASK_MEDIA_NO_FILES_PREVIEW,
  ADMIN_TASK_MEDIA_DONE_BTN,
} from '../../../i18n/ru';
import {
  adminReportExampleListKeyboard,
  adminReportExampleDetailKeyboard,
  adminReportExampleNoExampleKeyboard,
  adminReportExampleMediaKeyboard,
} from '../../keyboards';

const MAX_EXAMPLE_MEDIA = 5;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

// ── List ──────────────────────────────────────────────────────────────────────

export async function handleAdminReportExampleList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const examples = await getAllExamples();
  const existingKeys = new Set(examples.map((e) => e.categoryKey));

  await ctx.editMessageText(ADMIN_REX_LIST_HEADER, {
    parse_mode: 'HTML',
    reply_markup: adminReportExampleListKeyboard(existingKeys),
  });
}

// ── View ──────────────────────────────────────────────────────────────────────

export async function handleAdminReportExampleView(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.reportExampleCommentId = undefined;

  const label = CATEGORY_KEY_LABELS[categoryKey] ?? categoryKey;
  const example = await getExampleByCategoryKey(categoryKey);

  if (!example) {
    await ctx.editMessageText(ADMIN_REX_NO_EXAMPLE(label), {
      parse_mode: 'HTML',
      reply_markup: adminReportExampleNoExampleKeyboard(categoryKey),
    });
    return;
  }

  const media = await getExampleMedia(example.id);
  await ctx.editMessageText(ADMIN_REX_DETAIL(label, escapeOptional(example.comment, MAX_DESCRIPTION), media.length), {
    parse_mode: 'HTML',
    reply_markup: adminReportExampleDetailKeyboard(categoryKey, media.length),
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function handleAdminReportExampleCreate(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_REX_CREATED });
  await createExample(categoryKey);
  await handleAdminReportExampleView(ctx, categoryKey);
}

// ── Comment ───────────────────────────────────────────────────────────────────

export async function handleAdminReportExampleCommentAsk(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return;

  ctx.session.reportExampleCommentId = example.id;

  await ctx.editMessageText(ADMIN_REX_COMMENT_PROMPT(escapeOptional(example.comment, MAX_DESCRIPTION)), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.CANCEL, `admin:rex:cat:${categoryKey}`),
  });
}

export async function handleAdminReportExampleCommentText(ctx: MyContext): Promise<void> {
  const comment = ctx.message?.text?.trim();
  if (!comment) return;

  const exampleId = ctx.session.reportExampleCommentId!;
  ctx.session.reportExampleCommentId = undefined;

  await updateExampleComment(exampleId, comment);

  const example = await getExampleById(exampleId);
  if (!example) return;

  const label = CATEGORY_KEY_LABELS[example.categoryKey] ?? example.categoryKey;
  const media = await getExampleMedia(example.id);

  await ctx.reply(ADMIN_REX_COMMENT_SAVED);
  await ctx.reply(ADMIN_REX_DETAIL(label, escapeOptional(example.comment, MAX_DESCRIPTION), media.length), {
    parse_mode: 'HTML',
    reply_markup: adminReportExampleDetailKeyboard(example.categoryKey, media.length),
  });
}

// ── Media management ──────────────────────────────────────────────────────────

export async function handleAdminReportExampleMedia(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const label = CATEGORY_KEY_LABELS[categoryKey] ?? categoryKey;
  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return;

  const files = await getExampleMedia(example.id);

  await ctx.editMessageText(ADMIN_REX_MEDIA_HEADER(label, files.length), {
    parse_mode: 'HTML',
    reply_markup: adminReportExampleMediaKeyboard(categoryKey, files.length, MAX_EXAMPLE_MEDIA),
  });
}

export async function handleAdminReportExampleMediaStartUpload(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const label = CATEGORY_KEY_LABELS[categoryKey] ?? categoryKey;
  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return;

  const existingFiles = await getExampleMedia(example.id);

  ctx.session.reportExampleMediaStep = 'awaiting_media';
  ctx.session.pendingReportExampleMedia = {
    exampleId: example.id,
    categoryKey,
    count: existingFiles.length,
  };

  const sent = await ctx.editMessageText(
    ADMIN_REX_MEDIA_UPLOAD_PROMPT(label, MAX_EXAMPLE_MEDIA, existingFiles.length),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(ADMIN_TASK_MEDIA_DONE_BTN(existingFiles.length), 'admin:rex:media:done')
        .row()
        .text(KB.CANCEL, `admin:rex:media:${categoryKey}`),
    },
  );

  if (sent !== true) {
    ctx.session.pendingReportExampleMedia.promptMsgId = sent.message_id;
  }
}

export async function handleReportExampleMediaPhoto(ctx: MyContext): Promise<void> {
  await processExampleMediaFile(ctx, 'photo');
}

export async function handleReportExampleMediaVideo(ctx: MyContext): Promise<void> {
  await processExampleMediaFile(ctx, 'video');
}

async function processExampleMediaFile(
  ctx: MyContext,
  fileType: 'photo' | 'video',
): Promise<void> {
  const { pendingReportExampleMedia } = ctx.session;
  if (!pendingReportExampleMedia) return;

  if (pendingReportExampleMedia.count >= MAX_EXAMPLE_MEDIA) {
    await ctx.reply(ADMIN_TASK_MEDIA_MAX_FILES(MAX_EXAMPLE_MEDIA));
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
    const storageKey = makeReportExampleKey(pendingReportExampleMedia.categoryKey, ext);
    const contentType = fileType === 'photo' ? 'image/jpeg' : 'video/mp4';
    await uploadFile(buffer, storageKey, contentType);

    await addExampleMedia({
      exampleId: pendingReportExampleMedia.exampleId,
      storageKey,
      telegramFileId: file.file_id,
      fileType,
      fileSize: file.file_size,
    });

    pendingReportExampleMedia.count += 1;
    const count = pendingReportExampleMedia.count;
    const label =
      CATEGORY_KEY_LABELS[pendingReportExampleMedia.categoryKey] ??
      pendingReportExampleMedia.categoryKey;

    if (pendingReportExampleMedia.promptMsgId) {
      await ctx.api.editMessageText(
        ctx.chat!.id,
        pendingReportExampleMedia.promptMsgId,
        ADMIN_REX_MEDIA_UPLOAD_PROMPT(label, MAX_EXAMPLE_MEDIA, count),
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text(ADMIN_TASK_MEDIA_DONE_BTN(count), 'admin:rex:media:done')
            .row()
            .text(KB.CANCEL, `admin:rex:media:${pendingReportExampleMedia.categoryKey}`),
        },
      );
    }

    await ctx.reply(ADMIN_TASK_MEDIA_ADDED(fileType, count, MAX_EXAMPLE_MEDIA));
  } catch {
    await ctx.reply(ADMIN_TASK_MEDIA_UPLOAD_FAILED);
  }
}

export async function handleAdminReportExampleMediaDone(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_REX_MEDIA_SAVED });
  const categoryKey = ctx.session.pendingReportExampleMedia?.categoryKey;
  ctx.session.reportExampleMediaStep = undefined;
  ctx.session.pendingReportExampleMedia = undefined;

  if (categoryKey) {
    await handleAdminReportExampleMedia(ctx, categoryKey);
  }
}

export async function handleAdminReportExampleMediaPreview(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return;

  const files = await getExampleMedia(example.id);

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

export async function handleAdminReportExampleMediaClearConfirm(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(ADMIN_REX_MEDIA_CLEAR_CONFIRM, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.YES_REMOVE_ALL, `admin:rex:media:clear:${categoryKey}`)
      .text(KB.CANCEL, `admin:rex:media:${categoryKey}`),
  });
}

export async function handleAdminReportExampleMediaClear(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_REX_MEDIA_CLEARED });

  const example = await getExampleByCategoryKey(categoryKey);
  if (!example) return;

  await deleteAllExampleMedia(example.id);
  await handleAdminReportExampleMedia(ctx, categoryKey);
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function handleAdminReportExampleDeleteConfirm(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery();
  const label = CATEGORY_KEY_LABELS[categoryKey] ?? categoryKey;
  await ctx.editMessageText(ADMIN_REX_DELETE_CONFIRM(label), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.YES_DELETE, `admin:rex:delete:${categoryKey}`)
      .text(KB.CANCEL, `admin:rex:cat:${categoryKey}`),
  });
}

export async function handleAdminReportExampleDelete(
  ctx: MyContext,
  categoryKey: string,
): Promise<void> {
  await ctx.answerCallbackQuery({ text: ADMIN_REX_DELETED });

  const example = await getExampleByCategoryKey(categoryKey);
  if (example) {
    await deleteExample(example.id);
  }

  await handleAdminReportExampleView(ctx, categoryKey);
}

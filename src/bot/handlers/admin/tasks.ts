import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { adminMenuKeyboard, adminTaskListKeyboard, adminTaskDetailKeyboard } from '../../keyboards';
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  toggleTaskActive,
} from '../../../services/taskService';
import { getUserByTelegramId } from '../../../services/userService';
import { getTaskMedia } from '../../../services/taskMediaService';
import { isValidUrl, isValidPrice, isValidSlots, isValidDeadlineHours } from '../../../utils/validators';
import {
  deadlineLabel,
  KB,
  ADMIN_NO_TASKS,
  ADMIN_TASKS_HEADER,
  ADMIN_TASK_NOT_FOUND,
  ADMIN_TASK_DETAIL,
  ADMIN_TASK_ACTIVE_STATUS,
  ADMIN_TASK_INACTIVE_STATUS,
  ADMIN_TASK_ACTIVATED,
  ADMIN_TASK_DEACTIVATED,
  ADMIN_TASK_DELETE_CONFIRM,
  ADMIN_TASK_DELETED,
  ADMIN_TASK_HAS_ACTIVE_ASSIGNMENTS,
  ADMIN_TASK_CREATE_STEP1,
  ADMIN_TASK_CREATE_STEP3,
  ADMIN_TASK_TITLE_SAVED,
  ADMIN_TASK_DESC_SAVED,
  ADMIN_TASK_LINK_SAVED,
  ADMIN_TASK_PRICE_SAVED,
  ADMIN_TASK_SLOTS_SAVED,
  ADMIN_TASK_DEADLINE_SAVED,
  ADMIN_TASK_EXPIRY_STEP,
  ADMIN_TASK_TITLE_TOO_LONG,
  ADMIN_TASK_DESC_TOO_LONG,
  ADMIN_TASK_INVALID_URL,
  ADMIN_TASK_INVALID_PRICE,
  ADMIN_TASK_INVALID_SLOTS,
  ADMIN_TASK_INVALID_DEADLINE,
  ADMIN_TASK_INVALID_EXPIRY,
  ADMIN_TASK_INCOMPLETE,
  ADMIN_TASK_SUMMARY,
  ADMIN_TASK_CREATED,
  ADMIN_PANEL_HEADER,
  ADMIN_TASK_CREATION_CANCELLED,
} from '../../../i18n/ru';

function taskExpiresAtLabel(task: { createdAt: Date; taskExpiryHours: number | null }): string | null {
  if (!task.taskExpiryHours) return null;
  const expiresAt = new Date(task.createdAt.getTime() + task.taskExpiryHours * 3_600_000);
  return expiresAt.toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' });
}

// ── Admin task list ─────────────────────────────────────────────────────────

export async function handleAdminTaskList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const allTasks = await getAllTasks();

  if (allTasks.length === 0) {
    await ctx.editMessageText(ADMIN_NO_TASKS, {
      reply_markup: new InlineKeyboard()
        .text(KB.CREATE_TASK, 'admin:task:create')
        .row()
        .text(KB.BACK, 'admin:menu'),
    });
    return;
  }

  await ctx.editMessageText(ADMIN_TASKS_HEADER(allTasks.length), {
    parse_mode: 'HTML',
    reply_markup: adminTaskListKeyboard(allTasks),
  });
}

// ── Task detail (admin view) ────────────────────────────────────────────────

export async function handleAdminTaskView(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const [task, taskMediaFiles] = await Promise.all([
    getTaskById(taskId),
    getTaskMedia(taskId),
  ]);

  if (!task) {
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_NOT_FOUND, show_alert: true });
    return;
  }

  const status = task.isActive ? ADMIN_TASK_ACTIVE_STATUS : ADMIN_TASK_INACTIVE_STATUS;
  const dl = deadlineLabel(task.deadlineHours);
  const expiresAt = taskExpiresAtLabel(task);
  const text = ADMIN_TASK_DETAIL(
    task.title, task.description, task.link, task.priceUah,
    task.slotsAvailable, task.slotsTotal, dl, status, expiresAt,
  );

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: adminTaskDetailKeyboard(task.id, task.isActive, taskMediaFiles.length),
    link_preview_options: { is_disabled: true },
  });
}

// ── Toggle active / inactive ────────────────────────────────────────────────

export async function handleAdminTaskToggle(ctx: MyContext, taskId: number): Promise<void> {
  const task = await toggleTaskActive(taskId);

  if (!task) {
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_NOT_FOUND, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({
    text: task.isActive ? ADMIN_TASK_ACTIVATED : ADMIN_TASK_DEACTIVATED,
  });

  const taskMediaFiles = await getTaskMedia(task.id);
  const status = task.isActive ? ADMIN_TASK_ACTIVE_STATUS : ADMIN_TASK_INACTIVE_STATUS;
  const dl = deadlineLabel(task.deadlineHours);
  const expiresAt = taskExpiresAtLabel(task);
  const text = ADMIN_TASK_DETAIL(
    task.title, task.description, task.link, task.priceUah,
    task.slotsAvailable, task.slotsTotal, dl, status, expiresAt,
  );

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: adminTaskDetailKeyboard(task.id, task.isActive, taskMediaFiles.length),
    link_preview_options: { is_disabled: true },
  });
}

// ── Delete task ─────────────────────────────────────────────────────────────

export async function handleAdminTaskDeleteConfirm(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const task = await getTaskById(taskId);

  if (!task) {
    await ctx.answerCallbackQuery({ text: ADMIN_TASK_NOT_FOUND, show_alert: true });
    return;
  }

  await ctx.editMessageText(ADMIN_TASK_DELETE_CONFIRM(task.title), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.YES_DELETE, `admin:task:delete:${taskId}`)
      .text(KB.CANCEL, `admin:task:view:${taskId}`),
  });
}

export async function handleAdminTaskDelete(ctx: MyContext, taskId: number): Promise<void> {
  const result = await deleteTask(taskId);

  if (!result.success) {
    if (result.reason === 'has_active_assignments') {
      await ctx.answerCallbackQuery({
        text: ADMIN_TASK_HAS_ACTIVE_ASSIGNMENTS(result.count ?? 0),
        show_alert: true,
      });
    } else {
      await ctx.answerCallbackQuery({ text: ADMIN_TASK_NOT_FOUND, show_alert: true });
    }
    return;
  }

  await ctx.answerCallbackQuery({ text: ADMIN_TASK_DELETED });
  const allTasks = await getAllTasks();

  await ctx.editMessageText(
    allTasks.length > 0 ? ADMIN_TASKS_HEADER(allTasks.length) : ADMIN_NO_TASKS,
    {
      parse_mode: 'HTML',
      reply_markup:
        allTasks.length > 0
          ? adminTaskListKeyboard(allTasks)
          : new InlineKeyboard()
              .text(KB.CREATE_TASK, 'admin:task:create')
              .row()
              .text(KB.BACK, 'admin:menu'),
    },
  );
}

// ── Task creation — multi-step session flow ─────────────────────────────────

export async function handleAdminTaskCreate(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.taskStep = 'awaiting_title';
  ctx.session.pendingTask = {};

  await ctx.editMessageText(ADMIN_TASK_CREATE_STEP1, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
  });
}

export async function handleTaskCreationText(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const { taskStep, pendingTask = {} } = ctx.session;

  if (taskStep === 'awaiting_title') {
    if (text.length > 100) {
      await ctx.reply(ADMIN_TASK_TITLE_TOO_LONG);
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, title: text };
    ctx.session.taskStep = 'awaiting_description';

    await ctx.reply(ADMIN_TASK_TITLE_SAVED(text), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('Пропустить ▶', 'admin:task:skip_desc')
        .text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_description') {
    if (text.length > 500) {
      await ctx.reply(ADMIN_TASK_DESC_TOO_LONG);
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, description: text };
    ctx.session.taskStep = 'awaiting_link';

    await ctx.reply(ADMIN_TASK_DESC_SAVED, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_link') {
    if (!isValidUrl(text)) {
      await ctx.reply(ADMIN_TASK_INVALID_URL);
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, link: text };
    ctx.session.taskStep = 'awaiting_price';

    await ctx.reply(ADMIN_TASK_LINK_SAVED, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_price') {
    if (!isValidPrice(text)) {
      await ctx.reply(ADMIN_TASK_INVALID_PRICE);
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, priceUah: text };
    ctx.session.taskStep = 'awaiting_slots';

    await ctx.reply(ADMIN_TASK_PRICE_SAVED(text), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_slots') {
    if (!isValidSlots(text)) {
      await ctx.reply(ADMIN_TASK_INVALID_SLOTS);
      return;
    }

    ctx.session.pendingTask = { ...pendingTask, slotsTotal: parseInt(text, 10) };
    ctx.session.taskStep = 'awaiting_deadline';

    await ctx.reply(ADMIN_TASK_SLOTS_SAVED(text), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_deadline') {
    if (!isValidDeadlineHours(text)) {
      await ctx.reply(ADMIN_TASK_INVALID_DEADLINE);
      return;
    }

    const hours = parseInt(text, 10);
    ctx.session.pendingTask = { ...pendingTask, deadlineHours: hours };
    ctx.session.taskStep = 'awaiting_expiry';

    await ctx.reply(ADMIN_TASK_DEADLINE_SAVED(deadlineLabel(hours)), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.SKIP_EXPIRY, 'admin:task:skip_expiry')
        .row()
        .text(KB.CANCEL, 'admin:task:cancel_create'),
    });
    return;
  }

  if (taskStep === 'awaiting_expiry') {
    const hours = parseInt(text, 10);
    if (!Number.isInteger(hours) || hours < 1 || hours > 8760) {
      await ctx.reply(ADMIN_TASK_INVALID_EXPIRY);
      return;
    }

    const task = { ...pendingTask, taskExpiryHours: hours };
    ctx.session.pendingTask = task;
    ctx.session.taskStep = 'confirming';

    await ctx.reply(
      ADMIN_TASK_SUMMARY(
        task.title!, task.description, task.link!, task.priceUah!, task.slotsTotal!,
        deadlineLabel(task.deadlineHours!), deadlineLabel(hours),
      ),
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('✅ Создать задание', 'admin:task:confirm_create')
          .text(KB.CANCEL, 'admin:task:cancel_create'),
        link_preview_options: { is_disabled: true },
      },
    );
  }
}

export async function handleAdminTaskSkipDesc(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.taskStep = 'awaiting_link';

  await ctx.editMessageText(ADMIN_TASK_CREATE_STEP3, {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard().text(KB.CANCEL, 'admin:task:cancel_create'),
  });
}

export async function handleAdminTaskSkipExpiry(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const { pendingTask = {} } = ctx.session;
  const task = { ...pendingTask, taskExpiryHours: null };
  ctx.session.pendingTask = task;
  ctx.session.taskStep = 'confirming';

  await ctx.editMessageText(
    ADMIN_TASK_SUMMARY(
      task.title!, task.description, task.link!, task.priceUah!, task.slotsTotal!,
      deadlineLabel(task.deadlineHours!), null,
    ),
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Создать задание', 'admin:task:confirm_create')
        .text(KB.CANCEL, 'admin:task:cancel_create'),
      link_preview_options: { is_disabled: true },
    },
  );
}

export async function handleAdminTaskConfirmCreate(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const { pendingTask } = ctx.session;
  if (
    !pendingTask?.title ||
    !pendingTask.link ||
    !pendingTask.priceUah ||
    !pendingTask.slotsTotal ||
    !pendingTask.deadlineHours
  ) {
    await ctx.editMessageText(ADMIN_TASK_INCOMPLETE, {
      reply_markup: adminMenuKeyboard(),
    });
    ctx.session.taskStep = undefined;
    ctx.session.pendingTask = undefined;
    return;
  }

  const adminUser = await getUserByTelegramId(ctx.from!.id.toString());

  const task = await createTask({
    title: pendingTask.title,
    description: pendingTask.description ?? null,
    link: pendingTask.link,
    priceUah: pendingTask.priceUah,
    slotsTotal: pendingTask.slotsTotal,
    deadlineHours: pendingTask.deadlineHours,
    taskExpiryHours: pendingTask.taskExpiryHours ?? null,
    createdBy: adminUser?.id ?? null,
  });

  ctx.session.taskStep = undefined;
  ctx.session.pendingTask = undefined;

  await ctx.editMessageText(ADMIN_TASK_CREATED(task.title, task.priceUah, task.slotsTotal), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(KB.VIEW_ALL_TASKS, 'admin:tasks')
      .row()
      .text(KB.BACK_ADMIN, 'admin:menu'),
  });
}

export async function handleAdminTaskCancelCreate(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Отменено' });
  ctx.session.taskStep = undefined;
  ctx.session.pendingTask = undefined;

  await ctx.editMessageText(ADMIN_TASK_CREATION_CANCELLED, {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}

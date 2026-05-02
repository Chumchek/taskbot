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
import { isValidUrl, isValidPrice, isValidSlots } from '../../../utils/validators';

// ── Admin task list ─────────────────────────────────────────────────────────

export async function handleAdminTaskList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  const allTasks = await getAllTasks();

  if (allTasks.length === 0) {
    await ctx.editMessageText('📋 No tasks yet.', {
      reply_markup: new InlineKeyboard()
        .text('➕ Create Task', 'admin:task:create')
        .row()
        .text('◀ Back', 'admin:menu'),
    });
    return;
  }

  await ctx.editMessageText(
    `📋 <b>All Tasks</b> (${allTasks.length})`,
    { parse_mode: 'HTML', reply_markup: adminTaskListKeyboard(allTasks) },
  );
}

// ── Task detail (admin view) ────────────────────────────────────────────────

export async function handleAdminTaskView(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const task = await getTaskById(taskId);

  if (!task) {
    await ctx.answerCallbackQuery({ text: '❌ Task not found', show_alert: true });
    return;
  }

  const status = task.isActive ? '🟢 Active' : '🔴 Inactive';
  const text =
    `<b>${task.title}</b>\n\n` +
    (task.description ? `📝 ${task.description}\n\n` : '') +
    `🔗 <a href="${task.link}">Task Link</a>\n` +
    `💰 Price: <b>${task.priceUah} UAH</b>\n` +
    `👥 Slots: ${task.slotsAvailable}/${task.slotsTotal}\n` +
    `Status: ${status}`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: adminTaskDetailKeyboard(task.id, task.isActive),
    link_preview_options: { is_disabled: true },
  });
}

// ── Toggle active / inactive ────────────────────────────────────────────────

export async function handleAdminTaskToggle(ctx: MyContext, taskId: number): Promise<void> {
  const task = await toggleTaskActive(taskId);

  if (!task) {
    await ctx.answerCallbackQuery({ text: '❌ Task not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({
    text: task.isActive ? '🟢 Task activated' : '🔴 Task deactivated',
  });

  // Refresh the detail view in-place
  const status = task.isActive ? '🟢 Active' : '🔴 Inactive';
  const text =
    `<b>${task.title}</b>\n\n` +
    (task.description ? `📝 ${task.description}\n\n` : '') +
    `🔗 <a href="${task.link}">Task Link</a>\n` +
    `💰 Price: <b>${task.priceUah} UAH</b>\n` +
    `👥 Slots: ${task.slotsAvailable}/${task.slotsTotal}\n` +
    `Status: ${status}`;

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: adminTaskDetailKeyboard(task.id, task.isActive),
    link_preview_options: { is_disabled: true },
  });
}

// ── Delete task ─────────────────────────────────────────────────────────────

export async function handleAdminTaskDeleteConfirm(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const task = await getTaskById(taskId);

  if (!task) {
    await ctx.answerCallbackQuery({ text: '❌ Task not found', show_alert: true });
    return;
  }

  await ctx.editMessageText(
    `🗑 <b>Delete task?</b>\n\n"${task.title}"\n\nThis cannot be undone.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Yes, Delete', `admin:task:delete:${taskId}`)
        .text('❌ Cancel', `admin:task:view:${taskId}`),
    },
  );
}

export async function handleAdminTaskDelete(ctx: MyContext, taskId: number): Promise<void> {
  const deleted = await deleteTask(taskId);

  if (!deleted) {
    await ctx.answerCallbackQuery({ text: '❌ Task not found', show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '🗑 Task deleted' });
  const allTasks = await getAllTasks();

  await ctx.editMessageText(
    allTasks.length > 0 ? `📋 <b>All Tasks</b> (${allTasks.length})` : '📋 No tasks yet.',
    {
      parse_mode: 'HTML',
      reply_markup:
        allTasks.length > 0
          ? adminTaskListKeyboard(allTasks)
          : new InlineKeyboard()
              .text('➕ Create Task', 'admin:task:create')
              .row()
              .text('◀ Back', 'admin:menu'),
    },
  );
}

// ── Task creation — multi-step session flow ─────────────────────────────────

export async function handleAdminTaskCreate(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.taskStep = 'awaiting_title';
  ctx.session.pendingTask = {};

  await ctx.editMessageText(
    `➕ <b>New Task — Step 1/5</b>\n\nEnter the task <b>title</b>:\n<i>(max 100 characters)</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ Cancel', 'admin:task:cancel_create'),
    },
  );
}

export async function handleTaskCreationText(ctx: MyContext): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const { taskStep, pendingTask = {} } = ctx.session;

  if (taskStep === 'awaiting_title') {
    if (text.length > 100) {
      await ctx.reply('❌ Title too long (max 100 chars). Try again:');
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, title: text };
    ctx.session.taskStep = 'awaiting_description';

    await ctx.reply(
      `✅ Title: <b>${text}</b>\n\n<b>Step 2/5:</b> Enter a description:\n<i>(optional, max 500 chars)</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('Skip ▶', 'admin:task:skip_desc')
          .text('❌ Cancel', 'admin:task:cancel_create'),
      },
    );
    return;
  }

  if (taskStep === 'awaiting_description') {
    if (text.length > 500) {
      await ctx.reply('❌ Description too long (max 500 chars). Try again:');
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, description: text };
    ctx.session.taskStep = 'awaiting_link';

    await ctx.reply(
      `✅ Description saved.\n\n<b>Step 3/5:</b> Enter the task <b>link</b> (URL):`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'admin:task:cancel_create'),
      },
    );
    return;
  }

  if (taskStep === 'awaiting_link') {
    if (!isValidUrl(text)) {
      await ctx.reply('❌ Invalid URL. Must start with http:// or https://. Try again:');
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, link: text };
    ctx.session.taskStep = 'awaiting_price';

    await ctx.reply(
      `✅ Link saved.\n\n<b>Step 4/5:</b> Enter the <b>payment amount</b> in UAH:\n<i>(e.g. 50 or 75.50)</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'admin:task:cancel_create'),
      },
    );
    return;
  }

  if (taskStep === 'awaiting_price') {
    if (!isValidPrice(text)) {
      await ctx.reply('❌ Invalid price. Enter a positive number (e.g. 50 or 75.50):');
      return;
    }
    ctx.session.pendingTask = { ...pendingTask, priceUah: text };
    ctx.session.taskStep = 'awaiting_slots';

    await ctx.reply(
      `✅ Price: <b>${text} UAH</b>\n\n<b>Step 5/5:</b> Enter the number of <b>available slots</b>:\n<i>(how many users can claim this task)</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('❌ Cancel', 'admin:task:cancel_create'),
      },
    );
    return;
  }

  if (taskStep === 'awaiting_slots') {
    const slots = parseInt(text, 10);
    if (!isValidSlots(text)) {
      await ctx.reply('❌ Invalid number. Enter a positive integer (max 1000):');
      return;
    }

    const task = { ...pendingTask, slotsTotal: slots };
    ctx.session.pendingTask = task;
    ctx.session.taskStep = 'confirming';

    const summary =
      `📋 <b>Task Summary</b>\n\n` +
      `Title: <b>${task.title}</b>\n` +
      (task.description ? `Description: ${task.description}\n` : '') +
      `Link: <a href="${task.link}">${task.link}</a>\n` +
      `Price: <b>${task.priceUah} UAH</b>\n` +
      `Slots: <b>${slots}</b>\n\n` +
      `Create this task?`;

    await ctx.reply(summary, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Create Task', 'admin:task:confirm_create')
        .text('❌ Cancel', 'admin:task:cancel_create'),
      link_preview_options: { is_disabled: true },
    });
  }
}

export async function handleAdminTaskSkipDesc(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  ctx.session.taskStep = 'awaiting_link';

  await ctx.editMessageText(
    `<b>Step 3/5:</b> Enter the task <b>link</b> (URL):`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('❌ Cancel', 'admin:task:cancel_create'),
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
    !pendingTask.slotsTotal
  ) {
    await ctx.editMessageText('❌ Incomplete task data. Please start over.', {
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
    createdBy: adminUser?.id ?? null,
  });

  ctx.session.taskStep = undefined;
  ctx.session.pendingTask = undefined;

  await ctx.editMessageText(
    `✅ <b>Task created!</b>\n\n<b>${task.title}</b>\n💰 ${task.priceUah} UAH | 👥 ${task.slotsTotal} slots`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📋 View All Tasks', 'admin:tasks')
        .row()
        .text('◀ Admin Menu', 'admin:menu'),
    },
  );
}

export async function handleAdminTaskCancelCreate(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery({ text: 'Cancelled' });
  ctx.session.taskStep = undefined;
  ctx.session.pendingTask = undefined;

  await ctx.editMessageText('<b>🔧 Admin Panel</b>\n\nTask creation cancelled.', {
    parse_mode: 'HTML',
    reply_markup: adminMenuKeyboard(),
  });
}


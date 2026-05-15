import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { mainMenuKeyboard, userTaskDetailKeyboard } from '../../keyboards';
import {
  claimTask,
  getActiveTasksByFilter,
  getTaskById,
  getUserAssignments,
  getUserClaimedTaskIds,
  TaskCategoryFilter,
} from '../../../services/taskService';
import { getUserByTelegramId } from '../../../services/userService';
import { getTaskMedia } from '../../../services/taskMediaService';
import { getPresignedUrl } from '../../../services/storageService';
import {
  deadlineLabel,
  KB,
  MENU,
  CATEGORY_KEY_LABELS,
  USER_NO_TASKS,
  USER_NO_TASKS_IN_CATEGORY,
  USER_TASKS_HEADER,
  USER_TASKS_FOOTER,
  USER_TASK_UNAVAILABLE,
  USER_TASK_DETAIL,
  USER_TASK_ALREADY_CLAIMED,
  USER_TASK_NO_SLOTS,
  USER_TASK_CLAIMED_LABEL,
  USER_TASK_CLAIMED_TEXT,
  USER_MY_TASKS_EMPTY,
  USER_MY_TASKS_HEADER,
  USER_ASSIGNMENT_DETAIL,
  TASK_STATUS_RU,
  TASK_STATUS_EMOJI,
  USER_TASK_HELP_NO_FILES,
} from '../../../i18n/ru';

const PAGE_SIZE = 10;

const USER_CATEGORY_TABS: Array<{ key: TaskCategoryFilter; label: string }> = [
  { key: 'all', label: 'Все' },
  { key: 'report_app', label: '📊' },
  { key: 'download_app', label: '📥' },
  { key: 'install_by_key', label: '🔑' },
  { key: 'none', label: '📋' },
];

// ── Available tasks list (paginated + filtered) ─────────────────────────────

async function showUserTaskPage(
  ctx: MyContext,
  category: TaskCategoryFilter,
  page: number,
): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const [allTasks, claimedIds] = await Promise.all([
    getActiveTasksByFilter(category),
    getUserClaimedTaskIds(dbUser.id),
  ]);

  if (allTasks.length === 0 && category === 'all') {
    await ctx.editMessageText(USER_NO_TASKS, {
      reply_markup: new InlineKeyboard().text(KB.BACK, 'user:menu'),
    });
    return;
  }

  const totalPages = Math.max(1, Math.ceil(allTasks.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const pageTasks = allTasks.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const kb = new InlineKeyboard();

  // Category tabs row
  for (const tab of USER_CATEGORY_TABS) {
    const label = tab.key === category ? `▸ ${tab.label}` : tab.label;
    kb.text(label, `user:tasks:page:${tab.key}:0`);
  }
  kb.row();

  // Task rows
  for (const task of pageTasks) {
    const label = claimedIds.has(task.id) ? `⏳ ${task.title}` : `🟢 ${task.title}`;
    kb.text(label, `user:task:view:${task.id}`).row();
  }

  // Pagination row
  if (totalPages > 1) {
    if (safePage > 0) kb.text('← Пред.', `user:tasks:page:${category}:${safePage - 1}`);
    kb.text(`${safePage + 1} / ${totalPages}`, 'user:tasks:noop');
    if (safePage < totalPages - 1) kb.text('След. →', `user:tasks:page:${category}:${safePage + 1}`);
    kb.row();
  }

  kb.text(KB.BACK, 'user:menu');

  const headerText = allTasks.length === 0
    ? USER_NO_TASKS_IN_CATEGORY(CATEGORY_KEY_LABELS[category] ?? 'Все')
    : `${USER_TASKS_HEADER(allTasks.length)}\n\n${USER_TASKS_FOOTER}`;

  await ctx.editMessageText(headerText, {
    parse_mode: 'HTML',
    reply_markup: kb,
  });
}

export async function handleUserTaskList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await showUserTaskPage(ctx, 'all', 0);
}

export async function handleUserTaskPageCallback(
  ctx: MyContext,
  category: TaskCategoryFilter,
  page: number,
): Promise<void> {
  await ctx.answerCallbackQuery();
  await showUserTaskPage(ctx, category, page);
}

// ── Task detail ─────────────────────────────────────────────────────────────

export async function handleUserTaskView(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const [task, claimedIds] = await Promise.all([
    getTaskById(taskId),
    getUserClaimedTaskIds(dbUser.id),
  ]);

  if (!task || !task.isActive) {
    await ctx.editMessageText(USER_TASK_UNAVAILABLE, {
      reply_markup: new InlineKeyboard().text(KB.BACK_TASKS, 'user:tasks'),
    });
    return;
  }

  const [alreadyClaimed, taskMediaFiles] = [
    claimedIds.has(task.id),
    await getTaskMedia(task.id),
  ];

  const dl = deadlineLabel(task.deadlineHours);
  const text = USER_TASK_DETAIL(
    task.title, task.description, task.link, task.priceUah,
    task.slotsAvailable, dl, alreadyClaimed,
  );

  const kb = userTaskDetailKeyboard(task.id, alreadyClaimed, task.slotsAvailable > 0);
  if (taskMediaFiles.length > 0) {
    kb.row().text(
      `📎 Материалы (${taskMediaFiles.length})`,
      `user:task:help:${task.id}`,
    );
  }

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

// ── Claim a task ────────────────────────────────────────────────────────────

export async function handleUserTaskClaim(ctx: MyContext, taskId: number): Promise<void> {
  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);

  if (!dbUser) {
    await ctx.answerCallbackQuery({ text: '❌ Пользователь не найден', show_alert: true });
    return;
  }

  const result = await claimTask(dbUser.id, taskId);

  if (!result.success) {
    const message =
      result.reason === 'already_claimed'
        ? USER_TASK_ALREADY_CLAIMED
        : USER_TASK_NO_SLOTS;
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: USER_TASK_CLAIMED_LABEL });

  const task = await getTaskById(taskId);
  const expiresAt = result.assignment.expiresAt;
  const deadline = expiresAt
    ? new Date(expiresAt).toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' })
    : 'неизвестно';

  await ctx.editMessageText(USER_TASK_CLAIMED_TEXT(task?.title, deadline), {
    parse_mode: 'HTML',
    reply_markup: new InlineKeyboard()
      .text(MENU.MY_TASKS, 'user:my_tasks')
      .row()
      .text(KB.BACK_TASKS, 'user:tasks'),
  });
}

// ── My claimed tasks ────────────────────────────────────────────────────────

export async function handleUserMyTasks(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const assignments = await getUserAssignments(dbUser.id);

  if (assignments.length === 0) {
    await ctx.editMessageText(USER_MY_TASKS_EMPTY, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(KB.BROWSE_TASKS, 'user:tasks')
        .row()
        .text(KB.BACK, 'user:menu'),
    });
    return;
  }

  const lines = assignments
    .map((a) => {
      const emoji = TASK_STATUS_EMOJI[a.status] ?? '•';
      const statusRu = TASK_STATUS_RU[a.status] ?? a.status;
      return `${emoji} <b>${a.task.title}</b> — ${a.task.priceUah} грн [${statusRu}]`;
    })
    .join('\n');

  const kb = new InlineKeyboard();
  for (const a of assignments) {
    const emoji = TASK_STATUS_EMOJI[a.status] ?? '•';
    kb.text(`${emoji} ${a.task.title}`, `user:assignment:view:${a.id}`).row();
  }
  kb.text(KB.BROWSE_TASKS, 'user:tasks').row().text(KB.BACK, 'user:menu');

  await ctx.editMessageText(
    `${USER_MY_TASKS_HEADER(assignments.length)}\n\n${lines}`,
    { parse_mode: 'HTML', reply_markup: kb },
  );
}

// ── Assignment detail view ───────────────────────────────────────────────────

export async function handleUserAssignmentView(
  ctx: MyContext,
  assignmentId: number,
): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const userAssignments = await getUserAssignments(dbUser.id);
  const assignment = userAssignments.find((a) => a.id === assignmentId);

  if (!assignment) {
    await ctx.answerCallbackQuery({ text: '❌ Задание не найдено', show_alert: true });
    return;
  }

  const task = assignment.task;
  const taskMediaFiles = await getTaskMedia(task.id);

  const deadline = assignment.expiresAt
    ? assignment.expiresAt.toLocaleString('ru-RU', { timeZone: 'Europe/Kiev' })
    : '—';

  const statusEmoji = TASK_STATUS_EMOJI[assignment.status] ?? '•';
  const statusRu = TASK_STATUS_RU[assignment.status] ?? assignment.status;

  const text = USER_ASSIGNMENT_DETAIL(
    task.title, task.description, task.link, task.priceUah, deadline, statusEmoji, statusRu,
  );

  const kb = new InlineKeyboard();
  if (assignment.status === 'claimed') {
    kb.text(KB.SUBMIT_REPORT, `user:report:start:${assignmentId}`).row();
  }
  if (taskMediaFiles.length > 0) {
    kb.text(`📎 Материалы (${taskMediaFiles.length})`, `user:task:help:${task.id}`).row();
  }
  kb.text(KB.BACK_MY_TASKS, 'user:my_tasks');

  await ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: kb,
    link_preview_options: { is_disabled: true },
  });
}

// ── Send task help media to user ─────────────────────────────────────────────

export async function handleUserTaskHelp(ctx: MyContext, taskId: number): Promise<void> {
  await ctx.answerCallbackQuery();
  const files = await getTaskMedia(taskId);

  if (files.length === 0) {
    await ctx.answerCallbackQuery({ text: USER_TASK_HELP_NO_FILES, show_alert: true });
    return;
  }

  for (const f of files) {
    try {
      if (f.telegramFileId) {
        if (f.fileType === 'photo') await ctx.replyWithPhoto(f.telegramFileId);
        else await ctx.replyWithVideo(f.telegramFileId);
      } else {
        const url = await getPresignedUrl(f.storageKey, 3600);
        await ctx.reply(`🔗 <a href="${url}">Открыть файл</a>`, { parse_mode: 'HTML' });
      }
    } catch {
      const url = await getPresignedUrl(f.storageKey, 3600);
      await ctx.reply(`🔗 <a href="${url}">Открыть файл</a>`, { parse_mode: 'HTML' });
    }
  }
}

// ── Main menu shortcut ───────────────────────────────────────────────────────

export async function handleUserMenu(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(MENU.MAIN_PROMPT, { reply_markup: mainMenuKeyboard() });
}

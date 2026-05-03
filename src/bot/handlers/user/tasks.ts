import { InlineKeyboard } from 'grammy';
import { MyContext } from '../../context';
import { mainMenuKeyboard, userTaskListKeyboard, userTaskDetailKeyboard } from '../../keyboards';
import {
  claimTask,
  getActiveTasks,
  getTaskById,
  getUserAssignments,
  getUserClaimedTaskIds,
} from '../../../services/taskService';
import { getUserByTelegramId } from '../../../services/userService';
import { getTaskMedia } from '../../../services/taskMediaService';
import { getPresignedUrl } from '../../../services/storageService';

// ── Available tasks list ────────────────────────────────────────────────────

export async function handleUserTaskList(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const [activeTasks, claimedIds] = await Promise.all([
    getActiveTasks(),
    getUserClaimedTaskIds(dbUser.id),
  ]);

  if (activeTasks.length === 0) {
    await ctx.editMessageText('📋 No tasks available right now. Check back later!', {
      reply_markup: new InlineKeyboard().text('◀ Back', 'user:menu'),
    });
    return;
  }

  const lines = activeTasks
    .map((t) => {
      const claimed = claimedIds.has(t.id) ? ' ✅' : '';
      return `• <b>${t.title}</b>${claimed} — ${t.priceUah} UAH (${t.slotsAvailable} slot${t.slotsAvailable === 1 ? '' : 's'})`;
    })
    .join('\n');

  await ctx.editMessageText(
    `📋 <b>Available Tasks</b> (${activeTasks.length})\n\n${lines}\n\n<i>Select a task for details.</i>`,
    {
      parse_mode: 'HTML',
      reply_markup: userTaskListKeyboard(activeTasks, claimedIds),
    },
  );
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
    await ctx.editMessageText('❌ This task is no longer available.', {
      reply_markup: new InlineKeyboard().text('◀ Back to Tasks', 'user:tasks'),
    });
    return;
  }

  const [alreadyClaimed, taskMediaFiles] = [
    claimedIds.has(task.id),
    await getTaskMedia(task.id),
  ];

  const deadlineLabel = task.deadlineHours % 24 === 0
    ? `${task.deadlineHours / 24} day${task.deadlineHours / 24 === 1 ? '' : 's'}`
    : `${task.deadlineHours} hours`;

  const text =
    `<b>${task.title}</b>\n\n` +
    (task.description ? `${task.description}\n\n` : '') +
    `🔗 <a href="${task.link}">Open Task Link</a>\n` +
    `💰 Reward: <b>${task.priceUah} UAH</b>\n` +
    `👥 Available slots: <b>${task.slotsAvailable}</b>\n` +
    `⏰ Deadline after claiming: <b>${deadlineLabel}</b>` +
    (alreadyClaimed ? '\n\n✅ <i>You have already claimed this task.</i>' : '');

  const kb = userTaskDetailKeyboard(task.id, alreadyClaimed, task.slotsAvailable > 0);
  if (taskMediaFiles.length > 0) {
    kb.row().text(`📎 Help Material (${taskMediaFiles.length})`, `user:task:help:${task.id}`);
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
    await ctx.answerCallbackQuery({ text: '❌ User not found', show_alert: true });
    return;
  }

  const result = await claimTask(dbUser.id, taskId);

  if (!result.success) {
    const message =
      result.reason === 'already_claimed'
        ? '✅ You already have this task.'
        : '❌ No slots available anymore.';
    await ctx.answerCallbackQuery({ text: message, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery({ text: '✅ Task claimed!' });

  const task = await getTaskById(taskId);
  const expiresAt = result.assignment.expiresAt;
  const deadline = expiresAt
    ? new Date(expiresAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })
    : 'unknown';

  await ctx.editMessageText(
    `✅ <b>Task claimed!</b>\n\n` +
      `<b>${task?.title}</b>\n\n` +
      `Complete the task and submit your report before the deadline.\n` +
      `⏰ Deadline: <b>${deadline}</b>\n\n` +
      `When done, go to <b>My Tasks</b> to submit your report.`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🎯 My Tasks', 'user:my_tasks')
        .row()
        .text('◀ Back to Task List', 'user:tasks'),
    },
  );
}

// ── My claimed tasks ────────────────────────────────────────────────────────

export async function handleUserMyTasks(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const telegramId = ctx.from!.id.toString();
  const dbUser = await getUserByTelegramId(telegramId);
  if (!dbUser) return;

  const assignments = await getUserAssignments(dbUser.id);

  if (assignments.length === 0) {
    await ctx.editMessageText(
      `🎯 <b>My Tasks</b>\n\nYou haven't claimed any tasks yet.`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('📋 Browse Tasks', 'user:tasks')
          .row()
          .text('◀ Back', 'user:menu'),
      },
    );
    return;
  }

  const statusEmoji: Record<string, string> = {
    claimed: '⏳',
    completed: '✅',
    expired: '❌',
  };

  const lines = assignments
    .map((a) => {
      const emoji = statusEmoji[a.status] ?? '•';
      return `${emoji} <b>${a.task.title}</b> — ${a.task.priceUah} UAH [${a.status}]`;
    })
    .join('\n');

  const kb = new InlineKeyboard();
  for (const a of assignments) {
    kb.text(`${statusEmoji[a.status] ?? '•'} ${a.task.title}`, `user:assignment:view:${a.id}`).row();
  }
  kb.text('📋 Browse More Tasks', 'user:tasks').row().text('◀ Back', 'user:menu');

  await ctx.editMessageText(
    `🎯 <b>My Tasks</b> (${assignments.length})\n\n${lines}`,
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
    await ctx.answerCallbackQuery({ text: '❌ Assignment not found', show_alert: true });
    return;
  }

  const task = assignment.task;
  const statusEmoji: Record<string, string> = { claimed: '⏳', completed: '✅', expired: '❌' };
  const taskMediaFiles = await getTaskMedia(task.id);

  const deadline = assignment.expiresAt
    ? assignment.expiresAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' })
    : '—';

  const text =
    `<b>${task.title}</b>\n\n` +
    (task.description ? `📝 ${task.description}\n\n` : '') +
    `🔗 <a href="${task.link}">Open Task Link</a>\n` +
    `💰 Reward: <b>${task.priceUah} UAH</b>\n` +
    `⏰ Deadline: <b>${deadline}</b>\n` +
    `Status: ${statusEmoji[assignment.status] ?? '•'} <b>${assignment.status}</b>`;

  const kb = new InlineKeyboard();
  if (assignment.status === 'claimed') {
    kb.text('📝 Submit Report', `user:report:start:${assignmentId}`).row();
  }
  if (taskMediaFiles.length > 0) {
    kb.text(`📎 Help Material (${taskMediaFiles.length})`, `user:task:help:${task.id}`).row();
  }
  kb.text('◀ Back to My Tasks', 'user:my_tasks');

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
    await ctx.answerCallbackQuery({ text: 'No help material available', show_alert: true });
    return;
  }

  for (const f of files) {
    try {
      if (f.telegramFileId) {
        if (f.fileType === 'photo') await ctx.replyWithPhoto(f.telegramFileId);
        else await ctx.replyWithVideo(f.telegramFileId);
      } else {
        const url = await getPresignedUrl(f.storageKey, 3600);
        await ctx.reply(`🔗 <a href="${url}">View file</a>`, { parse_mode: 'HTML' });
      }
    } catch {
      const url = await getPresignedUrl(f.storageKey, 3600);
      await ctx.reply(`🔗 <a href="${url}">View file</a>`, { parse_mode: 'HTML' });
    }
  }
}

// ── Main menu shortcut ───────────────────────────────────────────────────────

export async function handleUserMenu(ctx: MyContext): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `What would you like to do?`,
    { reply_markup: mainMenuKeyboard() },
  );
}

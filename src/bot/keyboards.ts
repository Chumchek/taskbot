import { InlineKeyboard } from 'grammy';
import type { Task } from '../services/taskService';
import { KB, MENU } from '../i18n/ru';

// ── User keyboards ─────────────────────────────────────────────────────────

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(MENU.AVAILABLE_TASKS, 'user:tasks')
    .text(MENU.MY_TASKS, 'user:my_tasks')
    .row()
    .text(MENU.MY_REPORTS, 'user:reports')
    .text(MENU.MY_BALANCE, 'user:balance');
}

export function userTaskListKeyboard(tasks: Task[], claimedIds: Set<number>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const label = claimedIds.has(task.id) ? `✅ ${task.title}` : `📌 ${task.title}`;
    kb.text(label, `user:task:view:${task.id}`).row();
  }
  kb.text('◀ Назад', 'user:menu');
  return kb;
}

export function userTaskDetailKeyboard(
  taskId: number,
  alreadyClaimed: boolean,
  hasSlots: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (!alreadyClaimed && hasSlots) {
    kb.text('🚀 Взять задание', `user:task:claim:${taskId}`).row();
  }
  kb.text('◀ К заданиям', 'user:tasks');
  return kb;
}

// ── Admin keyboards ────────────────────────────────────────────────────────

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(MENU.ADMIN_PENDING_USERS, 'admin:pending_users')
    .row()
    .text(MENU.ADMIN_TASKS, 'admin:tasks')
    .text(MENU.ADMIN_REPORTS, 'admin:reports')
    .row()
    .text(MENU.ADMIN_PAYOUTS, 'admin:payouts')
    .row()
    .text(MENU.ADMIN_USER_MENU, 'user:menu');
}

export function approveUserKeyboard(telegramId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Одобрить', `user:approve:${telegramId}`)
    .text('❌ Отклонить', `user:reject:${telegramId}`);
}

export function adminTaskListKeyboard(tasks: Task[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const icon = task.isActive ? '🟢' : '🔴';
    kb.text(`${icon} ${task.title}`, `admin:task:view:${task.id}`).row();
  }
  kb.text(KB.CREATE_TASK, 'admin:task:create').row().text(KB.BACK, 'admin:menu');
  return kb;
}

export function adminTaskDetailKeyboard(taskId: number, isActive: boolean, mediaCount = 0): InlineKeyboard {
  return new InlineKeyboard()
    .text(isActive ? MENU.ADMIN_DEACTIVATE : MENU.ADMIN_ACTIVATE, `admin:task:toggle:${taskId}`)
    .text(MENU.ADMIN_DELETE, `admin:task:delete_confirm:${taskId}`)
    .row()
    .text(MENU.ADMIN_HELP_MEDIA(mediaCount), `admin:task:media:${taskId}`)
    .row()
    .text(MENU.BACK_TO_TASKS_ADMIN, 'admin:tasks');
}

// ── Registration keyboards ─────────────────────────────────────────────────

export function registrationStep1Keyboard(): InlineKeyboard {
  return new InlineKeyboard().text(MENU.REG_SKIP_BINANCE, 'reg:skip_binance');
}

export function registrationStep2Keyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(MENU.REG_BACK, 'reg:back_to_binance')
    .text(MENU.REG_SKIP_CARD, 'reg:skip_card');
}

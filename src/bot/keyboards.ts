import { InlineKeyboard } from 'grammy';
import type { Task } from '../services/taskService';

// ── User keyboards ─────────────────────────────────────────────────────────

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 Available Tasks', 'user:tasks')
    .text('🎯 My Tasks', 'user:my_tasks')
    .row()
    .text('📊 My Reports', 'user:reports')
    .text('💰 My Balance', 'user:balance');
}

export function userTaskListKeyboard(tasks: Task[], claimedIds: Set<number>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const label = claimedIds.has(task.id) ? `✅ ${task.title}` : `📌 ${task.title}`;
    kb.text(label, `user:task:view:${task.id}`).row();
  }
  kb.text('◀ Back', 'user:menu');
  return kb;
}

export function userTaskDetailKeyboard(
  taskId: number,
  alreadyClaimed: boolean,
  hasSlots: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (!alreadyClaimed && hasSlots) {
    kb.text('🚀 Claim Task', `user:task:claim:${taskId}`).row();
  }
  kb.text('◀ Back to Tasks', 'user:tasks');
  return kb;
}

// ── Admin keyboards ────────────────────────────────────────────────────────

export function adminMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👥 Pending Users', 'admin:pending_users')
    .row()
    .text('📋 Tasks', 'admin:tasks')
    .text('📊 Reports', 'admin:reports')
    .row()
    .text('💰 Payouts', 'admin:payouts')
    .row()
    .text('👤 User Menu', 'user:menu');
}

export function approveUserKeyboard(telegramId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Approve', `user:approve:${telegramId}`)
    .text('❌ Reject', `user:reject:${telegramId}`);
}

export function adminTaskListKeyboard(tasks: Task[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const icon = task.isActive ? '🟢' : '🔴';
    kb.text(`${icon} ${task.title}`, `admin:task:view:${task.id}`).row();
  }
  kb.text('➕ Create Task', 'admin:task:create').row().text('◀ Back', 'admin:menu');
  return kb;
}

export function adminTaskDetailKeyboard(taskId: number, isActive: boolean, mediaCount = 0): InlineKeyboard {
  const mediaLabel = mediaCount > 0 ? `📎 Help Media (${mediaCount})` : '📎 Add Help Media';
  return new InlineKeyboard()
    .text(isActive ? '🔴 Deactivate' : '🟢 Activate', `admin:task:toggle:${taskId}`)
    .text('🗑 Delete', `admin:task:delete_confirm:${taskId}`)
    .row()
    .text(mediaLabel, `admin:task:media:${taskId}`)
    .row()
    .text('◀ Back to Tasks', 'admin:tasks');
}

// ── Registration keyboards ─────────────────────────────────────────────────

export function registrationStep1Keyboard(): InlineKeyboard {
  return new InlineKeyboard().text('Skip ▶', 'reg:skip_binance');
}

export function registrationStep2Keyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('◀ Back', 'reg:back_to_binance')
    .text('Skip ▶', 'reg:skip_card');
}

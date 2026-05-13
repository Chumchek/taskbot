import { InlineKeyboard } from 'grammy';
import type { Task } from '../services/taskService';
import { ALL_CATEGORY_KEYS } from '../services/reportExampleService';
import { KB, MENU, CATEGORY_KEY_LABELS } from '../i18n/ru';

// ── User keyboards ─────────────────────────────────────────────────────────

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(MENU.AVAILABLE_TASKS, 'user:tasks')
    .text(MENU.MY_TASKS, 'user:my_tasks')
    .row()
    .text(MENU.MY_REPORTS, 'user:reports')
    .text(MENU.MY_BALANCE, 'user:balance')
    .row()
    .text(MENU.MY_PROFILE, 'user:profile');
}

export function userTaskListKeyboard(tasks: Task[], claimedIds: Set<number>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const label = claimedIds.has(task.id) ? `⏳ ${task.title}` : `🟢 ${task.title}`;
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
    .text(MENU.ADMIN_REPORT_EXAMPLES, 'admin:rex')
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
  kb.text(KB.CREATE_TASK, 'admin:task:create')
    .row()
    .text(KB.SEARCH_TASKS, 'admin:task:search')
    .row()
    .text(KB.BACK, 'admin:menu');
  return kb;
}

export function adminTaskSearchResultsKeyboard(tasks: Task[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const task of tasks) {
    const icon = task.isActive ? '🟢' : '🔴';
    kb.text(`${icon} ${task.title}`, `admin:task:view:${task.id}`).row();
  }
  kb.text(KB.VIEW_ALL_TASKS, 'admin:tasks');
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

export function adminReportExampleListKeyboard(existingKeys: Set<string>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const key of ALL_CATEGORY_KEYS) {
    const label = CATEGORY_KEY_LABELS[key];
    kb.text(`${existingKeys.has(key) ? '✅' : '⬜'} ${label}`, `admin:rex:cat:${key}`).row();
  }
  kb.text(KB.BACK_ADMIN, 'admin:menu');
  return kb;
}

export function adminReportExampleDetailKeyboard(
  categoryKey: string,
  mediaCount: number,
): InlineKeyboard {
  return new InlineKeyboard()
    .text(KB.REX_COMMENT, `admin:rex:comment:${categoryKey}`)
    .row()
    .text(KB.REX_MEDIA(mediaCount), `admin:rex:media:${categoryKey}`)
    .row()
    .text(KB.REX_DELETE, `admin:rex:delete_confirm:${categoryKey}`)
    .row()
    .text(KB.BACK_REX, 'admin:rex');
}

export function adminReportExampleNoExampleKeyboard(categoryKey: string): InlineKeyboard {
  return new InlineKeyboard()
    .text(KB.REX_CREATE, `admin:rex:create:${categoryKey}`)
    .row()
    .text(KB.BACK_REX, 'admin:rex');
}

export function adminReportExampleMediaKeyboard(
  categoryKey: string,
  fileCount: number,
  max: number,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (fileCount < max) {
    kb.text(KB.ADD_MEDIA, `admin:rex:media:upload:${categoryKey}`).row();
  }
  if (fileCount > 0) {
    kb.text(KB.PREVIEW, `admin:rex:media:preview:${categoryKey}`)
      .text(KB.REMOVE_ALL, `admin:rex:media:clear_confirm:${categoryKey}`)
      .row();
  }
  kb.text(KB.BACK_REX_DETAIL, `admin:rex:cat:${categoryKey}`);
  return kb;
}

export function adminTaskCategoryKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📊 Репорт приложения', 'admin:task:category:report_app')
    .row()
    .text('📥 Скачать приложение', 'admin:task:category:download_app')
    .row()
    .text('🔑 Установка приложения по ключу', 'admin:task:category:install_by_key')
    .row()
    .text('📋 Без категории', 'admin:task:category:none')
    .row()
    .text(KB.CANCEL, 'admin:task:cancel_create');
}

export function userProfileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(KB.EDIT_BINANCE, 'user:profile:edit_binance')
    .row()
    .text(KB.EDIT_CARD, 'user:profile:edit_card')
    .row()
    .text(KB.BACK, 'user:menu');
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

import { Api } from 'grammy';
import { getAllAdminIds } from '../services/userService';

const USER_COMMANDS = [
  { command: 'start', description: 'Открыть главное меню' },
];

const ADMIN_COMMANDS = [
  { command: 'start', description: 'Открыть главное меню' },
  { command: 'admin', description: 'Панель администратора' },
];

export async function setupBotCommands(api: Api): Promise<void> {
  // Default scope — all users see /start
  await api.setMyCommands(USER_COMMANDS);

  // Per-chat scope for each admin — they also see /admin
  const adminIds = await getAllAdminIds();
  for (const telegramId of adminIds) {
    try {
      await api.setMyCommands(ADMIN_COMMANDS, {
        scope: { type: 'chat', chat_id: parseInt(telegramId, 10) },
      });
    } catch {
      // Admin may not have started the bot yet — skip silently
    }
  }
}

export async function setAdminCommands(api: Api, telegramId: string): Promise<void> {
  try {
    await api.setMyCommands(ADMIN_COMMANDS, {
      scope: { type: 'chat', chat_id: parseInt(telegramId, 10) },
    });
  } catch {
    // Non-critical
  }
}

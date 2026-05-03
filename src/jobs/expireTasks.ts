import { autoExpireTasks } from '../services/taskService';

export async function expireTasks(): Promise<void> {
  const count = await autoExpireTasks();
  if (count > 0) {
    console.log(`[expireTasks] Deactivated ${count} expired task(s)`);
  }
}

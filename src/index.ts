import { webhookCallback } from 'grammy';
import { createServer } from 'http';
import { config } from './config';
import { createBot } from './bot';
import { setupBotCommands } from './bot/setupCommands';
import { expireAssignments } from './jobs/expireAssignments';
import { cleanupApprovedReports } from './jobs/cleanupApprovedReports';
import { expireTasks } from './jobs/expireTasks';

const EXPIRE_INTERVAL_MS = 5 * 60 * 1000;
const EXPIRE_TASKS_INTERVAL_MS = 30 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function main() {
  const bot = createBot();

  // Set bot command menu for all users and admins
  setupBotCommands(bot.api).catch(console.error);

  // Run assignment expiry once at startup, then every 5 minutes
  expireAssignments(bot.api).catch(console.error);
  setInterval(() => expireAssignments(bot.api).catch(console.error), EXPIRE_INTERVAL_MS);

  // Auto-deactivate tasks past their taskExpiryHours, every 30 minutes
  expireTasks().catch(console.error);
  setInterval(() => expireTasks().catch(console.error), EXPIRE_TASKS_INTERVAL_MS);

  // Run media/record cleanup once at startup, then every 24 hours
  cleanupApprovedReports().catch(console.error);
  setInterval(() => cleanupApprovedReports().catch(console.error), CLEANUP_INTERVAL_MS);

  if (config.webhookUrl) {
    // ── Webhook mode (production) ────────────────────────────────────────────
    const handleUpdate = webhookCallback(bot, 'http');

    const server = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        await handleUpdate(req, res);
      } else {
        res.writeHead(200).end('OK');
      }
    });

    server.listen(config.port, () => {
      console.log(`Webhook server listening on port ${config.port}`);
    });

    // Register the webhook URL with Telegram
    await bot.api.setWebhook(`${config.webhookUrl}/webhook`);
    console.log(`Webhook registered at ${config.webhookUrl}/webhook`);
  } else {
    // ── Long-polling mode (development) ─────────────────────────────────────
    await bot.start({
      onStart: (info) => console.log(`@${info.username} is running (long-polling)`),
    });
  }
}

main().catch(console.error);

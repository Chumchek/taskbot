import { Bot, session } from 'grammy';
import { config } from '../config';
import { MyContext, SessionData } from './context';
import { makeSessionStorage } from '../db/sessionStore';
import { adminOnly } from './middleware/auth';
import { approvedOnly } from './middleware/approvedOnly';
import { isAdmin } from '../services/userService';

// Handlers — registration
import { handleStart } from './handlers/start';
import {
  handleRegistrationText,
  handleRegSkipBinance,
  handleRegSkipCard,
  handleRegBackToBinance,
} from './handlers/registration';

// Handlers — admin core
import { handleAdminCommand, handleAdminMenu } from './handlers/admin/index';
import {
  handleApproveUser,
  handlePendingUsers,
  handlePromoteCommand,
  handleRejectUser,
} from './handlers/admin/users';

// Handlers — admin tasks
import {
  handleAdminTaskCancelCreate,
  handleAdminTaskConfirmCreate,
  handleAdminTaskCreate,
  handleAdminTaskDelete,
  handleAdminTaskDeleteConfirm,
  handleAdminTaskList,
  handleAdminTaskSkipDesc,
  handleAdminTaskToggle,
  handleAdminTaskView,
  handleTaskCreationText,
} from './handlers/admin/tasks';

// Handlers — admin reports
import {
  handleAdminReportApprove,
  handleAdminReportList,
  handleAdminReportReject,
  handleAdminReportRejectAsk,
  handleAdminReportView,
  handleAdminRejectCommentText,
} from './handlers/admin/reports';

// Handlers — admin payouts
import {
  handleAdminPayoutConfirm,
  handleAdminPayoutMarkPaid,
  handleAdminPayoutQueue,
  handleAdminPayoutShowCard,
  handleAdminPayoutView,
} from './handlers/admin/payouts';

// Handlers — user tasks
import {
  handleUserMenu,
  handleUserMyTasks,
  handleUserTaskClaim,
  handleUserTaskList,
  handleUserTaskView,
} from './handlers/user/tasks';

// Handlers — user reports
import {
  handleReportCancel,
  handleReportPhoto,
  handleReportStart,
  handleReportSubmit,
  handleReportVideo,
  handleUserReports,
  handleUserReportDetail,
} from './handlers/user/reports';

// Handlers — user balance
import { handleUserBalance } from './handlers/user/balance';

export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(config.bot.token);

  // ── Session (PostgreSQL-backed, survives restarts) ───────────────────────
  bot.use(
    session({
      initial: (): SessionData => ({ step: 'idle' }),
      storage: makeSessionStorage<SessionData>(),
    }),
  );

  // ── Global auth gate (runs after session so reg flow is detectable) ──────
  bot.use(approvedOnly);

  // ── User commands ────────────────────────────────────────────────────────
  bot.command('start', handleStart);

  // ── Registration callbacks ───────────────────────────────────────────────
  bot.callbackQuery('reg:skip_binance', handleRegSkipBinance);
  bot.callbackQuery('reg:skip_card', handleRegSkipCard);
  bot.callbackQuery('reg:back_to_binance', handleRegBackToBinance);

  // ── Admin commands ───────────────────────────────────────────────────────
  bot.command('admin', adminOnly, handleAdminCommand);
  bot.command('promote', adminOnly, handlePromoteCommand);

  // ── Admin menu callbacks ─────────────────────────────────────────────────
  bot.callbackQuery('admin:menu', adminOnly, handleAdminMenu);
  bot.callbackQuery('admin:pending_users', adminOnly, handlePendingUsers);

  bot.callbackQuery(/^user:approve:(.+)$/, adminOnly, (ctx) =>
    handleApproveUser(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^user:reject:(.+)$/, adminOnly, (ctx) =>
    handleRejectUser(ctx, ctx.match[1]),
  );

  // ── Admin task callbacks ─────────────────────────────────────────────────
  bot.callbackQuery('admin:tasks', adminOnly, handleAdminTaskList);
  bot.callbackQuery('admin:task:create', adminOnly, handleAdminTaskCreate);
  bot.callbackQuery('admin:task:skip_desc', adminOnly, handleAdminTaskSkipDesc);
  bot.callbackQuery('admin:task:confirm_create', adminOnly, handleAdminTaskConfirmCreate);
  bot.callbackQuery('admin:task:cancel_create', adminOnly, handleAdminTaskCancelCreate);

  bot.callbackQuery(/^admin:task:view:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:toggle:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskToggle(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:delete_confirm:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskDeleteConfirm(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:delete:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskDelete(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── Admin report callbacks ───────────────────────────────────────────────
  bot.callbackQuery('admin:reports', adminOnly, handleAdminReportList);

  bot.callbackQuery(/^admin:report:view:(\d+)$/, adminOnly, (ctx) =>
    handleAdminReportView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:report:approve:(\d+)$/, adminOnly, (ctx) =>
    handleAdminReportApprove(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:report:reject_ask:(\d+)$/, adminOnly, (ctx) =>
    handleAdminReportRejectAsk(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:report:reject:(\d+)$/, adminOnly, (ctx) =>
    handleAdminReportReject(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── Admin payout callbacks ───────────────────────────────────────────────
  bot.callbackQuery('admin:payouts', adminOnly, handleAdminPayoutQueue);

  bot.callbackQuery(/^admin:payout:view:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:confirm:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutConfirm(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:mark_paid:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutMarkPaid(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:show_card:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutShowCard(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── User task callbacks ──────────────────────────────────────────────────
  bot.callbackQuery('user:menu', handleUserMenu);
  bot.callbackQuery('user:tasks', handleUserTaskList);
  bot.callbackQuery('user:my_tasks', handleUserMyTasks);

  bot.callbackQuery(/^user:task:view:(\d+)$/, (ctx) =>
    handleUserTaskView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^user:task:claim:(\d+)$/, (ctx) =>
    handleUserTaskClaim(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── User report callbacks ────────────────────────────────────────────────
  bot.callbackQuery('user:reports', handleUserReports);

  bot.callbackQuery(/^user:report:detail:(\d+)$/, (ctx) =>
    handleUserReportDetail(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^user:report:start:(\d+)$/, (ctx) =>
    handleReportStart(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery('user:report:submit', handleReportSubmit);
  bot.callbackQuery('user:report:cancel', handleReportCancel);

  // ── User balance ─────────────────────────────────────────────────────────
  bot.callbackQuery('user:balance', handleUserBalance);

  // ── Media handlers (report submission) ───────────────────────────────────
  bot.on('message:photo', async (ctx) => {
    if (ctx.session.reportStep === 'awaiting_media') {
      await handleReportPhoto(ctx);
    }
  });

  bot.on('message:video', async (ctx) => {
    if (ctx.session.reportStep === 'awaiting_media') {
      await handleReportVideo(ctx);
    }
  });

  // ── Text message router ──────────────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    const telegramId = ctx.from?.id.toString() ?? '';

    // Admin reject comment flow
    if (ctx.session.adminRejectReportId && (await isAdmin(telegramId))) {
      await handleAdminRejectCommentText(ctx, ctx.session.adminRejectReportId);
      return;
    }

    // User registration flow
    if (ctx.session.step !== 'idle') {
      await handleRegistrationText(ctx);
      return;
    }

    // Admin task creation flow
    if (ctx.session.taskStep && (await isAdmin(telegramId))) {
      await handleTaskCreationText(ctx);
      return;
    }
  });

  // ── Error handler ────────────────────────────────────────────────────────
  bot.catch((err) => {
    console.error(`[update ${err.ctx.update.update_id}]`, err.error);
    // Swallow the error so the process doesn't crash on unhandled rejections
  });

  // Safety net — prevent any stray unhandled rejections from killing the process
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
  });

  return bot;
}

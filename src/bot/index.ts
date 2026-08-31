import { Bot, BotError, GrammyError, session } from 'grammy';
import { config } from '../config';
import { MyContext, SessionData } from './context';
import { makeSessionStorage } from '../db/sessionStore';
import { adminOnly } from './middleware/auth';
import { approvedOnly } from './middleware/approvedOnly';
import { isAdmin } from '../services/userService';
import { GENERIC_ERROR, GENERIC_ERROR_ADMIN } from '../i18n/ru';

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
  handleBanCommand,
  handlePendingUsers,
  handlePromoteCommand,
  handleRejectUser,
  handleUnbanCommand,
} from './handlers/admin/users';

// Handlers — admin tasks
import {
  handleAdminTaskCancelCreate,
  handleAdminTaskCategorySelect,
  handleAdminTaskConfirmCreate,
  handleAdminTaskCreate,
  handleAdminTaskDelete,
  handleAdminTaskDeleteConfirm,
  handleAdminTaskList,
  handleAdminTaskPageCallback,
  handleAdminTaskSearch,
  handleAdminTaskSearchText,
  handleAdminTaskSkipDesc,
  handleAdminTaskSkipExpiry,
  handleAdminTaskToggle,
  handleAdminTaskView,
  handleTaskCreationText,
} from './handlers/admin/tasks';
import { TaskCategoryFilter } from '../services/taskService';

// Handlers — admin reports
import {
  handleAdminReportApprove,
  handleAdminReportList,
  handleAdminReportPageCallback,
  handleAdminReportReject,
  handleAdminReportRejectAsk,
  handleAdminReportView,
  handleAdminRejectCommentText,
  handleAdminUserReportList,
  handleAdminApproveAllUserReports,
  handleAdminApproveUserReportsByCategory,
} from './handlers/admin/reports';

// Handlers — admin payouts
import {
  handleAdminPayoutConfirm,
  handleAdminPayoutMarkPaid,
  handleAdminPayoutProofPhoto,
  handleAdminPayoutProofSkip,
  handleAdminPayoutQueue,
  handleAdminPayoutShowCard,
  handleAdminPayoutView,
} from './handlers/admin/payouts';

// Handlers — admin task media
import {
  handleAdminTaskMedia,
  handleAdminTaskMediaStartUpload,
  handleAdminTaskMediaDone,
  handleAdminTaskMediaPreview,
  handleAdminTaskMediaClearConfirm,
  handleAdminTaskMediaClear,
  handleTaskMediaPhoto,
  handleTaskMediaVideo,
} from './handlers/admin/taskMedia';

// Handlers — admin report examples
import {
  handleAdminReportExampleList,
  handleAdminReportExampleView,
  handleAdminReportExampleCreate,
  handleAdminReportExampleCommentAsk,
  handleAdminReportExampleCommentText,
  handleAdminReportExampleMedia,
  handleAdminReportExampleMediaStartUpload,
  handleAdminReportExampleMediaDone,
  handleAdminReportExampleMediaPreview,
  handleAdminReportExampleMediaClearConfirm,
  handleAdminReportExampleMediaClear,
  handleAdminReportExampleDeleteConfirm,
  handleAdminReportExampleDelete,
  handleReportExampleMediaPhoto,
  handleReportExampleMediaVideo,
} from './handlers/admin/reportExamples';

// Handlers — user tasks
import {
  handleUserMenu,
  handleUserMyTasks,
  handleUserTaskClaim,
  handleUserTaskList,
  handleUserTaskPageCallback,
  handleUserTaskView,
  handleUserAssignmentView,
  handleUserTaskHelp,
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

// Handlers — user payment proofs gallery
import { handleUserProofGallery } from './handlers/user/proofs';

// Handlers — admin payment proofs
import {
  handleAdminProofList,
  handleAdminProofUpload,
  handleAdminProofPhoto,
  handleAdminProofDone,
  handleAdminProofPreview,
  handleAdminProofClearConfirm,
  handleAdminProofClear,
} from './handlers/admin/paymentProofs';

// Handlers — user profile
import {
  handleUserProfile,
  handleUserProfileEditBinance,
  handleUserProfileEditCard,
  handleProfileUpdateText,
} from './handlers/user/profile';

/**
 * Tells whoever triggered the update that the handler failed.
 *
 * A toast alone is not enough: most handlers call answerCallbackQuery() before
 * doing their real work, so by the time we get here the query is already
 * answered and the toast is rejected — which is how a failing handler ends up
 * looking like a button that does nothing at all. When the toast cannot be
 * delivered, fall back to a normal message in the chat.
 *
 * Admins additionally get the update id so a report can be matched to a log
 * line via: journalctl -u taskbot | grep "update <id>"
 */
async function reportFailure(ctx: MyContext, updateId: number): Promise<void> {
  if (ctx.callbackQuery) {
    try {
      await ctx.answerCallbackQuery({ text: GENERIC_ERROR, show_alert: true });
      return;
    } catch {
      // Already answered, or the query expired — fall through to a message.
    }
  }

  if (!ctx.chat) return;

  // The admin lookup hits the DB, which may be the very thing that just failed —
  // never let it stop the user from being told something went wrong.
  let admin = false;
  try {
    const telegramId = ctx.from?.id.toString();
    admin = !!telegramId && (await isAdmin(telegramId));
  } catch {
    // Fall back to the plain message.
  }

  try {
    await ctx.reply(admin ? GENERIC_ERROR_ADMIN(updateId) : GENERIC_ERROR, {
      parse_mode: 'HTML',
    });
  } catch (replyErr) {
    // User blocked the bot, or the chat is gone — nothing more we can do.
    console.error('[reportFailure] could not notify user', replyErr);
  }
}

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
  bot.command('ban', adminOnly, handleBanCommand);
  bot.command('unban', adminOnly, handleUnbanCommand);

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
  bot.callbackQuery(/^admin:tasks:page:([^:]+):(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskPageCallback(ctx, ctx.match[1] as TaskCategoryFilter, parseInt(ctx.match[2], 10)),
  );
  bot.callbackQuery('admin:tasks:noop', adminOnly, (ctx) => ctx.answerCallbackQuery());
  bot.callbackQuery('admin:task:create', adminOnly, handleAdminTaskCreate);
  bot.callbackQuery('admin:task:category:report_app', adminOnly, (ctx) =>
    handleAdminTaskCategorySelect(ctx, 'report_app'),
  );
  bot.callbackQuery('admin:task:category:download_app', adminOnly, (ctx) =>
    handleAdminTaskCategorySelect(ctx, 'download_app'),
  );
  bot.callbackQuery('admin:task:category:install_by_key', adminOnly, (ctx) =>
    handleAdminTaskCategorySelect(ctx, 'install_by_key'),
  );
  bot.callbackQuery('admin:task:category:none', adminOnly, (ctx) =>
    handleAdminTaskCategorySelect(ctx, null),
  );
  bot.callbackQuery('admin:task:skip_desc', adminOnly, handleAdminTaskSkipDesc);
  bot.callbackQuery('admin:task:skip_expiry', adminOnly, handleAdminTaskSkipExpiry);
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
  bot.callbackQuery('admin:task:search', adminOnly, handleAdminTaskSearch);

  // ── Admin report callbacks ───────────────────────────────────────────────
  bot.callbackQuery('admin:reports', adminOnly, handleAdminReportList);
  bot.callbackQuery(/^admin:reports:page:(\d+)$/, adminOnly, (ctx) =>
    handleAdminReportPageCallback(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery('admin:reports:noop', adminOnly, (ctx) => ctx.answerCallbackQuery());

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
  bot.callbackQuery(/^admin:user_reports:(\d+)$/, adminOnly, (ctx) =>
    handleAdminUserReportList(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:report:approve_all:(\d+)$/, adminOnly, (ctx) =>
    handleAdminApproveAllUserReports(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:report:approve_cat:(\d+):(.+)$/, adminOnly, (ctx) =>
    handleAdminApproveUserReportsByCategory(ctx, ctx.match[1], ctx.match[2]),
  );

  // ── Admin payout callbacks ───────────────────────────────────────────────
  bot.callbackQuery('admin:payouts', adminOnly, handleAdminPayoutQueue);

  bot.callbackQuery('admin:payout:noop', adminOnly, (ctx) => ctx.answerCallbackQuery());

  // Page is optional so the 2-part form still works in messages already sent
  // to admins before this was deployed.
  bot.callbackQuery(/^admin:payout:view:(\d+)(?::(\d+))?$/, adminOnly, (ctx) =>
    handleAdminPayoutView(
      ctx,
      parseInt(ctx.match[1], 10),
      ctx.match[2] ? parseInt(ctx.match[2], 10) : 0,
    ),
  );
  bot.callbackQuery(/^admin:payout:confirm:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutConfirm(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:mark_paid:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutMarkPaid(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:proof_skip:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutProofSkip(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:payout:show_card:(\d+)$/, adminOnly, (ctx) =>
    handleAdminPayoutShowCard(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── Admin task media callbacks ───────────────────────────────────────────────
  bot.callbackQuery(/^admin:task:media:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskMedia(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:media:upload:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskMediaStartUpload(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery('admin:task:media:done', adminOnly, handleAdminTaskMediaDone);
  bot.callbackQuery(/^admin:task:media:preview:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskMediaPreview(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:media:clear_confirm:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskMediaClearConfirm(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^admin:task:media:clear:(\d+)$/, adminOnly, (ctx) =>
    handleAdminTaskMediaClear(ctx, parseInt(ctx.match[1], 10)),
  );

  // ── Admin report example callbacks ──────────────────────────────────────
  bot.callbackQuery('admin:rex', adminOnly, handleAdminReportExampleList);
  bot.callbackQuery(/^admin:rex:cat:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleView(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:create:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleCreate(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:comment:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleCommentAsk(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:media:upload:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleMediaStartUpload(ctx, ctx.match[1]),
  );
  bot.callbackQuery('admin:rex:media:done', adminOnly, handleAdminReportExampleMediaDone);
  bot.callbackQuery(/^admin:rex:media:preview:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleMediaPreview(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:media:clear_confirm:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleMediaClearConfirm(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:media:clear:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleMediaClear(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:media:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleMedia(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:delete_confirm:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleDeleteConfirm(ctx, ctx.match[1]),
  );
  bot.callbackQuery(/^admin:rex:delete:(.+)$/, adminOnly, (ctx) =>
    handleAdminReportExampleDelete(ctx, ctx.match[1]),
  );

  // ── User task callbacks ──────────────────────────────────────────────────
  bot.callbackQuery('user:menu', handleUserMenu);
  bot.callbackQuery('user:tasks', handleUserTaskList);
  bot.callbackQuery(/^user:tasks:page:([^:]+):(\d+)$/, (ctx) =>
    handleUserTaskPageCallback(ctx, ctx.match[1] as TaskCategoryFilter, parseInt(ctx.match[2], 10)),
  );
  bot.callbackQuery('user:tasks:noop', (ctx) => ctx.answerCallbackQuery());
  bot.callbackQuery('user:my_tasks', handleUserMyTasks);

  bot.callbackQuery(/^user:task:view:(\d+)$/, (ctx) =>
    handleUserTaskView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^user:task:claim:(\d+)$/, (ctx) =>
    handleUserTaskClaim(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^user:assignment:view:(\d+)$/, (ctx) =>
    handleUserAssignmentView(ctx, parseInt(ctx.match[1], 10)),
  );
  bot.callbackQuery(/^user:task:help:(\d+)$/, (ctx) =>
    handleUserTaskHelp(ctx, parseInt(ctx.match[1], 10)),
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
  bot.callbackQuery('user:balance:noop', (ctx) => ctx.answerCallbackQuery());
  bot.callbackQuery(/^user:balance:(\d+)$/, (ctx) =>
    handleUserBalance(ctx, parseInt(ctx.match[1], 10)),
  );
  // Wrapped, not passed directly — grammY hands middleware `next` as the 2nd arg.
  bot.callbackQuery('user:balance', (ctx) => handleUserBalance(ctx));

  // ── User proofs gallery ──────────────────────────────────────────────────
  bot.callbackQuery('user:proofs', handleUserProofGallery);

  // ── Admin payment proofs ─────────────────────────────────────────────────
  bot.callbackQuery('admin:proofs', adminOnly, handleAdminProofList);
  bot.callbackQuery('admin:proofs:upload', adminOnly, handleAdminProofUpload);
  bot.callbackQuery('admin:proofs:done', adminOnly, handleAdminProofDone);
  bot.callbackQuery('admin:proofs:preview', adminOnly, handleAdminProofPreview);
  bot.callbackQuery('admin:proofs:clear_confirm', adminOnly, handleAdminProofClearConfirm);
  bot.callbackQuery('admin:proofs:clear', adminOnly, handleAdminProofClear);

  // ── User profile ─────────────────────────────────────────────────────────
  bot.callbackQuery('user:profile', handleUserProfile);
  bot.callbackQuery('user:profile:edit_binance', handleUserProfileEditBinance);
  bot.callbackQuery('user:profile:edit_card', handleUserProfileEditCard);

  // ── Media handlers ────────────────────────────────────────────────────────
  bot.on('message:photo', async (ctx) => {
    if (ctx.session.reportStep === 'awaiting_media') {
      await handleReportPhoto(ctx);
    } else if (ctx.session.taskMediaStep === 'awaiting_media') {
      await handleTaskMediaPhoto(ctx);
    } else if (ctx.session.reportExampleMediaStep === 'awaiting_media') {
      await handleReportExampleMediaPhoto(ctx);
    } else if (ctx.session.pendingPayoutUserId) {
      await handleAdminPayoutProofPhoto(ctx);
    } else if (ctx.session.adminProofUploadStep === 'awaiting_proof_photo') {
      await handleAdminProofPhoto(ctx);
    }
  });

  bot.on('message:video', async (ctx) => {
    if (ctx.session.reportStep === 'awaiting_media') {
      await handleReportVideo(ctx);
    } else if (ctx.session.taskMediaStep === 'awaiting_media') {
      await handleTaskMediaVideo(ctx);
    } else if (ctx.session.reportExampleMediaStep === 'awaiting_media') {
      await handleReportExampleMediaVideo(ctx);
    }
  });

  // ── Text message router ──────────────────────────────────────────────────
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    const telegramId = ctx.from?.id.toString() ?? '';

    // User registration flow
    if (ctx.session.step !== 'idle') {
      await handleRegistrationText(ctx);
      return;
    }

    // User profile payment update flow
    if (ctx.session.paymentEditStep) {
      await handleProfileUpdateText(ctx);
      return;
    }

    // Admin task creation flow (checked before other admin flows to prevent
    // stale session state from hijacking text input mid-creation)
    if (ctx.session.taskStep && (await isAdmin(telegramId))) {
      await handleTaskCreationText(ctx);
      return;
    }

    // Admin task search flow
    if (ctx.session.adminTaskSearchStep && (await isAdmin(telegramId))) {
      await handleAdminTaskSearchText(ctx);
      return;
    }

    // Admin reject comment flow
    if (ctx.session.adminRejectReportId && (await isAdmin(telegramId))) {
      await handleAdminRejectCommentText(ctx, ctx.session.adminRejectReportId);
      return;
    }

    // Admin report example comment flow
    if (ctx.session.reportExampleCommentId && (await isAdmin(telegramId))) {
      await handleAdminReportExampleCommentText(ctx);
      return;
    }
  });

  // ── Error handler ────────────────────────────────────────────────────────
  bot.catch(async (err) => {
    if (err.error instanceof GrammyError) {
      const desc = err.error.description;
      // Double-click or webhook retry delivered the same update twice — harmless
      if (desc.includes('message is not modified')) return;
      if (desc.includes('query is too old')) return;
    }
    console.error(`[update ${err.ctx.update.update_id}]`, err.error);
    await reportFailure(err.ctx, err.ctx.update.update_id);
  });

  // Safety net — prevent any stray unhandled rejections from killing the process
  process.on('unhandledRejection', (reason) => {
    // Unhandled rejections from grammY arrive as BotError wrapping a GrammyError
    const gramErr =
      reason instanceof GrammyError ? reason :
      reason instanceof BotError && reason.error instanceof GrammyError ? reason.error :
      null;
    if (gramErr) {
      if (gramErr.description.includes('message is not modified')) return;
      if (gramErr.description.includes('query is too old')) return;
    }
    console.error('[unhandledRejection]', reason);
  });

  return bot;
}

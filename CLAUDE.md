# TaskBot — CLAUDE.md

## Stack

- **Runtime:** Node.js 20+ / TypeScript
- **Bot framework:** grammY
- **ORM:** Drizzle ORM + PostgreSQL
- **File storage:** Cloudflare R2 (AWS SDK v3)
- **Process manager:** systemd (production), PM2 config also present
- **Tests:** Vitest

## Project structure

```
src/
  bot/
    handlers/
      admin/
        index.ts            # /admin command, admin menu
        tasks.ts            # Task CRUD, paginated+filtered list, search by package name
        reports.ts          # Report review, bulk approve (trust factor), user-filtered list
        users.ts            # User approval, ban/unban, promote/demote
        payouts.ts          # Payout queue, mark paid, optional proof screenshot
        paymentProofs.ts    # Admin gallery: upload/preview/clear payment proof screenshots
      user/
        tasks.ts            # Browse tasks (paginated+filtered), claim, my tasks, assignment detail
        reports.ts          # Submit report (photos/video)
        balance.ts          # Balance view, payout request
        profile.ts          # View/update Binance ID and card number
        proofs.ts           # Browse public payment proofs gallery
      registration.ts
    middleware/
      approvedOnly.ts       # Global gate — blocks non-approved users
      adminOnly.ts          # Blocks non-admins
    context.ts              # MyContext type (grammY session)
    index.ts                # Bot setup, all command/callback registrations
    keyboards.ts            # All inline keyboards
  db/
    schema.ts               # Drizzle schema (all tables + enums)
    index.ts                # Drizzle client
  services/
    userService.ts          # User CRUD, admin helpers, notification tracking, getApprovedUsers
    taskService.ts          # Task CRUD, atomic slot decrement, category filter, getUserCompletedTaskIds
    reportService.ts        # Report submission, balance credit, bulk approve, getPendingReportsByUser
    payoutService.ts        # Payout queue, threshold logic, proof file ID storage
    paymentProofService.ts  # Payment proofs gallery CRUD
    taskMediaService.ts     # Task help media (photos/videos attached to tasks)
    storageService.ts       # Cloudflare R2 upload/delete/presigned URLs
    crypto.ts               # AES-256-GCM encrypt/decrypt, maskCard
  jobs/
    expireAssignments.ts    # Cron job — expires assignments every 5 min
  i18n/
    ru.ts                   # All user-facing strings (Russian)
  config.ts                 # Env var validation (throws on missing)
  index.ts                  # Entry point
drizzle/                    # Migration SQL files
```

## Database schema

Tables: `users`, `tasks`, `assignments`, `reports`, `media`, `payouts`, `task_media`, `sessions`, `admin_notifications`, `payment_proofs`

User statuses: `pending` | `approved` | `rejected` | `banned`

Assignment statuses: `claimed` | `completed` | `expired`

Report statuses: `pending` | `approved` | `rejected`

Task categories: `report_app` | `download_app` | `install_by_key` | `null` (no category)

## Admin system

Two-tier: env `ADMIN_IDS` (super-admins, bootstrap) + `is_admin` DB flag (promoted via `/promote`). Both checked in `isAdmin()` and `getAllAdminIds()`.

## Key env vars

| Var | Required | Notes |
|-----|----------|-------|
| `BOT_TOKEN` | yes | Telegram bot token |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `ENCRYPTION_KEY` | yes | 64 hex chars (AES-256-GCM for card numbers) |
| `ADMIN_IDS` | yes | Comma-separated Telegram IDs |
| `R2_ACCOUNT_ID` | yes | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | yes | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | yes | Cloudflare R2 |
| `R2_BUCKET_NAME` | yes | Cloudflare R2 |
| `WEBHOOK_URL` | no | Set for webhook mode; unset = long-polling |
| `PORT` | no | Default 3000 (webhook mode only) |

## Deployment (Hetzner, systemd)

```bash
git pull
npm install
npm run build
# Apply any pending migrations manually (drizzle-kit migrate is unreliable on server due to hash mismatch)
psql $DATABASE_URL -c "..."
sudo systemctl restart taskbot
```

**Never use `npx drizzle-kit migrate` on the server** — it fails due to migration hash mismatch. Always apply SQL manually via `psql`.

## Running tests

```bash
npm test
```

## Important patterns

- Card numbers are AES-256-GCM encrypted at rest; only the last 4 digits are ever displayed (`maskCard`)
- Slot decrement on task claim is atomic (single UPDATE with `slotsAvailable > 0`)
- Assignment expiry runs every 5 minutes via `setInterval` in `expireAssignments.ts`
- `admin_notifications` table tracks which Telegram message was sent to which admin for a pending user — used to edit/remove buttons once one admin acts
- All user-facing text lives in `src/i18n/ru.ts` — never hardcode strings in handlers
- `approvedOnly` middleware skips `/start`, `reg:*` callbacks, and mid-registration sessions
- Task list (admin + user) is paginated (10/page) with category filter tabs; callback format: `user:tasks:page:CATEGORY:PAGE` / `admin:tasks:page:CATEGORY:PAGE`
- Completed tasks are hidden from the user browse list (`getUserCompletedTaskIds` filters them out)
- Completed assignments are hidden from "My Tasks"; assignments with a pending report show `🔍 на проверке` (detected via left join on reports in `getUserAssignments`)
- When a new task is created, all approved users receive a push notification (fire-and-forget broadcast in `handleAdminTaskCreate`)
- Admin report review flow: info message is edited in place → photos sent as replies → action buttons sent as a new message at the bottom → after approve/reject, admin menu appears as a new message (no scrolling required)
- Trust factor: after approving a report, if the user has more pending reports the admin menu shows a quick-nav button; from the user report list, admin can bulk-approve all or per-category
- Photo handler chain in `index.ts`: report media → task media → report example media → payout proof (`pendingPayoutUserId`) → admin proof gallery (`adminProofUploadStep`)
- Text router priority: registration → `paymentEditStep` (user profile) → `taskStep` (admin task creation) → `adminTaskSearchStep` → `adminRejectReportId` → `reportExampleCommentId`
- When admin marks payout as paid, they can optionally attach a screenshot; if attached it is forwarded to the user alongside the payment notification
- `payment_proofs` table stores public gallery screenshots that all users can browse via "📸 Доказательства выплат" in the main menu

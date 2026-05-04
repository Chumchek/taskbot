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
      admin/        # Admin handlers: users, tasks, reports, payouts
      user/         # User handlers: tasks, reports, balance
      registration.ts
    middleware/
      approvedOnly.ts   # Global gate — blocks non-approved users
      adminOnly.ts      # Blocks non-admins
    context.ts          # MyContext type (grammY session)
    index.ts            # Bot setup, all command/callback registrations
    keyboards.ts        # All inline keyboards
  db/
    schema.ts           # Drizzle schema (all tables + enums)
    index.ts            # Drizzle client
  services/
    userService.ts      # User CRUD, admin helpers, notification tracking
    taskService.ts      # Task CRUD, atomic slot decrement
    reportService.ts    # Report submission, balance credit
    payoutService.ts    # Payout queue, threshold logic
    storageService.ts   # Cloudflare R2 upload/delete
    crypto.ts           # AES-256-GCM encrypt/decrypt, maskCard
  jobs/
    expireAssignments.ts  # Cron job — expires assignments every 5 min
  i18n/
    ru.ts               # All user-facing strings (Russian)
  config.ts             # Env var validation (throws on missing)
  index.ts              # Entry point
drizzle/                # Migration SQL files
```

## Database schema

Tables: `users`, `tasks`, `assignments`, `reports`, `media`, `payouts`, `task_media`, `sessions`, `admin_notifications`

User statuses: `pending` | `approved` | `rejected` | `banned`

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
npx drizzle-kit migrate
sudo systemctl restart taskbot
```

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

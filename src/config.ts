import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  bot: {
    token: required('BOT_TOKEN'),
  },
  db: {
    url: required('DATABASE_URL'),
  },
  encryption: {
    key: required('ENCRYPTION_KEY'),
  },
  admins: required('ADMIN_IDS').split(',').map((s) => s.trim()),
  r2: {
    accountId: required('R2_ACCOUNT_ID'),
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    bucket: required('R2_BUCKET_NAME'),
  },
  // Optional — when set, the bot runs as a webhook server instead of long-polling.
  // Railway injects PORT automatically; WEBHOOK_URL must be the public HTTPS URL.
  port: parseInt(process.env.PORT ?? '3000', 10),
  webhookUrl: process.env.WEBHOOK_URL ?? '',
};

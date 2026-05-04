CREATE TABLE "admin_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "target_telegram_id" text NOT NULL,
  "admin_chat_id" text NOT NULL,
  "message_id" integer NOT NULL
);

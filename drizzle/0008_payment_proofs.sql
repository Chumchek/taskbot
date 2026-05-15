CREATE TABLE "payment_proofs" (
  "id" serial PRIMARY KEY,
  "telegram_file_id" text NOT NULL,
  "uploaded_by" integer REFERENCES "users"("id"),
  "uploaded_at" timestamp NOT NULL DEFAULT now()
);

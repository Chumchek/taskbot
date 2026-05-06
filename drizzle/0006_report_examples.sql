CREATE TABLE "report_examples" (
  "id" serial PRIMARY KEY,
  "category_key" text NOT NULL UNIQUE,
  "comment" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE "report_example_media" (
  "id" serial PRIMARY KEY,
  "example_id" integer NOT NULL REFERENCES "report_examples"("id") ON DELETE CASCADE,
  "storage_key" text NOT NULL,
  "telegram_file_id" text,
  "file_type" text NOT NULL,
  "file_size" integer,
  "uploaded_at" timestamp NOT NULL DEFAULT now()
);

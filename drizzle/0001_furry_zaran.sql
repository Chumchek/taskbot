CREATE TABLE "task_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"storage_key" text NOT NULL,
	"telegram_file_id" text,
	"file_type" text NOT NULL,
	"file_size" integer,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_media" ADD CONSTRAINT "task_media_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;
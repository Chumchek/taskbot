CREATE TYPE "public"."task_category" AS ENUM('report_app', 'download_app', 'install_by_key');
ALTER TABLE "tasks" ADD COLUMN "category" "task_category";
ALTER TABLE "tasks" ADD COLUMN "package_name" text;

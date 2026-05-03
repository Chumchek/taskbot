import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['pending', 'approved', 'rejected']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['claimed', 'completed', 'expired']);
export const reportStatusEnum = pgEnum('report_status', ['pending', 'approved', 'rejected']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  binanceId: text('binance_id'),
  cardEncrypted: text('card_encrypted'),
  balance: decimal('balance', { precision: 10, scale: 2 }).notNull().default('0'),
  isAdmin: boolean('is_admin').notNull().default(false),
  status: userStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  link: text('link').notNull(),
  priceUah: decimal('price_uah', { precision: 10, scale: 2 }).notNull(),
  slotsTotal: integer('slots_total').notNull(),
  slotsAvailable: integer('slots_available').notNull(),
  deadlineHours: integer('deadline_hours').notNull().default(24),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const assignments = pgTable(
  'assignments',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    taskId: integer('task_id')
      .notNull()
      .references(() => tasks.id),
    status: assignmentStatusEnum('status').notNull().default('claimed'),
    assignedAt: timestamp('assigned_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    expiresAt: timestamp('expires_at'),
  },
  (t) => ({
    uniqUserTask: unique('uniq_user_task').on(t.userId, t.taskId),
  }),
);

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  assignmentId: integer('assignment_id')
    .notNull()
    .references(() => assignments.id),
  status: reportStatusEnum('status').notNull().default('pending'),
  adminComment: text('admin_comment'),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
});

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id')
    .notNull()
    .references(() => reports.id),
  storageKey: text('storage_key').notNull(),
  telegramFileId: text('telegram_file_id'),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  checksum: text('checksum'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});

export const payouts = pgTable('payouts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  processedBy: integer('processed_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  paidAt: timestamp('paid_at'),
});

export const taskMedia = pgTable('task_media', {
  id: serial('id').primaryKey(),
  taskId: integer('task_id').notNull().references(() => tasks.id),
  storageKey: text('storage_key').notNull(),
  telegramFileId: text('telegram_file_id'),
  fileType: text('file_type').notNull(),
  fileSize: integer('file_size'),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
});

// Bot session persistence (replaces in-memory storage)
export const sessions = pgTable('sessions', {
  key: text('key').primaryKey(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

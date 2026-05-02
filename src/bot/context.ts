import { Context, SessionFlavor } from 'grammy';

export type RegistrationStep = 'idle' | 'awaiting_binance' | 'awaiting_card';

export type TaskCreationStep =
  | 'awaiting_title'
  | 'awaiting_description'
  | 'awaiting_link'
  | 'awaiting_price'
  | 'awaiting_slots'
  | 'confirming';

export type ReportStep = 'awaiting_media';

export interface PendingTask {
  title?: string;
  description?: string;
  link?: string;
  priceUah?: string;
  slotsTotal?: number;
}

export interface PendingReportFile {
  telegramFileId: string;
  fileType: 'photo' | 'video';
  fileSize?: number;
  storageKey: string;
  checksum: string;
}

export interface PendingReport {
  assignmentId: number;
  taskId: number;
  taskTitle: string;
  files: PendingReportFile[];
  promptMsgId?: number;
}

export interface SessionData {
  // User registration flow
  step: RegistrationStep;
  pendingBinanceId?: string;

  // Admin task creation flow
  taskStep?: TaskCreationStep;
  pendingTask?: PendingTask;

  // User report submission flow
  reportStep?: ReportStep;
  pendingReport?: PendingReport;

  // Admin report rejection flow (awaiting comment text)
  adminRejectReportId?: number;
}

export type MyContext = Context & SessionFlavor<SessionData>;

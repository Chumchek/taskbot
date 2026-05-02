import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { config } from '../config';

const s3 = new S3Client({
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  region: 'auto',
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<{ checksum: string }> {
  const checksum = createHash('sha256').update(buffer).digest('hex');

  await s3.send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: { checksum },
    }),
  );

  return { checksum };
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.r2.bucket, Key: key }),
    { expiresIn },
  );
}

export async function deleteFile(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.r2.bucket, Key: key }));
}

// Downloads a file from Telegram's CDN given the file_path returned by getFile().
export async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${config.bot.token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

// Generates a unique R2 object key for a media file.
export function makeStorageKey(
  telegramUserId: string,
  taskId: number,
  ext: string,
): string {
  const ts = Date.now();
  const rnd = Math.random().toString(36).slice(2, 7);
  return `reports/${telegramUserId}/${taskId}/${ts}_${rnd}.${ext}`;
}

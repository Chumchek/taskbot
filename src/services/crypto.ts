import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const key = Buffer.from(config.encryption.key, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

export function decrypt(data: string): string {
  const [ivHex, authTagHex, encryptedHex] = data.split(':');
  const key = Buffer.from(config.encryption.key, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskCard(card: string): string {
  const digits = card.replace(/\s/g, '');
  return `**** **** **** ${digits.slice(-4)}`;
}

/**
 * Masks an encrypted card without throwing. `decrypt` fails on malformed
 * ciphertext or a rotated ENCRYPTION_KEY, and an uncaught throw inside a
 * message builder kills the whole handler — the user just sees a dead button.
 */
export function safeMaskCard(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  try {
    return maskCard(decrypt(encrypted));
  } catch (err) {
    console.error('[crypto] failed to decrypt card', err);
    return null;
  }
}

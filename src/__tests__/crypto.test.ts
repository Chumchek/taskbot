import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../config', () => ({
  config: {
    encryption: {
      key: '0'.repeat(64), // 32 zero-bytes in hex = valid AES-256 key
    },
  },
}));

let encrypt: (text: string) => string;
let decrypt: (data: string) => string;
let maskCard: (card: string) => string;

beforeAll(async () => {
  const mod = await import('../services/crypto');
  encrypt = mod.encrypt;
  decrypt = mod.decrypt;
  maskCard = mod.maskCard;
});

describe('encrypt / decrypt', () => {
  it('round-trips a plain string', () => {
    const plaintext = '4111111111111111';
    expect(decrypt(encrypt(plaintext))).toBe(plaintext);
  });

  it('produces different ciphertext on each call (random IV)', () => {
    const a = encrypt('hello');
    const b = encrypt('hello');
    expect(a).not.toBe(b);
  });

  it('encrypted format is iv:authTag:ciphertext', () => {
    const parts = encrypt('test').split(':');
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toMatch(/^[0-9a-f]+$/);
  });
});

describe('maskCard', () => {
  it('masks all but the last 4 digits', () => {
    expect(maskCard('4111 1111 1111 1234')).toBe('**** **** **** 1234');
  });

  it('works without spaces', () => {
    expect(maskCard('4111111111111234')).toBe('**** **** **** 1234');
  });
});

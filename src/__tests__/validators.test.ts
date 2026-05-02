import { describe, it, expect } from 'vitest';
import { isValidUrl, isValidPrice, isValidSlots } from '../utils/validators';

describe('isValidUrl', () => {
  it('accepts https URLs', () => expect(isValidUrl('https://example.com')).toBe(true));
  it('accepts http URLs', () => expect(isValidUrl('http://example.com/path?q=1')).toBe(true));
  it('rejects plain text', () => expect(isValidUrl('not a url')).toBe(false));
  it('rejects ftp scheme', () => expect(isValidUrl('ftp://example.com')).toBe(false));
  it('rejects empty string', () => expect(isValidUrl('')).toBe(false));
});

describe('isValidPrice', () => {
  it('accepts integer prices', () => expect(isValidPrice('50')).toBe(true));
  it('accepts two-decimal prices', () => expect(isValidPrice('75.50')).toBe(true));
  it('accepts one-decimal prices', () => expect(isValidPrice('10.5')).toBe(true));
  it('rejects zero', () => expect(isValidPrice('0')).toBe(false));
  it('rejects negative', () => expect(isValidPrice('-10')).toBe(false));
  it('rejects three decimals', () => expect(isValidPrice('10.123')).toBe(false));
  it('rejects non-numeric', () => expect(isValidPrice('abc')).toBe(false));
  it('rejects empty string', () => expect(isValidPrice('')).toBe(false));
});

describe('isValidSlots', () => {
  it('accepts 1', () => expect(isValidSlots('1')).toBe(true));
  it('accepts 1000', () => expect(isValidSlots('1000')).toBe(true));
  it('accepts mid-range value', () => expect(isValidSlots('25')).toBe(true));
  it('rejects 0', () => expect(isValidSlots('0')).toBe(false));
  it('rejects 1001', () => expect(isValidSlots('1001')).toBe(false));
  it('rejects negative', () => expect(isValidSlots('-5')).toBe(false));
  it('rejects non-integer', () => expect(isValidSlots('abc')).toBe(false));
  it('rejects float', () => expect(isValidSlots('2.5')).toBe(false));
});

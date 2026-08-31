import { describe, expect, it } from 'vitest';
import { buildBoundedList, escapeHtml, escapeOptional, truncate } from '../utils/html';

describe('escapeHtml', () => {
  it('escapes the three characters Telegram chokes on', () => {
    expect(escapeHtml('<b>a & b</b>')).toBe('&lt;b&gt;a &amp; b&lt;/b&gt;');
  });

  it('escapes & first so entities are not double-encoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('returns an empty string for null / undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('truncate', () => {
  it('leaves short values alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('appends an ellipsis when over the limit', () => {
    expect(truncate('abcdefghij', 4)).toBe('abcd…');
  });
});

describe('escapeOptional', () => {
  it('preserves null so i18n templates can omit the field', () => {
    expect(escapeOptional(null)).toBeNull();
  });

  it('escapes and truncates together', () => {
    expect(escapeOptional('<<<<<<', 3)).toBe('&lt;&lt;&lt;…');
  });
});

describe('buildBoundedList', () => {
  const rows = Array.from({ length: 100 }, (_, i) => `item-${i}`);

  it('caps by row count and reports the remainder', () => {
    const out = buildBoundedList(rows, (r) => `• ${r}`, { maxRows: 3, budget: 10_000 });
    expect(out.split('\n')).toEqual(['• item-0', '• item-1', '• item-2', '<i>…и ещё 97</i>']);
  });

  it('caps by character budget', () => {
    const out = buildBoundedList(rows, (r) => `• ${r}`, { maxRows: 1000, budget: 30 });
    expect(out.length).toBeLessThan(60);
    expect(out).toContain('…и ещё');
  });

  it('keeps a full short list intact with no remainder line', () => {
    const out = buildBoundedList(['a', 'b'], (r) => r);
    expect(out).toBe('a\nb');
  });

  it('stays under the Telegram limit for a pathological list', () => {
    const long = Array.from({ length: 500 }, () => 'x'.repeat(200));
    const out = buildBoundedList(long, (r) => `• ${r}`);
    expect(out.length).toBeLessThan(4096);
  });

  it('handles an empty list', () => {
    expect(buildBoundedList([], (r) => String(r))).toBe('');
  });
});

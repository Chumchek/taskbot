import { LIST_TRUNCATED } from '../i18n/ru';

/**
 * Escape text for Telegram `parse_mode: 'HTML'`.
 *
 * Telegram rejects the whole sendMessage/editMessageText call with
 * "Bad Request: can't parse entities" if an unescaped `<`, `>` or `&` appears
 * in the text — which silently kills the handler. Any value that comes from
 * user input (names, task titles, package names) must go through this.
 */
export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Telegram rejects any message over 4096 characters with MESSAGE_TOO_LONG,
 * which aborts the handler and leaves the user staring at a control that did
 * nothing. Any list built from an unbounded number of rows — or from unbounded
 * `text` columns such as `tasks.title` — must go through this.
 *
 * Rows are rendered until either `maxRows` or `budget` characters is reached;
 * the remainder is summarised via LIST_TRUNCATED. `render` is responsible for
 * escaping its own output.
 */
export function buildBoundedList<T>(
  items: readonly T[],
  render: (item: T) => string,
  { budget = 2800, maxRows = 25 }: { budget?: number; maxRows?: number } = {},
): string {
  const lines: string[] = [];
  let used = 0;

  for (const item of items) {
    if (lines.length >= maxRows) break;

    const line = render(item);
    if (used + line.length > budget) break;

    lines.push(line);
    used += line.length + 1; // +1 for the newline
  }

  const hidden = items.length - lines.length;
  if (hidden > 0) {
    lines.push(LIST_TRUNCATED(hidden));
  }

  return lines.join('\n');
}

/** Truncates unbounded DB text so a single long value cannot dominate a message. */
export function truncate(value: string, max = 80): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Null-safe escape + optional truncation, for nullable DB columns passed
 * straight into an i18n template (task descriptions, package names, links).
 */
export function escapeOptional(
  value: string | null | undefined,
  max?: number,
): string | null {
  if (value == null) return null;
  return escapeHtml(max === undefined ? value : truncate(value, max));
}

/** Task descriptions are unbounded admin-authored text — keep them readable but capped. */
export const MAX_DESCRIPTION = 1500;

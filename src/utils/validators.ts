export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidPrice(value: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(value) && parseFloat(value) > 0;
}

export function isValidSlots(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const n = parseInt(value, 10);
  return n > 0 && n <= 1000;
}

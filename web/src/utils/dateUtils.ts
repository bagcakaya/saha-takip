/**
 * Safely parses any date/time string format into a valid Date object.
 * Supports:
 * - HTML5 datetime-local: "YYYY-MM-DDTHH:mm"
 * - Turkish mobile format: "DD.MM.YYYY HH:mm" or "DD.MM.YYYY"
 * - Slash format: "DD/MM/YYYY HH:mm" or "YYYY/MM/DD HH:mm"
 * - ISO 8601: "2026-09-19T14:30:00.000Z"
 * - Millisecond timestamp: number / numeric string
 */
export function parseDueDateTime(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const str = String(value).trim();
  if (!str) return null;

  // Numeric string timestamp
  if (/^\d{10,13}$/.test(str)) {
    const d = new Date(Number(str));
    if (!isNaN(d.getTime())) return d;
  }

  // 1. Direct standard parse if no dot present
  if (!str.includes('.')) {
    const directDate = new Date(str);
    if (!isNaN(directDate.getTime())) {
      return directDate;
    }
  }

  // 2. Turkish dot format: "DD.MM.YYYY HH:mm[:ss]" or "DD.MM.YYYY"
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    const year = parseInt(dotMatch[3], 10);
    const hours = dotMatch[4] ? parseInt(dotMatch[4], 10) : 0;
    const minutes = dotMatch[5] ? parseInt(dotMatch[5], 10) : 0;
    const seconds = dotMatch[6] ? parseInt(dotMatch[6], 10) : 0;
    const parsed = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // 3. Fallback direct Date parse
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/** IANA time zone helpers built on Intl (DST-correct). */
import tzlookup from '@photostructure/tz-lookup';

export function guessTimeZone(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  return f;
}

export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function wallClock(utcMs: number, tz: string): WallClock {
  const parts = partsFormatter(tz).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

/** Offset of the zone from UTC in minutes at a given instant (e.g. +60 for CET). */
export function tzOffsetMinutes(utcMs: number, tz: string): number {
  const w = wallClock(utcMs, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

/** UTC instant of a local wall-clock time in a zone. */
export function zonedToUtcMs(year: number, month: number, day: number, hour: number, minute: number, tz: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let ms = guess - tzOffsetMinutes(guess, tz) * 60000;
  ms = guess - tzOffsetMinutes(ms, tz) * 60000;
  return ms;
}

/** "YYYY-MM-DD" of the local date at an instant. */
export function localDateString(utcMs: number, tz: string): string {
  const w = wallClock(utcMs, tz);
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function formatTime(utcMs: number, tz: string | 'UTC', withSeconds = false): string {
  const w = wallClock(utcMs, tz);
  const hm = `${String(w.hour).padStart(2, '0')}:${String(w.minute).padStart(2, '0')}`;
  return withSeconds ? `${hm}:${String(w.second).padStart(2, '0')}` : hm;
}

export function formatDateTime(utcMs: number, tz: string | 'UTC'): string {
  return `${localDateString(utcMs, tz)} ${formatTime(utcMs, tz)}`;
}

/** Short zone label such as "CET" or "GMT+1". */
export function zoneAbbreviation(utcMs: number, tz: string): string {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date(utcMs));
    return p.find((x) => x.type === 'timeZoneName')?.value ?? tz;
  } catch {
    return tz;
  }
}

export function listTimeZones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  return intl.supportedValuesOf ? intl.supportedValuesOf('timeZone') : ['UTC'];
}

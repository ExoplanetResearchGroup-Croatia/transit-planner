/**
 * Per-night darkness windows. A "night" runs from local noon of its date to
 * local noon of the next day. The Sun's altitude is sampled every 5 minutes and
 * threshold crossings are interpolated linearly (error well under 30 s), which
 * also handles polar day/night without special cases.
 */
import { Body, Illumination } from 'astronomy-engine';
import { makeObserver, moonPosition, sunAltitude, type SiteCoords } from './coords';
import { addDays, zonedToUtcMs } from './tz';

export type DarknessDefinition = 'astronomical' | 'nautical' | 'civil';
export const DARKNESS_ALTITUDE: Record<DarknessDefinition, number> = { astronomical: -18, nautical: -12, civil: -6 };
const SUNSET_ALT = -0.833;
const STEP_MIN = 5;

export interface NightSummary {
  /** local date of the evening, YYYY-MM-DD */
  date: string;
  startMs: number;
  endMs: number;
  sunset: number | null;
  sunrise: number | null;
  civilDusk: number | null;
  civilDawn: number | null;
  nauticalDusk: number | null;
  nauticalDawn: number | null;
  astroDusk: number | null;
  astroDawn: number | null;
  /** intervals with the Sun below the chosen darkness threshold */
  darkSegments: [number, number][];
  /** main (longest) dark interval */
  darkStart: number | null;
  darkEnd: number | null;
  darkMinutes: number;
  status: 'ok' | 'no-darkness' | 'continuous-darkness';
  /** Moon illuminated fraction at the middle of the night (0..1) */
  moonIllum: number;
  /** samples every stepMin minutes from startMs */
  stepMin: number;
  sunAlt: number[];
  moonAlt: number[];
}

function crossings(t: number[], alt: number[], level: number): { down: number[]; up: number[] } {
  const down: number[] = [];
  const up: number[] = [];
  for (let i = 1; i < alt.length; i++) {
    const a = alt[i - 1] - level;
    const b = alt[i] - level;
    if (a >= 0 && b < 0) down.push(t[i - 1] + (t[i] - t[i - 1]) * (a / (a - b)));
    else if (a < 0 && b >= 0) up.push(t[i - 1] + (t[i] - t[i - 1]) * (-a / (b - a)));
  }
  return { down, up };
}

function segmentsBelow(t: number[], alt: number[], level: number): [number, number][] {
  const segs: [number, number][] = [];
  const { down, up } = crossings(t, alt, level);
  const events = [...down.map((x) => ({ x, d: true })), ...up.map((x) => ({ x, d: false }))].sort((a, b) => a.x - b.x);
  let start: number | null = alt[0] < level ? t[0] : null;
  for (const e of events) {
    if (e.d) start = e.x;
    else if (start !== null) {
      segs.push([start, e.x]);
      start = null;
    }
  }
  if (start !== null) segs.push([start, t[t.length - 1]]);
  return segs;
}

export function computeNight(site: SiteCoords & { tz: string }, date: string, definition: DarknessDefinition): NightSummary {
  const [y, m, d] = date.split('-').map(Number);
  const startMs = zonedToUtcMs(y, m, d, 12, 0, site.tz);
  const [y2, m2, d2] = addDays(date, 1).split('-').map(Number);
  const endMs = zonedToUtcMs(y2, m2, d2, 12, 0, site.tz);
  const obs = makeObserver(site);

  const t: number[] = [];
  const sun: number[] = [];
  const moon: number[] = [];
  for (let ms = startMs; ms <= endMs + 1; ms += STEP_MIN * 60000) {
    t.push(ms);
    sun.push(sunAltitude(ms, obs));
    moon.push(moonPosition(ms, obs).alt);
  }

  const first = (arr: number[]) => (arr.length ? arr[0] : null);
  const last = (arr: number[]) => (arr.length ? arr[arr.length - 1] : null);
  const c = (level: number) => crossings(t, sun, level);
  const ss = c(SUNSET_ALT);
  const cv = c(-6);
  const nt = c(-12);
  const as = c(-18);

  const level = DARKNESS_ALTITUDE[definition];
  const darkSegments = segmentsBelow(t, sun, level);
  let darkStart: number | null = null;
  let darkEnd: number | null = null;
  let darkMinutes = 0;
  for (const [a, b] of darkSegments) {
    darkMinutes += (b - a) / 60000;
    if (darkStart === null || b - a > darkEnd! - darkStart) {
      darkStart = a;
      darkEnd = b;
    }
  }
  const status: NightSummary['status'] =
    darkSegments.length === 0 ? 'no-darkness' : sun.every((a) => a < level) ? 'continuous-darkness' : 'ok';

  const mid = darkStart !== null ? (darkStart + darkEnd!) / 2 : (startMs + endMs) / 2;
  const moonIllum = Illumination(Body.Moon, new Date(mid)).phase_fraction;

  return {
    date,
    startMs,
    endMs,
    sunset: first(ss.down),
    sunrise: last(ss.up),
    civilDusk: first(cv.down),
    civilDawn: last(cv.up),
    nauticalDusk: first(nt.down),
    nauticalDawn: last(nt.up),
    astroDusk: first(as.down),
    astroDawn: last(as.up),
    darkSegments,
    darkStart,
    darkEnd,
    darkMinutes,
    status,
    moonIllum,
    stepMin: STEP_MIN,
    sunAlt: sun.map((v) => Math.round(v * 100) / 100),
    moonAlt: moon.map((v) => Math.round(v * 100) / 100),
  };
}

export function computeNights(site: SiteCoords & { tz: string }, firstDate: string, count: number, definition: DarknessDefinition): NightSummary[] {
  return Array.from({ length: count }, (_, i) => computeNight(site, addDays(firstDate, i), definition));
}

export function isDark(nights: NightSummary[], ms: number): boolean {
  for (const n of nights) {
    if (ms < n.startMs || ms > n.endMs) continue;
    for (const [a, b] of n.darkSegments) if (ms >= a && ms <= b) return true;
    return false;
  }
  return false;
}

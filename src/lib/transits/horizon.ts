import type { HorizonPoint } from './types';

/** Minimum altitude of the local horizon at an azimuth (linear interpolation, wraps at 360°). */
export function horizonAltitude(profile: HorizonPoint[], az: number): number {
  if (profile.length === 0) return 0;
  if (profile.length === 1) return profile[0].alt;
  const pts = [...profile].sort((a, b) => a.az - b.az);
  const a = ((az % 360) + 360) % 360;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const qAz = i + 1 < pts.length ? q.az : q.az + 360;
    const aa = a < p.az ? a + 360 : a;
    if (aa >= p.az && aa <= qAz) {
      const f = qAz === p.az ? 0 : (aa - p.az) / (qAz - p.az);
      return p.alt + f * (q.alt - p.alt);
    }
  }
  return pts[0].alt;
}

/**
 * Parse a horizon CSV: one "azimuth,altitude" pair per line (degrees). Header
 * lines, comments (#) and blank lines are ignored; ';' or whitespace also work
 * as separators.
 */
export function parseHorizonCsv(text: string): { points: HorizonPoint[]; errors: string[] } {
  const points: HorizonPoint[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const parts = line.split(/[,;\s]+/).filter(Boolean);
    const az = Number(parts[0]);
    const alt = Number(parts[1]);
    if (parts.length < 2 || !Number.isFinite(az) || !Number.isFinite(alt)) {
      if (points.length === 0 && i < 2) return; // header
      errors.push(`line ${i + 1}: expected "azimuth,altitude"`);
      return;
    }
    if (az < 0 || az > 360) errors.push(`line ${i + 1}: azimuth ${az} outside 0–360`);
    else if (alt < -5 || alt > 90) errors.push(`line ${i + 1}: altitude ${alt} outside −5–90`);
    else points.push({ az: az % 360, alt });
  });
  points.sort((a, b) => a.az - b.az);
  return { points, errors };
}

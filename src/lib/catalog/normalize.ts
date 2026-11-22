/**
 * Normalization of upstream records into Target, and merging of sources.
 * Pure functions: used by scripts/build-catalog.ts and by the tests.
 */
import type { CatalogFile, CatalogSourceInfo, ExoClockPriority, Target } from './types';
import { CATALOG_FIELDS } from './types';

/** "55 Cnc e" / "55Cnce" -> "55cnce"; "WASP-12 b" / "WASP-12b" -> "wasp-12b" */
export function normName(s: string): string {
  return s.toLowerCase().replace(/[\s_]+/g, '');
}

/** "08:52:35.8113" (hours) or "+28:19:50.956" (degrees) -> decimal */
export function parseSexagesimal(s: string): number {
  const t = s.trim();
  const sign = t.startsWith('-') ? -1 : 1;
  const [a, b = '0', c = '0'] = t.replace(/^[+-]/, '').split(/[:\s]+/);
  return sign * (Number(a) + Number(b) / 60 + Number(c) / 3600);
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const symErr = (e1: unknown, e2: unknown): number | null => {
  const a = num(e1);
  const b = num(e2);
  if (a === null && b === null) return null;
  const m = Math.max(Math.abs(a ?? 0), Math.abs(b ?? 0));
  return m > 0 ? m : null;
};

/** Transit depth in ppt from a depth in mmag: 1 - 10^(-0.4 * mag) */
export function mmagToPpt(mmag: number): number {
  return (1 - 10 ** (-0.4 * (mmag / 1000))) * 1000;
}

/** "<a refstr=X href=https://... target=ref> Rowe et al. 2014</a>" -> "Rowe et al. 2014" */
export function parseRefLink(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  const text = s.replace(/<[^>]*>/g, '').trim();
  return text || null;
}

const R_EARTH_PER_R_SUN = 0.0091577;

export type Reject = { reason: string };

function finalize(t: Omit<Target, 'id'>): Target | Reject {
  if (!Number.isFinite(t.ra) || !Number.isFinite(t.dec)) return { reason: 'missing coordinates' };
  if (!Number.isFinite(t.t0) || t.t0 < 2400000) return { reason: 'missing or invalid T0' };
  if (!Number.isFinite(t.period) || t.period <= 0) return { reason: 'missing period' };
  if (!Number.isFinite(t.durationH) || t.durationH <= 0) return { reason: 'missing duration' };
  if (!Number.isFinite(t.depthPpt) || t.depthPpt <= 0) return { reason: 'missing depth' };
  return { id: normName(t.name), ...t };
}

export const isReject = (x: Target | Reject): x is Reject => 'reason' in x;

/** Row from NASA Exoplanet Archive table pscomppars (tran_flag = 1). */
export function fromNasa(r: Record<string, unknown>): Target | Reject {
  let depth = num(r.pl_trandep);
  let depthEstimated = false;
  if (depth !== null) depth *= 10; // percent -> ppt
  else {
    const k = num(r.pl_ratror) ?? (num(r.pl_rade) && num(r.st_rad) ? (num(r.pl_rade)! * R_EARTH_PER_R_SUN) / num(r.st_rad)! : null);
    if (k !== null) {
      depth = k * k * 1000;
      depthEstimated = true;
    }
  }
  return finalize({
    name: String(r.pl_name ?? ''),
    host: (r.hostname as string) ?? null,
    ra: num(r.ra) ?? NaN,
    dec: num(r.dec) ?? NaN,
    vmag: num(r.sy_vmag),
    gmag: num(r.sy_gaiamag),
    tmag: num(r.sy_tmag),
    t0: num(r.pl_tranmid) ?? NaN,
    t0Err: symErr(r.pl_tranmiderr1, r.pl_tranmiderr2),
    period: num(r.pl_orbper) ?? NaN,
    periodErr: symErr(r.pl_orbpererr1, r.pl_orbpererr2),
    durationH: num(r.pl_trandur) ?? NaN,
    depthPpt: depth ?? NaN,
    depthEstimated,
    source: 'nasa',
    priority: null,
    ephemRef: parseRefLink(r.pl_tranmid_reflink),
    ocMin: null,
    minApertureIn: null,
    recentObs: null,
  });
}

const PRIORITIES: ExoClockPriority[] = ['alert', 'high', 'medium', 'low'];

/** Entry from https://www.exoclock.space/database/planets_json */
export function fromExoClock(e: Record<string, unknown>): Target | Reject {
  if (e.ephem_mid_time_format && e.ephem_mid_time_format !== 'BJD_TDB') return { reason: `time format ${String(e.ephem_mid_time_format)}` };
  const prio = String(e.priority ?? '').toLowerCase() as ExoClockPriority;
  const depthMmag = num(e.depth_r_mmag);
  return finalize({
    name: String(e.name ?? ''),
    host: (e.star as string) ?? null,
    ra: typeof e.ra_j2000 === 'string' ? parseSexagesimal(e.ra_j2000) * 15 : NaN,
    dec: typeof e.dec_j2000 === 'string' ? parseSexagesimal(e.dec_j2000) : NaN,
    vmag: num(e.v_mag),
    gmag: num(e.gaia_g_mag),
    tmag: null,
    t0: num(e.t0_bjd_tdb) ?? num(e.ephem_mid_time) ?? NaN,
    t0Err: num(e.t0_unc) ?? symErr(e.ephem_mid_time_e1, e.ephem_mid_time_e2),
    period: num(e.period_days) ?? num(e.ephem_period) ?? NaN,
    periodErr: num(e.period_unc) ?? symErr(e.ephem_period_e1, e.ephem_period_e2),
    durationH: num(e.duration_hours) ?? NaN,
    depthPpt: depthMmag !== null ? mmagToPpt(depthMmag) : NaN,
    depthEstimated: false,
    source: 'exoclock',
    priority: PRIORITIES.includes(prio) ? prio : null,
    ephemRef: typeof e.ephem_parameters_ref === 'string' ? `ExoClock (${e.ephem_parameters_ref})` : 'ExoClock',
    ocMin: num(e.current_oc_min),
    minApertureIn: num(e.min_telescope_inches),
    recentObs: num(e.total_observations_recent),
  });
}

/** Row from NASA Exoplanet Archive table toi (candidates only). */
export function fromToi(r: Record<string, unknown>): Target | Reject {
  const depthPpm = num(r.pl_trandep);
  return finalize({
    name: `TOI-${String(r.toi)}`,
    host: r.tid ? `TIC ${String(r.tid)}` : null,
    ra: num(r.ra) ?? NaN,
    dec: num(r.dec) ?? NaN,
    vmag: null,
    gmag: null,
    tmag: num(r.st_tmag),
    t0: num(r.pl_tranmid) ?? NaN,
    t0Err: symErr(r.pl_tranmiderr1, r.pl_tranmiderr2),
    period: num(r.pl_orbper) ?? NaN,
    periodErr: symErr(r.pl_orbpererr1, r.pl_orbpererr2),
    durationH: num(r.pl_trandurh) ?? NaN,
    depthPpt: depthPpm !== null ? depthPpm / 1000 : NaN,
    depthEstimated: false,
    source: 'toi',
    priority: null,
    ephemRef: 'TESS TOI catalog',
    ocMin: null,
    minApertureIn: null,
    recentObs: null,
  });
}

/** Angular separation in degrees (small-angle safe haversine). */
export function separationDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const d2r = Math.PI / 180;
  const s =
    Math.sin(((dec2 - dec1) * d2r) / 2) ** 2 +
    Math.cos(dec1 * d2r) * Math.cos(dec2 * d2r) * Math.sin(((ra2 - ra1) * d2r) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(s)))) / d2r;
}

export interface MergeStats {
  matchedByName: number;
  matchedByPosition: number;
  exoclockOnly: number;
  nasaOnly: number;
}

/**
 * ExoClock ephemerides take precedence over NASA when a planet is in both.
 * Matching: normalized name first, then position (< 10″) plus period (< 0.1 %).
 * NASA magnitudes and host name fill gaps in ExoClock records.
 */
export function mergeSources(nasa: Target[], exoclock: Target[]): { targets: Target[]; stats: MergeStats } {
  const byName = new Map(nasa.map((t) => [t.id, t]));
  const used = new Set<string>();
  const stats: MergeStats = { matchedByName: 0, matchedByPosition: 0, exoclockOnly: 0, nasaOnly: 0 };
  const out: Target[] = [];

  for (const ec of exoclock) {
    let match = byName.get(ec.id);
    if (match) stats.matchedByName++;
    else {
      match = nasa.find(
        (n) =>
          !used.has(n.id) &&
          Math.abs(n.dec - ec.dec) < 0.01 &&
          separationDeg(n.ra, n.dec, ec.ra, ec.dec) < 10 / 3600 &&
          Math.abs(n.period - ec.period) / ec.period < 1e-3,
      );
      if (match) stats.matchedByPosition++;
      else stats.exoclockOnly++;
    }
    if (match) {
      used.add(match.id);
      out.push({
        ...ec,
        id: match.id,
        name: match.name,
        host: match.host ?? ec.host,
        vmag: ec.vmag ?? match.vmag,
        gmag: ec.gmag ?? match.gmag,
        tmag: match.tmag,
      });
    } else out.push(ec);
  }
  for (const n of nasa) {
    if (!used.has(n.id)) {
      out.push(n);
      stats.nasaOnly++;
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  return { targets: out, stats };
}

const round = (v: unknown, digits: number) => (typeof v === 'number' ? Number(v.toFixed(digits)) : v);
const DIGITS: Partial<Record<keyof Target, number>> = {
  ra: 6,
  dec: 6,
  vmag: 3,
  gmag: 3,
  tmag: 3,
  t0: 6,
  durationH: 4,
  depthPpt: 4,
  ocMin: 2,
  minApertureIn: 2,
};

export function packCatalog(targets: Target[], sources: CatalogSourceInfo[], generated: string): CatalogFile {
  return {
    format: 'transit-planner-catalog',
    formatVersion: 1,
    generated,
    sources,
    fields: CATALOG_FIELDS,
    rows: targets.map((t) =>
      CATALOG_FIELDS.map((f) => {
        const v = t[f];
        if (f === 't0Err' || f === 'periodErr') return typeof v === 'number' ? Number(v.toPrecision(4)) : v;
        if (f === 'period') return typeof v === 'number' ? Number(v.toPrecision(12)) : v;
        const d = DIGITS[f];
        return d !== undefined ? round(v, d) : v;
      }),
    ),
  };
}

export function unpackCatalog(file: CatalogFile): Target[] {
  const idx = file.fields;
  return file.rows.map((row) => {
    const t: Record<string, unknown> = {};
    idx.forEach((f, i) => (t[f] = row[i]));
    return t as unknown as Target;
  });
}

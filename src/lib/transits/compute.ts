/**
 * Transit prediction and evaluation for a whole plan. Runs inside the Web
 * Worker (src/workers/compute.worker.ts) and in tests. See docs/methodology.md.
 */
import { Body, Illumination } from 'astronomy-engine';
import type { Target } from '../catalog/types';
import { computeNights, DARKNESS_ALTITUDE, type NightSummary } from '../astro/darkness';
import { airmass, altAzFromHourAngle, altitudeForAirmass, angularSeparation, hourAngle, makeLstFn, makeObserver, moonPosition, precessToDate } from '../astro/coords';
import { bjdTdbToUtcMsFast } from '../astro/time';
import { horizonAltitude } from './horizon';
import { scoreEvent } from './score';
import type { Coverage, PlanRequest, PlanResult, RejectReason, TransitEvent, WarningCode } from './types';

const MIN = 60_000;
const HOUR = 3_600_000;
const SIDEREAL_HOUR_MS = 3_590_170.4;

export function targetMagnitude(t: Target): { mag: number | null; band: 'V' | 'G' | 'T' | null } {
  if (t.vmag !== null) return { mag: t.vmag, band: 'V' };
  if (t.gmag !== null) return { mag: t.gmag, band: 'G' };
  if (t.tmag !== null) return { mag: t.tmag, band: 'T' };
  return { mag: null, band: null };
}

export function baselineMinutes(req: PlanRequest, durationH: number): number {
  const f = req.filters;
  return f.baselineMode === 'fixed' ? f.baselineMin : Math.max(20, f.baselineFactor * durationH * 60);
}

/** Epoch numbers n whose mid-transit (BJD) falls in [jdStart, jdEnd]. */
export function epochsInRange(t0: number, period: number, jdStart: number, jdEnd: number): number[] {
  const n0 = Math.ceil((jdStart - t0) / period);
  const n1 = Math.floor((jdEnd - t0) / period);
  const out: number[] = [];
  for (let n = n0; n <= n1 && out.length < 10000; n++) out.push(n);
  return out;
}

export function sigmaMinutes(t: Target, n: number): number | null {
  if (t.t0Err === null && t.periodErr === null) return null;
  const s0 = t.t0Err ?? 0;
  const sp = t.periodErr ?? 0;
  return Math.sqrt(s0 * s0 + n * n * sp * sp) * 1440;
}

interface Ctx {
  req: PlanRequest;
  nights: NightSummary[];
  lst: ((ms: number) => number)[];
  effMinAlt: number;
  obs: ReturnType<typeof makeObserver>;
}

function nightIndex(nights: NightSummary[], ms: number): number {
  for (let i = 0; i < nights.length; i++) if (ms >= nights[i].startMs && ms < nights[i].endMs) return i;
  return -1;
}

function darkAt(night: NightSummary, ms: number): boolean {
  for (const [a, b] of night.darkSegments) if (ms >= a && ms <= b) return true;
  return false;
}

export interface EvalOutcome {
  event?: TransitEvent;
  reject?: RejectReason;
}

/** Evaluate one predicted transit. `raDate`/`decDate` are the target's coordinates of date. */
export function evaluateTransit(ctx: Ctx, t: Target, n: number, raDate: number, decDate: number): EvalOutcome {
  const { req, nights } = ctx;
  const f = req.filters;
  const midMs = bjdTdbToUtcMsFast(t.t0 + n * t.period, t.ra, t.dec);
  const ni = nightIndex(nights, midMs);
  if (ni < 0) return {};
  const night = nights[ni];
  const lst = ctx.lst[ni];

  const durMs = t.durationH * HOUR;
  const ingressMs = midMs - durMs / 2;
  const egressMs = midMs + durMs / 2;
  const sigmaMin = sigmaMinutes(t, n);
  if (sigmaMin === null && !f.allowUnknownSigma) return { reject: 'sigma' };
  if (sigmaMin !== null && f.maxSigmaMin !== null && sigmaMin > f.maxSigmaMin) return { reject: 'sigma' };
  const baselineMin = baselineMinutes(req, t.durationH);
  const widenMin = f.widenSigma * (sigmaMin ?? 0);
  const padMs = (baselineMin + widenMin) * MIN;
  const windowStartMs = ingressMs - padMs;
  const windowEndMs = egressMs + padMs;

  if (!night.darkSegments.some(([a, b]) => a < egressMs && b > ingressMs)) return { reject: 'not-dark' };

  // --- sample the window ---
  const step = req.stepMin * MIN;
  const count = Math.max(2, Math.ceil((windowEndMs - windowStartMs) / step) + 1);
  const ts = new Float64Array(count);
  const alt = new Float32Array(count);
  const az = new Float32Array(count);
  const ok = new Uint8Array(count);
  let darkCount = 0;
  let altMax = -90;
  for (let i = 0; i < count; i++) {
    const ms = Math.min(windowStartMs + i * step, windowEndMs);
    ts[i] = ms;
    const aa = altAzFromHourAngle(hourAngle(lst(ms), raDate), decDate, req.site.lat);
    alt[i] = aa.alt;
    az[i] = aa.az;
    if (aa.alt > altMax) altMax = aa.alt;
    const dark = darkAt(night, ms);
    if (dark) darkCount++;
    const minAlt = Math.max(ctx.effMinAlt, horizonAltitude(req.site.horizon, aa.az));
    ok[i] = dark && aa.alt >= minAlt ? 1 : 0;
  }

  // transit coverage
  let inTransit = 0;
  let okTransit = 0;
  for (let i = 0; i < count; i++) {
    if (ts[i] >= ingressMs && ts[i] <= egressMs) {
      inTransit++;
      okTransit += ok[i];
    }
  }
  const transitFraction = inTransit ? okTransit / inTransit : 0;

  // contiguous baselines
  const firstIn = ts.findIndex((x) => x >= ingressMs);
  let lastIn = -1;
  for (let i = count - 1; i >= 0; i--) if (ts[i] <= egressMs) { lastIn = i; break; }
  let before = 0;
  if (firstIn > 0 && ok[firstIn]) for (let i = firstIn - 1; i >= 0 && ok[i]; i--) before = (ingressMs - ts[i]) / MIN;
  let after = 0;
  if (lastIn >= 0 && lastIn < count - 1 && ok[lastIn]) for (let i = lastIn + 1; i < count && ok[i]; i++) after = (ts[i] - egressMs) / MIN;
  const needed = baselineMin + widenMin - req.stepMin * 0.51;

  let coverage: Coverage;
  if (transitFraction >= 0.999) coverage = before >= needed && after >= needed ? 'full' : 'short-baseline';
  else coverage = 'partial';

  const passCoverage =
    f.coverage === 'full' ? coverage === 'full' : f.coverage === 'transit' ? coverage !== 'partial' : transitFraction >= f.minTransitFraction && transitFraction > 0;
  if (!passCoverage) {
    // distinguish "too low" from "not dark" for the rejection summary
    const darkInTransit = ts.some((x, i) => x >= ingressMs && x <= egressMs && darkAt(night, x) && alt[i] < ctx.effMinAlt);
    return { reject: darkInTransit ? 'altitude' : 'coverage' };
  }

  // achievable interval: the contiguous ok run overlapping the transit the most
  let bestA = -1;
  let bestB = -1;
  let bestOverlap = -1;
  for (let i = 0; i < count; ) {
    if (!ok[i]) { i++; continue; }
    let j = i;
    while (j + 1 < count && ok[j + 1]) j++;
    const overlap = Math.min(ts[j], egressMs) - Math.max(ts[i], ingressMs);
    if (overlap > bestOverlap) { bestOverlap = overlap; bestA = i; bestB = j; }
    i = j + 1;
  }
  const obsStartMs = ts[bestA];
  const obsEndMs = ts[bestB];
  let altMinObs = 90;
  for (let i = bestA; i <= bestB; i++) altMinObs = Math.min(altMinObs, alt[i]);

  const altAt = (ms: number) => altAzFromHourAngle(hourAngle(lst(ms), raDate), decDate, req.site.lat);
  const midAA = altAt(midMs);

  // Moon
  const moon = moonPosition(midMs, ctx.obs);
  const moonSepDeg = angularSeparation({ ra: t.ra, dec: t.dec }, moon.j2000);
  const moonIllum = Illumination(Body.Moon, new Date(midMs)).phase_fraction;
  const moonUp = moon.alt > -2;
  if (moonUp && (moonSepDeg < f.moonMinSepDeg || moonIllum > f.moonMaxIllum + 1e-9)) return { reject: 'moon' };

  // Meridian flip (GEM only): upper culmination + flipAfterMin inside the achievable interval
  let flipMs: number | null = null;
  let flipDuring: TransitEvent['flipDuring'] = null;
  if (req.mount.type === 'gem') {
    const ha0 = hourAngle(lst(obsStartMs), raDate);
    if (ha0 < 0) {
      const culmMs = obsStartMs + -ha0 * SIDEREAL_HOUR_MS;
      const fm = culmMs + req.mount.flipAfterMin * MIN;
      if (fm > obsStartMs && fm < obsEndMs) {
        flipMs = fm;
        flipDuring = fm >= ingressMs && fm <= egressMs ? 'transit' : 'baseline';
      }
    }
    if (flipMs !== null && f.flipPolicy === 'avoid') return { reject: 'flip' };
  }

  const { mag, band } = targetMagnitude(t);
  const warnings: WarningCode[] = [];
  if (sigmaMin === null) warnings.push('sigma-unknown');
  else if (sigmaMin > 10) warnings.push('sigma-large');
  if (flipMs !== null && f.flipPolicy === 'flag') warnings.push(flipDuring === 'transit' ? 'flip-transit' : 'flip-baseline');
  if (coverage === 'short-baseline') warnings.push('short-baseline');
  if (coverage === 'partial') warnings.push('partial');
  if (moonUp && moonSepDeg < 30) warnings.push('moon-close');
  if (moonUp && moonIllum > 0.7) warnings.push('moon-bright');
  if (altMinObs < 30) warnings.push('low-altitude');
  const darkFraction = darkCount / count;
  if (darkFraction < 0.999) warnings.push('twilight');
  if (req.mount.type === 'altaz' && altMax > 80) warnings.push('zenith-altaz');
  if (req.mode === 'photometry' && (req.vendorApp || req.sensorColor === 'osc')) warnings.push('osc-photometry');
  if (t.minApertureIn !== null && req.apertureMm !== null && t.minApertureIn * 25.4 > req.apertureMm) warnings.push('aperture-small');
  if (t.depthEstimated) warnings.push('depth-estimated');
  if (band !== 'V') warnings.push('mag-proxy');
  if (t.source === 'toi') warnings.push('candidate');

  const ev: TransitEvent = {
    id: `${t.id}@${n}`,
    targetId: t.id,
    name: t.name,
    host: t.host,
    epoch: n,
    night: night.date,
    ra: t.ra,
    dec: t.dec,
    mag,
    magBand: band,
    depthPpt: t.depthPpt,
    durationH: t.durationH,
    source: t.source,
    priority: t.priority,
    midMs,
    ingressMs,
    egressMs,
    sigmaMin,
    baselineMin,
    widenMin,
    windowStartMs,
    windowEndMs,
    obsStartMs,
    obsEndMs,
    transitFraction,
    baselineBeforeMin: Math.min(before, baselineMin + widenMin),
    baselineAfterMin: Math.min(after, baselineMin + widenMin),
    coverage,
    altIngress: altAt(ingressMs).alt,
    altMid: midAA.alt,
    altEgress: altAt(egressMs).alt,
    altMax,
    altMinObs,
    azMid: midAA.az,
    airmassMid: airmass(midAA.alt),
    moonSepDeg,
    moonIllum,
    moonAltMid: moon.alt,
    flipMs,
    flipDuring,
    darkFraction,
    warnings,
    score: 0,
  };
  ev.score = scoreEvent(req.mode, ev);
  return { event: ev };
}

export function prefilterTarget(req: PlanRequest, t: Target, effMinAlt: number): RejectReason | null {
  const f = req.filters;
  if (!f.sources[t.source]) return 'source';
  const { mag } = targetMagnitude(t);
  if (mag === null || mag < f.magMin || mag > f.magMax) return 'magnitude';
  if (t.depthPpt < f.depthMinPpt || (f.depthMaxPpt !== null && t.depthPpt > f.depthMaxPpt)) return 'depth';
  if (t.durationH < f.durationMinH || t.durationH > f.durationMaxH) return 'duration';
  if (f.needsObservations && t.priority !== 'alert' && t.priority !== 'high') return 'needs-observations';
  if (90 - Math.abs(req.site.lat - t.dec) < effMinAlt) return 'never-high-enough';
  return null;
}

export function effectiveMinAltitude(req: PlanRequest): number {
  const f = req.filters;
  return Math.max(f.minAlt, f.maxAirmass ? altitudeForAirmass(f.maxAirmass) : 0);
}

export function runPlan(req: PlanRequest, targets: Target[], onProgress?: (done: number, total: number) => void): PlanResult {
  const started = Date.now();
  const nights = computeNights(req.site, req.firstNight, req.nights, req.darkness);
  const rejected: Partial<Record<RejectReason, number>> = {};
  const bump = (r: RejectReason) => (rejected[r] = (rejected[r] ?? 0) + 1);
  const events: TransitEvent[] = [];
  if (nights.length === 0) return { nights, events, rejected, targetsConsidered: 0, computeMs: 0 };

  const effMinAlt = effectiveMinAltitude(req);
  const ctx: Ctx = {
    req,
    nights,
    lst: nights.map((n) => makeLstFn(n.startMs, req.site.lon)),
    effMinAlt,
    obs: makeObserver(req.site),
  };
  const rangeStart = nights[0].startMs;
  const rangeEnd = nights[nights.length - 1].endMs;
  const midRange = (rangeStart + rangeEnd) / 2;
  // BJD bounds with margin for Rømer delay (±8.3 min) and TT−UTC (69 s)
  const jdStart = rangeStart / 86_400_000 + 2440587.5 - 0.01;
  const jdEnd = rangeEnd / 86_400_000 + 2440587.5 + 0.01;
  const anyDark = nights.some((n) => n.darkSegments.length > 0);

  let considered = 0;
  targets.forEach((t, idx) => {
    if (onProgress && idx % 250 === 0) onProgress(idx, targets.length);
    const pre = prefilterTarget(req, t, effMinAlt);
    if (pre) return void bump(pre);
    considered++;
    if (!anyDark) return void bump('not-dark');
    const epochs = epochsInRange(t.t0, t.period, jdStart, jdEnd);
    if (epochs.length === 0) return;
    const p = precessToDate(t.ra, t.dec, midRange);
    for (const n of epochs) {
      const out = evaluateTransit(ctx, t, n, p.ra, p.dec);
      if (out.event) events.push(out.event);
      else if (out.reject) bump(out.reject);
    }
  });
  onProgress?.(targets.length, targets.length);
  events.sort((a, b) => b.score - a.score);
  return { nights, events, rejected, targetsConsidered: considered, computeMs: Date.now() - started };
}

/** Altitude curve of one target over a night (for the detail chart). */
export function altitudeCurve(req: Pick<PlanRequest, 'site'>, t: { ra: number; dec: number }, night: NightSummary, stepMin = 5): { ms: number; alt: number; az: number }[] {
  const p = precessToDate(t.ra, t.dec, (night.startMs + night.endMs) / 2);
  const lst = makeLstFn(night.startMs, req.site.lon);
  const out: { ms: number; alt: number; az: number }[] = [];
  for (let ms = night.startMs; ms <= night.endMs; ms += stepMin * MIN) {
    const aa = altAzFromHourAngle(hourAngle(lst(ms), p.ra), p.dec, req.site.lat);
    out.push({ ms, alt: aa.alt, az: aa.az });
  }
  return out;
}

export { DARKNESS_ALTITUDE };

/**
 * Internal plan model shared by all exporters: Plan -> Job[].
 * A job is one selected transit with the times the telescope should use.
 */
import type { TransitEvent, Mode, Site } from '../transits/types';

export interface Job {
  id: string;
  name: string;
  host: string | null;
  night: string;
  ra: number;
  dec: number;
  mag: number | null;
  magBand: TransitEvent['magBand'];
  depthPpt: number;
  durationH: number;
  /** slew/center/autofocus begin (obsStart - overhead) */
  startMs: number;
  /** first science frame */
  obsStartMs: number;
  obsEndMs: number;
  ingressMs: number;
  midMs: number;
  egressMs: number;
  sigmaMin: number | null;
  coverage: TransitEvent['coverage'];
  altMid: number;
  moonSepDeg: number;
  flipMs: number | null;
  priority: TransitEvent['priority'];
  source: TransitEvent['source'];
  score: number;
  warnings: TransitEvent['warnings'];
  /** suggested exposure, seconds (null = not known) */
  exposureS: number | null;
}

export interface Plan {
  generated: string;
  appVersion: string;
  mode: Mode;
  site: Site;
  equipment: string;
  overheadMin: number;
  dataVersion: string;
  jobs: Job[];
}

export function makeJob(e: TransitEvent, overheadMin: number, exposureS: number | null): Job {
  return {
    id: e.id,
    name: e.name,
    host: e.host,
    night: e.night,
    ra: e.ra,
    dec: e.dec,
    mag: e.mag,
    magBand: e.magBand,
    depthPpt: e.depthPpt,
    durationH: e.durationH,
    startMs: e.obsStartMs - overheadMin * 60_000,
    obsStartMs: e.obsStartMs,
    obsEndMs: e.obsEndMs,
    ingressMs: e.ingressMs,
    midMs: e.midMs,
    egressMs: e.egressMs,
    sigmaMin: e.sigmaMin,
    coverage: e.coverage,
    altMid: e.altMid,
    moonSepDeg: e.moonSepDeg,
    flipMs: e.flipMs,
    priority: e.priority,
    source: e.source,
    score: e.score,
    warnings: e.warnings,
    exposureS,
  };
}

export function jobsByNight(jobs: Job[]): Map<string, Job[]> {
  const m = new Map<string, Job[]>();
  for (const j of [...jobs].sort((a, b) => a.startMs - b.startMs)) m.set(j.night, [...(m.get(j.night) ?? []), j]);
  return m;
}

/** "WASP-12 b" -> "WASP-12_b" (safe for file names on Windows, macOS and Linux) */
export function safeFileName(s: string): string {
  return s.replace(/[^A-Za-z0-9._+-]+/g, '_').replace(/^_+|_+$/g, '') || 'target';
}

export function raToHms(raDeg: number): { h: number; m: number; s: number } {
  let total = ((raDeg / 15) % 24 + 24) % 24 * 3600;
  total = Math.round(total * 100) / 100;
  if (total >= 86400) total -= 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total - h * 3600) / 60);
  const s = Math.round((total - h * 3600 - m * 60) * 100) / 100;
  return { h, m, s };
}

export function decToDms(decDeg: number): { negative: boolean; d: number; m: number; s: number } {
  const negative = decDeg < 0;
  let total = Math.round(Math.abs(decDeg) * 3600 * 10) / 10;
  const d = Math.floor(total / 3600);
  total -= d * 3600;
  const m = Math.floor(total / 60);
  const s = Math.round((total - m * 60) * 10) / 10;
  return { negative, d, m, s };
}

export function formatRa(raDeg: number): string {
  const { h, m, s } = raToHms(raDeg);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${s.toFixed(2).padStart(5, '0')}s`;
}

export function formatDec(decDeg: number): string {
  const { negative, d, m, s } = decToDms(decDeg);
  return `${negative ? '−' : '+'}${String(d).padStart(2, '0')}° ${String(m).padStart(2, '0')}′ ${s.toFixed(1).padStart(4, '0')}″`;
}

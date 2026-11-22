/**
 * Ranking scores. Both are in 0..~1.3 and documented in docs/methodology.md.
 *
 * Photometry (ExoClock-style science value):
 *   (priority + staleness) x coverage x altitude x flip
 * Showcase (outreach interest):
 *   depth x brightness x visibility
 */
import type { ExoClockPriority } from '../catalog/types';
import type { Mode, TransitEvent } from './types';

const PRIORITY_WEIGHT: Record<ExoClockPriority, number> = { alert: 1, high: 0.8, medium: 0.55, low: 0.3 };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

type ScoreInput = Pick<
  TransitEvent,
  'priority' | 'source' | 'sigmaMin' | 'coverage' | 'transitFraction' | 'altMinObs' | 'altMid' | 'flipDuring' | 'depthPpt' | 'mag'
>;

export function photometryScore(e: ScoreInput): number {
  const prio = e.priority ? PRIORITY_WEIGHT[e.priority] : e.source === 'toi' ? 0.35 : 0.2;
  const staleness = e.sigmaMin === null ? 0.1 : 0.3 * Math.min(e.sigmaMin / 30, 1);
  const coverage = e.coverage === 'full' ? 1 : e.coverage === 'short-baseline' ? 0.6 : 0.3 * e.transitFraction;
  const altitude = clamp((e.altMinObs - 20) / 40, 0.2, 1);
  const flip = e.flipDuring === 'transit' ? 0.5 : e.flipDuring === 'baseline' ? 0.85 : 1;
  return (prio + staleness) * coverage * altitude * flip;
}

export function showcaseScore(e: ScoreInput): number {
  const depth = Math.min(1, Math.log10(1 + e.depthPpt) / Math.log10(1 + 30));
  const bright = e.mag === null ? 0.3 : clamp(10 ** (-0.2 * (e.mag - 9)), 0.05, 1);
  const coverage = e.coverage === 'full' ? 1 : e.coverage === 'short-baseline' ? 0.85 : 0.5 * e.transitFraction;
  const visibility = coverage * clamp(Math.sin((e.altMid * Math.PI) / 180), 0.2, 1);
  return depth * bright * visibility;
}

export function scoreEvent(mode: Mode, e: ScoreInput): number {
  return mode === 'photometry' ? photometryScore(e) : showcaseScore(e);
}

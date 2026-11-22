import { describe, expect, it } from 'vitest';
import { epochsInRange, runPlan, sigmaMinutes } from '../src/lib/transits/compute';
import { findConflicts, planSelection, suggestSchedule } from '../src/lib/schedule/schedule';
import { horizonAltitude, parseHorizonCsv } from '../src/lib/transits/horizon';
import { request, syntheticTarget } from './helpers';

describe('ephemeris propagation', () => {
  it('epochs and sigma', () => {
    expect(epochsInRange(100, 2, 103, 109)).toEqual([2, 3, 4]);
    const t = syntheticTarget('X', 0, 0, '2026-11-21T23:00:00Z', { t0Err: 0.001, periodErr: 0.0001 });
    // n = 100: sqrt(0.001^2 + (100*0.0001)^2) days = 0.01005 d = 14.47 min
    expect(sigmaMinutes(t, 100)).toBeCloseTo(14.47, 1);
    expect(sigmaMinutes({ ...t, t0Err: null, periodErr: null }, 5)).toBeNull();
  });
});

// RA 3h, Dec +45 culminates near local midnight in late November at Rijeka (alt ~ 90°)
const ZENITH_RA = 52;
const ZENITH_DEC = 45;

describe('runPlan', () => {
  it('predicts a synthetic transit at the right UTC time with full coverage', () => {
    const t = syntheticTarget('Synth-1', ZENITH_RA, ZENITH_DEC, '2026-11-21T22:00:00Z');
    const res = runPlan(request({ mount: { type: 'fork_eq', flipAfterMin: 0, overheadMin: 3, autofocusMin: 0 } }), [t]);
    expect(res.events).toHaveLength(1);
    const e = res.events[0];
    expect(Math.abs(e.midMs - Date.parse('2026-11-21T22:00:00Z'))).toBeLessThan(1000);
    expect(e.coverage).toBe('full');
    expect(e.transitFraction).toBe(1);
    expect(e.night).toBe('2026-11-21');
    expect(e.altMid).toBeGreaterThan(60);
    expect(e.flipMs).toBeNull();
  });

  it('flags or avoids a meridian flip during the transit on a GEM', () => {
    // find culmination: run once, then centre the transit on the flip time
    const probe = syntheticTarget('Probe', ZENITH_RA, ZENITH_DEC, '2026-11-21T22:00:00Z');
    const r0 = runPlan(request(), [probe]);
    const flip = r0.events[0]?.flipMs;
    expect(flip).not.toBeNull();
    const mid = new Date(flip!).toISOString();
    const t = syntheticTarget('Synth-flip', ZENITH_RA, ZENITH_DEC, mid);
    const flagged = runPlan(request({}, { flipPolicy: 'flag' }), [t]);
    expect(flagged.events[0].flipDuring).toBe('transit');
    expect(flagged.events[0].warnings).toContain('flip-transit');
    const avoided = runPlan(request({}, { flipPolicy: 'avoid' }), [t]);
    expect(avoided.events).toHaveLength(0);
    expect(avoided.rejected.flip).toBe(1);
    // alt-az mounts never flip
    const altaz = runPlan(request({ mount: { type: 'altaz', flipAfterMin: 0, overheadMin: 3, autofocusMin: 0 } }, { flipPolicy: 'avoid' }), [t]);
    expect(altaz.events).toHaveLength(1);
  });

  it('rejects daytime transits and filtered magnitudes with reasons', () => {
    const day = syntheticTarget('Day', ZENITH_RA, ZENITH_DEC, '2026-11-22T10:00:00Z', { period: 30 });
    const faint = syntheticTarget('Faint', ZENITH_RA, ZENITH_DEC, '2026-11-21T22:00:00Z', { vmag: 16 });
    const res = runPlan(request({}, { magMax: 13 }), [day, faint]);
    expect(res.events).toHaveLength(0);
    expect(res.rejected.magnitude).toBe(1);
    expect(res.rejected['not-dark']).toBe(1);
  });

  it('marks a transit that starts before darkness as partial', () => {
    const n = runPlan(request(), []).nights[0];
    const mid = new Date(n.darkStart! + 15 * 60_000).toISOString(); // mid 15 min after dark: ingress in twilight
    const t = syntheticTarget('Early', 300, 40, mid);
    const res = runPlan(request({}, { coverage: 'partial', minTransitFraction: 0.1, minAlt: 10 }), [t]);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].coverage).toBe('partial');
    expect(res.events[0].transitFraction).toBeGreaterThan(0.3);
    expect(res.events[0].transitFraction).toBeLessThan(0.8);
    const strict = runPlan(request({}, { coverage: 'full', minAlt: 10 }), [t]);
    expect(strict.events).toHaveLength(0);
  });

  it('rejects targets that never rise above the minimum altitude', () => {
    const south = syntheticTarget('South', 100, -60, '2026-11-21T22:00:00Z');
    const res = runPlan(request({}, { minAlt: 20 }), [south]);
    expect(res.rejected['never-high-enough']).toBe(1);
  });
});

describe('scheduling', () => {
  const ev = (id: string, s: number, e: number, score: number) => ({ id, obsStartMs: s * 60_000, obsEndMs: e * 60_000, score });
  it('detects conflicts including the slew gap', () => {
    const c = findConflicts([ev('a', 0, 100, 1), ev('b', 102, 200, 1), ev('c', 300, 400, 1)], 3);
    expect(c.get('a')).toEqual(['b']);
    expect(c.has('c')).toBe(false);
    expect(findConflicts([ev('a', 0, 100, 1), ev('b', 104, 200, 1)], 3).size).toBe(0);
  });
  it('weighted interval scheduling picks the best conflict-free set', () => {
    // a+c (1+1=2) loses to b (3); d is independent
    const pick = suggestSchedule([ev('a', 0, 100, 1), ev('b', 50, 250, 3), ev('c', 150, 300, 1), ev('d', 400, 500, 0.5)], 3);
    expect(pick).toEqual(['b', 'd']);
    const pick2 = suggestSchedule([ev('a', 0, 100, 2), ev('b', 50, 250, 3), ev('c', 150, 300, 2)], 3);
    expect(pick2).toEqual(['a', 'c']);
  });
  it('plan selection: manual picks win, removals stick, the rest is filled automatically', () => {
    const evs = [ev('a', 0, 100, 1), ev('b', 50, 250, 3), ev('c', 150, 300, 1), ev('d', 400, 500, 0.5)];
    expect(planSelection(evs, 3, [], []).sort()).toEqual(['b', 'd']);
    // picking a (overlaps b) drops b and lets c in
    expect(planSelection(evs, 3, ['a'], []).sort()).toEqual(['a', 'c', 'd']);
    // removing d keeps it out
    expect(planSelection(evs, 3, ['a'], ['d']).sort()).toEqual(['a', 'c']);
    // two overlapping picks: the newest wins
    expect(planSelection(evs, 3, ['a', 'b'], []).sort()).toEqual(['b', 'd']);
  });
});

describe('horizon profile', () => {
  it('interpolates and wraps', () => {
    const p = [
      { az: 0, alt: 10 },
      { az: 90, alt: 30 },
      { az: 270, alt: 0 },
    ];
    expect(horizonAltitude(p, 45)).toBeCloseTo(20);
    expect(horizonAltitude(p, 315)).toBeCloseTo(5);
    expect(horizonAltitude([], 123)).toBe(0);
  });
  it('parses CSV with header and comments', () => {
    const r = parseHorizonCsv('az,alt\n# my roof\n0,15\n90;25\n180 5\n400,1\n');
    expect(r.points).toHaveLength(3);
    expect(r.errors).toHaveLength(1);
  });
});

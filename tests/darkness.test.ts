import { describe, expect, it } from 'vitest';
import { computeNight } from '../src/lib/astro/darkness';
import { makeObserver, sunAltitude } from '../src/lib/astro/coords';
import { zonedToUtcMs, tzOffsetMinutes, localDateString } from '../src/lib/astro/tz';

const rijeka = { lat: 45.3271, lon: 14.4422, elevation: 0, tz: 'Europe/Zagreb' };

describe('time zones', () => {
  it('handles CET/CEST', () => {
    expect(tzOffsetMinutes(Date.parse('2026-11-21T12:00:00Z'), 'Europe/Zagreb')).toBe(60);
    expect(tzOffsetMinutes(Date.parse('2026-07-01T12:00:00Z'), 'Europe/Zagreb')).toBe(120);
    expect(new Date(zonedToUtcMs(2026, 11, 21, 12, 0, 'Europe/Zagreb')).toISOString()).toBe('2026-11-21T11:00:00.000Z');
    expect(new Date(zonedToUtcMs(2026, 7, 1, 12, 0, 'Europe/Zagreb')).toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(localDateString(Date.parse('2026-11-21T23:30:00Z'), 'Europe/Zagreb')).toBe('2026-11-22');
  });
});

describe('darkness windows', () => {
  it('Rijeka, 21 Nov 2026: twilight crossings are where the Sun is at the threshold', () => {
    const n = computeNight(rijeka, '2026-11-21', 'astronomical');
    expect(n.status).toBe('ok');
    const obs = makeObserver(rijeka);
    for (const [t, level] of [
      [n.sunset, -0.833],
      [n.civilDusk, -6],
      [n.nauticalDusk, -12],
      [n.astroDusk, -18],
      [n.astroDawn, -18],
      [n.nauticalDawn, -12],
      [n.sunrise, -0.833],
    ] as const) {
      expect(t).not.toBeNull();
      expect(Math.abs(sunAltitude(t!, obs) - level)).toBeLessThan(0.1);
    }
    expect(n.darkStart).toBeCloseTo(n.astroDusk!, -3);
    expect(n.darkMinutes).toBeGreaterThan(10 * 60);
    expect(n.darkMinutes).toBeLessThan(12 * 60);
    expect(n.startMs).toBe(Date.parse('2026-11-21T11:00:00Z'));
  });

  it('reports no astronomical darkness in midsummer at 55°N', () => {
    const n = computeNight({ lat: 55.7, lon: 12.6, elevation: 0, tz: 'Europe/Copenhagen' }, '2026-06-21', 'astronomical');
    expect(n.status).toBe('no-darkness');
    expect(n.darkSegments).toHaveLength(0);
  });

  it('reports continuous civil darkness in polar night (Longyearbyen, December)', () => {
    const n = computeNight({ lat: 78.22, lon: 15.65, elevation: 0, tz: 'Arctic/Longyearbyen' }, '2026-12-21', 'civil');
    expect(n.status).toBe('continuous-darkness');
    expect(n.darkMinutes).toBeGreaterThan(23.9 * 60);
  });
});

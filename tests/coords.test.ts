import { describe, expect, it } from 'vitest';
import ref from './fixtures/astropy-reference.json';
import { airmass, altAzFromHourAngle, altitudeForAirmass, hourAngle, localSiderealHours, makeLstFn, makeObserver, precessToDate, sunAltitude } from '../src/lib/astro/coords';

const site = ref.site;
const obs = makeObserver({ lat: site.lat, lon: site.lon, elevation: site.elevation });

describe('target alt/az against astropy AltAz (no refraction)', () => {
  for (const c of ref.altaz) {
    it(`${c.target} ${c.utc}`, () => {
      const ms = Date.parse(c.utc);
      const p = precessToDate(c.ra, c.dec, ms);
      const aa = altAzFromHourAngle(hourAngle(localSiderealHours(ms, site.lon), p.ra), p.dec, site.lat);
      expect(Math.abs(aa.alt - c.alt)).toBeLessThan(0.05);
      if (c.alt < 85) {
        const dAz = Math.abs(((aa.az - c.az + 540) % 360) - 180);
        expect(dAz).toBeLessThan(0.1);
      }
    });
  }
});

describe('sun altitude against astropy', () => {
  for (const c of ref.sun) {
    it(c.utc, () => {
      expect(Math.abs(sunAltitude(Date.parse(c.utc), obs) - c.alt)).toBeLessThan(0.05);
    });
  }
});

describe('helpers', () => {
  it('linear LST model matches full computation over 24 h', () => {
    const t0 = Date.parse('2026-11-21T11:00:00Z');
    const f = makeLstFn(t0, site.lon);
    const t = t0 + 20 * 3600_000;
    const diffSec = Math.abs(f(t) - localSiderealHours(t, site.lon)) * 3600;
    expect(diffSec).toBeLessThan(0.1);
  });
  it('airmass', () => {
    expect(airmass(90)).toBeCloseTo(1, 3);
    expect(airmass(30)).toBeCloseTo(1.995, 2);
    expect(airmass(-1)).toBe(Infinity);
    expect(altitudeForAirmass(2)).toBeCloseTo(29.9, 0);
  });
});

import { describe, expect, it } from 'vitest';
import ref from './fixtures/astropy-reference.json';
import { bjdTdbToUtcMs, bjdTdbToUtcMsFast, romerDelaySeconds, ttMinusUtc, utcToBjdTdb } from '../src/lib/astro/time';

describe('leap seconds', () => {
  it('TT-UTC is 69.184 s since 2017', () => {
    expect(ttMinusUtc(Date.parse('2026-11-21T00:00:00Z'))).toBeCloseTo(69.184, 6);
    expect(ttMinusUtc(Date.parse('2016-12-31T23:59:59Z'))).toBeCloseTo(68.184, 6);
    expect(ttMinusUtc(Date.parse('2017-01-01T00:00:00Z'))).toBeCloseTo(69.184, 6);
  });
});

describe('BJD_TDB <-> UTC against astropy light_travel_time', () => {
  for (const c of ref.bjd) {
    const utc = Date.parse(c.utc);
    it(`${c.target} ${c.utc}`, () => {
      // forward: UTC -> BJD_TDB within 0.5 s
      expect(Math.abs(utcToBjdTdb(utc, c.ra, c.dec) - c.bjd_tdb) * 86400).toBeLessThan(0.5);
      // Rømer delay within 0.5 s
      expect(Math.abs(romerDelaySeconds(utc, c.ra, c.dec) - c.romer_s)).toBeLessThan(0.5);
      // inverse (exact and fast) within 1 s
      expect(Math.abs(bjdTdbToUtcMs(c.bjd_tdb, c.ra, c.dec) - utc) / 1000).toBeLessThan(1);
      expect(Math.abs(bjdTdbToUtcMsFast(c.bjd_tdb, c.ra, c.dec) - utc) / 1000).toBeLessThan(1);
    });
  }
});

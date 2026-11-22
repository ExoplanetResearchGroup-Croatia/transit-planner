/**
 * Time scales. Catalogs give mid-transit times in BJD_TDB; plans need UTC.
 *
 *   BJD_TDB = JD_TDB(observer) + (r_earth · n̂) / c        (Rømer delay, up to ±8.3 min)
 *   JD_TDB  ≈ JD_TT + periodic term (≤ 1.7 ms)
 *   JD_TT   = JD_UTC + (TAI−UTC + 32.184 s)                 (leap seconds)
 *
 * r_earth is the barycentric position of the geocenter (astronomy-engine,
 * BaryState). The observer's offset from the geocenter (≤ 21 ms), the Shapiro
 * delay and the Einstein delay are ignored: planning accuracy of ~1 s is the goal.
 * Verified against astropy `Time.light_travel_time` (tests/time.test.ts).
 */
import { BaryState, Body } from 'astronomy-engine';

export const MS_PER_DAY = 86_400_000;
export const JD_UNIX_EPOCH = 2440587.5;
/** light travel time for 1 AU, seconds */
export const AU_LIGHT_SECONDS = 499.004783836;

export const jdToMs = (jd: number): number => (jd - JD_UNIX_EPOCH) * MS_PER_DAY;
export const msToJd = (ms: number): number => ms / MS_PER_DAY + JD_UNIX_EPOCH;

/**
 * TAI−UTC in seconds, from IERS Bulletin C. Last leap second: 2016-12-31.
 * If IERS announces a new one, add a row here (and a test).
 */
const LEAP_SECONDS: [string, number][] = [
  ['1972-01-01', 10], ['1972-07-01', 11], ['1973-01-01', 12], ['1974-01-01', 13],
  ['1975-01-01', 14], ['1976-01-01', 15], ['1977-01-01', 16], ['1978-01-01', 17],
  ['1979-01-01', 18], ['1980-01-01', 19], ['1981-07-01', 20], ['1982-07-01', 21],
  ['1983-07-01', 22], ['1985-07-01', 23], ['1988-01-01', 24], ['1990-01-01', 25],
  ['1991-01-01', 26], ['1992-07-01', 27], ['1993-07-01', 28], ['1994-07-01', 29],
  ['1996-01-01', 30], ['1997-07-01', 31], ['1999-01-01', 32], ['2006-01-01', 33],
  ['2009-01-01', 34], ['2012-07-01', 35], ['2015-07-01', 36], ['2017-01-01', 37],
];
const LEAP_TABLE = LEAP_SECONDS.map(([d, s]) => [Date.parse(`${d}T00:00:00Z`), s] as const);

export function taiMinusUtc(utcMs: number): number {
  let v = 10;
  for (const [t, s] of LEAP_TABLE) {
    if (utcMs >= t) v = s;
    else break;
  }
  return v;
}

/** TT − UTC in seconds (69.184 s since 2017). */
export const ttMinusUtc = (utcMs: number): number => taiMinusUtc(utcMs) + 32.184;

/** TDB − TT in seconds (Fairhead & Bretagnon leading terms, ≤ 1.7 ms). */
export function tdbMinusTt(jd: number): number {
  const g = ((357.53 + 0.98560028 * (jd - 2451545.0)) * Math.PI) / 180;
  return 0.001657 * Math.sin(g) + 0.000022 * Math.sin(2 * g);
}

/** Unit vector toward RA/Dec (degrees), J2000 equatorial frame (EQJ). */
export function unitVector(raDeg: number, decDeg: number): [number, number, number] {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Rømer delay (seconds) = barycentric − geocentric arrival time for a target at RA/Dec. */
export function romerDelaySeconds(utcMs: number, raDeg: number, decDeg: number): number {
  const e = BaryState(Body.Earth, new Date(utcMs));
  const [nx, ny, nz] = unitVector(raDeg, decDeg);
  return (e.x * nx + e.y * ny + e.z * nz) * AU_LIGHT_SECONDS;
}

export function utcToBjdTdb(utcMs: number, raDeg: number, decDeg: number): number {
  const jdUtc = msToJd(utcMs);
  const jdTdb = jdUtc + (ttMinusUtc(utcMs) + tdbMinusTt(jdUtc)) / 86400;
  return jdTdb + romerDelaySeconds(utcMs, raDeg, decDeg) / 86400;
}

/** Exact inverse of utcToBjdTdb by fixed-point iteration (converges in 2–3 steps). */
export function bjdTdbToUtcMs(bjd: number, raDeg: number, decDeg: number): number {
  let ms = jdToMs(bjd) - 69_184;
  for (let i = 0; i < 4; i++) {
    const diffDays = utcToBjdTdb(ms, raDeg, decDeg) - bjd;
    ms -= diffDays * MS_PER_DAY;
    if (Math.abs(diffDays) * 86400 < 1e-4) break;
  }
  return ms;
}

/**
 * Fast single-pass version used for bulk transit prediction: one Earth-position
 * evaluation per event. Error < 0.1 s versus the iterative inverse, because the
 * Rømer delay changes by at most ~1e-4 s per second.
 */
export function bjdTdbToUtcMsFast(bjd: number, raDeg: number, decDeg: number): number {
  const approx = jdToMs(bjd) - ttMinusUtc(jdToMs(bjd)) * 1000;
  const romer = romerDelaySeconds(approx, raDeg, decDeg);
  return approx - romer * 1000 - tdbMinusTt(bjd) * 1000;
}

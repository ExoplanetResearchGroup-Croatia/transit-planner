/**
 * Fast horizontal coordinates for bulk computation in the worker.
 *
 * Targets are precessed once per run from J2000 to the equator of date
 * (astronomy-engine Rotation_EQJ_EQD, includes nutation); local apparent
 * sidereal time is evaluated once per night and advanced linearly.
 * Altitudes are GEOMETRIC (no refraction, no aberration): about 0.5° lower than
 * apparent at the horizon, 0.03° at 60°. Verified against astropy AltAz.
 */
import { Body, Equator, Horizon, Observer, Rotation_EQJ_EQD, RotateVector, SiderealTime, Vector, MakeTime, EquatorFromVector } from 'astronomy-engine';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
/** sidereal hours per solar millisecond */
const SIDEREAL_RATE = 1.00273790935 * 24 / 86_400_000;

export interface RaDec {
  ra: number; // degrees
  dec: number; // degrees
}

export function precessToDate(raDeg: number, decDeg: number, utcMs: number): RaDec {
  const t = MakeTime(new Date(utcMs));
  const rot = Rotation_EQJ_EQD(t);
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const v = new Vector(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), t);
  const eq = EquatorFromVector(RotateVector(rot, v));
  return { ra: eq.ra * 15, dec: eq.dec };
}

/** Local apparent sidereal time in hours. */
export function localSiderealHours(utcMs: number, lonDeg: number): number {
  const h = SiderealTime(new Date(utcMs)) + lonDeg / 15;
  return ((h % 24) + 24) % 24;
}

/** Linear LST model for one night: lst(t) = lst0 + rate·(t − t0). Error < 0.01 s over 24 h. */
export function makeLstFn(t0Ms: number, lonDeg: number): (utcMs: number) => number {
  const lst0 = localSiderealHours(t0Ms, lonDeg);
  return (utcMs: number) => {
    const h = lst0 + (utcMs - t0Ms) * SIDEREAL_RATE;
    return ((h % 24) + 24) % 24;
  };
}

export interface AltAz {
  alt: number; // degrees
  az: number; // degrees, north = 0, east = 90
}

export function altAzFromHourAngle(haHours: number, decDeg: number, latDeg: number): AltAz {
  const h = haHours * 15 * D2R;
  const d = decDeg * D2R;
  const p = latDeg * D2R;
  const sinAlt = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const y = -Math.cos(d) * Math.sin(h);
  const x = Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(h) * Math.sin(p);
  let az = Math.atan2(y, x) * R2D;
  if (az < 0) az += 360;
  return { alt: alt * R2D, az };
}

/** Hour angle in hours, wrapped to (−12, 12]. */
export function hourAngle(lstHours: number, raDeg: number): number {
  let ha = lstHours - raDeg / 15;
  ha = ((ha % 24) + 24) % 24;
  return ha > 12 ? ha - 24 : ha;
}

/** Airmass, Kasten & Young (1989). Infinity below the horizon. */
export function airmass(altDeg: number): number {
  if (altDeg <= 0) return Infinity;
  return 1 / (Math.sin(altDeg * D2R) + 0.50572 * (altDeg + 6.07995) ** -1.6364);
}

/** Altitude at which a given airmass is reached (inverse of airmass, by bisection). */
export function altitudeForAirmass(x: number): number {
  if (!Number.isFinite(x) || x <= 1) return 90;
  let lo = 0;
  let hi = 90;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (airmass(mid) > x) lo = mid;
    else hi = mid;
  }
  return hi;
}

export function angularSeparation(a: RaDec, b: RaDec): number {
  const s =
    Math.sin(((b.dec - a.dec) * D2R) / 2) ** 2 +
    Math.cos(a.dec * D2R) * Math.cos(b.dec * D2R) * Math.sin(((b.ra - a.ra) * D2R) / 2) ** 2;
  return 2 * Math.asin(Math.min(1, Math.sqrt(s))) * R2D;
}

export interface SiteCoords {
  lat: number;
  lon: number;
  elevation: number;
}

export const makeObserver = (s: SiteCoords) => new Observer(s.lat, s.lon, s.elevation);

/** Sun altitude (geometric, topocentric). */
export function sunAltitude(utcMs: number, obs: Observer): number {
  const d = new Date(utcMs);
  const eq = Equator(Body.Sun, d, obs, true, true);
  return Horizon(d, obs, eq.ra, eq.dec).altitude;
}

/** Moon topocentric position: altitude and J2000 RA/Dec for separations. */
export function moonPosition(utcMs: number, obs: Observer): { alt: number; az: number; j2000: RaDec } {
  const d = new Date(utcMs);
  const ofDate = Equator(Body.Moon, d, obs, true, true);
  const hor = Horizon(d, obs, ofDate.ra, ofDate.dec);
  const j2000 = Equator(Body.Moon, d, obs, false, true);
  return { alt: hor.altitude, az: hor.azimuth, j2000: { ra: j2000.ra * 15, dec: j2000.dec } };
}

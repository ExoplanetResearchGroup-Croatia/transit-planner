import type { Target } from '../src/lib/catalog/types';
import type { Filters, PlanRequest } from '../src/lib/transits/types';
import { utcToBjdTdb } from '../src/lib/astro/time';

export const RIJEKA = { name: 'Rijeka', lat: 45.3271, lon: 14.4422, elevation: 0, tz: 'Europe/Zagreb', horizon: [] };

export const OPEN_FILTERS: Filters = {
  magMin: -2,
  magMax: 20,
  depthMinPpt: 0,
  depthMaxPpt: null,
  durationMinH: 0,
  durationMaxH: 48,
  coverage: 'partial',
  minTransitFraction: 0.01,
  baselineMode: 'fixed',
  baselineMin: 60,
  baselineFactor: 0.5,
  widenSigma: 1,
  minAlt: 20,
  maxAirmass: null,
  moonMinSepDeg: 0,
  moonMaxIllum: 1,
  maxSigmaMin: null,
  allowUnknownSigma: true,
  flipPolicy: 'flag',
  sources: { exoclock: true, nasa: true, toi: true },
  needsObservations: false,
};

export function request(over: Partial<PlanRequest> = {}, filters: Partial<Filters> = {}): PlanRequest {
  return {
    mode: 'photometry',
    site: RIJEKA,
    firstNight: '2026-11-21',
    nights: 1,
    darkness: 'astronomical',
    mount: { type: 'gem', flipAfterMin: 5, overheadMin: 3, autofocusMin: 0 },
    apertureMm: 203,
    sensorColor: 'mono',
    vendorApp: false,
    stepMin: 5,
    ...over,
    filters: { ...OPEN_FILTERS, ...filters },
  };
}

/** Synthetic target whose mid-transit (UTC) falls exactly at `midUtc`. */
export function syntheticTarget(name: string, ra: number, dec: number, midUtc: string, over: Partial<Target> = {}): Target {
  const t0 = utcToBjdTdb(Date.parse(midUtc), ra, dec);
  return {
    id: name.toLowerCase(),
    name,
    host: null,
    ra,
    dec,
    vmag: 11,
    gmag: null,
    tmag: null,
    t0,
    t0Err: 0.0005,
    period: 3.5,
    periodErr: 0.000002,
    durationH: 2.5,
    depthPpt: 15,
    depthEstimated: false,
    source: 'nasa',
    priority: null,
    ephemRef: 'synthetic',
    ocMin: null,
    minApertureIn: null,
    recentObs: null,
    ...over,
  };
}

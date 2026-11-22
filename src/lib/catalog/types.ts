export type CatalogSource = 'exoclock' | 'nasa' | 'toi';
export type ExoClockPriority = 'alert' | 'high' | 'medium' | 'low';

/** Normalized target record (one transiting planet or candidate). Times in BJD_TDB days. */
export interface Target {
  /** Stable key: normalized name */
  id: string;
  name: string;
  host: string | null;
  /** J2000, degrees */
  ra: number;
  dec: number;
  vmag: number | null;
  gmag: number | null;
  tmag: number | null;
  t0: number;
  /** 1-sigma, days (symmetric: max of the two published errors) */
  t0Err: number | null;
  period: number;
  periodErr: number | null;
  durationH: number;
  depthPpt: number;
  /** depth computed from Rp/Rs instead of a published transit depth */
  depthEstimated: boolean;
  /** where the ephemeris comes from */
  source: CatalogSource;
  /** ExoClock observation priority, if the planet is in ExoClock */
  priority: ExoClockPriority | null;
  /** short reference of the ephemeris */
  ephemRef: string | null;
  /** ExoClock: current O-C in minutes */
  ocMin: number | null;
  /** ExoClock: recommended minimum aperture, inches */
  minApertureIn: number | null;
  /** ExoClock: number of recent observations */
  recentObs: number | null;
}

export interface CatalogSourceInfo {
  id: CatalogSource;
  name: string;
  url: string;
  retrieved: string;
  count: number;
}

/** Compact columnar file written by scripts/build-catalog.ts */
export interface CatalogFile {
  format: 'transit-planner-catalog';
  formatVersion: 1;
  /** ISO timestamp of generation; doubles as cache version */
  generated: string;
  sources: CatalogSourceInfo[];
  fields: (keyof Target)[];
  rows: unknown[][];
}

export const CATALOG_FIELDS: (keyof Target)[] = [
  'id',
  'name',
  'host',
  'ra',
  'dec',
  'vmag',
  'gmag',
  'tmag',
  't0',
  't0Err',
  'period',
  'periodErr',
  'durationH',
  'depthPpt',
  'depthEstimated',
  'source',
  'priority',
  'ephemRef',
  'ocMin',
  'minApertureIn',
  'recentObs',
];

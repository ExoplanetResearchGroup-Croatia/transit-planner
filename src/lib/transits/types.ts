import type { CatalogSource, ExoClockPriority } from '../catalog/types';
import type { DarknessDefinition, NightSummary } from '../astro/darkness';
import type { MountType, SensorColor } from '../equipment/types';

export type Mode = 'photometry' | 'showcase';
export type FlipPolicy = 'avoid' | 'flag' | 'allow';
/** full: transit + both baselines; transit: complete transit, baseline may be short; partial: at least minTransitFraction */
export type CoverageRequirement = 'full' | 'transit' | 'partial';
export type Coverage = 'full' | 'short-baseline' | 'partial';

export interface HorizonPoint {
  az: number;
  alt: number;
}

export interface Site {
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  tz: string;
  /** azimuth -> minimum altitude; empty = flat horizon */
  horizon: HorizonPoint[];
}

export interface MountSettings {
  type: MountType;
  /** GEM: minutes past the meridian at which the mount flips */
  flipAfterMin: number;
  /** slew + plate solve + centering, minutes */
  overheadMin: number;
  /** autofocus run before each target, minutes */
  autofocusMin: number;
}

export interface Filters {
  magMin: number;
  magMax: number;
  depthMinPpt: number;
  depthMaxPpt: number | null;
  durationMinH: number;
  durationMaxH: number;
  coverage: CoverageRequirement;
  minTransitFraction: number;
  baselineMode: 'fixed' | 'proportional';
  baselineMin: number;
  /** proportional: baseline = factor x transit duration (minimum 20 min) */
  baselineFactor: number;
  /** widen the window by k x sigma_T on each side */
  widenSigma: number;
  minAlt: number;
  maxAirmass: number | null;
  moonMinSepDeg: number;
  /** 0..1 */
  moonMaxIllum: number;
  /** ephemeris uncertainty cap, minutes (null = no cap) */
  maxSigmaMin: number | null;
  allowUnknownSigma: boolean;
  flipPolicy: FlipPolicy;
  sources: Record<CatalogSource, boolean>;
  /** only ExoClock targets with priority alert/high */
  needsObservations: boolean;
}

export interface PlanRequest {
  mode: Mode;
  site: Site;
  firstNight: string;
  nights: number;
  darkness: DarknessDefinition;
  mount: MountSettings;
  apertureMm: number | null;
  sensorColor: SensorColor | null;
  /** smart telescope driven by a vendor app (no Ekos/NINA) */
  vendorApp: boolean;
  filters: Filters;
  stepMin: number;
}

export type WarningCode =
  | 'sigma-unknown'
  | 'sigma-large'
  | 'flip-transit'
  | 'flip-baseline'
  | 'short-baseline'
  | 'partial'
  | 'moon-close'
  | 'moon-bright'
  | 'low-altitude'
  | 'twilight'
  | 'zenith-altaz'
  | 'osc-photometry'
  | 'aperture-small'
  | 'depth-estimated'
  | 'mag-proxy'
  | 'candidate';

export type RejectReason =
  | 'source'
  | 'magnitude'
  | 'depth'
  | 'duration'
  | 'needs-observations'
  | 'never-high-enough'
  | 'not-dark'
  | 'coverage'
  | 'altitude'
  | 'moon'
  | 'sigma'
  | 'flip';

export interface TransitEvent {
  id: string;
  targetId: string;
  name: string;
  host: string | null;
  epoch: number;
  night: string;
  ra: number;
  dec: number;
  mag: number | null;
  magBand: 'V' | 'G' | 'T' | null;
  depthPpt: number;
  durationH: number;
  source: CatalogSource;
  priority: ExoClockPriority | null;
  midMs: number;
  ingressMs: number;
  egressMs: number;
  sigmaMin: number | null;
  baselineMin: number;
  widenMin: number;
  /** ideal window: ingress - baseline - widen .. egress + baseline + widen */
  windowStartMs: number;
  windowEndMs: number;
  /** achievable: contiguous observable interval overlapping the transit, clipped to the window */
  obsStartMs: number;
  obsEndMs: number;
  transitFraction: number;
  baselineBeforeMin: number;
  baselineAfterMin: number;
  coverage: Coverage;
  altIngress: number;
  altMid: number;
  altEgress: number;
  altMax: number;
  altMinObs: number;
  azMid: number;
  airmassMid: number;
  moonSepDeg: number;
  moonIllum: number;
  moonAltMid: number;
  flipMs: number | null;
  flipDuring: 'transit' | 'baseline' | null;
  darkFraction: number;
  warnings: WarningCode[];
  score: number;
}

export interface PlanResult {
  nights: NightSummary[];
  events: TransitEvent[];
  rejected: Partial<Record<RejectReason, number>>;
  targetsConsidered: number;
  computeMs: number;
}

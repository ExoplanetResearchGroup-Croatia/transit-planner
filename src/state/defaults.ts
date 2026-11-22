import type { Filters, Mode, MountSettings } from '../lib/transits/types';

/** Default filters per mode (docs/user-guide.md explains each one). */
export const DEFAULT_FILTERS: Record<Mode, Filters> = {
  photometry: {
    magMin: 6,
    magMax: 13.5,
    depthMinPpt: 3,
    depthMaxPpt: null,
    durationMinH: 0.5,
    durationMaxH: 8,
    coverage: 'full',
    minTransitFraction: 0.6,
    baselineMode: 'fixed',
    baselineMin: 60,
    baselineFactor: 0.5,
    widenSigma: 1,
    minAlt: 30,
    maxAirmass: 2,
    moonMinSepDeg: 30,
    moonMaxIllum: 1,
    maxSigmaMin: 60,
    allowUnknownSigma: false,
    flipPolicy: 'avoid',
    sources: { exoclock: true, nasa: true, toi: false },
    needsObservations: false,
  },
  showcase: {
    magMin: 4,
    magMax: 12,
    depthMinPpt: 8,
    depthMaxPpt: null,
    durationMinH: 0.5,
    durationMaxH: 6,
    coverage: 'transit',
    minTransitFraction: 0.5,
    baselineMode: 'fixed',
    baselineMin: 30,
    baselineFactor: 0.5,
    widenSigma: 1,
    minAlt: 25,
    maxAirmass: null,
    moonMinSepDeg: 20,
    moonMaxIllum: 1,
    maxSigmaMin: 30,
    allowUnknownSigma: true,
    flipPolicy: 'flag',
    sources: { exoclock: true, nasa: true, toi: false },
    needsObservations: false,
  },
};

export const DEFAULT_MOUNT: MountSettings = { type: 'gem', flipAfterMin: 5, overheadMin: 3, autofocusMin: 2 };

/** Warning codes shown per mode (all are computed; Showcase shows only the basics). */
export const MODE_WARNINGS: Record<Mode, Set<string> | null> = {
  photometry: null,
  showcase: new Set(['low-altitude', 'moon-close', 'moon-bright', 'twilight', 'partial', 'flip-transit', 'zenith-altaz', 'candidate']),
};

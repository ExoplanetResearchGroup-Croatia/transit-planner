/**
 * Exposure advice from target magnitude. A STARTING POINT, not a calculation:
 * the defaults are planner heuristics for a 200 mm aperture and are meant to be
 * edited. Times scale with collecting area, (200 mm / D)^2, and snap to the
 * fixed options of smart telescopes. Always check for saturation on the first frames.
 */

export interface ExposureRow {
  /** rows apply to targets brighter than or equal to this magnitude */
  maxMag: number;
  exposureS: number;
}

export const REFERENCE_APERTURE_MM = 200;

export const DEFAULT_EXPOSURE_TABLE: ExposureRow[] = [
  { maxMag: 7, exposureS: 5 },
  { maxMag: 8, exposureS: 10 },
  { maxMag: 9, exposureS: 20 },
  { maxMag: 10, exposureS: 30 },
  { maxMag: 11, exposureS: 60 },
  { maxMag: 12, exposureS: 90 },
  { maxMag: 13, exposureS: 120 },
  { maxMag: 99, exposureS: 180 },
];

export function adviseExposure(
  mag: number | null,
  table: ExposureRow[],
  apertureMm: number | null,
  fixedOptions?: number[],
): number | null {
  if (mag === null || table.length === 0) return null;
  const rows = [...table].sort((a, b) => a.maxMag - b.maxMag);
  const row = rows.find((r) => mag <= r.maxMag) ?? rows[rows.length - 1];
  let t = row.exposureS;
  if (apertureMm && apertureMm > 0) t *= (REFERENCE_APERTURE_MM / apertureMm) ** 2;
  t = Math.min(600, Math.max(1, t));
  if (fixedOptions?.length) return fixedOptions.reduce((best, o) => (Math.abs(o - t) < Math.abs(best - t) ? o : best), fixedOptions[0]);
  return t >= 10 ? Math.round(t / 5) * 5 : Math.round(t);
}

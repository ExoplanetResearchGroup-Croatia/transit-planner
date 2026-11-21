/** Derived optical values. Always computed from pixels, pixel size and focal length (never from published FOV). */

export const ARCSEC_PER_RADIAN = 206264.806;

export interface Optics {
  aperture_mm: number;
  focal_length_mm: number;
  pixel_um: number;
  sensor_px: [number, number];
}

export interface DerivedOptics {
  fRatio: number;
  /** arcsec per pixel */
  plateScale: number;
  fovWidthDeg: number;
  fovHeightDeg: number;
  fovDiagonalDeg: number;
}

export function deriveOptics(o: Optics): DerivedOptics {
  const fRatio = o.focal_length_mm / o.aperture_mm;
  const plateScale = (ARCSEC_PER_RADIAN * o.pixel_um * 1e-3) / o.focal_length_mm;
  const fovWidthDeg = (o.sensor_px[0] * plateScale) / 3600;
  const fovHeightDeg = (o.sensor_px[1] * plateScale) / 3600;
  return {
    fRatio,
    plateScale,
    fovWidthDeg,
    fovHeightDeg,
    fovDiagonalDeg: Math.hypot(fovWidthDeg, fovHeightDeg),
  };
}

export interface PublishedFov {
  width?: number;
  height?: number;
  diagonal?: number;
}

/** Largest relative disagreement between computed and published FOV (0.05 = 5 %). Orientation-agnostic. */
export function fovDisagreement(d: DerivedOptics, published: PublishedFov): number {
  const diffs: number[] = [];
  const rel = (a: number, b: number) => Math.abs(a - b) / b;
  if (published.diagonal) diffs.push(rel(d.fovDiagonalDeg, published.diagonal));
  if (published.width && published.height) {
    const comp = [d.fovWidthDeg, d.fovHeightDeg].sort((a, b) => a - b);
    const pub = [published.width, published.height].sort((a, b) => a - b);
    diffs.push(rel(comp[0], pub[0]), rel(comp[1], pub[1]));
  } else if (published.width || published.height) {
    const p = (published.width ?? published.height)!;
    diffs.push(Math.min(rel(d.fovWidthDeg, p), rel(d.fovHeightDeg, p)));
  }
  return diffs.length ? Math.max(...diffs) : 0;
}

export function formatArcsec(x: number): string {
  return `${x.toFixed(2)}″/px`;
}

export function formatFov(d: DerivedOptics): string {
  const fmt = (deg: number) => (deg >= 1 ? `${deg.toFixed(2)}°` : `${(deg * 60).toFixed(1)}′`);
  return `${fmt(d.fovWidthDeg)} × ${fmt(d.fovHeightDeg)}`;
}

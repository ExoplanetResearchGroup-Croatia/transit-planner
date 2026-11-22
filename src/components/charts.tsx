/**
 * Hairline charts for the transit data column: the predicted light curve and
 * the polar sky track (alt-az, zenith in the centre, horizon on the ring).
 */
import { useMemo } from 'react';
import type { NightSummary } from '../lib/astro/darkness';
import type { HorizonPoint, PlanRequest, TransitEvent } from '../lib/transits/types';
import { formatTime } from '../lib/astro/tz';
import { altitudeCurve } from '../lib/transits/compute';
import { horizonAltitude } from '../lib/transits/horizon';
import { S } from '../strings';

/** Trapezoid light curve (b = 0) with the ±σ band on mid-transit and the planned interval underneath. */
export function LightCurve({ event, tz, width = 340, height = 132 }: { event: TransitEvent; tz: string; width?: number; height?: number }) {
  const pad = { l: 40, r: 6, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const t0 = event.windowStartMs;
  const t1 = event.windowEndMs;
  const x = (ms: number) => pad.l + ((ms - t0) / (t1 - t0)) * w;
  const depth = event.depthPpt / 1000;
  const k = Math.sqrt(depth);
  const tau = (event.egressMs - event.ingressMs) * (k / (1 + k));
  const y = (flux: number) => pad.t + ((1 - flux) / (depth * 1.35)) * h;
  const pts: [number, number][] = [
    [t0, 1],
    [event.ingressMs, 1],
    [event.ingressMs + tau, 1 - depth],
    [event.egressMs - tau, 1 - depth],
    [event.egressMs, 1],
    [t1, 1],
  ];
  const sig = (event.sigmaMin ?? 0) * 60_000;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={S.inspector.lightCurve}>
      {sig > 0 && <rect x={x(event.midMs - sig)} y={pad.t} width={Math.max(1, x(event.midMs + sig) - x(event.midMs - sig))} height={h} fill="var(--c-panel-2)" />}
      <line x1={pad.l} x2={width - pad.r} y1={y(1)} y2={y(1)} stroke="var(--c-line)" />
      <line x1={pad.l} x2={width - pad.r} y1={y(1 - depth)} y2={y(1 - depth)} stroke="var(--c-line)" strokeDasharray="2 3" />
      <rect x={x(event.obsStartMs)} y={pad.t + h + 2} width={Math.max(1, x(event.obsEndMs) - x(event.obsStartMs))} height={2} fill="var(--c-red)" />
      <path d={pts.map(([t, f], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(f).toFixed(1)}`).join('')} fill="none" stroke="var(--c-fg)" strokeWidth={1.5} strokeLinejoin="round" />
      <text x={pad.l - 6} y={y(1) + 3} textAnchor="end" fontSize={10} className="num" fill="var(--c-faint)">
        1.000
      </text>
      <text x={pad.l - 6} y={y(1 - depth) + 3} textAnchor="end" fontSize={10} className="num" fill="var(--c-faint)">
        {(1 - depth).toFixed(3)}
      </text>
      {[event.ingressMs, event.midMs, event.egressMs].map((t) => (
        <text key={t} x={x(t)} y={height - 4} textAnchor="middle" fontSize={10} className="num" fill="var(--c-muted)">
          {formatTime(t, tz)}
        </text>
      ))}
    </svg>
  );
}

/** Polar alt-az plot of the target's track over the planned window; transit part drawn at double weight. */
export function SkyTrack({ req, event, night, horizon, size = 240 }: { req: Pick<PlanRequest, 'site'>; event: TransitEvent; night: NightSummary; horizon: HorizonPoint[]; size?: number }) {
  const c = size / 2;
  const R = c - 18;
  const curve = useMemo(() => altitudeCurve(req, event, night, 2), [req, event, night]);
  // azimuth: north up, east left (as seen looking up at the sky)
  const pos = (alt: number, az: number) => {
    const r = R * (1 - Math.max(0, alt) / 90);
    const a = (az * Math.PI) / 180;
    return [c - r * Math.sin(a), c - r * Math.cos(a)] as const;
  };
  const seg = (a: number, b: number) =>
    curve
      .filter((p) => p.ms >= a && p.ms <= b && p.alt > 0)
      .map((p, i) => {
        const [px, py] = pos(p.alt, p.az);
        return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join('');
  const horizonPath = horizon.length
    ? Array.from({ length: 73 }, (_, i) => {
        const az = i * 5;
        const [px, py] = pos(horizonAltitude(horizon, az), az);
        return `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
      }).join('') + 'Z'
    : '';
  const ing = curve.reduce((best, p) => (Math.abs(p.ms - event.ingressMs) < Math.abs(best.ms - event.ingressMs) ? p : best), curve[0]);
  const egr = curve.reduce((best, p) => (Math.abs(p.ms - event.egressMs) < Math.abs(best.ms - event.egressMs) ? p : best), curve[0]);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px]" role="img" aria-label={S.inspector.skyTrack}>
      {[0, 30, 60].map((alt) => (
        <circle key={alt} cx={c} cy={c} r={R * (1 - alt / 90)} fill="none" stroke={alt === 0 ? 'var(--c-line-strong)' : 'var(--c-line)'} />
      ))}
      {Array.from({ length: 12 }, (_, i) => {
        const [px, py] = pos(0, i * 30);
        return <line key={i} x1={c} y1={c} x2={px} y2={py} stroke="var(--c-line)" />;
      })}
      {horizonPath && <path d={horizonPath} fill="var(--c-panel-2)" fillRule="evenodd" stroke="var(--c-grey)" strokeWidth={0.75} opacity={0.9} />}
      {(['N', 'E', 'S', 'W'] as const).map((l, i) => {
        const [px, py] = pos(-12, i * 90);
        return (
          <text key={l} x={px} y={py + 3} textAnchor="middle" fontSize={10} className="caps" fill="var(--c-muted)">
            {l}
          </text>
        );
      })}
      <path d={seg(night.startMs, night.endMs)} fill="none" stroke="var(--c-plot-dim)" strokeWidth={1} />
      <path d={seg(event.obsStartMs, event.obsEndMs)} fill="none" stroke="var(--c-plot-mid)" strokeWidth={1.25} />
      <path d={seg(event.ingressMs, event.egressMs)} fill="none" stroke="var(--c-fg)" strokeWidth={2.5} strokeLinecap="round" />
      {ing && ing.alt > 0 && <circle cx={pos(ing.alt, ing.az)[0]} cy={pos(ing.alt, ing.az)[1]} r={3} fill="var(--c-red)" />}
      {egr && egr.alt > 0 && <circle cx={pos(egr.alt, egr.az)[0]} cy={pos(egr.alt, egr.az)[1]} r={3} fill="none" stroke="var(--c-red)" strokeWidth={1.5} />}
      <circle cx={c} cy={c} r={2} fill="var(--c-muted)" />
    </svg>
  );
}

/**
 * Hand-rolled SVG charts: altitude curve over the night, predicted light curve,
 * and the night Gantt timeline. Colours come from theme tokens, so red night
 * mode works without extra code.
 */
import { useMemo } from 'react';
import type { NightSummary } from '../lib/astro/darkness';
import type { TransitEvent } from '../lib/transits/types';
import { formatTime } from '../lib/astro/tz';
import { horizonAltitude } from '../lib/transits/horizon';
import type { HorizonPoint } from '../lib/transits/types';
import { S } from '../strings';

const skyColor = (sunAlt: number) =>
  sunAlt > -0.833 ? 'var(--c-sky-day)' : sunAlt > -6 ? 'var(--c-sky-civil)' : sunAlt > -12 ? 'var(--c-sky-nautical)' : sunAlt > -18 ? 'var(--c-sky-astro)' : 'var(--c-sky-dark)';

/** Background bands from the night's sun-altitude samples. */
function SkyBands({ night, x, top, height }: { night: NightSummary; x: (ms: number) => number; top: number; height: number }) {
  const step = night.stepMin * 60000;
  return (
    <g>
      {night.sunAlt.map((a, i) => {
        const t0 = night.startMs + i * step;
        return <rect key={i} x={x(t0)} y={top} width={Math.max(0.5, x(t0 + step) - x(t0) + 0.5)} height={height} fill={skyColor(a)} />;
      })}
    </g>
  );
}

function hourTicks(startMs: number, endMs: number, tz: string, every = 2) {
  const ticks: number[] = [];
  const first = Math.ceil(startMs / 3600000) * 3600000;
  for (let t = first; t <= endMs; t += 3600000) {
    const h = Number(formatTime(t, tz).slice(0, 2));
    if (h % every === 0) ticks.push(t);
  }
  return ticks;
}

export function AltitudeChart({
  night,
  curve,
  event,
  minAlt,
  horizon,
  tz,
  width = 640,
  height = 220,
}: {
  night: NightSummary;
  curve: { ms: number; alt: number; az: number }[];
  event?: TransitEvent;
  minAlt: number;
  horizon: HorizonPoint[];
  tz: string;
  width?: number;
  height?: number;
}) {
  const pad = { l: 34, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (ms: number) => pad.l + ((ms - night.startMs) / (night.endMs - night.startMs)) * w;
  const y = (alt: number) => pad.t + (1 - Math.max(0, Math.min(90, alt)) / 90) * h;
  const path = curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.ms).toFixed(1)},${y(p.alt).toFixed(1)}`).join('');
  const moon = night.moonAlt.map((a, i) => `${i ? 'L' : 'M'}${x(night.startMs + i * night.stepMin * 60000).toFixed(1)},${y(a).toFixed(1)}`).join('');
  const horizonPath = horizon.length
    ? curve.map((p, i) => `${i ? 'L' : 'M'}${x(p.ms).toFixed(1)},${y(horizonAltitude(horizon, p.az)).toFixed(1)}`).join('')
    : '';
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={S.results.altitude}>
      <SkyBands night={night} x={x} top={pad.t} height={h} />
      {[0, 30, 60, 90].map((a) => (
        <g key={a}>
          <line x1={pad.l} x2={width - pad.r} y1={y(a)} y2={y(a)} stroke="var(--c-line)" strokeWidth={0.5} />
          <text x={pad.l - 4} y={y(a) + 3} textAnchor="end" className="num" fontSize={9} fill="var(--c-faint)">
            {a}°
          </text>
        </g>
      ))}
      {event && (
        <g>
          <rect x={x(event.windowStartMs)} y={pad.t} width={x(event.windowEndMs) - x(event.windowStartMs)} height={h} fill="var(--c-accent-2)" opacity={0.12} />
          <rect x={x(event.ingressMs)} y={pad.t} width={x(event.egressMs) - x(event.ingressMs)} height={h} fill="var(--c-accent)" opacity={0.18} />
          <line x1={x(event.midMs)} x2={x(event.midMs)} y1={pad.t} y2={pad.t + h} stroke="var(--c-accent)" strokeWidth={1} strokeDasharray="3 3" />
          {event.flipMs && <line x1={x(event.flipMs)} x2={x(event.flipMs)} y1={pad.t} y2={pad.t + h} stroke="var(--c-bad)" strokeWidth={1.5} />}
        </g>
      )}
      <line x1={pad.l} x2={width - pad.r} y1={y(minAlt)} y2={y(minAlt)} stroke="var(--c-warn)" strokeWidth={0.8} strokeDasharray="4 3" />
      {horizonPath && <path d={horizonPath} fill="none" stroke="var(--c-warn)" strokeWidth={1} opacity={0.7} />}
      <path d={moon} fill="none" stroke="var(--c-muted)" strokeWidth={1} strokeDasharray="2 3" />
      <path d={path} fill="none" stroke="var(--c-fg)" strokeWidth={1.6} />
      {hourTicks(night.startMs, night.endMs, tz).map((t) => (
        <text key={t} x={x(t)} y={height - 6} textAnchor="middle" className="num" fontSize={9} fill="var(--c-faint)">
          {formatTime(t, tz)}
        </text>
      ))}
    </svg>
  );
}

/** Trapezoid light curve (b = 0), with ±σ shading on mid-transit. */
export function LightCurve({ event, tz, width = 640, height = 160 }: { event: TransitEvent; tz: string; width?: number; height?: number }) {
  const pad = { l: 44, r: 8, t: 10, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const t0 = event.windowStartMs;
  const t1 = event.windowEndMs;
  const x = (ms: number) => pad.l + ((ms - t0) / (t1 - t0)) * w;
  const depth = event.depthPpt / 1000;
  const k = Math.sqrt(depth);
  const tau = (event.egressMs - event.ingressMs) * (k / (1 + k));
  const y = (flux: number) => pad.t + ((1 - flux) / (depth * 1.4)) * h;
  const pts: [number, number][] = [
    [t0, 1],
    [event.ingressMs, 1],
    [event.ingressMs + tau, 1 - depth],
    [event.egressMs - tau, 1 - depth],
    [event.egressMs, 1],
    [t1, 1],
  ];
  const sig = (event.sigmaMin ?? 0) * 60000;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={S.results.lightCurve}>
      <rect x={pad.l} y={pad.t} width={w} height={h} fill="var(--c-bg)" />
      {sig > 0 && <rect x={x(event.midMs - sig)} y={pad.t} width={x(event.midMs + sig) - x(event.midMs - sig)} height={h} fill="var(--c-accent)" opacity={0.1} />}
      <rect x={x(event.obsStartMs)} y={pad.t + h - 3} width={x(event.obsEndMs) - x(event.obsStartMs)} height={3} fill="var(--c-ok)" opacity={0.8} />
      <path d={pts.map(([t, f], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(f).toFixed(1)}`).join('')} fill="none" stroke="var(--c-accent)" strokeWidth={1.8} />
      <text x={pad.l - 4} y={y(1) + 3} textAnchor="end" fontSize={9} className="num" fill="var(--c-faint)">
        1.000
      </text>
      <text x={pad.l - 4} y={y(1 - depth) + 3} textAnchor="end" fontSize={9} className="num" fill="var(--c-faint)">
        {(1 - depth).toFixed(3)}
      </text>
      {[event.ingressMs, event.midMs, event.egressMs].map((t) => (
        <text key={t} x={x(t)} y={height - 6} textAnchor="middle" fontSize={9} className="num" fill="var(--c-faint)">
          {formatTime(t, tz)}
        </text>
      ))}
    </svg>
  );
}

export interface GanttRow {
  event: TransitEvent;
  selected: boolean;
  conflict: boolean;
}

/** Night timeline: twilight shading, Moon altitude, one row per transit. */
export function NightGantt({
  night,
  rows,
  tz,
  gapMin,
  onToggle,
  onOpen,
  width = 960,
}: {
  night: NightSummary;
  rows: GanttRow[];
  tz: string;
  gapMin: number;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  width?: number;
}) {
  const rowH = 22;
  const pad = { l: 150, r: 10, t: 18, b: 20 };
  // show from 1 h before sunset to 1 h after sunrise (or the whole night)
  const from = night.sunset ? night.sunset - 3600000 : night.startMs;
  const to = night.sunrise ? night.sunrise + 3600000 : night.endMs;
  const h = Math.max(1, rows.length) * rowH;
  const height = pad.t + h + pad.b;
  const w = width - pad.l - pad.r;
  const x = (ms: number) => pad.l + ((Math.min(to, Math.max(from, ms)) - from) / (to - from)) * w;
  const moonPath = useMemo(
    () =>
      night.moonAlt
        .map((a, i) => [night.startMs + i * night.stepMin * 60000, a] as const)
        .filter(([t]) => t >= from && t <= to)
        .map(([t, a], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${(pad.t + h - (Math.max(0, a) / 90) * h).toFixed(1)}`)
        .join(''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [night, from, to, h],
  );
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]" role="img" aria-label={`${S.schedule.title} ${night.date}`}>
      <SkyBands night={night} x={x} top={pad.t} height={h} />
      {hourTicks(from, to, tz, 1).map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={pad.t} y2={pad.t + h} stroke="var(--c-line)" strokeWidth={0.5} />
          <text x={x(t)} y={pad.t - 5} textAnchor="middle" fontSize={9} className="num" fill="var(--c-faint)">
            {formatTime(t, tz)}
          </text>
        </g>
      ))}
      <path d={moonPath} fill="none" stroke="var(--c-muted)" strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
      {rows.map(({ event: e, selected, conflict }, i) => {
        const yTop = pad.t + i * rowH + 3;
        const bh = rowH - 6;
        const dim = selected ? 1 : 0.35;
        return (
          <g key={e.id} className="cursor-pointer" onClick={() => onToggle(e.id)} onDoubleClick={() => onOpen(e.id)}>
            <title>{`${e.name} · ${formatTime(e.ingressMs, tz)}–${formatTime(e.egressMs, tz)}`}</title>
            <text x={pad.l - 6} y={yTop + bh - 4} textAnchor="end" fontSize={11} fill={selected ? 'var(--c-fg)' : 'var(--c-muted)'}>
              {e.name.length > 20 ? `${e.name.slice(0, 19)}…` : e.name}
            </text>
            {selected && gapMin > 0 && (
              <rect x={x(e.obsStartMs - gapMin * 60000)} y={yTop + bh / 2 - 1} width={x(e.obsStartMs) - x(e.obsStartMs - gapMin * 60000)} height={2} fill="var(--c-muted)" />
            )}
            <rect x={x(e.obsStartMs)} y={yTop} width={Math.max(1, x(e.obsEndMs) - x(e.obsStartMs))} height={bh} rx={2} fill="var(--c-accent-2)" opacity={0.35 * dim} />
            <rect x={x(e.ingressMs)} y={yTop} width={Math.max(1, x(e.egressMs) - x(e.ingressMs))} height={bh} rx={2} fill="var(--c-accent)" opacity={0.9 * dim} />
            {conflict && (
              <rect x={x(e.obsStartMs - gapMin * 60000)} y={yTop - 1} width={x(e.obsEndMs) - x(e.obsStartMs - gapMin * 60000)} height={bh + 2} rx={3} fill="none" stroke="var(--c-bad)" strokeWidth={1.5} />
            )}
            {e.flipMs && <line x1={x(e.flipMs)} x2={x(e.flipMs)} y1={yTop - 1} y2={yTop + bh + 1} stroke="var(--c-bad)" strokeWidth={1.5} />}
          </g>
        );
      })}
    </svg>
  );
}

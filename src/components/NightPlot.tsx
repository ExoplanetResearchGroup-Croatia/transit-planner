/**
 * The signature view: one night as a pulsar plot. Every candidate transit is a
 * white hairline across the night that dips at its predicted transit (depth on
 * a log scale), stacked like the CP 1919 plot: a dip occludes the lines below.
 * Scheduled transits are drawn at double weight. Click a line to schedule or
 * remove it, click a name to inspect it.
 */
import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { NightSummary } from '../lib/astro/darkness';
import type { TransitEvent, WarningCode } from '../lib/transits/types';
import { formatTime, wallClock } from '../lib/astro/tz';
import { S } from '../strings';
import { Badge, cx } from './ui';

const ROW_H = 40;
const BASE_Y = 12; // baseline inside a row; dips go down from here
const W = 1000; // viewBox width; stretched horizontally, strokes stay crisp

export function dipDepthPx(depthPpt: number): number {
  return 6 + 40 * Math.min(1, Math.log10(1 + depthPpt) / Math.log10(31));
}

const skyFill = (sunAlt: number) =>
  sunAlt > -0.833 ? 'var(--c-sky-day)' : sunAlt > -6 ? 'var(--c-sky-civil)' : sunAlt > -12 ? 'var(--c-sky-nautical)' : sunAlt > -18 ? 'var(--c-sky-astro)' : 'var(--c-sky-dark)';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface NightPlotProps {
  night: NightSummary;
  events: TransitEvent[];
  selected: Set<string>;
  conflicts: Map<string, string>;
  focusId: string | null;
  tz: string;
  zone: string;
  gapMin: number;
  visibleWarnings: (w: WarningCode[]) => WarningCode[];
  onToggle: (id: string) => void;
  onFocus: (id: string) => void;
}

const DEFAULT_ROWS = 14;
/** warnings that describe the night, not a single transit */
const NIGHT_WARNINGS: WarningCode[] = ['moon-bright'];

export function NightPlot({ night, events, selected, conflicts, focusId, tz, zone, gapMin, visibleWarnings, onToggle, onFocus }: NightPlotProps) {
  const [showAll, setShowAll] = useState(false);
  // time axis: an hour before sunset to an hour after sunrise (or the whole night)
  const from = night.sunset ? night.sunset - 3600_000 : night.startMs;
  const to = night.sunrise ? night.sunrise + 3600_000 : night.endMs;
  const x = (ms: number) => ((Math.min(to, Math.max(from, ms)) - from) / (to - from)) * W;
  const pct = (ms: number) => `${(x(ms) / W) * 100}%`;

  const rows = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.obsStartMs - b.obsStartMs);
    if (showAll || sorted.length <= DEFAULT_ROWS) return sorted;
    const keep = new Set([...sorted.filter((e) => selected.has(e.id)).map((e) => e.id), ...[...sorted].sort((a, b) => b.score - a.score).slice(0, DEFAULT_ROWS).map((e) => e.id)]);
    return sorted.filter((e) => keep.has(e.id));
  }, [events, selected, showAll]);

  const nSel = events.filter((e) => selected.has(e.id)).length;
  // warnings every transit of this night shares (e.g. a bright Moon) belong to the night, not to each row
  const common = useMemo(() => {
    const vis = events.map((e) => new Set(visibleWarnings(e.warnings)));
    // conditions of the night itself (a bright Moon) always go to the header, whatever the number of transits
    const nightWide = NIGHT_WARNINGS.filter((w) => vis.some((st) => st.has(w)));
    const shared = vis.length >= 2 ? [...vis[0]].filter((w) => !nightWide.includes(w) && vis.every((st) => st.has(w))) : [];
    return [...nightWide, ...shared];
  }, [events, visibleWarnings]);
  const [y, m, d] = night.date.split('-').map(Number);
  const weekday = WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const hours: number[] = [];
  for (let t = Math.ceil(from / 3600_000) * 3600_000; t <= to; t += 3600_000) hours.push(t);
  const height = Math.max(1, rows.length) * ROW_H + 18;

  const stripH = 30;
  const moonPath = night.moonAlt
    .map((a, i) => [night.startMs + i * night.stepMin * 60_000, a] as const)
    .filter(([t]) => t >= from && t <= to)
    .map(([t, a], i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${(stripH - 3 - (Math.max(0, a) / 90) * (stripH - 6)).toFixed(1)}`)
    .join('');

  return (
    <section id={`night-${night.date}`} className="scroll-mt-6 border-t border-line pt-6 pb-8" aria-label={`Night of ${night.date}`}>
      <header className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-2">
        <div className="display text-[56px] text-fg">{String(d).padStart(2, '0')}</div>
        <div className="flex flex-col gap-1 pb-1">
          <span className="caps text-fg">
            {weekday} · {MONTH[m - 1]} {y}
          </span>
          <span className="caps text-muted">
            {night.status === 'no-darkness'
              ? S.plan.noDarkness
              : `${S.plan.dark} ${formatTime(night.darkStart!, tz)}–${formatTime(night.darkEnd!, tz)} ${zone} · ${S.plan.moon} ${Math.round(night.moonIllum * 100)} %`}
          </span>
        </div>
        {common.length > 0 && (
          <div className="flex flex-wrap gap-3 pb-1">
            {common.map((w) => (
              <Badge key={w} tone="warn">
                {S.warnings[w]}
              </Badge>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-4 pb-1">
          <span className="caps text-muted">{S.plan.ofCandidates(nSel, events.length)}</span>
          {events.length > DEFAULT_ROWS && (
            <button type="button" className="caps text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg" onClick={() => setShowAll((v) => !v)}>
              {showAll ? S.plan.showFewer : S.plan.showAll(events.length)}
            </button>
          )}
        </div>
      </header>

      {events.length === 0 ? (
        <p className="text-sm text-muted">{S.plan.nothing}</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[minmax(96px,120px)_1fr_76px] gap-x-3 md:min-w-[720px] md:grid-cols-[minmax(132px,210px)_1fr_96px] md:gap-x-4">
            {/* hour labels + sky strip */}
            <div className="sticky left-0 z-10 bg-bg" />
            <div className="relative h-5">
              {hours.map((t) => {
                const h = wallClock(t, tz).hour;
                return (
                  <span key={t} className="num absolute -translate-x-1/2 text-[11px] text-faint" style={{ left: pct(t) }}>
                    {h % 2 === 0 ? String(h).padStart(2, '0') : ''}
                  </span>
                );
              })}
            </div>
            <div />
            <div className="sticky left-0 z-10 flex items-center bg-bg caps text-faint">{S.plan.moon}</div>
            <svg viewBox={`0 0 ${W} ${stripH}`} preserveAspectRatio="none" className="h-[30px] w-full" aria-hidden>
              {night.sunAlt.map((a, i) => {
                const t0 = night.startMs + i * night.stepMin * 60_000;
                const t1 = t0 + night.stepMin * 60_000;
                if (t1 < from || t0 > to) return null;
                return <rect key={i} x={x(t0)} y={0} width={Math.max(0.5, x(t1) - x(t0) + 0.4)} height={stripH} fill={skyFill(a)} />;
              })}
              <path d={moonPath} fill="none" stroke="var(--c-muted)" strokeWidth={1} strokeDasharray="1 3" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex items-center text-[11px] text-faint">{Math.round(night.moonIllum * 100)} %</div>

            {/* rows: labels | one shared plot | times */}
            <div className="sticky left-0 z-10 mt-2 bg-bg pr-2" style={{ height }}>
              {rows.map((e) => {
                const on = selected.has(e.id);
                const warns = visibleWarnings(e.warnings).filter((w) => !common.includes(w));
                return (
                  <div key={e.id} className={cx('flex items-center gap-2.5', focusId === e.id && 'text-fg')} style={{ height: ROW_H }}>
                    <input type="checkbox" className="tp-check" checked={on} onChange={() => onToggle(e.id)} aria-label={on ? S.plan.toggleOff(e.name) : S.plan.toggleOn(e.name)} />
                    <button
                      type="button"
                      onClick={() => onFocus(e.id)}
                      className={cx(
                        'min-w-0 flex-1 truncate text-left text-[13px] transition-colors duration-150',
                        focusId === e.id ? 'text-fg underline decoration-red decoration-2 underline-offset-4' : on ? 'text-fg hover:underline' : 'text-muted hover:text-fg',
                      )}
                    >
                      {e.name}
                    </button>
                    {warns.length > 0 && <TriangleAlert size={12} strokeWidth={1.5} className="shrink-0 text-yellow" aria-label={warns.map((w) => S.warnings[w]).join('; ')} />}
                  </div>
                );
              })}
            </div>

            <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="mt-2 w-full overflow-visible" style={{ height }} role="group" aria-label={`Transits on the night of ${night.date}`}>
              {/* hour grid */}
              {hours.map((t) => (
                <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={height} stroke="var(--c-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              ))}
              {/* focus band */}
              {rows.map((e, i) =>
                focusId === e.id ? <rect key={`f-${e.id}`} x={0} y={i * ROW_H} width={W} height={ROW_H} fill="var(--c-panel-2)" /> : null,
              )}
              {/* lines, bottom row first so each dip occludes the rows below it */}
              {[...rows].reverse().map((e) => {
                const i = rows.indexOf(e);
                const y0 = i * ROW_H + BASE_Y;
                const dip = dipDepthPx(e.depthPpt);
                const k = Math.sqrt(e.depthPpt / 1000);
                const tau = (e.egressMs - e.ingressMs) * (k / (1 + k));
                const on = selected.has(e.id);
                const conflict = !on && conflicts.has(e.id);
                const xa = x(e.obsStartMs);
                const xb = x(e.obsEndMs);
                const xi = x(e.ingressMs);
                const xi2 = x(e.ingressMs + tau);
                const xe2 = x(e.egressMs - tau);
                const xe = x(e.egressMs);
                const dipPath = `M${xi},${y0} L${xi2},${y0 + dip} L${xe2},${y0 + dip} L${xe},${y0}`;
                const windowPath = `M${xa},${y0} L${xi},${y0} L${xi2},${y0 + dip} L${xe2},${y0 + dip} L${xe},${y0} L${xb},${y0}`;
                return (
                  <g key={e.id} className="cursor-pointer" onClick={() => onToggle(e.id)} onMouseDown={(ev) => ev.preventDefault()}>
                    <title>{`${e.name} · ${formatTime(e.ingressMs, tz)}–${formatTime(e.egressMs, tz)} · ${on ? S.plan.unschedule : S.plan.schedule}`}</title>
                    <rect x={0} y={i * ROW_H} width={W} height={ROW_H} fill="transparent" />
                    <line x1={0} x2={W} y1={y0} y2={y0} stroke="var(--c-plot-dim)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                    <path d={`${dipPath} Z`} fill="var(--c-bg)" />
                    {on && gapMin > 0 && (
                      <line x1={x(e.obsStartMs - gapMin * 60_000)} x2={xa} y1={y0} y2={y0} stroke="var(--c-fg)" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
                    )}
                    <path
                      d={windowPath}
                      fill="none"
                      className="plot-row-line"
                      stroke={on ? 'var(--c-fg)' : 'var(--c-plot-mid)'}
                      strokeWidth={on ? 2.25 : 1}
                      strokeDasharray={conflict ? '4 3' : undefined}
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                    {e.flipMs && <line x1={x(e.flipMs)} x2={x(e.flipMs)} y1={y0 - 6} y2={y0 + 6} stroke="var(--c-red)" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                  </g>
                );
              })}
            </svg>

            <div className="mt-2" style={{ height }}>
              {rows.map((e) => (
                <div key={e.id} className={cx('num flex items-center justify-end text-[12px]', selected.has(e.id) ? 'text-fg' : 'text-faint')} style={{ height: ROW_H }}>
                  {formatTime(e.ingressMs, tz)}–{formatTime(e.egressMs, tz)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

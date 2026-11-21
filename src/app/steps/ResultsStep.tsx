import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as Dialog from '@radix-ui/react-dialog';
import { useStore } from '../../state/store';
import { S } from '../../strings';
import { Badge, Button, Card, StepHeader, Stat, cx, inputCls } from '../../components/ui';
import { requestKey, runCompute, usePlanRequest, useResolvedEquipment, useTimeFmt } from '../hooks';
import type { TransitEvent, WarningCode } from '../../lib/transits/types';
import { MODE_WARNINGS } from '../../state/defaults';
import { AltitudeChart, LightCurve } from '../../components/charts';
import { SkyView } from '../../components/SkyView';
import { altitudeCurve, effectiveMinAltitude } from '../../lib/transits/compute';
import { formatDec, formatRa } from '../../lib/export/model';

type SortKey = 'score' | 'name' | 'midMs' | 'mag' | 'depthPpt' | 'durationH' | 'altMid' | 'sigmaMin' | 'night';

export function useVisibleWarnings() {
  const mode = useStore((s) => s.mode);
  return (codes: WarningCode[]) => (MODE_WARNINGS[mode] ? codes.filter((c) => MODE_WARNINGS[mode]!.has(c)) : codes);
}

const PRIORITY_TONE = { alert: 'bad', high: 'warn', medium: 'accent', low: 'neutral' } as const;

export function ResultsStep() {
  const req = usePlanRequest();
  const result = useStore((s) => s.result);
  const resultKey = useStore((s) => s.resultKey);
  const computing = useStore((s) => s.computing);
  const progress = useStore((s) => s.progress);
  const catalog = useStore((s) => s.catalog);
  const selected = useStore((s) => s.selected);
  const set = useStore((s) => s.set);
  const toggle = useStore((s) => s.toggleSelected);
  const detailId = useStore((s) => s.detailId);
  const f = useTimeFmt();
  const vis = useVisibleWarnings();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'score', dir: -1 });
  const [error, setError] = useState<string | null>(null);
  const stale = result !== null && resultKey !== requestKey(req);

  // compute automatically when arriving here with new inputs
  useEffect(() => {
    if (req && catalog.status === 'ready' && !computing && (result === null || stale)) {
      runCompute(req).catch((e) => setError(String(e)));
    }
    // re-check when a run finishes: inputs may have changed while it was computing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog.status, requestKey(req), computing]);

  const rows = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    const list = q ? result.events.filter((e) => e.name.toLowerCase().includes(q) || (e.host ?? '').toLowerCase().includes(q)) : [...result.events];
    const k = sort.key;
    list.sort((a, b) => {
      const va = a[k] as number | string | null;
      const vb = b[k] as number | string | null;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number)) * sort.dir;
    });
    return list;
  }, [result, query, sort]);

  const parentRef = useRef<HTMLDivElement>(null);
  const virt = useVirtualizer({ count: rows.length, getScrollElement: () => parentRef.current, estimateSize: () => 34, overscan: 12 });
  const sel = new Set(selected);
  const detail = result?.events.find((e) => e.id === detailId) ?? null;

  const head = (key: SortKey | null, label: string, cls = '') => (
    <button
      type="button"
      disabled={!key}
      onClick={() => key && setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : key === 'name' || key === 'midMs' || key === 'mag' || key === 'sigmaMin' || key === 'night' ? 1 : -1 }))}
      className={cx('truncate text-left text-xs font-normal text-faint', key && 'hover:text-fg', cls)}
    >
      {label}
      {key && sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
    </button>
  );
  const grid = 'grid grid-cols-[28px_minmax(130px,1.4fr)_84px_repeat(4,58px)_52px_60px_52px_52px_52px_minmax(110px,1fr)_60px] items-center gap-x-2 px-3';

  return (
    <div>
      <StepHeader
        title={S.results.title}
        intro={result ? `${S.results.found(result.events.length, result.nights.length)} · ${S.results.considered(result.targetsConsidered)} · ${f.zone()}` : undefined}
        actions={
          <>
            {selected.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => set({ selected: [] })}>
                {S.results.clearSelection} ({selected.length})
              </Button>
            )}
            <Button variant="primary" disabled={!req || computing || catalog.status !== 'ready'} onClick={() => req && runCompute(req).catch((e) => setError(String(e)))}>
              {computing ? `${S.results.computing} ${Math.round(progress * 100)} %` : result ? S.results.recompute : S.results.compute}
            </Button>
          </>
        }
      />
      {stale && !computing && <p className="mb-3 text-sm text-warn">{S.results.stale}</p>}
      {error && <p className="mb-3 text-sm text-bad">{error}</p>}
      {catalog.status === 'loading' && <p className="text-sm text-muted">{S.app.loadingCatalog}</p>}
      {result && Object.keys(result.rejected).length > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>{S.results.rejected}:</span>
          {Object.entries(result.rejected)
            .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
            .map(([k, v]) => (
              <Badge key={k}>
                {S.reject[k as keyof typeof S.reject]} <span className="num ml-1">{v}</span>
              </Badge>
            ))}
        </p>
      )}

      <Card className="overflow-hidden" title={<input className={cx(inputCls, 'h-8 w-56')} placeholder={S.results.search} value={query} onChange={(e) => setQuery(e.target.value)} />} actions={<span className="text-xs text-muted">{S.results.selectedCount(selected.length)}</span>}>
        <div className="-m-4 overflow-x-auto">
          <div className="min-w-[1080px]">
            <div className={cx(grid, 'h-8 border-b border-line bg-panel-2')}>
              <span />
              {head('name', S.results.columns.name)}
              {head('night', S.results.columns.night)}
              {head(null, S.results.columns.start)}
              {head('midMs', S.results.columns.ingress)}
              {head('midMs', S.results.columns.mid)}
              {head(null, S.results.columns.egress)}
              {head('mag', S.results.columns.mag)}
              {head('depthPpt', S.results.columns.depth)}
              {head('durationH', S.results.columns.dur)}
              {head('altMid', S.results.columns.alt)}
              {head('sigmaMin', S.results.columns.sigma)}
              {head(null, S.results.columns.cov)}
              {head('score', S.results.columns.score)}
            </div>
            <div ref={parentRef} className="h-[56vh] min-h-[320px] overflow-y-auto">
              {rows.length === 0 && result && <p className="p-6 text-sm text-muted">{S.results.empty}</p>}
              <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
                {virt.getVirtualItems().map((vi) => {
                  const e = rows[vi.index];
                  const warns = vis(e.warnings);
                  return (
                    <div
                      key={e.id}
                      className={cx(grid, 'absolute top-0 left-0 w-full cursor-pointer border-b border-line/50 text-sm hover:bg-panel-2', sel.has(e.id) && 'bg-accent/5')}
                      style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
                      onClick={() => set({ detailId: e.id })}
                    >
                      <input type="checkbox" aria-label={`select ${e.name}`} className="h-4 w-4 accent-[var(--c-accent)]" checked={sel.has(e.id)} onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(e.id)} />
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{e.name}</span>
                        {e.priority && <Badge tone={PRIORITY_TONE[e.priority]}>{e.priority}</Badge>}
                        {e.source === 'toi' && <Badge tone="info">TOI</Badge>}
                      </span>
                      <span className="num text-xs text-muted">{e.night.slice(5)}</span>
                      <span className="num text-muted">{f.t(e.obsStartMs)}</span>
                      <span className="num">{f.t(e.ingressMs)}</span>
                      <span className="num">{f.t(e.midMs)}</span>
                      <span className="num">{f.t(e.egressMs)}</span>
                      <span className="num" title={e.magBand ?? ''}>
                        {e.mag?.toFixed(1) ?? '—'}
                        {e.magBand && e.magBand !== 'V' && <sub className="text-faint">{e.magBand}</sub>}
                      </span>
                      <span className="num">{e.depthPpt.toFixed(1)}</span>
                      <span className="num">{e.durationH.toFixed(1)}h</span>
                      <span className="num">{Math.round(e.altMid)}°</span>
                      <span className={cx('num', (e.sigmaMin ?? 0) > 10 && 'text-warn')}>{e.sigmaMin === null ? '?' : e.sigmaMin < 10 ? e.sigmaMin.toFixed(1) : Math.round(e.sigmaMin)}</span>
                      <span className="flex min-w-0 items-center gap-1">
                        <Badge tone={e.coverage === 'full' ? 'ok' : e.coverage === 'partial' ? 'bad' : 'warn'}>{S.results.coverage[e.coverage]}</Badge>
                        {warns.length > 0 && (
                          <span className="truncate text-xs text-warn" title={warns.map((w) => S.warnings[w]).join('\n')}>
                            ⚠ {warns.length}
                          </span>
                        )}
                      </span>
                      <span className="num text-muted">{e.score.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <EventDetail event={detail} onClose={() => set({ detailId: null })} />
    </div>
  );
}

export function EventDetail({ event, onClose }: { event: TransitEvent | null; onClose: () => void }) {
  const req = usePlanRequest();
  const result = useStore((s) => s.result);
  const selected = useStore((s) => s.selected);
  const toggle = useStore((s) => s.toggleSelected);
  const catalog = useStore((s) => s.catalog.targets);
  const toi = useStore((s) => s.toi.targets);
  const eq = useResolvedEquipment();
  const f = useTimeFmt();
  const vis = useVisibleWarnings();
  const night = event && result ? result.nights.find((n) => n.date === event.night) : null;
  const curve = useMemo(() => (event && night && req ? altitudeCurve(req, event, night) : []), [event, night, req]);
  const target = event ? (catalog.find((t) => t.id === event.targetId) ?? toi.find((t) => t.id === event.targetId)) : undefined;
  return (
    <Dialog.Root open={!!event} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content className="fixed top-0 right-0 z-50 h-full w-full max-w-[720px] overflow-y-auto border-l border-line bg-panel p-5 shadow-2xl focus:outline-none">
          {event && night && req && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold">{event.name}</Dialog.Title>
                  <Dialog.Description className="num text-xs text-muted">
                    {formatRa(event.ra)} · {formatDec(event.dec)} · {S.results.columns.night} {event.night}
                  </Dialog.Description>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant={selected.includes(event.id) ? 'primary' : 'secondary'} onClick={() => toggle(event.id)}>
                    {selected.includes(event.id) ? '✓ ' : '+ '}
                    {S.schedule.title}
                  </Button>
                  <Dialog.Close asChild>
                    <Button size="sm" variant="ghost">
                      {S.results.close}
                    </Button>
                  </Dialog.Close>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 rounded-md border border-line bg-bg p-3 sm:grid-cols-6">
                <Stat label={S.results.columns.start} value={f.t(event.obsStartMs)} />
                <Stat label={S.results.columns.ingress} value={f.t(event.ingressMs)} />
                <Stat label={S.results.columns.mid} value={f.t(event.midMs)} />
                <Stat label={S.results.columns.egress} value={f.t(event.egressMs)} />
                <Stat label={S.results.columns.end} value={f.t(event.obsEndMs)} />
                <Stat label={S.results.columns.sigma} value={event.sigmaMin === null ? '?' : `${event.sigmaMin.toFixed(1)} min`} />
                <Stat label={S.results.columns.depth} value={`${event.depthPpt.toFixed(2)} ppt`} />
                <Stat label={S.results.columns.dur} value={`${event.durationH.toFixed(2)} h`} />
                <Stat label={S.results.columns.mag} value={event.mag === null ? '—' : `${event.mag.toFixed(2)} ${event.magBand}`} />
                <Stat label={S.results.columns.alt} value={`${event.altMid.toFixed(0)}° (min ${event.altMinObs.toFixed(0)}°)`} />
                <Stat label={S.results.columns.moon} value={`${event.moonSepDeg.toFixed(0)}° · ${Math.round(event.moonIllum * 100)} %`} />
                <Stat label={S.results.columns.cov} value={`${Math.round(event.transitFraction * 100)} %`} sub={`${Math.round(event.baselineBeforeMin)} / ${Math.round(event.baselineAfterMin)} min`} />
              </div>
              {vis(event.warnings).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {vis(event.warnings).map((w) => (
                    <Badge key={w} tone={w.startsWith('flip') || w === 'partial' ? 'bad' : 'warn'}>
                      {S.warnings[w]}
                    </Badge>
                  ))}
                  {event.flipMs && (
                    <Badge tone="bad">
                      {S.results.flipAt} {f.t(event.flipMs)}
                    </Badge>
                  )}
                </div>
              )}
              <section>
                <h4 className="mb-1 text-xs font-medium text-muted">
                  {S.results.altitude} · {f.zone(event.midMs)}
                </h4>
                <AltitudeChart night={night} curve={curve} event={event} minAlt={effectiveMinAltitude(req)} horizon={req.site.horizon} tz={f.tz} />
              </section>
              <section>
                <h4 className="mb-1 text-xs font-medium text-muted">
                  {S.results.lightCurve}
                </h4>
                <LightCurve event={event} tz={f.tz} />
                <p className="text-xs text-faint">{S.results.lightCurveHint}</p>
              </section>
              <section>
                <h4 className="mb-2 text-xs font-medium text-muted">{S.results.sky}</h4>
                <SkyView ra={event.ra} dec={event.dec} fov={eq?.derived ? { w: eq.derived.fovWidthDeg, h: eq.derived.fovHeightDeg } : null} />
              </section>
              {target && (
                <section className="num rounded-md border border-line bg-bg p-3 text-xs text-muted">
                  <div>
                    {S.results.ephemeris}: T0 = {target.t0.toFixed(6)} BJD_TDB ± {target.t0Err?.toExponential(1) ?? '?'} d · P = {target.period.toFixed(8)} d ± {target.periodErr?.toExponential(1) ?? '?'} d
                  </div>
                  <div>
                    {S.results.source}: {target.source} · {S.results.reference}: {target.ephemRef ?? '—'} · {S.results.epoch} {event.epoch}
                  </div>
                </section>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

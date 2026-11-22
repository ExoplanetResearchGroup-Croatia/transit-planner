import { useMemo, useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Download, Link2, Printer, Settings2, RotateCcw, LoaderCircle } from 'lucide-react';
import { useStore } from '../state/store';
import { S } from '../strings';
import { Badge, Button, CodeStrip, Meter, Segmented, cx } from '../components/ui';
import { NightPlot } from '../components/NightPlot';
import { LightCurve, SkyTrack } from '../components/charts';
import { SkyView } from '../components/SkyView';
import { gapMinutes, resetPlan, toggleScheduled, usePlanRequest, useResolvedEquipment, useSite, useTimeFmt } from './hooks';
import { MODE_WARNINGS } from '../state/defaults';
import type { TransitEvent, WarningCode } from '../lib/transits/types';
import { overlaps } from '../lib/schedule/schedule';
import { runExport, buildPlan, type ExportFormat } from './exportActions';
import { formatDec, formatRa, jobsByNight } from '../lib/export/model';

export function useVisibleWarnings() {
  const mode = useStore((s) => s.mode);
  return (codes: WarningCode[]) => (MODE_WARNINGS[mode] ? codes.filter((c) => MODE_WARNINGS[mode]!.has(c)) : codes);
}

/* --------------------------------------------------------------- settings strip */

export function SettingsStrip() {
  const site = useSite();
  const eq = useResolvedEquipment();
  const s = useStore();
  const f = s.filters[s.mode];
  const req = usePlanRequest();
  const tf = useTimeFmt();
  const open = (m: 'location' | 'equipment' | 'nights' | 'filters') => s.set({ modal: m });
  const nightsLabel = req ? `${req.firstNight.slice(5).replace('-', '.')} · ${req.nights} ${req.nights === 1 ? 'night' : 'nights'} · ${s.darkness === 'astronomical' ? '−18°' : s.darkness === 'nautical' ? '−12°' : '−6°'}` : '—';
  const items: { id: 'location' | 'equipment' | 'nights' | 'filters'; label: string; value: string }[] = [
    { id: 'location', label: S.strip.location, value: site && Number.isFinite(site.lat) ? `${site.name} · ${Math.abs(site.lat).toFixed(2)}${site.lat >= 0 ? 'N' : 'S'} ${Math.abs(site.lon).toFixed(2)}${site.lon >= 0 ? 'E' : 'W'} · ${tf.zone()}` : S.strip.noLocation },
    { id: 'equipment', label: S.strip.equipment, value: eq?.name ?? S.strip.noEquipment },
    { id: 'nights', label: S.strip.nights, value: nightsLabel },
    { id: 'filters', label: S.strip.filters, value: S.filters.summary(f.magMax, f.depthMinPpt, f.minAlt) },
  ];
  return (
    <div className="grid border-y border-line sm:grid-cols-2 xl:grid-cols-4">
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          onClick={() => open(it.id)}
          className={cx('group flex min-w-0 flex-col gap-1.5 px-4 py-3 text-left transition-colors duration-150 hover:bg-panel', i > 0 && 'border-t border-line sm:border-t-0 sm:border-l')}
        >
          <span className="flex items-center justify-between caps text-muted">
            {it.label}
            <span className="text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100">{S.strip.edit}</span>
          </span>
          <span className="truncate text-sm text-fg">{it.value}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ export menu */

export function ExportMenu() {
  const eq = useResolvedEquipment();
  const req = usePlanRequest();
  const selected = useStore((s) => s.selected);
  const result = useStore((s) => s.result);
  const [note, setNote] = useState<string | null>(null);
  const plan = useMemo(() => buildPlan(eq), [eq, selected, result]); // eslint-disable-line react-hooks/exhaustive-deps
  const nights = plan ? jobsByNight(plan.jobs).size : 0;
  const vendor = !!eq?.vendorApp;
  const go = async (fmt: ExportFormat) => {
    const files = await runExport(fmt, eq, req);
    if (fmt === 'share') setNote(S.export.shareCopied);
    else if (files.length) setNote(S.export.downloaded(files.join(', ')));
    setTimeout(() => setNote(null), 3500);
  };
  const item = (fmt: ExportFormat, title: string, desc: string, ext: string, disabled = false) => (
    <Menu.Item
      key={fmt}
      disabled={disabled}
      onSelect={() => void go(fmt)}
      className="flex cursor-pointer items-center gap-4 px-4 py-2.5 outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-35 data-[highlighted]:bg-fg data-[highlighted]:text-bg"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm">{title}</span>
        <span className="text-xs opacity-60">{desc}</span>
      </span>
      <span className="caps opacity-70">{ext}</span>
    </Menu.Item>
  );
  return (
    <div className="relative">
      {note && (
        <span role="status" className="absolute top-full right-0 mt-2 whitespace-nowrap text-xs text-muted">
          {note}
        </span>
      )}
      <Menu.Root modal={false}>
        <Menu.Trigger asChild>
          <Button variant="primary" icon={<Download size={14} strokeWidth={1.5} />} disabled={!plan}>
            {S.export.button}
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content align="end" sideOffset={6} className="z-50 w-[340px] border border-line-strong bg-bg py-2 text-fg shadow-[0_18px_40px_rgba(0,0,0,0.55)]">
            <div className="px-4 pt-1 pb-2 caps text-muted">{plan ? S.export.heading(plan.jobs.length, nights) : S.export.nothing}</div>
            {vendor && <div className="px-4 pb-2 text-xs text-yellow">{S.export.vendorApp}</div>}
            {item('esl', S.export.ekos, S.export.ekosDesc, '.esl', vendor)}
            {item('esq', S.export.esq, S.export.esqDesc, '.esq', vendor)}
            {item('nina', S.export.nina, S.export.ninaDesc, '.json', vendor)}
            <Menu.Separator className="my-2 h-px bg-line" />
            {item('csv', S.export.csv, S.export.csvDesc, '.csv')}
            {item('ics', S.export.ics, S.export.icsDesc, '.ics')}
            {item('json', S.export.json, S.export.jsonDesc, '.json')}
            <Menu.Separator className="my-2 h-px bg-line" />
            <Menu.Item onSelect={() => void go('share')} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm outline-none data-[highlighted]:bg-fg data-[highlighted]:text-bg">
              <Link2 size={14} strokeWidth={1.5} /> {S.export.share}
            </Menu.Item>
            <Menu.Item onSelect={() => void go('print')} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm outline-none data-[highlighted]:bg-fg data-[highlighted]:text-bg">
              <Printer size={14} strokeWidth={1.5} /> {S.export.print}
            </Menu.Item>
            <Menu.Item
              onSelect={() => useStore.getState().set({ modal: 'export' })}
              className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-muted outline-none data-[highlighted]:bg-fg data-[highlighted]:text-bg"
            >
              <Settings2 size={14} strokeWidth={1.5} /> {S.export.settings}
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  );
}

/* --------------------------------------------------------------------- inspector */

function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2">
      <dt className="caps text-muted">{k}</dt>
      <dd className={cx('num text-right text-[13px]', strong ? 'text-fg' : 'text-fg/90')}>{v}</dd>
    </div>
  );
}

export function Inspector({ event }: { event: TransitEvent | null }) {
  const req = usePlanRequest();
  const result = useStore((s) => s.result);
  const selected = useStore((s) => s.selected);
  const catalog = useStore((s) => s.catalog.targets);
  const toi = useStore((s) => s.toi.targets);
  const eq = useResolvedEquipment();
  const tf = useTimeFmt();
  const vis = useVisibleWarnings();
  if (!event || !result || !req) return <p className="text-sm text-muted">{S.inspector.none}</p>;
  const night = result.nights.find((n) => n.date === event.night)!;
  const target = catalog.find((t) => t.id === event.targetId) ?? toi.find((t) => t.id === event.targetId);
  const on = selected.includes(event.id);
  const warns = vis(event.warnings);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <h2 className="display text-[30px] break-words text-fg">{event.name}</h2>
        <div className="flex flex-wrap items-center gap-3">
          <CodeStrip size="sm" on={[on ? 'red' : 'grey', ...(warns.length ? (['yellow'] as const) : []), ...(event.priority === 'alert' || event.priority === 'high' ? (['blue'] as const) : [])]} />
          <span className="num text-xs text-muted">
            {formatRa(event.ra)} · {formatDec(event.dec)}
          </span>
        </div>
        <Button variant={on ? 'secondary' : 'primary'} block={on ? 'none' : 'red'} onClick={() => toggleScheduled(event.id)}>
          {on ? S.plan.unschedule : S.plan.schedule}
        </Button>
      </div>
      <dl>
        <Row k={S.inspector.observe} v={`${tf.t(event.obsStartMs)}–${tf.t(event.obsEndMs)}`} strong />
        <Row k={S.inspector.ingress} v={tf.t(event.ingressMs)} strong />
        <Row k={S.inspector.mid} v={tf.t(event.midMs)} strong />
        <Row k={S.inspector.egress} v={tf.t(event.egressMs)} strong />
        <Row k={S.inspector.sigma} v={event.sigmaMin === null ? '?' : `±${event.sigmaMin.toFixed(1)} ${S.inspector.min}`} />
        <Row k={S.inspector.depth} v={`${event.depthPpt.toFixed(2)} ppt`} />
        <Row k={S.inspector.duration} v={`${event.durationH.toFixed(2)} h`} />
        <Row k={S.inspector.mag} v={event.mag === null ? '—' : `${event.mag.toFixed(2)} ${event.magBand}`} />
        <Row
          k={S.inspector.altitude}
          v={
            <span className="flex items-center gap-3">
              <Meter value={event.altMinObs / 90} label={`${S.inspector.altitude} ${event.altMinObs.toFixed(0)}°`} />
              {event.altMid.toFixed(0)}° · min {event.altMinObs.toFixed(0)}°
            </span>
          }
        />
        <Row
          k={S.inspector.moon}
          v={
            <span className="flex items-center gap-3">
              <Meter value={event.moonIllum} alert={event.moonIllum > 0.7 && event.moonAltMid > 0} label={`${S.inspector.moon} ${Math.round(event.moonIllum * 100)} %`} />
              {event.moonSepDeg.toFixed(0)}° · {Math.round(event.moonIllum * 100)} %
            </span>
          }
        />
        <Row k={S.inspector.coverage} v={`${S.inspector.coverageNames[event.coverage]} · ${Math.round(event.baselineBeforeMin)}/${Math.round(event.baselineAfterMin)} ${S.inspector.min}`} />
        {event.flipMs && <Row k={S.inspector.flip} v={tf.t(event.flipMs)} />}
        {event.priority && <Row k={S.inspector.priority} v={event.priority} />}
        <Row k={S.inspector.source} v={target?.ephemRef ?? event.source} />
      </dl>
      {warns.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {warns.map((w) => (
            <li key={w}>
              <Badge tone={w.startsWith('flip') || w === 'partial' ? 'bad' : 'warn'}>{S.warnings[w]}</Badge>
            </li>
          ))}
        </ul>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="caps text-muted">{S.inspector.lightCurve}</h3>
        <LightCurve event={event} tz={tf.tz} />
        <p className="text-[11px] text-faint">{S.inspector.lightCurveHint}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="caps text-muted">{S.inspector.skyTrack}</h3>
        <SkyTrack req={req} event={event} night={night} horizon={req.site.horizon} />
        <p className="text-[11px] text-faint">{S.inspector.skyTrackHint}</p>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="caps text-muted">{S.inspector.sky}</h3>
        <SkyView key={event.id} ra={event.ra} dec={event.dec} fov={eq?.derived ? { w: eq.derived.fovWidthDeg, h: eq.derived.fovHeightDeg } : null} />
      </section>
      {target && (
        <p className="num text-[11px] leading-relaxed text-faint">
          T0 {target.t0.toFixed(6)} BJD_TDB ± {target.t0Err?.toExponential(1) ?? '?'} d · P {target.period.toFixed(8)} d ± {target.periodErr?.toExponential(1) ?? '?'} d · {S.inspector.epoch}{' '}
          {event.epoch}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- plan page */

export function PlanPage() {
  const result = useStore((s) => s.result);
  const selectedList = useStore((s) => s.selected);
  const focusId = useStore((s) => s.focusId);
  const computing = useStore((s) => s.computing);
  const picks = useStore((s) => s.picks);
  const drops = useStore((s) => s.drops);
  const geo = useStore((s) => s.geo);
  const catalog = useStore((s) => s.catalog);
  const mode = useStore((s) => s.mode);
  const timeDisplay = useStore((s) => s.timeDisplay);
  const set = useStore((s) => s.set);
  const req = usePlanRequest();
  const tf = useTimeFmt();
  const vis = useVisibleWarnings();
  const selected = useMemo(() => new Set(selectedList), [selectedList]);
  const gap = gapMinutes();

  const events = result?.events ?? [];
  const conflicts = useMemo(() => {
    const m = new Map<string, string>();
    const sel = events.filter((e) => selected.has(e.id));
    for (const e of events) {
      if (selected.has(e.id)) continue;
      const hit = sel.find((s) => overlaps(s, e, gap));
      if (hit) m.set(e.id, hit.id);
    }
    return m;
  }, [events, selected, gap]);
  const focus = events.find((e) => e.id === focusId) ?? null;
  const plan = useMemo(() => (result ? [...events.filter((e) => selected.has(e.id))].sort((a, b) => a.obsStartMs - b.obsStartMs) : []), [result, events, selected]);

  const status = geo === 'locating' ? S.plan.locating : catalog.status === 'loading' || (computing && !result) ? S.plan.computing : computing ? S.plan.stale : null;

  return (
    <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 px-5 pt-5 pb-10 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="caps text-fg">{S.app.name}</span>
            <CodeStrip size="sm" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {status && (
              <span role="status" className="flex items-center gap-2 caps text-muted">
                <LoaderCircle size={13} strokeWidth={1.5} className="animate-spin" />
                {status}
              </span>
            )}
            <Segmented
              size="sm"
              label={S.strip.mode}
              value={mode}
              onChange={(m) => set({ mode: m })}
              options={[
                { value: 'photometry', label: S.strip.photometry, title: S.strip.photometryHint },
                { value: 'showcase', label: S.strip.showcase, title: S.strip.showcaseHint },
              ]}
            />
            <Segmented
              size="sm"
              label={S.strip.time}
              value={timeDisplay}
              onChange={(t) => set({ timeDisplay: t })}
              options={[
                { value: 'local', label: S.strip.local },
                { value: 'utc', label: S.strip.utc },
              ]}
            />
          </div>
        </header>

        <SettingsStrip />

        {result && (
          <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:gap-6">
              <span className="display text-[64px] text-fg md:text-[96px]" aria-hidden>
                {String(plan.length).padStart(2, '0')}
              </span>
              <div className="flex flex-col gap-2 md:pb-2">
                <h1 className="caps text-fg">{S.plan.lockupTitle(plan.length, result.nights.length)}</h1>
                <span className="text-sm text-muted">{S.plan.lockupSub(plan[0] ? `${tf.t(plan[0].ingressMs)} ${tf.zone(plan[0].ingressMs)}` : null, events.length)}</span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
                  <Legend kind="on" label={S.plan.legendScheduled} />
                  <Legend kind="off" label={S.plan.legendCandidate} />
                  <Legend kind="flip" label={S.plan.legendFlip} />
                  <span>{S.plan.legendDepth}</span>
                  {(picks.length > 0 || drops.length > 0) && (
                    <button type="button" title={S.plan.resetHint} onClick={resetPlan} className="flex items-center gap-1.5 caps text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg">
                      <RotateCcw size={12} strokeWidth={1.5} /> {S.plan.reset}
                    </button>
                  )}
                </span>
              </div>
            </div>
            <div className="pb-2">
              <ExportMenu />
            </div>
          </div>
        )}

        <div className="mt-8">
          {!result && !status && !req && <p className="text-sm text-muted">{S.plan.needLocationText}</p>}
          {result?.nights.map((n) => (
            <NightPlot
              key={n.date}
              night={n}
              events={events.filter((e) => e.night === n.date)}
              selected={selected}
              conflicts={conflicts}
              focusId={focusId}
              tz={tf.tz}
              zone={tf.zone(n.startMs + 12 * 3600_000)}
              gapMin={gap}
              visibleWarnings={vis}
              onToggle={(id) => {
                toggleScheduled(id);
                set({ focusId: id });
              }}
              onFocus={(id) => set({ focusId: id })}
            />
          ))}
          {result && events.length === 0 && <p className="text-sm text-muted">{S.plan.emptyFilters}</p>}
        </div>

        <PrintSummary plan={plan} />
        <Footer />
      </div>

      <aside className="no-print border-t border-line px-5 pt-6 pb-10 xl:sticky xl:top-0 xl:h-screen xl:overflow-y-auto xl:border-t-0 xl:border-l">
        <Inspector event={focus} />
      </aside>
    </div>
  );
}

function Legend({ kind, label }: { kind: 'on' | 'off' | 'flip'; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="22" height="10" aria-hidden>
        {kind === 'flip' ? (
          <line x1="11" x2="11" y1="0" y2="10" stroke="var(--c-red)" strokeWidth="2" />
        ) : (
          <path d="M0,3 L6,3 L8,8 L14,8 L16,3 L22,3" fill="none" stroke={kind === 'on' ? 'var(--c-fg)' : 'var(--c-plot-mid)'} strokeWidth={kind === 'on' ? 2 : 1} />
        )}
      </svg>
      {label}
    </span>
  );
}

function PrintSummary({ plan }: { plan: TransitEvent[] }) {
  const site = useSite();
  const tf = useTimeFmt();
  return (
    <section className="print-only mt-8">
      <h2 className="mb-2 text-lg">
        {S.app.name} · {site?.name} · {tf.zone()}
      </h2>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left">
            {['Night', 'Target', 'RA', 'Dec', 'Observe', 'Ingress', 'Mid', 'Egress'].map((h) => (
              <th key={h} className="border-b py-1 pr-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.map((e) => (
            <tr key={e.id}>
              <td className="py-1 pr-2">{e.night}</td>
              <td className="pr-2">{e.name}</td>
              <td className="pr-2">{formatRa(e.ra)}</td>
              <td className="pr-2">{formatDec(e.dec)}</td>
              <td className="pr-2">
                {tf.t(e.obsStartMs)}–{tf.t(e.obsEndMs)}
              </td>
              <td className="pr-2">{tf.t(e.ingressMs)}</td>
              <td className="pr-2">{tf.t(e.midMs)}</td>
              <td className="pr-2">{tf.t(e.egressMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs">{S.app.accuracy}</p>
    </section>
  );
}

const REPO_URL = 'https://github.com/ExoplanetResearchGroup-Croatia/transit-planner';

export function Footer() {
  const catalog = useStore((s) => s.catalog);
  return (
    <footer className="no-print mt-12 flex flex-col gap-2 border-t border-line pt-5 text-[11px] leading-relaxed text-faint">
      <p className="text-muted">{S.app.accuracy}</p>
      <p>
        {catalog.generated ? S.setup.dataText(catalog.generated.slice(0, 10), catalog.targets.length) : S.app.loadingCatalog} · {S.footer.privacy} ·{' '}
        <a className="underline decoration-line-strong hover:text-fg" href={REPO_URL} target="_blank" rel="noreferrer noopener">
          {S.app.repo}
        </a>{' '}
        ·{' '}
        <a className="underline decoration-line-strong hover:text-fg" href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer noopener">
          {S.app.docs}
        </a>
      </p>
      <p className="max-w-[110ch]">{S.footer.attribution}</p>
    </footer>
  );
}

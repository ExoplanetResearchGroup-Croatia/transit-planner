import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore, shareStateOf } from '../../state/store';
import { S } from '../../strings';
import { Badge, Button, Card, Checkbox, Field, NumInput, Select, StepHeader, TextInput, download } from '../../components/ui';
import { useResolvedEquipment, useSite, useTimeFmt } from '../hooks';
import { jobsByNight, makeJob, safeFileName, type Plan, formatRa, formatDec } from '../../lib/export/model';
import { adviseExposure } from '../../lib/equipment/exposure';
import { buildEsl, buildEsq, EKOS_FORMATS, type EkosFormat } from '../../lib/export/ekos';
import { buildNinaSequence, inspectTemplate, type TemplateInfo } from '../../lib/export/nina';
import { buildCsv, buildIcs, buildPlanJson } from '../../lib/export/simple';
import { encodeShare } from '../../lib/export/share';
import { listTimeZones } from '../../lib/astro/tz';
import { effectiveMinAltitude } from '../../lib/transits/compute';
import { usePlanRequest } from '../hooks';
import { useVisibleWarnings } from './ResultsStep';

const APP_VERSION = '0.1.0';

export function ExportStep() {
  const s = useStore();
  const site = useSite();
  const eq = useResolvedEquipment();
  const req = usePlanRequest();
  const f = useTimeFmt();
  const vis = useVisibleWarnings();
  const ex = s.exportSettings;
  const upEx = (p: Partial<typeof ex>) => s.set({ exportSettings: { ...ex, ...p } });
  const [builtin, setBuiltin] = useState<unknown>(null);
  const [copied, setCopied] = useState(false);
  const [ninaErr, setNinaErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}templates/nina_template.json`)
      .then((r) => r.json())
      .then(setBuiltin)
      .catch(() => setBuiltin(null));
  }, []);

  const events = useMemo(() => (s.result?.events ?? []).filter((e) => s.selected.includes(e.id)), [s.result, s.selected]);
  const gap = s.mount.overheadMin + s.mount.autofocusMin;
  const plan: Plan | null = useMemo(() => {
    if (!site || events.length === 0) return null;
    return {
      generated: new Date().toISOString(),
      appVersion: APP_VERSION,
      mode: s.mode,
      site: { name: site.name, lat: site.lat, lon: site.lon, elevation: site.elevation, tz: site.tz, horizon: site.horizon },
      equipment: eq?.name ?? '',
      overheadMin: gap,
      dataVersion: s.catalog.generated ?? '',
      jobs: events.map((e) => makeJob(e, gap, adviseExposure(e.mag, s.exposureTable, eq?.apertureMm ?? null, eq?.exposureOptions ?? undefined))),
    };
  }, [site, events, eq, gap, s.mode, s.exposureTable, s.catalog.generated]);

  const clockTz = ex.clockTz ?? site?.tz ?? 'UTC';
  const custom = ex.ninaUseCustom && ex.ninaTemplate ? safeParse(ex.ninaTemplate) : null;
  const template = custom ?? builtin;
  const info: TemplateInfo | null = template ? inspectTemplate(template) : null;
  const byNight = plan ? jobsByNight(plan.jobs) : new Map();
  const firstNight = plan ? [...byNight.keys()].sort()[0] : '';
  const stamp = plan ? `${firstNight}${byNight.size > 1 ? `_${byNight.size}n` : ''}` : '';

  if (!plan)
    return (
      <div>
        <StepHeader title={S.export.title} intro={S.export.nothing} />
      </div>
    );

  const exportNina = (night: string) => {
    try {
      setNinaErr(null);
      const r = buildNinaSequence(template, builtin, byNight.get(night)!, { tz: clockTz, setExposure: ex.ninaSetExposure });
      download(`transits_${night}_nina.json`, r.json, 'application/json');
    } catch (e) {
      setNinaErr(String(e instanceof Error ? e.message : e));
    }
  };

  const shareUrl = () => `${location.origin}${location.pathname}#${encodeShare(shareStateOf(s), s.selected)}`;

  return (
    <div>
      <StepHeader
        title={S.export.title}
        intro={`${S.results.selectedCount(plan.jobs.length)} · ${byNight.size} ${byNight.size === 1 ? 'night' : 'nights'}`}
        actions={
          <Field label={S.export.clockTz}>
            <Select value={clockTz} onChange={(v) => upEx({ clockTz: v === site?.tz ? null : v })} options={[...new Set([site?.tz ?? 'UTC', 'UTC', ...listTimeZones()])].map((z) => ({ value: z, label: z }))} />
          </Field>
        }
      />
      {eq?.vendorApp && <p className="mb-4 rounded-md border border-warn/40 bg-warn/5 p-3 text-sm text-warn">{S.export.vendorApp}</p>}
      <div className="no-print grid gap-4 lg:grid-cols-2">
        <Card title={S.export.ekos}>
          <p className="mb-3 text-xs text-muted">{S.export.ekosHint}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={S.export.ekosFormat}>
              <Select<EkosFormat> value={ex.ekosFormat} onChange={(v) => upEx({ ekosFormat: v })} options={Object.entries(EKOS_FORMATS).map(([value, label]) => ({ value: value as EkosFormat, label }))} />
            </Field>
            <Field label={S.export.ekosProfile}>
              <TextInput value={ex.ekosProfile} onChange={(v) => upEx({ ekosProfile: v })} />
            </Field>
            <Field label={S.export.ekosSeq} className="sm:col-span-2">
              <TextInput value={ex.ekosSequencePath} onChange={(v) => upEx({ ekosSequencePath: v })} />
            </Field>
          </div>
          <Button
            className="mt-3"
            variant="primary"
            disabled={eq?.vendorApp}
            onClick={() =>
              download(
                `transits_${stamp}.esl`,
                buildEsl(plan.jobs, {
                  format: ex.ekosFormat,
                  tz: clockTz,
                  profile: ex.ekosProfile,
                  sequencePath: ex.ekosSequencePath,
                  group: 'Transits',
                  minAltitude: req ? Math.round(effectiveMinAltitude(req)) : 0,
                  moonSeparation: null,
                  enforceTwilight: false,
                  enforceArtificialHorizon: false,
                  steps: { track: true, focus: s.mount.autofocusMin > 0, align: true, guide: true },
                }),
                'application/xml',
              )
            }
          >
            {S.export.download} .esl
          </Button>
          <details className="mt-4 rounded-md border border-line bg-bg p-3">
            <summary className="cursor-pointer text-sm font-medium">{S.export.ekosEsq}</summary>
            <p className="mt-2 text-xs text-muted">{S.export.ekosEsqHint}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label={S.export.filterName}>
                <TextInput value={ex.esqFilter} onChange={(v) => upEx({ esqFilter: v })} placeholder="V" />
              </Field>
              <Field label={S.export.fitsDir}>
                <TextInput value={ex.esqFitsDir} onChange={(v) => upEx({ esqFitsDir: v })} />
              </Field>
              <Field label={S.export.temperature}>
                <NumInput value={ex.esqTemperature} onChange={(v) => upEx({ esqTemperature: v })} allowEmpty unit="°C" />
              </Field>
            </div>
            <Button
              size="sm"
              className="mt-3"
              disabled={eq?.vendorApp}
              onClick={() => {
                const exp = plan.jobs[0].exposureS ?? 60;
                download(
                  'transit.esq',
                  buildEsq({
                    observer: '',
                    exposureS: exp,
                    filter: ex.esqFilter,
                    binning: 1,
                    frameW: eq?.sensorPx?.[0] ?? 0,
                    frameH: eq?.sensorPx?.[1] ?? 0,
                    temperature: ex.esqTemperature,
                    format: eq?.color === 'osc' ? 'Color' : 'Mono',
                    count: 100,
                    fitsDirectory: ex.esqFitsDir,
                  }),
                  'application/xml',
                );
              }}
            >
              {S.export.download} .esq
            </Button>
          </details>
        </Card>

        <Card title={S.export.nina}>
          <p className="mb-3 text-xs text-muted">{S.export.ninaHint}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={ex.ninaUseCustom && ex.ninaTemplate ? 'custom' : 'builtin'}
              onChange={(v) => (v === 'custom' ? (ex.ninaTemplate ? upEx({ ninaUseCustom: true }) : fileRef.current?.click()) : upEx({ ninaUseCustom: false }))}
              options={[
                { value: 'builtin', label: S.export.ninaBuiltin },
                { value: 'custom', label: ex.ninaTemplateName ? `${S.export.ninaUpload}: ${ex.ninaTemplateName}` : S.export.ninaUpload },
              ]}
              className="w-auto"
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                const text = await file.text();
                if (!safeParse(text)) return setNinaErr('Not a JSON file.');
                upEx({ ninaTemplate: text, ninaTemplateName: file.name, ninaUseCustom: true });
              }}
            />
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              {S.export.ninaUpload}…
            </Button>
          </div>
          {info && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="info">NINA {info.version}</Badge>
              {info.problems.map((p) => (
                <Badge key={p} tone="warn">
                  {p}
                </Badge>
              ))}
            </div>
          )}
          <Checkbox className="mt-3" checked={ex.ninaSetExposure} onChange={(v) => upEx({ ninaSetExposure: v })} label={S.export.ninaSetExposure} />
          <div className="mt-3 flex flex-wrap gap-2">
            {[...byNight.keys()].map((night) => (
              <Button key={night} variant="primary" disabled={!template || eq?.vendorApp} onClick={() => exportNina(night)}>
                {S.export.download} {night}
              </Button>
            ))}
          </div>
          {ninaErr && <p className="mt-2 text-sm text-bad">{ninaErr}</p>}
        </Card>

        <Card title={`${S.export.csv} · ${S.export.ics} · ${S.export.json}`}>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => download(`transits_${stamp}.csv`, buildCsv(plan), 'text/csv')}>{S.export.csv}</Button>
            <Button onClick={() => download(`transits_${stamp}.ics`, buildIcs(plan), 'text/calendar')}>{S.export.ics}</Button>
            <Button onClick={() => download(`transit-plan_${stamp}.json`, buildPlanJson(plan), 'application/json')}>{S.export.json}</Button>
          </div>
        </Card>
        <Card title={`${S.export.share} · ${S.export.print}`}>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={async () => {
                const url = shareUrl();
                history.replaceState(null, '', url);
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch {
                  /* clipboard blocked: the URL is in the address bar */
                }
              }}
            >
              {copied ? S.export.shareCopied : S.export.share}
            </Button>
            <Button onClick={() => window.print()}>{S.export.print}</Button>
          </div>
        </Card>
      </div>

      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold">
          {site?.name} · {eq?.name} · {f.zone()}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead>
              <tr className="border-b border-line text-left text-faint">
                {['Night', 'Target', 'RA', 'Dec', 'Slew', 'Start', 'Ingress', 'Mid', 'Egress', 'End', 'Exp.', S.export.warnings].map((h) => (
                  <th key={h} className="py-1 pr-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...plan.jobs]
                .sort((a, b) => a.startMs - b.startMs)
                .map((j) => (
                  <tr key={j.id} className="border-b border-line/50">
                    <td className="num py-1 pr-2">{j.night}</td>
                    <td className="pr-2 font-medium">{j.name}</td>
                    <td className="num pr-2">{formatRa(j.ra)}</td>
                    <td className="num pr-2">{formatDec(j.dec)}</td>
                    <td className="num pr-2">{f.t(j.startMs)}</td>
                    <td className="num pr-2">{f.t(j.obsStartMs)}</td>
                    <td className="num pr-2">{f.t(j.ingressMs)}</td>
                    <td className="num pr-2">{f.t(j.midMs)}</td>
                    <td className="num pr-2">{f.t(j.egressMs)}</td>
                    <td className="num pr-2">{f.t(j.obsEndMs)}</td>
                    <td className="num pr-2">{j.exposureS ? `${j.exposureS} s` : '—'}</td>
                    <td className="pr-2 text-muted">{vis(j.warnings).map((w) => S.warnings[w]).join('; ')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-faint">{S.app.accuracy}</p>
      </section>
    </div>
  );
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export { safeFileName };

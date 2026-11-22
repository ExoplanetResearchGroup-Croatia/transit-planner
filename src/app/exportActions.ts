/**
 * One-click exports. Every action builds the plan from the current selection
 * and downloads immediately with the saved (or default) export settings.
 */
import { useStore, shareStateOf } from '../state/store';
import { download } from '../components/ui';
import { jobsByNight, makeJob, type Plan } from '../lib/export/model';
import { adviseExposure } from '../lib/equipment/exposure';
import { buildEsl, buildEsq } from '../lib/export/ekos';
import { buildNinaSequence } from '../lib/export/nina';
import { buildCsv, buildIcs, buildPlanJson } from '../lib/export/simple';
import { encodeShare } from '../lib/export/share';
import { effectiveMinAltitude } from '../lib/transits/compute';
import type { ResolvedEquipment } from '../lib/equipment/library';
import type { PlanRequest } from '../lib/transits/types';

export const APP_VERSION = '0.2.0';

let builtinNina: Promise<unknown> | null = null;
export function loadBuiltinNinaTemplate(): Promise<unknown> {
  builtinNina ??= fetch(`${import.meta.env.BASE_URL}templates/nina_template.json`).then((r) => r.json());
  return builtinNina;
}

export function buildPlan(eq: ResolvedEquipment | null): Plan | null {
  const s = useStore.getState();
  const site = s.sites.find((x) => x.id === s.activeSiteId);
  const events = (s.result?.events ?? []).filter((e) => s.selected.includes(e.id));
  if (!site || events.length === 0) return null;
  const gap = s.mount.overheadMin + s.mount.autofocusMin;
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
}

const stampOf = (plan: Plan) => {
  const nights = [...jobsByNight(plan.jobs).keys()].sort();
  return `${nights[0]}${nights.length > 1 ? `_${nights.length}n` : ''}`;
};

const clockTz = (plan: Plan) => useStore.getState().exportSettings.clockTz ?? plan.site.tz;

export type ExportFormat = 'esl' | 'esq' | 'nina' | 'csv' | 'ics' | 'json' | 'share' | 'print';

/** Runs one export. Returns the file names written (or a note), for a short confirmation. */
export async function runExport(format: ExportFormat, eq: ResolvedEquipment | null, req: PlanRequest | null): Promise<string[]> {
  const plan = buildPlan(eq);
  const s = useStore.getState();
  const ex = s.exportSettings;
  if (format === 'share') {
    const url = `${location.origin}${location.pathname}#${encodeShare(shareStateOf(s), s.selected)}`;
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked: the URL is in the address bar */
    }
    return ['link'];
  }
  if (format === 'print') {
    window.print();
    return [];
  }
  if (!plan) return [];
  const stamp = stampOf(plan);
  switch (format) {
    case 'esl': {
      const name = `transits_${stamp}.esl`;
      download(
        name,
        buildEsl(plan.jobs, {
          format: ex.ekosFormat,
          tz: clockTz(plan),
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
      );
      return [name];
    }
    case 'esq': {
      download(
        'transit.esq',
        buildEsq({
          observer: '',
          exposureS: plan.jobs[0].exposureS ?? 60,
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
      return ['transit.esq'];
    }
    case 'nina': {
      const builtin = await loadBuiltinNinaTemplate();
      let template: unknown = builtin;
      if (ex.ninaUseCustom && ex.ninaTemplate) {
        try {
          template = JSON.parse(ex.ninaTemplate);
        } catch {
          template = builtin;
        }
      }
      const names: string[] = [];
      for (const [night, jobs] of jobsByNight(plan.jobs)) {
        const r = buildNinaSequence(template, builtin, jobs, { tz: clockTz(plan), setExposure: ex.ninaSetExposure });
        const name = `transits_${night}_nina.json`;
        download(name, r.json, 'application/json');
        names.push(name);
        await new Promise((res) => setTimeout(res, 350)); // browsers drop rapid consecutive downloads
      }
      return names;
    }
    case 'csv': {
      const name = `transits_${stamp}.csv`;
      download(name, buildCsv(plan), 'text/csv');
      return [name];
    }
    case 'ics': {
      const name = `transits_${stamp}.ics`;
      download(name, buildIcs(plan), 'text/calendar');
      return [name];
    }
    case 'json': {
      const name = `transit-plan_${stamp}.json`;
      download(name, buildPlanJson(plan), 'application/json');
      return [name];
    }
  }
}

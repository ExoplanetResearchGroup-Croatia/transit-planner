/**
 * Exporter tests.
 *  - Ekos: structure compared with a file saved by KStars (tests/fixtures/ekos,
 *    KStars test fixture) and with the element order of the 3.8.5 writer; the
 *    fields are read back the way SchedulerUtils::createJob reads them.
 *  - NINA: output compared with NINA 3.2 serializer output (official corpus).
 *  - Regression snapshots in tests/golden/ (update with `npx vitest run -u`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildEsl, buildEsq, DEFAULT_EKOS_OPTIONS, isoLocal } from '../src/lib/export/ekos';
import { buildNinaSequence, detectNinaVersion, findFirst, inputCoordinates, inspectTemplate } from '../src/lib/export/nina';
import { buildCsv, buildIcs, buildPlanJson, CSV_COLUMNS } from '../src/lib/export/simple';
import { decodeShare, encodeShare } from '../src/lib/export/share';
import type { Job, Plan } from '../src/lib/export/model';
import { decToDms, raToHms } from '../src/lib/export/model';
import { RIJEKA } from './helpers';

const fx = (p: string) => readFileSync(new URL(`./fixtures/${p}`, import.meta.url), 'utf8');
const TZ = 'Europe/Zagreb';

function job(over: Partial<Job> = {}): Job {
  const mid = Date.parse('2026-11-21T22:00:00Z');
  return {
    id: 'wasp-12b@1234', name: 'WASP-12 b', host: 'WASP-12', night: '2026-11-21', ra: 97.636625, dec: 29.6722778,
    mag: 11.57, magBand: 'V', depthPpt: 14.2, durationH: 3.0,
    startMs: mid - 3.5 * 3600_000, obsStartMs: mid - 3.45 * 3600_000, obsEndMs: mid + 2.5 * 3600_000,
    ingressMs: mid - 1.5 * 3600_000, midMs: mid, egressMs: mid + 1.5 * 3600_000, sigmaMin: 0.8, coverage: 'full', altMid: 70,
    moonSepDeg: 80, flipMs: null, priority: 'low', source: 'exoclock', score: 0.4, warnings: [], exposureS: 60, ...over,
  };
}
const SOUTH = job({ id: 'wasp-19b@99', name: 'WASP-19 b', ra: 148.4167, dec: -45.6591667, startMs: job().startMs + 6 * 3600_000, obsStartMs: job().obsStartMs + 6 * 3600_000, obsEndMs: job().obsEndMs + 6 * 3600_000 });
const NEAR_ZERO = job({ id: 'm2@1', name: 'Test & <b>', ra: 323.3625, dec: -0.8232 });

const plan = (jobs: Job[]): Plan => ({
  generated: '2026-11-21T12:00:00Z', appVersion: '0.1.0', mode: 'photometry', site: RIJEKA, equipment: 'EdgeHD 8', overheadMin: 3, dataVersion: 'test', jobs,
});

/** Read an .esl the way KStars' SchedulerUtils::createJob does (element by element). */
function readEsl(xml: string) {
  const jobs = [...xml.matchAll(/<Job>([\s\S]*?)<\/Job>/g)].map((m) => m[1]);
  const tag = (s: string, t: string) => new RegExp(`<${t}>([^<]*)</${t}>`).exec(s)?.[1];
  return {
    version: /<SchedulerList version='([^']+)'>/.exec(xml)?.[1],
    jobs: jobs.map((s) => ({
      name: tag(s, 'Name'),
      ra: Number(tag(s, 'J2000RA')),
      dec: Number(tag(s, 'J2000DE')),
      sequence: tag(s, 'Sequence'),
      startAt: /<StartupCondition>\s*<Condition value='([^']+)'>At<\/Condition>/.exec(s)?.[1],
      finishAt: /<CompletionCondition>\s*<Condition value='([^']+)'>At<\/Condition>/.exec(s)?.[1],
      minAlt: /<Constraint value='([^']+)'>MinimumAltitude<\/Constraint>/.exec(s)?.[1],
      steps: [...s.matchAll(/<Step>([^<]+)<\/Step>/g)].map((x) => x[1]),
      elements: [...s.matchAll(/^<([A-Za-z0-9]+)[ >/]/gm)].map((x) => x[1]),
    })),
  };
}

describe('Ekos .esl', () => {
  const opts = { ...DEFAULT_EKOS_OPTIONS, tz: TZ, minAltitude: 25, sequencePath: '/home/obs/transit.esq' };
  const xml = buildEsl([SOUTH, job(), NEAR_ZERO], opts);

  it('uses the same job elements and condition syntax as a file saved by KStars', () => {
    const kstars = readEsl(fx('ekos/start_at_finish_at_test.esl'));
    const startAt = kstars.jobs.find((j) => j.startAt && j.finishAt)!;
    expect(startAt.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    const ours = readEsl(xml);
    expect(ours.version).toBe('2.2');
    for (const j of ours.jobs) {
      expect(j.startAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      expect(j.finishAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
      // every element KStars itself writes in a job (apart from Priority, dropped in format 2.x) is present
      for (const el of startAt.elements.filter((e) => e !== 'Priority')) expect(j.elements).toContain(el);
    }
    // element order of the 3.8.5 writer (SchedulerProcess::saveScheduler)
    expect(ours.jobs[0].elements).toEqual(['JobType', 'Name', 'Group', 'Coordinates', 'J2000RA', 'J2000DE', 'PositionAngle', 'Sequence', 'StartupCondition', 'Condition', 'Constraints', 'Constraint', 'CompletionCondition', 'Condition', 'Steps', 'Step', 'Step', 'Step', 'Step']);
  });

  it('writes jobs in time order with local wall-clock times and J2000 hours/degrees', () => {
    const ours = readEsl(xml);
    expect(ours.jobs.map((j) => j.name)).toEqual(['WASP-12 b', 'Test &amp; &lt;b&gt;', 'WASP-19 b']);
    const w12 = ours.jobs[0];
    expect(w12.ra).toBeCloseTo(97.636625 / 15, 6);
    expect(w12.dec).toBeCloseTo(29.6722778, 6);
    // start 18:30 UTC = 19:30 CET; finish 00:30 UTC = 01:30 CET next day
    expect(w12.startAt).toBe('2026-11-21T19:30:00');
    expect(w12.finishAt).toBe('2026-11-22T01:30:00');
    expect(w12.minAlt).toBe('25');
    expect(w12.sequence).toBe('/home/obs/transit.esq');
    expect(ours.jobs[2].dec).toBeCloseTo(-45.6591667, 6);
  });

  it('isoLocal follows DST', () => {
    expect(isoLocal(Date.parse('2026-07-01T20:00:00Z'), TZ)).toBe('2026-07-01T22:00:00');
    expect(isoLocal(Date.parse('2026-07-01T20:00:00Z'), 'UTC')).toBe('2026-07-01T20:00:00');
  });

  it('format 2.1 differs only in the procedure blocks', () => {
    const v21 = buildEsl([job()], { ...opts, format: '2.1' });
    const v22 = buildEsl([job()], opts);
    expect(v21).toContain("<SchedulerList version='2.1'>");
    expect(v21.replace(/version='2\.1'/, '').replace(/<StartupProcedure>[\s\S]*$/, '')).toBe(v22.replace(/version='2\.2'/, '').replace(/<StartupProcedure[\s\S]*$/, ''));
  });

  it('matches the regression snapshot', async () => {
    await expect(xml).toMatchFileSnapshot('./golden/ekos/plan.esl');
  });
});

describe('Ekos .esq starter', () => {
  const esq = buildEsq({ observer: 'Observer', exposureS: 45, filter: 'V', binning: 1, frameW: 4144, frameH: 2822, temperature: -10, format: 'Mono', count: 200, fitsDirectory: '/home/obs/transits' });
  it('has the element structure of a sequence saved by KStars (SequenceQueue 2.6)', () => {
    const elems = (s: string) => [...s.matchAll(/^<([A-Za-z0-9]+)[ >/]/gm)].map((m) => m[1]);
    const real = elems(fx('ekos/3x30s_Red.esq'));
    const ours = elems(esq);
    expect(esq).toContain("<SequenceQueue version='2.6'>");
    expect(ours).toEqual(real);
  });
  it('disables dithering and refocusing for photometry', () => {
    expect(esq).toContain('<GuideDitherPerJob>-1</GuideDitherPerJob>');
    expect(esq).toContain("<HFRCheck enabled='false'>");
    expect(esq).toContain("<RefocusEveryN enabled='false'>");
  });
  it('matches the regression snapshot', async () => {
    await expect(esq).toMatchFileSnapshot('./golden/ekos/transit.esq');
  });
});

describe('NINA', () => {
  const template = JSON.parse(readFileSync(new URL('../public/templates/nina_template.json', import.meta.url), 'utf8'));
  const corpus = JSON.parse(fx('nina/nina-official_v3.2_all-sequence-entities.sequence.json'));

  it('coordinate encoding follows NINA conventions (NegativeDec before signed DecDegrees)', () => {
    const c = inputCoordinates(148.4167, -45.6591667, '9');
    expect(Object.keys(c)).toEqual(['$id', '$type', 'RAHours', 'RAMinutes', 'RASeconds', 'NegativeDec', 'DecDegrees', 'DecMinutes', 'DecSeconds']);
    expect(c).toMatchObject({ NegativeDec: true, DecDegrees: -45, DecMinutes: 39, RAHours: 9, RAMinutes: 53 });
    // -00°49' is NegativeDec true with DecDegrees 0 (as in NINA's own test fixture for M 2)
    expect(inputCoordinates(323.3625, -0.8232, '1')).toMatchObject({ NegativeDec: true, DecDegrees: 0, DecMinutes: 49 });
    // same key order as InputCoordinates written by NINA 3.2
    const real = findFirst(corpus, 'NINA.Astrometry.InputCoordinates, NINA.Astrometry');
    expect(Object.keys(c)).toEqual(Object.keys(real));
  });

  it('default template is NINA 3.x and has the instructions the exporter needs', () => {
    const info = inspectTemplate(template);
    expect(info.version).toBe('3.x');
    expect(info.problems).toEqual([]);
    expect(info.hasWaitForTime && info.hasTimeCondition).toBe(true);
  });

  it('builds a valid sequence: unique sequential $ids, all $refs defined earlier, values substituted', () => {
    const { json, warnings } = buildNinaSequence(template, template, [SOUTH, job()], { tz: TZ, setExposure: true });
    expect(warnings).toEqual([]);
    const doc = JSON.parse(json);
    const ids: string[] = [];
    const refsOk: boolean[] = [];
    (function walk(o: unknown) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === 'object') {
        const r = o as Record<string, unknown>;
        if (typeof r.$id === 'string') ids.push(r.$id);
        if (typeof r.$ref === 'string') refsOk.push(ids.includes(r.$ref));
        Object.values(r).forEach(walk);
      }
    })(doc);
    expect(ids).toEqual(ids.map((_, i) => String(i + 1)));
    expect(refsOk.every(Boolean)).toBe(true);
    const targets = findFirst(doc, 'NINA.Sequencer.Container.TargetAreaContainer, NINA.Sequencer');
    const dsos = targets.Items.$values;
    expect(dsos.map((d: { Target: { TargetName: string } }) => d.Target.TargetName)).toEqual(['WASP-12 b', 'WASP-19 b']);
    expect(dsos[0].Parent).toEqual({ $ref: targets.$id });
    const wait = dsos[0].Items.$values[0];
    expect([wait.Hours, wait.Minutes, wait.Seconds, wait.MinutesOffset]).toEqual([19, 30, 0, 0]);
    expect(wait.SelectedProvider.$type).toContain('DateTimeProvider.TimeProvider');
    const loop = dsos[0].Items.$values[2];
    const cond = loop.Conditions.$values[0];
    expect([cond.Hours, cond.Minutes]).toEqual([1, 30]);
    expect(loop.Items.$values[0].ExposureTime).toBe(60);
    const center = dsos[1].Items.$values[1];
    expect(center.Coordinates).toMatchObject({ NegativeDec: true, DecDegrees: -45 });
  });

  it('accepts a bare target file and a NINA 2.x template', () => {
    const dsoOnly = JSON.parse(JSON.stringify(findFirst(template, 'NINA.Sequencer.Container.DeepSkyObjectContainer, NINA.Sequencer')));
    dsoOnly.Parent = null;
    const r = buildNinaSequence(dsoOnly, template, [job()], { tz: TZ, setExposure: false });
    expect(JSON.parse(r.json).$type).toContain('SequenceRootContainer');
    const v2 = JSON.parse(fx('nina/plugin-exoplanets_TransitPlanetImagingSequence.json'));
    expect(detectNinaVersion(v2)).toBe('2.x');
    expect(detectNinaVersion(corpus)).toBe('3.x');
  });

  it('inspects the 1.11-era example template that NINA still ships', () => {
    const legacy = JSON.parse(fx('nina/nina-official_example_Basic-Sequence-Target.template.json'));
    const info = inspectTemplate(legacy);
    expect(info.dsoName).not.toBeNull();
    // it has no Wait for Time / Loop Until Time, so the exporter must say so instead of failing silently
    expect(info.problems.some((p) => p.includes('Wait for Time') || p.includes('Loop Until Time'))).toBe(true);
  });

  it('matches the regression snapshot', async () => {
    const { json } = buildNinaSequence(template, template, [job(), SOUTH], { tz: TZ, setExposure: true });
    await expect(json).toMatchFileSnapshot('./golden/nina/plan.json');
  });
});

describe('CSV / ICS / JSON / share', () => {
  it('CSV has a header and one row per job, quoted where needed', () => {
    const csv = buildCsv(plan([job(), NEAR_ZERO]));
    const lines = csv.trim().split('\r\n');
    expect(lines[0].split(',')).toEqual([...CSV_COLUMNS]);
    expect(lines).toHaveLength(3);
    expect(csv).toContain('2026-11-21T22:00:00Z');
  });
  it('ICS is folded, escaped and uses UTC', () => {
    const ics = buildIcs(plan([job(), NEAR_ZERO]));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20261121T183000Z');
    expect(ics).toContain('SUMMARY:Transit: Test & <b>');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
  it('plan JSON round-trips', () => {
    const p = JSON.parse(buildPlanJson(plan([job()])));
    expect(p.format).toBe('transit-planner-plan');
    expect(p.jobs[0].midUtc).toBe('2026-11-21T22:00:00Z');
  });
  it('share link round-trips', () => {
    const h = encodeShare({ a: 1, site: RIJEKA }, ['x@1', 'y@2']);
    expect(decodeShare<{ a: number }>(`#${h}`)).toEqual({ v: 1, state: { a: 1, site: RIJEKA }, selected: ['x@1', 'y@2'] });
    expect(decodeShare('#p=garbage')).toBeNull();
  });
  it('sexagesimal helpers', () => {
    expect(raToHms(359.99999)).toEqual({ h: 0, m: 0, s: 0 });
    expect(decToDms(-0.5)).toEqual({ negative: true, d: 0, m: 30, s: 0 });
  });
});

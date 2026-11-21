/**
 * N.I.N.A. Advanced Sequencer export by template substitution.
 *
 * The user's template (or the built-in public/templates/nina_template.json,
 * assembled from NINA 3.2 serializer output) contains one DeepSkyObjectContainer.
 * For each job it is cloned, and only these values are changed:
 *   - container Name and Target.TargetName
 *   - Target.InputCoordinates (and coordinates of children with "Inherited": true)
 *   - every "Wait for Time" (WaitForTime) -> job start, every "Loop Until Time"
 *     (TimeCondition) -> job end, both with the fixed-clock TimeProvider
 *   - optionally ExposureTime of LIGHT TakeExposure items
 * Then every $id is renumbered in document order and every $ref rewritten.
 *
 * Format facts (docs/export-formats.md): Newtonsoft TypeNameHandling.All +
 * PreserveReferencesHandling.All; properties are applied in document order;
 * Dec is written as signed truncated degrees with NegativeDec BEFORE DecDegrees;
 * times are wall-clock H/M/S of the NINA PC with no date (NINA 3.x rolls the
 * day over at sunrise, 2.x at noon), so one file is valid for one night.
 */
import type { Job } from './model';
import { decToDms, raToHms } from './model';
import { wallClock } from '../astro/tz';

/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;

const T = {
  root: 'NINA.Sequencer.Container.SequenceRootContainer, NINA.Sequencer',
  targets: 'NINA.Sequencer.Container.TargetAreaContainer, NINA.Sequencer',
  dso: 'NINA.Sequencer.Container.DeepSkyObjectContainer, NINA.Sequencer',
  waitForTime: 'NINA.Sequencer.SequenceItem.Utility.WaitForTime, NINA.Sequencer',
  timeCondition: 'NINA.Sequencer.Conditions.TimeCondition, NINA.Sequencer',
  timeProvider: 'NINA.Sequencer.Utility.DateTimeProvider.TimeProvider, NINA.Sequencer',
  takeExposure: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure, NINA.Sequencer',
  inputCoordinates: 'NINA.Astrometry.InputCoordinates, NINA.Astrometry',
};

const typeName = (o: J): string => (o && typeof o === 'object' && typeof o.$type === 'string' ? o.$type.split(',')[0].trim() : '');
const isType = (o: J, full: string) => typeName(o) === full.split(',')[0];

export type NinaVersion = '3.x' | '2.x' | 'unknown';

/** Fingerprint: collection assembly and Rotation/PositionAngle (there is no version field). */
export function detectNinaVersion(doc: J): NinaVersion {
  const s = JSON.stringify(doc);
  if (s.includes(', System.ObjectModel"') || s.includes('"PositionAngle"') || s.includes('System.Private.CoreLib')) return '3.x';
  if (/ObservableCollection`1\[\[[^\]]+\]\], System"/.test(s) || s.includes(', mscorlib"') || s.includes('"Rotation"')) return '2.x';
  return 'unknown';
}

function walk(o: J, fn: (node: J, parent: J | null, key: string | number | null) => void, parent: J | null = null, key: string | number | null = null) {
  if (Array.isArray(o)) o.forEach((x, i) => walk(x, fn, o, i));
  else if (o && typeof o === 'object') {
    fn(o, parent, key);
    for (const [k, v] of Object.entries(o)) if (k !== 'Parent') walk(v, fn, o, k);
  }
}

export function findFirst(doc: J, full: string): J | null {
  let found: J | null = null;
  walk(doc, (n) => {
    if (!found && isType(n, full)) found = n;
  });
  return found;
}

export interface TemplateInfo {
  version: NinaVersion;
  kind: 'sequence' | 'target' | 'container';
  hasWaitForTime: boolean;
  hasTimeCondition: boolean;
  lightExposures: number;
  dsoName: string | null;
  problems: string[];
}

export function inspectTemplate(doc: J): TemplateInfo {
  const problems: string[] = [];
  const dso = findFirst(doc, T.dso);
  if (!dso) problems.push('The template has no "Deep Sky Object" target container (DeepSkyObjectContainer).');
  let wait = 0;
  let cond = 0;
  let light = 0;
  if (dso)
    walk(dso, (n) => {
      if (isType(n, T.waitForTime)) wait++;
      if (isType(n, T.timeCondition)) cond++;
      if (isType(n, T.takeExposure) && n.ImageType === 'LIGHT') light++;
    });
  if (dso && wait === 0) problems.push('No "Wait for Time" instruction inside the target container: the start time cannot be set.');
  if (dso && cond === 0) problems.push('No "Loop Until Time" condition inside the target container: the end time cannot be set.');
  const s = JSON.stringify(doc);
  if (/ExoPlanets|WhenPlugin|TargetScheduler|GroundStation/.test(s))
    problems.push('The template contains plugin instructions. They load as "Unknown instruction" if the exact plugin build is missing.');
  return {
    version: detectNinaVersion(doc),
    kind: isType(doc, T.root) ? 'sequence' : isType(doc, T.dso) ? 'target' : 'container',
    hasWaitForTime: wait > 0,
    hasTimeCondition: cond > 0,
    lightExposures: light,
    dsoName: dso?.Name ?? null,
    problems,
  };
}

/** Map of every $id to its (first) definition, for re-inlining dangling refs. */
function collectDefs(doc: J): Map<string, J> {
  const m = new Map<string, J>();
  const visit = (o: J) => {
    if (Array.isArray(o)) o.forEach(visit);
    else if (o && typeof o === 'object') {
      if (typeof o.$id === 'string' && !m.has(o.$id)) m.set(o.$id, o);
      for (const v of Object.values(o)) visit(v);
    }
  };
  visit(doc);
  return m;
}

/** Deep clone; $ids defined inside the subtree get a prefix, internal $refs follow, external refs stay. */
export function cloneSubtree(obj: J, prefix: string): J {
  const internal = new Set<string>();
  const scan = (o: J) => {
    if (Array.isArray(o)) o.forEach(scan);
    else if (o && typeof o === 'object') {
      if (typeof o.$id === 'string') internal.add(o.$id);
      for (const v of Object.values(o)) scan(v);
    }
  };
  scan(obj);
  const copy = (o: J): J => {
    if (Array.isArray(o)) return o.map(copy);
    if (!o || typeof o !== 'object') return o;
    const out: J = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === '$id' && typeof v === 'string') out[k] = `${prefix}${v}`;
      else if (k === '$ref' && typeof v === 'string') out[k] = internal.has(v) ? `${prefix}${v}` : v;
      else out[k] = copy(v);
    }
    return out;
  };
  return copy(obj);
}

/**
 * Renumber $ids "1", "2", ... in document order (the order NINA writes and reads).
 * A $ref to an id that is not yet defined at that point is replaced by a copy of
 * the original definition, so the reference graph stays valid.
 */
export function renumberIds(doc: J, originalDefs: Map<string, J>): J {
  let next = 1;
  const map = new Map<string, string>();
  const visit = (o: J): J => {
    if (Array.isArray(o)) return o.map(visit);
    if (!o || typeof o !== 'object') return o;
    const keys = Object.keys(o);
    if (keys.length === 1 && keys[0] === '$ref') {
      const target = map.get(o.$ref);
      if (target) return { $ref: target };
      const def = originalDefs.get(o.$ref);
      if (!def) throw new Error(`NINA template: reference to unknown $id "${String(o.$ref)}"`);
      const inlined = visit(JSON.parse(JSON.stringify(def)));
      map.set(o.$ref, inlined.$id);
      return inlined;
    }
    const out: J = {};
    for (const [k, v] of Object.entries(o)) {
      if (k === '$id' && typeof v === 'string') {
        const id = String(next++);
        if (!map.has(v)) map.set(v, id);
        out.$id = id;
      } else out[k] = visit(v);
    }
    return out;
  };
  return visit(doc);
}

/** InputCoordinates object with NINA's sign conventions and key order. */
export function inputCoordinates(raDeg: number, decDeg: number, id: string): J {
  const { h, m, s } = raToHms(raDeg);
  const dms = decToDms(decDeg);
  return {
    $id: id,
    $type: T.inputCoordinates,
    RAHours: h,
    RAMinutes: m,
    RASeconds: s,
    NegativeDec: dms.negative,
    DecDegrees: dms.negative && dms.d !== 0 ? -dms.d : dms.d, // signed truncated degrees; 0 for -1 < dec < 0
    DecMinutes: dms.m,
    DecSeconds: dms.s,
  };
}

function setClock(item: J, ms: number, tz: string, providerId: string) {
  const w = wallClock(ms, tz);
  item.Hours = w.hour;
  item.Minutes = w.minute;
  if ('MinutesOffset' in item || true) item.MinutesOffset = 0;
  item.Seconds = w.second;
  item.SelectedProvider = { $id: providerId, $type: T.timeProvider };
  // keep NINA's property order: Hours, Minutes, MinutesOffset, Seconds, SelectedProvider, then the rest
  const order = ['$id', '$type', 'Hours', 'Minutes', 'MinutesOffset', 'Seconds', 'SelectedProvider'];
  const rest = Object.keys(item).filter((k) => !order.includes(k));
  const snapshot = { ...item };
  for (const k of Object.keys(item)) delete item[k];
  for (const k of [...order, ...rest]) if (k in snapshot) item[k] = snapshot[k];
}

export interface NinaOptions {
  /** IANA zone of the NINA PC clock */
  tz: string;
  setExposure: boolean;
  /** night label used in container names */
  nightLabel?: string;
}

export interface NinaResult {
  json: string;
  warnings: string[];
}

/** Build one sequence file for one night's jobs. */
export function buildNinaSequence(template: J, defaultTemplate: J, jobs: Job[], o: NinaOptions): NinaResult {
  const warnings: string[] = [];
  const info = inspectTemplate(template);
  if (!findFirst(template, T.dso)) throw new Error(info.problems[0]);
  warnings.push(...info.problems);
  const nights = new Set(jobs.map((j) => j.night));
  if (nights.size > 1) warnings.push('NINA files carry clock times without a date: export one file per night.');

  const originalDefs = collectDefs(template);
  const work: J = JSON.parse(JSON.stringify(template));
  let root: J;
  let targetArea: J;
  let prototype: J;

  if (info.kind === 'sequence') {
    root = work;
    targetArea = findFirst(root, T.targets);
    prototype = findFirst(targetArea ?? root, T.dso);
    if (!targetArea) throw new Error('The sequence template has no Targets area.');
  } else {
    // wrap a target or container template in the default root (Start / Targets / End)
    root = JSON.parse(JSON.stringify(defaultTemplate));
    targetArea = findFirst(root, T.targets);
    prototype = findFirst(work, T.dso);
    for (const [k, v] of collectDefs(root)) if (!originalDefs.has(k)) originalDefs.set(k, v);
    if (info.version === '2.x') {
      // match the collection assembly names of a NINA 2.x file
      const s = JSON.stringify(root).replace(/, System\.ObjectModel"/g, ', System"');
      root = JSON.parse(s);
      targetArea = findFirst(root, T.targets);
    }
  }

  const sorted = [...jobs].sort((a, b) => a.startMs - b.startMs);
  const clones = sorted.map((job, i) => {
    const prefix = `tp${i}_`;
    const c = cloneSubtree(prototype, prefix);
    c.Name = `${job.name} transit ${o.nightLabel ?? job.night}`;
    c.Parent = targetArea.$id ? { $ref: targetArea.$id } : null;
    if (c.Target) {
      c.Target.TargetName = job.name;
      const oldId = c.Target.InputCoordinates?.$id ?? `${prefix}coords`;
      c.Target.InputCoordinates = inputCoordinates(job.ra, job.dec, oldId);
    }
    let providerN = 0;
    walk(c, (n) => {
      if (n !== c && n.Inherited === true && n.Coordinates && typeof n.Coordinates === 'object')
        n.Coordinates = inputCoordinates(job.ra, job.dec, n.Coordinates.$id ?? `${prefix}ic${providerN}`);
      if (n.HasDsoParent === true && n.Data?.Coordinates && typeof n.Data.Coordinates === 'object')
        n.Data.Coordinates = inputCoordinates(job.ra, job.dec, n.Data.Coordinates.$id ?? `${prefix}dc${providerN}`);
      if (isType(n, T.waitForTime)) setClock(n, job.startMs, o.tz, `${prefix}tp${providerN++}`);
      if (isType(n, T.timeCondition)) setClock(n, job.obsEndMs, o.tz, `${prefix}tp${providerN++}`);
      if (o.setExposure && job.exposureS && isType(n, T.takeExposure) && n.ImageType === 'LIGHT') n.ExposureTime = job.exposureS;
    });
    return c;
  });

  targetArea.Items.$values = clones;
  const out = renumberIds(root, originalDefs);
  return { json: JSON.stringify(out, null, 2), warnings };
}

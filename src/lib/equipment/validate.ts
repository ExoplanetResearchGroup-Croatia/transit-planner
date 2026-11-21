/**
 * Equipment validation shared by the build (scripts/validate-data.ts), the
 * Equipment Builder page and the import dialog. Schema validation uses the
 * precompiled Ajv validator; the checks the schema cannot express (unique ids,
 * references, plausibility) live here.
 */
import schemaValidate, { type AjvError } from './validator.generated.js';
import { deriveOptics, fovDisagreement } from './derive';
import type { EquipmentFile } from './types';
import { EQUIPMENT_SECTIONS } from './types';

export interface Issue {
  level: 'error' | 'warning';
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: Issue[];
}

const SECTION_LABEL: Record<string, string> = {
  telescopes: 'Telescope',
  cameras: 'Camera',
  mounts: 'Mount',
  filters: 'Filter',
  all_in_one: 'Smart telescope',
  presets: 'Preset',
};

/** "/cameras/0/modes/1/pixel_um" -> "Camera “ZWO ASI294MM Pro” › modes[1] › pixel_um" */
export function describePath(data: unknown, instancePath: string): string {
  if (!instancePath) return 'File';
  const parts = instancePath.split('/').slice(1);
  const out: string[] = [];
  let node: unknown = data;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const next = node && typeof node === 'object' ? (node as Record<string, unknown>)[p] : undefined;
    if (i === 1 && SECTION_LABEL[parts[0]] && /^\d+$/.test(p)) {
      const name = next && typeof next === 'object' ? (next as { name?: unknown }).name : undefined;
      out.pop();
      out.push(
        typeof name === 'string' && name.trim()
          ? `${SECTION_LABEL[parts[0]]} “${name}”`
          : `${SECTION_LABEL[parts[0]]} #${Number(p) + 1}`,
      );
    } else if (/^\d+$/.test(p)) {
      out[out.length - 1] = `${out[out.length - 1]}[${p}]`;
    } else {
      out.push(p);
    }
    node = next;
  }
  return out.join(' › ');
}

function plainMessage(e: AjvError): string | null {
  const field = e.instancePath.split('/').pop() ?? '';
  const p = e.params as Record<string, unknown>;
  switch (e.keyword) {
    case 'required':
      return `is missing the required field “${String(p.missingProperty)}”.`;
    case 'additionalProperties':
      return `has an unknown field “${String(p.additionalProperty)}” (typo, or not part of schema version 1).`;
    case 'type':
      return `must be ${p.type === 'integer' ? 'a whole number' : `a ${String(p.type)}`}.`;
    case 'enum':
      return `must be one of: ${(p.allowedValues as unknown[]).map((v) => `“${String(v)}”`).join(', ')}.`;
    case 'const':
      return `must be ${JSON.stringify(p.allowedValue)}.`;
    case 'pattern':
      if (field === 'id' || /^(telescope|camera|camera_mode|mount|default_mode)$/.test(field) || e.schemaPath.includes('/id'))
        return "must use only lower-case letters, digits, '.', '_' or '-' (own entries may start with 'user:').";
      if (e.schemaPath.includes('url')) return 'must be a web address starting with http:// or https://.';
      if (e.schemaPath.includes('date')) return 'must be a date written as YYYY-MM-DD.';
      return 'must not be empty.';
    case 'exclusiveMinimum':
      return `must be greater than ${String(p.limit)}.`;
    case 'minimum':
      return `must be at least ${String(p.limit)}.`;
    case 'maximum':
      return `must be at most ${String(p.limit)}.`;
    case 'minItems':
      return `needs at least ${String(p.limit)} item(s).`;
    case 'maxItems':
      return `can have at most ${String(p.limit)} item(s).`;
    case 'minProperties':
      return 'needs at least one value.';
    case 'if':
      return null; // the underlying 'required' error is reported separately
    default:
      return e.message ?? `failed check “${e.keyword}”.`;
  }
}

export function schemaIssues(data: unknown): Issue[] {
  if (schemaValidate(data)) return [];
  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const e of schemaValidate.errors ?? []) {
    const msg = plainMessage(e);
    if (!msg) continue;
    const path = describePath(data, e.instancePath);
    const key = `${path}|${msg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({ level: 'error', path, message: msg });
  }
  return issues;
}

export interface SemanticOptions {
  /** Resolve preset references against this file too (e.g. the official catalog when checking a user file). */
  resolveAgainst?: EquipmentFile;
}

export function semanticIssues(file: EquipmentFile, opts: SemanticOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message });
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message });

  for (const section of EQUIPMENT_SECTIONS) {
    const seen = new Map<string, number>();
    (file[section] ?? []).forEach((entry, i) => {
      const prev = seen.get(entry.id);
      if (prev !== undefined) {
        err(describePath(file, `/${section}/${i}`), `uses id “${entry.id}”, already used by entry #${prev + 1} in ${section}.`);
      } else seen.set(entry.id, i);
    });
  }

  const pool = <K extends 'telescopes' | 'cameras' | 'mounts' | 'filters'>(section: K): NonNullable<EquipmentFile[K]> =>
    [...(file[section] ?? []), ...(opts.resolveAgainst?.[section] ?? [])] as NonNullable<EquipmentFile[K]>;

  (file.cameras ?? []).forEach((cam, i) => {
    const path = describePath(file, `/cameras/${i}`);
    const modeIds = cam.modes.map((m) => m.id);
    if (new Set(modeIds).size !== modeIds.length) err(path, 'has two readout modes with the same id.');
    if (cam.default_mode && !modeIds.includes(cam.default_mode))
      err(path, `default_mode “${cam.default_mode}” is not one of its modes (${modeIds.join(', ')}).`);
    cam.modes.forEach((m) => {
      if (m.pixel_um > 20) warn(path, `mode “${m.id}”: pixel size ${m.pixel_um} µm is unusually large. Check the unit (µm, not mm).`);
      if (m.pixel_um < 1) warn(path, `mode “${m.id}”: pixel size ${m.pixel_um} µm is unusually small.`);
      if (m.pixel_um_inferred) warn(path, `mode “${m.id}”: pixel size is inferred, not published. Verify before relying on it.`);
    });
  });

  (file.telescopes ?? []).forEach((t, i) => {
    const path = describePath(file, `/telescopes/${i}`);
    const f = t.focal_length_mm / t.aperture_mm;
    if (f < 1.5 || f > 30) warn(path, `focal ratio f/${f.toFixed(1)} is implausible. Check aperture and focal length (both in mm).`);
  });

  (file.all_in_one ?? []).forEach((s, i) => {
    const path = describePath(file, `/all_in_one/${i}`);
    const d = deriveOptics({ ...s.optics, pixel_um: s.sensor.pixel_um, sensor_px: s.sensor.sensor_px });
    if (s.sensor.pixel_um > 20) warn(path, `pixel size ${s.sensor.pixel_um} µm is unusually large. Check the unit (µm).`);
    if (s.sensor.pixel_um_inferred) warn(path, 'pixel size is inferred, not published. Verify before relying on it.');
    if (s.fov_deg_published) {
      const dis = fovDisagreement(d, s.fov_deg_published);
      if (dis > 0.1)
        warn(path, `computed field of view (${d.fovWidthDeg.toFixed(2)}° × ${d.fovHeightDeg.toFixed(2)}°) differs from the published one by ${(dis * 100).toFixed(0)} %. Check pixel size, sensor size and focal length.`);
    }
  });

  for (const section of EQUIPMENT_SECTIONS) {
    (file[section] ?? []).forEach((entry, i) => {
      const nv = (entry as { needs_verification?: string[] }).needs_verification;
      if (nv?.length) warn(describePath(file, `/${section}/${i}`), `marked for verification: ${nv.join(', ')}.`);
    });
  }

  (file.presets ?? []).forEach((p, i) => {
    const path = describePath(file, `/presets/${i}`);
    const tel = pool('telescopes').find((t) => t.id === p.telescope);
    if (!tel) err(path, `refers to telescope “${p.telescope}”, which does not exist.`);
    const cam = pool('cameras').find((c) => c.id === p.camera);
    if (!cam) err(path, `refers to camera “${p.camera}”, which does not exist.`);
    else if (p.camera_mode && !cam.modes.some((m) => m.id === p.camera_mode))
      err(path, `refers to camera mode “${p.camera_mode}”, which camera “${cam.name}” does not have.`);
    if (p.mount && !pool('mounts').some((m) => m.id === p.mount)) err(path, `refers to mount “${p.mount}”, which does not exist.`);
    for (const f of p.filters ?? [])
      if (!pool('filters').some((x) => x.id === f)) err(path, `refers to filter “${f}”, which does not exist.`);
  });

  return issues;
}

export function validateEquipment(data: unknown, opts: SemanticOptions = {}): ValidationResult {
  const issues = schemaIssues(data);
  if (issues.length === 0) issues.push(...semanticIssues(data as EquipmentFile, opts));
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
  return { valid: !issues.some((i) => i.level === 'error'), issues };
}

/** Equipment library: official catalog + "My equipment", and resolution of a selection to planning values. */
import type { AllInOne, Camera, EquipmentFile, Filter, Mount, MountType, Preset, SensorColor, Telescope } from './types';
import { deriveOptics, type DerivedOptics } from './derive';

export type EquipmentSelection =
  | { kind: 'none' }
  | { kind: 'preset'; presetId: string }
  | { kind: 'all_in_one'; allInOneId: string }
  | { kind: 'modular'; telescopeId: string | null; cameraId: string | null; cameraMode: string | null; mountId: string | null; filterIds: string[] };

export interface ResolvedEquipment {
  name: string;
  apertureMm: number | null;
  focalMm: number | null;
  pixelUm: number | null;
  sensorPx: [number, number] | null;
  color: SensorColor | null;
  mountType: MountType | null;
  flipAfterMin: number | null;
  overheadMin: number | null;
  vendorApp: boolean;
  exposureOptions: number[] | null;
  derived: DerivedOptics | null;
  filters: Filter[];
  telescope?: Telescope;
  camera?: Camera;
  mount?: Mount;
  allInOne?: AllInOne;
}

export function mergeLibrary(official: EquipmentFile, user: EquipmentFile): EquipmentFile {
  const cat = <K extends 'telescopes' | 'cameras' | 'mounts' | 'filters' | 'all_in_one' | 'presets'>(k: K) =>
    [...((official[k] ?? []) as unknown[]), ...((user[k] ?? []) as unknown[])] as EquipmentFile[K];
  return {
    schemaVersion: 1,
    telescopes: cat('telescopes'),
    cameras: cat('cameras'),
    mounts: cat('mounts'),
    filters: cat('filters'),
    all_in_one: cat('all_in_one'),
    presets: cat('presets'),
  };
}

const byId = <T extends { id: string }>(arr: T[] | undefined, id: string | null | undefined) => (id ? arr?.find((x) => x.id === id) : undefined);

function modular(lib: EquipmentFile, tel?: Telescope, cam?: Camera, modeId?: string | null, mount?: Mount, filterIds: string[] = [], name?: string): ResolvedEquipment {
  const mode = cam ? cam.modes.find((m) => m.id === (modeId ?? cam.default_mode)) ?? cam.modes[0] : undefined;
  const derived =
    tel && mode ? deriveOptics({ aperture_mm: tel.aperture_mm, focal_length_mm: tel.focal_length_mm, pixel_um: mode.pixel_um, sensor_px: mode.sensor_px }) : null;
  return {
    name: name ?? [tel?.name, cam?.name, mount?.name].filter(Boolean).join(' + '),
    apertureMm: tel?.aperture_mm ?? null,
    focalMm: tel?.focal_length_mm ?? null,
    pixelUm: mode?.pixel_um ?? null,
    sensorPx: mode?.sensor_px ?? null,
    color: cam?.color ?? null,
    mountType: mount?.type ?? null,
    flipAfterMin: mount?.planning_defaults?.meridian_flip_after_min ?? null,
    overheadMin: mount?.planning_defaults?.slew_and_center_overhead_min ?? null,
    vendorApp: false,
    exposureOptions: null,
    derived,
    filters: (lib.filters ?? []).filter((f) => filterIds.includes(f.id)),
    telescope: tel,
    camera: cam,
    mount,
  };
}

export function resolveSelection(lib: EquipmentFile, sel: EquipmentSelection): ResolvedEquipment | null {
  switch (sel.kind) {
    case 'none':
      return null;
    case 'preset': {
      const p: Preset | undefined = byId(lib.presets, sel.presetId);
      if (!p) return null;
      return modular(lib, byId(lib.telescopes, p.telescope), byId(lib.cameras, p.camera), p.camera_mode, byId(lib.mounts, p.mount), p.filters, p.name);
    }
    case 'all_in_one': {
      const s = byId(lib.all_in_one, sel.allInOneId);
      if (!s) return null;
      return {
        name: s.name,
        apertureMm: s.optics.aperture_mm,
        focalMm: s.optics.focal_length_mm,
        pixelUm: s.sensor.pixel_um,
        sensorPx: s.sensor.sensor_px,
        color: s.sensor.color,
        mountType: s.mount.type,
        flipAfterMin: null,
        overheadMin: null,
        vendorApp: s.control === 'vendor_app',
        exposureOptions: s.exposure_options_s ?? null,
        derived: deriveOptics({ ...s.optics, pixel_um: s.sensor.pixel_um, sensor_px: s.sensor.sensor_px }),
        filters: [],
        allInOne: s,
      };
    }
    case 'modular':
      if (!sel.telescopeId && !sel.cameraId) return null;
      return modular(lib, byId(lib.telescopes, sel.telescopeId), byId(lib.cameras, sel.cameraId), sel.cameraMode, byId(lib.mounts, sel.mountId), sel.filterIds);
  }
}

/** Remove one entry from a user file. */
export function removeUserEntry(file: EquipmentFile, section: keyof Omit<EquipmentFile, '$schema' | 'schemaVersion' | 'dataRetrieved'>, id: string): EquipmentFile {
  return { ...file, [section]: ((file[section] as { id: string }[] | undefined) ?? []).filter((e) => e.id !== id) };
}

/** Add entries from an imported file; ids are prefixed with "user:" to avoid collisions with the catalog. */
export function addUserEntries(file: EquipmentFile, incoming: EquipmentFile): EquipmentFile {
  const pre = (id: string) => (id.startsWith('user:') ? id : `user:${id}`);
  const out: EquipmentFile = { ...file, schemaVersion: 1 };
  const merge = <T extends { id: string }>(cur: T[] | undefined, add: T[] | undefined, fix: (x: T) => T = (x) => x) => {
    const m = new Map((cur ?? []).map((x) => [x.id, x]));
    for (const x of add ?? []) {
      const y = fix({ ...x, id: pre(x.id) });
      m.set(y.id, y);
    }
    return [...m.values()];
  };
  out.telescopes = merge(file.telescopes, incoming.telescopes);
  out.cameras = merge(file.cameras, incoming.cameras);
  out.mounts = merge(file.mounts, incoming.mounts);
  out.filters = merge(file.filters, incoming.filters);
  out.all_in_one = merge(file.all_in_one, incoming.all_in_one);
  // preset references may point to the catalog (unchanged) or to entries from the same file (prefixed)
  const local = (sec: 'telescopes' | 'cameras' | 'mounts' | 'filters', id: string) => (incoming[sec] ?? []).some((e) => e.id === id);
  out.presets = merge(file.presets, incoming.presets, (p) => ({
    ...p,
    telescope: local('telescopes', p.telescope) ? pre(p.telescope) : p.telescope,
    camera: local('cameras', p.camera) ? pre(p.camera) : p.camera,
    mount: p.mount && local('mounts', p.mount) ? pre(p.mount) : p.mount,
    filters: p.filters?.map((f) => (local('filters', f) ? pre(f) : f)),
  }));
  return out;
}

export const EMPTY_USER_FILE: EquipmentFile = { $schema: './equipment.schema.json', schemaVersion: 1 };

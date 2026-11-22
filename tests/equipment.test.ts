import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateEquipment } from '../src/lib/equipment/validate';
import { deriveOptics, fovDisagreement } from '../src/lib/equipment/derive';
import type { EquipmentFile } from '../src/lib/equipment/types';

const catalog: EquipmentFile = JSON.parse(readFileSync(new URL('../public/data/equipment.json', import.meta.url), 'utf8'));
const clone = (): EquipmentFile => JSON.parse(JSON.stringify(catalog));

describe('official equipment catalog', () => {
  it('is valid (only verification warnings)', () => {
    const r = validateEquipment(catalog);
    expect(r.valid).toBe(true);
    expect(r.issues.every((i) => i.level === 'warning')).toBe(true);
  });
  it('published FOVs agree with computed FOVs within 3 %', () => {
    for (const s of catalog.all_in_one ?? []) {
      const d = deriveOptics({ ...s.optics, pixel_um: s.sensor.pixel_um, sensor_px: s.sensor.sensor_px });
      expect(fovDisagreement(d, s.fov_deg_published!)).toBeLessThan(0.03);
    }
  });
});

describe('validation messages', () => {
  it('catalog entries need sources and confidence, user entries do not', () => {
    const f = clone();
    delete f.telescopes![0].sources;
    const r = validateEquipment(f);
    expect(r.valid).toBe(false);
    expect(r.issues[0].path).toBe('Telescope “Celestron EdgeHD 8”');
    expect(r.issues[0].message).toContain('“sources”');
    const user: EquipmentFile = { schemaVersion: 1, telescopes: [{ id: 'user:my-newton', name: 'My Newton', aperture_mm: 200, focal_length_mm: 1000 }] };
    expect(validateEquipment(user).valid).toBe(true);
  });
  it('reports unknown fields, bad ids and wrong types in plain language', () => {
    const f = clone();
    (f.cameras![0] as unknown as Record<string, unknown>).pixelsize = 3;
    f.mounts![0].id = 'Bad Id';
    (f.telescopes![1] as unknown as Record<string, unknown>).aperture_mm = '279';
    const msgs = validateEquipment(f).issues.map((i) => `${i.path}: ${i.message}`);
    expect(msgs.some((m) => m.includes('unknown field “pixelsize”'))).toBe(true);
    expect(msgs.some((m) => m.includes('lower-case letters'))).toBe(true);
    expect(msgs.some((m) => m.includes('aperture_mm: must be a number'))).toBe(true);
  });
  it('checks preset references and plausibility', () => {
    const f = clone();
    f.presets![0].camera_mode = 'bin9';
    f.cameras![0].modes[0].pixel_um = 46.3;
    const r = validateEquipment(f);
    expect(r.issues.some((i) => i.level === 'error' && i.message.includes('“bin9”'))).toBe(true);
    expect(r.issues.some((i) => i.level === 'warning' && i.message.includes('unusually large'))).toBe(true);
  });
  it('user files can reference official catalog entries', () => {
    const user: EquipmentFile = { schemaVersion: 1, presets: [{ id: 'user:mine', name: 'Mine', telescope: 'celestron-edgehd-8', camera: 'zwo-asi294mm-pro' }] };
    expect(validateEquipment(user).valid).toBe(false);
    expect(validateEquipment(user, { resolveAgainst: catalog }).valid).toBe(true);
  });
});

describe('derived optics', () => {
  it('EdgeHD 8 + ASI294MM Pro (bin2)', () => {
    const d = deriveOptics({ aperture_mm: 203.2, focal_length_mm: 2032, pixel_um: 4.63, sensor_px: [4144, 2822] });
    expect(d.fRatio).toBeCloseTo(10, 6);
    expect(d.plateScale).toBeCloseTo(0.47, 2);
    expect(d.fovWidthDeg).toBeCloseTo(0.541, 2);
  });
  it('Seestar S30 frame is about 1.20 x 2.13 deg (published 2.46 deg is the diagonal)', () => {
    const d = deriveOptics({ aperture_mm: 30, focal_length_mm: 150, pixel_um: 2.9, sensor_px: [1080, 1920] });
    expect(d.fovWidthDeg).toBeCloseTo(1.2, 1);
    expect(d.fovHeightDeg).toBeCloseTo(2.13, 1);
    expect(d.fovDiagonalDeg).toBeCloseTo(2.44, 1);
  });
});

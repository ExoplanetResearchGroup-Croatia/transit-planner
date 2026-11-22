/**
 * Equipment entry form shared by the planner ("Enter manually") and the
 * Equipment Builder page. A draft converts to a schema-valid EquipmentFile.
 */
import type { EquipmentFile, MountType, SensorColor, Confidence } from '../lib/equipment/types';
import { deriveOptics, fovDisagreement, formatFov } from '../lib/equipment/derive';
import { S } from '../strings';
import { Checkbox, Field, NumInput, Select, Stat, TextInput, Badge } from './ui';

export interface Draft {
  kind: 'modular' | 'smart';
  catalog: boolean;
  slug: string;
  name: string;
  manufacturer: string;
  design: string;
  aperture: number | null;
  focal: number | null;
  sensorModel: string;
  color: SensorColor;
  cooled: boolean;
  pixel: number | null;
  width: number | null;
  height: number | null;
  cameraName: string;
  mountName: string;
  mountType: MountType;
  flipAfter: number | null;
  overhead: number | null;
  control: 'vendor_app' | 'ascom_indi';
  fovDiagonal: number | null;
  exposureOptions: string;
  notes: string;
  confidence: Confidence;
  sources: string;
}

export const EMPTY_DRAFT: Draft = {
  kind: 'modular',
  catalog: false,
  slug: 'my-setup',
  name: 'My telescope',
  manufacturer: '',
  design: '',
  aperture: null,
  focal: null,
  sensorModel: '',
  color: 'mono',
  cooled: true,
  pixel: null,
  width: null,
  height: null,
  cameraName: 'My camera',
  mountName: '',
  mountType: 'gem',
  flipAfter: 5,
  overhead: 3,
  control: 'ascom_indi',
  fovDiagonal: null,
  exposureOptions: '',
  notes: '',
  confidence: 'medium',
  sources: '',
};

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'entry';

const n = (v: number | null) => (v === null || !Number.isFinite(v) ? undefined : v);

/** Draft -> EquipmentFile. Missing numbers are left out so the schema reports them. */
export function draftToFile(d: Draft): EquipmentFile {
  const base = slugify(d.slug || d.name);
  const id = (suffix = '') => `${d.catalog ? '' : 'user:'}${base}${suffix}`;
  const sources = d.sources
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const meta = (extra: Record<string, unknown> = {}) => ({
    ...(d.manufacturer ? { manufacturer: d.manufacturer } : {}),
    ...extra,
    ...(d.notes ? { notes: d.notes } : {}),
    ...(d.catalog || sources.length ? { confidence: d.confidence, sources } : {}),
  });
  const file: EquipmentFile = { $schema: './equipment.schema.json', schemaVersion: 1, dataRetrieved: new Date().toISOString().slice(0, 10) };
  const sensorPx = [n(d.width), n(d.height)] as [number, number];
  if (d.kind === 'smart') {
    const opts = d.exposureOptions
      .split(/[,\s]+/)
      .map(Number)
      .filter((x) => Number.isFinite(x) && x > 0);
    file.all_in_one = [
      {
        id: id(),
        name: d.name,
        ...meta(),
        optics: { aperture_mm: n(d.aperture)!, focal_length_mm: n(d.focal)!, ...(d.design ? { design: d.design } : {}) },
        sensor: { ...(d.sensorModel ? { model: d.sensorModel } : {}), color: d.color, sensor_px: sensorPx, pixel_um: n(d.pixel)! },
        mount: { type: d.mountType, meridian_flip: d.mountType === 'gem' },
        ...(d.fovDiagonal ? { fov_deg_published: { diagonal: d.fovDiagonal } } : {}),
        ...(opts.length ? { exposure_options_s: opts } : {}),
        control: d.control,
      } as never,
    ];
  } else {
    file.telescopes = [{ id: id('-ota'), name: d.name, ...meta(d.design ? { design: d.design } : {}), aperture_mm: n(d.aperture)!, focal_length_mm: n(d.focal)! } as never];
    file.cameras = [
      {
        id: id('-cam'),
        name: d.cameraName || `${d.name} camera`,
        ...meta(d.sensorModel ? { sensor_model: d.sensorModel } : {}),
        color: d.color,
        cooled: d.cooled,
        default_mode: 'default',
        modes: [{ id: 'default', label: 'Default', sensor_px: sensorPx, pixel_um: n(d.pixel)! }],
      } as never,
    ];
    if (d.mountName) {
      file.mounts = [
        {
          id: id('-mount'),
          name: d.mountName,
          ...meta(),
          type: d.mountType,
          planning_defaults: {
            ...(n(d.flipAfter) !== undefined ? { meridian_flip_after_min: d.flipAfter! } : {}),
            ...(n(d.overhead) !== undefined ? { slew_and_center_overhead_min: d.overhead! } : {}),
          },
        } as never,
      ];
    }
    file.presets = [
      { id: id(), name: [d.name, d.cameraName, d.mountName].filter(Boolean).join(' + '), telescope: id('-ota'), camera: id('-cam'), camera_mode: 'default', ...(d.mountName ? { mount: id('-mount') } : {}) },
    ];
  }
  return file;
}

/** First entries of a file -> Draft (for "import JSON to edit"). */
export function fileToDraft(f: EquipmentFile): Draft {
  const strip = (id: string) => id.replace(/^user:/, '');
  const common = (e: { id: string; manufacturer?: string; notes?: string; confidence?: Confidence; sources?: string[] }) => ({
    catalog: !e.id.startsWith('user:'),
    manufacturer: e.manufacturer ?? '',
    notes: e.notes ?? '',
    confidence: e.confidence ?? 'medium',
    sources: (e.sources ?? []).join('\n'),
  });
  const s = f.all_in_one?.[0];
  if (s)
    return {
      ...EMPTY_DRAFT,
      ...common(s),
      kind: 'smart',
      slug: strip(s.id),
      name: s.name,
      design: s.optics.design ?? '',
      aperture: s.optics.aperture_mm,
      focal: s.optics.focal_length_mm,
      sensorModel: s.sensor.model ?? '',
      color: s.sensor.color,
      pixel: s.sensor.pixel_um,
      width: s.sensor.sensor_px[0],
      height: s.sensor.sensor_px[1],
      mountType: s.mount.type,
      control: s.control,
      fovDiagonal: s.fov_deg_published?.diagonal ?? null,
      exposureOptions: (s.exposure_options_s ?? []).join(', '),
    };
  const t = f.telescopes?.[0];
  const c = f.cameras?.[0];
  const m = f.mounts?.[0];
  const mode = c ? (c.modes.find((x) => x.id === c.default_mode) ?? c.modes[0]) : undefined;
  return {
    ...EMPTY_DRAFT,
    ...(t ? common(t) : c ? common(c) : {}),
    kind: 'modular',
    slug: strip(f.presets?.[0]?.id ?? t?.id ?? c?.id ?? 'my-setup').replace(/-ota$/, ''),
    name: t?.name ?? EMPTY_DRAFT.name,
    design: t?.design ?? '',
    aperture: t?.aperture_mm ?? null,
    focal: t?.focal_length_mm ?? null,
    cameraName: c?.name ?? '',
    sensorModel: c?.sensor_model ?? '',
    color: c?.color ?? 'mono',
    cooled: c?.cooled ?? false,
    pixel: mode?.pixel_um ?? null,
    width: mode?.sensor_px[0] ?? null,
    height: mode?.sensor_px[1] ?? null,
    mountName: m?.name ?? '',
    mountType: m?.type ?? 'gem',
    flipAfter: m?.planning_defaults?.meridian_flip_after_min ?? 5,
    overhead: m?.planning_defaults?.slew_and_center_overhead_min ?? 3,
  };
}

export function draftWarnings(d: Draft): string[] {
  const w: string[] = [];
  if (d.pixel !== null && d.pixel > 20) w.push(`Pixel size ${d.pixel} µm is unusually large. The unit is micrometres.`);
  if (d.pixel !== null && d.pixel > 0 && d.pixel < 1) w.push(`Pixel size ${d.pixel} µm is unusually small.`);
  if (d.aperture && d.focal) {
    const f = d.focal / d.aperture;
    if (f < 1.5 || f > 30) w.push(`Focal ratio f/${f.toFixed(1)} is implausible. Check aperture and focal length (both mm).`);
  }
  if (d.aperture && d.aperture > 1500) w.push('Aperture above 1.5 m: check the unit (mm).');
  if (d.kind === 'smart' && d.fovDiagonal && d.aperture && d.focal && d.pixel && d.width && d.height) {
    const der = deriveOptics({ aperture_mm: d.aperture, focal_length_mm: d.focal, pixel_um: d.pixel, sensor_px: [d.width, d.height] });
    const dis = fovDisagreement(der, { diagonal: d.fovDiagonal });
    if (dis > 0.1) w.push(`Computed diagonal (${der.fovDiagonalDeg.toFixed(2)}°) differs from the published one by ${(dis * 100).toFixed(0)} %.`);
  }
  return w;
}

export function EquipmentForm({ draft: d, onChange, showCatalogOptions = true }: { draft: Draft; onChange: (d: Draft) => void; showCatalogOptions?: boolean }) {
  const up = (p: Partial<Draft>) => onChange({ ...d, ...p });
  const derived =
    d.aperture && d.focal && d.pixel && d.width && d.height ? deriveOptics({ aperture_mm: d.aperture, focal_length_mm: d.focal, pixel_um: d.pixel, sensor_px: [d.width, d.height] }) : null;
  const mountTypes: { value: MountType; label: string }[] = [
    { value: 'gem', label: S.equipment.gem },
    { value: 'fork_eq', label: S.equipment.fork_eq },
    { value: 'altaz', label: S.equipment.altaz },
    { value: 'other', label: S.equipment.other },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={S.form.name}>
          <TextInput value={d.name} onChange={(v) => up({ name: v })} />
        </Field>
        <Field label={S.form.id} hint={S.form.idHint}>
          <div className="flex items-center gap-1">
            {!d.catalog && <span className="num text-xs text-faint">user:</span>}
            <TextInput value={d.slug} onChange={(v) => up({ slug: v })} />
          </div>
        </Field>
        <Field label={S.form.manufacturer}>
          <TextInput value={d.manufacturer} onChange={(v) => up({ manufacturer: v })} />
        </Field>
        <Field label={S.form.design}>
          <TextInput value={d.design} onChange={(v) => up({ design: v })} placeholder="e.g. Newtonian, SCT, APO" />
        </Field>
        <Field label={S.form.aperture}>
          <NumInput value={d.aperture} onChange={(v) => up({ aperture: v })} allowEmpty unit="mm" />
        </Field>
        <Field label={S.form.focal} hint={S.form.focalHint}>
          <NumInput value={d.focal} onChange={(v) => up({ focal: v })} allowEmpty unit="mm" />
        </Field>
        {d.kind === 'modular' && (
          <Field label={S.equipment.camera}>
            <TextInput value={d.cameraName} onChange={(v) => up({ cameraName: v })} />
          </Field>
        )}
        <Field label={S.form.sensorModel}>
          <TextInput value={d.sensorModel} onChange={(v) => up({ sensorModel: v })} placeholder="e.g. Sony IMX571" />
        </Field>
        <Field label={S.form.color}>
          <Select value={d.color} onChange={(v) => up({ color: v })} options={[{ value: 'mono', label: S.form.mono }, { value: 'osc', label: S.form.osc }]} />
        </Field>
        <Field label={S.form.pixel} hint={S.form.pixelHint}>
          <NumInput value={d.pixel} onChange={(v) => up({ pixel: v })} allowEmpty step={0.01} unit="µm" />
        </Field>
        <Field label={S.form.width}>
          <NumInput value={d.width} onChange={(v) => up({ width: v })} allowEmpty step={1} unit="px" />
        </Field>
        <Field label={S.form.height}>
          <NumInput value={d.height} onChange={(v) => up({ height: v })} allowEmpty step={1} unit="px" />
        </Field>
        {d.kind === 'modular' ? (
          <>
            <Field label={S.equipment.mount}>
              <TextInput value={d.mountName} onChange={(v) => up({ mountName: v })} placeholder="optional" />
            </Field>
            <Field label={S.form.mountType}>
              <Select value={d.mountType} onChange={(v) => up({ mountType: v })} options={mountTypes} />
            </Field>
            <Field label={S.form.flipAfter} hint={S.equipment.flipAfterHint}>
              <NumInput value={d.flipAfter} onChange={(v) => up({ flipAfter: v })} allowEmpty unit="min" />
            </Field>
            <Field label={S.form.overhead} hint={S.equipment.overheadHint}>
              <NumInput value={d.overhead} onChange={(v) => up({ overhead: v })} allowEmpty unit="min" />
            </Field>
            <Checkbox className="self-end pb-2" checked={d.cooled} onChange={(v) => up({ cooled: v })} label={S.form.cooled} />
          </>
        ) : (
          <>
            <Field label={S.form.mountType}>
              <Select value={d.mountType} onChange={(v) => up({ mountType: v })} options={mountTypes} />
            </Field>
            <Field label={S.form.control}>
              <Select value={d.control} onChange={(v) => up({ control: v })} options={[{ value: 'vendor_app', label: S.form.vendorApp }, { value: 'ascom_indi', label: S.form.ascomIndi }]} />
            </Field>
            <Field label={`${S.form.publishedFov}: ${S.form.diagonal}`}>
              <NumInput value={d.fovDiagonal} onChange={(v) => up({ fovDiagonal: v })} allowEmpty step={0.01} unit="°" />
            </Field>
            <Field label={S.form.exposureOptions}>
              <TextInput value={d.exposureOptions} onChange={(v) => up({ exposureOptions: v })} placeholder="10, 20, 30" />
            </Field>
          </>
        )}
      </div>
      <Field label={S.form.notes}>
        <TextInput value={d.notes} onChange={(v) => up({ notes: v })} />
      </Field>
      {showCatalogOptions && (
        <div className="border-t border-line pt-4">
          <Checkbox checked={d.catalog} onChange={(v) => up({ catalog: v })} label={S.builder.catalogEntry} />
          {(d.catalog || d.sources) && (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
              <Field label={S.builder.sourcesLabel}>
                <textarea className="num h-20 w-full border border-line-strong bg-transparent p-3 text-xs text-fg focus:border-fg focus:outline-none" value={d.sources} onChange={(e) => up({ sources: e.target.value })} />
              </Field>
              <Field label={S.form.confidence}>
                <Select value={d.confidence} onChange={(v) => up({ confidence: v })} options={[{ value: 'high', label: S.form.high }, { value: 'medium', label: S.form.medium }, { value: 'low', label: S.form.low }]} />
              </Field>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-8 border-t border-line pt-4">
        <Stat label={S.equipment.fRatio} value={d.aperture && d.focal ? `f/${(d.focal / d.aperture).toFixed(1)}` : '—'} />
        <Stat label={S.equipment.plateScale} value={derived ? `${derived.plateScale.toFixed(2)}″/px` : '—'} />
        <Stat label={S.equipment.fov} value={derived ? formatFov(derived) : '—'} sub={derived ? `diag ${derived.fovDiagonalDeg.toFixed(2)}°` : undefined} />
        {draftWarnings(d).map((w) => (
          <Badge key={w} tone="warn">
            {w}
          </Badge>
        ))}
      </div>
    </div>
  );
}

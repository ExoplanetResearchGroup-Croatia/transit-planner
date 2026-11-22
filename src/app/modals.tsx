/** Setup modals: location, equipment, nights, filters, export settings. Changes apply immediately; the plan recomputes on its own. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Crosshair, Upload, Download, Trash2, Plus } from 'lucide-react';
import { useStore, type SiteProfile } from '../state/store';
import { S } from '../strings';
import { Badge, Button, Checkbox, Field, Modal, NumInput, Segmented, Select, TextInput, cx, download, inputCls, Label } from '../components/ui';
import { locate, siteValid, tonightAt, useLibrary, useOfficialEquipment, useResolvedEquipment, useSite, useTimeFmt } from './hooks';
import { guessTimeZone, listTimeZones, zoneAbbreviation } from '../lib/astro/tz';
import { parseHorizonCsv } from '../lib/transits/horizon';
import { formatFov } from '../lib/equipment/derive';
import { validateEquipment } from '../lib/equipment/validate';
import { addUserEntries, removeUserEntry, type EquipmentSelection } from '../lib/equipment/library';
import type { EquipmentFile, MountType } from '../lib/equipment/types';
import { EquipmentForm, EMPTY_DRAFT, draftToFile, type Draft } from '../components/EquipmentForm';
import { DEFAULT_EXPOSURE_TABLE } from '../lib/equipment/exposure';
import { DEFAULT_FILTERS } from '../state/defaults';
import { computeNights, type DarknessDefinition } from '../lib/astro/darkness';
import { altitudeForAirmass } from '../lib/astro/coords';
import { EKOS_FORMATS, type EkosFormat } from '../lib/export/ekos';
import { inspectTemplate } from '../lib/export/nina';
import type { CoverageRequirement, FlipPolicy } from '../lib/transits/types';

/** Collapsible "more" section in the world's vocabulary. */
function More({ label, children, defaultOpen = false }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-line pt-4">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 caps text-muted hover:text-fg">
        <ChevronRight size={14} strokeWidth={1.5} className={cx('transition-transform duration-150', open && 'rotate-90')} />
        {label}
      </button>
      {open && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </div>
  );
}

export function SetupModals() {
  const modal = useStore((s) => s.modal);
  const close = () => useStore.getState().set({ modal: null });
  return (
    <>
      <LocationModal open={modal === 'location'} onClose={close} />
      <EquipmentModal open={modal === 'equipment'} onClose={close} />
      <NightsModal open={modal === 'nights'} onClose={close} />
      <FiltersModal open={modal === 'filters'} onClose={close} />
      <ExportSettingsModal open={modal === 'export'} onClose={close} />
    </>
  );
}

const doneFooter = (onClose: () => void) => (
  <Button variant="primary" onClick={onClose}>
    {S.modal.done}
  </Button>
);

/* ------------------------------------------------------------------ location */

function LocationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const sites = useStore((s) => s.sites);
  const upsert = useStore((s) => s.upsertSite);
  const del = useStore((s) => s.deleteSite);
  const set = useStore((s) => s.set);
  const geo = useStore((s) => s.geo);
  const site = useSite();
  const [horizonText, setHorizonText] = useState<string | null>(null);
  const [horizonErr, setHorizonErr] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const zones = useMemo(() => listTimeZones(), []);

  const edit = (patch: Partial<SiteProfile>) => {
    const base: SiteProfile = site ?? { id: `site-${Date.now().toString(36)}`, name: S.location.myLocation, lat: NaN, lon: NaN, elevation: 0, tz: 'UTC', horizon: [] };
    const next = { ...base, ...patch };
    if ((patch.lat !== undefined || patch.lon !== undefined) && Number.isFinite(next.lat) && Number.isFinite(next.lon) && (base.tz === 'UTC' || base.tz === guessTimeZone(base.lat, base.lon)))
      next.tz = guessTimeZone(next.lat, next.lon);
    upsert(next);
  };
  const applyHorizon = (text: string) => {
    const r = parseHorizonCsv(text);
    setHorizonErr(r.errors);
    edit({ horizon: r.points });
  };
  const hText = horizonText ?? (site?.horizon ?? []).map((p) => `${p.az},${p.alt}`).join('\n');

  return (
    <Modal open={open} onClose={onClose} title={S.location.title} footer={doneFooter(onClose)}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end gap-3">
          {sites.length > 1 && (
            <Field label={S.location.profiles} className="min-w-[200px] flex-1">
              <Select value={site?.id ?? ''} onChange={(id) => set({ activeSiteId: id })} options={sites.map((s) => ({ value: s.id, label: s.name }))} />
            </Field>
          )}
          <Button variant="primary" icon={<Crosshair size={14} strokeWidth={1.5} />} onClick={() => void locate()} disabled={geo === 'locating'}>
            {geo === 'locating' ? S.location.locating : S.location.useMyLocation}
          </Button>
          <Button
            variant="ghost"
            icon={<Plus size={14} strokeWidth={1.5} />}
            onClick={() => upsert({ id: `site-${Date.now().toString(36)}`, name: S.location.newProfile, lat: NaN, lon: NaN, elevation: 0, tz: 'UTC', horizon: [] })}
          >
            {S.location.newProfile}
          </Button>
        </div>
        {geo === 'failed' && <p className="text-sm text-yellow">{S.location.geoError}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={S.location.name} className="sm:col-span-2">
            <TextInput value={site?.name ?? ''} placeholder={S.location.myLocation} onChange={(v) => edit({ name: v })} />
          </Field>
          <Field label={S.location.lat} hint={S.location.latHint}>
            <NumInput value={site && Number.isFinite(site.lat) ? site.lat : null} onChange={(v) => edit({ lat: v ?? NaN })} step={0.0001} min={-90} max={90} unit="°" />
          </Field>
          <Field label={S.location.lon} hint={S.location.lonHint}>
            <NumInput value={site && Number.isFinite(site.lon) ? site.lon : null} onChange={(v) => edit({ lon: v ?? NaN })} step={0.0001} min={-180} max={180} unit="°" />
          </Field>
          <Field label={S.location.elevation}>
            <NumInput value={site?.elevation ?? 0} onChange={(v) => edit({ elevation: v ?? 0 })} step={1} unit="m" />
          </Field>
          <Field label={S.location.tz} hint={S.location.tzHint}>
            <Select value={site?.tz ?? 'UTC'} onChange={(v) => edit({ tz: v })} options={[...new Set(['UTC', site?.tz ?? 'UTC', ...zones])].map((z) => ({ value: z, label: z === site?.tz && siteValid(site) ? `${z} (${zoneAbbreviation(Date.now(), z)})` : z }))} />
          </Field>
        </div>
        {site && !siteValid(site) && <p className="text-sm text-yellow">{S.location.invalid}</p>}
        <More label={`${S.location.horizon} · ${S.location.horizonPoints((site?.horizon ?? []).length)}`}>
          <p className="text-xs text-muted">{S.location.horizonHint}</p>
          <textarea
            className="num h-28 w-full border border-line-strong bg-transparent p-3 text-xs text-fg focus:border-fg focus:outline-none"
            placeholder={'0,15\n90,20\n180,10\n270,25'}
            value={hText}
            disabled={!site}
            onChange={(e) => setHorizonText(e.target.value)}
            onBlur={() => horizonText !== null && applyHorizon(horizonText)}
          />
          {horizonErr.length > 0 && <p className="text-xs text-yellow">{horizonErr.slice(0, 3).join('; ')}</p>}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const t = await f.text();
                setHorizonText(t);
                applyHorizon(t);
              }}
            />
            <Button size="sm" icon={<Upload size={13} strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>
              {S.location.horizonImport}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setHorizonText('');
                applyHorizon('');
              }}
            >
              {S.location.horizonClear}
            </Button>
            {site && sites.length > 1 && (
              <Button size="sm" variant="danger" icon={<Trash2 size={13} strokeWidth={1.5} />} onClick={() => del(site.id)} className="ml-auto">
                {S.location.deleteProfile}
              </Button>
            )}
          </div>
        </More>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- equipment */

type EqTab = 'catalog' | 'mine' | 'import' | 'manual';

function EquipmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<EqTab>('catalog');
  const lib = useLibrary();
  const official = useOfficialEquipment();
  const sel = useStore((s) => s.selection);
  const set = useStore((s) => s.set);
  const mount = useStore((s) => s.mount);
  const eq = useResolvedEquipment();

  // take mount defaults from the newly chosen equipment
  const lastSel = useRef(JSON.stringify(sel));
  useEffect(() => {
    const key = JSON.stringify(sel);
    if (key === lastSel.current || !eq) return;
    lastSel.current = key;
    set({ mount: { ...mount, type: eq.mountType ?? mount.type, flipAfterMin: eq.flipAfterMin ?? mount.flipAfterMin, overheadMin: eq.overheadMin ?? mount.overheadMin } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, eq]);

  return (
    <Modal open={open} onClose={onClose} title={S.equipment.title} wide footer={doneFooter(onClose)}>
      <div className="flex flex-col gap-5">
        <EquipmentSummary />
        <Segmented<EqTab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'catalog', label: S.equipment.tabCatalog },
            { value: 'mine', label: S.equipment.tabMine },
            { value: 'import', label: S.equipment.tabImport },
            { value: 'manual', label: S.equipment.tabManual },
          ]}
        />
        {tab === 'catalog' && <CatalogPicker lib={lib} official={official} sel={sel} choose={(s) => set({ selection: s })} />}
        {tab === 'mine' && <MyEquipment sel={sel} choose={(s) => set({ selection: s })} />}
        {tab === 'import' && <ImportEquipment official={official} onDone={() => setTab('mine')} />}
        {tab === 'manual' && <ManualEntry onDone={() => setTab('mine')} />}
        <More label={S.equipment.advanced}>
          <MountSettings />
          <ExposureTable />
        </More>
      </div>
    </Modal>
  );
}

function EquipmentSummary() {
  const eq = useResolvedEquipment();
  const mode = useStore((s) => s.mode);
  const set = useStore((s) => s.set);
  if (!eq) return <p className="text-sm text-muted">{S.equipment.noSelection}</p>;
  const src = eq.allInOne ?? eq.telescope;
  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-base text-fg">{eq.name}</span>
        <button type="button" className="caps text-muted underline decoration-line-strong underline-offset-4 hover:text-fg" onClick={() => set({ selection: { kind: 'none' } })}>
          {S.equipment.clear}
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {[
          [S.equipment.aperture, eq.apertureMm ? `${eq.apertureMm} mm` : '—'],
          [S.equipment.fRatio, eq.derived ? `f/${eq.derived.fRatio.toFixed(1)}` : '—'],
          [S.equipment.plateScale, eq.derived ? `${eq.derived.plateScale.toFixed(2)}″/px` : '—'],
          [S.equipment.fov, eq.derived ? formatFov(eq.derived) : '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-1">
            <dt className="caps text-muted">{k}</dt>
            <dd className="num text-sm text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      {eq.vendorApp && <Badge tone="warn">{S.equipment.vendorApp}</Badge>}
      {mode === 'photometry' && eq.color === 'osc' && eq.mountType === 'altaz' && <Badge tone="warn">{S.equipment.oscWarn}</Badge>}
      {src?.sources && (
        <p className="text-xs text-muted">
          {S.equipment.sources}:{' '}
          {src.sources.map((u, i) => (
            <a key={u} href={u} target="_blank" rel="noreferrer noopener" className="underline decoration-line-strong hover:text-fg">
              {i ? ', ' : ''}
              {new URL(u).hostname.replace(/^www\./, '')}
            </a>
          ))}
          {' · '}
          {S.equipment.confidence} {src.confidence}
          {src.needs_verification?.length ? ` · ${S.equipment.verify}: ${src.needs_verification.join(', ')}` : ''}
        </p>
      )}
    </div>
  );
}

function Choice({ active, onClick, title, sub }: { active: boolean; onClick: () => void; title: string; sub?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('flex items-stretch border text-left transition-colors duration-150', active ? 'border-fg' : 'border-line hover:border-line-strong')}
    >
      <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <span className="text-sm text-fg">{title}</span>
        {sub && <span className="num text-xs text-muted">{sub}</span>}
      </span>
      <span aria-hidden className={cx('w-2 shrink-0', active ? 'bg-red' : 'bg-transparent')} />
    </button>
  );
}

function CatalogPicker({ lib, official, sel, choose }: { lib: EquipmentFile; official: EquipmentFile | null; sel: EquipmentSelection; choose: (s: EquipmentSelection) => void }) {
  const o = official ?? { schemaVersion: 1 as const };
  const mod = sel.kind === 'modular' ? sel : { kind: 'modular' as const, telescopeId: null, cameraId: null, cameraMode: null, mountId: null, filterIds: [] };
  const cam = lib.cameras?.find((c) => c.id === mod.cameraId);
  const opt = (arr: { id: string; name: string }[] | undefined) => [{ value: '', label: S.equipment.none }, ...(arr ?? []).map((x) => ({ value: x.id, label: x.name }))];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h4 className="text-[15px] text-fg">{S.equipment.presets}</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {(o.presets ?? []).map((p) => (
            <Choice key={p.id} active={sel.kind === 'preset' && sel.presetId === p.id} onClick={() => choose({ kind: 'preset', presetId: p.id })} title={p.name} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-[15px] text-fg">{S.equipment.smart}</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {(o.all_in_one ?? []).map((s) => (
            <Choice
              key={s.id}
              active={sel.kind === 'all_in_one' && sel.allInOneId === s.id}
              onClick={() => choose({ kind: 'all_in_one', allInOneId: s.id })}
              title={s.name}
              sub={`${s.optics.aperture_mm} mm · f/${(s.optics.focal_length_mm / s.optics.aperture_mm).toFixed(1)} · ${s.confidence}${s.needs_verification?.length ? ` · ${S.equipment.verify.toLowerCase()}` : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h4 className="text-[15px] text-fg">{S.equipment.modular}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={S.equipment.telescope}>
            <Select value={mod.telescopeId ?? ''} onChange={(v) => choose({ ...mod, telescopeId: v || null })} options={opt(lib.telescopes)} />
          </Field>
          <Field label={S.equipment.camera}>
            <Select value={mod.cameraId ?? ''} onChange={(v) => choose({ ...mod, cameraId: v || null, cameraMode: null })} options={opt(lib.cameras)} />
          </Field>
          {cam && cam.modes.length > 1 && (
            <Field label={S.equipment.cameraMode}>
              <Select
                value={mod.cameraMode ?? cam.default_mode ?? cam.modes[0].id}
                onChange={(v) => choose({ ...mod, cameraMode: v })}
                options={cam.modes.map((m) => ({ value: m.id, label: `${m.label ?? m.id} · ${m.pixel_um} µm · ${m.sensor_px[0]}×${m.sensor_px[1]}` }))}
              />
            </Field>
          )}
          <Field label={S.equipment.mount}>
            <Select value={mod.mountId ?? ''} onChange={(v) => choose({ ...mod, mountId: v || null })} options={opt(lib.mounts)} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function MyEquipment({ sel, choose }: { sel: EquipmentSelection; choose: (s: EquipmentSelection) => void }) {
  const user = useStore((s) => s.userEquipment);
  const set = useStore((s) => s.set);
  const entries: { section: keyof EquipmentFile; id: string; name: string; pick?: EquipmentSelection }[] = [
    ...(user.presets ?? []).map((p) => ({ section: 'presets' as const, id: p.id, name: p.name, pick: { kind: 'preset', presetId: p.id } as EquipmentSelection })),
    ...(user.all_in_one ?? []).map((p) => ({ section: 'all_in_one' as const, id: p.id, name: p.name, pick: { kind: 'all_in_one', allInOneId: p.id } as EquipmentSelection })),
    ...(user.telescopes ?? []).map((p) => ({ section: 'telescopes' as const, id: p.id, name: p.name })),
    ...(user.cameras ?? []).map((p) => ({ section: 'cameras' as const, id: p.id, name: p.name })),
    ...(user.mounts ?? []).map((p) => ({ section: 'mounts' as const, id: p.id, name: p.name })),
  ];
  return (
    <div className="flex flex-col gap-3">
      {entries.length === 0 && <p className="text-sm text-muted">{S.equipment.noMine}</p>}
      {entries.map((e) => {
        const active = !!e.pick && JSON.stringify(sel) === JSON.stringify(e.pick);
        return (
          <div key={`${e.section}:${e.id}`} className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <div className="truncate text-sm text-fg">{e.name}</div>
              <div className="num text-xs text-faint">{e.id}</div>
            </div>
            <div className="flex gap-2">
              {e.pick && (
                <Button size="sm" variant={active ? 'primary' : 'secondary'} onClick={() => choose(e.pick!)}>
                  {active ? S.equipment.selected : S.equipment.select}
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={<Trash2 size={13} strokeWidth={1.5} />} onClick={() => set({ userEquipment: removeUserEntry(user, e.section as never, e.id) })}>
                {S.equipment.deleteEntry}
              </Button>
            </div>
          </div>
        );
      })}
      {entries.length > 0 && (
        <Button size="sm" className="self-start" icon={<Download size={13} strokeWidth={1.5} />} onClick={() => download('my-equipment.json', JSON.stringify(user, null, 2), 'application/json')}>
          {S.equipment.exportMine}
        </Button>
      )}
    </div>
  );
}

function ImportEquipment({ official, onDone }: { official: EquipmentFile | null; onDone: () => void }) {
  const set = useStore((s) => s.set);
  const user = useStore((s) => s.userEquipment);
  const [issues, setIssues] = useState<string[] | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">{S.equipment.importHint}</p>
      <input
        ref={ref}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          let data: unknown;
          try {
            data = JSON.parse(await f.text());
          } catch (err) {
            setIssues([`JSON: ${String(err)}`]);
            return;
          }
          const r = validateEquipment(data, { resolveAgainst: official ?? undefined });
          if (!r.valid) {
            setIssues(r.issues.filter((i) => i.level === 'error').map((i) => `${i.path}: ${i.message}`));
            return;
          }
          set({ userEquipment: addUserEntries(user, data as EquipmentFile) });
          setIssues(null);
          onDone();
        }}
      />
      <Button variant="primary" className="self-start" icon={<Upload size={14} strokeWidth={1.5} />} onClick={() => ref.current?.click()}>
        {S.equipment.importButton}
      </Button>
      {issues && (
        <div className="border border-red p-3 text-sm">
          <p className="mb-1 caps text-red">{S.equipment.importInvalid}</p>
          <ul className="list-disc pl-5 text-xs text-fg">
            {issues.slice(0, 20).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ManualEntry({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const set = useStore((s) => s.set);
  const user = useStore((s) => s.userEquipment);
  const file = draftToFile({ ...draft, catalog: false });
  const res = validateEquipment(file);
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        size="sm"
        value={draft.kind}
        onChange={(k) => setDraft({ ...draft, kind: k })}
        options={[
          { value: 'modular', label: S.builder.modularTpl },
          { value: 'smart', label: S.builder.smartTpl },
        ]}
      />
      <EquipmentForm draft={{ ...draft, catalog: false }} onChange={setDraft} showCatalogOptions={false} />
      {!res.valid && (
        <ul className="list-disc pl-5 text-xs text-yellow">
          {res.issues
            .filter((i) => i.level === 'error')
            .slice(0, 6)
            .map((i) => (
              <li key={i.path + i.message}>
                {i.path}: {i.message}
              </li>
            ))}
        </ul>
      )}
      <Button
        variant="primary"
        className="self-start"
        disabled={!res.valid}
        onClick={() => {
          const merged = addUserEntries(user, file);
          const preset = file.presets?.[0]?.id;
          const smart = file.all_in_one?.[0]?.id;
          set({
            userEquipment: merged,
            selection: preset ? { kind: 'preset', presetId: `user:${preset.replace(/^user:/, '')}` } : smart ? { kind: 'all_in_one', allInOneId: `user:${smart.replace(/^user:/, '')}` } : { kind: 'none' },
          });
          onDone();
        }}
      >
        {S.equipment.addToMine}
      </Button>
    </div>
  );
}

function MountSettings() {
  const mount = useStore((s) => s.mount);
  const set = useStore((s) => s.set);
  const up = (p: Partial<typeof mount>) => set({ mount: { ...mount, ...p } });
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Field label={S.equipment.mountType} className="sm:col-span-4">
        <Select<MountType>
          value={mount.type}
          onChange={(v) => up({ type: v })}
          options={[
            { value: 'gem', label: S.equipment.gem },
            { value: 'fork_eq', label: S.equipment.fork_eq },
            { value: 'altaz', label: S.equipment.altaz },
            { value: 'other', label: S.equipment.other },
          ]}
        />
      </Field>
      <Field label={S.equipment.flipAfter} hint={S.equipment.flipAfterHint}>
        <NumInput value={mount.flipAfterMin} onChange={(v) => up({ flipAfterMin: v ?? 0 })} unit="min" />
      </Field>
      <Field label={S.equipment.overhead} hint={S.equipment.overheadHint}>
        <NumInput value={mount.overheadMin} onChange={(v) => up({ overheadMin: Math.max(0, v ?? 0) })} unit="min" />
      </Field>
      <Field label={S.equipment.autofocus} hint={S.equipment.autofocusHint}>
        <NumInput value={mount.autofocusMin} onChange={(v) => up({ autofocusMin: Math.max(0, v ?? 0) })} unit="min" />
      </Field>
    </div>
  );
}

function ExposureTable() {
  const table = useStore((s) => s.exposureTable);
  const set = useStore((s) => s.set);
  const update = (i: number, p: Partial<(typeof table)[number]>) => set({ exposureTable: table.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{S.equipment.exposure}</Label>
        <button type="button" className="caps text-muted underline decoration-line-strong underline-offset-4 hover:text-fg" onClick={() => set({ exposureTable: DEFAULT_EXPOSURE_TABLE })}>
          {S.equipment.resetTable}
        </button>
      </div>
      <p className="text-xs text-muted">{S.equipment.exposureHint}</p>
      <div className="grid grid-cols-[1fr_1fr_40px] gap-x-2 gap-y-1.5">
        <span className="caps text-faint">{S.equipment.maxMag}</span>
        <span className="caps text-faint">{S.equipment.seconds}</span>
        <span />
        {table.map((r, i) => (
          <div key={i} className="contents">
            <NumInput value={r.maxMag} onChange={(v) => update(i, { maxMag: v ?? 0 })} step={0.5} />
            <NumInput value={r.exposureS} onChange={(v) => update(i, { exposureS: Math.max(0.1, v ?? 1) })} step={1} unit="s" />
            <button type="button" aria-label={S.equipment.removeRow} className="inline-flex items-center justify-center text-faint hover:text-red" onClick={() => set({ exposureTable: table.filter((_, j) => j !== i) })}>
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          </div>
        ))}
      </div>
      <Button size="sm" className="self-start" icon={<Plus size={13} strokeWidth={1.5} />} onClick={() => set({ exposureTable: [...table, { maxMag: 99, exposureS: 120 }] })}>
        {S.equipment.addRow}
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------- nights */

function NightsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useStore();
  const site = useSite();
  const f = useTimeFmt();
  const tonight = siteValid(site) ? tonightAt(site.tz) : null;
  const first = s.firstNight ?? tonight;
  const nights = useMemo(
    () => (open && siteValid(site) && first ? computeNights(site, first, Math.min(14, Math.max(1, s.nights)), s.darkness) : []),
    [open, site, first, s.nights, s.darkness],
  );
  return (
    <Modal open={open} onClose={onClose} title={S.nights.title} footer={doneFooter(onClose)}>
      <div className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={S.nights.start}>
            <input type="date" className={cx(inputCls, 'num')} value={first ?? ''} disabled={s.firstNight === null} onChange={(e) => e.target.value && s.set({ firstNight: e.target.value })} />
          </Field>
          <Field label={S.nights.nights}>
            <NumInput value={s.nights} onChange={(v) => s.set({ nights: Math.round(Math.min(14, Math.max(1, v ?? 1))) })} min={1} max={14} step={1} />
          </Field>
        </div>
        <Checkbox checked={s.firstNight === null} onChange={(v) => s.set({ firstNight: v ? null : tonight })} label={S.nights.tonight} />
        <Field label={S.nights.darkness}>
          <Segmented<DarknessDefinition>
            value={s.darkness}
            onChange={(v) => s.set({ darkness: v })}
            options={[
              { value: 'astronomical', label: '−18°', title: S.nights.astronomical },
              { value: 'nautical', label: '−12°', title: S.nights.nautical },
              { value: 'civil', label: '−6°', title: S.nights.civil },
            ]}
          />
        </Field>
        <p className="text-xs text-muted">
          {s.darkness === 'astronomical' ? S.nights.astronomical : s.darkness === 'nautical' ? S.nights.nautical : S.nights.civil}. {S.nights.hint}
        </p>
        <table className="w-full text-sm">
          <tbody>
            {nights.map((n) => (
              <tr key={n.date} className={cx('border-t border-line', n.status === 'no-darkness' && 'opacity-40')}>
                <td className="num py-2 pr-3 text-fg">{n.date}</td>
                <td className="num pr-3 text-muted">{n.status === 'no-darkness' ? S.plan.noDarkness : `${f.t(n.darkStart)}–${f.t(n.darkEnd)}`}</td>
                <td className="num text-right text-muted">
                  {S.plan.moon} {Math.round(n.moonIllum * 100)} %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------- filters */

function Range({ label, min, max, onMin, onMax, step, unit, allowEmptyMax, hint }: { label: string; min: number; max: number | null; onMin: (v: number) => void; onMax: (v: number | null) => void; step: number; unit?: string; allowEmptyMax?: boolean; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <NumInput value={min} onChange={(v) => onMin(v ?? 0)} step={step} unit={unit} />
        <span className="text-faint">–</span>
        <NumInput value={max} onChange={onMax} step={step} unit={unit} allowEmpty={allowEmptyMax} placeholder={allowEmptyMax ? S.filters.none : undefined} />
      </div>
    </Field>
  );
}

function FiltersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mode = useStore((s) => s.mode);
  const f = useStore((s) => s.filters[s.mode]);
  const setF = useStore((s) => s.setFilters);
  const set = useStore((s) => s.set);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={S.filters.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => setF(DEFAULT_FILTERS[mode])}>
            {S.filters.reset}
          </Button>
          {doneFooter(onClose)}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label={S.strip.mode}>
          <Segmented
            value={mode}
            onChange={(m) => set({ mode: m })}
            options={[
              { value: 'photometry', label: S.strip.photometry, title: S.strip.photometryHint },
              { value: 'showcase', label: S.strip.showcase, title: S.strip.showcaseHint },
            ]}
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">{mode === 'photometry' ? S.strip.photometryHint : S.strip.showcaseHint}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Range label={S.filters.magnitude} hint={S.filters.magnitudeHint} min={f.magMin} max={f.magMax} onMin={(v) => setF({ magMin: v })} onMax={(v) => setF({ magMax: v ?? 20 })} step={0.5} />
          <Range label={S.filters.depth} min={f.depthMinPpt} max={f.depthMaxPpt} onMin={(v) => setF({ depthMinPpt: v })} onMax={(v) => setF({ depthMaxPpt: v })} step={0.5} allowEmptyMax />
          <Field label={S.filters.minAlt}>
            <NumInput value={f.minAlt} onChange={(v) => setF({ minAlt: Math.min(85, Math.max(0, v ?? 0)) })} step={1} unit="°" />
          </Field>
          <Field label={S.filters.coverage} hint={S.filters.coverageHint}>
            <Segmented<CoverageRequirement>
              value={f.coverage}
              onChange={(v) => setF({ coverage: v })}
              options={[
                { value: 'full', label: S.filters.coverageFull },
                { value: 'transit', label: S.filters.coverageTransit },
                { value: 'partial', label: S.filters.coveragePartial },
              ]}
            />
          </Field>
          <Field label={S.filters.flip} hint={S.filters.flipHint} className="sm:col-span-2">
            <Segmented<FlipPolicy>
              value={f.flipPolicy}
              onChange={(v) => setF({ flipPolicy: v })}
              options={[
                { value: 'avoid', label: S.filters.flipAvoid },
                { value: 'flag', label: S.filters.flipFlag },
                { value: 'allow', label: S.filters.flipAllow },
              ]}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-2.5">
          <Label>{S.filters.sources}</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Checkbox checked={f.sources.exoclock} onChange={(v) => setF({ sources: { ...f.sources, exoclock: v } })} label={S.filters.exoclock} />
            <Checkbox checked={f.sources.nasa} onChange={(v) => setF({ sources: { ...f.sources, nasa: v } })} label={S.filters.nasa} />
            <Checkbox checked={f.sources.toi} onChange={(v) => setF({ sources: { ...f.sources, toi: v } })} label={S.filters.toi} />
          </div>
          <Checkbox checked={f.needsObservations} onChange={(v) => setF({ needsObservations: v })} label={S.filters.needsObs} />
        </div>
        <RejectedSummary />
        <More label={S.filters.more}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Range label={S.filters.duration} min={f.durationMinH} max={f.durationMaxH} onMin={(v) => setF({ durationMinH: v })} onMax={(v) => setF({ durationMaxH: v ?? 24 })} step={0.25} unit="h" />
            <Field label={S.filters.maxAirmass} hint={f.maxAirmass ? `≈ ${altitudeForAirmass(f.maxAirmass).toFixed(1)}°` : undefined}>
              <NumInput value={f.maxAirmass} onChange={(v) => setF({ maxAirmass: v && v >= 1 ? v : null })} allowEmpty step={0.1} placeholder={S.filters.none} />
            </Field>
            <Field label={S.filters.moonSep} hint={S.filters.moonHint}>
              <NumInput value={f.moonMinSepDeg} onChange={(v) => setF({ moonMinSepDeg: Math.max(0, v ?? 0) })} step={5} unit="°" />
            </Field>
            <Field label={S.filters.moonIllum} hint={S.filters.moonHint}>
              <NumInput value={Math.round(f.moonMaxIllum * 100)} onChange={(v) => setF({ moonMaxIllum: Math.min(1, Math.max(0, (v ?? 100) / 100)) })} step={5} unit="%" />
            </Field>
            <Field label={S.filters.maxSigma}>
              <NumInput value={f.maxSigmaMin} onChange={(v) => setF({ maxSigmaMin: v })} allowEmpty step={5} unit="min" placeholder={S.filters.none} />
            </Field>
            {f.coverage === 'partial' && (
              <Field label={S.filters.minFraction}>
                <NumInput value={Math.round(f.minTransitFraction * 100)} onChange={(v) => setF({ minTransitFraction: Math.min(1, Math.max(0.05, (v ?? 50) / 100)) })} step={5} unit="%" />
              </Field>
            )}
            <Field label={S.filters.baseline}>
              <div className="flex gap-2">
                <Segmented
                  size="sm"
                  value={f.baselineMode}
                  onChange={(v) => setF({ baselineMode: v })}
                  options={[
                    { value: 'fixed', label: S.filters.baselineFixed },
                    { value: 'proportional', label: S.filters.baselineProp },
                  ]}
                />
                {f.baselineMode === 'fixed' ? (
                  <NumInput value={f.baselineMin} onChange={(v) => setF({ baselineMin: Math.max(0, v ?? 0) })} step={5} unit="min" />
                ) : (
                  <NumInput value={f.baselineFactor} onChange={(v) => setF({ baselineFactor: Math.max(0, v ?? 0) })} step={0.1} unit="×T" />
                )}
              </div>
            </Field>
            <Field label={S.filters.widen} hint={S.filters.widenHint}>
              <NumInput value={f.widenSigma} onChange={(v) => setF({ widenSigma: Math.max(0, v ?? 0) })} step={0.5} unit="σ" />
            </Field>
          </div>
          <Checkbox checked={f.allowUnknownSigma} onChange={(v) => setF({ allowUnknownSigma: v })} label={S.filters.unknownSigma} />
        </More>
      </div>
    </Modal>
  );
}

function RejectedSummary() {
  const result = useStore((s) => s.result);
  if (!result || Object.keys(result.rejected).length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <Label>{S.plan.filteredLast}</Label>
      <p className="text-xs leading-relaxed text-muted">
        {Object.entries(result.rejected)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([k, v]) => `${S.reject[k as keyof typeof S.reject]} ${v}`)
          .join(' · ')}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- export settings */

function ExportSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ex = useStore((s) => s.exportSettings);
  const set = useStore((s) => s.set);
  const site = useSite();
  const up = (p: Partial<typeof ex>) => set({ exportSettings: { ...ex, ...p } });
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const zones = useMemo(() => listTimeZones(), []);
  const custom = useMemo(() => {
    if (!ex.ninaTemplate) return null;
    try {
      return inspectTemplate(JSON.parse(ex.ninaTemplate));
    } catch {
      return null;
    }
  }, [ex.ninaTemplate]);
  const clock = ex.clockTz ?? site?.tz ?? 'UTC';
  return (
    <Modal open={open} onClose={onClose} title={S.exportSettings.title} footer={doneFooter(onClose)}>
      <div className="flex flex-col gap-5">
        <Field label={S.exportSettings.clockTz} hint={S.exportSettings.clockTzHint}>
          <Select value={clock} onChange={(v) => up({ clockTz: v === site?.tz ? null : v })} options={[...new Set([site?.tz ?? 'UTC', 'UTC', ...zones])].map((z) => ({ value: z, label: z }))} />
        </Field>
        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <Field label={S.exportSettings.ekosFormat}>
            <Select<EkosFormat> value={ex.ekosFormat} onChange={(v) => up({ ekosFormat: v })} options={Object.entries(EKOS_FORMATS).map(([value, label]) => ({ value: value as EkosFormat, label }))} />
          </Field>
          <Field label={S.exportSettings.ekosProfile}>
            <TextInput value={ex.ekosProfile} onChange={(v) => up({ ekosProfile: v })} />
          </Field>
          <Field label={S.exportSettings.ekosSeq} className="sm:col-span-2">
            <TextInput value={ex.ekosSequencePath} onChange={(v) => up({ ekosSequencePath: v })} />
          </Field>
          <Field label={S.exportSettings.filterName}>
            <TextInput value={ex.esqFilter} onChange={(v) => up({ esqFilter: v })} placeholder="V" />
          </Field>
          <Field label={S.exportSettings.temperature}>
            <NumInput value={ex.esqTemperature} onChange={(v) => up({ esqTemperature: v })} allowEmpty unit="°C" />
          </Field>
          <Field label={S.exportSettings.fitsDir} className="sm:col-span-2">
            <TextInput value={ex.esqFitsDir} onChange={(v) => up({ esqFitsDir: v })} />
          </Field>
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-5">
          <Label>{S.exportSettings.ninaTemplate}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              value={ex.ninaUseCustom && ex.ninaTemplate ? 'custom' : 'builtin'}
              onChange={(v) => (v === 'custom' ? (ex.ninaTemplate ? up({ ninaUseCustom: true }) : fileRef.current?.click()) : up({ ninaUseCustom: false }))}
              options={[
                { value: 'builtin', label: S.exportSettings.ninaBuiltin },
                { value: 'custom', label: S.exportSettings.ninaCustom },
              ]}
            />
            <Button size="sm" variant="ghost" icon={<Upload size={13} strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>
              {S.exportSettings.ninaUpload}
            </Button>
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
                try {
                  JSON.parse(text);
                } catch {
                  return setErr(S.exportSettings.notJson);
                }
                setErr(null);
                up({ ninaTemplate: text, ninaTemplateName: file.name, ninaUseCustom: true });
              }}
            />
          </div>
          {ex.ninaTemplateName && (
            <p className="text-xs text-muted">
              {ex.ninaTemplateName}
              {custom ? ` · NINA ${custom.version}` : ''}
            </p>
          )}
          {custom?.problems.map((p) => (
            <Badge key={p} tone="warn">
              {p}
            </Badge>
          ))}
          {err && <p className="text-xs text-red">{err}</p>}
          <Checkbox checked={ex.ninaSetExposure} onChange={(v) => up({ ninaSetExposure: v })} label={S.exportSettings.ninaSetExposure} />
        </div>
      </div>
    </Modal>
  );
}

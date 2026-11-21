import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../state/store';
import { S } from '../../strings';
import { Badge, Button, Card, Field, NumInput, Segmented, Select, Stat, StepHeader, download, cx } from '../../components/ui';
import { useLibrary, useOfficialEquipment, useResolvedEquipment } from '../hooks';
import { formatFov } from '../../lib/equipment/derive';
import { validateEquipment } from '../../lib/equipment/validate';
import { addUserEntries, removeUserEntry, type EquipmentSelection } from '../../lib/equipment/library';
import type { EquipmentFile, MountType } from '../../lib/equipment/types';
import { EquipmentForm, EMPTY_DRAFT, draftToFile, type Draft } from '../../components/EquipmentForm';
import { DEFAULT_EXPOSURE_TABLE } from '../../lib/equipment/exposure';

type Tab = 'catalog' | 'mine' | 'import' | 'manual';

export function EquipmentStep() {
  const [tab, setTab] = useState<Tab>('catalog');
  const lib = useLibrary();
  const official = useOfficialEquipment();
  const sel = useStore((s) => s.selection);
  const set = useStore((s) => s.set);
  const mount = useStore((s) => s.mount);
  const eq = useResolvedEquipment();
  const user = useStore((s) => s.userEquipment);

  // when the selection changes, take mount defaults from the equipment
  const lastSel = useRef(JSON.stringify(sel));
  useEffect(() => {
    const key = JSON.stringify(sel);
    if (key === lastSel.current || !eq) return;
    lastSel.current = key;
    set({
      mount: {
        ...mount,
        type: eq.mountType ?? mount.type,
        flipAfterMin: eq.flipAfterMin ?? mount.flipAfterMin,
        overheadMin: eq.overheadMin ?? mount.overheadMin,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, eq]);

  const choose = (s: EquipmentSelection) => set({ selection: s });

  return (
    <div>
      <StepHeader title={S.equipment.title} intro={S.equipment.intro} />
      <div className="mb-4">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'catalog', label: S.equipment.tabCatalog },
            { value: 'mine', label: S.equipment.tabMine },
            { value: 'import', label: S.equipment.tabImport },
            { value: 'manual', label: S.equipment.tabManual },
          ]}
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {tab === 'catalog' && <CatalogPicker lib={lib} officialOnly={official} sel={sel} choose={choose} />}
          {tab === 'mine' && <MyEquipment user={user} sel={sel} choose={choose} />}
          {tab === 'import' && <ImportEquipment official={official} onDone={() => setTab('mine')} />}
          {tab === 'manual' && <ManualEntry onDone={() => setTab('mine')} />}
        </div>
        <div className="flex flex-col gap-4">
          <SummaryCard />
          <MountCard />
          <ExposureCard />
        </div>
      </div>
    </div>
  );
}

function OptionButton({ active, onClick, title, sub, badges }: { active: boolean; onClick: () => void; title: string; sub?: string; badges?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex flex-col items-start gap-1 rounded-md border px-3 py-2 text-left transition-colors', active ? 'border-accent bg-accent/5' : 'border-line bg-bg hover:border-faint')}
    >
      <span className="text-sm font-medium">{title}</span>
      {sub && <span className="num text-xs text-muted">{sub}</span>}
      {badges && <span className="flex flex-wrap gap-1">{badges}</span>}
    </button>
  );
}

function CatalogPicker({ lib, officialOnly, sel, choose }: { lib: EquipmentFile; officialOnly: EquipmentFile | null; sel: EquipmentSelection; choose: (s: EquipmentSelection) => void }) {
  const o = officialOnly ?? { schemaVersion: 1 as const };
  const mod = sel.kind === 'modular' ? sel : { kind: 'modular' as const, telescopeId: null, cameraId: null, cameraMode: null, mountId: null, filterIds: [] };
  const cam = lib.cameras?.find((c) => c.id === mod.cameraId);
  const opt = (arr: { id: string; name: string }[] | undefined) => [{ value: '', label: S.equipment.select }, ...(arr ?? []).map((x) => ({ value: x.id, label: x.name }))];
  return (
    <>
      <Card title={S.equipment.presets}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(o.presets ?? []).map((p) => (
            <OptionButton key={p.id} active={sel.kind === 'preset' && sel.presetId === p.id} onClick={() => choose({ kind: 'preset', presetId: p.id })} title={p.name} />
          ))}
        </div>
      </Card>
      <Card title={S.equipment.smart}>
        <div className="grid gap-2 sm:grid-cols-2">
          {(o.all_in_one ?? []).map((s) => (
            <OptionButton
              key={s.id}
              active={sel.kind === 'all_in_one' && sel.allInOneId === s.id}
              onClick={() => choose({ kind: 'all_in_one', allInOneId: s.id })}
              title={s.name}
              sub={`${s.optics.aperture_mm} mm · f/${(s.optics.focal_length_mm / s.optics.aperture_mm).toFixed(1)}`}
              badges={
                <>
                  <Badge tone={s.confidence === 'high' ? 'ok' : 'warn'}>{s.confidence}</Badge>
                  {s.needs_verification?.length ? <Badge tone="warn">{S.equipment.verify}</Badge> : null}
                </>
              }
            />
          ))}
        </div>
      </Card>
      <Card title={S.equipment.modular}>
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
      </Card>
    </>
  );
}

function MyEquipment({ user, sel, choose }: { user: EquipmentFile; sel: EquipmentSelection; choose: (s: EquipmentSelection) => void }) {
  const set = useStore((s) => s.set);
  const entries: { section: keyof EquipmentFile; id: string; name: string; pick?: EquipmentSelection }[] = [
    ...(user.presets ?? []).map((p) => ({ section: 'presets' as const, id: p.id, name: p.name, pick: { kind: 'preset', presetId: p.id } as EquipmentSelection })),
    ...(user.all_in_one ?? []).map((p) => ({ section: 'all_in_one' as const, id: p.id, name: p.name, pick: { kind: 'all_in_one', allInOneId: p.id } as EquipmentSelection })),
    ...(user.telescopes ?? []).map((p) => ({ section: 'telescopes' as const, id: p.id, name: p.name })),
    ...(user.cameras ?? []).map((p) => ({ section: 'cameras' as const, id: p.id, name: p.name })),
    ...(user.mounts ?? []).map((p) => ({ section: 'mounts' as const, id: p.id, name: p.name })),
  ];
  return (
    <Card
      title={S.equipment.tabMine}
      actions={
        <Button size="sm" title={S.equipment.exportMineHint} disabled={entries.length === 0} onClick={() => download('my-equipment.json', JSON.stringify(user, null, 2), 'application/json')}>
          {S.equipment.exportMine}
        </Button>
      }
    >
      {entries.length === 0 && <p className="text-sm text-muted">{S.equipment.noMine}</p>}
      <ul className="flex flex-col gap-2">
        {entries.map((e) => (
          <li key={`${e.section}:${e.id}`} className="flex items-center justify-between gap-2 rounded-md border border-line bg-bg px-3 py-2">
            <div>
              <div className="text-sm font-medium">{e.name}</div>
              <div className="num text-xs text-faint">
                {e.section} · {e.id}
              </div>
            </div>
            <div className="flex gap-2">
              {e.pick && (
                <Button size="sm" variant={JSON.stringify(sel) === JSON.stringify(e.pick) ? 'primary' : 'secondary'} onClick={() => choose(e.pick!)}>
                  {S.equipment.select.replace('…', '')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => set({ userEquipment: removeUserEntry(user, e.section as never, e.id) })}>
                {S.equipment.deleteEntry}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ImportEquipment({ official, onDone }: { official: EquipmentFile | null; onDone: () => void }) {
  const set = useStore((s) => s.set);
  const user = useStore((s) => s.userEquipment);
  const [issues, setIssues] = useState<string[] | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <Card title={S.equipment.tabImport}>
      <p className="mb-3 text-sm text-muted">{S.equipment.importHint}</p>
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
      <Button variant="primary" onClick={() => ref.current?.click()}>
        {S.equipment.importButton}
      </Button>
      {issues && (
        <div className="mt-3 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm">
          <p className="mb-1 font-medium text-bad">{S.equipment.importInvalid}</p>
          <ul className="list-disc pl-5 text-xs text-fg">
            {issues.slice(0, 20).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ManualEntry({ onDone }: { onDone: () => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const set = useStore((s) => s.set);
  const user = useStore((s) => s.userEquipment);
  const file = draftToFile({ ...draft, catalog: false });
  const res = validateEquipment(file);
  return (
    <Card
      title={S.equipment.tabManual}
      actions={
        <Segmented
          size="sm"
          value={draft.kind}
          onChange={(k) => setDraft({ ...draft, kind: k })}
          options={[
            { value: 'modular', label: S.builder.modularTpl.split(' (')[0] },
            { value: 'smart', label: S.builder.smartTpl.split(' (')[0] },
          ]}
        />
      }
    >
      <EquipmentForm draft={{ ...draft, catalog: false }} onChange={setDraft} showCatalogOptions={false} />
      {!res.valid && (
        <ul className="mt-3 list-disc pl-5 text-xs text-warn">
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
        className="mt-4"
        variant="primary"
        disabled={!res.valid}
        onClick={() => {
          const merged = addUserEntries(user, file);
          const preset = file.presets?.[0]?.id;
          const smart = file.all_in_one?.[0]?.id;
          set({
            userEquipment: merged,
            selection: preset ? { kind: 'preset', presetId: preset } : smart ? { kind: 'all_in_one', allInOneId: smart } : { kind: 'none' },
          });
          onDone();
        }}
      >
        {S.equipment.addToMine}
      </Button>
    </Card>
  );
}

function SummaryCard() {
  const eq = useResolvedEquipment();
  const mode = useStore((s) => s.mode);
  if (!eq)
    return (
      <Card title={S.equipment.derived}>
        <p className="text-sm text-muted">{S.equipment.noSelection}</p>
      </Card>
    );
  const src = eq.allInOne ?? eq.telescope;
  return (
    <Card title={eq.name}>
      <div className="grid grid-cols-2 gap-3">
        <Stat label={S.equipment.aperture} value={eq.apertureMm ? `${eq.apertureMm} mm` : '—'} />
        <Stat label={S.equipment.fRatio} value={eq.derived ? `f/${eq.derived.fRatio.toFixed(1)}` : '—'} />
        <Stat label={S.equipment.plateScale} value={eq.derived ? `${eq.derived.plateScale.toFixed(2)}″/px` : '—'} />
        <Stat label={S.equipment.fov} value={eq.derived ? formatFov(eq.derived) : '—'} />
      </div>
      {eq.vendorApp && <p className="mt-3 rounded-md border border-warn/40 bg-warn/5 p-2 text-xs text-warn">{S.equipment.vendorApp}</p>}
      {mode === 'photometry' && (eq.vendorApp || eq.color === 'osc') && eq.mountType === 'altaz' && <p className="mt-2 text-xs text-warn">{S.equipment.oscWarn}</p>}
      {src?.sources && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer">
            {S.equipment.sources} · {S.equipment.confidence}: {src.confidence}
          </summary>
          <ul className="mt-1 list-disc pl-5">
            {src.sources.map((u) => (
              <li key={u} className="break-all">
                <a className="text-accent-2 hover:underline" href={u} target="_blank" rel="noreferrer noopener">
                  {u}
                </a>
              </li>
            ))}
          </ul>
          {src.notes && <p className="mt-2">{src.notes}</p>}
        </details>
      )}
    </Card>
  );
}

function MountCard() {
  const mount = useStore((s) => s.mount);
  const set = useStore((s) => s.set);
  const up = (p: Partial<typeof mount>) => set({ mount: { ...mount, ...p } });
  return (
    <Card title={S.equipment.mountSettings}>
      <div className="grid gap-3">
        <Field label={S.equipment.mountType}>
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
        <div className="grid grid-cols-3 gap-2">
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
      </div>
    </Card>
  );
}

function ExposureCard() {
  const table = useStore((s) => s.exposureTable);
  const set = useStore((s) => s.set);
  const update = (i: number, p: Partial<(typeof table)[number]>) => set({ exposureTable: table.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  return (
    <Card
      title={S.equipment.exposure}
      actions={
        <Button size="sm" variant="ghost" onClick={() => set({ exposureTable: DEFAULT_EXPOSURE_TABLE })}>
          {S.equipment.resetTable}
        </Button>
      }
    >
      <p className="mb-2 text-xs text-muted">{S.equipment.exposureHint}</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-faint">
            <th className="pb-1 font-normal">{S.equipment.maxMag}</th>
            <th className="pb-1 font-normal">{S.equipment.seconds}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {table.map((r, i) => (
            <tr key={i}>
              <td className="pr-2 pb-1">
                <NumInput value={r.maxMag} onChange={(v) => update(i, { maxMag: v ?? 0 })} step={0.5} />
              </td>
              <td className="pr-2 pb-1">
                <NumInput value={r.exposureS} onChange={(v) => update(i, { exposureS: Math.max(0.1, v ?? 1) })} step={1} unit="s" />
              </td>
              <td className="pb-1">
                <Button size="sm" variant="ghost" aria-label="remove" onClick={() => set({ exposureTable: table.filter((_, j) => j !== i) })}>
                  ×
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button size="sm" className="mt-2" onClick={() => set({ exposureTable: [...table, { maxMag: 99, exposureS: 120 }] })}>
        + {S.equipment.addRow}
      </Button>
    </Card>
  );
}

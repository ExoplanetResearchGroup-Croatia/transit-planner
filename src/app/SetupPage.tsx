import { useStore } from '../state/store';
import { S } from '../strings';
import { Button, CodeStrip } from '../components/ui';
import { siteValid, tonightAt, useResolvedEquipment, useSite, useTimeFmt } from './hooks';
import { formatFov } from '../lib/equipment/derive';
import { EKOS_FORMATS } from '../lib/export/ekos';
import { Footer } from './PlanPage';

/** Setup: an index sheet of what the planner assumed, each line opening its modal. */
export function SetupPage() {
  const s = useStore();
  const site = useSite();
  const eq = useResolvedEquipment();
  const tf = useTimeFmt();
  const f = s.filters[s.mode];
  const first = s.firstNight ?? (siteValid(site) ? tonightAt(site.tz) : null);

  const rows: { id: 'location' | 'equipment' | 'nights' | 'filters' | 'export'; label: string; value: string; detail: string }[] = [
    {
      id: 'location',
      label: S.strip.location,
      value: siteValid(site) ? site.name : S.strip.noLocation,
      detail: siteValid(site)
        ? `${Math.abs(site.lat).toFixed(4)}° ${site.lat >= 0 ? 'N' : 'S'} · ${Math.abs(site.lon).toFixed(4)}° ${site.lon >= 0 ? 'E' : 'W'} · ${site.elevation} m · ${site.tz} (${tf.zone()}) · horizon ${S.location.horizonPoints(site.horizon.length)}`
        : S.plan.needLocationText,
    },
    {
      id: 'equipment',
      label: S.strip.equipment,
      value: eq?.name ?? S.strip.noEquipment,
      detail: [
        eq?.apertureMm ? `${eq.apertureMm} mm` : null,
        eq?.derived ? `f/${eq.derived.fRatio.toFixed(1)}` : null,
        eq?.derived ? `${eq.derived.plateScale.toFixed(2)}″/px` : null,
        eq?.derived ? formatFov(eq.derived) : null,
        S.equipment[s.mount.type],
        `${S.equipment.overhead.toLowerCase()} ${s.mount.overheadMin} min`,
      ]
        .filter(Boolean)
        .join(' · '),
    },
    {
      id: 'nights',
      label: S.strip.nights,
      value: `${s.firstNight === null ? S.nights.tonight : first} · ${s.nights} ${s.nights === 1 ? 'night' : 'nights'}`,
      detail: s.darkness === 'astronomical' ? S.nights.astronomical : s.darkness === 'nautical' ? S.nights.nautical : S.nights.civil,
    },
    {
      id: 'filters',
      label: `${S.strip.mode} · ${S.strip.filters}`,
      value: s.mode === 'photometry' ? S.strip.photometry : S.strip.showcase,
      detail: `${S.filters.summary(f.magMax, f.depthMinPpt, f.minAlt)} · ${f.coverage} coverage · flip ${f.flipPolicy}`,
    },
    {
      id: 'export',
      label: S.export.button,
      value: `Ekos ${s.exportSettings.ekosFormat === '2.2' ? '3.8' : '3.7'} · NINA ${s.exportSettings.ninaUseCustom && s.exportSettings.ninaTemplateName ? s.exportSettings.ninaTemplateName : 'built-in'}`,
      detail: `Times in ${s.exportSettings.clockTz ?? site?.tz ?? 'UTC'} · ${EKOS_FORMATS[s.exportSettings.ekosFormat]}`,
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] px-5 pt-8 pb-10 lg:px-10">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-4">
          <CodeStrip />
          <h1 className="display text-[64px] text-fg">{S.setup.title}</h1>
          <p className="max-w-[60ch] text-sm text-muted">{S.setup.intro}</p>
        </div>
        <Button variant="primary" onClick={() => s.set({ route: 'plan' })}>
          {S.setup.viewPlan}
        </Button>
      </header>
      <div className="border-t border-line">
        {rows.map((r) => (
          <div key={r.id} className="grid grid-cols-1 items-center gap-x-8 gap-y-2 border-b border-line py-5 sm:grid-cols-[180px_1fr_auto]">
            <span className="caps text-muted">{r.label}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-lg text-fg">{r.value}</span>
              <span className="text-xs leading-relaxed text-muted">{r.detail}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => s.set({ modal: r.id })}>
              {S.strip.edit}
            </Button>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  );
}

import { useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useStore, type ShareState } from '../state/store';
import { S, STEP_IDS, type StepId } from '../strings';
import { Button, Segmented, cx } from '../components/ui';
import { loadCatalog, useResolvedEquipment, useSite } from './hooks';
import { decodeShare } from '../lib/export/share';
import { LocationStep, siteValid } from './steps/LocationStep';
import { EquipmentStep } from './steps/EquipmentStep';
import { TimeStep } from './steps/TimeStep';
import { FiltersStep } from './steps/FiltersStep';
import { ResultsStep } from './steps/ResultsStep';
import { ScheduleStep } from './steps/ScheduleStep';
import { ExportStep } from './steps/ExportStep';

const REPO_URL = 'https://github.com/ExoplanetResearchGroup-Croatia/transit-planner';

function applyShareLink() {
  const payload = decodeShare<ShareState>(location.hash);
  if (!payload) return;
  const st = payload.state;
  const s = useStore.getState();
  const patch: Partial<typeof s> = {
    mode: st.mode,
    selection: st.selection,
    mount: st.mount,
    firstNight: st.firstNight,
    nights: st.nights,
    darkness: st.darkness,
    exposureTable: st.exposureTable,
    filters: { ...s.filters, [st.mode]: st.filters },
    pendingShareSelection: payload.selected,
    step: 'results',
  };
  s.set(patch);
  if (st.site) {
    const existing = s.sites.find((x) => x.lat === st.site!.lat && x.lon === st.site!.lon);
    if (existing) s.set({ activeSiteId: existing.id });
    else s.upsertSite({ ...st.site, id: `shared-${Date.now().toString(36)}`, name: `${st.site.name} (shared)` });
  }
  history.replaceState(null, '', location.pathname);
}

export function App() {
  const step = useStore((s) => s.step);
  const set = useStore((s) => s.set);
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);
  const timeDisplay = useStore((s) => s.timeDisplay);
  const catalog = useStore((s) => s.catalog);
  const site = useSite();
  const eq = useResolvedEquipment();
  const result = useStore((s) => s.result);
  const selected = useStore((s) => s.selected);

  useEffect(() => {
    applyShareLink();
    void loadCatalog();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#000000' : '#0a0d13');
  }, [theme]);

  const done: Record<StepId, boolean> = {
    location: siteValid(site),
    equipment: !!eq,
    time: true,
    filters: true,
    results: !!result,
    schedule: selected.length > 0,
    export: false,
  };
  const idx = STEP_IDS.indexOf(step);
  const go = (i: number) => set({ step: STEP_IDS[Math.max(0, Math.min(STEP_IDS.length - 1, i))] as StepId });
  const blocked = (id: StepId) => !done.location && ['results', 'schedule', 'export'].includes(id);

  return (
    <Tooltip.Provider>
      <div className="flex min-h-screen flex-col">
        <header className="no-print sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-2.5">
            <a href="./" className="flex items-center gap-2" aria-label={S.app.name}>
              <img src="./favicon.svg" alt="" className="h-7 w-7" />
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">{S.app.name}</div>
                <div className="hidden text-[11px] text-muted sm:block">{S.app.tagline}</div>
              </div>
            </a>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Segmented
                size="sm"
                label={S.header.mode}
                value={mode}
                onChange={(m) => set({ mode: m })}
                options={[
                  { value: 'photometry', label: S.header.photometry, title: S.header.photometryHint },
                  { value: 'showcase', label: S.header.showcase, title: S.header.showcaseHint },
                ]}
              />
              <Segmented
                size="sm"
                label={S.header.time}
                value={timeDisplay}
                onChange={(t) => set({ timeDisplay: t })}
                options={[
                  { value: 'local', label: S.header.local },
                  { value: 'utc', label: S.header.utc },
                ]}
              />
              <Segmented
                size="sm"
                label={S.header.theme}
                value={theme}
                onChange={(t) => set({ theme: t })}
                options={[
                  { value: 'dark', label: S.header.dark },
                  { value: 'night', label: '●', title: S.header.night },
                ]}
              />
              <a href="./builder.html" className="text-xs text-muted hover:text-fg">
                {S.app.openBuilder} →
              </a>
            </div>
          </div>
          <nav aria-label="Steps" className="mx-auto max-w-[1400px] px-4 pb-2">
            <ol className="flex flex-col gap-1 sm:flex-row sm:gap-0 sm:overflow-x-auto">
              {S.steps.map((st, i) => (
                <li key={st.id} className="sm:flex-1">
                  <button
                    type="button"
                    disabled={blocked(st.id)}
                    onClick={() => go(i)}
                    aria-current={step === st.id ? 'step' : undefined}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors disabled:opacity-40 sm:border-b-2 sm:rounded-none',
                      step === st.id ? 'bg-panel-2 text-fg sm:border-accent sm:bg-transparent' : 'text-muted hover:text-fg sm:border-transparent',
                    )}
                  >
                    <span
                      className={cx(
                        'num flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]',
                        done[st.id] ? 'bg-ok/20 text-ok' : step === st.id ? 'bg-accent text-accent-fg' : 'bg-panel-2 text-faint ring-1 ring-line',
                      )}
                    >
                      {done[st.id] ? '✓' : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{st.label}</span>
                      <span className="hidden truncate text-[11px] text-faint lg:block">{st.hint}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5">
          {catalog.status === 'error' && <p className="mb-4 rounded-md border border-bad/40 bg-bad/5 p-3 text-sm text-bad">{S.app.catalogError}</p>}
          {step === 'location' && <LocationStep />}
          {step === 'equipment' && <EquipmentStep />}
          {step === 'time' && <TimeStep />}
          {step === 'filters' && <FiltersStep />}
          {step === 'results' && <ResultsStep />}
          {step === 'schedule' && <ScheduleStep />}
          {step === 'export' && <ExportStep />}
          <div className="no-print mt-6 flex justify-between">
            <Button variant="ghost" disabled={idx === 0} onClick={() => go(idx - 1)}>
              ← {S.nav.back}
            </Button>
            {idx < STEP_IDS.length - 1 && (
              <Button variant="primary" disabled={blocked(STEP_IDS[idx + 1] as StepId)} title={blocked(STEP_IDS[idx + 1] as StepId) ? S.nav.incomplete : undefined} onClick={() => go(idx + 1)}>
                {S.nav.next}: {S.steps[idx + 1].label} →
              </Button>
            )}
          </div>
        </main>

        <footer className="border-t border-line text-xs text-faint">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-4">
            <p className="text-muted">{S.app.accuracy}</p>
            <p>
              {S.app.dataFrom}: {catalog.generated ? catalog.generated.slice(0, 10) : '—'}
              {catalog.status === 'ready' && ` · ${catalog.targets.length} ${S.app.targets}`}
              {catalog.sources.map((src) => ` · ${src.name} (${src.count})`)}
            </p>
            <p>{S.footer.attribution}</p>
            <p>
              {S.footer.privacy} ·{' '}
              <a className="text-accent-2 hover:underline" href={REPO_URL} target="_blank" rel="noreferrer noopener">
                {S.app.repo}
              </a>{' '}
              ·{' '}
              <a className="text-accent-2 hover:underline" href={`${REPO_URL}/tree/main/docs`} target="_blank" rel="noreferrer noopener">
                {S.app.docs}
              </a>
            </p>
          </div>
        </footer>
      </div>
    </Tooltip.Provider>
  );
}

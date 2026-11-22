import { useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AudioWaveform, SlidersHorizontal, Wrench, Moon, Sun } from 'lucide-react';
import { useStore, type ShareState } from '../state/store';
import { S } from '../strings';
import { IconButton, cx } from '../components/ui';
import { useAutoPlanner } from './hooks';
import { decodeShare } from '../lib/export/share';
import { PlanPage } from './PlanPage';
import { SetupPage } from './SetupPage';
import { SetupModals } from './modals';

function applyShareLink() {
  const payload = decodeShare<ShareState>(location.hash);
  if (!payload) return;
  const st = payload.state;
  const s = useStore.getState();
  s.set({
    mode: st.mode,
    selection: st.selection,
    mount: st.mount,
    firstNight: st.firstNight,
    nights: st.nights,
    darkness: st.darkness,
    exposureTable: st.exposureTable,
    filters: { ...s.filters, [st.mode]: st.filters },
    pendingShareSelection: payload.selected,
    route: 'plan',
  });
  if (st.site) {
    const existing = s.sites.find((x) => x.lat === st.site!.lat && x.lon === st.site!.lon);
    if (existing) s.set({ activeSiteId: existing.id });
    else s.upsertSite({ ...st.site, id: `shared-${Date.now().toString(36)}`, name: `${st.site.name} (shared)` });
  }
  history.replaceState(null, '', location.pathname);
}

// before the first render, so the planner starts with the shared settings
applyShareLink();

function Rail() {
  const route = useStore((s) => s.route);
  const theme = useStore((s) => s.theme);
  const result = useStore((s) => s.result);
  const focusId = useStore((s) => s.focusId);
  const set = useStore((s) => s.set);
  const focusNight = result?.events.find((e) => e.id === focusId)?.night;
  return (
    <nav aria-label="Main" className="no-print sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-line bg-bg px-4 py-3 md:h-screen md:w-[76px] md:flex-col md:border-r md:border-b-0 md:px-0 md:py-5">
      <a href="./" aria-label={S.app.name} className="md:mb-6">
        <img src="./favicon.svg" alt="" className="h-9 w-9" />
      </a>
      {route === 'plan' && result && (
        <ol aria-label={S.rail.nights} className="flex flex-1 gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {result.nights.map((n) => {
            const active = n.date === focusNight;
            return (
              <li key={n.date}>
                <a
                  href={`#night-${n.date}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(`night-${n.date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={cx(
                    'display flex h-11 w-11 items-center justify-center border text-[17px] transition-colors duration-150',
                    active ? 'border-red text-red' : 'border-transparent text-fg hover:border-line-strong',
                  )}
                  aria-current={active ? 'true' : undefined}
                  title={n.date}
                >
                  {n.date.slice(8)}
                </a>
              </li>
            );
          })}
        </ol>
      )}
      {route !== 'plan' && <div className="flex-1" />}
      <div className="flex gap-2 md:flex-col">
        <IconButton label={S.rail.plan} active={route === 'plan'} onClick={() => set({ route: 'plan' })}>
          <AudioWaveform size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton label={S.rail.setup} active={route === 'setup'} onClick={() => set({ route: 'setup' })}>
          <SlidersHorizontal size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton label={S.rail.builder} onClick={() => (location.href = './builder.html')}>
          <Wrench size={16} strokeWidth={1.5} />
        </IconButton>
        <IconButton label={theme === 'night' ? S.rail.dayMode : S.rail.nightMode} active={theme === 'night'} onClick={() => set({ theme: theme === 'night' ? 'dark' : 'night' })}>
          {theme === 'night' ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
        </IconButton>
      </div>
    </nav>
  );
}

export function App() {
  const route = useStore((s) => s.route);
  const theme = useStore((s) => s.theme);
  const catalogStatus = useStore((s) => s.catalog.status);
  useAutoPlanner();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'night' ? '#000000' : '#0b0b0a');
  }, [theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <Tooltip.Provider>
      <div className="flex min-h-screen flex-col md:flex-row">
        <Rail />
        <main className="min-w-0 flex-1">
          {catalogStatus === 'error' && <p className="border-b border-red px-6 py-3 text-sm text-red">{S.app.catalogError}</p>}
          {route === 'plan' ? <PlanPage /> : <SetupPage />}
        </main>
      </div>
      <SetupModals />
    </Tooltip.Provider>
  );
}

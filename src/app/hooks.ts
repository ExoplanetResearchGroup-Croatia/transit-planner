import { useEffect, useMemo } from 'react';
import { useStore, type SiteProfile } from '../state/store';
import type { EquipmentFile } from '../lib/equipment/types';
import { mergeLibrary, resolveSelection, type ResolvedEquipment } from '../lib/equipment/library';
import type { PlanRequest, TransitEvent } from '../lib/transits/types';
import { addDays, formatTime, localDateString, zoneAbbreviation, formatDateTime, guessTimeZone, isValidTimeZone } from '../lib/astro/tz';
import { computePlan, provideTargets } from '../workers/client';
import { fetchMeta, loadCatalogFile } from '../lib/catalog/load';
import { planSelection } from '../lib/schedule/schedule';
import { S } from '../strings';

let officialPromise: Promise<EquipmentFile> | null = null;
export function loadOfficialEquipment(): Promise<EquipmentFile> {
  officialPromise ??= fetch(`${import.meta.env.BASE_URL}data/equipment.json`).then((r) => {
    if (!r.ok) throw new Error(`equipment.json: HTTP ${r.status}`);
    return r.json();
  });
  return officialPromise;
}

/** Official catalog, loaded once into the store (so every component sees the same value immediately). */
export function useOfficialEquipment(): EquipmentFile | null {
  const official = useStore((s) => s.official);
  useEffect(() => {
    if (official) return;
    loadOfficialEquipment()
      .then((eq) => useStore.getState().set({ official: eq }))
      .catch(() => useStore.getState().set({ official: { schemaVersion: 1 } }));
  }, [official]);
  return official;
}

export function useLibrary(): EquipmentFile {
  const official = useOfficialEquipment();
  const user = useStore((s) => s.userEquipment);
  return useMemo(() => mergeLibrary(official ?? { schemaVersion: 1 }, user), [official, user]);
}

export function useResolvedEquipment(): ResolvedEquipment | null {
  const lib = useLibrary();
  const sel = useStore((s) => s.selection);
  return useMemo(() => resolveSelection(lib, sel), [lib, sel]);
}

export const siteValid = (s: SiteProfile | null | undefined): s is SiteProfile =>
  !!s && Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && isValidTimeZone(s.tz);

export function useSite(): SiteProfile | null {
  const sites = useStore((s) => s.sites);
  const id = useStore((s) => s.activeSiteId);
  return sites.find((x) => x.id === id) ?? null;
}

/** Local date of "tonight" at the site: before local noon it is still the previous night. */
export function tonightAt(tz: string, now = Date.now()): string {
  const local = localDateString(now, tz);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date(now)));
  return hour < 12 ? addDays(local, -1) : local;
}

export function useTimeFmt() {
  const site = useSite();
  const display = useStore((s) => s.timeDisplay);
  const tz = display === 'utc' || !site ? 'UTC' : site.tz;
  return useMemo(
    () => ({
      tz,
      t: (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : formatTime(ms, tz)),
      dt: (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : formatDateTime(ms, tz)),
      zone: (ms = Date.now()) => (tz === 'UTC' ? 'UTC' : zoneAbbreviation(ms, tz)),
    }),
    [tz],
  );
}

export function usePlanRequest(): PlanRequest | null {
  const site = useSite();
  const eq = useResolvedEquipment();
  const official = useOfficialEquipment();
  const s = useStore();
  return useMemo(() => {
    // wait for the equipment catalog, otherwise the aperture would change after the first run
    if (!siteValid(site) || !official) return null;
    return {
      mode: s.mode,
      site: { name: site.name, lat: site.lat, lon: site.lon, elevation: site.elevation, tz: site.tz, horizon: site.horizon },
      firstNight: s.firstNight ?? tonightAt(site.tz),
      nights: Math.min(14, Math.max(1, s.nights)),
      darkness: s.darkness,
      mount: s.mount,
      apertureMm: eq?.apertureMm ?? null,
      sensorColor: eq?.color ?? null,
      vendorApp: eq?.vendorApp ?? false,
      filters: s.filters[s.mode],
      stepMin: 5,
    };
  }, [site, eq, official, s.mode, s.firstNight, s.nights, s.darkness, s.mount, s.filters]);
}

export const requestKey = (r: PlanRequest | null) => (r ? JSON.stringify(r) : null);

export const gapMinutes = () => {
  const m = useStore.getState().mount;
  return m.overheadMin + m.autofocusMin;
};

/** Recompute the selection from the latest result, the user's picks and removals. */
export function applySelection() {
  const st = useStore.getState();
  if (!st.result) return;
  const events = st.result.events;
  const selected = planSelection(events, gapMinutes(), st.picks, st.drops);
  const focus = st.focusId && events.some((e) => e.id === st.focusId) ? st.focusId : earliest(events.filter((e) => selected.includes(e.id)))?.id ?? null;
  st.set({ selected, focusId: focus });
}

const earliest = (list: TransitEvent[]) => [...list].sort((a, b) => a.obsStartMs - b.obsStartMs)[0];

/** Schedule or unschedule one transit; overlapping transits give way automatically. */
export function toggleScheduled(id: string) {
  const st = useStore.getState();
  if (st.selected.includes(id)) st.set({ picks: st.picks.filter((p) => p !== id), drops: [...st.drops.filter((d) => d !== id), id] });
  else st.set({ picks: [...st.picks.filter((p) => p !== id), id], drops: st.drops.filter((d) => d !== id) });
  applySelection();
}

export function resetPlan() {
  useStore.getState().set({ picks: [], drops: [] });
  applySelection();
}

let latestRun = 0;

/** Load catalog (and TOI if enabled), send targets to the worker, compute, select. Older runs never overwrite newer ones. */
export async function runCompute(req: PlanRequest) {
  const myRun = ++latestRun;
  const st = useStore.getState();
  st.set({ computing: true, progress: 0 });
  try {
    const keys = ['catalog'];
    provideTargets('catalog', st.catalog.targets);
    if (req.filters.sources.toi) {
      let toi = useStore.getState().toi;
      if (toi.status !== 'ready') {
        useStore.getState().set({ toi: { status: 'loading', targets: [] } });
        const meta = await fetchMeta();
        const { targets } = await loadCatalogFile('toi', meta.toi.generated);
        toi = { status: 'ready', targets };
        useStore.getState().set({ toi });
      }
      provideTargets('toi', toi.targets);
      keys.push('toi');
    }
    const result = await computePlan(req, keys, (f) => myRun === latestRun && useStore.getState().set({ progress: f }));
    if (myRun !== latestRun) return;
    const cur = useStore.getState();
    const patch: Partial<typeof cur> = { result, resultKey: requestKey(req), computing: false, progress: 1 };
    if (cur.pendingShareSelection) {
      patch.picks = cur.pendingShareSelection;
      patch.drops = [];
      patch.pendingShareSelection = null;
    }
    cur.set(patch);
    applySelection();
  } catch (e) {
    console.error(e);
    if (myRun === latestRun) useStore.getState().set({ computing: false });
    throw e;
  }
}

export async function loadCatalog() {
  const st = useStore.getState();
  if (st.catalog.status === 'loading' || st.catalog.status === 'ready') return;
  st.set({ catalog: { ...st.catalog, status: 'loading' } });
  try {
    const meta = await fetchMeta();
    const { targets, file } = await loadCatalogFile('catalog', meta.catalog.generated);
    useStore.getState().set({ catalog: { status: 'ready', targets, generated: file.generated, sources: meta.sources } });
  } catch (e) {
    console.error(e);
    useStore.getState().set({ catalog: { status: 'error', targets: [], generated: null, sources: [] } });
  }
}

/** Ask the browser for the position and store it as the active site. */
export function locate(): Promise<boolean> {
  return new Promise((resolve) => {
    const st = useStore.getState();
    if (!navigator.geolocation) {
      st.set({ geo: 'failed' });
      return resolve(false);
    }
    st.set({ geo: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = Number(p.coords.latitude.toFixed(4));
        const lon = Number(p.coords.longitude.toFixed(4));
        const cur = useStore.getState();
        const active = cur.sites.find((x) => x.id === cur.activeSiteId);
        cur.upsertSite({
          id: active?.id ?? `site-${Date.now().toString(36)}`,
          name: active?.name ?? S.location.myLocation,
          lat,
          lon,
          elevation: Math.round(p.coords.altitude ?? active?.elevation ?? 0),
          tz: guessTimeZone(lat, lon),
          horizon: active?.horizon ?? [],
        });
        useStore.getState().set({ geo: 'idle' });
        resolve(true);
      },
      () => {
        useStore.getState().set({ geo: 'failed' });
        resolve(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600_000 },
    );
  });
}

/**
 * The automatic planner: loads the catalog, finds the location on first use,
 * and recomputes (debounced) whenever any input changes.
 */
export function useAutoPlanner() {
  const req = usePlanRequest();
  const key = requestKey(req);
  const catalogStatus = useStore((s) => s.catalog.status);
  const site = useSite();

  useEffect(() => {
    void loadCatalog();
    if (!siteValid(useStore.getState().sites.find((x) => x.id === useStore.getState().activeSiteId))) {
      void locate().then((ok) => {
        if (!ok) useStore.getState().set({ route: 'setup', modal: 'location' });
      });
    }
  }, []);

  useEffect(() => {
    if (!req || catalogStatus !== 'ready') return;
    const t = setTimeout(() => {
      runCompute(req).catch(() => undefined);
    }, 220);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, catalogStatus]);

  return { req, site };
}

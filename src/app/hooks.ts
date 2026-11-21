import { useEffect, useMemo } from 'react';
import { useStore, type SiteProfile } from '../state/store';
import type { EquipmentFile } from '../lib/equipment/types';
import { mergeLibrary, resolveSelection, type ResolvedEquipment } from '../lib/equipment/library';
import type { PlanRequest } from '../lib/transits/types';
import { addDays, formatTime, localDateString, zoneAbbreviation, formatDateTime } from '../lib/astro/tz';
import { computePlan, provideTargets } from '../workers/client';
import { fetchMeta, loadCatalogFile } from '../lib/catalog/load';

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
    if (!site || !official) return null;
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

/** Load catalog (and TOI if enabled), send targets to the worker, compute. */
export async function runCompute(req: PlanRequest) {
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
    const result = await computePlan(req, keys, (f) => useStore.getState().set({ progress: f }));
    const cur = useStore.getState();
    const ids = new Set(result.events.map((e) => e.id));
    const keep = (cur.pendingShareSelection ?? cur.selected).filter((id) => ids.has(id));
    cur.set({ result, resultKey: requestKey(req), computing: false, progress: 1, selected: keep, pendingShareSelection: null });
  } catch (e) {
    console.error(e);
    useStore.getState().set({ computing: false });
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

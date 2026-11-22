/**
 * App state. Settings persist in localStorage (key "transit-planner:v1");
 * runtime data (catalog, results) does not. No server-side storage.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Filters, Mode, MountSettings, PlanResult, Site } from '../lib/transits/types';
import type { DarknessDefinition } from '../lib/astro/darkness';
import type { EquipmentFile } from '../lib/equipment/types';
import type { EquipmentSelection } from '../lib/equipment/library';
import { EMPTY_USER_FILE } from '../lib/equipment/library';
import type { ExposureRow } from '../lib/equipment/exposure';
import { DEFAULT_EXPOSURE_TABLE } from '../lib/equipment/exposure';
import type { EkosFormat } from '../lib/export/ekos';
import { DEFAULT_FILTERS, DEFAULT_MOUNT } from './defaults';
import type { Target, CatalogSourceInfo } from '../lib/catalog/types';

export interface SiteProfile extends Site {
  id: string;
}

export interface ExportSettings {
  clockTz: string | null; // null = site zone
  ekosFormat: EkosFormat;
  ekosSequencePath: string;
  ekosProfile: string;
  esqFilter: string;
  esqFitsDir: string;
  esqTemperature: number | null;
  ninaUseCustom: boolean;
  ninaTemplateName: string | null;
  ninaTemplate: string | null;
  ninaSetExposure: boolean;
}

export interface Settings {
  theme: 'dark' | 'night';
  timeDisplay: 'local' | 'utc';
  mode: Mode;
  sites: SiteProfile[];
  activeSiteId: string | null;
  userEquipment: EquipmentFile;
  selection: EquipmentSelection;
  mount: MountSettings;
  /** null = tonight */
  firstNight: string | null;
  nights: number;
  darkness: DarknessDefinition;
  filters: Record<Mode, Filters>;
  exposureTable: ExposureRow[];
  exportSettings: ExportSettings;
}

export type Route = 'plan' | 'setup';
export type ModalId = 'location' | 'equipment' | 'nights' | 'filters' | 'export' | null;

export interface Runtime {
  route: Route;
  modal: ModalId;
  /** manual schedule changes; the rest of the plan is chosen automatically */
  picks: string[];
  drops: string[];
  focusId: string | null;
  geo: 'idle' | 'locating' | 'failed';
  catalog: { status: 'idle' | 'loading' | 'ready' | 'error'; targets: Target[]; generated: string | null; sources: CatalogSourceInfo[] };
  toi: { status: 'idle' | 'loading' | 'ready' | 'error'; targets: Target[] };
  result: PlanResult | null;
  resultKey: string | null;
  computing: boolean;
  progress: number;
  selected: string[];
  pendingShareSelection: string[] | null;
  /** official equipment catalog (public/data/equipment.json), loaded at start */
  official: EquipmentFile | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  timeDisplay: 'local',
  mode: 'photometry',
  sites: [],
  activeSiteId: null,
  userEquipment: EMPTY_USER_FILE,
  selection: { kind: 'none' },
  mount: DEFAULT_MOUNT,
  firstNight: null,
  nights: 3,
  darkness: 'astronomical',
  filters: DEFAULT_FILTERS,
  exposureTable: DEFAULT_EXPOSURE_TABLE,
  exportSettings: {
    clockTz: null,
    ekosFormat: '2.2',
    ekosSequencePath: '/home/user/transits/transit.esq',
    ekosProfile: 'Default',
    esqFilter: '',
    esqFitsDir: '/home/user/transits',
    esqTemperature: null,
    ninaUseCustom: false,
    ninaTemplateName: null,
    ninaTemplate: null,
    ninaSetExposure: true,
  },
};

type Store = Settings &
  Runtime & {
    set: (patch: Partial<Settings & Runtime>) => void;
    setFilters: (patch: Partial<Filters>) => void;
    activeSite: () => SiteProfile | null;
    upsertSite: (s: SiteProfile) => void;
    deleteSite: (id: string) => void;
  };

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      route: 'plan',
      modal: null,
      picks: [],
      drops: [],
      focusId: null,
      geo: 'idle',
      catalog: { status: 'idle', targets: [], generated: null, sources: [] },
      toi: { status: 'idle', targets: [] },
      result: null,
      resultKey: null,
      computing: false,
      progress: 0,
      selected: [],
      pendingShareSelection: null,
      official: null,
      set: (patch) => set(patch),
      setFilters: (patch) => set((s) => ({ filters: { ...s.filters, [s.mode]: { ...s.filters[s.mode], ...patch } } })),
      activeSite: () => get().sites.find((x) => x.id === get().activeSiteId) ?? null,
      upsertSite: (site) =>
        set((s) => ({ sites: s.sites.some((x) => x.id === site.id) ? s.sites.map((x) => (x.id === site.id ? site : x)) : [...s.sites, site], activeSiteId: site.id })),
      deleteSite: (id) =>
        set((s) => {
          const sites = s.sites.filter((x) => x.id !== id);
          return { sites, activeSiteId: s.activeSiteId === id ? (sites[0]?.id ?? null) : s.activeSiteId };
        }),
    }),
    {
      name: 'transit-planner:v1',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): Settings => ({
        theme: s.theme,
        timeDisplay: s.timeDisplay,
        mode: s.mode,
        sites: s.sites,
        activeSiteId: s.activeSiteId,
        userEquipment: s.userEquipment,
        selection: s.selection,
        mount: s.mount,
        firstNight: s.firstNight,
        nights: s.nights,
        darkness: s.darkness,
        filters: s.filters,
        exposureTable: s.exposureTable,
        exportSettings: s.exportSettings,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return {
          ...current,
          ...p,
          filters: {
            photometry: { ...DEFAULT_FILTERS.photometry, ...p.filters?.photometry },
            showcase: { ...DEFAULT_FILTERS.showcase, ...p.filters?.showcase },
          },
          exportSettings: { ...DEFAULT_SETTINGS.exportSettings, ...p.exportSettings },
          mount: { ...DEFAULT_MOUNT, ...p.mount },
        };
      },
    },
  ),
);

/** The part of the settings that goes into a share link. */
export type ShareState = Pick<Settings, 'mode' | 'selection' | 'mount' | 'firstNight' | 'nights' | 'darkness' | 'exposureTable'> & {
  site: SiteProfile | null;
  filters: Filters;
};

export function shareStateOf(s: Settings): ShareState {
  return {
    mode: s.mode,
    selection: s.selection,
    mount: s.mount,
    firstNight: s.firstNight,
    nights: s.nights,
    darkness: s.darkness,
    exposureTable: s.exposureTable,
    site: s.sites.find((x) => x.id === s.activeSiteId) ?? null,
    filters: s.filters[s.mode],
  };
}

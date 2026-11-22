/** Types mirroring public/data/equipment.schema.json (schema version 1). */

export type Confidence = 'high' | 'medium' | 'low';
export type MountType = 'gem' | 'fork_eq' | 'altaz' | 'other';
export type SensorColor = 'mono' | 'osc';

interface CatalogFields {
  id: string;
  name: string;
  manufacturer?: string;
  notes?: string;
  confidence?: Confidence;
  needs_verification?: string[];
  sources?: string[];
}

export interface Telescope extends CatalogFields {
  design?: string;
  aperture_mm: number;
  focal_length_mm: number;
}

export interface CameraMode {
  id: string;
  label?: string;
  sensor_px: [number, number];
  pixel_um: number;
  pixel_um_inferred?: boolean;
  bit_depth?: number;
  full_well_e?: number;
}

export interface Camera extends CatalogFields {
  sensor_model?: string;
  color: SensorColor;
  cooled?: boolean;
  default_mode?: string;
  modes: CameraMode[];
  read_noise_e_min?: number;
  qe_peak_pct?: number;
}

export interface PlanningDefaults {
  meridian_flip_after_min?: number;
  slew_and_center_overhead_min?: number;
  note?: string;
}

export interface Mount extends CatalogFields {
  type: MountType;
  goto?: boolean;
  payload_kg?: number;
  payload_note?: string;
  planning_defaults?: PlanningDefaults;
}

export interface Filter {
  id: string;
  name: string;
  system?: string;
  notes?: string;
}

export interface AllInOne extends CatalogFields {
  optics: { aperture_mm: number; focal_length_mm: number; design?: string };
  sensor: {
    model?: string;
    format?: string;
    color: SensorColor;
    sensor_px: [number, number];
    orientation?: 'portrait' | 'landscape';
    pixel_um: number;
    pixel_um_inferred?: boolean;
  };
  mount: { type: MountType; meridian_flip?: boolean; note?: string };
  fov_deg_published?: { width?: number; height?: number; diagonal?: number };
  exposure_options_s?: number[];
  builtin_filters?: string[];
  control: 'vendor_app' | 'ascom_indi';
}

export interface Preset {
  id: string;
  name: string;
  telescope: string;
  camera: string;
  camera_mode?: string;
  mount?: string;
  filters?: string[];
  notes?: string;
}

export interface EquipmentFile {
  $schema?: string;
  schemaVersion: 1;
  dataRetrieved?: string;
  telescopes?: Telescope[];
  cameras?: Camera[];
  mounts?: Mount[];
  filters?: Filter[];
  all_in_one?: AllInOne[];
  presets?: Preset[];
}

export const EQUIPMENT_SECTIONS = ['telescopes', 'cameras', 'mounts', 'filters', 'all_in_one', 'presets'] as const;
export type EquipmentSection = (typeof EQUIPMENT_SECTIONS)[number];

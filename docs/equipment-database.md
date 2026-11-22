# Equipment database

The planner and the Equipment Builder use one equipment format.

| File | Role |
|---|---|
| `public/data/equipment.json` | Official catalog, maintained in this repository |
| `public/data/equipment.schema.json` | JSON Schema (draft 2020-12), **schema version 1** |
| "My equipment" | Your own entries, stored in the browser (`localStorage`) and exportable as JSON |

> The handoff delivered `equipment.json` without its schema file. `equipment.schema.json` was **reconstructed from the data** (2026-11-21) and is now the reference. Check it against the original if that file turns up (phase 0 task "confirm equipment schema").

## Validation

There is one validation path for all three uses:

1. `scripts/gen-validator.ts` compiles the schema into a standalone validator (`src/lib/equipment/validator.generated.js`, generated at build/test time). It is precompiled because the strict CSP forbids `eval`.
2. `src/lib/equipment/validate.ts` adds the checks a schema cannot express:
   - **errors:** duplicate ids in a section, unknown `default_mode`, preset references to missing telescopes/cameras/modes/mounts/filters;
   - **warnings:** pixel size > 20 µm or < 1 µm, focal ratio outside f/1.5–f/30, a computed FOV that differs from the published one by more than 10 %, inferred pixel sizes, `needs_verification` entries.
3. The same functions run in `npm run build` (an invalid entry **fails the build** and CI), in the Equipment Builder and in the planner's import dialog. Messages are in plain language, for example `Camera “ZWO ASI294MM Pro” › modes[1] › pixel_um: must be greater than 0.`

## Structure (schema version 1)

```jsonc
{
  "schemaVersion": 1,
  "dataRetrieved": "2026-11-21",
  "telescopes": [{ "id", "name", "aperture_mm", "focal_length_mm", "design?", "manufacturer?", ... }],
  "cameras":    [{ "id", "name", "color": "mono|osc", "modes": [{ "id", "sensor_px": [w, h], "pixel_um", ... }], "default_mode?", ... }],
  "mounts":     [{ "id", "name", "type": "gem|fork_eq|altaz|other", "planning_defaults?": { "meridian_flip_after_min", "slew_and_center_overhead_min", "note" } }],
  "filters":    [{ "id", "name", "system?" }],
  "all_in_one": [{ "id", "name", "optics": {...}, "sensor": {...}, "mount": {...}, "fov_deg_published?": {...}, "exposure_options_s?": [...], "control": "vendor_app|ascom_indi" }],
  "presets":    [{ "id", "name", "telescope", "camera", "camera_mode?", "mount?", "filters?": [...] }]
}
```

**Rules:**

- **Ids** use lower-case letters, digits, `.`, `_` and `-`. Your own entries start with `user:`, which avoids collisions with the catalog. Imported files get the prefix automatically.
- **Catalog entries** (ids without `user:`) need `sources` (≥ 1 URL) and `confidence` (`high` / `medium` / `low`). Filters are generic and need neither.
- `sensor_px` is `[width, height]` as the sensor is mounted. Smart telescopes also give `orientation`.
- **Field of view is always computed** from pixels × pixel scale / focal length. The published FOV (`fov_deg_published`) is only a cross-check; several manufacturers publish the diagonal.
- `planning_defaults` on mounts are planner defaults, not manufacturer specifications.
- Unknown fields are rejected, so typos are caught. Adding a field requires a schema change; bump `schemaVersion` for incompatible changes.

## Derived values

| Value | Formula |
|---|---|
| f-ratio | focal length / aperture |
| Plate scale | 206.265 × pixel (µm) / focal length (mm) ″/px |
| FOV | pixels × plate scale (width, height, diagonal) |

## Current catalog (data retrieved 2026-11-21)

| Type | Entries |
|---|---|
| Telescopes | Celestron EdgeHD 8, EdgeHD 11 |
| Cameras | ZWO ASI294MM Pro (Bin2 and unlocked Bin1 modes) |
| Mounts | Sky-Watcher EQ6-R Pro |
| Filters | Clear, Johnson V, Cousins Rc/Ic, Sloan g′/r′/i′, exoplanet broadband |
| Smart telescopes | ZWO Seestar S50, S50 Pro, S30, S30 Pro |
| Preset | EdgeHD 8 + ASI294MM Pro on EQ6-R Pro |

Known caveats:

- The published FOVs of the S30, S30 Pro and S50 Pro are frame **diagonals**; computed and published values agree within 3 % (tested).
- **S50 Pro:** the sensor model and pixel size are not published. 2.9 µm is inferred from the 2.8° diagonal (`pixel_um_inferred`), and the entry is marked `needs_verification`. One retailer lists a conflicting sensor and a 60 mm focal length. Verify against the manual.
- Some ZWO pages did not load during data collection. Cross-check the camera values.
- Not covered yet: Unistellar eVscope, other ASI cameras (183/533/1600), other mounts (HEQ5, AM5), refractors, and the instruments of the owner's society. Nothing has been invented for them.
- Seestars are one-shot-colour, alt-az and use fixed stacking exposures. In Photometry mode the planner warns that science-grade photometry is limited; Showcase mode is unaffected.

## Contributing an entry

Use the **Equipment Builder** (`builder.html`):

1. Choose the template (modular setup or smart telescope).
2. Fill in the form and watch the derived values for implausible numbers.
3. Tick "catalog contribution", add source URLs and the confidence level.
4. Press **Open a prefilled GitHub issue**, or download the JSON and open a pull request that adds it to `public/data/equipment.json`.

See also [CONTRIBUTING.md](../CONTRIBUTING.md).

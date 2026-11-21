# Data sources

TransitPlanner serves a **static catalog snapshot** from `public/data/`, the same origin as the app.

| File | Contents |
|---|---|
| `catalog.json` | NASA Exoplanet Archive composite parameters merged with ExoClock (≈ 4 700 transiting planets) |
| `toi.json` | TESS TOI candidates (dispositions PC and APC), loaded only when the TOI source is switched on |
| `catalog-meta.json` | Version timestamps and counts. The client fetches it first and reuses the IndexedDB copy when the version matches |

`scripts/build-catalog.ts` (`npm run catalog:build`) builds the snapshot. The GitHub Actions workflow `refresh-catalog.yml` can run it daily; it commits only when the data change. If NASA or ExoClock fail, the existing snapshot stays (it is the fallback), so the app never depends on an upstream service being up.

**Why a snapshot rather than live queries:** on 2026-11-21 neither the NASA TAP service nor ExoClock sent `Access-Control-Allow-Origin` headers, so browsers cannot query them directly. A full ExoClock download takes about 2 minutes, which is too slow per visitor. Public traffic should not hit these services anyway.

## NASA Exoplanet Archive: Planetary Systems Composite Parameters

- **Service:** TAP, `https://exoplanetarchive.ipac.caltech.edu/TAP/sync`, `format=json`.
- **Query:**

  ```sql
  select pl_name, hostname, ra, dec, sy_vmag, sy_gaiamag, sy_tmag,
         pl_tranmid, pl_tranmiderr1, pl_tranmiderr2,
         pl_orbper, pl_orbpererr1, pl_orbpererr2,
         pl_trandur, pl_trandep, pl_ratror, pl_rade, st_rad, pl_tranmid_reflink
  from pscomppars where tran_flag = 1
  ```
- **Units:**

  | Column | Unit / note |
  |---|---|
  | `ra`, `dec` | degrees, J2000 |
  | `pl_tranmid` | days; usually BJD_TDB, but the time standard follows the cited paper (see methodology §1) |
  | `pl_orbper` | days |
  | `pl_trandur` | hours |
  | `pl_trandep` | **percent**, converted ×10 to ppt |
- **Missing depth:** (Rp/Rs)² from `pl_ratror`, or from `pl_rade`/`st_rad`. Such records are flagged "depth estimated".
- **Dropped:** rows without duration or T0. On 2026-11-21, 4 735 of 4 830 transiting rows were usable (89 had no duration, 6 no T0).
- **Note:** composite rows combine values from different papers, so T0 and P may come from different references. ExoClock ephemerides avoid this where available.

## ExoClock

- **Endpoint:** `https://www.exoclock.space/database/planets_json`, a JSON object keyed by planet name; 776 planets on 2026-11-21.
- **Fields used:**

  | Field | Note |
  |---|---|
  | `t0_bjd_tdb`, `t0_unc` | T0 in BJD_TDB (only records with `ephem_mid_time_format = BJD_TDB` are accepted) |
  | `period_days`, `period_unc` | period |
  | `duration_hours` | duration |
  | `depth_r_mmag` | depth, converted 1 − 10^(−0.4·mmag/1000) → ppt |
  | `ra_j2000`, `dec_j2000` | sexagesimal |
  | `v_mag`, `gaia_g_mag` | magnitudes |
  | `priority` | alert / high / medium / low (345 high, 139 medium, 251 low, 41 alert on 2026-11-21) |
  | `current_oc_min` | current O−C |
  | `min_telescope_inches` | recommended aperture, used for the "smaller than the aperture ExoClock recommends" warning |
  | `total_observations_recent` | recent observations |
- **Merge rules:**
  - ExoClock **takes precedence** for the ephemeris, duration and depth.
  - Matching is by normalized name (`55 Cnc e` = `55Cnce`). If that fails, by position (< 10″) plus period (< 0.1 %).
  - NASA supplies the display name, host and TESS magnitude, and fills missing magnitudes.
  - On 2026-11-21: 770 matched by name, 2 by position, 4 ExoClock-only.

## TESS Project Candidates (TOI)

- **Query:** the `toi` table, `tfopwg_disp = 'PC' or 'APC'`.
- **Fields:** `toi`, `tid`, `ra`, `dec`, `st_tmag`, `pl_tranmid` and errors, `pl_orbper` and errors, `pl_trandurh` (hours), `pl_trandep` (**ppm**, converted ÷1000 to ppt).
- Known and confirmed planets (KP/CP) are excluded, because they are already in the NASA table. Candidates whose normalized name exists in the main catalog are dropped.
- Candidates have only a TESS magnitude. The magnitude filter uses V if present, otherwise Gaia G, otherwise TESS T, and the table marks the band.
- Unconfirmed candidates carry a "candidate" warning.

## Attribution and citation

The page footer shows a short form. Please cite the sources when you use results:

**NASA Exoplanet Archive** (acknowledgement text from the archive's acknowledgements page, retrieved 2026-11-21):

> This research has made use of the NASA Exoplanet Archive, which is operated by the California Institute of Technology, under contract with the National Aeronautics and Space Administration under the Exoplanet Exploration Program.

- Archive paper: Christiansen et al. (2025), Planetary Science Journal, which replaces Akeson et al. (2013).
- Planetary Systems Composite Parameters table: DOI **10.26133/NEA13**.
- TESS Project Candidates table DOI: **UNVERIFIED** (not found on the archive's DOI page during the check).

**ExoClock:** cite the ExoClock project papers:
- Kokori et al. 2022, ApJS 258, 40 (ExoClock Project II);
- ExoClock Project III (Kokori et al. 2023, ApJS);
- ExoClock Project IV (arXiv:2511.14407).

The project's preferred acknowledgement wording is **UNVERIFIED**; check `exoclock.space` before publishing.

**Aladin Lite** (sky view): CDS, Strasbourg. Images come from the HiPS service (DSS2 colour) and its official mirrors. TransitPlanner blocks Aladin Lite's usage logger.

## Cross-checking results

These tools predict transits independently and are useful for spot checks:

- NASA Exoplanet Archive Transit and Ephemeris Service
- Swarthmore Transit Finder (TAPIR)
- ETD (Exoplanet Transit Database), `var.astro.cz/en/Exoplanets`
- TFOP Transit Finder
- `astropy` / `astroplan`

A planned verification task is to compare TransitPlanner against the NASA Transit Service and ETD for the same nights and sites.

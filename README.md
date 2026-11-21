# TransitPlanner

Plan exoplanet transit observations for your location, equipment and nights, and export the plan to **Ekos/KStars** and **N.I.N.A.** (plus CSV, iCalendar, JSON and a share link).

TransitPlanner links the steps that are usually done in separate tools:

**location + equipment + observing window → filters → transit list → schedule → scheduler file for KStars/NINA**

Everything runs in the browser. There are no accounts, no cookies and no tracking. Your locations and equipment stay in the browser's `localStorage`.

> **Accuracy note.** Predictions are for planning. Check the ephemeris (ExoClock, ETD, NASA Transit Service) shortly before you observe. Times are verified against astropy to about one second, but they cannot be better than the published ephemeris, and older ephemerides drift by minutes to hours. The uncertainty TransitPlanner shows (±σ) is propagated from the published errors. Real drift can be larger.

## Features

- **Location**: latitude, longitude, elevation; IANA time zone detected from the coordinates (overridable); "use my location"; saved profiles; local horizon profile (azimuth → minimum altitude, CSV import).
- **Equipment**: an official catalog (JSON, validated at build time), your own "My equipment", JSON import, and manual entry. Derived f-ratio, plate scale and field of view. Mount type, meridian-flip offset, slew/centering and autofocus overheads. An editable exposure-advice table.
- **Equipment Builder** (`builder.html`): creates and checks equipment JSON with a live schema check in plain language, derived-value sanity checks and a prefilled GitHub issue for catalog contributions.
- **Time and conditions**: 1–14 nights (or "tonight"); astronomical, nautical or civil darkness; a per-night summary with sunset, dark window, sunrise and Moon. Nights without darkness are greyed out.
- **Filters**: magnitude, depth, duration, coverage (full / complete transit / partial), baseline (fixed or proportional), widening by k·σ, minimum altitude, maximum airmass, Moon distance and illumination, an ephemeris-uncertainty cap, a meridian-flip policy (avoid / flag / allow), sources (ExoClock, NASA, TESS TOI) and "ExoClock needs observations".
- **Two modes** on the same engine:
  - **Photometry**: ExoClock-style science value, full warnings.
  - **Showcase**: deep transits of bright stars for outreach, basic warnings only.
- **Results**: a sortable, searchable, virtualized table. The detail view shows an altitude curve with twilight shading and the Moon, a predicted light curve, and an Aladin Lite sky view with the camera field of view.
- **Schedule**: a Gantt chart per night with conflicts (slew and autofocus gaps included) and **Suggest schedule** (weighted interval scheduling).
- **Export**:
  - Ekos `.esl` (KStars 3.7/3.8) and a starter `.esq`
  - NINA Advanced Sequencer JSON, built from your template or the built-in one
  - CSV, `.ics`, plan JSON
  - a share link
  - a printable summary
- **Red night mode** and a dark theme.
- All heavy computation runs in a **Web Worker**. Computing 3 nights for the full catalog (≈ 4 700 planets, optionally + 5 200 TOIs) takes well under a second on a laptop.

## Quick start

Requires Node.js ≥ 20.

```bash
git clone https://github.com/ExoplanetResearchGroup-Croatia/transit-planner.git
cd transit-planner
npm install
npm run dev          # http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Unit tests, astropy reference tests, exporter golden-file tests |
| `npm run build` | Validates `public/data/*.json`, type-checks, builds to `dist/` |
| `npm run preview` | Serves the production build (strict CSP active) |
| `npm run catalog:build` | Downloads NASA + ExoClock + TOI and rewrites the catalog snapshot (only if the data changed) |

## Data

The catalog is a **static snapshot** committed in `public/data/`, served from the same origin as the app. The upstream services send no CORS headers (checked 2026-11-21), so browsers could not query them directly anyway. The page footer shows the snapshot's date.

| Source | Use |
|---|---|
| [NASA Exoplanet Archive](https://exoplanetarchive.ipac.caltech.edu/), Planetary Systems Composite Parameters | Coordinates, magnitudes, T0, period, duration, depth, uncertainties |
| [ExoClock](https://www.exoclock.space/) | Fresher ephemerides (BJD_TDB) and observation priorities; takes precedence over NASA |
| NASA Exoplanet Archive, TESS Project Candidates | Optional TOI candidates (PC/APC) |

See [docs/data-sources.md](docs/data-sources.md) for queries, units, merging rules and citation text.

## Documentation

| Document | Contents |
|---|---|
| [docs/user-guide.md](docs/user-guide.md) | Step-by-step use, every filter explained |
| [docs/methodology.md](docs/methodology.md) | Time scales, darkness, prediction, altitude, flips, coverage, scores, scheduling, verification |
| [docs/data-sources.md](docs/data-sources.md) | NASA, ExoClock and TOI: queries, units, merging, attribution |
| [docs/export-formats.md](docs/export-formats.md) | Ekos `.esl`/`.esq`, NINA JSON, CSV, ICS, plan JSON, share link; tested versions |
| [docs/equipment-database.md](docs/equipment-database.md) | Equipment JSON schema, catalog rules, contributing equipment |
| [docs/development.md](docs/development.md) | Architecture, repository layout, tests, deployment to GitHub Pages |
| [docs/faq-troubleshooting.md](docs/faq-troubleshooting.md) | Common questions and problems |

## Deployment

The app is a static site built for **GitHub Pages**. It is not published yet. `.github/workflows/deploy-pages.yml` (manual trigger) and `refresh-catalog.yml` (catalog snapshot, manual trigger) are ready. [docs/development.md](docs/development.md#deployment-github-pages) lists the steps to go live.

## Status and tested versions

Version 0.1.0. The exporters are generated from real files written by KStars and NINA, and they pass golden-file tests against those files. They have **not yet been loaded into a running KStars or NINA**; see [docs/export-formats.md](docs/export-formats.md#tested-versions). Please report results in an issue.

## Contributing

Bug reports, equipment entries (with sources) and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Catalog data remain under the terms of their providers, so please cite them (see [docs/data-sources.md](docs/data-sources.md)). Test fixtures copied from KStars (GPL-2.0-or-later) and NINA (MPL-2.0) keep their licences (see `tests/fixtures/README.md`).

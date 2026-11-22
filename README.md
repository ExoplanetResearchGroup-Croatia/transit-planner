# TransitPlanner

**Open the app:** https://exoplanetresearchgroup-croatia.github.io/transit-planner/

Plan exoplanet transit observations for your location, equipment and nights, and export the plan to **Ekos/KStars** and **N.I.N.A.** (plus CSV, iCalendar, JSON and a share link).

TransitPlanner links the steps that are usually done in separate tools:

**location + equipment + observing window → filters → transit list → schedule → scheduler file for KStars/NINA**

Everything runs in the browser. There are no accounts, no cookies and no tracking. Your locations and equipment stay in the browser's `localStorage`.

> **Accuracy note.** Predictions are for planning. Check the ephemeris (ExoClock, ETD, NASA Transit Service) shortly before you observe. Times are verified against astropy to about one second, but they cannot be better than the published ephemeris, and older ephemerides drift by minutes to hours. The uncertainty TransitPlanner shows (±σ) is propagated from the published errors. Real drift can be larger.

## Features

The app has **two pages**:

1. **Plan**: the night timeline, where you read, adjust and export the plan.
2. **Setup**: what the planner assumed, each line opening a modal.

How it works:

- **Automatic start:** browser location, time zone from the coordinates, tonight plus the next 2 nights, mode defaults, compute. The best conflict-free plan is selected for you. Every change recomputes automatically.
- **The night as a pulsar plot:** every candidate transit is a hairline across the night that dips at its predicted transit (depth-scaled).
  - Scheduled transits are drawn bold.
  - Click a line to schedule or remove it; overlapping transits give way on their own.
  - Twilight, the Moon, slew gaps and meridian flips are drawn on the same plot.
- **Data column** for the selected transit: times, ±σ, depth, magnitude, altitude, Moon, coverage, warnings, predicted light curve, polar sky track, Aladin Lite sky view with the camera field of view.
- **One-click export:** Ekos `.esl` (KStars 3.7/3.8) and a starter `.esq`, NINA Advanced Sequencer JSON (your template or the built-in one; one file per night), CSV, `.ics`, plan JSON, share link, print.
- **Setup modals:**
  - **Location** (geolocation, saved sites, horizon profile);
  - **Equipment**: catalog, My equipment, JSON import, a manual form, mount and overheads, and an exposure-advice table;
  - **Nights**: 1–14, darkness −18/−12/−6°;
  - **Filters**: magnitude, depth, coverage, baseline, k·σ widening, altitude and airmass, Moon, uncertainty cap, flip policy, sources.
- **Two modes** on the same engine:
  - **Photometry**: ExoClock-style science value;
  - **Showcase**: deep transits of bright stars for outreach.
- **Equipment Builder** (`builder.html`): equipment JSON with a live schema check in plain language and a prefilled GitHub issue for catalog contributions.
- **Red night mode**, keyboard-accessible controls.
- **Computation in a Web Worker:** 3 nights for the full catalog take well under a second.

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
| [docs/user-guide.md](docs/user-guide.md) | How to use the app, every setting explained (EN) |
| [docs/upute.md](docs/upute.md) | Upute za korištenje (HR) |
| [docs/methodology.md](docs/methodology.md) | Time scales, darkness, prediction, altitude, flips, coverage, scores, scheduling, verification |
| [docs/data-sources.md](docs/data-sources.md) | NASA, ExoClock and TOI: queries, units, merging, attribution |
| [docs/export-formats.md](docs/export-formats.md) | Ekos `.esl`/`.esq`, NINA JSON, CSV, ICS, plan JSON, share link; tested versions |
| [docs/equipment-database.md](docs/equipment-database.md) | Equipment JSON schema, catalog rules, contributing equipment |
| [docs/development.md](docs/development.md) | Architecture, repository layout, tests, deployment to GitHub Pages |
| [docs/faq-troubleshooting.md](docs/faq-troubleshooting.md) | Common questions and problems |

## Deployment

**Live:** https://exoplanetresearchgroup-croatia.github.io/transit-planner/

The app is a static site on **GitHub Pages**. `.github/workflows/deploy-pages.yml` deploys every push to `main`, and `refresh-catalog.yml` refreshes the catalog snapshot daily (see [docs/development.md](docs/development.md#deployment-github-pages)).

## Status and tested versions

Version 0.1.0. The exporters are generated from real files written by KStars and NINA, and they pass golden-file tests against those files. They have **not yet been loaded into a running KStars or NINA**; see [docs/export-formats.md](docs/export-formats.md#tested-versions). Please report results in an issue.

## Contributing

Bug reports, equipment entries (with sources) and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Catalog data remain under the terms of their providers, so please cite them (see [docs/data-sources.md](docs/data-sources.md)). Test fixtures copied from KStars (GPL-2.0-or-later) and NINA (MPL-2.0) keep their licences (see `tests/fixtures/README.md`).

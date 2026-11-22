# Development

## Stack

| Layer | Choice |
|---|---|
| Frontend | Vite 8, TypeScript, React 19; two pages: `index.html` (planner) and `builder.html` (Equipment Builder) |
| Styling | Tailwind CSS 4 with theme tokens (`src/index.css`, visual world "Pulsar Sleeve", see DESIGN.md); red night mode; Radix primitives (Dialog, Tooltip, DropdownMenu); lucide icons; Archivo variable (width axis) bundled via Fontsource |
| Astronomy | `astronomy-engine` (Sun, Moon, Earth barycentre, precession/nutation, sidereal time) |
| Compute | Web Worker (`src/workers/compute.worker.ts` → `src/lib/transits/compute.ts`) |
| Charts | Hand-written SVG (night pulsar plot, light curve, polar sky track) |
| Sky view | Aladin Lite 3 from npm, loaded only when requested |
| State | zustand: settings in `localStorage` (`transit-planner:v1`), catalog cached in IndexedDB, share link in the URL hash |
| Tests | Vitest; astropy references; golden files for exporters |

## Repository layout

```
transit-planner/
├─ index.html, builder.html          two entry pages
├─ vite.config.ts                    build, relative base, CSP meta tag
├─ public/
│  ├─ data/                          equipment.json + schema, catalog snapshot
│  └─ templates/nina_template.json   built-in NINA template (generated)
├─ src/
│  ├─ strings.ts                     ALL user-facing text
│  ├─ app/                           App shell, PlanPage, SetupPage, modals, hooks, exportActions
│  ├─ builder/                       Equipment Builder page
│  ├─ components/                    UI primitives, NightPlot (signature view), charts, EquipmentForm, SkyView
│  ├─ state/                         store, defaults per mode
│  ├─ lib/astro/                     time scales, coordinates, time zones, darkness
│  ├─ lib/transits/                  prediction, evaluation, scores, horizon
│  ├─ lib/schedule/                  conflicts, weighted interval scheduling
│  ├─ lib/export/                    model, ekos, nina, csv/ics/json, share
│  ├─ lib/catalog/                   normalization, merge, checks, client loader
│  ├─ lib/equipment/                 types, validation, derived optics, library, exposure
│  └─ workers/                       compute worker + client
├─ scripts/                          build-catalog, validate-data, gen-validator
├─ tools/                            reference/make_fixtures.py (astropy), nina/make-default-template.ts
├─ tests/                            unit, reference and golden-file tests; fixtures/; golden/
└─ .github/workflows/                ci, deploy-pages (manual), refresh-catalog (manual)
```

## Commands

```bash
npm install
npm run dev            # dev server (no CSP)
npm test               # vitest (regenerates the validator first)
npm run build          # validate data → type-check → vite build → dist/
npm run preview        # serve dist/ with the production CSP
npm run catalog:build  # refresh public/data/catalog*.json and toi.json
npx tsx tools/nina/make-default-template.ts       # rebuild the NINA template
python3 tools/reference/make_fixtures.py          # regenerate astropy references
python3 tools/demo-video/record_demo.py hr OUT    # usage video with captions (hr|en), needs `npm run preview`
```

`npm run catalog:build -- --cache DIR` stores the raw downloads in `DIR` and reuses them on later runs, which saves time while developing.

## Tests

| File | What |
|---|---|
| `time.test.ts` | Leap seconds; BJD_TDB ↔ UTC and Rømer delay against astropy (40 cases) |
| `coords.test.ts` | Target alt/az and Sun altitude against astropy; LST model; airmass |
| `darkness.test.ts` | Time zones and DST; twilight crossings; polar day/night |
| `transits.test.ts` | Ephemeris propagation; synthetic transits (timing, coverage, flips, rejections); scheduling; horizon |
| `catalog.test.ts` | Normalization of real NASA/ExoClock/TOI records; merge rules; snapshot validity |
| `equipment.test.ts` | Catalog validity; plain-language errors; references; derived optics |
| `export.test.ts` | Ekos and NINA against real program files; CSV, ICS, JSON, share link; regression snapshots |

The astropy references in `tests/fixtures/astropy-reference.json` are committed. To regenerate them you need astropy ≥ 5 (tested with 8.0.3). IERS auto-download is disabled in the script, so it runs offline.

## Deviations from the original plan

The handoff (`PROJECT_CONTEXT`, 2026-11-21) planned Netlify. The owner decided on **GitHub Pages**, run locally for now. The consequences:

| Plan (Netlify) | Implemented (GitHub Pages) |
|---|---|
| Netlify Functions as proxy/cache | Not needed: the catalog is a static snapshot on the same origin |
| Scheduled function → Netlify Blobs | GitHub Actions `refresh-catalog.yml` commits the snapshot when the data change |
| `netlify.toml` headers (CSP, caching) | CSP as a `<meta>` tag injected at build time; caching left to GitHub Pages defaults |
| `/builder` route, SPA fallback | Second HTML page `builder.html`; no client routing, so no 404 fallback is needed |
| `*.netlify.app` | `exoplanetresearchgroup-croatia.github.io/transit-planner/`; a custom domain works later without rebuilding (relative `base`) |

Open questions from the handoff were decided as follows; all are easy to change:

- **License:** MIT.
- **Framework:** React.
- **Builder:** a page of the same app.

## Deployment (GitHub Pages)

The site is **not published yet**. To go live:

1. The organization is on the free plan, and Pages needs a **public** repository there. Make the repository public with `gh repo edit ExoplanetResearchGroup-Croatia/transit-planner --visibility public --accept-visibility-change-consequences`.
2. Under Settings → Pages, set **Source = GitHub Actions**.
3. Run **Deploy to GitHub Pages** once (Actions tab → Run workflow), or uncomment its `push` trigger to deploy on every push to `main`.
4. Optional: uncomment the `schedule` in `refresh-catalog.yml` for a daily snapshot, and the `workflow_run` trigger in `deploy-pages.yml` so that each refresh is deployed. Commits made with `GITHUB_TOKEN` do not start push-triggered workflows, which is why `workflow_run` is needed.
5. **Custom domain** (later): add `public/CNAME` containing the domain and set the DNS records. The build uses a relative base, so nothing else changes.

### Content Security Policy

`vite.config.ts` injects the policy for production builds:

- `script-src 'self' 'wasm-unsafe-eval'`: WebAssembly for Aladin Lite; no inline scripts and no `eval`, which is why the validator is precompiled.
- `connect-src` and `img-src`: `self`, `data:` (Aladin loads its WASM from a data URL) and the CDS HiPS servers plus their official mirrors (ESA, IRSA, CSIRO, STScI S3).
- Aladin's usage logger is neither allowed nor attempted: `SkyView.tsx` answers it locally.

`npm run preview` serves the build with the policy active. Check the browser console for violations after adding any external resource.

## Privacy

There are no accounts, cookies, analytics or server-side storage. Opening the sky view requests images from CDS and mirrors for the target position; the UI says so before loading.

# TransitPlanner: context for assistants

Public web app that plans exoplanet transit observations and exports them to Ekos/KStars and NINA. Repository: `ExoplanetResearchGroup-Croatia/transit-planner`. The original planning handoff (2026-11-21) is summarized here; the detailed documentation is in `README.md` and `docs/`.

## Status (2026-11-22, v0.2.0)

Phases 1–5 of the plan are implemented; phase 6 (comparison stars, finder chart, SNR, PWA) is not.

| Area | State |
|---|---|
| Engine | `src/lib`; verified against astropy |
| UI | Two pages, Plan (night timeline = workspace) and Setup (modals), plus the Equipment Builder; visual world "Pulsar Sleeve" (see PRODUCT.md, DESIGN.md, .impeccable/surfaces/) |
| Exporters | Golden-file tests against real KStars/NINA files |
| Docs | `README.md`, `docs/` |
| Pending | Loading the exports into a running KStars and NINA; comparison against NASA Transit Service / ETD |

## Decisions (do not re-litigate without reason)

- **Hosting: GitHub Pages, not Netlify** (owner's decision). LIVE since 2026-11-22 at https://exoplanetresearchgroup-croatia.github.io/transit-planner/ (public repo, deploy on push to main, daily catalog refresh). The catalog is a static snapshot in `public/data/`, refreshed by `.github/workflows/refresh-catalog.yml`. The CSP is a meta tag injected in `vite.config.ts`. `builder.html` is a second page.
- **UX (user decision 2026-11-22):** two pages only. Automatic start (geolocation → compute → best plan preselected); selection directly on the timeline, no separate results list; one-click export menu. Do not reintroduce wizards or extra pages.
- Public audience; English only. **All UI strings are in `src/strings.ts`.**
- Ekos and NINA have equal priority, both behind `Plan → Job[]` (`src/lib/export/model.ts`).
- Photometry and Showcase modes run on one engine with different defaults, scores and warnings.
- No accounts and no server storage. No analytics: Aladin Lite's usage logger is blocked.
- MIT licence; React; the Builder is part of the same app.

## Working rules

- **Do not invent equipment specs.** Every catalog value needs source URLs and a confidence level; mark inferred values.
- **Exporters must stay grounded in real program output.** Golden-file tests live in `tests/export.test.ts`; the fixtures and their sources are in `tests/fixtures/`. NINA times are PC-local clock times without a date, so files are per night. Ekos `At` times are local time without an offset.
- Heavy computation stays in the Web Worker.
- Write the docs alongside the code.
- New astronomy code needs a reference test (`tools/reference/make_fixtures.py`).
- Treat everything marked **UNVERIFIED** in `docs/` as a task, not a fact.

## Commands

`npm run dev` · `npm test` · `npm run build` · `npm run preview` · `npm run catalog:build`

## Open items

1. Load the exports into real KStars 3.7/3.8 and NINA 3.x and record the results in `docs/export-formats.md#tested-versions`. Which versions the owner tests is still open.
2. Compare predictions with the NASA Transit Service and ETD for a few nights and sites.
3. ExoClock acknowledgement wording and the TOI table DOI (marked UNVERIFIED in `docs/data-sources.md`).
4. `equipment.schema.json` was reconstructed from the data because the original was not delivered. Confirm it.
5. More equipment (eVscope, ASI183/533/1600, HEQ5/AM5, refractors, the society's instruments), with sources.

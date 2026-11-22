# Changelog

All notable changes to this project are documented here. Dates are UTC.

## 0.2.0 — 2026-11-22

Redesign after user feedback ("too many clicks, too many pages, looks vibe-coded").

- **Two pages instead of a 7-step wizard.**
  - **Plan**: the night timeline is the workspace, with selection and export.
  - **Setup**: summary lines that open modals for location, equipment, nights, filters and export settings.
- **Automatic start:** browser geolocation, compute, and the best conflict-free plan selected automatically. Settings changes recompute on their own.
- **Selection directly on the plot.** Manual picks win, removals stick, and the rest is re-optimized (`planSelection`, with a test).
- **One-click export menu.** The format downloads at once; options moved to Export settings.
- **New visual world, "Pulsar Sleeve":**
  - each night as a stack of hairline light curves on matte black, depth-scaled dips, scheduled transits bold;
  - Archivo with wide numerals, engraved caps, hairline controls with coloured end blocks, a five-block colour code for state;
  - a polar sky track and a hairline light curve in the data column.
- Aladin Lite's usage logger is blocked, and the CSP now allows the official HiPS mirrors.

## 0.1.0 — 2026-11-21

First working version (not yet deployed).

- Catalog snapshot builder: NASA Exoplanet Archive (pscomppars) merged with ExoClock (ExoClock ephemerides take precedence), plus TESS TOI candidates. The snapshot is rewritten only when the data change.
- Equipment database: schema version 1 (`public/data/equipment.schema.json`, reconstructed from `equipment.json` because the original schema file was not delivered) and a precompiled validator shared by the build, the Builder and the import dialog.
- Engine:
  - BJD_TDB → UTC with Rømer delay and leap seconds (verified against astropy).
  - Darkness windows that handle polar day and polar night.
  - Transit prediction with propagated σ, altitude/airmass/horizon checks, Moon, meridian flips, coverage, scores, weighted interval scheduling.
- UI: 7-step planner, Web Worker, results table, altitude chart, light curve, Aladin Lite sky view, Gantt schedule, red night mode, Equipment Builder page.
- Exporters:
  - Ekos `.esl` (formats 2.2 and 2.1) and a starter `.esq` (2.6)
  - NINA Advanced Sequencer JSON by template substitution
  - CSV, iCalendar, plan JSON, share link, printable summary
  - golden-file tests against files written by KStars and NINA
- GitHub Actions: CI; a manual Pages deploy and a manual catalog refresh, ready to be switched on.

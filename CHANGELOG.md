# Changelog

All notable changes to this project are documented here. Dates are UTC.

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

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Amateur astronomers who observe exoplanet transits: society members (Exoplanet Research Group Croatia) and the public. Two jobs:

- science-grade photometry for ExoClock-style ephemeris refinement;
- outreach nights showing an obvious transit.

They plan **at home on a laptop, before the night** (daylight or evening, at a desk). Then they take the exported file to Ekos/KStars, NINA or a smart telescope at the telescope.

## Product Purpose

Turn "where am I, what do I have, which nights" into a conflict-free plan of transits and a file the telescope software can run, with as few decisions as possible. Success means the user opens the app, sees tonight's best plan already computed and selected, adjusts it on the timeline if they want, and downloads the scheduler file with one click.

## Positioning

The tools that exist (NASA Transit Service, Swarthmore TAPIR, ETD, ExoClock, the NINA ExoPlanets plugin) each cover part of the chain. TransitPlanner links location + equipment + window → filtered transits → schedule → Ekos/NINA export, in the browser, without accounts.

## Operating Context

- **Two pages only** (user decision, 2026-11-22):
  1. **Setup**: location, equipment, nights and filters as auto-filled summaries, with details in modals.
  2. **Plan**: the night timeline is the workspace and also carries selection and export.
- **No separate results list.** Transits are selected directly on the timeline, and the plan recalculates automatically when any setting changes.
- **Fully automatic first run:** browser geolocation, time zone from coordinates, tonight + 3 nights, mode defaults, compute, then show the plan. Setup is opened only to change something.
- **The best conflict-free schedule is pre-selected automatically**; the user adds or removes.
- **Export is one click:** choose a format, download. Advanced export options never block the default download.
- A red night mode exists for use at the telescope.

## Capabilities and Constraints

- **Catalog:** NASA Exoplanet Archive (pscomppars) + ExoClock (preferred ephemerides) + optional TESS TOI, served as a static snapshot.
- **Engine:** BJD_TDB → UTC, darkness, prediction with σ, altitude/airmass/horizon, Moon, meridian flips, coverage, Photometry and Showcase modes, weighted interval scheduling. All of it runs in a Web Worker and is verified against astropy.
- **Exports:**
  - Ekos `.esl` (KStars 3.7/3.8) and a starter `.esq`;
  - NINA Advanced Sequencer JSON (template substitution, one file per night);
  - CSV, ICS, plan JSON, share link.
- **Equipment:** a JSON catalog with sources and confidence, "My equipment" in localStorage, import, and an Equipment Builder page.
- **Hosting:** static site for GitHub Pages; strict CSP; no accounts, no cookies, no analytics.
- English UI; all strings live in `src/strings.ts`.

## Evidence on Hand

- Real catalog data in `public/data/`.
- The equipment catalog with sources in `public/data/equipment.json`.
- Real KStars and NINA files in `tests/fixtures/`.
- No user testimonials, usage numbers or endorsements exist; never invent them.

## Product Principles

1. Automatic first: compute and select the best plan before asking anything.
2. One working surface: the timeline is where you read, choose and export.
3. Details on demand: every advanced setting is one click away and never in the way.
4. Honest predictions: show uncertainty, data date and warnings where they matter.
5. Private by default: everything stays in the browser.

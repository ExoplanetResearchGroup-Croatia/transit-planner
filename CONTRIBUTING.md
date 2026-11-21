# Contributing

Thank you for helping. The project is small, so please open an issue first for larger changes.

## Equipment entries

The catalog is `public/data/equipment.json` (schema: `public/data/equipment.schema.json`, explained in [docs/equipment-database.md](docs/equipment-database.md)).

Rules:

1. **Do not invent specifications.** Every value must come from a source you can link to (manufacturer page, manual, datasheet, retailer page, review). Add the URLs to `sources`.
2. Set `confidence`:
   - `high`: from the manufacturer, or several agreeing sources;
   - `medium`: from secondary sources, or one inferred value;
   - `low`: unverified.
3. Mark inferred values explicitly (for example `pixel_um_inferred: true`) and list open points in `needs_verification`.
4. Planner defaults on mounts (`planning_defaults`) are not manufacturer values; say so in `note`.

The easiest route is the **Equipment Builder** (`builder.html` in the app). Fill in the form, tick "catalog contribution", add the source URLs, then press **Open a prefilled GitHub issue**. You can also edit the JSON and open a pull request. `npm run build` (and CI) fails when an entry is invalid.

## Code

```bash
npm install
npm run dev
npm test
npm run build
```

- All user-facing text lives in `src/strings.ts`.
- Heavy computation belongs in the Web Worker (`src/workers/compute.worker.ts` → `src/lib/transits/compute.ts`).
- Update the matching document in `docs/` in the same pull request.
- Exporters are generated from real program output. If you change one, keep the golden-file tests green and update the snapshots in `tests/golden/` deliberately (`npx vitest run -u`), explaining why in the PR.
- New astronomy code needs a reference test. `tools/reference/make_fixtures.py` produces astropy reference values.

## Reporting export problems

Please include:

- your KStars/Ekos or NINA version and operating system;
- the exported file;
- what the program did, for example an error message or wrong times;
- for NINA, the template you used.

See [docs/export-formats.md](docs/export-formats.md#tested-versions).

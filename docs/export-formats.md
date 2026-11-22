# Export formats

All exporters share one internal model: **Plan → Job[]** (`src/lib/export/model.ts`). A job is one selected transit with these times:

| Field | Meaning |
|---|---|
| `startMs` | Slew, centering and autofocus begin: planned start − (slew + autofocus overhead) |
| `obsStartMs` / `obsEndMs` | First and last science frame (the planned interval, see methodology §5) |
| `ingressMs`, `midMs`, `egressMs` | Predicted transit times |

The exporters were written from **real files saved by KStars and NINA, and from their source code**. They were checked on 2026-11-21 by the research described below, not from memory.

## Ekos / KStars

### Scheduler list (`.esl`)

**Sources.** The KStars repository (`invent.kde.org/education/kstars`, mirror `github.com/KDE/kstars`), branch `stable-3.8.5` at commit `65977fded4aed4e8d878cebb7df0a6f140782959`:

- writer: `SchedulerProcess::saveScheduler` (writes `<SchedulerList version='2.2'>`);
- reader: `SchedulerUtils::createJob`;
- enum `ALGORITHM_GREEDY = 1` (`kstars/ekos/scheduler/schedulertypes.h`);
- a file written by KStars: `Tests/ekos/scheduler/start_at_finish_at_test.esl` (copied to `tests/fixtures/ekos/`).

`stable-3.7.9` writes version `2.1`. Its `<Job>` block is identical to 2.2; only the Startup/Shutdown procedure blocks differ. TransitPlanner writes either version (choose "KStars version" in the export step).

TransitPlanner writes one **lead job per transit**, in time order:

```xml
<Job>
<JobType lead='true'/>
<Name>WASP-12 b</Name>
<Group>Transits</Group>
<Coordinates>
<J2000RA>6.5091083</J2000RA>        <!-- hours, J2000 -->
<J2000DE>29.672278</J2000DE>        <!-- degrees, J2000 -->
</Coordinates>
<PositionAngle>0</PositionAngle>
<Sequence>/home/user/transits/transit.esq</Sequence>
<StartupCondition>
<Condition value='2026-11-21T19:30:00'>At</Condition>     <!-- start: slew begins -->
</StartupCondition>
<Constraints>
<Constraint value='30'>MinimumAltitude</Constraint>
</Constraints>
<CompletionCondition>
<Condition value='2026-11-22T01:30:00'>At</Condition>     <!-- finish: end of window -->
</CompletionCondition>
<Steps><Step>Track</Step><Step>Focus</Step><Step>Align</Step><Step>Guide</Step></Steps>
</Job>
```

**Times.** KStars reads the `value` with `QDateTime::fromString(value, Qt::ISODate)`. KStars itself writes these values **without a UTC offset**, as local time of the KStars computer. TransitPlanner writes the same form in the **clock time zone** chosen in the export step (default: the site's zone). If your KStars computer's system clock runs on UTC, choose UTC.

**Completion "At"** makes Ekos repeat the capture sequence until the finish time, so the `.esq` only defines one pass.

**Minimum altitude** is the planner's effective minimum: the larger of the minimum altitude and the altitude of the maximum airmass.

### Starter sequence (`.esq`)

The writer follows `SequenceJob::saveTo` / `SequenceQueue::save` (`<SequenceQueue version='2.6'>`, stable-3.8.5). It is checked element by element against the KStars test fixture `Tests/ekos/scheduler/3x30s_Red.esq`. The starter sequence has one Light job with the advised exposure, your filter name and frame size. **Dithering is off** (`GuideDitherPerJob = -1`), and HFR-triggered and periodic refocusing are off, because both move stars on the detector and hurt differential photometry.

Open the starter file in Ekos once and save it again, so that camera-specific properties are filled in.

## N.I.N.A.

### Sources

- NINA source `github.com/isbeorn/nina`, tag `Version-3.2` (commit `2393eae581145ed5b8114bf07c48ca2580540fd5`), and `develop` (3.3 nightly) at `db6b9090acdf27af3e5d9548a7c4231e8572fbb3`. Bitbucket stopped updating in 2025-06.
- Golden corpus: `NINA.Test/Sequencer/Serialization/LegacySequences/v3.2/master-3.2-all-sequence-entities.sequence.json`. NINA's own serializer generated it from the 3.2 release; it holds every built-in item, condition and trigger. It is copied to `tests/fixtures/nina/`.
- A NINA 2.x example: the ExoPlanets plugin's `TransitPlanetImagingSequence.json` (github.com/NickHardy/ExoPlanets).

### How the export works

NINA's sequence JSON is version-bound, so TransitPlanner does **template substitution**:

1. Use the built-in template (`public/templates/nina_template.json`, NINA 3.x), or save a template from NINA once and upload it. Accepted templates:
   - a full sequence;
   - a target file (a bare "Deep Sky Object" container);
   - any `.template.json` that contains a Deep Sky Object container.
2. For each transit of a night, the first `DeepSkyObjectContainer` is cloned and only these values change:
   - container `Name` and `Target.TargetName`;
   - `Target.InputCoordinates`, and the `Coordinates` of child items with `"Inherited": true` (Slew and center, altitude conditions);
   - every **Wait for Time** (`WaitForTime`), set to the job start;
   - every **Loop Until Time** (`TimeCondition`), set to the job end;
   - optionally `ExposureTime` of LIGHT **Take Exposure** items, set from the advice table.
3. All `$id`s are renumbered in document order and all `$ref`s rewritten. A reference to an object that was replaced is re-inlined.

The built-in template is assembled by `tools/nina/make-default-template.ts`, only from objects in the NINA 3.2 corpus:

```
Targets
└ Deep Sky Object "TransitPlanner target"   [trigger: Meridian Flip]
  ├ Wait for Time           (start)
  ├ Slew and center         (inherits target coordinates)
  └ Sequential "Transit photometry"   [condition: Loop Until Time (end)]
    └ Take Exposure (LIGHT)
```

### Format facts that matter

- **JSON conventions.** Newtonsoft `TypeNameHandling.All` + `PreserveReferencesHandling.All`. Every object has a `$type` with assembly name, and almost every object an `$id`. NINA applies properties **in document order**, so key order is preserved.
- **Declination.** `DecDegrees` is the **signed truncated degree** (0 for −1° < Dec < 0); `DecMinutes`/`DecSeconds` are absolute; `NegativeDec` must come **before** `DecDegrees`. Example: −45°39′33″ → `NegativeDec: true, DecDegrees: -45, DecMinutes: 39, DecSeconds: 33`. Other layouts load a wrong declination.
- **Times.** Wait for Time and Loop Until Time store only `Hours`/`Minutes`/`Seconds` of the **NINA PC's local clock**, with no date. Which day a time belongs to:
  - NINA 3.x rolls the day over at **sunrise** at the profile location;
  - NINA 2.x rolls it over at **noon**.
  - Therefore one file is valid for **one night**. TransitPlanner writes one file per night (`transits_<date>_nina.json`). Load it after sunrise of that day.
- **Fixed-clock provider.** The provider must be the fixed-clock `TimeProvider`; any other provider makes NINA recompute and overwrite the stored time. TransitPlanner sets `TimeProvider` and `MinutesOffset: 0`.
- **No version stamp.** NINA writes no version number. TransitPlanner detects 2.x and 3.x by fingerprints: collection assembly `, System.ObjectModel` and `PositionAngle` mean 3.x; `, System` / `mscorlib` and `Rotation` mean 2.x.
- **Plugin instructions** load as "Unknown instruction" when the exact plugin build is missing. The template check warns about them; prefer core-only templates.

### Related NINA features (checked, not used)

- The **ExoPlanets** plugin (Nick Hardy, NINA ≥ 3.1.2) fetches tonight's transits itself, from NASA via Swarthmore, ExoClock, TESS or Exoplanet Watch. It does **not** import user target lists; its only import is a variable-star CSV.
- **Target Scheduler** imports CSV (`Type,Name,Ra,Dec,Rotation,ROI`, or Telescopius) but has no time windows, so it suits fixed transit windows poorly.
- NINA's own "Import targets" (Simple sequencer) reads Telescopius CSV without times.

## Smart telescopes (Seestar)

Seestars are controlled by the vendor app (`control: "vendor_app"`), so the Ekos and NINA exports are disabled. Use the CSV or calendar export for target names, coordinates and times. Whether an unofficial bridge to ASCOM/INDI works for this purpose is **UNVERIFIED**.

## CSV

Columns:

- identity and position: `name, host, night, ra_deg, dec_deg, ra_hms, dec_dms, mag, mag_band, depth_ppt, duration_h`
- UTC times: `start_utc, obs_start_utc, ingress_utc, mid_utc, egress_utc, obs_end_utc`
- the same six times in local time, as `*_local` columns
- planning data: `sigma_min, coverage, alt_mid_deg, moon_sep_deg, meridian_flip_utc, exposure_s, exoclock_priority, source, score, warnings`

The CSV has CRLF line endings and RFC 4180 quoting.

## iCalendar (`.ics`)

There is one event per transit, from slew start to window end. Times are in UTC (`Z`). The description holds ingress, mid and egress times, coordinates, depth, magnitude, σ and warnings. Lines are folded at 75 octets as RFC 5545 requires.

## Plan JSON

`format: "transit-planner-plan"`, `formatVersion: 1`. It contains the site, equipment name, mode, overhead, catalog version and all jobs, with millisecond timestamps and ISO UTC strings.

## Share link

The URL hash `#p=…` holds the settings (mode, site, equipment selection, mount, nights, darkness, filters, exposure table) and the selected event ids, compressed with lz-string. Nothing is sent to a server. Equipment from "My equipment" is referenced by id only, so the recipient needs the same entries.

## Golden-file tests

`tests/export.test.ts`:

- **Ekos:**
  - the job elements and the `At` condition syntax match a file written by KStars;
  - the element order matches the 3.8.5 writer;
  - fields are read back the way `createJob` reads them;
  - the `.esq` element structure equals the KStars fixture.
- **NINA:**
  - the coordinate key order equals NINA 3.2 output;
  - the declination sign conventions are checked;
  - the output has sequential `$id`s, every `$ref` is defined before use, and the values are substituted;
  - 2.x/3.x detection works on real files.
- **Regression snapshots** in `tests/golden/`. Update them deliberately with `npx vitest run -u`.

## Tested versions

| Program | Format written | Status |
|---|---|---|
| KStars/Ekos 3.8.x | SchedulerList 2.2, SequenceQueue 2.6 | Generated from the 3.8.5 writer and checked against KStars-saved files; **not yet loaded into a running KStars** |
| KStars/Ekos 3.7.x | SchedulerList 2.1 | Generated from the 3.7.9 writer; **not yet loaded** |
| NINA 3.x (3.2) | built-in template | Built from NINA 3.2 serializer output; **not yet loaded into a running NINA** |
| NINA 2.x | user template required | Detection tested; **not yet loaded** |

If you load an export into KStars or NINA, please report the result (version, OS, file) in an issue. The test targets for the project still have to be decided (open question 3 in the handoff).

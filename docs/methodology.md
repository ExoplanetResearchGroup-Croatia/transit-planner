# Methodology

How TransitPlanner turns catalog ephemerides into observable transits and a schedule. The code lives in `src/lib/` and runs in a Web Worker.

## 1. Time scales: BJD_TDB → UTC

Catalogs give mid-transit times in **BJD_TDB**, the barycentric Julian date in Barycentric Dynamical Time. Plans need **UTC** at the observatory. The conversion (`src/lib/astro/time.ts`) is:

```
BJD_TDB = JD_UTC + (TAI−UTC + 32.184 s)/86400 + (TDB−TT)/86400 + (r_⊕ · n̂)/c
```

- **TAI−UTC** comes from a leap-second table (37 s since 2017-01-01). A new leap second must be added to `LEAP_SECONDS`.
- **TDB−TT** uses the leading Fairhead & Bretagnon terms (≤ 1.7 ms).
- **Rømer delay** (r_⊕ · n̂)/c: r_⊕ is the barycentric position of the geocentre (astronomy-engine `BaryState`, J2000 equatorial frame) and n̂ the unit vector to the target (J2000 RA/Dec). Its amplitude is up to ±8.3 min.
- Ignored on purpose:
  - the observer's offset from the geocentre (≤ 21 ms);
  - Shapiro and Einstein delays (µs to ms);
  - target proper motion.

  Planning accuracy of about one second is the goal.

The inverse (BJD → UTC) uses fixed-point iteration. Bulk prediction uses a single-pass version, which differs from the iteration by less than 0.1 s.

**Verification:** `tests/time.test.ts` compares against astropy `Time.light_travel_time(kind='barycentric')` for 5 targets × 8 dates (2026–2027):

| Quantity | Tolerance |
|---|---|
| UTC → BJD_TDB | 0.5 s |
| Rømer delay | 0.5 s |
| BJD_TDB → UTC | 1 s |

`tools/reference/make_fixtures.py` regenerates the references; they were produced with astropy 8.0.3.

**Caveat for NASA ephemerides.** The NASA composite table (`pscomppars`) takes `pl_tranmid` from the cited paper. Most papers use BJD_TDB, but some older ones use HJD or BJD_UTC, which differ by up to about a minute. ExoClock ephemerides are explicitly BJD_TDB, which is one reason they are preferred.

## 2. Nights and darkness

A night (`src/lib/astro/darkness.ts`) runs from **local noon to the next local noon** in the site's IANA time zone, so DST changes are handled by `Intl`.

The Sun's topocentric altitude is sampled every 5 min. Threshold crossings are interpolated linearly, with an error well under 30 s. The thresholds are:

| Event | Sun altitude |
|---|---|
| Sunset / sunrise | −0.833° |
| Civil twilight | −6° |
| Nautical twilight | −12° |
| Astronomical twilight | −18° |

"Dark" means the Sun is below the chosen threshold. All dark segments are kept, so a target can be observable in any of them. The summary shows the longest one.

Polar cases follow from the sampling without special code:
- A night that never reaches the threshold is `no-darkness`; it is greyed out and no transit can pass.
- A night entirely below the threshold is `continuous-darkness`.

`tests/darkness.test.ts` checks that the Sun really is at each threshold at the computed times. It also checks the polar cases: no astronomical darkness at 55.7° N in June, and continuous civil darkness at Longyearbyen in December.

## 3. Transit prediction

For each target and epoch n (`src/lib/transits/compute.ts`):

```
T_n     = T0 + n·P                         (BJD_TDB)
σ_T(n)  = sqrt(σ_T0² + n²·σ_P²)            (converted to minutes)
```

- Asymmetric published errors are symmetrized to the larger of the two.
- Epochs are found for the whole date range with a ±0.01 d margin (Rømer + TT−UTC).
- Each T_n is converted to UTC (§1) and assigned to the night that contains it.
- If neither σ_T0 nor σ_P is published, σ is **unknown**. Such targets are excluded unless "allow targets without published uncertainty" is on, and they get a warning.
- **Ingress/egress:** mid ± duration/2.

**Window:**

```
window = [ingress − baseline − k·σ , egress + baseline + k·σ]
```

- `baseline` is fixed (minutes) or proportional (factor × duration, at least 20 min).
- `k` is "widen by k·σ" (default 1).

## 4. Observability

The window is sampled every 5 minutes. A sample is **observable** when all of these hold:

- the Sun is below the darkness threshold (§2);
- the target's altitude ≥ max(minimum altitude, altitude of the maximum airmass, local horizon at that azimuth).

**Altitude and azimuth:**
- The target's J2000 coordinates are precessed (with nutation) once to the equator of date with astronomy-engine `Rotation_EQJ_EQD`.
- The hour angle uses local apparent sidereal time, evaluated once per night and advanced linearly (< 0.1 s error over 24 h).
- Altitudes are **geometric**: no refraction and no aberration. They are about 0.5° lower than apparent at the horizon and 0.03° lower at 60°.
- `tests/coords.test.ts` agrees with astropy AltAz (pressure 0) within 0.05° in altitude and 0.1° in azimuth.

**Airmass** uses Kasten & Young (1989). The maximum-airmass filter is converted to the equivalent altitude: X = 2 ≈ 30°.

**Horizon profile:** linear interpolation in azimuth between the points you enter, wrapping at 360°.

## 5. Coverage

From the samples:

- **transit fraction** is the share of samples between ingress and egress that are observable;
- **baseline before/after** is the contiguous observable time immediately before ingress or after egress (capped at baseline + k·σ).

| Coverage | Condition |
|---|---|
| `full` | the whole transit is observable **and** both sides reach baseline + k·σ |
| `short-baseline` | the whole transit is observable, but at least one baseline is shorter |
| `partial` | part of the transit is not observable (missing ingress or egress, twilight, horizon) |

The coverage filter accepts:
- **Full**: only `full`.
- **Transit**: `full` and `short-baseline`.
- **Partial**: anything with transit fraction ≥ the chosen minimum.

The **planned interval** (`obsStart` → `obsEnd`) is the contiguous observable run that overlaps the transit the most, clipped to the window. Exporters use it; for full coverage it equals the window.

## 6. Moon

At mid-transit the app computes the Moon's topocentric position, its separation from the target and its illuminated fraction.

- The Moon filters (minimum separation, maximum illumination) apply only when the Moon is above −2° altitude.
- Warnings are added below 30° separation and above 70 % illumination.

## 7. Meridian flip (German equatorial mounts)

The mount is assumed to flip **`flip after` minutes past upper culmination** (default 5 min, a planner default, not a manufacturer value). A flip happens during an observation when:
- the hour angle at the planned start is negative (the target has not yet culminated), and
- culmination + offset falls inside the planned interval.

A target that is already past the meridian when you slew to it gets the post-flip pier side directly, so it does not flip.

The flip is then classified as during the **transit** (between ingress and egress) or during the **baseline**.

| Policy | Effect |
|---|---|
| Avoid | Drops the event |
| Flag | Keeps it with a warning |
| Allow | Keeps it without a warning |

Fork-equatorial and alt-az mounts never flip. Alt-az mounts get a warning when the target passes above 80°, where field rotation is fast near the zenith.

## 8. Scores

Both scores lie roughly between 0 and 1.3 and are used only for ranking and scheduling (`src/lib/transits/score.ts`).

**Photometry** (ExoClock-style science value):

```
score = (priority + staleness) × coverage × altitude × flip
```

| Factor | Values |
|---|---|
| priority | ExoClock alert 1.0, high 0.8, medium 0.55, low 0.3; TOI 0.35; others 0.2 |
| staleness | 0.3 × min(σ/30 min, 1); unknown σ gives 0.1 (stale ephemerides are worth refreshing) |
| coverage | full 1, short baseline 0.6, partial 0.3 × fraction |
| altitude | clamp((min altitude during the interval − 20°)/40°, 0.2, 1) |
| flip | flip during transit 0.5, during baseline 0.85, none 1 |

**Showcase** (outreach interest):

```
score = depth × brightness × visibility
```

| Factor | Value |
|---|---|
| depth | log10(1 + depth_ppt) / log10(31), capped at 1 (30 ppt or deeper = 1) |
| brightness | 10^(−0.2 (mag − 9)), clamped to 0.05–1 |
| visibility | coverage factor (1 / 0.85 / 0.5 × fraction) × sin(altitude at mid), clamped to ≥ 0.2 |

## 9. Scheduling

Each selected transit occupies `[obsStart − gap, obsEnd]`, where `gap` = slew/centering + autofocus minutes.

- **Conflicts** are pairs whose occupied intervals overlap.
- **Suggest schedule** solves weighted interval scheduling (dynamic programming, O(n log n)) with the mode's score as weight. It returns the conflict-free set with the highest total score across all nights.

## 10. Exposure advice and light curve

- **Exposure advice** is a heuristic starting point. An editable magnitude table for a 200 mm aperture is scaled by (200 mm / D)² and snapped to the fixed options of smart telescopes. Always check the first frames for saturation.
- **Predicted light curve** is a trapezoid from depth and duration with impact parameter 0. Ingress time ≈ T·k/(1+k) with k = √depth. It is illustrative only.

## 11. Known limitations

- Altitudes are geometric (no refraction). This is slightly conservative at low altitude.
- The Moon is evaluated at mid-transit only.
- Comparison stars, SNR and finder charts are not yet implemented (planned, phase 6).
- The flip model is a single offset. Some mounts flip on a limit that depends on declination.
- The predicted σ uses only the published errors. Real ephemeris drift can be larger, so check the O−C on ExoClock or ETD.

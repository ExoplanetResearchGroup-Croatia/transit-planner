# User guide

TransitPlanner walks through seven steps. You can jump between steps with the step bar. Results, Schedule and Export need a valid location. Every setting is saved in your browser.

The header has three switches:

- **Mode**:
  - **Photometry** (science value, ExoClock priorities, full warnings);
  - **Showcase** (deep transits of bright stars for outreach, basic warnings).
  Each mode has its own filter set.
- **Times**: local time of the site or UTC. Exports always state their time zone.
- **Theme**: dark, or **red night mode** for use at the telescope.

## 1. Location

- Press **Use my location**, or type latitude and longitude in decimal degrees (north and east positive) and the elevation.
- The **time zone** is detected from the coordinates. Change it only if your observatory clock runs on another zone.
- **Saved locations**: keep several sites and switch with one click.
- **Local horizon** (optional): one `azimuth,altitude` pair per line, in degrees, typed or imported from CSV. Header lines and `#` comments are ignored. Between points the minimum altitude is interpolated linearly. A target counts as visible only above both the horizon and the minimum-altitude filter.

## 2. Equipment

| Source | Use |
|---|---|
| **Catalog** | Presets, smart telescopes, or *Build a setup* (telescope + camera + readout mode + mount) |
| **My equipment** | Entries you created or imported; **Export my equipment** downloads them as JSON |
| **Import JSON** | A file in the TransitPlanner format. It is checked, and errors are listed in plain language |
| **Enter manually** | The same form as the Equipment Builder |

On the right:

- **Derived values**: focal ratio, plate scale and field of view, always computed from the sensor, not taken from brochures.
- **Mount and overheads**:
  - mount type (meridian flips happen only on German equatorial mounts);
  - **flip after** (minutes past the meridian);
  - **slew + centering**;
  - **autofocus**.

  Overhead and autofocus together make the gap between targets in the schedule.
- **Exposure advice**: a magnitude → exposure table for a 200 mm aperture, scaled to your aperture. It is a starting point; edit it to match your camera and filters.

Smart telescopes controlled by a vendor app (Seestar) cannot be driven by Ekos or NINA. Use the CSV or calendar export for them.

## 3. Time and conditions

- **First night**: tonight, or any date. A night is named after its evening.
- **Number of nights**: 1–14.
- **Darkness**: astronomical (−18°), nautical (−12°) or civil (−6°). Nautical darkness gives longer windows for bright targets.
- The **night summary** lists sunset, start and end of darkness, sunrise, dark hours and Moon illumination. Nights that never get dark at the chosen threshold, such as summer at high latitude, are greyed out.

## 4. Target filters

| Filter | Meaning |
|---|---|
| Magnitude | V if known, otherwise Gaia G, otherwise TESS T (the table marks G/T) |
| Depth | Transit depth in ppt (parts per thousand); 10 ppt ≈ 1 % ≈ 11 mmag |
| Duration | Transit duration (first to fourth contact), hours |
| Ephemeris uncertainty cap | Drops transits whose predicted σ is larger; empty = no cap |
| Allow targets without published uncertainty | Otherwise they are dropped |
| Sources | ExoClock (preferred ephemerides), NASA, TESS candidates |
| Only ExoClock targets that need observations | ExoClock priority alert or high |
| Minimum altitude, maximum airmass | The stricter of the two applies (airmass 2 ≈ 30°) |
| Moon distance, Moon illumination | Applied only while the Moon is up at mid-transit |
| Coverage | **Full**: transit and both baselines; **Transit**: complete transit, baselines may be short; **Partial**: at least the chosen share of the transit |
| Baseline | Out-of-transit time before ingress and after egress: fixed minutes, or a multiple of the duration |
| Widen by k·σ | Adds k × ephemeris uncertainty to each side of the window |
| Meridian flip | **Avoid** drops transits with a flip during the planned interval; **Flag** keeps them with a warning; **Allow** ignores flips |

**Reset to mode defaults** restores the current mode's defaults.

## 5. Transits

The computation runs in the background, typically in under a second. Above the table:

- the number of transits and targets;
- **Not shown**: why other events were dropped, for example "magnitude 2671" or "too low during the transit 128". Use it to see which filter to loosen.

The table:

- Sort by clicking a column header; search by name.
- Times are shown in the chosen zone:

  | Column | Meaning |
  |---|---|
  | From | Planned start of observing |
  | Ingress, Mid, Egress | Predicted transit times |
  | ±σ | Ephemeris uncertainty in minutes |

- **Coverage** badge: Full / Short baseline / Partial. ⚠ counts the warnings; hover to read them.
- Tick a checkbox to add the transit to the schedule.

Click a row to open the **detail view**:

- the times, depth, duration, magnitude, altitude, Moon and coverage;
- the warnings, including the meridian-flip time;
- the **altitude** over the night: twilight shading, Moon (dotted), minimum altitude (dashed), horizon profile, the window (light), the transit (strong), mid-transit and flip (red);
- the **predicted light curve** with the ±σ band on mid-transit and the planned interval (green);
- the **sky view** (Aladin Lite, DSS images from CDS) with your camera's field of view, loaded only when you ask;
- the ephemeris: T0, P, errors, source, reference, epoch.

## 6. Schedule

- There is one timeline per night. The background shades twilight, and the dotted line shows the Moon's altitude.
- Each row is one transit: the light bar is the planned interval and the strong bar the transit. A short grey line before a selected bar is the slew/autofocus gap.
- Click a row to select or deselect it; double-click to open details.
- **Conflicts** (overlaps including the gap) are outlined in red.
- **Suggest schedule** picks the conflict-free set with the highest total score across all nights.

## 7. Export

**Clock time zone** is the zone of the computer's clock that will run the plan; normally the site's zone.

| Export | Notes |
|---|---|
| **Ekos .esl** | One job per transit; starts at a fixed time, finishes at a fixed time. Set the path of your `.esq` on the KStars computer. **Starter .esq**: one Light job with the advised exposure, dithering and refocusing off; open it in Ekos and save it again. |
| **NINA** | One file per night, from the built-in template or your own. NINA stores times without a date, so load the file after sunrise of that day. |
| **CSV / Calendar / Plan JSON** | All times included; the calendar uses UTC. |
| **Share link** | Copies a URL that restores the plan and selection in another browser. |
| **Printable summary** | Prints the table at the bottom of the page. |

See [export-formats.md](export-formats.md) for details and tested versions.

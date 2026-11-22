# User guide

TransitPlanner has two pages, and most of the time you only need the first one.

| Page | What it is |
|---|---|
| **Plan** | The night timeline. You read, adjust and export the plan here. |
| **Setup** | What the planner assumed (location, equipment, nights, filters, export settings). Each line opens a modal. |

All settings are saved in your browser, and every change recomputes the plan automatically.

## First start

On first start:

1. The browser asks for your location; allow it once. The time zone is detected from the coordinates.
2. The planner takes **tonight plus the next 2 nights** (3 in total), astronomical darkness and the Photometry defaults.
3. It computes every transit, **selects the best conflict-free plan automatically** and shows the Plan page.

If you decline the location request, the Setup page opens with the location modal. Enter latitude and longitude once and the plan appears.

## The Plan page

**Top bar**:

- **Mode**:
  - **Photometry** (science value, ExoClock priorities, full warnings);
  - **Showcase** (deep transits of bright stars for outreach).
- **Local / UTC**: the time zone used in the view.
- **Export** (see below).

**Settings strip**: Location · Equipment · Nights · Filters. Click any entry to open its modal; changes apply at once.

**The nights.** Each night is one plot:

- The big numeral is the date. Next to it: darkness from–to and Moon illumination.
- The thin strip above the rows shows twilight (lighter = brighter sky) and the Moon's altitude (dotted line).
- Every candidate transit is a hairline across the night that **dips** at its predicted transit. The dip depth shows the transit depth (logarithmic, so deep transits stand out).
  - **Bold white** = scheduled.
  - **Grey** = candidate.
  - **Grey dashed** = candidate that overlaps a scheduled transit (including the slew gap).
  - The short dotted lead-in before a scheduled transit is the slew, centering and autofocus time.
  - A **red tick** marks a meridian flip.
- Right column: ingress–egress times.

Working with the plot:

- **Click a line** (or its checkbox) to schedule or remove that transit. Anything that overlaps it leaves the plan automatically, and the rest of the plan is re-optimized around your choice.
- **Click a name** to see the transit in the data column on the right.
- **Reset to best plan** appears after manual changes and drops them.
- Up to 14 rows are shown per night. Use **Show all** when there are more.

**The left rail** lists the nights by day; click one to jump to it. The active night is boxed in red. At the bottom: Plan, Setup, Equipment Builder and red night mode.

**Data column** (right; below the plot on narrow screens) for the selected transit:

- schedule / remove button;
- observing window, ingress, mid and egress times;
- ephemeris uncertainty (±σ), depth, duration, magnitude, altitude, Moon, coverage, flip time, ExoClock priority and ephemeris source;
- warnings;
- the **predicted light curve**: trapezoid model; the shaded band is ±σ on mid-transit and the red line is the planned observing window;
- the **sky track**: polar alt-az plot with the zenith in the centre and the horizon on the ring. The transit part is bold, with ingress (filled dot) and egress (ring), and your local horizon is drawn if you entered one;
- **Sky view**: Aladin Lite DSS images with your camera's field of view. These are loaded from CDS only when you ask.

## Export

Click **Export** and choose a format; the file downloads at once.

| Format | Contents |
|---|---|
| Ekos / KStars `.esl` | One job per transit, starting at a fixed time and finishing at a fixed time |
| Ekos capture sequence `.esq` | A starter sequence with the advised exposure; dithering and refocus are off |
| N.I.N.A. `.json` | One file per night, built from the built-in template or your own. Load it after sunrise of that day, because NINA stores clock times without a date |
| Spreadsheet `.csv` | All times, UTC and local |
| Calendar `.ics` | One event per transit |
| Plan file `.json` | Every computed value |
| Copy share link | Restores this plan in another browser |
| Print summary | A printable table |

**Export settings** (at the bottom of the menu, or on the Setup page):

- the clock time zone of the telescope computer;
- KStars version, Ekos profile and `.esq` path;
- filter name, image directory and camera temperature for the starter sequence;
- the NINA template (built-in or uploaded);
- whether to set the exposure from the advice table.

The defaults work without changes.

Smart telescopes controlled by a vendor app (Seestar) cannot be driven by Ekos or NINA. Use Spreadsheet or Calendar for them.

## The modals

**Location**:

- "Use my location", or latitude, longitude, elevation and time zone;
- saved locations;
- **More → local horizon**: azimuth,altitude pairs (typed or imported from CSV) for trees and buildings.

**Equipment**:

- **Catalog**: presets, smart telescopes, or build a setup from telescope, camera, readout mode and mount;
- **My equipment**: your own entries, downloadable as JSON;
- **Import**: a JSON file, checked against the schema;
- **New**: the same form as the Equipment Builder.

Derived values (focal ratio, plate scale, field of view) are always computed from the sensor. **More** holds the mount type, meridian-flip offset, slew and centering time, autofocus time, and the exposure-advice table.

Without equipment, a generic German-equatorial setup is assumed.

**Nights**:

- first night (or "Tonight") and number of nights (1–14);
- darkness: −18°, −12° or −6°;
- a per-night list of dark windows and Moon illumination.

**Filters**:

- mode, magnitude range, depth, minimum altitude;
- coverage:
  - **Full**: transit plus both baselines;
  - **Transit**: complete transit;
  - **Partial**;
- meridian-flip policy:
  - **Avoid** drops transits with a flip;
  - **Flag** keeps them with a warning;
  - **Allow** ignores flips;
- sources (ExoClock, NASA, TESS candidates) and "only ExoClock targets that need observations".

**More filters**: duration, maximum airmass, Moon distance and illumination, uncertainty cap, partial share, baseline (fixed or × duration), widening by k·σ, and targets without published uncertainty.

**Reset to mode defaults** restores the current mode's defaults.

Above the plots, **Filtered out** counts the events each filter removed, so you can see what to loosen when a target is missing.

## Red night mode

The moon icon in the rail switches every colour to dim red for use at the telescope. The sun icon switches back.

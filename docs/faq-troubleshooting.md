# FAQ and troubleshooting

### My target is not in the list.

Look at **Not shown** above the results table. It counts every event dropped and why. The usual causes:

- **magnitude / depth / duration**: outside the filter ranges.
- **never above the minimum altitude**: the target's declination is too far south or north for your latitude and minimum altitude.
- **too low during the transit / coverage**: with Coverage = Full, the transit and both baselines must be observable. Try Coverage = Transit or a shorter baseline.
- **ephemeris uncertainty**: raise the cap, or allow targets without published uncertainty.
- **meridian flip**: flip policy Avoid drops transits with a flip during the planned interval. Use Flag to see them.
- **source disabled**: TOI candidates are off by default.

Also check that the planet is in the catalog: search on the NASA Exoplanet Archive and ExoClock. Planets without a published duration cannot be planned.

### The times differ from ETD / NASA Transit Service / ExoClock by a few minutes.

The likely causes, roughly in order:

1. **Different ephemerides.** TransitPlanner prefers ExoClock; NASA's composite table may use an older paper. Compare T0 and P in the detail view.
2. **Propagated uncertainty.** Look at ±σ. Old ephemerides can be off by more than σ, so check the current O−C on ExoClock or ETD.
3. **Time standard of the source.** A few NASA references give T0 in HJD or BJD_UTC instead of BJD_TDB, a difference of up to about 1 min.
4. **Time zone.** The table shows the zone (header switch Local/UTC). Exports state theirs.

TransitPlanner's own time conversion agrees with astropy to well under one second (see methodology §1).

### Ekos starts the job at the wrong hour.

The `.esl` holds local wall-clock times without an offset, as KStars writes them itself. KStars interprets them in the KStars computer's time zone. If that computer runs on UTC or another zone, choose that zone as **Clock time zone** in the export step and export again.

### NINA waits until tomorrow, or starts immediately.

NINA stores only the clock time, not the date:

- NINA 3.x treats times before today's sunrise as "tomorrow";
- a time that has already passed means "start now".

Load each night's file **on that day, after sunrise**, and make sure the NINA PC's time zone matches the **Clock time zone** used for the export.

### NINA shows "Unknown instruction".

Your template contains a plugin instruction whose plugin, or exact plugin build, is not installed. Use a core-only template, or install the plugin.

### The NINA export says my template has no "Wait for Time" or "Loop Until Time".

The exporter sets start and end times through these two items. Add **Wait for Time** (start) and a container with **Loop Until Time** (end) to the Deep Sky Object container of your template, then save it again.

### Can I use a Seestar?

Yes, for planning. Seestars are controlled by the ZWO app, so use the CSV or calendar export for target times. In Photometry mode the planner warns that a colour sensor on an alt-az mount is limited for science-grade photometry.

### The sky view stays black.

It needs network access to the CDS image servers or their mirrors. If the main CDS server is down, Aladin Lite switches to a mirror, which can take a few seconds. The rest of the app works offline once loaded.

### Where is my data stored? How do I reset?

Settings and "My equipment" are in `localStorage` (key `transit-planner:v1`); the catalog cache is in IndexedDB (`transit-planner`). Clear the site data in your browser to reset. Nothing is stored on a server.

### How fresh is the catalog?

The footer shows the snapshot date. The maintainers refresh it, daily once the GitHub Actions schedule is enabled. The app never contacts NASA or ExoClock directly.

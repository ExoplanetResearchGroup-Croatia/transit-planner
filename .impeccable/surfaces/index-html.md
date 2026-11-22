---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["builder.html"]
---

Scope: planner app (index.html: Plan page + Setup page) and builder.html. Visitor mode: Operate.

Audience/job: amateur transit observers planning at home on a laptop before the night; they want tonight's best plan computed automatically, adjust it on the timeline, and export to Ekos/NINA/CSV in one click.
Constraints: two pages only (Setup with modals; Plan = timeline workspace with selection and export). No separate results list. Auto-geolocation, auto-compute, auto-selected best schedule, auto-recompute on every setting change. Red night mode kept. All strings in src/strings.ts.

## Direction contract

THESIS: Each night is drawn as a pulsar plot: candidate transits as stacked white hairline light curves on matte black, each dipping at its predicted transit with a depth-scaled trapezoid, scheduled ones at double weight. It refuses the category default, a twilight-gradient Gantt with coloured bars.

OWN-WORLD: Matte black ground, plot-white hairline ink, three industrial greys. A five-block colour-code strip (grey, blue, yellow, red, white) carries state: red = scheduled / primary / active, yellow = warning, blue = info. A wide grotesk with tabular figures sets huge numeral headlines; labels are small tracked engraved caps. Hairline rules split the regions; buttons are hairline rectangles with a coloured end block.

STORY: The visitor opens the app and tonight-plus-three-nights is already computed for their position, with the best conflict-free set selected. They read the plot, toggle transits on it (conflicts resolve themselves), inspect one in the data column, and export with one click on a format.

FIRST VIEWPORT: Left: a narrow index rail of nights (day numerals; the active one boxed red) with Setup and night mode at the bottom. Top: brand caps with the code strip, then the settings strip (site, equipment, nights, mode; each opens its modal). Next, a huge numeral headline (scheduled count) with a sub-line, and the Export button with its red end block at the right. Centre: the first night's pulsar plot at full width (twilight steps and the Moon curve on a thin strip above the rows). Right: the transit data column for the selected transit (times, light curve, polar sky track, sky view, schedule toggle).

FORM: catalog challenger brand-identity-canon-saville-catalog-sleeve ("Pulsar Sleeve"), chosen by the user over the assigned Graphics Standards direction; seed:aab70221e8e88db3

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: click a hairline row's toggle square to schedule it; overlapping transits (including the slew gap) drop back to grey instantly, and the plot re-weights. Motion: 180 ms weight and opacity transitions on rows; no page-load choreography.
Unresolved: KStars/NINA real-program testing (product, not design).

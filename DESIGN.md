---
name: TransitPlanner
description: Exoplanet transit nights drawn as a pulsar plot, planned and exported in one sitting.
world: "brand-identity-canon-saville-catalog-sleeve"
colors:
  bg: "#0b0b0a"
  panel: "#10100f"
  panel-2: "#171716"
  line: "#262624"
  line-strong: "#43433f"
  fg: "#ecebe6"
  muted: "#9b9a94"
  faint: "#7d7c76"
  red: "#e8402c"
  yellow: "#e8b713"
  blue: "#2f5ed8"
  grey: "#6f6e69"
  plot-dim: "#2c2c29"
  plot-mid: "#85847e"
  sky-day: "#22221f"
  sky-civil: "#1a1a18"
  sky-nautical: "#141413"
  sky-astro: "#0f0f0e"
  sky-dark: "#0b0b0a"
  night-bg: "#000000"
  night-panel: "#060000"
  night-panel-2: "#0d0100"
  night-line: "#2a0703"
  night-line-strong: "#4c0f08"
  night-fg: "#d63a2b"
  night-muted: "#93281c"
  night-faint: "#6e1a10"
  night-red: "#ff3a28"
  night-yellow: "#b9341f"
  night-blue: "#7c1c12"
  night-grey: "#5e1a10"
  night-plot-dim: "#2c0703"
  night-plot-mid: "#7e2116"
  night-sky-day: "#1c0402"
  night-sky-civil: "#130201"
  night-sky-nautical: "#0c0100"
  night-sky-astro: "#060000"
  night-sky-dark: "#000000"
typography:
  display:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "96px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  headline-lg:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  title-sm:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  index:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.01em"
    fontFeature: "'tnum' 1"
    fontVariation: "'wdth' 125"
  body-lg:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.75px"
    fontWeight: 400
    lineHeight: 1.556
    fontVariation: "'wdth' 100"
  body-dense:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    fontVariation: "'wdth' 100"
  body:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "12.25px"
    fontWeight: 400
    lineHeight: 1.429
    fontVariation: "'wdth' 100"
  caption:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "'Archivo Variable', 'Archivo', ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.16em"
    fontVariation: "'wdth' 112"
rounded:
  none: "0px"
spacing:
  xs: "3.5px"
  sm: "7px"
  md: "10.5px"
  lg: "14px"
  xl: "17.5px"
  2xl: "21px"
  3xl: "28px"
  4xl: "35px"
  plot-row: "40px"
components:
  button-primary:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "35px"
  button-primary-hover:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
  button-end-block:
    backgroundColor: "{colors.red}"
    width: "14px"
  button-end-block-sm:
    backgroundColor: "{colors.red}"
    width: "10.5px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "35px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "35px"
  button-ghost-hover:
    textColor: "{colors.fg}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "35px"
  button-sm:
    padding: "0 10.5px"
    height: "28px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    size: "35px"
  icon-button-hover:
    textColor: "{colors.fg}"
  icon-button-active:
    textColor: "{colors.red}"
  rail-night:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.index}"
    rounded: "{rounded.none}"
    size: "38.5px"
  rail-night-active:
    textColor: "{colors.red}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0 10.5px"
    height: "35px"
  segmented-option:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px"
    height: "35px"
  segmented-option-selected:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
  check:
    backgroundColor: "transparent"
    rounded: "{rounded.none}"
    size: "14px"
  check-checked:
    backgroundColor: "{colors.red}"
  badge:
    textColor: "{colors.fg}"
    typography: "{typography.caption}"
  badge-square:
    rounded: "{rounded.none}"
    size: "7px"
  code-block:
    rounded: "{rounded.none}"
    width: "21px"
    height: "8.75px"
  code-block-sm:
    rounded: "{rounded.none}"
    width: "10.5px"
    height: "5.25px"
  code-block-off:
    backgroundColor: "{colors.line-strong}"
  meter-block:
    backgroundColor: "{colors.fg}"
    rounded: "{rounded.none}"
    width: "7px"
    height: "8.75px"
  meter-block-alert:
    backgroundColor: "{colors.red}"
  meter-block-off:
    backgroundColor: "{colors.line-strong}"
  settings-cell:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    padding: "10.5px 14px"
  settings-cell-hover:
    backgroundColor: "{colors.panel}"
  menu-item:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    typography: "{typography.body}"
    padding: "8.75px 14px"
  menu-item-highlighted:
    backgroundColor: "{colors.fg}"
    textColor: "{colors.bg}"
  tooltip:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "5.25px 8.75px"
  modal:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "17.5px"
    width: "620px"
  modal-wide:
    width: "960px"
  plot-row:
    height: "40px"
---

# Design System: TransitPlanner

## Overview

**Creative North Star: "Pulsar Sleeve"**

TransitPlanner draws each night the way a record sleeve once drew a pulsar. Every candidate transit is a hairline in plot white on matte black, stacked row on row, and each line dips at its predicted transit with a trapezoid whose depth follows the transit depth. Scheduled transits are drawn at double weight. Everything around that plot is the catalog identity that frames it: one wide grotesk, set huge for numerals and tiny in tracked caps for labels; hairline rules in place of panels; and a five-block colour code (grey, blue, yellow, red, white) that carries every state the planner has to show.

The density is that of an instrument used at a desk before the night. Screens are dark, quiet and numerical: times, depths, coordinates and counts in tabular figures, labels in engraved caps, and almost no colour. When colour appears it is a code. Red means scheduled, primary, active or failed. Yellow means warning. Blue means info or priority. Grey means neutral. White means plainly fine. Regions are separated by 1px rules. Nothing has a corner radius, a gradient or a filled card. Motion is limited to colour, stroke weight and opacity changes, and there is no load choreography.

The second theme is part of the system. Night mode remaps every colour token to dim reds on pure black so the screen can be read at the telescope without ruining dark adaptation. The world refuses the category default, a twilight-gradient Gantt chart with coloured bars. Twilight here is five stepped grey bands on a thin strip, and transits are curves.

**Key Characteristics:**
- Matte near-black ground with plot-white hairline ink and three industrial greys.
- A five-block colour code that is also the brand mark; colour only ever encodes state.
- One variable grotesk (Archivo) used at three widths: 125% for numerals, 112% for caps labels, 100% for body.
- Huge zero-padded numeral headlines beside small caps titles.
- 1px rules split regions; every corner is square.
- Buttons are hairline rectangles; a primary action carries a solid red block on its right edge.
- The pulsar plot is the signature view; its occlusion is the only depth in the system.
- A full red night theme reached through the same tokens.

## Colors

A black-and-grey print palette with four signal colours that each mean one thing.

### Primary
- **Signal Red** (`red`): the state colour for scheduled, primary, active and error. It fills the end block of primary buttons, the checked square, the 2px planned-interval bar under the light curve, the ingress and egress dots on the sky track and the meridian-flip tick on the plot. It outlines the active night numeral and the active rail icon button, underlines the focused transit name (2px), and colours error text and the danger button label. It is also the text caret colour.

### Secondary
- **Caution Yellow** (`yellow`): warnings only. The 7px badge square on warning badges, the warning triangle beside a transit name, the yellow block of the code strip, and inline warning text (vendor-app notices, geolocation failure, horizon parse errors).

### Tertiary
- **Code Blue** (`blue`): info and priority. It appears as a block, never as text: the blue block of the code strip in the brand lockup, and the blue block lit in the data column when a transit has alert or high priority. Its contrast on the ground (about 3.5:1) suits blocks, not type.

### Neutral
- **Sleeve Black** (`bg`): the ground of every page, the modal, the export menu and the plot. Dip trapezoids are filled with it to occlude the rows below. Text on inverted controls (selected segment, highlighted menu item, primary hover) takes this colour.
- **Press Black** (`panel`): the one-step-up tone for hover on settings-strip cells, tooltip fills and native select options.
- **Focus Band** (`panel-2`): the row band behind the focused transit on the plot, the ±σ band on the light curve and the horizon mask on the sky track.
- **Hairline Rule** (`line`): region dividers, row rules in the data column, the plot's hour grid, sky-track rings and spokes, menu separators.
- **Control Rule** (`line-strong`): the 1px border of inputs, secondary buttons, icon buttons, segmented controls, checks, modals, menus and tooltips; the unlit blocks of the code strip and meter; scrollbar thumbs; the decoration of underlined text links.
- **Plot White** (`fg`): primary text, scheduled plot traces, the light curve, the transit segment of the sky track, primary button borders, the fill of selected segments and highlighted menu items, the white block of the code strip, lit meter blocks, the 1px focus-visible outline and the text-selection fill.
- **Label Grey** (`muted`): caps labels, sub-lines, hint text, unselected segment labels, icon-button glyphs, the dotted Moon curve.
- **Axis Grey** (`faint`): hour ticks, axis numbers, placeholders, input units, unscheduled row times, footer text, the hover-reveal "Edit" cue.
- **Code Grey** (`grey`): the grey block of the code strip (lit when a transit is not scheduled), the neutral badge square and the horizon outline on the sky track.

### Plot and Sky
- **Baseline Ghost** (`plot-dim`): the full-width baseline under every plot row and the whole-night track on the sky track. Deliberately close to the ground (about 1.4:1); it is a guide, not data.
- **Candidate Trace** (`plot-mid`): the 1px trace of an unscheduled candidate, its legend glyph and the observing-window segment of the sky track.
- **Twilight Steps** (`sky-day`, `sky-civil`, `sky-nautical`, `sky-astro`, `sky-dark`): five stepped fills for the 30px sky strip above the plot rows, chosen by Sun altitude (above −0.833°, −6°, −12°, −18°, below). They step; they never blend.

### Night Theme
Setting `data-theme="night"` on the root remaps every token above to its `night-` counterpart: pure black ground (`night-bg`), Darkroom Red text (`night-fg`), and all greys and signals shifted into dim reds. Signal Red gets brighter at night (`night-red`) so scheduled state stays the most visible thing on the screen. The Aladin sky view canvas is pushed through a grayscale-sepia-hue filter to match. Print has its own override: white paper, near-black ink, grey rules, and interactive chrome hidden.

### Named Rules
**The Code Strip Rule.** Colour is a code, never decoration. Each of the five blocks (grey, blue, yellow, red, white) means one state; a coloured element that encodes no state does not ship.

**The Red Means Committed Rule.** Red marks only what is scheduled, primary, active or failed. If a red element can't be explained as one of those four, it's the wrong colour.

**The Token-Only Rule.** Components read colour only through the theme tokens (`bg`, `fg`, `line`, `red` and the rest, or `var(--c-*)` inside SVG). Night mode works by remapping the tokens, so a literal hex in a component skips the remap and stays bright at the telescope.

## Typography

**Display Font:** Archivo Variable at 125% width (with Archivo, ui-sans-serif, system-ui, sans-serif)
**Body Font:** Archivo Variable at 100% width
**Label Font:** Archivo Variable at 112% width, uppercase and tracked

**Character:** One variable grotesk does all the work. Pushed to its widest setting it gives the broad, flat numerals of a catalog sleeve; slightly widened and tracked it becomes the engraved caps of the labels; at normal width it is a plain, compact reading face.

The root size is 14px with a 1.45 line height. Rem-based sizes and spacing therefore render at 7/8 of their nominal Tailwind values; every value in this file is the rendered one.

### Hierarchy
- **Display** (500, 96px, 0.95): the lockup count of scheduled transits, zero-padded to two digits. One per page.
- **Headline Large** (500, 64px, 0.95): the Setup page title.
- **Headline** (500, 56px, 0.95): each night's day numeral on the plot, zero-padded; the Equipment Builder title.
- **Title** (500, 30px, 0.95): the selected transit's name at the top of the data column.
- **Title Small** (500, 21px, 0.95): modal titles.
- **Index** (500, 17px, 0.95): the night day numerals in the rail.
- **Body Large** (400, 15.75px, 1.556): the value line of each Setup index row.
- **Body Dense** (400, 13px, 1.45): transit names in the plot's label column and values in the data column.
- **Body** (400, 12.25px, 1.429): default interface text: input values, settings-strip values, menu items, sub-lines, intro paragraphs (capped at 60–62ch).
- **Caption** (400, 11px, 1.45): badge text, the plot legend, footer, chart hints, hour ticks and Moon percentage.
- **Label** (500, 11px, 0.16em tracking, uppercase, 1.3): field labels, section titles, button text, segmented options, night meta lines, tooltip text on icon buttons.

All display roles share −0.01em tracking and tabular figures. Plot row times use 12px tabular figures; chart axis labels inside SVG use 10px.

### Named Rules
**The One Family, Three Widths Rule.** Archivo Variable is the only typeface. Hierarchy comes from the width axis (125, 112, 100) and from size; no second face and no weight above 500.

**The Tabular Figures Rule.** Every number a user compares (times, coordinates, depths, counts, axis ticks, the lockup count) is set in tabular figures so columns and numerals never jitter.

**The Caps Unit Rule.** In a caps label, a trailing unit in parentheses keeps its own case and normal tracking, so µm never turns into ΜM.

## Layout

The planner is three columns at full width. A 76px rail sits on the left at full viewport height behind a right-hand hairline. The workspace takes the remaining width with 17.5px side padding (28px from 1024px up). A 380px data column sits on the right behind a left-hand hairline, sticky at full height with its own scroll. Below 1280px the data column drops beneath the workspace behind a top rule. Below 768px the rail becomes a sticky horizontal top bar with a bottom rule: logo, the night numerals in a row, then the icon buttons.

The workspace stacks from the top. First the brand lockup (caps name plus a small code strip) with the mode and time segmented controls on the right. Then the settings strip: one, two or four columns at the 640px and 1280px breakpoints, ruled above and below, cells divided by vertical hairlines. Then the 96px count lockup with its caps title, sub-line and legend, and the Export button aligned right. Then one pulsar plot per night, each opened by a top hairline.

Each night plot is a three-column grid: a label column of 132–210px, the plot at 1fr, and a 96px times column, with a 14px gap. The grid keeps a 720px minimum width and scrolls horizontally inside its section on narrow screens; the label column stays sticky on the left. Rows are 40px. The time axis runs from one hour before sunset to one hour after sunrise.

Setup is an index sheet capped at 1100px: a header with the code strip, the 64px title, a 60ch intro and the primary "View plan" button. Below it sit hairline-ruled rows on a 180px label / 1fr value / auto action grid with 17.5px vertical padding. The Equipment Builder caps at 1240px with a 1fr / 400px split, and its sections are opened by top rules. Modals are 620px (960px wide variant) and at most 88vh tall, with a scrolling body.

Spacing runs on a 3.5px unit. The common steps are 7px inside controls, 10.5–14px between related items, 17.5–21px between groups and 28–35px between page blocks.

### Named Rules
**The Hairline Region Rule.** Regions are divided by 1px rules, never by filled panels. A boundary is a line, not a surface.

## Elevation & Depth

The system is flat. Surfaces sit on the same black plane and are separated by rules. Tone carries the little layering there is: Press Black for hover on the settings strip, Focus Band behind the focused plot row. Modals sit over a black scrim at 70% opacity and carry only their Control Rule border. Real depth exists in one place: the pulsar plot draws its rows bottom-up and fills each dip with the ground colour, so a deep transit hides the hairlines beneath it, as in the original pulsar plot.

### Shadow Vocabulary
- **Menu float** (`box-shadow: 0 18px 40px rgba(0,0,0,0.55)`): the export dropdown, the one floating layer that opens over the dense plot. Not used on sections, modals or tooltips.

### Named Rules
**The Occlusion Is Depth Rule.** The only spatial layering in the system belongs to the plot: rows drawn bottom-up, each dip filled with the ground so it hides the rows below. Panels and sections never lift.

## Shapes

Every corner is square. Borders are 1px. The recurring shapes are solid rectangles: the end block on a button, the 7px badge square, the 14px check, the code-strip blocks, the meter blocks and the focus band. Circles appear only on the polar sky track: altitude rings, the zenith dot, and the ingress (filled) and egress (ring) markers. Plot traces are hairline polylines with round joins and non-scaling strokes, so they stay crisp however wide the plot is stretched. Icons are Lucide outlines at 1.5 stroke, sized 12–16px.

### Named Rules
**The Square Corner Rule.** Corner radius is 0px everywhere: controls, menus, modals, tooltips, blocks.

**The End Block Rule.** A coloured action is marked by a solid block on its right edge, never by a filled button. Primary buttons carry a red block (14px at 35px height, 10.5px at 28px); an active choice tile carries a 7px one.

## Components

### Buttons
Hairline rectangles that say what they do in engraved caps.
- **Shape:** square (0px), 1px border, 35px tall (28px small), 14px side padding (10.5px small). Icons sit left of the label at 13–14px.
- **Primary:** transparent with a Plot White border and label, plus a Signal Red end block on the right. Hover inverts: Plot White fill, Sleeve Black label, red block unchanged.
- **Secondary:** transparent, Control Rule border, Plot White label; hover moves the border to Plot White.
- **Ghost:** no visible border, Label Grey text; hover turns the text Plot White.
- **Danger:** Control Rule border with a Signal Red label; hover turns the border red.
- **Disabled:** 35% opacity, not-allowed cursor.
- **Motion:** 150ms colour transitions only.
- **Schedule toggle:** in the data column, the full-width action is primary with a red block while the transit is unscheduled and becomes secondary without a block once it is scheduled.

### Icon Buttons
- **Style:** 35px squares, Control Rule border, Label Grey 16px icon. Hover moves border and icon to Plot White. Active (current page, night mode on) turns both Signal Red.
- **Tooltip:** opens to the right after 200ms: Press Black fill, Control Rule border, caps text.

### Inputs / Fields
- **Style:** 35px tall, transparent, 1px Control Rule border, 10.5px side padding, 12.25px Plot White text, Axis Grey placeholder. Number inputs use tabular figures, hide spinners and show their unit in Axis Grey inside the right edge. Selects are native with a 14px chevron in Label Grey; textareas share the border and use tabular figures.
- **Hover / Focus:** hover shifts the border to Axis Grey; focus shifts it to Plot White with no outline or glow.
- **Disabled:** 40% opacity.
- **Field:** caps Label Grey label above the control with a 5.25px gap, an optional info icon whose tooltip carries the hint, and error text in Signal Red below.

### Segmented Controls
- **Style:** one Control Rule outline, options split by vertical hairlines, caps labels, 35px (28px small).
- **State:** the selected option inverts (Plot White fill, Sleeve Black text). Others are Label Grey and turn Plot White on hover. Used for mode, time display, darkness, coverage, flip policy and modal tabs.

### Checks
- **Style:** a 14px square with a Control Rule border and no glyph. Checked fills it solid Signal Red, border included. Hover moves the border to Plot White. 160ms ease-out transition.
- **Use:** the schedule toggle on every plot row, and every boolean in the modals.

### Badges
- **Style:** a 7px solid square followed by 11px Plot White text; no pill, no fill behind the text.
- **Tones:** grey (neutral), Plot White (ok), yellow (warning), red (bad, flips and partial coverage).

### Code Strip and Meter
- **Code strip:** five blocks in fixed order (grey, blue, yellow, red, white), 3.5px apart; 21×8.75px, or 10.5×5.25px small. Fully lit, it is the brand mark beside the app name and above the Setup title. In the data column it encodes the selected transit: red or grey for scheduled state, yellow when it has warnings, blue for alert or high priority; unlit blocks drop to Control Rule.
- **Meter:** ten 7×8.75px blocks, 3px apart, lit Plot White in proportion to the value (altitude, Moon illumination), lit red when the reading is an alert. Unlit blocks are Control Rule. Carries an accessible label.

### Containers
- **Corner Style:** square (0px).
- **Background:** none; containers are transparent on Sleeve Black.
- **Shadow Strategy:** none (see Elevation & Depth).
- **Border:** the common container is a hairline-ruled section: a top rule with 17.5–21px of space below it and a caps title. A boxed variant (1px Hairline Rule all round, 14px padding) holds the equipment summary and the hairline section primitive, which adds a ruled caps header row.
- **Choice tiles:** list choices (equipment presets, smart telescopes) are bordered rows that turn the border Plot White and show a 7px red end block when active.
- **Disclosure:** "more" sections open from a caps Label Grey toggle under a top rule; the chevron rotates 90° in 150ms.

### Settings Strip
- **Style:** four buttons in a ruled band, each a caps Label Grey label over a 12.25px Plot White value (truncated), 10.5px by 14px padding.
- **State:** hover fills the cell Press Black and reveals an "Edit" cue in Axis Grey at the label's right. Each cell opens its modal.

### Export Menu
- **Trigger:** the primary Export button with its red end block.
- **Panel:** 340px, Sleeve Black, Control Rule border, menu-float shadow. A caps Label Grey header gives the job and night counts. Each format item shows a 12.25px title, a smaller description at 60% opacity and a caps file extension at 70% opacity. Groups are split by 1px rules.
- **State:** the highlighted item inverts to a Plot White fill with Sleeve Black text. Disabled items drop to 35% opacity.

### Modal
- **Style:** centred, Sleeve Black, Control Rule border, square, over a 70% black scrim. The header holds a 21px wide-numeral title and a 31.5px square close button, ruled below. The body pads 17.5px and scrolls. The footer is ruled above and right-aligns a primary "Done".

### Navigation
- **Rail:** the logo at the top (the app mark: three stacked dipping hairlines, the middle one at double weight, with a small red block at the lower right, on Sleeve Black); the night numerals as 38.5px squares set in the 17px display width, with no border at rest, a Control Rule border on hover, and a Signal Red border and numeral for the active night; the Plan, Setup, Builder and night-mode icon buttons at the bottom. Clicking a numeral scrolls smoothly to that night.
- **Text links:** caps or body text underlined in Control Rule at a 3–4px offset; hover turns the underline (or the text) Plot White.

### Pulsar Plot (signature)
One night of candidate transits as stacked hairline light curves.
- **Header:** a 56px zero-padded day numeral; caps lines for weekday and month (Plot White) and dark window plus Moon illumination (Label Grey); shared warnings as yellow badges; "n of m scheduled" and a show-all link at the right. The first 14 rows (scheduled plus highest score) show by default.
- **Sky strip:** a 30px band above the rows filled with the five Twilight Steps by Sun altitude, the Moon's altitude as a dotted 1px Label Grey curve (1 on, 3 off), and its illumination in 11px Axis Grey at the right. Hour ticks every two hours sit above it in 11px Axis Grey.
- **Rows:** 40px each, baseline 12px from the row top, a full-width Baseline Ghost line under every row, and hourly verticals in Hairline Rule behind them.
- **Dip:** the observing window is a single polyline along the baseline that drops into a trapezoid between ingress and egress. Depth in pixels is `6 + 40 × min(1, log10(1 + ppt) / log10(31))`, so 6px is the floor and 46px is reached at 30 ppt. The ingress and egress slopes take `(egress − ingress) × k / (1 + k)` with `k = √(depth)`. Each trapezoid is filled with Sleeve Black, so deep dips fall across and hide the rows below.
- **Weight:** a candidate is a 1px Candidate Trace; a scheduled transit is a 2.25px Plot White trace. A candidate that conflicts with a scheduled one (including the slew gap) is dashed 4 on, 3 off.
- **Slew lead-in:** a scheduled row draws a dashed 1px Plot White line (2 on, 3 off) along the baseline for the slew gap before the window opens.
- **Meridian flip:** a 2px Signal Red vertical tick, 12px tall, centred on the baseline.
- **Focus:** the focused row gets a Focus Band fill across the plot, and its name is underlined in 2px Signal Red at a 4px offset.
- **Label column:** a check, the 13px name (Plot White when scheduled, Label Grey otherwise), and a 12px yellow warning triangle when that transit has its own warnings. **Times column:** 12px tabular ingress–egress, Plot White when scheduled, Axis Grey otherwise.
- **Interaction:** clicking a check or a trace toggles scheduling; clicking a name focuses it in the data column.
- **Motion:** traces transition stroke width, colour and opacity over 180ms ease-out, so the plot re-weights when a conflict resolves. Reduced motion sets every transition to 0ms.

### Light Curve and Sky Track
- **Light curve:** a trapezoid model in a 340×132 frame. The ±σ band on mid-transit is a Focus Band fill. The baseline is a Hairline Rule line, the depth level a dashed (2/3) rule. A 2px Signal Red bar under the curve marks the planned interval, and the curve itself is a 1.5px Plot White line. Flux labels are 10px Axis Grey and time labels 10px Label Grey, all tabular.
- **Sky track:** a polar alt-az plot, north up and east left. Rings at 0°, 30° and 60° (the horizon ring in Control Rule, the others in Hairline Rule) and 12 spokes; the local horizon mask as a Focus Band fill with a 0.75px Code Grey edge; N/E/S/W in the caps label style. The night track is Baseline Ghost at 1px, the observing window Candidate Trace at 1.25px, and the transit Plot White at 2.5px with round caps. Ingress is a filled red dot, egress a red ring.

### Count Lockup
The 96px count of scheduled transits sits beside a caps Plot White title, a 12.25px Label Grey sub-line (first ingress, candidate count) and an 11px legend that draws the plot's own marks (a 2px trapezoid for scheduled, a 1px one for a candidate, a red tick for a flip). A caps "reset to best plan" link appears only after manual changes.

## Do's and Don'ts

### Do:
- **Do** separate regions with 1px rules: Hairline Rule (#262624) for dividers, Control Rule (#43433f) for control borders.
- **Do** use colour only as the code: red for scheduled, primary, active or error; yellow for warning; blue for info or priority; grey for neutral; Plot White for ok.
- **Do** set counts and dates as huge zero-padded numerals at 125% width, weight 500, tabular figures, and pair them with an 11px caps title.
- **Do** set every label, button and section title in 11px caps at 112% width with 0.16em tracking.
- **Do** mark the primary action with a red end block on the button's right edge, and invert (Plot White fill, Sleeve Black text) for hover, selection and highlighted menu items.
- **Do** draw new plot marks in the plot's grammar: 1px Candidate Trace for candidates, 2.25px Plot White for scheduled, dashes (4 on, 3 off) for conflicts, a 2px red tick for flips, non-scaling strokes.
- **Do** read every colour through the theme tokens so night mode and print keep working.
- **Do** keep motion to 150ms colour changes on controls and 180ms weight and opacity changes on plot traces, and honour reduced motion.
- **Do** use Lucide outline icons at 1.5 stroke, 12–16px.

### Don't:
- **Don't** draw the night as a twilight-gradient Gantt chart with coloured bars; transits are hairline curves, and twilight is five stepped bands.
- **Don't** use gradients anywhere, including the sky strip.
- **Don't** round a corner, fill a card or lift a section with a shadow; the export menu's float shadow is the only shadow.
- **Don't** add a second typeface or a weight above 500; vary width and size instead.
- **Don't** use colour decoratively, or use red for anything that isn't scheduled, primary, active or failed.
- **Don't** put a literal hex value in a component; it escapes the night remap.
- **Don't** set Code Blue as text; it is a block colour.
- **Don't** add page-load choreography or entrance animations.

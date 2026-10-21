---
name: Cipressina Barche
description: A boat seen from the side. Gelcoat white above the waterline, the antifouling coat below, the green-and-blue boot stripe at the line.
colors:
  gelcoat: "#f4f6f5"
  hull-navy: "#0d1a4a"
  hull-navy-soft: "#3d4a6e"
  rule: "#d3d9e3"
  boot-green: "#009642"
  boot-green-ink: "#007a36"
  pinstripe-blue: "#2742d6"
  antifouling: "#14305e"
  antifouling-ink: "#eef1f7"
  antifouling-muted: "rgb(238 241 247 / .8)"
  antifouling-rule: "rgb(238 241 247 / .22)"
  panel: "#e9edf0"
  navy-wash: "#e4e9f2"
  input-border: "#7d869c"
  white: "#ffffff"
  error: "#b3261e"
  placeholder-bg: "#fff2cc"
  placeholder-ink: "#5c3b00"
  placeholder-line: "#c47f00"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, min(13vw, 11.5svh), 8.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 125"
  page-title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5.6vw, 4.6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.035em"
    fontVariation: "\"wdth\" 125"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4.4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.04
    letterSpacing: "-0.02em"
    fontVariation: "\"wdth\" 118"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
    fontVariation: "\"wdth\" 108"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
    fontVariation: "\"wdth\" 100"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.15
    fontVariation: "\"wdth\" 112"
  price:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 800
    lineHeight: 1.05
    fontFeature: "\"tnum\""
    fontVariation: "\"wdth\" 70"
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 800
    lineHeight: 1
    fontVariation: "\"wdth\" 62"
rounded:
  none: "0"
spacing:
  gutter: "16px"
  gutter-wide: "clamp(24px, 4vw, 56px)"
  section: "clamp(72px, 10vw, 132px)"
  stripe: "19px"
  max: "1320px"
  header: "64px"
  header-wide: "72px"
components:
  button-primary:
    backgroundColor: "{colors.hull-navy}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.boot-green-ink}"
    textColor: "{colors.white}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.hull-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 22px"
    height: "48px"
  button-outline-hover:
    backgroundColor: "{colors.hull-navy}"
    textColor: "{colors.white}"
  button-coat:
    backgroundColor: "{colors.antifouling-ink}"
    textColor: "{colors.antifouling}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    height: "48px"
  choice-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.hull-navy}"
    rounded: "{rounded.none}"
    padding: "12px 10px"
    height: "48px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.hull-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
    height: "48px"
  page-band:
    backgroundColor: "{colors.gelcoat}"
    textColor: "{colors.hull-navy}"
    typography: "{typography.page-title}"
---

# Design System: Cipressina Barche

## Overview

**Creative North Star: "Giro della barca"**

Every page is a boat seen from the side. The gelcoat-white page sits above the waterline. The boot stripe (a thin blue pinstripe over a wide logo-green band) marks the line, and below it is the antifouling coat: a dark, saturated field that carries the lead copy, the rates, the FAQ, the contacts and the footer.

The look is a shipyard, not a brochure. It uses one variable family (Archivo) stretched wide for headings and squeezed narrow for prices and counts. Corners are square, borders are hairlines and 2px rules, and the surfaces are flat. Photos of real boats in the workshop carry the trust. Content sits on ruled lists (rate books, specs, awards), not on cards.

**Key Characteristics:**
- Two zones per page: gelcoat above the stripe, coat below it.
- The boot stripe is the one recurring graphic device, and it always means "the waterline".
- Archivo's width axis does the hierarchy work: wide for words, narrow for numbers.
- Square corners everywhere (0).
- Motion is one gesture: the stripe draws across when the page loads.

## Colors

The palette is hull paint: an off-white gelcoat, a deep hull navy for ink, the logo green and a strong blue for the stripe, and one swappable coat.

### Primary
- **Hull Navy** (hull-navy): the ink on gelcoat, the primary button fill, 2px top rules on ruled lists and fieldsets, the selected-card border.
- **Boot Green** (boot-green): the logo green. Used for the wide band of the boot stripe, the focus ring, selection, nav underline on hover/current, and done steps in the wizard progress. Never used as text.
- **Boot Green Ink** (boot-green-ink): green that passes as text on gelcoat (5.3:1). Used for button hover fills and live estimates ("Sulla tua barca").

### Secondary
- **Pinstripe Blue** (pinstripe-blue): only the thin top line of the boot stripe. It never appears as a fill or as text.

### Tertiary
- **Antifouling** (antifouling): the default coat, Veneziani dark blue. It is a variable (`--af`, with `--af-ink`, `--af-muted`, `--af-rule`) so the coat can be retuned in one place. The home page has no colour picker: the user found it pointless (2026-10-21). The wizard keeps its optional antifouling swatches at step 3, which are part of the request.
- **Coat Ink / Muted / Rule** (antifouling-ink, antifouling-muted, antifouling-rule): text, secondary text and hairlines on the coat. They flip to navy when a light coat is chosen. Anything on the coat must use these, never fixed colours.

### Neutral
- **Gelcoat** (gelcoat): the page above the line, the header, the sticky wizard bars.
- **Hull Navy Soft** (hull-navy-soft): secondary text on gelcoat (8.4:1).
- **Rule** (rule): 1px hairlines on gelcoat.
- **White** (white): inputs, choice cards and the 3D viewer, so the things you touch sit slightly brighter than the page.
- **Panel / Navy Wash** (panel, navy-wash): quiet fills for input affixes, disabled selects and soft hover.
- **Input Border** (input-border): the 1px border of inputs and choice cards (3.4:1 on white).
- **Error** (error): field errors and invalid borders.
- **Placeholder trio** (placeholder-bg, placeholder-ink, placeholder-line): the yellow marked-placeholder highlight with a dashed underline, used for every unconfirmed price or fact and for the draft ribbon.

### Named Rules
**The Waterline Rule.** Gelcoat is above the stripe and the coat is below it. A section never puts the coat above a stripe or gelcoat under one on the home page.

**The Coat Rule.** Anything on the coat reads its colours from the coat variables, never from hard-coded white or navy.

**The Marked Placeholder Rule.** An unconfirmed price or fact is shown in the placeholder highlight. It is never styled to look confirmed.

## Typography

**Display Font:** Archivo variable (wdth 62–125, wght 400–900), from Google Fonts, falling back to system-ui
**Body Font:** the same family at wdth 100

**Character:** one industrial grotesque used at different widths. Expanded headings read like a name painted along a hull. Condensed numerals read like a rate card.

### Hierarchy
- **Display** (display): the hero news only, set on the stripe, max 13ch.
- **Page title** (page-title): the title in the page head band on the wizard, the lookup and the staff panel.
- **Headline** (headline): section h2. The about headline goes larger (up to 5.4rem, wdth 125).
- **Title** (title): h3 and card names, wdth 108–118. Tour step titles grow to clamp(1.8rem, 3.4vw, 2.8rem).
- **Body** (body): copy, max 64ch, `text-wrap: pretty`. Lede 1.125rem, notes .95rem.
- **Label** (label): buttons, nav (600, wdth 108), field labels (700). Sentence case.
- **Price** (price): rate-book and tour figures, wdth 70, tabular. The wizard total goes to 2rem.
- **Numeral** (numeral): step counters, equipment counts and the tracking code, wdth 62.

### Named Rules
**The Width Axis Rule.** Words go wide (wdth 104–125). Numbers go narrow (wdth 62–70) and tabular. Body copy stays at 100.

**The Sentence Case Rule.** Labels, buttons and headings are never set in all caps. Only the language codes (IT, EN, ES, FR) are uppercase.

## Layout

- Container: max 1320px, centred, gutter 16px on phones and clamp(24px, 4vw, 56px) from 768px. The header is sticky and opaque, 64px tall (72px from 1100px). Full nav shows from 1100px, a menu panel below that.
- Hero: fills the first screen (100svh minus the header). The news headline sits at the bottom of the gelcoat and rests on a full-width 19px stripe. Under the stripe, on the coat, there is one line on what they do and two buttons.
- Tour: a two-column grid (1.35fr / 1fr). The 3D cabin cruiser is pinned (sticky, full viewport height) on the left with its length slider on a coat strip under its own stripe. Zone steps scroll on the right, each about 78svh tall, dimmed to .75 opacity until it is current (kept readable, about 4.5:1). Under 900px the viewer pins at 34svh above the steps.
- Sections: vertical padding clamp(72px, 10vw, 132px). The section head is two columns (title / note) aligned to the bottom. Gallery photos run sideways in a snap-scrolling "yard" row. The later sections (rates, FAQ, contacts, footer) are on the coat.
- Wizard and lookup: a page head band, then content up to 800px (900px for step 2, full width for the 3D step). A sticky progress bar sits on top and a sticky footer holds Back and Next. The 3D step puts the viewer on white with the summary on the coat beside it (from 960px).
- Two-column layouts collapse to one at 900px.

## Elevation & Depth

Flat. Depth comes from the waterline split (gelcoat against coat), 2px navy top rules and 1px hairlines. The only shadow is the floating WhatsApp button (`0 6px 20px rgb(0 0 0 / .25)`), which really does float over the page. Selection uses inset 1px rings, not lift.

**The Flat Hull Rule.** Surfaces don't cast shadows. Hierarchy comes from rules, colour fields and width.

## Shapes

Square corners throughout (0), including buttons, inputs, cards, swatches, dialogs and the menu toggle. The only round things are functional: the radio dot in the package choice and the PIN dots. Lists are ruled: a 2px top rule in the ink colour, then 1px hairlines between rows. Photos are cropped to fixed ratios (4:3 yard, 21:9 crew, 3:4 minis) with no frames.

## Components

### Buttons
Solid, square, confident.
- **Primary:** navy fill, white label, 2px navy border, 48px tall (42px in the header).
- **Hover:** fills Boot Green Ink. Colour transitions last .2s.
- **Outline / ghost:** transparent with a navy border and navy text, fills navy on hover.
- **On the coat:** coat-ink fill with coat-coloured text. The ghost version is transparent with coat-ink text.
- **Focus:** a 3px Boot Green outline at 3px offset, site-wide.

### Choice cards
White square tiles with a 1px input border, used for boat type, registration, berth, units and packages. Hover darkens the border to navy. **Selected:** navy border plus an inset 1px navy ring, and a 7px mini boot stripe (2px blue, 1px gap, green) along the bottom edge. The stripe under the chosen card is the selection signal.

### Rate books
Definition lists with the name on the left and the price on the right, set in the price style. There is a 2px top rule in the ink colour, a hairline under each row, and an optional small note spanning the row. On gelcoat (tour steps) the live estimate row is in Boot Green Ink. On the coat (rates section) it uses the coat ink and rules. Packages use the same ruled stack.

### Inputs / Fields
- **Style:** white, 1px input border, square, 48px tall. Selects use the navy caret.
- **Focus:** navy border, inset 1px navy ring and a 3px green halo (`rgb(0 150 66 / .35)`).
- **Error:** red border, a bold red message under the field.
- **Fieldsets:** a 2px navy top rule with the legend in bold expanded type.

### Navigation
Header links are 600 weight at wdth 108, with a 2px Boot Green underline on hover and on the current page. The menu panel lists 52px-tall rows with hairlines between them. The language switch shows codes in the header and flags with full names in the panel.

### Page head band
The title of a page sits on the waterline: page-title type on gelcoat with a full-width 19px boot stripe along the bottom edge. The wizard success view opens with the same stripe.

### Antifouling swatches (wizard step 3 only)
Square 36px chips filled with real antifouling colours; the chosen one gets a 3px navy outline.

### Motion
One signature move. On load the hero stripe draws from left to right (scaleX 0 to 1, 1.1s, `cubic-bezier(.65, 0, .35, 1)`, .15s delay). Everything else is a short state transition (.2s colour, .4s step opacity). With `prefers-reduced-motion: reduce`, the stripe doesn't animate, transitions are cut to almost zero and smooth scroll is off.

### Staff panel (Operate)
The workshop panel (pgs/officina.html, staff.css) uses the same tokens, type and square corners but works as a tool. The band is shorter (28px top) with a smaller title (clamp(1.6rem, 4vw, 2.4rem)), h2 is clamp(1.35rem, 2.4vw, 1.8rem) and h3 is 1.1rem. There is no coat and no motion. Targets are big (44–64px) because it is used standing up at the shop computer or a tablet. Content sits in white bordered cards and lists on gelcoat.

## Do's and Don'ts

### Do:
- **Do** put every new page's title on a band with the boot stripe under it.
- **Do** read coat colours from the coat variables in anything placed below the line.
- **Do** set prices and counts condensed (wdth 62–70) and tabular, and headings expanded (wdth 108–125).
- **Do** use ruled lists (2px ink top rule, 1px hairlines) for rates, specs and facts.
- **Do** mark every unconfirmed price or fact with the placeholder highlight.
- **Do** use real workshop and boat photos from `img/` for imagery.

### Don't:
- **Don't** round corners, add card shadows or use gradients other than the boot stripe.
- **Don't** use the boot stripe as decoration: it always marks the waterline (page head, hero, the tour control strip, the selected card).
- **Don't** set labels, buttons or headings in all caps, or add small labels above headings.
- **Don't** add a second animated signature. The stripe draw is the only one.
- **Don't** change the logo or its blue and green. They stay as supplied.
- **Don't** invent facts for the design to carry: no founding date other than the 1978 Registro Imprese line, no counts of boats served, reviews, testimonials, certifications, response times or warranty terms (see PRODUCT.md).

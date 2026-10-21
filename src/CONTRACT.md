# DOM contract: what a page must produce for `src/app.js`

The site is two pages that share one script set: `index.html` (front page, only `#view-home`) and `pgs/preventivo.html` (`#view-wizard` and `#view-lookup`, the lookup at `preventivo.html#stato`). Markup, CSS (`styles.css`) and page copy/theme (`src/site.js`) are the pages' own; all behaviour lives in `src/*.js`. The archived single-page draft `design/sketches/c-laguna.html` (and the other sketches) have all three views in one page and still work. The views each page contains are the only ones the router uses. This file is the whole interface between the two sides. `design/sketches/reference.html` is a complete, unstyled page that follows it and is tested; copy from it.

Words: **R** = required (the logic breaks or degrades without it), **O** = optional (used when present, silently skipped otherwise). "App writes" means JS sets it and the skin only styles it.

## 0. Load order and page shell

```html
<!-- inside <head>, before the content: the import map from brief.md (R) -->
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
<!-- at the end of <body>, in this order (R); paths shown for index.html, pgs/ uses ../src/ -->
<script src="src/site.js?v=2026-10-19a" defer></script>   <!-- optional plain data: copy and 3D theme, see below -->
<script src="src/zones.js?v=2026-10-19a" defer></script>
<script src="src/i18n.js?v=2026-10-19a" defer></script>
<script src="src/app.js?v=2026-10-19a" defer></script>
```

- `boat3d.js` is imported by `app.js` (dynamic `import()`, absolute URL derived from `app.js`'s own `src`, so it resolves to `src/boat3d.js`; the models are `../models/<type>.glb` relative to that; an external classic script's `import()` is relative to the script, not the document). Override: `window.CIPRESSINA_BOAT3D_URL`.
- **Asset version.** Every `src/*.js` and `styles.css` tag carries the same `?v=<version>`; change it in both pages on every release that touches them or the models. `app.js` passes its own `v` to the `boat3d.js` import and `boat3d.js` to the `.glb` URLs. Without it a browser can keep an old `boat3d.js` (imported only when the 3D step opens, so not even a hard reload refreshes it) next to a new `app.js`: «Unknown boat type».
- The page must be served over http(s): ES modules do not load from `file://`.
- `CIPRESSINA_CONFIG.theme` / `heroTheme` are passed to `mountBoat3D({theme})` for the wizard viewer and the hero. `heroTheme.bottom` also sets the colour of the «Originale» swatch. (O)
- `CIPRESSINA_CONFIG.heroSpinPitch` (number, degrees, optional) is passed to the hero's `mountBoat3D({spinPitch})`: the camera pitch of the turntable. Positive looks down from above (default 14); negative puts the camera below the waterline looking slightly up, which shows the bottom (opera viva) together with the topsides, like a boat on a cradle seen from the ground. The hero has no water, so use about `-10` to preview antifouling colours. Clamped to -30..60. With `prefers-reduced-motion` the static picture uses the same pitch when it is set. (O)
- `src/site.js` sets `window.CIPRESSINA_I18N_EXTRA = { it: {…}, en: {…}, es: {…}, fr: {…} }` and `window.CIPRESSINA_CONFIG = { theme: { water, select, hover, topsides, bottom, deck }, heroTheme: { … }, heroSpinPitch: -10, shopMaxLoa: 8 }` (`shopMaxLoa` optional, see `serviceSite`); both pages load it. The language choice is stored in `localStorage` (`cipressina.lang`, same origin), so it carries across the two pages.
- Home copy: either `CIPRESSINA_I18N_EXTRA` before the scripts or `CIPRESSINA_I18N.extend({it:{…},…})` any time after `i18n.js`. Both apply immediately.
- The page is complete without JS (on the single-page sketch: home view visible, wizard and lookup `hidden`). The reference default for the price sentence is the true result of the default selection.

## 1. Global rules

### Required CSS (functional, not decorative)
```css
[hidden]            { display: none !important; }   /* author display:flex etc. would otherwise defeat the attribute */
#boatOverlay.hidden { display: none; }              /* boat3d.js toggles the CLASS "hidden" on the overlay */
.sr-only            { /* visually hidden, still read */ }
#heroBoat, #boatCanvasWrap { position: relative; /* and a real height/aspect-ratio: the canvas follows its size */ }
#heroBoat canvas, #boatCanvasWrap canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#heroBoat.is-3d .hero-poster { /* hide or crossfade the SVG poster once 3D is up */ }
#navPanel { /* closed by default; shown when .is-open */ }
```
Also keep: visible `:focus-visible` rings, inputs ≥ 16px, `[aria-disabled="true"]` on `#stepNext` styled as inactive but **still clickable** (it must not be `disabled`), `scroll-margin-top` / `scroll-padding-top` for the sticky header and the sticky progress bar.

### State hooks (App writes; skins style)
| Hook | Where | Meaning |
|---|---|---|
| `body.is-home` / `.is-wizard` / `.is-lookup` | `<body>` | current view. e.g. `body.is-wizard #waFab { display:none }` hides the FAB on the wizard (success included) |
| `body[data-route]` = `home` \| `wizard` \| `lookup` | `<body>` | same, as an attribute |
| `body[data-step]` = `1`..`4` \| `success` | `<body>`, wizard only | e.g. widen the card on steps 2–3 (`body[data-step="3"]`) |
| `.is-active` | hero swatches, language buttons, `.step`, `[data-view]` buttons (boat3d) | selected / current |
| `.is-selected` | boat-type, registered, berthKind and tier radios | selected |
| `.is-current` / `.is-done` + `aria-current="step"` | `#wizProgress li` | progress state |
| `.is-invalid` | `.field` wrapper | field has an error |
| `[aria-invalid="true"]` | the control (or the radiogroup) | field has an error |
| `.is-open` + `aria-expanded` | `#menuToggle`, `#navPanel` | mobile menu open |
| `.is-copied` | `[data-copy]` button | «Copiato!» for 2 s |
| `.is-3d` / `.is-fallback` | `#heroBoat` | 3D mounted / import or WebGL failed (SVG poster stays) |
| `[hidden]` | anything | JS shows and hides with the attribute |
| `[aria-checked]`, `[aria-pressed]` | radios / view buttons | a11y state, also stylable |
| `[data-status="…"]` | `#resultStatus` | lookup status id |

### Placeholders
`<span class="ph">…</span>` marks anything unconfirmed. Each skin styles `.ph` (dashed amber outline) in its own palette. JS never creates `.ph` itself. Strings with a `.ph` come from the keys ending in `.h` (trusted HTML), used with `data-i18n-html`.

### i18n attributes
- `data-i18n="key"` sets `textContent`. Put it on a leaf element (the contents are replaced).
- `data-i18n-html="key.h"` sets `innerHTML` (only the shared `.h` keys, which contain `<span class="ph">`).
- `data-i18n-attr="aria-label:key;placeholder:key2"` sets attributes.
- `data-i18n-params='{"n":4}'` optional parameters for the three above.
- **Do not** put `data-i18n` on elements whose text `app.js` manages: `#stepNext`, `#menuToggle`, `#zonesCount`, `#estimate *`, `#qlWord`, `[data-tier-from]`, `#heroSwatchName`, `#modelSource`, `#modelAutofill`, `#antifoulingName`, `#zonesList` rows, `#successCode`, `#result*`, `#lookupError`, `.field__error`, `#stepHint`, `[data-progress-sr]`, `#boatError`.
- Shared keys: see `src/i18n.js` (nav, buttons, wizard, fields, errors, tiers, viewer, summary, price sentence, success, lookup, statuses, contact labels, FAQ questions + `faq.a.h`, boat types `type.<id>`, swatches `sw.<id>`, ribbon, footer `foot.vat`). Page copy goes under the page's own key prefix.

## 2. Chrome (every view)

| Element | Id / attribute | R/O | Notes |
|---|---|---|---|
| Skip link | `<a class="skip-link" href="#contenuto" data-skip data-i18n="skip">` | R | `data-skip` stops the router from treating `#contenuto` as a home anchor |
| Content target | `#contenuto` with `tabindex="-1"` | R | wraps the three views |
| Draft ribbon | `#draftRibbon` `data-i18n="ribbon"` | R | on every view: put it outside the views, in the shell |
| Header | `#siteHeader` | O | sticky. `top: env(safe-area-inset-top, 0px)` |
| Logo link | `href="index.html"` on the home page, `href="../index.html"` on `pgs/preventivo.html`; `data-i18n-attr="aria-label:nav.home"` | R | |
| Nav links | `<a href="#giro">`, `#galleria`, `#servizi`, `#chi-siamo`, `#interventi`, `#contatti` on the home page; `../index.html#giro` … on `pgs/preventivo.html` | R | ids are plain `[A-Za-z0-9-]` |
| CTA | `<a data-i18n="nav.quote">` | R | On `index.html`: `pgs/preventivo.html` (tiers add `?pacchetto=<tier>`). On `pgs/preventivo.html`: `href="#"`, which returns to the last wizard step (e.g. from `#stato`). In the single-page sketch: `#preventivo` |
| Language switcher | `<button type="button" data-lang="it|en|es|fr" lang="…" aria-label="Italiano" aria-pressed>` ×4 inside a `role="group"` labelled `lang.label` | R | repeatable (header and menu panel); App writes `.is-active` and `aria-pressed`. A `<select data-lang-select>` also works |
| Menu toggle | `button#menuToggle` (`aria-controls="navPanel"`, `aria-expanded`) | R | App writes `aria-label` («Apri/Chiudi il menu»), `.is-open`; give it an icon through CSS |
| Menu panel | `#navPanel` (links as above, may repeat the language switcher) | R | closes on link click, outside click, Escape (focus returns to the toggle) |
| FAB | `<a id="waFab" href="https://wa.me/393391810099?text=…" target="_blank" data-i18n-attr="aria-label:fab.label">` on both pages | R | The client's WhatsApp number and pre-filled message, from the Click to Chat button on carrozzeriacipressina.it, which it also copies in look (style 8). Hide it with `body.is-wizard #waFab` |
| Footer year | `#footYear` | O | App writes the current year (put the current year as the static fallback) |
| Copy buttons | `<span id="x">text</span><button type="button" data-copy="#x" data-i18n="btn.copy">` | R for phone, email, address | copies that element's text, on failure selects it; the text must be visible and selectable |

## 3. Views

Up to three containers, switched with `hidden` by the router (a page contains only its own: home on `index.html`, wizard and lookup on `preventivo.html`): `#view-home` (visible by default), `#view-wizard` (`hidden`), `#view-lookup` (`hidden`). Each contains an `<h1>`, which receives focus (`tabindex="-1"`) when the view opens (not on first load). In the wizard the focus goes to the `<h1>` of the current step (or the success panel).

Router, with `#view-home` present: `#preventivo` → wizard (single-page sketch only), `#stato` → lookup, `""` → home, any other plain hash → home then scroll to that id. Without `#view-home` (`preventivo.html`): `#stato` → lookup, anything else → wizard (the step from `history.state`, else the last step shown). On `index.html` (no wizard) an old `#preventivo` / `#stato` link is redirected to `pgs/preventivo.html`. The step is in `history.state`, not in the URL; the wizard URL is the plain page URL (`location.pathname`).

Hand-over from the home page: `pgs/preventivo.html?pacchetto=<tier>&loa=<m>`. The wizard page reads both once at load (tier must be in `Z.PACKAGE_CHOICES`, i.e. a package or `nessuno`; length in metres within 2.5..30), shows the length in the current unit, applies them to step 1/2 and removes the query with `history.replaceState`.

### 3.1 Home

The 3D hero and its swatches are optional (O). `index.html` has no `#heroBoat`, so App skips the hero. Since 2026-10-21 (the «Giro della barca» look) the home page has no price sentence either: its 3D is the tour in `#giro`, run by `src/tour.js` (loaded as a module after `app.js`, so `index.html` loads the importmap again). The tour is the page's own and needs from App only `CIPRESSINA_ZONES` (`price`, `typicalBeam`, `formatEUR`, `SWATCHES`) and `CIPRESSINA_I18N` (`t`, the `cipressina:lang` event). Its hooks: `#tourViewer` > `#tourCanvas`, `#tourMsg` > `#tourLoading` + `#tourErr`, `#tourNow`, `#tourLoa` + `#tourLoaOut`, `#tourChips` (empty; filled from `Z.SWATCHES` minus «Originale»), `#tourQuote` (gets `?loa=`), and `.steps-tour li[data-view][data-zones][data-name]` with `output[data-est="<zone ids>"]`. The coat colour is written to `--af`, `--af-ink`, `--af-muted`, `--af-rule` on `:root`. The design sketches still use the hero.

| Element | Id / attribute | R/O |
|---|---|---|
| Hero boat host | `#heroBoat` with `data-boat-type="cabinato"` (any boat type) | O (R for a 3D hero) |
| …inside it, SVG poster | `<svg class="hero-poster">` whose bottom path uses `style="fill:var(--hero-bottom,#1d3b8f)"` | R (the fallback if 3D fails) |
| …inside it, canvas | `<canvas id="heroCanvas">` | R |
| Swatch radiogroup | `#heroSwatches` `role="radiogroup" aria-labelledby="heroSwatchLabel"`, **empty**: App renders the 11 strips | R |
| Swatch label | `#heroSwatchLabel` (`data-i18n="hero.swatchLabel"`) | R |
| Caption | `#heroSwatchChip` (App sets `--sw`), `#heroSwatchName` (App sets the name), inside an `aria-live="polite"` element | O |
| Note «colori indicativi» | `data-i18n="hero.swatchNote"` | R (brief) |

App renders each swatch as `<button type="button" class="swatch" role="radio" aria-checked data-value="<id>" data-color="#hex" title="<maker>" style="--sw:#hex;--i:0..10;--n:11;--z:…">` + `<span class="swatch__name" data-i18n="sw.<id>">`, `aria-label` = the colour name. The middle one (index 5) is «Originale» and starts selected. `--i` index, `--n` count, `--z` z-index peaking in the middle: the fan geometry hooks. App sets `--hero-bottom` (hex) on `#heroBoat`. Do not hide the name with `display:none` / `visibility:hidden` (clip it with the `.sr-only` technique instead). Pre-authored strips are kept if the group is not empty: each then needs `role="radio"`, `data-value`, `data-color`.

Price sentence (the true default result as static HTML):

| Element | Id | Notes |
|---|---|---|
| Form | `form#quoteLine` | submit sets the wizard finish + length, goes to `pgs/preventivo.html?pacchetto=<tier>&loa=<m>` (or `#preventivo` in the single-page sketch) |
| Count | `select#qlCount` | options `value` 1..6 |
| Length | `select#qlLoa` | options `value` in metres (5, 6, 8, 10, 12, 15), text feet first, «26 ft (8 m)» |
| Tier | `select#qlTier` | options `base`, `completo`, `premium`, `nessuno`, text via `data-i18n="ql.opt.<id>"` («con il Pacchetto Base» … «senza pacchetto»); the sketches still use `tier.<id>.name` after `ql.mid2` |
| Word | `#qlWord` | App writes «zona/zone» |
| Total | `#qlTotal` (an `<output>`/span) | App writes the formatted price: the package plus that many topsides of a «cabinato» with a typical beam (`Z.typicalBeam`, about LOA / 3). Wrap in `.ph` |
| Sentence pieces | `data-i18n` keys `ql.pre`, `ql.mid1`, `ql.afterLoa`, `ql.post`; visually-hidden labels `ql.countLabel`, `ql.loaLabel`, `ql.tierLabel`; button `ql.cta` | R, in this order: pre, count, word, mid1, loa, afterLoa, tier, post, total |

Tiers:

| Element | Hook | Notes |
|---|---|---|
| Tier price | `[data-tier-from="base|completo|premium"]` anywhere (home cards, wizard step 2) | App writes «da 55 € al metro (minimo 350 €)» from `PACKAGES` in zones.js. Wrap in `.ph` |
| Tier choose link | `<a href="pgs/preventivo.html?pacchetto=base" data-tier-choose="base">` | O: preselects the finish in the wizard |

Other sections: ids `giro`, `galleria`, `servizi`, `chi-siamo`, `interventi` (rates and packages), `come-funziona` (the four steps, inside `interventi`), `domande`, `contatti` are the anchor targets (R for the nav, which links `giro`, `galleria`, `servizi`, `chi-siamo`, `interventi`, `contatti`); their content is the skin's.

Gallery (O): each `a[data-lightbox="<group>"]` (`barche`, `sede`) links to the full photo and wraps its thumbnail `img`, whose `alt` becomes the caption. With `dialog#lightbox` > `#lightboxImg`, `#lightboxCaption`, `#lightboxCount` (`lb.count`), `#lightboxPrev`, `#lightboxNext` and `#lightboxClose`, App opens the photos in the dialog, previous / next within the group; without it the links simply open the file.

Contacts section: address, phone and email each as visible text + copy button (§2); `https://www.google.com/maps/search/?api=1&query=Viale+Nazario+Sauro+13-15+Olmo+di+Martellago` link (`contact.map`); WhatsApp as a `wa.me` link; opening hours as plain text (`contact.openingHours.h`).

### 3.2 Wizard (`#view-wizard`)

```html
<section id="view-wizard" hidden>
  <nav data-i18n-attr="aria-label:wiz.progress">
    <ol id="wizProgress">
      <li data-step="1"><span data-i18n="prog.1"></span><span class="sr-only" data-progress-sr></span></li>  <!-- ×4 -->
    </ol>
  </nav>
  <form class="step" data-step="1" novalidate hidden> <h1 data-i18n="step1.title"></h1> … </form>
  <section class="step" data-step="2" hidden> <h1>…</h1> … </section>
  <section class="step" data-step="3" hidden> <h1>…</h1> … </section>
  <form class="step" data-step="4" novalidate hidden> <h1>…</h1> … </form>
  <section id="success" hidden> … </section>
  <div id="wizardFoot">
    <p id="stepHint" role="status" hidden></p>
    <button type="button" id="stepBack" hidden data-i18n="btn.back"></button>
    <button type="button" id="stepNext" aria-describedby="stepHint" aria-disabled="true"></button>
  </div>
</section>
```
- Steps 1 and 4 are `<form class="step" novalidate>` (Enter in a field = the main button, no native submit); steps 2 and 3 are `<section class="step">`. All start `hidden`. App writes `.is-active` and `hidden`.
- `#wizProgress li[data-step]`: App writes `.is-current`, `.is-done`, `aria-current="step"` and the sr-only text.
- `#stepNext` text is App's («Salva e continua» / «Continua» / «Invia richiesta» / «Invio in corso…»). `#stepBack` is hidden on step 1. App hides `#wizProgress` and `#wizardFoot` and `#stepNext` on success.
- Do not use HTML `pattern`, `required` or `maxlength` on wizard fields: the rules table in `app.js` is the single source (it sets `maxlength` itself).

**Field pattern (R for every field)**: a wrapper `.field` containing exactly one control (or one radiogroup), its label, an optional hint and an error:

```html
<div class="field">
  <label for="year" data-i18n="fld.year"></label>
  <input id="year" type="text" inputmode="numeric" autocomplete="off">
  <p id="yearHint" class="field__hint" data-i18n="…"></p>           <!-- O -->
  <p id="yearError" class="field__error" role="alert" hidden></p>    <!-- R for required fields; App writes the text -->
</div>
```
Control `#<id>`, error `#<id>Error`, hint `#<id>Hint`; App sets `aria-describedby` from the ones that exist. Optional fields: label has an extra `<span data-i18n="fld.optional">`. Conditional fields are hidden by App through the `hidden` attribute **on their `.field`**.

**Radiogroup pattern** (boat type, registered, berthKind, tier; the antifouling strips use it with `.is-active`): `<div id="boatType" role="radiogroup" aria-labelledby="boatTypeLabel">` with `<button type="button" role="radio" aria-checked="false" data-value="…">` children. One Tab stop, arrows/Home/End move and select. A type card holds a picture slot, the name and a sub-label (what the type also covers):
```html
<button type="button" role="radio" aria-checked="false" data-value="gommone" aria-labelledby="typeName-gommone" aria-describedby="typeSub-gommone">
  <span class="type-media"><img data-type-thumb="gommone" src="models/thumbs/gommone.webp" alt=""><span data-type-icon="gommone"></span></span>
  <span id="typeName-gommone" data-i18n="type.gommone"></span>
  <span id="typeSub-gommone" data-i18n="type.sub.gommone"></span>
</button>
```
- `[data-type-icon]` (App injects the SVG silhouette, `currentColor`) is the fallback. `img[data-type-thumb]` and its `[data-type-icon]` **must share a parent**: App shows the picture and hides the icon (`hidden` attribute on both) only once the image has loaded; if the file is missing or fails, the icon stays. Do not use `loading="lazy"` on these images (a hidden lazy image never loads, so it would never replace the icon). Thumbnail folder: the markup's `src` is relative to the page (`models/thumbs/<type>.webp` at the root, `../models/thumbs/` from `pgs/`); the thumbnails App builds itself (the boat summary) resolve next to `app.js`, i.e. `src/../models/thumbs/` (override: `CIPRESSINA_CONFIG.thumbDir`, trailing slash).
- Sub-label keys `type.sub.<id>` (shared); the note under the cards is `type.note` (use `#boatTypeHint`, so App adds it to `aria-describedby`).

**Step 1 controls**

| Id | Kind | Values / notes |
|---|---|---|
| `boatType` | radiogroup | `data-value` = `gommone`, `open`, `cabinato`, `yacht`, `vela` |
| `builder` | `input type=text list="builderList"` | + `<datalist id="builderList">` (empty, App fills) |
| `model` | `input type=text list="modelList"` | + `<datalist id="modelList">` (empty, App fills; filtered by builder) |
| `modelSource` | `<a target="_blank" rel="noopener" hidden>` | O. App writes «dati da beneteau.com» and `href` when a known model pre-fills length/type |
| `modelAutofill` | `<p class="field__hint" role="status" aria-live="polite">`, **empty and never `hidden`** | O. App writes «Tipo e lunghezza compilati dal catalogo, verifica i dati.» when a builder + model match fills the type, the length and/or the beam, and clears it when the customer changes either by hand or the model no longer matches (the text is written into an always-present live region so it is announced) |
| `year` | text, `inputmode=numeric` | |
| `lenUnit` | radiogroup | `data-value` = `ft` (the default, selected by App) and `m` (labels `opt.unit.*`). Switching converts what is typed in `loa` and `beam`; everything sent and stored is metres (1 ft = 0.3048 m) |
| `loa` | text, `inputmode=decimal` | the affix next to it is `<span class="affix" data-unit>`: App writes `ft` or `m` into every `[data-unit]`. Rule: 2.5..30 m, errors in the current unit |
| `beam` | text, `inputmode=decimal`, **required** | same pattern as `loa` (affix `[data-unit]`, `#beamHint`, `#beamError`). Rule: 1..8 m and less than the length. The catalogue fills it (like `loa`) when the model has one; it goes in the payload as `beam` (metres) |
| `registered` | radiogroup | `data-value` = `registrata`, `natante` |
| `berthKind` | radiogroup, **required** | «Dove si trova la barca?». `data-value` = `acqua`, `terra`, `carrello` (labels `opt.berth.*`); error `#berthKindError` (`err.berthKind`); goes in the payload as `berthKind`. Sits before `location` |
| `serviceSite` | `<p role="status" hidden>`, inside the `berthKind` field | O. App fills it once the length is valid: up to `SHOP_MAX_LOA` (8 m, placeholder; `CIPRESSINA_CONFIG.shopMaxLoa` overrides) `note.site.shop.h` (body shop, Olmo di Martellago), above it `note.site.yard.h` (local shipyard). Sent in the payload as `serviceSite`: `carrozzeria` or `cantiere` |
| `registeredNote` | `<p role="status" hidden data-i18n-html="note.natante10.h">` | O. App toggles `hidden` (natante and LOA > 10 m) |
| `registration` | text | its `.field` is hidden unless `registrata` |
| `engineHours`, `location`, `boatName`, `colorCode` | text | optional (`engineHours` also has an error element); `colorCode` hint uses `hint.colorCode.h`. `location` is labelled «Porto o località» (`fld.location`) |
| `firstName`, `lastName` | text | |
| `boatSummary` (`hidden`), `boatSummaryIcon`, `boatSummaryThumb`, `boatSummaryText` | O | App fills the type silhouette + «Beneteau Oceanis 40.1 · 12,87 m · 2019». `boatSummaryThumb` is `<img id="boatSummaryThumb" data-type-thumb="" alt="" hidden>` in the same parent as `boatSummaryIcon`: App sets its `data-type-thumb` and `src` per type, with the same fallback to the silhouette |

**Step 2**: `#tier` radiogroup, `data-value` = `base`, `completo`, `premium`, and O `nessuno` (no package, zone work only: name `tier.nessuno.name`, item `tier.nessuno.i1`, no price). Zones are required in step 3 only with `nessuno`. Each card: name `data-i18n="tier.<id>.name"`, `<span data-tier-from="<id>">`, items `tier.<id>.i1…`, the «Più scelto» badge `tier.badge.h` on `completo`. Error `#tierError` (O).

**Step 3**

| Id | Kind | R/O | Notes |
|---|---|---|---|
| `boatView3d` | wrapper | O | |
| `boatCanvasWrap` | `position:relative` box with size | R | `canvasWrapEl`; the canvas follows its size |
| `boatCanvas` | `<canvas>` | R | App replaces it with a fresh clone on a type change (same attributes, so put `aria-label` via `data-i18n-attr="aria-label:viewer.label"` on it) |
| `boatOverlay` | child of the wrap | R | boat3d adds class `hidden` when ready, removes it on failure |
| `boatLoading`, `boatError` | children of the overlay | R | `boatError` is `hidden` + `role="alert"`; App/boat3d write its text |
| `boatViewButtons` | `role="group"` | R | contains `button[data-view="prua|poppa|sinistra|destra|alto|sotto"]` (text `view.<name>`); boat3d writes `.is-active` and `aria-pressed` |
| `zoneHover` | any element, `aria-hidden` | O | App writes the hovered zone's name |
| `zonesSummary` | `tabindex="-1"` container | R | focus lands here when the list empties |
| `zonesCount`, `zonesEmpty`, `zonesList` (`<ul>`), `zonesClear` (button, `hidden`) | | R | rows: `li.zone-row[data-zone] > span.zone-row__name + span.zone-row__price + button.zone-row__remove[data-zone-remove]` |
| `jobOptions` | wrapper, `hidden` | O | «Dettagli del lavoro» (`opt.title`). App shows it while a painted zone or `bottom` is selected. Inside, native controls whose value goes to `Z.price` / `Z.estimate` and the payload (`options`): `optPainted` (wrapper, painted zone selected) > `select#optFinish` (`pastello`, `metallizzato`) + `select#optRepair` (`stuccature`, `resinatura`, `gravose`); `optBottom` (wrapper, `bottom` selected) > `select#optBottomWork` (`antivegetativa`, `sabbiatura`); `label#optNonSlipRow` > `input#optNonSlip` (checkbox, `deck` selected); `label#optHardwareRow` > `input#optHardware` (checkbox, painted zone selected; never in the total, a note says «a consuntivo, 40 €/h + IVA»). Wrappers/rows are hidden through `hidden` |
| `estimate` (`hidden`) | | R | children: O `estPackageRow` (hidden without a package) > `estPackageLabel` + `estPackage`; `estSubtotalRow` (the zone work, shown when there is a package) > `estSubtotal`; `estTotal` (`aria-live="polite"`; «Preventivo personalizzato» when heavy repairs make the quote custom); `estNote` (says «IVA esclusa») |
| placeholder tag | `<span class="ph" data-i18n-html="sum.placeholder.h">` | R (brief): next to the estimate |
| `antifoulingBlock` | wrapper, `hidden` | O | Optional «Colore antivegetativa (indicativo)». App shows it only while zone `bottom` is selected |
| `antifoulingSwatches` | `role="radiogroup" aria-labelledby="antifoulingLabel"`, **empty** | O | App renders the same 11 `.swatch` buttons as `#heroSwatches` (same `Z.SWATCHES`, `sw.<id>` names, `aria-label`), roving tabindex, `.is-active` + `aria-checked`. «Originale» is the wizard theme's `bottom` colour. Choosing one calls `setColors({ bottom: hex })` on the wizard viewer (nothing is painted when the viewer failed; the choice is still kept), stores `state.antifoulingColor` (the swatch id), shows its name in the `bottom` row of `zonesList` (`span.zone-row__sub`) and sends `antifoulingColor` in the payload. Deselecting `bottom` clears it |
| `antifoulingLabel`, `antifoulingCaption` (`hidden`), `antifoulingChip` (App sets `--sw`), `antifoulingName` | | O | label, and the «colore scelto» caption (shown once a colour is chosen). Put the «colori indicativi» note (`af.note.h`, `.ph`) next to them |
| `zonesPicker` | `<details>` with `<summary data-i18n="zones.picker">` | R | auto-opens on 3D failure or when the main button is pressed with no zone (only possible with `nessuno`: with a package, zones are optional) |
| `zonesChecklist` | empty `<div>` inside it | R | App renders `label.check > input[type=checkbox][value=<zone>] + span` |

**Step 4**

| Id | Kind | Notes |
|---|---|---|
| `phone` | `type=tel`, no prefix affix | an Italian number (3… / 0…, sent as `+39…`) or any number typed with its own `+` (sent as typed). There is no region, province or country: the shop works only in the Venice area |
| `email` | `type=email` | |
| `notes` | `<textarea>` | `data-i18n-attr="placeholder:ph.notes"` |
| privacy line | `data-i18n-html="privacy.h"` | `.ph` |

**Success** (inside the wizard view, `#success`, `hidden`): `<h1 data-i18n="success.title">`, `data-i18n="success.lede"`, label `success.code`, `#successCode` (App writes the 10-digit code the server returned; keep it selectable), `button#successCopy[data-copy="#successCode"]`, `<a href="#stato">` (`success.lookup`), `button#resetBtn` («Nuova richiesta»). The main button sends `POST /api/requests`; a failed send stays on step 4 with `send.err.busy` / `send.err.bad` / `send.err.down` in `#stepHint`.

### 3.3 Lookup (`#view-lookup`)

```html
<section id="view-lookup" hidden>
  <h1 data-i18n="lookup.title"></h1>
  <form id="lookupForm" novalidate>
    <label for="lookupId" data-i18n="lookup.label"></label>
    <input id="lookupId" type="text" inputmode="numeric" maxlength="10" autocomplete="off" aria-describedby="lookupError">
    <button type="submit" id="lookupSubmit" data-i18n="lookup.submit"></button>
    <p id="lookupError" role="alert" hidden></p>
  </form>
  <div id="lookupResult" hidden>   <!-- App focuses it (tabindex -1) -->
    <dl>… <dd id="resultId"> <dd id="resultBoat"> <dd id="resultName"> <dd><span id="resultStatus"></span></dd></dl>
  </div>
</section>
```
`#lookupSubmit` text is swapped to «Verifica in corso…» while busy and restored. The page asks `GET /api/requests/<code>` (server/server.js): the stored boat, name and status, or `lookup.notFound` / `lookup.down` in `#lookupError`.

## 4. What the JS does that a skin can rely on

- Prices are always `it-IT` euros (`1.250 €`) in every UI language, always next to a `.ph`.
- Language: default `navigator.language` if it/en/es/fr, else `it`; the choice persists in `localStorage["cipressina.lang"]` (try/catch). `<html lang>` follows. Everything JS writes re-renders on language change (event `cipressina:lang` on `document`).
- Errors show on blur and clear as soon as the value is valid; the main button is never disabled; a click on an incomplete step marks every missing field, focuses the first, and writes `#stepHint`.
- Changing the boat type clears the zones, announces it (a polite live region the app creates), destroys the 3D viewer and mounts a fresh one on the next visit to step 3.
- 3D failure (import twice, WebGL, build) opens `#zonesPicker` and shows the error in `#boatError`; the quote can always be finished from the checklist.
- Reduced motion: scripted scrolling is instant; the hero does not spin.
- Window events: `popstate` and `hashchange` drive the router; the wizard uses `history.pushState({view:"wizard", step})` with URL `location.pathname` (`#preventivo` in the single-page sketch).

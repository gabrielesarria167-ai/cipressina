# Brief: Cipressina Barche, 3 design sketches

The authoritative decisions for every implementer. Where `flow-spec.md` (analyst) or `research.md` (scout) disagree with this file, **this file wins**. Read those two for the detail behind each point.

## What we are building
Three design directions (A, B, C) of the same product: the boat version of autocolor for **Carrozzeria Cipressina** (Olmo di Martellago, VE).
- Each direction is ONE HTML page with three views: home → 4-step quote wizard → success, plus «Verifica la tua richiesta» (lookup).
- There is no backend: submissions are simulated.
- The 3D boat (`boat3d.js`) is the star. The owner cares about it most.

## Files
```
design/sketches/
  boat3d.js            ES module, procedural 3D boats (being built separately; API below)
  shared/zones.js      window.CIPRESSINA_ZONES: labels by lang, BY_TYPE, prices (placeholder), estimate, discountHint, formatEUR
  shared/regioni.js    window.IT_REGIONI
  shared/i18n.js       window.CIPRESSINA_I18N: {it,en,es,fr} shared strings + t(), apply(), extend(), setLang()
  shared/app.js        router, wizard, lookup, menu, language switcher, hero swatch binding, price sentence, 3D host lifecycle
  shared/CONTRACT.md   the DOM contract (ids, data-attributes, classes) that app.js expects
  a-officina.html  b-cantiere.html  c-laguna.html   the three skins: markup + CSS + page-specific copy only
```
The pages load the shared classic scripts with `<script src="shared/…" defer>` and the 3D module with a dynamic `import('./boat3d.js')`. No duplicated logic between pages: a page differs only in markup, CSS and home copy.

## Artifact page contract (how the pages are published)
- **No `<!doctype>`, `<html>`, `<head>` or `<body>` tags.** The page starts with `<title>`, then the `<link>` to Google Fonts, then `<style>`, then content. The publisher wraps it.
- **Titles:** «Cipressina Barche · Officina» / «… · Cantiere» / «… · Laguna».
- **Hosts:**
  - scripts only from `cdn.jsdelivr.net/npm/` (three) or our own relative files;
  - fonts only from Google Fonts;
  - no external images at all (the CSP blocks them), so images are labelled placeholders drawn in CSS/SVG.
- **Import map** (inline):
  ```html
  <script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>
  ```
- **Colour tokens:** every colour is a token on bare `:root`. Then `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){…; color-scheme:dark}}` and `:root[data-theme="dark"]{…}`. `body` has an explicit token background. A dark-first design mirrors this shape.
- **Layout:**
  - 16px minimum side gutter;
  - no horizontal scroll at 320px;
  - `min-width:0` on flex/grid children holding text.
  - A sticky header uses `top: env(safe-area-inset-top, 0px)`; fixed bottom bars add `env(safe-area-inset-bottom, 0px)`.
- **Frame limits:**
  - `tel:`/`mailto:` may not work, so always show the number or address as selectable text with a «Copia» button;
  - `wa.me` https links are fine;
  - forms `preventDefault()`;
  - no `alert`/`confirm`;
  - `localStorage` only in try/catch.
- **Routing:**
  - only plain hashes (letters, digits, `-`): `#preventivo` and `#stato` are views, anything else (e.g. `#servizi`) is a home anchor, and an empty hash means home;
  - the wizard step, the chosen finish and the LOA from the home price sentence live in JS state, NOT in the URL (no `?` in hashes);
  - use `history.pushState({view, step})` for steps so Back works, with a `popstate` handler.
- **Draft ribbon** on every view, in 4 languages: «Bozza di design · prezzi, foto e alcuni dati sono segnaposto» / "Design draft · prices, photos and some details are placeholders" / «Borrador de diseño · precios, fotos y algunos datos son provisionales» / «Maquette · prix, photos et certaines données sont provisoires».
- **Placeholder convention:** `<span class="ph">…</span>`, styled with a dashed amber outline; each design styles `.ph` in its own palette but keeps it obviously a placeholder. JS data carries `placeholder:true`.

## Facts we may state (from research.md, all sourced)
- **Legal name:** Officina Carrozzeria Cipressina S.R.L. · P.IVA IT00762770279.
- **Address:** Via N. Sauro, 15 · 30030 Olmo di Martellago (VE).
- **Phone:** 041 907941 · **Email:** info@carrozzeriacipressina.it.
- **WhatsApp:** `.ph` («numero da confermare»), but the FAB is still shown, pointing to `#contatti`. **Hours:** `.ph`.
- **Boat services (verbatim, /manuntenzione-barche/):**
  - Hull and deck: lavaggio completo e lucidatura; riverniciatura e riparazioni; applicazione di antivegetativa; riparazione di crepe o danni strutturali; controllo e manutenzione degli accessori esterni.
  - Engine: olio; raffreddamento; iniezione diesel/benzina; filtri carburante e aria; cinghia di trasmissione; sistema elettrico e batterie.
  - Note on the site: «interventi su barche sia sull'opera morta che l'opera viva»; «nuova sede operativa per interventi su motori entro bordo nautici».
- **Facilities:** these are the workshop's, as listed on the home page, and may be cited as the shop's equipment: forno di verniciatura e cabina di essiccazione; 3 zone di preparazione; 4 tintometri; 2 colorimetri elettronici. Do NOT claim the booth fits boats; that is `.ph`.
- **Awards:** Mercurio d'oro, Alfiere Economico, Venezia che Lavora, Lavoro e Progresso.
- **Do not invent:** years in business, numbers of boats, warranties, turnaround times, max LOA, haul-out/transport services, ratings or testimonials. Anything like that is `.ph`.
- **Logo:** recreate it as inline SVG: two overlapping crescents, blue `#0E0E9E` left and green `#009642` right, with the wordmark «OFFICINA CARROZZERIA» over «CIPRESSINA» in the blue, heavy grotesque caps. Mark it «logo ricostruito, usare file originale» in a comment only.

## Brand anchors (all directions)
- **Logo colours:**
  - blue `#0E0E9E`;
  - green `#009642`;
  - the current site's UI blue `#007bff` and secondary `#004c9e`.
- **Body face:** Source Sans 3 (the Google Fonts name of Source Sans Pro, which the site uses), for all three directions.
- **Tone:** Italian «tu» (the site's boat page says «la tua barca»); ES «tú», FR «vous», EN "you". Spanish is Spain-neutral («matrícula», «presupuesto», «móvil»). EN/ES/FR carry a note «traduzione da revisionare» in a code comment.
- **Prices:** always `Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0})`, in every UI language, and always flagged as placeholders.

## Boat types and zones (must match boat3d.js `BOAT_MODELS`)
Types: `gommone` (Gommone / RIB), `open` (Open / day cruiser), `cabinato` (Cabinato), `flybridge` (Flybridge), `vela` (Barca a vela).

Zone ids and IT labels (EN / ES / FR in `zones.js`; the * terms are unverified, so flag them):

| id | IT | EN | ES | FR | price group |
|---|---|---|---|---|---|
| bottom | Opera viva (antivegetativa) | Underwater hull (antifouling) | Obra viva (antiincrustante*) | Œuvres vives* (antifouling*) | antifouling |
| boot | Linea di galleggiamento | Boot stripe | Línea de flotación* | Ligne de flottaison* | stripe |
| topside_port | Opera morta, lato sinistro | Port topside | Obra muerta, babor* | Œuvres mortes, bâbord* | topsides |
| topside_starboard | Opera morta, lato destro | Starboard topside | Obra muerta, estribor* | Œuvres mortes, tribord* | topsides |
| transom | Specchio di poppa | Transom | Espejo de popa* | Tableau arrière | transom |
| deck | Coperta | Deck | Cubierta* | Pont* | deck |
| cabin | Tuga / sovrastruttura | Superstructure | Superestructura* | Superstructure* | superstructure |
| hardtop | Hard-top | Hardtop | Hard-top | Hard-top | superstructure |
| flybridge | Fly | Flybridge | Flybridge | Flybridge | superstructure |
| console | Consolle | Console | Consola* | Console* | small |
| tube_port | Tubolare sinistro | Port tube | Flotador babor* | Boudin bâbord* | tubes |
| tube_starboard | Tubolare destro | Starboard tube | Flotador estribor* | Boudin tribord* | tubes |
| outboard | Motore fuoribordo (carenatura) | Outboard (cowling) | Fueraborda (carenado)* | Hors-bord (capot)* | small |
| sterndrive | Piede poppiero | Sterndrive | Cola/pie* | Embase* | small |
| propeller | Eliche e assi | Propellers and shafts | Hélices y ejes* | Hélices et arbres* | small |
| rudder | Timone | Rudder | Timón* | Gouvernail | appendage |
| keel | Chiglia / bulbo | Keel / bulb | Quilla / bulbo* | Quille / lest* | appendage |

`BY_TYPE` lists the zones of each type. The boat3d implementer reports the final lists, and `zones.js` must mirror them (the reviewer checks this). The copy exists because the checklist must work even when three.js fails to load.

**Prices (ALL placeholder):** EUR per metre of LOA per tier, with a minimum per zone. Take the shape of flow-spec §4.2, adding the groups `appendage {base:20, completo:28, premium:40, min:150}` and `small {base:10, completo:14, premium:20, min:100}`.
- `DISCOUNT_STEPS = [0,0,5,7,9,10]` (placeholder, same curve as autocolor).
- `estimate(ids, tier, loa)` returns `{subtotal, priced, rate, discount, total, unpriced, placeholder:true}`.

## Finish tiers (step 2), using the site's own package names
| id | Name | Contents (the lead's reading of the site's list; mark «composizione indicativa») |
|---|---|---|
| base | Pacchetto Base | Lavaggio completo e lucidatura · Applicazione di antivegetativa |
| completo | Pacchetto Completo («Più scelto» = `.ph`) | Tutto il Base · Riverniciatura e riparazioni del gelcoat |
| premium | Pacchetto Premium | Tutto il Completo · Riparazione di crepe o danni strutturali · Trattamento osmosi |

Each card shows «da {formatEUR(PRICES.topsides[tier]*1)} al metro» from the data, with `.ph`.

## Wizard (follow flow-spec §3.4–3.8, with these overrides)
1. **«Dati della barca»:**
   - boat type: a radiogroup of the 5 types, each with a small SVG silhouette;
   - cantiere: an input with a `<datalist>` of the builders in research §2, plus free text;
   - modello: an input with a `<datalist>` filtered by builder, from research §2. Choosing a known model pre-fills LOA and type if they are empty, with the source shown as a tiny «dati da {builder}.com» link;
   - anno; LOA (m); immatricolata / natante + sigla; ore motore (opt.); dove si trova (opt.); nome barca (opt.); codice colore/gelcoat (opt.); nome; cognome;
   - changing the type clears the zones and announces it.
2. **«Livello di intervento»:** the 3 tiers above as a radiogroup.
3. **«Quali zone?»:**
   - the 3D viewer, with the view buttons prua, poppa, sinistra, destra, alto, sotto and a water toggle («Mostra/nascondi acqua»);
   - the summary list with remove buttons and «Rimuovi tutte»;
   - the discount nudge, the estimate, and the `.ph` «prezzi segnaposto»;
   - the `<details>` checklist fallback, auto-opened on 3D failure.
4. **«Contatti»:**
   - regione → provincia, with «Estero / Fuori Italia» giving free-text country + international phone;
   - `regioni.js` holds Veneto, FVG, Emilia-Romagna, Lombardia and Trentino-AA complete (source in research §6); the other 15 regions use a free-text provincia;
   - +39 phone, email, note, the privacy line `.ph`.

**Success:** after 600 ms, a demo 10-digit code (first digit non-zero) labelled «codice dimostrativo», with copy and «Nuova richiesta». The lookup accepts any 10 digits and shows a demo status from the list in flow-spec §7 #9, marked `.ph`.

Keep:
- the never-disabled main button with `explainStep`;
- one rules table per field;
- errors on blur;
- heading focus on view change;
- the sticky progress `<ol>` (Barca · Intervento · Zone · Contatti);
- the WhatsApp FAB hidden on wizard views.

## Home (IA from flow-spec §7, each direction lays it out its own way)
- **Header:** logo, nav (Servizi · Come funziona · Interventi · Chi siamo · Contatti), language switcher IT/EN/ES/FR, CTA «Preventivo».
- **Hero:** the 3D boat as the thesis.
  - Swatches repaint the **antivegetativa (opera viva)** live, using the 10 sourced colours in research §5. Their names are visible and the caption says «colori indicativi».
  - The boat must be framed so the bottom is visible (water hidden or translucent, a slightly low 3/4 view).
  - Show an SVG poster until the 3D mounts. On reduced motion, no spin.
- Then: Servizi · Come funziona (4 steps) · Interventi (price sentence + 3 packages + discount steps rendered from data) · Perché noi (facilities and awards, with photo placeholders) · FAQ (questions from flow-spec §7; answers `.ph` unless backed by research) · Contatti (address, phone and email with copy buttons, a «Apri in Google Maps» link to `https://www.google.com/maps/search/?api=1&query=Via+Nazario+Sauro+15+Olmo+di+Martellago`, hours `.ph`) · Footer (legal name, P.IVA, © year).

## The three directions
**A · Officina.** This is the safe, faithful one: it reads as the next page of carrozzeriacipressina.it.
- White ground with a cool grey-blue neutral. Logo blue `#0E0E9E` as the ink and headings, green `#009642` for primary actions and the selection, `#007bff` only for links.
- Source Sans 3 throughout, with heavy 800 uppercase headings echoing the logo wordmark.
- The crescent motif (two arcs) is used once as the section marker and the loading spinner.
- Square-ish 4px radii, hairline grids.
- Hero: the autocolor fan deck reborn. Antifouling strips fan out behind the 3D boat, using the fan CSS from flow-spec §2.1–2.2 with an odd count (10 colours + «Originale» = 11).

**B · Cantiere.** The technical one: a shipyard drawing office at night.
- Dark-first: deep navy derived from `#0E0E9E` (around `#0b1030`), with a light variant.
- Display face: Barlow Condensed (600/700, uppercase, tracked). Body: Source Sans 3. Data and labels: IBM Plex Mono.
- Thin blueprint grid lines. The waterline is the organising device: a horizontal line runs through the hero, and sections above it are "opera morta" (services, process) while the sections «sotto la linea» get a deeper tone (finishes, FAQ).
- Green `#009642` (brightened for dark-mode contrast) is the action and selection colour; a cyan hover.
- Hero: a large 3D boat on a dimension-line frame (LOA ticks in mono), with swatches as a vertical colour-chip rail like a paint maker's card.

**C · Laguna.** The editorial one, rooted in the Venetian lagoon.
- A pale lagoon grey-green ground (around `#eef2ef`; NOT cream), with deep lagoon green-blue ink (around `#12343b`).
- Logo blue and green appear only as accents (links, selected state, the logo).
- Display face: Fraunces (opsz, soft), with restraint; body: Source Sans 3.
- Generous whitespace and large photo placeholders (labelled «foto: cantiere / barca in lavorazione»).
- Hero: a big serif statement, with the 3D boat sitting low in a wide panoramic band where the translucent water is visible. The swatches are round "paint drops" in a row.
- Avoid the AI clichés: no terracotta, no cream, no gradient hero.

Each direction styles the 3D viewer through the `theme` option (water, select, hover, hull colours) and its own camera-button look.

## boat3d.js API (being implemented now; confirm with the implementer's report)
```js
export const BOAT_TYPES, BOAT_MODELS
mountBoat3D({ boatType, canvasEl, canvasWrapEl, overlayEl, errorEl, buttonsEl /*[data-view]: prua poppa sinistra destra alto sotto*/,
  isPartSelected, onPartToggle, onHover, onLoadError, interactive=true, spin=false, showWater=true, theme })
→ { resize, refreshSelection, resetView, setView(name), setColors({topsides,bottom,deck,boot}), setWaterVisible(bool), loadFailed(), destroy }
```

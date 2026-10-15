# flow-spec.md: Carrozzeria Cipressina boat-painting quote site, built from Autocolor

Source read in full: `index.html`, `pgs/repair.html`, `src/repair.js`, `src/parts.js`, `src/home.js`, `src/lookup.js`, `src/carVisual.js`, `src/statuses.js`, `docs/home-page.md`, `docs/quote-wizard.md`, `docs/3d-viewer.md`, `docs/architecture.md`, `styles.css` lines 1–3958 (base, wizard shell, home, wizard polish, tracking), and `design/rebrand/*.dc.html` (Main, HomeMobile, Wizard, Brand, Taller, DirectionB, DirectionC, plus canvas.json). Repo root: `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor`.

**Line numbers.** The line numbers below come from the current source. The line references in `docs/quote-wizard.md` are out of date (for example the doc says `isStepValid :396`, but the code has it at `:427`), so use the numbers in this spec. The numbers in `docs/3d-viewer.md` are mostly right; where they have drifted, this spec gives the correct one.

**Placeholder convention, shared by all 4 implementers.**
- Any fact we do not have goes in markup as `<span class="ph" data-ph="<topic>">…</span>`. Style `.ph` with a dashed amber outline so placeholders stay visible in reviews.
- Placeholder data in JS gets `placeholder: true`.
- Every price is a placeholder.

---

## 0. Summary of what the Autocolor code does

Autocolor is a static, no-build site for a body shop in Ayacucho. It has two pages:

- **Home (`index.html` + `src/home.js`).** The page is complete without JS. JS adds three things:
  - a mobile menu;
  - a "paint fan deck" hero: 13 radio strips that recolour a photo of an SUV using two CSS layers masked to the bodywork;
  - a one-sentence live price («Pintar [2] piezas con acabado [profesional] cuesta desde S/ 570»).
- **Quote wizard (`pgs/repair.html` + `src/repair.js`).** Four steps:
  1. Vehicle: make/model from a catalogue, plus year, plate, mileage, colour code and names.
  2. Finish: 3 tiers.
  3. Panels: picked on a lazily imported three.js viewer (`src/carVisual.js`, GLB models), or on a checklist fallback, with a live estimate and a multi-panel discount from `src/parts.js`.
  4. Contact: Peru department/province, `+51` phone, email, notes.

  Submitting POSTs to a Node API, which returns a 10-digit tracking code. `src/lookup.js` queries the status by code.

Design rules that recur throughout:
- The main button is never disabled; a click on an incomplete step explains what is missing.
- The host page owns the selection state; the 3D viewer only reflects it.
- The viewer renders on demand.
- Exactly one viewer exists at a time, and it is disposed fully when replaced.
- Every secondary failure degrades to something usable (3D fails → checklist; no API → WhatsApp).

---

## 1. Home page inventory (`index.html`)

### Section backgrounds
The HTML comment at `:77–83` sets the rule: sections alternate between base (grey `#e9ebea` on `body.home`) and tint (white):

hero = base, offers = its own dark band, servicios = tint, proceso = base, acabados = tint, nosotros = base, faq = tint, contacto = base, footer = ink.

Adding or removing a section means re-checking the whole chain.

### Chrome (every page)

| Element | Content | CTAs / links |
|---|---|---|
| Skip link `:39` | «Saltar al contenido» | `#contenido` (the `<main>`) |
| Header `:41–63` | Horizontal logo; nav: Servicios, Cómo funciona, Acabados, Contacto | Logo → `index.html` (aria-label «Autocolor, ir al inicio»). Nav → `#servicios #proceso #acabados #contacto`. Ghost button «Comprar matizado» (short label «Matizado» at 900–999px) → `pgs/paintings.html`. Primary «Cotizar ahora» → `pgs/repair.html`. Hamburger `#menuToggle` (hidden ≥900px). |
| Mobile panel `#navPanel` `:65–73` | Same links plus «Preguntas» (`#faq`) | Two CTA blocks: «Cotizar ahora» → wizard; «Comprar matizado» → paintings |
| WhatsApp FAB `:772–778` | Green circle with WA glyph | `https://wa.me/51935646304`, new tab, aria-label «Escríbenos por WhatsApp» |
| Footer `:736–770` | Stacked white logo. Nav «Servicios» (Pintura completa, Pintura por piezas, Planchado, Pulido, Venta de matizado). Nav «Autocolor» (Cómo funciona, Acabados, Preguntas frecuentes, Cotizar). Bottom line: © year (`#year`, filled by JS), legal name + RUC | Anchors as above; «Venta de matizado» → paintings; «Cotizar» → wizard |

### Sections in order

| # | Anchor / bg | Spanish heading (quoted) | Purpose | Content blocks | CTAs → target | Suggested Italian (boat yard) |
|---|---|---|---|---|---|---|
| 1 | hero (base) | «El color de fábrica, otra vez.» | The promise, plus a hands-on colour toy | sr-only label «Prueba un color en la camioneta»; fan deck (13 strips, radiogroup); SUV photo + 2 paint layers; caption «Color elegido: Original»; h1; lede (spectrophotometer, oven, 2-minute online quote); note on the preview; trade line | «Cotizar mi vehículo» → `pgs/repair.html`; «o escríbenos por WhatsApp» → wa.me (new tab); «Compra el color matizado, listo para pintar» → paintings | **«Come appena varata.»** (alt: «Il colore del primo varo, di nuovo.») |
| 2 | `#ofertas` (dark, `hidden`) | eyebrow «Ahorra ahora», h2 «Descuentos vigentes» | Server-injected list of the boss's discounts in force | `<ul id="offersList">`, empty | None | «Offerte in corso» / «Risparmia ora». **Drop it from the sketches.** It is server-only. |
| 3 | `#servicios` (tint) | «Todo lo que le devuelve la cara a tu vehículo» | What the shop does | Head (h2 + lede «Trabajamos por pieza…»); 6 cards in a hairline grid: Pintura completa, Pintura por piezas, Planchado y desabolladura, Fast Repair, Pulido y abrillantado, Cambio de color; trade band (ink) h3 «Te preparamos el color, tú lo aplicas» + 2 ways («Código», «En el taller»); proof photo (panel beating) | «Pedir matizado» → paintings | «Tutto ciò che rimette a nuovo la tua barca» |
| 4 | `#proceso` (base) | «Del presupuesto a la entrega, en cuatro pasos» | Explain the 4-step flow (mirrors the wizard and the customer email) | Head + lede; `<ol class="steps">` with 4 cards: Registra tu vehículo / Elige el acabado / Marca las piezas / Recibe tu presupuesto (the first number is filled ink) | «Empezar mi cotización» → wizard; note «Toma unos 2 minutos y no te compromete a nada.» | «Dal preventivo al varo, in quattro passi» |
| 5 | `#acabados` (tint) | «Tres formas de hacerlo bien»; discount h3 «Mientras más piezas, menos pagas» | Pricing transparency | Head + lede; **quote-line form** `#quoteLine` (GET to `pgs/repair.html`; only `acabado` has a `name`, so `qlCount` is not sent); 3 tier cards: Económico «Desde S/ 250 por pieza», Profesional «Más elegido» S/ 300 (the ink block), Alta gama S/ 400, each with a feature list; discount band 5% / 7% / 9% / 10% for 2 / 3 / 4 / 5+ panels; small-print note; proof photo (mixing bench) | Form submit «Marcar las piezas en 3D» → `pgs/repair.html?acabado=<tier>`; each tier «Cotizar» → `pgs/repair.html?acabado=standard\|premium\|custom` | «Tre modi di farlo bene»; «Più zone, meno paghi» |
| 6 | `#nosotros` (base, **not in nav**) | «Pintar bien es, sobre todo, preparar bien» | Why us, with proof | Split layout: lede + `<dl class="facts">` (Colorimetría, Cabina de horno, Presupuesto cerrado, Seguimiento); aside `.stats` (+15 años, +200 vehículos, 24 h, 5 años); lead proof photo with figcaption «Así se comprueba.…»; colorimetry photo | «código de seguimiento» → `pgs/repair.html#consulta` | «Verniciare bene è, soprattutto, preparare bene» |
| 7 | `#faq` (tint) | «Antes de dejarnos tu vehículo» | Remove objections | 9 `<details>`: duration; colour match; spectrophotometer; need to bring the car?; urethane vs acrylic; urethane over acrylic; oven vs open air; warranty; why others charge less; payment (cash, Yape, transfer) | None | «Prima di affidarci la tua barca» |
| 8 | `#contacto` (base) | «Cotiza hoy y agenda tu ingreso» | Convert, and locate the shop | Copy + lede; CTA row; trade line; `<ul class="contact__details">` (Dirección, Teléfono `tel:`, Correo `mailto:`, Horario); proof photo of the premises; Google Maps iframe (lazy) | «Cotizar mi vehículo» → wizard; «WhatsApp» → wa.me; «Pide tu matizado en línea» → paintings | «Chiedi il preventivo e prenota il tuo posto in cantiere» |

Hero CSS references: `styles.css:1747–2036`. Section furniture: `:1671–1745`.

---

## 2. Hero colour preview mechanics

### 2.1 How the fan deck works today

**Markup (`index.html:92–176`)**
- `<div class="fan" role="radiogroup" aria-labelledby="fanLabel">` contains 13 `<button type="button" class="swatch fan__strip" role="radio" aria-checked>`.
- Each strip carries:
  - `data-tint` (hex) / `data-filter` (CSS filter) / `data-tint-opacity`;
  - inline `--sw` (the printed colour);
  - `--i` (its index, 0–12);
  - an inline `z-index` running 1,3,5,7,9,11,13,11,9,7,5,3,1, so the middle strip is on top.
- Inside each strip: `.fan__name` plus five `aria-hidden` `.fan__shade` spans.
- «Original» (index 4) starts `is-active` with every data attribute empty. Neutral colours set only `data-filter`.

**Geometry (pure CSS)**
- `.fan { --n: 13; --spread: 140deg; height: clamp(300px, calc(44 * var(--u)), 620px) }`, with `--u: min(1vw, 1.1svh)` on `.hero` (`:1764–1773`).
- Each strip: `transform: translateX(-50%) rotate(calc(var(--spread) / -2 + var(--i) * var(--spread) / (var(--n) - 1)))`, `transform-origin: 50% 100%` (`:1792–1793`).
- Width `clamp(46px, calc(7.4 * var(--u)), 108px)`. Height is 88%, 92% on hover, and 98% plus `z-index: 30 !important` when active (`:1782–1806`).
- Shades: shade 1 is `var(--sw)`; the next four are `color-mix(in srgb, var(--sw), #fff 18% | 36% | 54% | 72%)` (`:1835–1849`).
- Under 600px: `--spread: 74deg`, and fan and vehicle both size off `--phone: min(300px, 80vw)` (`:1855–1873`). (`docs/home-page.md` says "104° under 600px" in one place; the CSS value, 74°, is the real one.)
- An odd count is deliberate: it gives a single upright middle strip.

**Vehicle**
- `.hero__vehicle` has `z-index: 40; pointer-events: none`, with a negative top margin `calc(var(--car) * -0.68)` so the wheels sit on the pivot, and `filter: drop-shadow(...)` (`:1886–1898`).
- Clicks pass through it to the strips behind.

**Roving tabindex + radio behaviour (`home.js:68–113`)**

```js
// home.js:83-90
swatches.forEach(function (other) {
    var active = other === button;
    other.classList.toggle("is-active", active);
    other.setAttribute("aria-checked", String(active));
    other.tabIndex = active ? 0 : -1;
});
// home.js:103-111
var step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
    : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
if (!step) return;
event.preventDefault();
var next = swatches[(index + step + swatches.length) % swatches.length];
next.focus();
apply(next);
```

- The deck is a single Tab stop. Arrow keys wrap around and select as they move (selection follows focus).
- Space/Enter work because the strips are native buttons. Home/End are not handled.

**Caption (`index.html:173–176`)**
- `<p class="fan-caption" aria-live="polite">` holds a chip (`--sw`), sr-only «Color elegido:», and `<strong id="fanCurrent">`.
- `apply()` copies the strip's name and `--sw` into it (`home.js:79–81`).
- The caption is where the choice is read: the names inside the strips use `visibility: hidden` under 600px and on screens 600px+ wide but ≤820px tall (`:1870–1881`).

**Masking approach (`:1906–1944`)**
- `.hero__vehicle-paint` repeats the photo as a background with `filter: var(--vehicle-filter)`.
- `.hero__vehicle-tint` is a flat `var(--vehicle-tint)` with `mix-blend-mode: color` at `var(--vehicle-tint-opacity)`.
- Both use `mask-image: url(imgs/assets/suv-paint-mask.webp)`: alpha is 1 on bodywork and 0 on glass, tyres and trim. The mask is generated by `tools/build-paint-mask.py`, tuned to the beige paint.
- The filter darkens first; then the colour blend applies hue and saturation and keeps the luminance (reflections and seams survive).
- Dark paints were excluded because the mask edge shows under them.

**Motion (`:3152–3185`)**
- `@keyframes fan-open { from { transform: translateX(-50%) rotate(0deg); } }`, run as `0.9s var(--ease-out) 0.1s backwards`. Hero copy uses `hero-in 0.7s … 0.35s backwards`.
- `backwards` means the resting state is the final state: if animations never run, nothing is hidden.
- Under `prefers-reduced-motion`, animations and the strip/paint/tint transitions are set to none. A global rule (`:1303–1313`) also collapses every duration to 0.01ms.
- Paint transitions are 0.45s.

### 2.2 Translation to a 3D boat hero

**What to keep**
- The radiogroup markup, roving tabindex, arrow keys, caption, odd count, `--sw` printing, the fan geometry CSS and the opening animation, all unchanged.

**What changes: one data attribute**
- Each strip carries only `data-color="#RRGGBB"`; `--sw` uses the same hex.
- Drop `data-tint`, `data-filter`, `data-tint-opacity`, both paint layers and the mask file.

**The canvas**
- Replace `.hero__vehicle` with `<div class="hero__boat" id="heroBoat"><canvas></canvas><img class="hero__boat-poster" …></div>`, with the same z-index (40), `pointer-events: none` and negative margins, so clicks still reach the strips.
- Mount it as `mountBoat3D({ boatType: 'cruiser', interactive: false, spin: !reducedMotion, initialView: 'threeQuarter', hullColor, canvasEl, canvasWrapEl })`.
- `alpha: true`, so the fan shows through the canvas.

**Applying a colour**
- `apply(button)` calls `heroBoat.setHullColor(button.dataset.color, { animate: true })`.
- `setHullColor` sets `hullMaterial.color`, the material shared by `topsides_port`, `topsides_starboard` and `transom`.
- three r169 has `ColorManagement` enabled, so `color.set('#hex')` treats the hex as sRGB and converts it to linear correctly.
- Animate over 450 ms, matching the CSS `0.45s`: lerp in linear space, call `requestRender()` each frame, use `easeInOutSine`. Under reduced motion, apply instantly.
- Deck, superstructure and antifouling keep their own materials.

**Dark colours are now allowed** (there is no mask edge). Proposed 13 strips, all placeholders, with the default in the middle (index 6) so it stands upright:
- Bianco `#f2f2ee`, Bianco ghiaccio `#e6ebec`, Avorio `#ece3cf`, Sabbia `#d6c6a5`, Grigio perla `#c6c9cb`, Azzurro `#8fb8d6`
- **Bianco gelcoat (default) `#f4f3ee`**
- Verde acqua `#6fb9a8`, Rosso `#b8322a`, Blu royal `#1f4f9a`, Blu navy `#1d2a44`, Verde inglese `#1f3d2b`, Nero `#1a1a1c`

Strip names are i18n keys.

**Tone mapping caveat.** ACES (`toneMapping` in `carVisual.js:309`) desaturates and darkens bright colours, so a strip's chip and the rendered hull will not match exactly.
- The hero note already says the preview is a reference only.
- To get closer, the hero instance can use `THREE.NeutralToneMapping` (available since r162). Expose this as the option `toneMapping`.

**Loading and fallback**
- Do not block the first paint on three.js. Show the poster immediately: an inline SVG side profile of the boat whose hull `<path>` fill is set to the chosen colour. That gives a no-WebGL fallback with no mask needed.
- Mount the 3D scene on `requestIdleCallback` (or `load` plus a 0 ms timeout), then crossfade.
- If `import()` or the mount fails, keep the SVG. Selecting a strip still recolours the SVG path.

**Pause when unseen**
- Pause the turntable when the hero is off screen (`IntersectionObserver`) or the tab is hidden (`visibilitychange`). The original turntable never stops; the host is simply told not to leave it mounted.

**Reduced motion**
- No turntable: show the static `threeQuarter` view, and change colours instantly.

---

## 3. Wizard spec

### 3.1 The original, step by step

**State.** `var state = { vehicle: null, parts: [], quality: null };` (`repair.js:9`). `state.parts` is the single source of truth, and `toggleCarPart(id)` (`:106–113`) is the only mutator:

```js
function toggleCarPart(id) {
    var idx = state.parts.indexOf(id);
    if (idx === -1) state.parts.push(id);
    else state.parts.splice(idx, 1);
    if (car3d) car3d.refreshSelection();
    renderPartsSummary();
    refreshConfirm();
}
```

**Step 1, «Datos del vehículo»** (subtitle «Completa la información para identificar tu vehículo.»). Two cards, «Vehículo» and «Propietario».

| Field | Input formatting (on `input`) | Valid when | Error message (shown on blur and on explainStep) |
|---|---|---|---|
| Marca `<select>` | From `CAR_CATALOG.brands`; toggles `is-placeholder` | non-empty | none (focus only) |
| Modelo `<select>` | Disabled until a make is chosen; refilled per make (`:832–844`) | non-empty and body known → `state.vehicle` set | none (focus only) |
| Año | `replace(/\D/g,"").slice(0,4)` (`:915`) | `/^[0-9]{4}$/` and `1980 ≤ y ≤ currentYear+1` (`:806–809`) | «Ingresa un año entre 1980 y {YEAR_MAX}.» |
| Placa | uppercase, `[^A-Z0-9]` stripped, max 6 characters, dash inserted after the 3rd (`:933–934`) | `/^[A-Z0-9]{3}-[A-Z0-9]{3}$/` (`:760`) | «Ingresa la placa con tres caracteres, guion y tres más. Por ejemplo ABC-123.» |
| Kilometraje (opcional) | digits only, max 7 | empty, or ≤ 2,000,000 | «El kilometraje no puede pasar de 2 000 000 km.» |
| Código de color (opcional) | none; maxlength 20; hint «Generalmente está en una etiqueta del vehículo.» | always | none |
| Nombres / Apellidos | maxlength 80 | `trim() !== ""` | none (focus only) |

- Choosing a model shows a preview card: photo → make logo on error → note when the silhouette is borrowed («En el paso 3 elegirás las piezas sobre el esquema Familiar…»).
- `setVehicle()` (`:822–830`) silently clears `state.parts` when the silhouette changes.
- An error appears on blur and clears as soon as the input becomes valid (the `field--invalid` check inside each input handler).

`setFieldValidity` (`:1045–1053`) is the single error painter:

```js
function setFieldValidity(input, errorEl, valid, message) {
    var field = input.closest(".field");
    if (field) field.classList.toggle("field--invalid", !valid);
    input.setAttribute("aria-invalid", valid ? "false" : "true");
    if (errorEl) {
        if (!valid && message) errorEl.textContent = message;
        errorEl.hidden = valid;
    }
}
```

Each error is `<p class="field__error" id="…Error" role="alert" hidden>`, referenced by `aria-describedby`.

**Step 2, «¿Qué nivel de acabado deseas?»**
- Three `<button role="radio">` cards in a `role="radiogroup"`. `selectQuality(card)` (`:974–983`) sets `state.quality = card.dataset.value` (`standard|premium|custom`).
- `?acabado=` preselects a card (`:993–999`).
- No roving tabindex and no arrow keys: every card is its own Tab stop. Fix this in the boat version.

**Step 3, «¿Qué zonas quieres pintar?»**
- Inside the 3D block: canvas wrap + overlay (progress bar, «Cargando modelo 3D…», error) + 5 view tabs + hint.
- The aside summary contains:
  - the heading «Piezas seleccionadas» and a count;
  - the list, where each row is name + price + a 24px «✕» button with aria-label «Quitar {label}»;
  - the nudge;
  - the estimate block (subtotal / discount / «Total estimado» with `aria-live="polite"` / note);
  - «Quitar todas».
- Below sits `<details id="partsPicker">` «Elegir las piezas de una lista» with a checkbox `<fieldset>`.
- Valid when `state.parts.length > 0`.

**Step 4, «¿Cómo podemos contactarte?»** (subtitle «Te enviaremos un presupuesto personalizado en 24 horas.»)

| Field | Formatting | Valid | Error |
|---|---|---|---|
| Departamento | sorted `localeCompare(…,"es")` | required | none (focus only) |
| Provincia | disabled until a department is chosen; refilled on change | required | none (focus only) |
| Teléfono | fixed `+51` prefix span; digits only, max 9 | `/^[0-9]{9}$/` | «Ingresa 9 dígitos después de +51.» |
| Email | strips `[^a-zA-Z0-9._%+@-]` while typing | `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` | empty: «Escribe tu email: ahí te enviamos tu código de seguimiento.»; malformed: «Ingresa un email válido, por ejemplo nombre@dominio.com.» |
| Notas (opcional) | maxlength 2000 | always | none |

`isStepValid(4)` uses `contactForm.checkValidity()` (`:438`) while `explainStep(4)` uses the JS regexes. That is two rule sources for the same step.

### 3.2 The never-disabled button, `explainStep`, `goTo`, focus, progress

```js
// repair.js:446-450
function refreshConfirm() {
    var valid = isStepValid(current);
    confirmBtn.setAttribute("aria-disabled", String(!valid));
    if (valid) setStepHint("");
}
// repair.js:551-558
confirmBtn.addEventListener("click", function () {
    if (!isStepValid(current)) { explainStep(current); return; }
    if (current < TOTAL_STEPS) goTo(current + 1);
    else submitRequest();
});
```

- `aria-disabled="true"` is styled grey with ink text (`styles.css:3719–3727`; contrast was fixed after white text came out at 1.86:1). The button is still clickable.
- `explainStep(step)` (`:460–501`):
  - paints every invalid field;
  - collects the first invalid control through `need(ok, control)` and focuses it;
  - sets the hint `<p id="stepHint" class="confirm-hint" role="status">` (red, right-aligned, referenced by the button's `aria-describedby`).
- Hint texts:
  - step 1: «Completa los datos marcados para continuar.»
  - step 2: «Elige un nivel de acabado para continuar.» (focuses the first card)
  - step 3: «Elige al menos una pieza: tócala en el vehículo o márcala en la lista.» (opens the checklist)
  - step 4: «Completa los datos marcados para enviar tu solicitud.»
- `refreshConfirm` runs on every `input` event of both forms and after every selection change. It clears the hint once the step is valid.
- **Label logic:** `CONFIRM_LABELS = { 1: "Guardar y continuar", 4: "Enviar solicitud" }` (`:4`); any other step gets «Continuar»; while sending, «Enviando…».

`goTo(step)` (`:516–542`):

```js
steps.forEach(function (s) { var match = Number(s.dataset.step) === step;
    s.classList.toggle("active", match); s.hidden = !match; });
updateProgress(step);
backLink.hidden = step === 1;
confirmBtn.textContent = CONFIRM_LABELS[step] || "Continuar";
current = step; setStepHint("");
if (step === 3) { carView3d.hidden = false; renderPartsPicker(state.vehicle);
    ensureCar3D(state.vehicle); if (car3d) car3d.resize(); renderPartsSummary(); }
refreshConfirm();
var heading = document.querySelector('.step[data-step="' + step + '"] h1');
if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
window.scrollTo({ top: 0, behavior: "smooth" });
```

- Initialisation calls `updateProgress(1)` and not `goTo(1)`, so focus is not stolen on page load. Keep that.
- «Atrás» (`#backLink`, `:544–549`) is ignored while `submitting`.

**Progress indicator**
- `updateProgress` (`:503–514`) puts `is-current` + `aria-current="step"` on the current dot, `is-done` on earlier dots, and `is-done` on each line whose `data-after` is lower than the step.
- In the wizard the dots are 32px squares. `::before` shows `attr(data-step)`, or «✓» when done. `::after` shows `attr(data-label)` below the dot (Vehículo / Acabado / Piezas / Contacto).
- The bar is sticky at `top: var(--header-h)` (`styles.css:3276–3381`) and becomes static when the viewport height is ≤560px.
- The footer is sticky at the bottom (`:3645–3658`).
- `scroll-padding` on the html element keeps focused fields clear of both bars (`:3393–3401`).
- The card widens on steps 2 and 3 through `:has(.step[data-step="2"].active)` (880px) and step 3 (1000px).

### 3.3 Success screen, copy, reset, lookup

**Submit (`:622–662`)**
- A `submitting` guard; both buttons disabled; label «Enviando…».
- Status 404/405/501 → the "no API on this host" message, which points to WhatsApp.
- Any other non-OK → `body.error` or «No pudimos enviar tu solicitud. Inténtalo nuevamente.»
- A `TypeError` from `fetch` → «No pudimos conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.»
- The success screen appears **only** after the server confirms.

**`showSuccess(id)` (`:664–682`)**
- Writes the code; pre-fills `#lookupId`.
- Hides the progress bar, back button, confirm button, footer and all steps; shows `#success`; focuses its `<h1 tabindex="-1">` «¡Solicitud enviada!».
- The code is shown in Archivo with `letter-spacing: 0.14em` (so it reads in groups but copies exactly).

**Copy (`:684–702`)**
- `navigator.clipboard.writeText` → «¡Copiado!» plus `is-copied` for 2000 ms, then back to «Copiar».
- If the clipboard is blocked, it fails silently: the code is still visible and selectable.

**Reset `#resetBtn` «Nueva solicitud» (`:704–743`)**
- Resets state, the forms, errors, departments and provinces.
- Hides the 3D block but keeps the viewer mounted (`refreshSelection()` + `resetView()`).
- Restores the bars, then `goTo(1)`.

**Lookup (`lookup.js`)**
- Input keeps digits only, max 10.
- On submit, a code that is not 10 digits gets «El código tiene 10 dígitos. Revísalo e inténtalo nuevamente.» and focus.
- `fetch(API_BASE + "/api/requests/" + code)`:
  - no JSON body + 404/405/501 → no-API message;
  - JSON 404 → server message;
  - success → `<dl>` with code, vehicle, first name, last name and a status pill with `data-status`.
- Only a rejected fetch counts as "offline". A `TypeError` while drawing the result → «No pudimos mostrar tu solicitud. Inténtalo nuevamente.»
- `?codigo=` auto-fills the field and runs the lookup (emails link to it, because mail apps dial bare 10-digit numbers).
- While running: button disabled and labelled «Consultando…».

### 3.4 Boat version, shared mechanics

**Hash routes in the single HTML**

| Hash | View |
|---|---|
| `#/` | home |
| `#/preventivo/1` … `#/preventivo/4` | wizard steps |
| `#/preventivo/inviata` | success |
| `#/stato` (optional `?codice=1234567890`) | lookup |

- A hash that does **not** start with `#/` (e.g. `#servizi`, `#contenuto`) is an in-page anchor. The router must show the home view and then `scrollIntoView` that id. Without this rule, every nav anchor breaks the router.
- **Guard:** entering step N redirects with `history.replaceState` to the first step whose `isStepValid` is false.
- **After success:** `location.replace('#/preventivo/inviata')`. While `submitted` is true, any step hash redirects to `inviata` until «Nuova richiesta».
- **On every view change:** set `document.title`, focus the view's `<h1 tabindex="-1">`, and scroll to top with `behavior: reducedMotion ? 'auto' : 'smooth'`. The original's `scrollTo` (`repair.js:541`) ignores reduced motion, because CSS `scroll-behavior` does not override an explicit JS `behavior`.
- Forward steps set `location.hash` (which pushes), so the browser Back button works. «Indietro» does the same with step n−1.
- Query parameters inside the hash (`#/preventivo/1?finitura=premium&loa=8`) are parsed with `new URLSearchParams(hash.split('?')[1])`.

**Kept mechanics**
- Never-disabled button + `explainStep`.
- Hint `role="status"`.
- Errors on blur, cleared as soon as the value is valid.
- Focus moves to the first invalid control.
- Heading focus on step change.
- Sticky progress bar and footer.
- Success shown only after confirmation. In the sketches, simulate it: 600 ms delay, then a demo code from `crypto.getRandomValues` (10 digits, first digit non-zero), labelled `.ph` "demo".

**One rules table**
- Define each field's rules once: `{ el, required, format(raw)→value, valid(value)→bool, message(value)→key }`.
- `isStepValid`, `explainStep` and the blur handlers all read from it. Remove HTML `pattern` attributes, or generate them from the table.
- Every required field gets an error `<p>`, including selects and name fields, which have none in the original.

**Radio cards** (boat type, finish): use the fan's roving tabindex with ArrowLeft/Right/Up/Down, and also Home/End.

**Progress**
- `<ol class="progress">` of `<li>` elements, each with a visible label and sr-only text «Passo 2 di 4, completato». Keep `aria-current="step"`.
- Labels: **Barca / Finitura / Zone / Contatti**.
- Optional: completed dots can be buttons that go back to that step.

**Hide the WhatsApp FAB on wizard views.** It would collide with the sticky footer's main button in the bottom-right corner.

**Labels**

| | Value |
|---|---|
| `CONFIRM_LABELS` | `{1: t('btn.saveContinue'), 4: t('btn.send')}`, default `t('btn.continue')` |
| Sending | `t('btn.sending')` |

| key | IT | EN | ES (Spain) | FR |
|---|---|---|---|---|
| btn.saveContinue | Salva e continua | Save and continue | Guardar y continuar | Enregistrer et continuer |
| btn.continue | Continua | Continue | Continuar | Continuer |
| btn.send | Invia richiesta | Send request | Enviar solicitud | Envoyer la demande |
| btn.sending | Invio in corso… | Sending… | Enviando… | Envoi en cours… |
| btn.back | Indietro | Back | Atrás | Retour |
| copy / copied | Copia / Copiato! | Copy / Copied! | Copiar / ¡Copiado! | Copier / Copié ! |
| reset | Nuova richiesta | New request | Nueva solicitud | Nouvelle demande |
| success.title | Richiesta inviata! | Request sent! | ¡Solicitud enviada! | Demande envoyée ! |
| success.code | Il tuo codice di monitoraggio | Your tracking code | Tu código de seguimiento | Votre code de suivi |
| lookup.title / submit / busy | Verifica la tua richiesta / Verifica / Verifica in corso… | Check your request / Check / Checking… | Consulta tu solicitud / Consultar / Consultando… | Suivre votre demande / Vérifier / Vérification… |

**Translation notes**
- Tone: IT «tu», EN «you», ES «tú», FR «vous». Whether Italian uses «tu» or «Lei» is the client's decision; flag it.
- The Spanish strings must be Spain/neutral, not Peruvian: «matrícula» not «placa», «móvil» not «celular», «pedir presupuesto» not «cotizar».
- Native review is needed for EN/ES/FR.

**i18n implementation**
- One `I18N = { it:{…}, en:{…}, es:{…}, fr:{…} }` object and `t(key, params)`.
- Static text uses `data-i18n="key"`; attributes use `data-i18n-attr="aria-label:key;placeholder:key2"`.
- Plurals use `new Intl.PluralRules(lang)`.
- The switcher is a `<select>` or button group labelled «Lingua / Language». It sets `<html lang>` and persists to `localStorage['cipressina.lang']`.
- Default: `navigator.language` if it is one of it/en/es/fr, otherwise `it`.
- On language change, re-render every dynamic string: button label, step hint, visible errors, summary, estimate, nudge, fan caption, view tabs, checklist labels.
- Prices always use `it-IT` formatting (section 4).

### 3.5 Boat step 1: «Dati della barca»

Subtitle: «Completa i dati per identificare la tua barca.» Two cards: «Barca» and «Proprietario».

| Field (id) | UI | Formatting | Rule | IT error |
|---|---|---|---|---|
| Tipo di barca `boatType` | radiogroup of 4 cards with SVG silhouettes: `rib` Gommone / RIB, `open` Open / day cruiser, `cruiser` Cabinato / fly, `sail` Barca a vela | n/a | required | «Scegli il tipo di barca: ci serve per mostrarti il modello 3D giusto.» |
| Cantiere `builder` | text + `<datalist>` of common builders (`.ph` list; Italian builders and the common French/German ones) | trim, collapse spaces, max 60 | 2–60 characters | «Indica il cantiere costruttore, ad esempio Beneteau.» |
| Modello `model` | text | trim, max 60 | 1–60 | «Indica il modello.» |
| Anno `year` | `inputmode="numeric"`, maxlength 4 | digits, max 4 | 4 digits, 1950 ≤ y ≤ currentYear+1 (`.ph` bounds) | «Inserisci un anno tra 1950 e {max}.» |
| Lunghezza fuori tutto (LOA, m) `loa` | `inputmode="decimal"`, suffix «m» shown like the `+51` prefix | keep digits and one `,` or `.`; max 2 integer + 2 decimal digits; store `Number(v.replace(',', '.'))`; display with a comma | 2.5 ≤ LOA ≤ 30 (`.ph`: the shop's real capacity is a research item) | «Inserisci la lunghezza in metri, tra 2,5 e 30 (es. 8,5).» |
| Immatricolazione `registered` | 2 radios: «Immatricolata» / «Natante (non immatricolata)» | n/a | required | «Indica se la barca è immatricolata o è un natante.» |
| Numero di immatricolazione `registration` | text; shown only if «Immatricolata» | uppercase, keep `A–Z 0–9` and spaces, collapse spaces, max 15 | if registered: `/^[A-Z0-9][A-Z0-9 ]{2,14}$/` (format `.ph`, to verify against current ATCN numbering) | «Inserisci la sigla di immatricolazione, ad esempio VE 1234 D.» |
| (natante + LOA > 10 m) | inline **note**, not an error (does not block) | n/a | n/a | «Oltre i 10 m le unità da diporto vanno immatricolate: controlla i dati.» (`.ph`, legal check) |
| Ore motore (opzionale) `engineHours` | `inputmode="numeric"` | digits, max 5 | empty or ≤ 99999 | «Le ore motore non possono superare 99.999.» |
| Dove si trova (opzionale) `berthKind` | select: In acqua (posto barca) / A terra (rimessaggio) / Su carrello | n/a | n/a | none |
| Porto o rimessaggio (opzionale) `berth` | text | max 80 | n/a | none |
| Nome della barca (opzionale) `boatName` | text | max 40 | n/a | none |
| Codice colore / gelcoat (opzionale) `colorCode` | text, hint «Spesso è nel manuale del cantiere.» (`.ph`) | max 20 | n/a | none |
| Nome / Cognome | text, `autocomplete` given-name / family-name | max 80 | trim non-empty | «Inserisci il nome.» / «Inserisci il cognome.» |

- **Summary card** (replaces the car photo): type silhouette SVG + «{builder} {model} · {loa} m · {year}». It appears once type, builder and model are filled. There are no photos and no third-party image service.
- **Changing `boatType` clears the zones** (equivalent to `setVehicle`, `:822`), and, unlike the original, announces it in a polite live region: «Le zone scelte sono state azzerate perché hai cambiato tipo di barca.»
- Changing LOA does **not** clear zones; the estimate simply recomputes.
- Step hint: «Completa i campi evidenziati per continuare.»

### 3.6 Boat step 2: «Che livello di finitura desideri?»

Subtitle: «Ogni livello include preparazione e verniciatura professionale.»
- Ids stay `standard | premium | custom` so the data shapes match the original. The home-page parameter becomes `finitura=`.
- Cards use the radiogroup pattern with roving tabindex.
- The «da» figure is computed from `PRICES.topsides[q]` (section 4), not hand-typed.

| id | IT name | Badge | «da» (placeholder) | Features (all `.ph`, to verify with the shop) |
|---|---|---|---|---|
| standard | Essenziale | none | da 60 €/m | Carteggiatura e primer; smalto poliuretanico bicomponente; finitura lucida standard |
| premium | Professionale | Più scelto | da 85 €/m | Preparazione completa e stuccatura; colore misurato con spettrofotometro; ciclo epossidico + poliuretanico; garanzia scritta di {N} anni |
| custom | Alta gamma (or «Yacht») | none | da 120 €/m | Rasatura e fairing; prova colore su provino; smalto e trasparente premium con filtro UV; applicazione in ambiente controllato (only if the booth fits boats); garanzia premium {N} anni |

Hint: «Scegli un livello di finitura per continuare.»

### 3.7 Boat step 3: «Quali zone vuoi verniciare?»

Subtitle: «Tocca le zone della barca che vuoi verniciare.»

**Layout:** same as the original. Stage (canvas wrap, 4:3 aspect, 1:1 under 760px) + view tabs + hint, with the aside summary beside it.

**View tabs** (`role="group"`, aria-label «Angolo di vista»): `bow` Prua, `starboard` Dritta, `stern` Poppa, `port` Sinistra, `top` Alto, `keel` Carena (low 3/4 view from below). See section 5.

**Hint:** «Tocca una zona della barca per selezionarla o toglierla. Usa i pulsanti per cambiare vista.»

**Summary**
- Heading «Zone selezionate»; count «1 zona» / «{n} zone».
- Empty: «Nessuna zona selezionata. Tocca la barca per sceglierne una.»
- Each row: label + `formatEUR(price)` + «✕» (aria-label «Rimuovi {label}»).
- «Rimuovi tutte».

**Nudge:** `discountHint(priced)` (section 4). Dashed while a next step exists; solid green with class `is-maxed` at the cap.

**Estimate**
- When `rate > 0`: «Subtotale» and «Sconto per {n} zone ({r}%)» with value «−{amount}» (U+2212 minus sign).
- «Totale stimato» `<strong>` (`aria-live="polite"`).
- Note: «Finitura {name}, calcolata su {loa} m. Prezzo indicativo: il cantiere conferma il preventivo dopo aver visto la barca.» Add «Non include {n} zone senza prezzo di listino.» only when there are unpriced zones.
- In the sketches, also add a visible `.ph` tag «prezzi segnaposto» (placeholder prices).

**Checklist fallback**
- `<details id="zonesPicker">` «Scegli le zone da un elenco», built from `BY_TYPE[boatType]`. Each checkbox calls `toggleZone(id)`.
- It opens automatically:
  - on `onLoadError`;
  - when the module import fails twice («Impossibile caricare il visore 3D. Scegli le zone dall'elenco qui sotto.»);
  - when mount throws («Impossibile aprire il visore 3D. Scegli le zone dall'elenco qui sotto.»);
  - when `explainStep(3)` runs.

**Hint (explainStep):** «Scegli almeno una zona: toccala sulla barca o selezionala dall'elenco.»

**Host lifecycle:** mirror `ensureCar3D` (`repair.js:317–421`):
- one cached `import('./boat3d.js')`;
- `mountId` race guard;
- on import failure: drop the promise, bump `retries` so the next import uses `?reintento=N`, retry automatically once after 600 ms, then fall back to the checklist;
- on boat-type change: `destroy()` then replace the canvas with a fresh element (a destroyed context cannot be reused);
- call `resize()` when returning to step 3.

### 3.8 Boat step 4: «Come possiamo contattarti?»

Subtitle: «Ti invieremo un preventivo personalizzato entro 24 ore.» (the 24 h figure is `.ph`).

| Field | UI | Formatting | Rule | IT error |
|---|---|---|---|---|
| Regione | select, 20 regions sorted `localeCompare(…, 'it')`, plus a final «Estero / Fuori Italia» option (recommended because of the EN/ES/FR UI) | n/a | required | «Scegli la regione.» |
| Provincia | disabled until a region is chosen; filled from `IT_REGIONI[regione]`, sorted. With «Estero» it becomes a «Paese» text input | n/a | required | «Scegli la provincia.» |
| Telefono | fixed `+39` prefix span; `inputmode="tel"` | digits only, max 11 | `/^(3\d{8,9}\|0\d{5,10})$/` (mobile 3xx with 9–10 digits; landline 0… with 6–11 digits) | «Inserisci un numero italiano valido dopo +39: cellulare (3…) o fisso (0…).» |
| (if «Estero») Telefono internazionale | prefix not fixed | keep `+` and digits | `/^\+\d{8,15}$/` | «Inserisci il numero con il prefisso internazionale, ad esempio +33 6 12 34 56 78.» |
| Email | same filtering and regex as the original | n/a | required | empty: «Scrivi la tua email: lì ti inviamo il codice di monitoraggio.»; malformed: «Inserisci un'email valida, ad esempio nome@dominio.it.» |
| Note (opzionale) | textarea, max 2000; placeholder «Danni da riparare, tempi, dove si trova la barca o altri dettagli utili» | n/a | n/a | none |
| Privacy | line linking to an `.ph` informativa; a checkbox only if the client's legal advice requires one | n/a | n/a | n/a |

- Data file `regioni.js`: `window.IT_REGIONI = { "Veneto": ["Belluno","Padova","Rovigo","Treviso","Venezia","Verona","Vicenza"], … }`. The full 20 regions / 107 provinces list is a research item.
- Payload shape (logged in the sketches, posted later):
  `{ lang, boatType, quality, zones, builder, model, year, loa, registered, registration, engineHours, berthKind, berth, boatName, colorCode, firstName, lastName, region, province, phone: "+39"+digits | intl, email, notes }`
- Step hint: «Completa i campi evidenziati per inviare la richiesta.»

---

## 4. Estimate and discount logic (`src/parts.js`)

### 4.1 Original data shapes

**Wrapper** (`:24–29`): exported as `window.AUTOCOLOR_PARTS` in the browser and via `module.exports` in Node.

| Export | Shape |
|---|---|
| `LABELS` | `{ nodeId: "Spanish name" }`, 26 ids |
| `BY_VEHICLE` | `{ van\|wagon\|pickup\|suv: [ids…] }`, in the viewer's order (a copy of `VEHICLE_MODELS[*].parts`) |
| `PRICES` | `{ group: { label, standard, premium, custom } }`, 9 groups, values in soles (`:122–132`) |
| `PRICE_GROUP_OF` | `{ nodeId: group }` (`:143–170`) |
| `QUALITY_NAMES` | `{ standard: "Económico", premium: "Profesional", custom: "Alta gama" }` |

```js
// parts.js:177-182
var DISCOUNT_STEPS = [0, 0, 5, 7, 9, 10];
function discountRate(count) {
    if (!(count > 0)) return 0;
    return DISCOUNT_STEPS[Math.min(count, DISCOUNT_STEPS.length - 1)];
}
// parts.js:191-196
function price(id, quality) {
    if (!has.call(PRICE_GROUP_OF, id)) return null;
    var row = PRICES[PRICE_GROUP_OF[id]];
    if (quality !== "standard" && quality !== "premium" && quality !== "custom") return null;
    return row[quality];
}
// parts.js:231-250
estimate: function (ids, quality) {
    var subtotal = 0, priced = 0, unpriced = 0;
    (ids || []).forEach(function (id) {
        var value = price(id, quality);
        if (value === null) unpriced++; else { subtotal += value; priced++; }
    });
    var rate = discountRate(priced);
    var discount = Math.round(subtotal * rate / 100);
    return { subtotal, priced, rate, discount, total: subtotal - discount, unpriced };
}
// parts.js:216-225
discountHint: function (count) {
    if (!(count > 0)) return "";
    var next = discountRate(count + 1);
    if (next === discountRate(count)) return "Tienes el descuento máximo por varias piezas: " + next + "%.";
    return count === 1 ? "Pinta 2 piezas o más y te descontamos " + next + "%."
                       : "Agrega 1 pieza más y el descuento sube a " + next + "%.";
}
// parts.js:209-211
formatSoles: function (amount) { return "S/ " + (soles ? soles.format(amount) : String(amount)); }
// soles = new Intl.NumberFormat("es-PE")
```

**Semantics**
- The discount comes off the subtotal, so list rows keep showing list prices.
- Unpriced panels add nothing and do not count towards the discount.
- The discount is rounded to whole units.
- `label()` uses `hasOwnProperty`, so an id like `constructor` cannot resolve to an inherited Object method.

**Duplication in the original**
- `src/discounts.js` (`estimateRepair`, `estimateHint`, `promoLabel`) layers the boss's server rules on top; the larger rate wins per panel. **Do not carry it over.**
- `home.js:131–133` has its own `soles()` formatter.
- The home discount list is hand-written HTML (`index.html:433–438`).

Both duplications are removed in the boat version.

### 4.2 Boat equivalent: `zones.js` (`window.CIPRESSINA_ZONES`; same UMD wrapper)

```js
var PLACEHOLDER = true; // every figure below is a placeholder until the shop confirms

var LABELS = { // i18n: one map per language; IT shown, EN in comments
  bottom: "Carena (opera viva)",              // Bottom (antifouling)
  keel: "Chiglia / bulbo",                    // Keel
  boot_stripe: "Linea di galleggiamento",     // Boot stripe
  topsides_port: "Murata sinistra",           // Port topside
  topsides_starboard: "Murata dritta",        // Starboard topside
  transom: "Specchio di poppa",               // Transom
  deck: "Coperta",                            // Deck
  cockpit: "Pozzetto",                        // Cockpit
  superstructure: "Tuga / sovrastruttura",    // Cabin top / superstructure
  flybridge: "Flybridge",                     // Flybridge
  console: "Consolle",                        // Console
  tube_port: "Tubolare sinistro",             // Port tube
  tube_starboard: "Tubolare dritto"           // Starboard tube
};

var BY_TYPE = { // copy of BOAT_TYPES[*].zones in boat3d.js, same order
  rib:     ["bottom","tube_port","tube_starboard","transom","deck","console"],
  open:    ["bottom","boot_stripe","topsides_port","topsides_starboard","transom","deck","cockpit","console"],
  cruiser: ["bottom","boot_stripe","topsides_port","topsides_starboard","transom","deck","cockpit","superstructure","flybridge"],
  sail:    ["bottom","keel","boot_stripe","topsides_port","topsides_starboard","transom","deck","cockpit","superstructure"]
};

// EUR per metre of LOA, per finish; `min` is the floor per zone. ALL PLACEHOLDER.
var PRICES = {
  antifouling:    { standard: 30, premium: 40, custom: 55,  min: 150 },
  stripe:         { standard:  8, premium: 12, custom: 18,  min: 120 },
  topsides:       { standard: 60, premium: 85, custom: 120, min: 300 }, // per side
  transom:        { standard: 25, premium: 35, custom: 50,  min: 150 },
  deck:           { standard: 50, premium: 70, custom: 95,  min: 250 },
  superstructure: { standard: 45, premium: 65, custom: 90,  min: 250 },
  keel:           { standard: 20, premium: 28, custom: 40,  min: 150 },
  small:          { standard: 10, premium: 14, custom: 20,  min: 100 },
  tubes:          { standard: 25, premium: 35, custom: 45,  min: 200 }  // per side
};
var PRICE_GROUP_OF = {
  bottom: "antifouling", boot_stripe: "stripe", keel: "keel",
  topsides_port: "topsides", topsides_starboard: "topsides",
  transom: "transom", deck: "deck", cockpit: "deck",
  superstructure: "superstructure", flybridge: "superstructure",
  console: "small", tube_port: "tubes", tube_starboard: "tubes"
};
var DISCOUNT_STEPS = [0, 0, 5, 7, 9, 10]; // PLACEHOLDER, same curve as Autocolor

function price(id, quality, loa) {
  if (!has.call(PRICE_GROUP_OF, id)) return null;
  if (quality !== "standard" && quality !== "premium" && quality !== "custom") return null;
  if (!(loa > 0)) return null;
  var row = PRICES[PRICE_GROUP_OF[id]];
  return Math.max(row.min, Math.round(row[quality] * loa));
}
function estimate(ids, quality, loa) {
  // identical algorithm to parts.js:231-250, passing loa to price()
  // returns { subtotal, priced, rate, discount, total, unpriced, loa, placeholder: PLACEHOLDER }
}
var eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
function formatEUR(n) { return eur.format(n); }  // "1.250 €" (U+00A0 before the €)
```

**Formatting**
- `it-IT` prints the euro sign after the number, separated by a non-breaking space: «1.250 €». Do not concatenate a currency sign yourself.
- Keep `it-IT` even when the UI is EN/ES/FR (client decision; flag it).
- Verify grouping before using any other locale: `es-ES` does not group 4-digit numbers (it prints «1250»).

**Discount hint** (`discountHint(count)`, translated through `t()`)
- count = 1 → «Vernicia 2 zone o più e ti scontiamo il {next}%.» / EN «Paint 2 or more zones and get {next}% off.»
- next = current → «Hai lo sconto massimo per più zone: {next}%.» / «You have the maximum multi-zone discount: {next}%.»
- otherwise → «Aggiungi 1 zona e lo sconto sale al {next}%.» / «Add 1 more zone and the discount rises to {next}%.»

**Home price sentence**
- «Verniciare [2] zone su una barca di [8 m] con finitura [professionale] costa da 1.140 €», with «~~1.200 €~~ senza lo sconto del 5% per più zone».
- The base is `PRICES.topsides[q]`.
- Selects: count 1–6, LOA 5 / 6 / 8 / 10 / 12 / 15 m, finish.
- Submit «Seleziona le zone in 3D» → `#/preventivo/1?finitura=<q>&loa=<m>` (prefills LOA in step 1).
- Static HTML holds the default result so it is true without JS.
- The discount list `5% / 7% / 9% / 10%` is **rendered from `DISCOUNT_STEPS`**, with the static HTML as fallback.

---

## 5. `boat3d.js`: an ES module mirroring `carVisual.js`, with procedural boats

### 5.1 Options and controller (mirror `carVisual.js:260–288`, `:1097–1170`)

```js
export const BOAT_TYPES = { rib, open, cruiser, sail }; // { nominalLOA, zones:[…], build(materials) → THREE.Group }
export function mountBoat3D(options) → controller
```

| Option | Required | Meaning (original equivalent) |
|---|---|---|
| `boatType` | yes | Key into `BOAT_TYPES`; an unknown key throws (`:290–291`) |
| `canvasEl`, `canvasWrapEl` | yes | Canvas, and the element whose size it follows |
| `overlayEl`, `errorEl`, `loadingLabelEl`, `progressBarEl` | no | Loading overlay. Procedural builds are synchronous, so the overlay only covers the module import; it is hidden at the end of mount |
| `buttonsEl` | no | Container of `[data-view]` buttons |
| `isZoneSelected(id)`, `onZoneToggle(id)` | yes when `interactive` | The host's selection (`isPartSelected` / `onPartToggle`) |
| `onLoadError()` | no | Called if the build throws (replaces the GLB failure) |
| `interactive` | default `true` | `false` binds no pointer handlers (`:1059–1065`) |
| `spin` | default `false` | Turntable (`:698–733`) |
| `initialView` | default `'bow'` | New; the hero uses `'threeQuarter'` |
| `hullColor` | default `'#f4f3ee'` | New; sets `hullMaterial` at build time |
| `toneMapping` | default `THREE.ACESFilmicToneMapping` | New; the hero may pass `THREE.NeutralToneMapping` |
| `loadErrorText` | default IT text | «Impossibile mostrare il modello 3D. Scegli le zone dall'elenco qui sotto.» |

| Controller method | Behaviour |
|---|---|
| `boatType` | property |
| `loadFailed()` | `true` if the build threw |
| `resize()` | → `onResize()` |
| `refreshSelection()` | re-read `isZoneSelected` for every zone (`:1113–1120`) |
| `resetView()` | `flyToView(initialView)` |
| `setView(view)` | new; public `flyToView` |
| `setHullColor(hex, { animate })` | new (section 2.2) |
| `destroy()` | as `:1129–1169` |

**Throwing vs reporting**
- Only two things throw synchronously: an unknown type, and `new WebGLRenderer` failing (no WebGL). The host catches these and opens the checklist.
- Geometry build errors are caught inside mount: set `loadFailed = true`, run `showError(loadErrorText)`, call `onLoadError()`. This mirrors the final branch of `retryOrFail` (`:821–824`).
- In development, `console.assert` that `BOAT_TYPES[t].zones` equals `CIPRESSINA_ZONES.BY_TYPE[t]`. This replaces `tools/verify-3d.mjs`.

### 5.2 Scene, renderer, lights: copy these values exactly (`carVisual.js:232–239, 296–323`)

```js
const FOV_DEG = 45;                 // :232
const CAMERA_PADDING = 1.2;         // :233
const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.05, 500);   // :303
camera.position.set(6, 3, 8);                                         // :304
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true }); // :306
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));        // :307
renderer.outputColorSpace = THREE.SRGBColorSpace;                    // :308
renderer.toneMapping = THREE.ACESFilmicToneMapping;                  // :309
renderer.toneMappingExposure = 1.05;                                 // :310
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8672, 0.95));      // :317
const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);          // :318
keyLight.position.set(5, 8, 6);                                      // :319
const rimLight = new THREE.DirectionalLight(0xffffff, 1.1);          // :321
rimLight.position.set(-6, 4, -7);                                    // :322
```

- No `scene.background`: the canvas is transparent.
- No `OrbitControls`.
- After building, set the clipping planes from the bounding box (`:894–907`):

```js
const box = new THREE.Box3().setFromObject(root);
box.getCenter(center);
const size = box.getSize(new THREE.Vector3());
lengthFB = extentAlong(FRONT_AXIS, size); widthLR = extentAlong(LEFT_AXIS, size); heightUD = extentAlong(UP_AXIS, size);
const radius = size.length() / 2;
camera.near = Math.max(radius * 0.01, 0.01);
camera.far = radius * 20;
camera.updateProjectionMatrix();
```

**Boat frame (canonical, in metres)**
- `FRONT_AXIS = (1,0,0)` (bow), `LEFT_AXIS = (0,0,1)` (port), `UP = (0,1,0)`.
- Waterline at `y = 0`.
- The boat is shown out of the water with no ground plane, so the bottom is visible.

**Materials**
- `MeshStandardMaterial`, or `MeshPhysicalMaterial` with `clearcoat: 1, clearcoatRoughness: 0.1` for a gelcoat sheen.
- Apply the original clamps: `roughness = min(r, 0.3)` and `metalness 0` (`clampMaterial`, `:396–406`).
- Default `bodyColor [0.93, 0.93, 0.94]` (`:73`) goes to deck and superstructure.
- `hullMaterial` is shared by the topsides and the transom.
- `antifoulingMaterial` default `#1d2a44` (`.ph`).
- `stripeMaterial` default `#1f4f9a` (`.ph`).

### 5.3 Procedural build rules

- Each zone is **its own `Mesh` with its own `BufferGeometry`**, with `mesh.name = zoneId` and `mesh.userData.zone = zoneId`. A raycast hit then maps directly to a zone; no `resolvePaintMesh` is needed.
- Separate geometries also mean normals are not shared across zone boundaries, so seams read like the car's panel gaps.
- **Hull:** loft cross-sections along `x ∈ [0, LOA]` from three profile functions: half-breadth `b(x)`, sheer height `s(x)`, keel depth `k(x)`, with a V or deep-V section. Split vertically into:
  - `bottom` (keel → waterline, both sides merged);
  - `boot_stripe` (waterline → waterline + 0.06·freeboard, both sides);
  - `topsides_port` / `topsides_starboard` (stripe → sheer).
- `transom`: flat polygon at `x = 0` between the port and starboard sections.
- Deck from the sheer outline, split at `x ≈ 0.4·LOA` into `cockpit` (aft) and `deck` (fore). `superstructure` and `flybridge` are extruded rounded rectangles.
- Sail adds `keel` (a thin extruded foil) and a mast. Rib uses `TubeGeometry` along a U-shaped curve, split at the bow tip into `tube_port` / `tube_starboard`, plus a `console` box.
- Non-zone meshes (mast, rails, windows, outboard, engine) are added too. They are pickable as **blockers** but not entered in `overlayFor` (mirrors `:935–938`).
- `computeVertexNormals()` on every geometry.

### 5.4 On-demand rendering (`:331–338`), copy verbatim

```js
let renderQueued = null;
function requestRender() {
  if (renderQueued !== null || destroyed) return;
  renderQueued = requestAnimationFrame(() => {
    renderQueued = null;
    if (!destroyed) renderer.render(scene, camera);
  });
}
```

Every change calls this: camera placement, overlay visibility, resize, colour tween frames, context restored. There is no permanent loop except `spin`.

### 5.5 Camera presets from the bounding box (`:256–258, 466–471, 523–546`)

```js
function extentAlong(axis, size) {
  return Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
}
function fitDistance(horiz, vert, fovDeg, aspect, padding) {
  const fov = THREE.MathUtils.degToRad(fovDeg);
  const dVert = (vert / 2) / Math.tan(fov / 2);
  const dHoriz = (horiz / 2) / (Math.tan(fov / 2) * aspect);
  return Math.max(dVert, dHoriz) * padding;
}
// computePresets()
const distFB  = fitDistance(widthLR, heightUD, FOV_DEG, aspect, CAMERA_PADDING) + lengthFB / 2;
const distLR  = fitDistance(lengthFB, heightUD, FOV_DEG, aspect, CAMERA_PADDING) + widthLR / 2;
const distTop = fitDistance(widthLR, lengthFB, FOV_DEG, aspect, CAMERA_PADDING) + heightUD / 2;
spinRadius = Math.max(distFB, distLR);
presets = {
  front: center.clone().addScaledVector(FRONT_AXIS, distFB),
  back:  center.clone().addScaledVector(FRONT_AXIS, -distFB),
  left:  center.clone().addScaledVector(LEFT_AXIS, distLR),
  right: center.clone().addScaledVector(LEFT_AXIS, -distLR),
  top:   center.clone().addScaledVector(UP_AXIS, distTop),
};
```

**Boat names** (rename the keys, same math):
- `bow` = front, `stern` = back, `port` = left, `starboard` = right, `top` = top.
- Add:
  - `keel` = `center + dir * max(distFB, distLR)` with `dir = normalize(-LEFT·cos40° − UP·sin40°)` (low starboard 3/4 view of the bottom);
  - `threeQuarter` = `dir = normalize(FRONT·cos35° + LEFT·sin35°)` lifted 16°, at `spinRadius`.

**Buttons** (`:561–568`): `syncViewButtons()` toggles `is-active` and `aria-pressed` on every `[data-view]`. Bindings are kept so `destroy()` can unbind them (`:672–676`).

**`upHintFor`** (`:503–510`), copy verbatim. It blends world-up into `FRONT_AXIS` with `smoothstep(|forward·UP|, 0.6, 0.97)`, which prevents the flip when looking straight down (or up, for `keel`).

### 5.6 Fly animation (`:573–575, 589–667`)

```js
const MS_PER_QUARTER_TURN = 620; const MIN_FLIGHT_MS = 420; const MAX_FLIGHT_MS = 1150; // :242-244
function easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }                 // :573-575
// flyToView(view): claim the view first (currentView, syncViewButtons) so a 2nd click redirects mid-flight
const waypoints = fromDir.dot(toDir) < -0.9 ? [fromDir, UP_AXIS.clone(), toDir] : [fromDir, toDir]; // :614-616
const duration = THREE.MathUtils.clamp(
  MS_PER_QUARTER_TURN * (totalAngle / (Math.PI / 2)), MIN_FLIGHT_MS, MAX_FLIGHT_MS);  // :632-633
// each frame (:637-666): t = min(1,(now-start)/duration); eased = easeInOutSine(t);
// walk waypoints by angle travelled; slerpDirection(waypoints[leg], waypoints[leg+1], …, flightDir);
// flightPos = center + flightDir * lerp(fromRadius, toRadius, eased); placeCamera(flightPos);
// last frame: placeCamera(positionForView(view) || target)  // the preset as it is NOW (resize-safe)
```

- `prefersReducedMotion()`, or `totalAngle < 1e-4`, makes the camera jump straight to the target (`:626–630`).
- Copy `slerpDirection` (`:488–495`) and `placeCamera` (`:515–521`, which sets `camera.up = upHintFor(forward)`, positions and `lookAt(center)`, then calls `requestRender()`) verbatim.
- **Required change for boats:** the antipodal routing waypoint is always `UP_AXIS` (`:615`). That is fine for car views, but a `top` ↔ underside pair would route through `UP`, which is collinear with one end and degenerate. Use:

```js
const via = Math.abs(fromDir.dot(UP_AXIS)) > 0.9 || Math.abs(toDir.dot(UP_AXIS)) > 0.9 ? FRONT_AXIS : UP_AXIS;
```

### 5.7 Raycasting, hover, selection overlays (`:235–239, 446–464, 969–1065`)

```js
const HOVER_COLOR = 0x299fdf;    const HOVER_OPACITY = 0.35;      // :235-236
const SELECTED_COLOR = 0xc9302a; const SELECTED_OPACITY = 0.55;   // :237-238
const HOVER_THROTTLE_MS = 50;                                     // :239
function makeOverlay(mesh, color, opacity) {                      // :446-464
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const overlayMesh = new THREE.Mesh(mesh.geometry, mat);
  overlayMesh.visible = false;
  overlayMesh.renderOrder = 999;
  overlayMesh.raycast = () => {};
  mesh.add(overlayMesh);
  return overlayMesh;
}
```

- Build `pickable` from every visible mesh **before** any overlay exists. For each zone mesh, create a hover overlay and a selected overlay and store `overlayFor.set(mesh, { hoverOverlay, selectedOverlay, id })`. Set `selectedOverlay.visible = isZoneSelected(id)` (`:938–951`).
- Picking: pointer → NDC from `getBoundingClientRect` (`:972–976`); `raycaster.intersectObjects(pickable, false)`; nearest hit (`:978–983`).
- `onPointerMove` (`:986–1012`):
  - **mouse only** (`event.pointerType !== 'mouse'` returns);
  - throttled to 50 ms;
  - toggles the hover overlay only for unselected zones;
  - toggles the canvas class `hoverable` (CSS `cursor: pointer`).
- `onPointerClick` (`:1014–1027`): `onZoneToggle(id)`, then read back `isZoneSelected(id)`. Set `selectedOverlay.visible = sel` and `hoverOverlay.visible = !sel && mesh === hoveredMesh`.
- `onPointerUp` clears hover for non-mouse pointers. `pointercancel` and `pointerleave` clear hover (`:1038–1054`). This prevents a deselected tapped panel from staying lit, because `pointerup` fires before `click`.

**Pointer vs drag**
- **The original has no drag discrimination**, because it has no drag: the camera moves only through buttons, and `click` is the only toggle.
- Touch scrolling over the canvas works because `touch-action` is not set and a scroll never fires `click`.
- Keep it that way in the sketches (buttons only).
- If drag-to-orbit is ever added: record `pointerdown {x, y, t}`, ignore the `click` when the pointer moved more than 6 CSS px, and set `touch-action: pan-y` on the canvas so vertical page scrolling survives.

### 5.8 Resize, destroy, spin, errors

**Resize** (`:346–355`, `:1070–1089`)
- `resizeRenderer()` reads the wrapper's `clientWidth/Height`, returns early on 0, then `setSize(w, h, false)`, aspect, `updateProjectionMatrix`, `requestRender`.
- `onResize()` recomputes the presets and re-places the camera on `currentView` unless it is flying or spinning.
- A `ResizeObserver` watches `canvasWrapEl`, falling back to `window` resize.
- `webglcontextrestored` triggers `requestRender`.

**Spin** (`:250–251`, `:698–733`)
- `SPIN_MS_PER_TURN = 20000`, `SPIN_TILT_DEG = 16`.
- `spinBase = normalize(FRONT·cos(tilt) + UP·sin(tilt))`; each frame `angle = (now − start) / 20000 · 2π` (clock-based, not frame-counted); rotate `spinBase` around `UP`; place at `center + dir·spinRadius`.
- Under reduced motion: the static preset, no loop.
- Boat additions:
  - optional `spinStartDeg` so the hero starts at the three-quarter view;
  - `pauseSpin()` / `resumeSpin()` for the hero's `IntersectionObserver` and `visibilitychange`.

**Destroy** (`:1129–1169`), copy the order:
1. `destroyed = true`; stop spin; cancel a queued frame and any colour tween.
2. Disconnect the observer.
3. Remove the context listener, the 5 pointer listeners and the view-button handlers.
4. `scene.traverse`: dispose each geometry (a double dispose is a no-op) and each material, plus any texture found on its keys.
5. `scene.clear()`; clear `pickable` and `overlayFor`.
6. `renderer.dispose(); renderer.forceContextLoss()`.

After that the host must swap in a fresh canvas.

**Errors**
- The GLB stall watchdog and `?reintento=` model retry (`:790–846`) do **not** apply: there is no download.
- The host-side import retry (`repair.js:345–420`) **does** apply.
- Overlay text while the module imports: «Caricamento del modello 3D…».

---

## 6. UX behaviours

### Keep

- **Mobile menu** (`home.js:13–43`, `repair.js:1108–1130`):
  - the aria-label says what the next press does («Apri il menu» / «Chiudi il menu»);
  - `aria-expanded` and `aria-controls`;
  - tapping a link closes it, as do a click outside and Escape (Escape also returns focus to the toggle);
  - panel `position: fixed` at `top: calc(var(--header-h) + 4px)`, with a 0.22s fade/slide.
  - Implement it once and share it between views.
- **Accessibility**
  - skip link; `:focus-visible` 2px ink outline;
  - inputs at least 16px (stops iOS zoom, `styles.css:1106`);
  - tap targets at least 24px (`:896–898`);
  - text tokens at 4.5:1 (`--text-faint`, which has a separate value on the grey ground);
  - `prefers-contrast: more` thickens borders (`:1315–1326`);
  - `aria-describedby` on errors and hints; `aria-invalid`;
  - live total; heading focus on view change; sticky-bar-aware `scroll-padding`.
- **Reduced motion:** a global collapse of durations plus targeted overrides. Extend it to the JS smooth scroll, the colour tween, camera flights and spin.
- **Floating WhatsApp:** `position: fixed; right/bottom 18px; 54px circle; #25d366; z-index 45; box-shadow 0 8px 22px rgba(27,33,48,.28)`, with an aria-label (`styles.css:3118–3142`). Hide it on wizard views.
- **Progressive enhancement:** the home page is complete without JS; static HTML holds true default values (price sentence, discount list, footer year).
- **Error tone:**
  - second person; say what to do, with an example;
  - an empty field and a malformed field get different messages;
  - say why a field is needed (email → tracking code);
  - never "error"/"invalid input" jargon;
  - distinguish offline («controlla la connessione») from a server message from "no service here, use WhatsApp".
- **Visual approach from `design/rebrand`:**
  - Direction A «Laboratorio» was chosen: white, plus one ink taken from the logo (`#262D40`); square corners; hairline grids instead of floating cards; one ink block (the footer, the recommended tier, the trade band); uppercase tracked labels for codes; "the brand is one colour; the colour belongs to the paint" (`Brand.dc.html`).
  - The shipped home page then moved to a "fan deck" look (`styles.css:1338–1369`): a single variable font (Anybody), a grey ground `#e9ebea` with white sections, 2–4px radii, and grey tier chips.
  - B («Cabina», dark) and C («Carta de color», huge lowercase type with pill buttons) were rejected.
  - Use these as the three sketch directions if helpful. Cipressina's brand colour and logo are placeholders.
- **Proof photos:** each sits alone next to the claim it proves, with no gallery section.

### Do not carry over

- **Peru-specific:**
  - `PERU_DEPARTMENTS` / `cities.js`; the `+51` prefix with 9 digits;
  - plate `ABC-123`; soles `S/` with `es-PE`;
  - RUC; Yape; the Ayacucho address, map, hours and phone `+51 935 646 304` (4 copies: `index.html` ×3, `repair.js:583`, `lookup.js:47`);
  - FAQ copy about the Ayacucho sun; Sherwin-Williams warranty terms; the «+15 años en Europa», «+200 vehículos» and «5 años» stats.
- **imagin.studio:** `window.AUTOCOLOR_CAR_IMAGE_CUSTOMER` (`config.js`), `carPhotoUrl` (`repair.js:779–792`); also the stock model photos, make logos and `carModels.js`.
- **Server-dependent pieces:**
  - `POST /api/requests`, `GET /api/requests/:id`, `/api/discounts`;
  - `discounts.js` (boss rules, `watch()`), the `#ofertas` band and the `<!-- offers.css -->` marker;
  - `API_BASE`, the API-missing branch (the sketches simulate instead);
  - email deep links (`?codigo=`); the workshop panel; the matizado page, trade band and header button.
- **GLB pipeline:** meshopt, `VEHICLE_MODELS` quirks, the stall watchdog, `X-File-Size`, `tools/verify-3d.mjs`.
- **Hero masking:** `suv-paint-mask.webp`, `tools/build-paint-mask.py`, the dual-layer filter/tint.

---

## 7. Proposed information architecture for the boat site

Single HTML per sketch. Views: `#/` home, `#/preventivo/1–4`, `#/preventivo/inviata`, `#/stato`.

| # | Section (anchor) | IT heading (proposal) | Needs from research | Placeholder if missing |
|---|---|---|---|---|
| 0 | Header | n/a | Cipressina logo (SVG), brand colour, legal name | Wordmark «Carrozzeria Cipressina» set in the display font; ink `#262D40` |
| 1 | Hero (fan + 3D boat) | «Come appena varata.» | Real claims for the lede (spectrophotometer? booth? paint system brand?), WhatsApp number | Lede `.ph`; WA `+39 ⟨…⟩` `.ph`; SVG boat poster |
| 2 | Servizi `#servizi` | «Tutto ciò che rimette a nuovo la tua barca» | Which marine services the shop actually offers (a car body shop: confirm boats at all), maximum LOA, haul-out/transport capability (Martellago is inland, so trailer logistics matter), booth dimensions | 6 cards `.ph`: Verniciatura completa scafo; Verniciatura a zone; Antivegetativa; Riparazione gelcoat e graffi; Lucidatura e protezione; Cambio colore |
| 3 | Come funziona `#come-funziona` | «Dal preventivo al varo, in quattro passi» | Turnaround promise (24 h?) | 4 steps: Registra la barca / Scegli la finitura / Seleziona le zone in 3D / Ricevi il preventivo |
| 4 | Finiture `#finiture` | «Tre modi di farlo bene» / «Più zone, meno paghi» | Real price list per metre and tier, discount policy, warranty years, materials per tier | Price sentence + 3 tiers + discount steps, all `.ph`, generated from `zones.js` |
| 5 | Perché noi `#chi-siamo` | «Verniciare bene è, soprattutto, preparare bene» | Years in business, number of boats, certifications, team, workshop photos (each next to its claim) | Facts and stats `.ph`; image slots with `.ph` captions |
| 6 | FAQ `#domande` | «Prima di affidarci la tua barca» | Answers from the shop | Questions `.ph`: Quanto dura un lavoro? Dovete vedere la barca? Ogni quanto rifare l'antivegetativa? Gelcoat o verniciatura? Vi occupate di alaggio e trasporto? Che garanzia date? Qual è il periodo migliore (rimessaggio invernale)? Quali pagamenti accettate (bonifico, carta, contanti)? |
| 7 | Contatti `#contatti` | «Chiedi il preventivo e prenota il tuo posto in cantiere» | Exact address in Martellago (VE), phone, email, hours, Google Maps place, premises photo | All `.ph`. The map is **click-to-load** (no iframe until consent: GDPR) |
| 8 | Footer | n/a | Ragione sociale, P.IVA, privacy and cookie policy URLs | `.ph`; «© {year}» filled by JS |
| 9 | Verifica richiesta `#/stato` | «Verifica la tua richiesta» | Real status vocabulary | Demo statuses `.ph`: ricevuta, alaggio, trasporto, preparazione, verniciatura, antivegetativa, varo, pronta, consegnata, annullata |

Also self-host fonts and three.js rather than pulling them from Google or a CDN (GDPR, and it matches the original's vendoring). Sketches may use a pinned `three@0.169.0` CDN URL if needed.

---

## 8. Prioritised improvements (fix these while porting)

1. **Router vs anchors.** Hashes that do not start with `#/` must stay in-page anchors, or every nav link breaks the hash router.
2. **Fan strips lose their accessible name on phones and short laptops.** `.fan__name { visibility: hidden }` (`styles.css:1870–1881`) removes the only text from the accessibility tree, and the shades are `aria-hidden`. Use a clip-based visually-hidden style or `aria-label` instead.
3. **One validation table per field,** read by `isStepValid`, `explainStep` and the blur handlers. Today step 4 validity uses `checkValidity()` and the HTML `pattern`, while the explanation uses separate regexes (`repair.js:438` vs `:490–497`).
4. **Messages for every required control.** Brand, model, department, province and the name fields get focus but no message in the original.
5. **Radiogroup keyboard pattern for step 2 and the boat-type cards.** The original finish cards are separate Tab stops with no arrow keys. Add Home/End to the fan as well.
6. **Antipodal camera routing** must not use `UP` when a view is vertical (see 5.6).
7. **Reduced motion in JS:** smooth `scrollTo` (`repair.js:541`), colour tweens and the hero spin.
8. **Wizard fonts:** `repair.html` loads only Anybody, but `body.wizard` uses `:root` Schibsted/Jost/Archivo, which are never loaded, so the wizard renders in fallback fonts. Use one self-hosted font set across all views.
9. **Single source for shared constants:** phone/WhatsApp in one `CONFIG`; discount steps rendered from data; one `formatEUR` (the original has `home.js:131` alongside `parts.formatSoles`).
10. **Announce cleared zones** when the boat type changes. The original clears silently (`repair.js:822–830`).
11. **Pause the hero turntable** off screen or in a hidden tab, and lazy-mount 3D after first paint behind an SVG poster.
12. **Accessible progress:** real text in an `<ol>` instead of CSS-generated content on empty spans.
13. **EU/Italy compliance:** click-to-load map, informativa privacy, P.IVA in the footer, self-hosted fonts.
14. **Foreign phone numbers:** the EN/ES/FR UI implies foreign owners, so add the «Estero» option.
15. **Hide the WhatsApp FAB** on wizard views.
16. Low priority: the fan caption's `aria-live` repeats what the focused radio already announces. Consider keeping it for pointer selection only.

### Relevant files (absolute paths)
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/src/carVisual.js`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/src/repair.js`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/src/parts.js`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/src/home.js`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/src/lookup.js`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/index.html`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/pgs/repair.html`
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/styles.css` (hero `1747–2036`, fan animation `3144–3185`, wizard `1–1326` and `3187–3958`)
- `/private/tmp/claude-501/-Users-gabrielesarria-cipressina/258c9c6b-ca5d-4950-a71c-1d322710137e/scratchpad/autocolor/design/rebrand/` (Main, HomeMobile, Wizard, Brand, DirectionB, DirectionC, Taller `.dc.html`)
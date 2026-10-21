/* tour.js: the walk round the boat on the home page (index.html #giro).

   The 3D cabin cruiser (boat3d.js) stays pinned while the zones scroll past;
   each step that reaches the middle of the screen lights its zones and flies
   the camera to them. Each step shows the owner's rate and what it costs on a
   boat of the length on the slider, from the same Z.price() the wizard uses.
   The antifouling chips repaint the boat's bottom and every `.coat` on the
   page (--af and the ink that reads best on it).

   Loaded as a module after site.js, zones.js, i18n.js and app.js (module
   scripts run after the deferred ones, in order). boat3d.js is imported with
   this file's own ?v= so the two never come from different releases. */

const Z = window.CIPRESSINA_ZONES;
const I = window.CIPRESSINA_I18N;
const t = (key, params) => (I ? I.t(key, params) : key);
const $ = (id) => document.getElementById(id);

const section = $("giro");
if (section && Z) init();

async function init() {
  const steps = [...section.querySelectorAll(".steps-tour li")];
  const loaIn = $("tourLoa"), loaOut = $("tourLoaOut"), now = $("tourNow"), quote = $("tourQuote");
  let lit = new Set(["topside_port", "topside_starboard"]);
  let current = steps[0];
  let coat = "#14305E";
  let ctrl = null;

  // ---- Coat colour: the page below the waterline -------------------------
  // Picks the ink (navy or near-white) with the better contrast on the coat.
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  function paintCoat(hex) {
    const L = lum(hex), light = ratio(L, lum("#eef1f7")) >= ratio(L, lum("#0d1a4a"));
    const root = document.documentElement.style;
    root.setProperty("--af", hex);
    root.setProperty("--af-ink", light ? "#eef1f7" : "#0d1a4a");
    root.setProperty("--af-muted", light ? "rgb(238 241 247 / .8)" : "rgb(13 26 74 / .86)");
    root.setProperty("--af-rule", light ? "rgb(238 241 247 / .22)" : "rgb(13 26 74 / .22)");
  }

  const chips = $("tourChips");
  const swatches = Z.SWATCHES.filter((s) => !s.placeholder);
  if (chips) {
    chips.innerHTML = "";
    swatches.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.coat = s.hex;
      b.dataset.sw = s.id;
      b.style.setProperty("--c", s.hex);
      b.setAttribute("aria-pressed", String(s.hex.toLowerCase() === coat.toLowerCase()));
      b.addEventListener("click", () => {
        coat = s.hex;
        chips.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        paintCoat(coat);
        if (ctrl) ctrl.setColors({ bottom: coat });
      });
      chips.appendChild(b);
    });
  }
  function nameChips() {
    if (!chips) return;
    chips.querySelectorAll("button").forEach((b) => {
      const s = swatches.find((x) => x.id === b.dataset.sw);
      const label = t("sw." + s.id) + ", " + s.source;
      b.setAttribute("aria-label", label);
      b.title = label;
    });
  }

  // ---- Estimates from the slider -------------------------------------------
  function estimates() {
    const loa = Number(loaIn.value);
    const boat = { loa, beam: Z.typicalBeam(loa), type: "cabinato" };
    const ft = Math.round(loa / 0.3048);
    loaOut.textContent = loa.toLocaleString("it-IT") + " m · " + ft + " ft";
    section.querySelectorAll("[data-est]").forEach((o) => {
      const sum = o.dataset.est.split(" ").reduce((total, id) => total + (Z.price(id, boat, {}) || 0), 0);
      o.textContent = t("cip.tour.from", { price: Z.formatEUR(sum) });
    });
    // The final step hands the length to the wizard.
    if (quote) quote.href = "pgs/preventivo.html?loa=" + encodeURIComponent(String(loa));
  }
  loaIn.addEventListener("input", estimates);

  function render() {
    nameChips();
    estimates();
    now.textContent = current.dataset.name ? t(current.dataset.name) : "";
  }
  document.addEventListener("cipressina:lang", render);
  paintCoat(coat);
  render();

  // ---- Scroll: each step that reaches the middle takes the boat with it ----
  function show(li) {
    current = li;
    steps.forEach((x) => x.classList.toggle("is-on", x === li));
    lit = new Set(li.dataset.zones.split(" ").filter(Boolean));
    now.textContent = t(li.dataset.name);
    if (ctrl) { ctrl.setView(li.dataset.view); ctrl.refreshSelection(); }
  }
  const spy = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) show(e.target); }),
    { rootMargin: "-45% 0px -45% 0px" });
  steps.forEach((li) => spy.observe(li));
  steps[0].classList.add("is-on");

  // ---- The 3D boat ----------------------------------------------------------
  const v = new URL(import.meta.url).searchParams.get("v");
  const fail = (err) => {
    console.error("[tour] 3D non disponibile:", err);
    section.classList.add("no-tour");
    const errEl = $("tourErr");
    $("tourLoading").hidden = true;
    errEl.textContent = t("cip.tour.err");
    errEl.hidden = false;
  };
  try {
    const { mountBoat3D } = await import("./boat3d.js" + (v ? "?v=" + encodeURIComponent(v) : ""));
    const theme = (window.CIPRESSINA_CONFIG && window.CIPRESSINA_CONFIG.theme) || {};
    ctrl = mountBoat3D({
      boatType: "cabinato",
      canvasEl: $("tourCanvas"), canvasWrapEl: $("tourViewer"),
      overlayEl: $("tourMsg"), loadingLabelEl: $("tourLoading"), errorEl: $("tourErr"),
      interactive: false, showWater: false,
      isPartSelected: (id) => lit.has(id), onPartToggle: () => {},
      theme: Object.assign({}, theme, { select: "#009642", bottom: coat, boot: "#009642" }),
      loadErrorText: t("cip.tour.err"),
    });
    ctrl.setView(current.dataset.view);
    ctrl.refreshSelection();
  } catch (err) {
    fail(err);
  }
}

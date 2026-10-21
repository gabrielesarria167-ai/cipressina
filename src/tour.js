/* tour.js: the walk round the boat on the home page (index.html #giro).

   The 3D cabin cruiser (boat3d.js) stays pinned while the zones scroll past;
   each step that reaches the middle of the screen lights its zones and flies
   the camera to them. Each step shows the owner's rate and what it costs on a
   boat of the length on the slider, from the same Z.price() the wizard uses.

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
  let ctrl = null;

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
    estimates();
    now.textContent = current.dataset.name ? t(current.dataset.name) : "";
  }
  document.addEventListener("cipressina:lang", render);
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
      // The bottom in the page's coat colour (styles.css --af).
      theme: Object.assign({}, theme, { select: "#009642", bottom: "#14305e", boot: "#009642" }),
      loadErrorText: t("cip.tour.err"),
    });
    ctrl.setView(current.dataset.view);
    ctrl.refreshSelection();
  } catch (err) {
    fail(err);
  }
}

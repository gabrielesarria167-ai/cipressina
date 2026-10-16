/* =========================================================================
   app.js: the one script behind both pages of the site

   Autocolor split this across home.js, repair.js and lookup.js; here one file
   serves two HTML pages, so the router, the menu, the language switcher and
   the 3D loader exist once:
     index.html          the front page: only #view-home is in the DOM.
     pgs/preventivo.html the quote wizard (#view-wizard) and the tracking
                         lookup (#view-lookup, reached at preventivo.html#stato).
   The router shows whichever views exist (the archived single-page sketch,
   design/sketches/c-laguna.html, has all three). The home page hands the
   chosen finish and length to the wizard in the URL:
   pgs/preventivo.html?pacchetto=<tier>&loa=<m>. See CONTRACT.md for the exact
   ids, data attributes and classes this file reads and writes.

   Order of the file:
     1. helpers            5. hero (swatches + lazy 3D)
     2. 3D module loader   6. home price sentence, tier prices, discount
                              list, gallery lightbox
     3. router and views   7. wizard (rules table, steps, viewer, summary, submit)
     4. chrome (menu,      8. lookup
        language, copy)    9. language change and init

   Loads after zones.js and i18n.js. Every string shown to the
   customer goes through t(); prices go through Z.formatEUR (always it-IT).
   ========================================================================= */
(function () {
    "use strict";

    var Z = window.CIPRESSINA_ZONES;
    var I18N = window.CIPRESSINA_I18N;
    // Optional per-skin settings: { theme: {...}, heroTheme: {...} }, passed
    // through to boat3d.js as its `theme` option (water, select, hover, hull
    // colours). Without it the module's own defaults apply.
    var CONFIG = window.CIPRESSINA_CONFIG || {};

    if (!Z || !I18N) {
        console.error("[cipressina] zones.js and i18n.js must load before app.js");
        return;
    }
    var t = I18N.t;

    // Where boat3d.js lives, as an absolute URL. A dynamic import() resolves
    // against the base URL of the script that runs it: for an external classic
    // script such as this one that is app.js's own URL (src/), for an
    // inline script it is the document. Deriving the URL from our own src
    // makes both cases land on src/boat3d.js; the page can still
    // override it with window.CIPRESSINA_BOAT3D_URL.
    // The page's ?v= on app.js is passed on to boat3d.js (which passes it on
    // to the .glb files): the module is imported only when the 3D step opens,
    // after the page load, so even a hard reload would leave an old cached
    // copy next to a new app.js. Bumping ?v= in the page refetches them all.
    var SELF = document.currentScript;
    var BOAT_URL = window.CIPRESSINA_BOAT3D_URL || (function () {
        if (!SELF || !SELF.src) return "./boat3d.js";
        var u = new URL("./boat3d.js", SELF.src);
        var v = new URL(SELF.src).searchParams.get("v");
        if (v) u.searchParams.set("v", v);
        return u.href;
    })();

    /* ==================================================================
       1. Helpers
       ================================================================== */

    function $(selector, root) { return (root || document).querySelector(selector); }
    function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
    function byId(id) { return document.getElementById(id); }
    function fieldOf(el) { return (el && el.closest(".field")) || el; }

    var motionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
    // CSS scroll-behavior does not override an explicit behavior passed from
    // JS, so every scripted scroll asks here (autocolor's scrollTo ignored it).
    function scrollBehavior() { return reducedMotion() ? "auto" : "smooth"; }

    function clean(value) { return String(value).replace(/\s+/g, " ").trim(); }
    function digitsOnly(value, max) { return String(value).replace(/\D/g, "").slice(0, max); }
    function parseLoa(value) {
        var text = String(value).trim().replace(",", ".");
        var n = Number(text);
        return text !== "" && isFinite(n) ? n : NaN;
    }
    // Lengths read with a comma in every UI language, like the prices read
    // as it-IT in every language.
    function formatNumber(n) { return String(n).replace(".", ","); }

    // One visually hidden polite live region for messages that have no
    // element of their own (zones cleared, copy failed). Created on first use
    // and styled through the CSSOM so a strict CSP does not matter.
    var liveEl = null;
    function announce(message) {
        if (!message) return;
        if (!liveEl) {
            liveEl = document.createElement("div");
            liveEl.setAttribute("role", "status");
            liveEl.setAttribute("aria-live", "polite");
            liveEl.style.cssText = "position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;" +
                "overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
            document.body.appendChild(liveEl);
        }
        // Emptied first, and filled a beat later, so the same text said twice
        // in a row is still announced.
        liveEl.textContent = "";
        setTimeout(function () { liveEl.textContent = message; }, 60);
    }

    function focusHeading(container) {
        var heading = container && $("h1", container);
        if (!heading) return;
        heading.setAttribute("tabindex", "-1");
        // The scroll is ours (smooth, motion-aware), not the focus call's.
        heading.focus({ preventScroll: true });
    }

    function scrollToTop() { window.scrollTo({ top: 0, behavior: scrollBehavior() }); }

    function makeButton(className, text, label) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = text;
        if (label) button.setAttribute("aria-label", label);
        return button;
    }

    // A radiogroup of <button role="radio" data-value>: one Tab stop (the
    // checked item, or the first when nothing is checked), arrows/Home/End
    // move and select as they go. Autocolor's finish cards were separate Tab
    // stops with no arrow keys; the fan only wrapped. Used by the hero
    // swatches, the boat type, registered/natante and the tiers.
    function radioGroup(group, options) {
        var cls = options.selectedClass;
        var current = null;

        function items() { return $$('[role="radio"]', group); }

        function select(value, quiet) {
            var all = items();
            var picked = null;
            all.forEach(function (button) {
                var on = value !== null && button.getAttribute("data-value") === value;
                if (on) picked = button;
                button.classList.toggle(cls, on);
                button.setAttribute("aria-checked", String(on));
                button.tabIndex = -1;
            });
            var stop = picked || all[0];
            if (stop) stop.tabIndex = 0;
            current = picked ? value : null;
            if (picked && !quiet && options.onSelect) options.onSelect(value, picked);
        }

        group.addEventListener("click", function (event) {
            var button = event.target.closest('[role="radio"]');
            if (button && group.contains(button)) select(button.getAttribute("data-value"));
        });

        group.addEventListener("keydown", function (event) {
            var button = event.target.closest('[role="radio"]');
            if (!button || !group.contains(button)) return;
            var all = items();
            var index = all.indexOf(button);
            var next;
            switch (event.key) {
                case "ArrowRight": case "ArrowDown": next = (index + 1) % all.length; break;
                case "ArrowLeft": case "ArrowUp": next = (index - 1 + all.length) % all.length; break;
                case "Home": next = 0; break;
                case "End": next = all.length - 1; break;
                default: return;
            }
            event.preventDefault();
            all[next].focus();
            select(all[next].getAttribute("data-value"));
        });

        select(null, true);
        return {
            select: select,
            value: function () { return current; },
            reset: function () { select(null, true); }
        };
    }

    /* ==================================================================
       2. The 3D module, fetched once and shared by the hero and the wizard
       ================================================================== */

    var boatModule = null;   // the in-flight or settled import() promise
    var boatRetries = 0;

    // A retry needs a URL the browser has not already written off: its module
    // map remembers a failed fetch, so re-importing the same specifier fails
    // again without touching the network (measured in autocolor). The query
    // string makes boat3d.js itself refetch. It does not reach three.js, whose
    // imports resolve through the import map to the same URLs; a failed one
    // stays failed until reload, and that is what the checklist is for.
    function loadBoat3D() {
        if (!boatModule) {
            var url = BOAT_URL;
            if (boatRetries) {
                var u = new URL(BOAT_URL, document.baseURI);
                u.searchParams.set("reintento", String(boatRetries));
                url = u.href;
            }
            var attempt = import(url);
            boatModule = attempt;
            // Holding on to a rejected promise would make every later caller
            // fail without fetching anything, so the failure drops it. Done
            // here, once, however many callers are waiting on it.
            attempt.catch(function () {
                if (boatModule === attempt) { boatModule = null; boatRetries++; }
            });
        }
        return boatModule;
    }

    /* ==================================================================
       3. Router and views
       ==================================================================
       Two pages. index.html has only the home view: any hash is an anchor.
       pgs/preventivo.html has the wizard and the lookup: #stato is the lookup,
       anything else is the wizard, and the wizard URL stays the plain page URL
       (no hash). The step lives in history.state and steps use pushState so
       Back works. The archived single-page sketch has all three views and
       keeps the old hashes (#preventivo, #stato, anchors on home). The finish
       and length chosen on the home page arrive as ?pacchetto= and ?loa=,
       read once by readQueryPick() and then removed from the URL.         */

    var views = {
        home: byId("view-home"),
        wizard: byId("view-wizard"),
        lookup: byId("view-lookup")
    };
    // URL written for a wizard history entry: a hash in the single-page
    // sketch, the plain page URL on preventivo.html.
    var WIZARD_URL = views.home ? "#preventivo" : location.pathname;
    var shown = { view: null, step: null };   // what is on screen right now
    var routed = false;
    var BASE_TITLE = document.title;
    // The last wizard step shown: a link back to the wizard that carries no
    // history entry (the header «Preventivo» from #stato, or on the wizard
    // itself) returns there instead of to step 1.
    var lastStep = 1;

    function setView(name) {
        Object.keys(views).forEach(function (key) {
            if (views[key]) views[key].hidden = key !== name;
            // The CSS hooks (e.g. hiding the WhatsApp FAB on the wizard).
            document.body.classList.toggle("is-" + key, key === name);
        });
        document.body.setAttribute("data-route", name);
        if (name !== "wizard") document.body.removeAttribute("data-step");
        shown.view = name;
    }

    function updateTitle() {
        var prefix = shown.view === "wizard" ? (views.home ? t("nav.quote") : "") : shown.view === "lookup" ? t("lookup.title") : "";
        document.title = prefix ? prefix + " · " + BASE_TITLE : BASE_TITLE;
    }

    function route() {
        var hash = location.hash.replace(/^#/, "");
        if (!/^[A-Za-z0-9-]*$/.test(hash)) hash = "";
        var state = history.state || {};
        var first = !routed;
        // Old links to the single-page draft (index.html#preventivo, #stato)
        // now belong to the wizard page.
        if (!views.wizard && (hash === "preventivo" || hash === "stato")) {
            location.replace("pgs/preventivo.html" + (hash === "stato" ? "#stato" : ""));
            return;
        }
        if (hash === "stato" && views.lookup) enterLookup(first);
        else if (views.wizard && (hash === "preventivo" || !views.home)) enterWizard(state.view === "wizard" ? state.step : lastStep, first);
        else enterHome(hash, first);
        routed = true;
    }

    function enterHome(anchor, first) {
        var changed = shown.view !== "home";
        setView("home");
        shown.step = null;
        closeMenu();
        updateTitle();
        scheduleHero();
        // Same view and not the first load: the browser already scrolled to
        // the anchor (or restored the scroll position on Back).
        if (!changed || first) return;
        var target = anchor ? byId(anchor) : null;
        if (target) {
            target.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
        } else {
            scrollToTop();
            focusHeading(views.home);
        }
    }

    function enterLookup(first) {
        var changed = shown.view !== "lookup";
        setView("lookup");
        shown.step = null;
        closeMenu();
        updateTitle();
        if (!changed || first) return;
        scrollToTop();
        focusHeading(views.lookup);
    }

    function enterWizard(requested, first) {
        var changed = shown.view !== "wizard";
        var target;
        if (submitted) {
            target = "success";
        } else {
            var step = Number(requested);
            if (!(step >= 1 && step <= TOTAL_STEPS)) step = 1;
            // Entering step N lands on the first earlier step that is still
            // incomplete. A reload keeps history.state but not the form.
            target = Math.min(step, firstBlockedStep());
        }
        if (!changed && shown.step === target && !first) return;

        setView("wizard");
        closeMenu();
        applyHomePick();
        var tag = history.state || {};
        if (tag.view !== "wizard" || tag.step !== target) {
            history.replaceState({ view: "wizard", step: target }, "", WIZARD_URL);
        }
        if (target === "success") renderSuccess({ focus: !first });
        else renderStep(target, { focus: !first });
        updateTitle();
    }

    // What the customer picked on the home page (finish, length), waiting for
    // the wizard to open. Applied once. On preventivo.html it comes from the
    // query string (?pacchetto=&loa=); in the single-page sketch from the
    // home page's own clicks.
    var pick = null;

    function readQueryPick() {
        if (!views.wizard || views.home || !location.search) return;
        var params = new URLSearchParams(location.search);
        var tier = params.get("pacchetto"), loa = params.get("loa");
        if (tier && Z.PACKAGE_CHOICES.indexOf(tier) === -1) tier = null;
        if (loa !== null) {
            var n = parseLoa(loa);
            if (isNaN(n) || n < LOA_MIN || n > LOA_MAX) loa = null;
        }
        if (tier || loa) pick = { tier: tier, loa: loa };
        // Applied once: a reload must not re-apply it.
        history.replaceState(history.state, "", location.pathname + location.hash);
    }

    /* ==================================================================
       4. Chrome: menu, language switcher, copy buttons, year
       ================================================================== */

    var menuToggle = byId("menuToggle");
    var navPanel = byId("navPanel");

    function setMenu(open) {
        if (!menuToggle || !navPanel) return;
        menuToggle.classList.toggle("is-open", open);
        navPanel.classList.toggle("is-open", open);
        menuToggle.setAttribute("aria-expanded", String(open));
        // The label says what a press will do; left at «Apri il menu» a
        // screen reader announced «Apri il menu, espanso» while it was open.
        menuToggle.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
    }
    function closeMenu() { setMenu(false); }

    function initMenu() {
        if (!menuToggle || !navPanel) return;
        menuToggle.setAttribute("aria-controls", "navPanel");
        setMenu(false);
        menuToggle.addEventListener("click", function () {
            setMenu(!navPanel.classList.contains("is-open"));
        });
        navPanel.addEventListener("click", function (event) {
            if (event.target.closest("a")) closeMenu();
        });
        document.addEventListener("click", function (event) {
            if (!navPanel.classList.contains("is-open")) return;
            if (navPanel.contains(event.target) || menuToggle.contains(event.target)) return;
            closeMenu();
        });
        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape" || !navPanel.classList.contains("is-open")) return;
            closeMenu();
            menuToggle.focus();
        });
    }

    function syncLangControls() {
        var lang = I18N.getLang();
        $$("[data-lang]").forEach(function (button) {
            var on = button.getAttribute("data-lang") === lang;
            button.classList.toggle("is-active", on);
            button.setAttribute("aria-pressed", String(on));
        });
        $$("select[data-lang-select]").forEach(function (select) { select.value = lang; });
    }

    function initLang() {
        $$("[data-lang]").forEach(function (button) {
            button.addEventListener("click", function () { I18N.setLang(button.getAttribute("data-lang")); });
        });
        $$("select[data-lang-select]").forEach(function (select) {
            select.addEventListener("change", function () { I18N.setLang(select.value); });
        });
        syncLangControls();
    }

    // [data-copy="#selector"]: copies the text of that element (the number,
    // the address, the demo code). The text is always on screen and
    // selectable because tel:/mailto: and the clipboard may not work inside
    // the publishing frame; when copying fails the text is selected so the
    // customer can press Copy on their own device.
    function selectContents(el) {
        var selection = window.getSelection && window.getSelection();
        if (!selection || !document.createRange) return false;
        var range = document.createRange();
        range.selectNodeContents(el);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }

    function copyText(text, source) {
        function fallback() {
            var selected = selectContents(source);
            var copied = false;
            try { copied = selected && document.execCommand("copy"); } catch (e) { copied = false; }
            return copied;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
        }
        return Promise.resolve(fallback());
    }

    function initCopy() {
        document.addEventListener("click", function (event) {
            var button = event.target.closest("[data-copy]");
            if (!button) return;
            var source = $(button.getAttribute("data-copy"));
            if (!source) return;
            copyText(source.textContent.trim(), source).then(function (ok) {
                if (!ok) { announce(t("copy.manual")); return; }
                button.textContent = t("btn.copied");
                button.classList.add("is-copied");
                clearTimeout(button.copyTimer);
                button.copyTimer = setTimeout(function () {
                    button.textContent = t("btn.copy");
                    button.classList.remove("is-copied");
                }, 2000);
            });
        });
    }

    function initChromeLinks() {
        document.addEventListener("click", function (event) {
            var link = event.target.closest("a");
            if (!link) return;
            // The skip link points at #contenuto, which the router would read
            // as a home anchor and drag the wizard back to the home page.
            if (link.hasAttribute("data-skip")) {
                event.preventDefault();
                var main = byId("contenuto");
                if (main) { main.setAttribute("tabindex", "-1"); main.focus(); }
                return;
            }
            // «Scegli» on a tier card of the home page: remember the finish
            // for step 2, then let the link navigate.
            var chosen = link.getAttribute("data-tier-choose");
            if (chosen) pick = { tier: chosen, loa: pick && pick.loa };
        });
    }

    /* ==================================================================
       5. Hero: swatches repaint the antifouling, 3D mounts after first paint
       ================================================================== */

    var hero = { ctrl: null, id: null, color: null, scheduled: false, visible: true, radio: null };

    function swatchName(button) {
        var id = button.getAttribute("data-value");
        var key = "sw." + id;
        var text = t(key);
        if (text !== key) return text;
        var inner = $(".swatch__name", button);
        return inner ? inner.textContent : id;
    }

    // The strips are drawn from zones.js SWATCHES so the three skins share
    // one colour list; markup that arrives with its own strips is kept. The
    // CSS variables are the fan's geometry hooks (--i index, --n count, --z
    // z-index peaking in the middle) and --sw the printed colour.
    // «Originale» is the colour the skin's 3D theme gives the hull: the
    // hero's theme for the hero strips, the wizard viewer's for step 3.
    function swatchHex(swatch, theme) {
        theme = theme || CONFIG.heroTheme || CONFIG.theme || {};
        return swatch.id === "original" && theme.bottom ? theme.bottom : swatch.hex;
    }

    function renderSwatches(group, theme) {
        if ($('[role="radio"]', group)) return;
        var all = Z.SWATCHES;
        all.forEach(function (swatch, i) {
            var hex = swatchHex(swatch, theme);
            var button = document.createElement("button");
            button.type = "button";
            button.className = "swatch";
            button.setAttribute("role", "radio");
            button.setAttribute("aria-checked", "false");
            button.setAttribute("data-value", swatch.id);
            button.setAttribute("data-color", hex);
            if (swatch.source) button.title = swatch.source;
            button.style.setProperty("--sw", hex);
            button.style.setProperty("--i", String(i));
            button.style.setProperty("--n", String(all.length));
            button.style.setProperty("--z", String(1 + 2 * Math.min(i, all.length - 1 - i)));
            var name = document.createElement("span");
            name.className = "swatch__name";
            name.setAttribute("data-i18n", "sw." + swatch.id);
            button.appendChild(name);
            group.appendChild(button);
        });
        I18N.apply(group);
    }

    // The visible name can be clipped by a skin on small screens, so the
    // accessible name is set explicitly (autocolor's hidden names left the
    // strips unlabelled).
    function labelSwatches() {
        if (!hero.radio) return;
        $$('[role="radio"]', byId("heroSwatches")).forEach(function (button) {
            button.setAttribute("aria-label", swatchName(button));
        });
        var current = $('[role="radio"][aria-checked="true"]', byId("heroSwatches"));
        var nameEl = byId("heroSwatchName");
        if (current && nameEl) nameEl.textContent = swatchName(current);
    }

    function onSwatch(value, button) {
        hero.id = value;
        hero.color = button.getAttribute("data-color");
        var wrap = byId("heroBoat");
        // Drives the SVG poster (fill: var(--hero-bottom)) whether or not the
        // 3D scene ever mounts.
        if (wrap) wrap.style.setProperty("--hero-bottom", hero.color);
        var chip = byId("heroSwatchChip");
        if (chip) chip.style.setProperty("--sw", hero.color);
        var nameEl = byId("heroSwatchName");
        if (nameEl) nameEl.textContent = swatchName(button);
        if (hero.ctrl && hero.ctrl.setColors) hero.ctrl.setColors({ bottom: hero.color });
    }

    function initHero() {
        var group = byId("heroSwatches");
        if (!group) return;
        renderSwatches(group);
        hero.radio = radioGroup(group, { selectedClass: "is-active", onSelect: onSwatch });
        var start = $('[data-value="original"]', group) || $$('[role="radio"]', group)[Math.floor(Z.SWATCHES.length / 2)];
        if (start) hero.radio.select(start.getAttribute("data-value"));
        labelSwatches();
    }

    // Mounts after the first paint so three.js (from a CDN) never delays the
    // headline; until then, and for good if the import or WebGL fails, the
    // SVG poster stays and keeps recolouring with the swatches.
    function scheduleHero() {
        if (hero.scheduled || !byId("heroBoat") || !byId("heroCanvas")) return;
        hero.scheduled = true;
        function run() {
            if ("requestIdleCallback" in window) window.requestIdleCallback(mountHero, { timeout: 2500 });
            else setTimeout(mountHero, 200);
        }
        if (document.readyState === "complete") run();
        else window.addEventListener("load", run, { once: true });
    }

    function mountHero() {
        var wrap = byId("heroBoat");
        var canvas = byId("heroCanvas");
        if (!wrap || !canvas) return;
        loadBoat3D().then(function (mod) {
            try {
                hero.ctrl = mod.mountBoat3D({
                    boatType: wrap.getAttribute("data-boat-type") || "cabinato",
                    canvasEl: canvas,
                    canvasWrapEl: wrap,
                    interactive: false,
                    spin: true,
                    showWater: false,
                    spinPitch: CONFIG.heroSpinPitch,
                    theme: CONFIG.heroTheme || CONFIG.theme,
                    // The GLB loads asynchronously, so a failed download
                    // arrives here rather than through loadFailed() below.
                    onLoadError: function () {
                        if (hero.ctrl) { hero.ctrl.destroy(); hero.ctrl = null; }
                        wrap.classList.remove("is-3d");
                        wrap.classList.add("is-fallback");
                    }
                });
            } catch (err) {
                // No WebGL, or an unknown type: the poster is the hero.
                console.error("[hero] Could not build the 3D boat:", err);
                wrap.classList.add("is-fallback");
                return;
            }
            if (hero.ctrl.loadFailed && hero.ctrl.loadFailed()) {
                hero.ctrl.destroy();
                hero.ctrl = null;
                wrap.classList.add("is-fallback");
                return;
            }
            if (hero.color && hero.ctrl.setColors) hero.ctrl.setColors({ bottom: hero.color });
            wrap.classList.add("is-3d");
            watchHero(wrap);
        }, function (err) {
            console.error("[hero] Could not load the 3D module:", err);
            wrap.classList.add("is-fallback");
        });
    }

    // The turntable should not burn battery while nobody sees it (off screen,
    // another view, hidden tab). boat3d.js is asked to pause only if it
    // offers pauseSpin/resumeSpin; otherwise the spin is left running.
    function heroRunState() {
        if (!hero.ctrl || reducedMotion()) return;
        var run = hero.visible && !document.hidden;
        var method = run ? hero.ctrl.resumeSpin : hero.ctrl.pauseSpin;
        if (typeof method === "function") method.call(hero.ctrl);
    }

    function watchHero(wrap) {
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                hero.visible = entries[entries.length - 1].isIntersecting;
                heroRunState();
            }).observe(wrap);
        }
        document.addEventListener("visibilitychange", heroRunState);
    }

    /* ==================================================================
       6. Home: price sentence, tier prices, discount list
       ================================================================== */

    // «Intervenire su [2] zone di una barca lunga [8 m] [con il Pacchetto
    // Completo] costa da X»: the package plus that many topsides (per side),
    // with the discount curve the wizard uses, via Z.estimate.
    function renderQuoteLine() {
        var countEl = byId("qlCount"), loaEl = byId("qlLoa"), tierEl = byId("qlTier");
        var totalEl = byId("qlTotal");
        if (!countEl || !loaEl || !tierEl || !totalEl) return;
        var count = Number(countEl.value) || 1;
        var ids = [];
        for (var i = 0; i < count; i++) ids.push("topside_port");
        var est = Z.estimate(ids, tierEl.value, Number(loaEl.value));

        totalEl.textContent = Z.formatEUR(est.total);
        var word = byId("qlWord");
        if (word) word.textContent = t(count === 1 ? "ql.zoneOne" : "ql.zoneMany");
        var before = byId("qlBefore");
        if (before) {
            before.textContent = "";
            if (est.rate > 0) {
                var struck = document.createElement("s");
                struck.textContent = Z.formatEUR(est.total + est.discount);
                before.appendChild(struck);
                before.appendChild(document.createTextNode(" " + t("ql.without", { rate: est.rate })));
            }
            before.hidden = est.rate === 0;
        }
    }

    function initQuoteLine() {
        var form = byId("quoteLine");
        if (!form) return;
        ["qlCount", "qlLoa", "qlTier"].forEach(function (id) {
            var el = byId(id);
            if (el) el.addEventListener("change", renderQuoteLine);
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var loaEl = byId("qlLoa"), tierEl = byId("qlTier");
            pick = { tier: tierEl && tierEl.value, loa: loaEl && loaEl.value };
            if (views.wizard) { location.hash = "preventivo"; return; }
            var query = new URLSearchParams();
            if (pick.tier) query.set("pacchetto", pick.tier);
            if (pick.loa) query.set("loa", pick.loa);
            var qs = query.toString();
            location.href = "pgs/preventivo.html" + (qs ? "?" + qs : "");
        });
        renderQuoteLine();
    }

    // «da 55 € al metro (minimo 350 €)» on every package card (home and
    // wizard step 2), from the same table the estimate uses.
    function renderTierPrices() {
        $$("[data-tier-from]").forEach(function (el) {
            var tier = el.getAttribute("data-tier-from");
            if (Z.TIERS.indexOf(tier) === -1) return;
            var row = Z.PACKAGES[tier];
            el.textContent = t("tier.from", { price: Z.formatEUR(row.rate), min: Z.formatEUR(row.min) });
        });
    }

    // 5% / 7% / 9% / 10% rendered from DISCOUNT_STEPS, so the page can never
    // promise a step the estimate doesn't give. The static HTML a skin ships
    // inside the <ul> is the no-JS fallback and is replaced here.
    function renderDiscountList() {
        var list = byId("discountList");
        if (!list) return;
        list.textContent = "";
        var steps = Z.DISCOUNT_STEPS;
        steps.forEach(function (rate, count) {
            if (!(rate > 0)) return;
            var item = document.createElement("li");
            item.className = "discount-step";
            var zones = document.createElement("span");
            zones.className = "discount-step__zones";
            zones.textContent = count === steps.length - 1
                ? t("disc.zonesPlus", { count: count })
                : t("sum.count", { count: count });
            var value = document.createElement("strong");
            value.className = "discount-step__rate";
            value.textContent = rate + "%";
            item.appendChild(zones);
            item.appendChild(document.createTextNode(" "));
            item.appendChild(value);
            list.appendChild(item);
        });
    }

    // Home gallery. Each thumbnail links to the full photo, so without JS
    // (or without <dialog>) the link still opens it; with JS it opens in
    // #lightbox, with previous / next, arrow keys and a click outside to close.
    // Previous / next stay within the group named by data-lightbox.
    function initLightbox() {
        var box = byId("lightbox");
        var all = $$("[data-lightbox]");
        if (!box || !all.length || typeof box.showModal !== "function") return;
        var img = byId("lightboxImg"), caption = byId("lightboxCaption"), count = byId("lightboxCount");
        var links = all, index = 0;
        function show(i) {
            index = (i + links.length) % links.length;
            var thumb = $("img", links[index]);
            var alt = thumb ? thumb.getAttribute("alt") || "" : "";
            img.src = links[index].getAttribute("href");
            img.alt = alt;
            // The caption repeats the alt text for sighted users only.
            caption.textContent = alt;
            caption.setAttribute("aria-hidden", "true");
            if (count) count.textContent = t("lb.count", { n: index + 1, total: links.length });
        }
        all.forEach(function (link) {
            link.addEventListener("click", function (event) {
                if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                var group = link.getAttribute("data-lightbox");
                links = all.filter(function (other) { return other.getAttribute("data-lightbox") === group; });
                show(links.indexOf(link));
                box.showModal();
            });
        });
        byId("lightboxPrev").addEventListener("click", function () { show(index - 1); });
        byId("lightboxNext").addEventListener("click", function () { show(index + 1); });
        byId("lightboxClose").addEventListener("click", function () { box.close(); });
        box.addEventListener("keydown", function (event) {
            if (event.key === "ArrowLeft") show(index - 1);
            else if (event.key === "ArrowRight") show(index + 1);
        });
        // A click on the backdrop lands on the dialog element itself.
        box.addEventListener("click", function (event) { if (event.target === box) box.close(); });
        box.addEventListener("close", function () { links[index].focus(); });
    }

    /* ==================================================================
       7. Wizard
       ================================================================== */

    var TOTAL_STEPS = 4;
    var YEAR_MIN = 1950;                       // placeholder bound (flow-spec §3.5)
    var YEAR_MAX = new Date().getFullYear() + 1;
    // A sanity range for the form, not the shop's capacity (unknown, .ph).
    var LOA_MIN = 2.5, LOA_MAX = 30;
    var HOURS_MAX = 99999;
    // The shop works only around Venice. Boats up to this length come to the
    // body shop in Olmo di Martellago; longer ones are done at a shipyard in
    // the area. Placeholder until the owner confirms (CONFIG.shopMaxLoa).
    var SHOP_MAX_LOA = typeof CONFIG.shopMaxLoa === "number" ? CONFIG.shopMaxLoa : 8;
    var PHONE_IT = /^(3\d{8,9}|0\d{5,10})$/;
    var PHONE_INTL = /^\+\d{8,15}$/;
    var REGISTRATION = /^[A-Z0-9][A-Z0-9 ]{2,14}$/;
    var EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    var EMAIL_DISALLOWED = /[^a-zA-Z0-9._%+@-]/g;
    // Optional fields have no rule, only a length cap.
    var OPTIONAL_MAX = { location: 80, boatName: 40, colorCode: 20, notes: 2000 };

    var current = 1;
    var submitted = false;
    var submitting = false;
    var hintKey = null;
    var lastSubmission = null;
    var state = freshState();
    var groups = {};         // radiogroups by id

    function freshState() {
        return {
            boatType: "", registered: "", berthKind: "", tier: "", zones: [],
            antifoulingColor: "",     // swatch id, only while «Opera viva» is a selected zone
            modelMatch: null, modelPrefilled: false, autoLoa: "", autoType: "", autofillNote: false
        };
    }

    var wizardEl = views.wizard;
    var stepEls = wizardEl ? $$(".step[data-step]", wizardEl) : [];
    var nextBtn = byId("stepNext");
    var backBtn = byId("stepBack");
    var hintEl = byId("stepHint");
    var footEl = byId("wizardFoot");
    var progressEl = byId("wizProgress");
    var successEl = byId("success");

    /* ---------- The rules table ----------
       One entry per field, read by isStepValid, explainStep and the blur
       handlers alike. (Autocolor validated step 4 with checkValidity() and
       explained it with different regexes.) Entry:
         id      control id (for radiogroups, the group); error is #<id>Error
         step    1..4
         max     maxlength, applied from here
         when()  rule only applies while true (conditional fields)
         get()   value; default el.value
         format  (raw) -> cleaned, run on every input
         ok(v)   valid?
         msg(v)  error key, params() its parameters
         virtual no element (the zone selection)                            */
    var RULES = [];
    var RULE = {};

    function addRule(def) {
        def.err = null;
        if (!def.virtual) {
            def.el = byId(def.id);
            if (!def.el) { console.warn("[wizard] missing control #" + def.id); return; }
            def.errEl = byId(def.id + "Error");
        }
        RULES.push(def);
        RULE[def.id] = def;
    }

    function defineRules() {
        addRule({ id: "boatType", step: 1, radio: true, get: function () { return state.boatType; },
            ok: function (v) { return !!v; }, msg: "err.boatType" });
        addRule({ id: "builder", step: 1, max: 60,
            format: function (v) { return v.replace(/\s{2,}/g, " "); },
            ok: function (v) { return clean(v).length >= 2; }, msg: "err.builder" });
        addRule({ id: "model", step: 1, max: 60,
            format: function (v) { return v.replace(/\s{2,}/g, " "); },
            ok: function (v) { return clean(v).length >= 1; }, msg: "err.model" });
        addRule({ id: "year", step: 1, max: 4,
            format: function (v) { return digitsOnly(v, 4); },
            ok: function (v) { var y = Number(v); return /^\d{4}$/.test(v) && y >= YEAR_MIN && y <= YEAR_MAX; },
            msg: "err.year", params: function () { return { min: YEAR_MIN, max: YEAR_MAX }; } });
        addRule({ id: "loa", step: 1, format: formatLoa,
            ok: function (v) { var n = parseLoa(v); return n >= LOA_MIN && n <= LOA_MAX; },
            msg: "err.loa", params: function () { return { min: formatNumber(LOA_MIN), max: formatNumber(LOA_MAX) }; } });
        addRule({ id: "registered", step: 1, radio: true, get: function () { return state.registered; },
            ok: function (v) { return !!v; }, msg: "err.registered" });
        addRule({ id: "berthKind", step: 1, radio: true, get: function () { return state.berthKind; },
            ok: function (v) { return !!v; }, msg: "err.berthKind" });
        addRule({ id: "registration", step: 1, max: 15,
            when: function () { return state.registered === "registrata"; },
            format: function (v) { return v.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s{2,}/g, " "); },
            ok: function (v) { return REGISTRATION.test(clean(v)); }, msg: "err.registration" });
        addRule({ id: "engineHours", step: 1,
            format: function (v) { return digitsOnly(v, 5); },
            ok: function (v) { return v === "" || Number(v) <= HOURS_MAX; },
            msg: "err.engineHours", params: function () { return { max: HOURS_MAX.toLocaleString("it-IT") }; } });
        addRule({ id: "firstName", step: 1, max: 80,
            ok: function (v) { return clean(v) !== ""; }, msg: "err.firstName" });
        addRule({ id: "lastName", step: 1, max: 80,
            ok: function (v) { return clean(v) !== ""; }, msg: "err.lastName" });

        addRule({ id: "tier", step: 2, radio: true, get: function () { return state.tier; },
            ok: function (v) { return !!v; }, msg: "hint.step2" });

        // With a package the zones are optional extras; without one they are
        // the whole request.
        addRule({ id: "zones", step: 3, virtual: true, get: function () { return state.zones; },
            when: function () { return state.tier === Z.NO_PACKAGE; },
            ok: function (v) { return v.length > 0; }, msg: "hint.step3" });

        // An Italian number without prefix, or any number with its own «+».
        addRule({ id: "phone", step: 4,
            format: function (v) { return v.charAt(0) === "+" ? "+" + digitsOnly(v, 15) : digitsOnly(v, 11); },
            ok: function (v) { return PHONE_IT.test(v) || PHONE_INTL.test(v); }, msg: "err.phone" });
        addRule({ id: "email", step: 4,
            format: function (v) { return v.replace(EMAIL_DISALLOWED, ""); },
            ok: function (v) { return EMAIL_PATTERN.test(v); },
            // Empty and malformed are different failures and say different
            // things: «email valida» in front of a blank field doesn't say
            // what to do.
            msg: function (v) { return v === "" ? "err.email.empty" : "err.email.bad"; } });
    }

    // Keeps digits and one separator, two integer and two decimal digits, and
    // shows a comma: «8,5».
    function formatLoa(raw) {
        var cut = raw.search(/[.,]/);
        var head = (cut === -1 ? raw : raw.slice(0, cut)).replace(/\D/g, "").slice(0, 2);
        if (cut === -1) return head;
        if (head === "") return "";
        return head + "," + raw.slice(cut + 1).replace(/\D/g, "").slice(0, 2);
    }

    function ruleActive(rule) { return !rule.when || rule.when(); }
    function ruleValue(rule) { return rule.get ? rule.get() : rule.el.value; }
    function ruleOk(rule) { return !ruleActive(rule) || rule.ok(ruleValue(rule)); }
    function stepRules(step) { return RULES.filter(function (rule) { return rule.step === step; }); }
    function isStepValid(step) { return stepRules(step).every(ruleOk); }

    // Entering step N is allowed only up to the first incomplete step before it.
    function firstBlockedStep() {
        for (var step = 1; step < TOTAL_STEPS; step++) if (!isStepValid(step)) return step;
        return TOTAL_STEPS;
    }

    // The single error painter (autocolor's setFieldValidity).
    function paint(rule, ok) {
        if (rule.virtual) return;
        var wrap = rule.el.closest(".field");
        if (wrap) wrap.classList.toggle("is-invalid", !ok);
        if (ok) rule.el.removeAttribute("aria-invalid");
        else rule.el.setAttribute("aria-invalid", "true");
        if (!rule.errEl) { rule.err = ok ? null : {}; return; }
        if (ok) {
            rule.err = null;
            rule.errEl.textContent = "";
            rule.errEl.hidden = true;
        } else {
            rule.err = {
                key: typeof rule.msg === "function" ? rule.msg(ruleValue(rule)) : rule.msg,
                params: rule.params ? rule.params() : undefined
            };
            rule.errEl.textContent = t(rule.err.key, rule.err.params);
            rule.errEl.hidden = false;
        }
    }

    // Shows or clears a field's error. Without `show`, only repaints a field
    // that is already showing one (so it clears the moment it becomes valid
    // and the message tracks the value) and never nags while the customer is
    // still typing for the first time.
    function check(rule, show) {
        if (!ruleActive(rule)) { paint(rule, true); return true; }
        var ok = rule.ok(ruleValue(rule));
        if (show || rule.err) paint(rule, ok);
        return ok;
    }

    // check() by id, for controls a skin may have left out.
    function checkId(id, show) { return RULE[id] ? check(RULE[id], show) : true; }

    function focusRule(rule) {
        if (rule.radio) {
            var target = $('[role="radio"][tabindex="0"]', rule.el) || $('[role="radio"]', rule.el);
            if (target) target.focus();
        } else if (rule.el && rule.el.focus) {
            rule.el.focus();
        }
    }

    function setHint(key) {
        hintKey = key;
        if (!hintEl) return;
        hintEl.textContent = key ? t(key) : "";
        hintEl.hidden = !key;
    }

    // Marks what is missing on the step and moves focus to the first of it.
    function explainStep(step) {
        var first = null;
        stepRules(step).forEach(function (rule) {
            var ok = ruleOk(rule);
            if (!rule.virtual) paint(rule, ok);
            if (!ok && !first) first = rule;
        });
        setHint("hint.step" + step);
        if (!first) return;
        if (first.virtual) {
            // Step 3: the list is the way in when the 3D viewer isn't.
            openChecklist();
            var box = $('input[type="checkbox"]', byId("zonesChecklist") || document);
            if (box) box.focus();
        } else {
            focusRule(first);
        }
    }

    function describeRules() {
        RULES.forEach(function (rule) {
            if (rule.virtual) return;
            var ids = [rule.id + "Hint", rule.id + "Error"].filter(function (id) { return byId(id); });
            if (ids.length) rule.el.setAttribute("aria-describedby", ids.join(" "));
        });
    }

    /* ---------- Progress, buttons, step display ---------- */

    function updateProgress() {
        if (!progressEl) return;
        $$("li[data-step]", progressEl).forEach(function (item) {
            var n = Number(item.getAttribute("data-step"));
            var status = n < current ? "done" : n === current ? "current" : "todo";
            item.classList.toggle("is-current", status === "current");
            item.classList.toggle("is-done", status === "done");
            if (status === "current") item.setAttribute("aria-current", "step");
            else item.removeAttribute("aria-current");
            var sr = $("[data-progress-sr]", item);
            if (sr) sr.textContent = t("prog.sr." + status, { n: n, total: TOTAL_STEPS });
        });
    }

    function mainLabel() {
        if (submitting) return t("btn.sending");
        if (current === 1) return t("btn.saveContinue");
        if (current === TOTAL_STEPS) return t("btn.send");
        return t("btn.continue");
    }

    // The main button is never disabled: aria-disabled styles it grey but a
    // click still explains what is missing (explainStep).
    function refreshMain() {
        if (!nextBtn) return;
        var valid = isStepValid(current);
        nextBtn.textContent = mainLabel();
        nextBtn.setAttribute("aria-disabled", String(!valid || submitting));
        if (valid && hintKey) setHint(null);
    }

    function showChrome(visible) {
        if (progressEl) progressEl.hidden = !visible;
        if (footEl) footEl.hidden = !visible;
        if (nextBtn) nextBtn.hidden = !visible;
    }

    function renderStep(step, options) {
        current = step;
        shown.view = "wizard";
        shown.step = step;
        lastStep = step;
        stepEls.forEach(function (el) {
            var on = Number(el.getAttribute("data-step")) === step;
            el.classList.toggle("is-active", on);
            el.hidden = !on;
        });
        if (successEl) successEl.hidden = true;
        showChrome(true);
        document.body.setAttribute("data-step", String(step));
        if (backBtn) backBtn.hidden = step === 1;
        setHint(null);
        updateProgress();
        if (step === 3) enterStep3();
        refreshMain();
        if (options && options.focus) {
            focusHeading(stepEls.filter(function (el) { return Number(el.getAttribute("data-step")) === step; })[0]);
            scrollToTop();
        }
    }

    // `mode`: "push" adds a history entry (forward, back button of ours),
    // "replace" rewrites the current one. The URL stays WIZARD_URL.
    function goTo(step, mode) {
        var entry = { view: "wizard", step: step };
        if (mode === "push") history.pushState(entry, "", WIZARD_URL);
        else if (mode === "replace") history.replaceState(entry, "", WIZARD_URL);
        renderStep(step, { focus: true });
        updateTitle();
    }

    function onMain() {
        if (submitting) return;
        if (!isStepValid(current)) { explainStep(current); return; }
        if (current < TOTAL_STEPS) goTo(current + 1, "push");
        else submitRequest();
    }

    // The home page hands over the finish and the length it showed.
    function applyHomePick() {
        if (!pick) return;
        var loaEl = byId("loa");
        if (pick.tier && Z.PACKAGE_CHOICES.indexOf(pick.tier) !== -1 && groups.tier) groups.tier.select(pick.tier);
        var loa = parseLoa(pick.loa || "");
        if (loaEl && !isNaN(loa) && clean(loaEl.value) === "") {
            loaEl.value = formatNumber(loa);
            state.autoLoa = "";
            renderRegisteredNote();
            renderServiceSite();
            renderBoatSummary();
        }
        pick = null;
        refreshMain();
    }

    /* ---------- Step 1: boat ---------- */

    function fillBuilderList() {
        var list = byId("builderList");
        if (!list) return;
        list.textContent = "";
        Z.builderNames().forEach(function (name) {
            var option = document.createElement("option");
            option.value = name;
            list.appendChild(option);
        });
    }

    // Models of the builder typed so far; with no builder, all of them, each
    // labelled with its builder, so a model can be found first.
    function fillModelList() {
        var list = byId("modelList");
        var builderEl = byId("builder");
        if (!list || !builderEl) return;
        list.textContent = "";
        var typed = clean(builderEl.value) !== "";
        Z.modelsFor(builderEl.value).forEach(function (entry) {
            var option = document.createElement("option");
            option.value = entry.model;
            if (!typed) option.label = entry.builder;
            list.appendChild(option);
        });
    }

    // A known model fills in the length and the type, but only where the
    // customer hasn't written their own (or still has what we filled in last
    // time, so switching from one model to another updates both).
    function onModelCommit() {
        var builderEl = byId("builder"), modelEl = byId("model"), loaEl = byId("loa");
        if (!builderEl || !modelEl) return;
        var entry = Z.findModel(builderEl.value, modelEl.value);
        state.modelMatch = entry;
        if (!entry) { state.modelPrefilled = false; state.autofillNote = false; renderModelSource(); renderAutofillNote(); return; }

        if (clean(builderEl.value) === "") {
            builderEl.value = entry.builder;
            fillModelList();
            checkId("builder", false);
        }
        var filled = false;
        if (loaEl && (clean(loaEl.value) === "" || loaEl.value === state.autoLoa)) {
            loaEl.value = formatNumber(entry.loa);
            state.autoLoa = loaEl.value;
            filled = true;
            checkId("loa", false);
        }
        if (groups.boatType && (!state.boatType || state.boatType === state.autoType)) {
            groups.boatType.select(entry.type);
            state.autoType = entry.type;
            filled = true;
        }
        if (filled) { state.modelPrefilled = true; state.autofillNote = true; }
        renderModelSource();
        renderAutofillNote();
        renderRegisteredNote();
        renderServiceSite();
        renderBoatSummary();
    }

    // A polite live region (#modelAutofill, always in the DOM, text filled in
    // here so the change is announced): the catalogue wrote into the type
    // and/or the length, and the customer is asked to check.
    function renderAutofillNote() {
        var note = byId("modelAutofill");
        if (!note) return;
        note.textContent = state.autofillNote ? t("model.autofilled") : "";
    }

    function renderModelSource() {
        var link = byId("modelSource");
        if (!link) return;
        var entry = state.modelMatch;
        var visible = !!entry && state.modelPrefilled;
        link.hidden = !visible;
        if (!visible) return;
        link.href = entry.source;
        link.textContent = t("model.source", { host: new URL(entry.source).hostname.replace(/^www\./, "") });
    }

    // A note, not an error: it doesn't block the step. The rule itself is a
    // placeholder (legal check pending), see note.natante10.h.
    function renderRegisteredNote() {
        var note = byId("registeredNote");
        if (!note) return;
        var loaEl = byId("loa");
        note.hidden = !(state.registered === "natante" && loaEl && parseLoa(loaEl.value) > 10);
    }

    // Where the job is done follows from the length; null until it's valid.
    function serviceSite() {
        var loa = parseLoa((byId("loa") || {}).value || "");
        if (!(loa >= LOA_MIN && loa <= LOA_MAX)) return null;
        return loa <= SHOP_MAX_LOA ? "carrozzeria" : "cantiere";
    }

    function renderServiceSite() {
        var note = byId("serviceSite");
        if (!note) return;
        var site = serviceSite();
        note.hidden = !site;
        if (site) note.innerHTML = t(site === "carrozzeria" ? "note.site.shop.h" : "note.site.yard.h", { max: formatNumber(SHOP_MAX_LOA) });
    }

    function updateRegistrationField() {
        var rule = RULE.registration;
        if (!rule) return;
        var active = ruleActive(rule);
        fieldOf(rule.el).hidden = !active;
        if (!active) paint(rule, true);
    }

    // Type pictures: <img data-type-thumb="<type>" src="../models/thumbs/<type>.webp">
    // next to a [data-type-icon] in the same parent. The picture replaces the
    // SVG silhouette once it has loaded; if it is missing or fails, the
    // silhouette stays (the thumbnails may not exist yet).
    // The JS-built ones (summary) resolve next to app.js: src/../models/thumbs/.
    var THUMB_DIR = CONFIG.thumbDir ||
        (SELF && SELF.src ? new URL("../models/thumbs/", SELF.src).href : "models/thumbs/");

    function syncThumb(img) {
        var icon = $("[data-type-icon]", img.parentNode);
        var ok = img.complete && img.naturalWidth > 0;
        img.hidden = !ok;
        if (icon) icon.hidden = ok;
    }

    function bindThumb(img) {
        if (img.getAttribute("data-thumb-bound")) return;
        img.setAttribute("data-thumb-bound", "1");
        img.addEventListener("load", function () { syncThumb(img); });
        img.addEventListener("error", function () { syncThumb(img); });
        syncThumb(img);
    }

    function setThumb(img, type) {
        bindThumb(img);
        img.setAttribute("data-type-thumb", type);
        var src = THUMB_DIR + type + ".webp";
        if (img.getAttribute("src") !== src) {
            img.hidden = true;       // until the new picture has loaded
            img.setAttribute("src", src);
        }
        syncThumb(img);
    }

    function renderBoatSummary() {
        var box = byId("boatSummary");
        if (!box) return;
        var builder = clean((byId("builder") || {}).value || "");
        var model = clean((byId("model") || {}).value || "");
        var show = !!(state.boatType && builder && model);
        box.hidden = !show;
        if (!show) return;
        var icon = byId("boatSummaryIcon");
        if (icon) icon.innerHTML = Z.TYPE_ICONS[state.boatType] || "";
        var thumb = byId("boatSummaryThumb");
        if (thumb) setThumb(thumb, state.boatType);
        var bits = [builder + " " + model];
        var loa = parseLoa((byId("loa") || {}).value || "");
        if (!isNaN(loa)) bits.push(formatNumber(loa) + " m");
        var year = ((byId("year") || {}).value || "").trim();
        if (year) bits.push(year);
        var text = byId("boatSummaryText");
        if (text) text.textContent = bits.join(" · ");
    }

    function onBoatType(value) {
        var previous = state.boatType;
        state.boatType = value;
        if (previous && previous !== value) {
            // Zones belong to a hull; the old ones mean nothing on the new
            // one. Autocolor cleared them silently; here it is said.
            if (state.zones.length) {
                state.zones = [];
                announce(t("zones.cleared"));
            }
            // A destroyed WebGL context can't be reused, so the old viewer
            // goes now and the next visit to step 3 builds a fresh one.
            destroyViewer();
        }
        if (state.autoType && value !== state.autoType) { state.autoType = ""; state.autofillNote = false; renderAutofillNote(); }
        checkId("boatType", false);
        renderBoatSummary();
        renderChecklist();
        renderSummary();
        refreshMain();
    }

    /* ---------- Step 3: zones, viewer, summary, checklist ---------- */

    var viewer = null;
    var viewerType = null;      // boat type the viewer is mounted (or mounting) for
    var viewerMountId = 0;
    var importRetried = false;
    var viewerErrorKey = null;  // error shown in the overlay, redrawn on language change

    function isZoneSelected(id) { return state.zones.indexOf(id) !== -1; }

    function orderedZones() {
        var order = Z.BY_TYPE[state.boatType] || [];
        return state.zones.filter(function (id) { return order.indexOf(id) !== -1; })
            .sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
    }

    function setZone(id, on) {
        var allowed = Z.BY_TYPE[state.boatType] || [];
        if (allowed.indexOf(id) === -1) return;
        var index = state.zones.indexOf(id);
        if (on && index === -1) state.zones.push(id);
        else if (!on && index !== -1) state.zones.splice(index, 1);
        afterZonesChange();
    }

    // The host owns the selection; the viewer only reflects it.
    function toggleZone(id) { setZone(id, !isZoneSelected(id)); }

    function afterZonesChange() {
        if (viewer) viewer.refreshSelection();
        renderSummary();
        syncChecklist();
        checkId("zones", false);
        refreshMain();
    }

    function renderSummary() {
        var list = byId("zonesList");
        if (!list) return;
        var ids = orderedZones();
        var lang = I18N.getLang();
        var loa = parseLoa((byId("loa") || {}).value || "");
        var tier = state.tier;

        list.textContent = "";
        ids.forEach(function (id) {
            var item = document.createElement("li");
            item.className = "zone-row";
            item.setAttribute("data-zone", id);
            var name = document.createElement("span");
            name.className = "zone-row__name";
            name.textContent = Z.label(id, lang);
            if (id === "bottom" && state.antifoulingColor) {
                var sub = document.createElement("span");
                sub.className = "zone-row__sub";
                sub.textContent = " · " + antifoulingName(state.antifoulingColor);
                name.appendChild(sub);
            }
            var cost = document.createElement("span");
            cost.className = "zone-row__price";
            var value = Z.price(id, loa);
            cost.textContent = value === null ? t("est.none") : Z.formatEUR(value);
            var remove = makeButton("zone-row__remove", "✕", t("btn.remove", { label: Z.label(id, lang) }));
            remove.setAttribute("data-zone-remove", id);
            item.appendChild(name);
            item.appendChild(cost);
            item.appendChild(remove);
            list.appendChild(item);
        });

        var countEl = byId("zonesCount");
        if (countEl) countEl.textContent = t("sum.count", { count: ids.length });
        var empty = byId("zonesEmpty");
        if (empty) empty.hidden = ids.length > 0;
        var clear = byId("zonesClear");
        if (clear) clear.hidden = ids.length === 0;

        var est = Z.estimate(ids, tier, loa);
        var nudge = byId("zonesNudge");
        if (nudge) {
            var text = Z.discountHint(est.priced, lang);
            nudge.textContent = text;
            nudge.hidden = !text;
            // Dashed while there is a next step, solid at the cap.
            nudge.classList.toggle("is-maxed", est.priced > 0 && Z.discountRate(est.priced + 1) === est.rate);
        }

        var box = byId("estimate");
        if (box) box.hidden = ids.length === 0 && !est.package;
        setRow("estPackageRow", est.package > 0);
        setText("estPackageLabel", tier ? t("tier." + tier + ".name") : "");
        setText("estPackage", Z.formatEUR(est.package));
        setRow("estSubtotalRow", ids.length > 0 && (est.rate > 0 || est.package > 0));
        setText("estSubtotal", Z.formatEUR(est.subtotal));
        setRow("estDiscountRow", est.rate > 0);
        setText("estDiscountLabel", t("sum.discount", { count: est.priced, rate: est.rate }));
        // U+2212, a real minus sign.
        setText("estDiscount", "−" + Z.formatEUR(est.discount));
        setText("estTotal", Z.formatEUR(est.total));
        var note = t("sum.note", {
            tier: tier ? t("tier." + tier + ".name") : "",
            loa: isNaN(loa) ? "?" : formatNumber(loa)
        });
        if (est.unpriced) note += " " + t("sum.unpriced", { count: est.unpriced });
        setText("estNote", note);
        renderAntifouling();
    }

    /* ---------- Step 3: antifouling colour (optional, indicative) ----------
       Offered only while «Opera viva» (zone `bottom`) is selected. The strips
       are the hero's (Z.SWATCHES, sw.<id> names), the choice repaints the
       viewer's bottom through setColors and rides in the payload. With no
       viewer (checklist mode) it is just stored: nothing to paint.        */

    function antifoulingSwatch(id) {
        return Z.SWATCHES.filter(function (swatch) { return swatch.id === id; })[0] || null;
    }

    function antifoulingName(id) {
        var key = "sw." + id;
        var text = t(key);
        return text === key ? id : text;
    }

    function antifoulingHex(id) {
        var swatch = antifoulingSwatch(id);
        return swatch ? swatchHex(swatch, CONFIG.theme || {}) : null;
    }

    // The viewer shows the chosen colour, or the theme's own hull colour when
    // there is none; called after every mount too (a new viewer starts plain).
    function paintAntifouling() {
        if (!viewer || typeof viewer.setColors !== "function") return;
        var hex = state.antifoulingColor ? antifoulingHex(state.antifoulingColor)
            : (CONFIG.theme && CONFIG.theme.bottom) || antifoulingHex("original");
        if (hex) viewer.setColors({ bottom: hex });
    }

    function onAntifouling(value) {
        state.antifoulingColor = value;
        paintAntifouling();
        renderAntifouling();
        renderSummary();
    }

    function renderAntifouling() {
        var block = byId("antifoulingBlock");
        if (!block) return;
        var on = isZoneSelected("bottom") && (Z.BY_TYPE[state.boatType] || []).indexOf("bottom") !== -1;
        // Unselecting «Opera viva» drops the colour: nothing painted that is not asked for.
        if (!on && state.antifoulingColor) {
            state.antifoulingColor = "";
            if (groups.antifouling) groups.antifouling.reset();
            paintAntifouling();
        }
        block.hidden = !on;
        var group = byId("antifoulingSwatches");
        if (group) {
            $$('[role="radio"]', group).forEach(function (button) {
                button.setAttribute("aria-label", swatchName(button));
            });
        }
        var chip = byId("antifoulingChip"), name = byId("antifoulingName");
        var hex = state.antifoulingColor ? antifoulingHex(state.antifoulingColor) : null;
        if (chip) { chip.hidden = !hex; if (hex) chip.style.setProperty("--sw", hex); }
        if (name) name.textContent = state.antifoulingColor ? antifoulingName(state.antifoulingColor) : "";
        var caption = byId("antifoulingCaption");
        if (caption) caption.hidden = !state.antifoulingColor;
    }

    function initAntifouling() {
        var group = byId("antifoulingSwatches");
        if (!group) return;
        renderSwatches(group, CONFIG.theme || {});
        groups.antifouling = radioGroup(group, { selectedClass: "is-active", onSelect: onAntifouling });
    }

    function setText(id, text) { var el = byId(id); if (el) el.textContent = text; }
    function setRow(id, visible) { var el = byId(id); if (el) el.hidden = !visible; }

    function renderChecklist() {
        var host = byId("zonesChecklist");
        if (!host) return;
        var lang = I18N.getLang();
        host.textContent = "";
        (Z.BY_TYPE[state.boatType] || []).forEach(function (id) {
            var label = document.createElement("label");
            label.className = "check";
            var box = document.createElement("input");
            box.type = "checkbox";
            box.value = id;
            box.checked = isZoneSelected(id);
            var span = document.createElement("span");
            span.textContent = Z.label(id, lang);
            label.appendChild(box);
            label.appendChild(span);
            host.appendChild(label);
        });
    }

    function syncChecklist() {
        $$('#zonesChecklist input[type="checkbox"]').forEach(function (box) {
            box.checked = isZoneSelected(box.value);
        });
    }

    function openChecklist() {
        var picker = byId("zonesPicker");
        if (picker) picker.open = true;
    }

    function enterStep3() {
        renderChecklist();
        ensureViewer();
        // For coming back to a viewer that was measured while its container
        // was hidden (it had no size of its own then).
        if (viewer) viewer.resize();
        renderSummary();
    }

    function resetOverlay() {
        var overlay = byId("boatOverlay"), loading = byId("boatLoading"), error = byId("boatError");
        if (overlay) overlay.classList.remove("hidden");
        if (loading) loading.hidden = false;
        if (error) { error.hidden = true; error.textContent = ""; }
    }

    function showViewerError(key) {
        var overlay = byId("boatOverlay"), loading = byId("boatLoading"), error = byId("boatError");
        if (overlay) overlay.classList.remove("hidden");
        if (loading) loading.hidden = true;
        if (error) { error.textContent = t(key); error.hidden = false; }
        viewerErrorKey = key;
    }

    // A destroyed WebGL context can't be reused: the canvas is replaced by a
    // fresh clone (same id, class and attributes) before the next mount.
    function freshCanvas() {
        var old = byId("boatCanvas");
        var neu = old.cloneNode(false);
        old.parentNode.replaceChild(neu, old);
        return neu;
    }

    function destroyViewer() {
        viewerMountId++;          // anything still in flight has nothing to mount into
        if (viewer) {
            viewer.destroy();
            viewer = null;
            if (byId("boatCanvas")) freshCanvas();
        }
        viewerType = null;
        importRetried = false;
        viewerErrorKey = null;
    }

    function onViewerHover(zone) {
        var el = byId("zoneHover");
        if (!el) return;
        var id = zone && typeof zone === "object" ? zone.id : zone;
        el.textContent = typeof id === "string" && id ? Z.label(id, I18N.getLang()) : "";
    }

    // Mirrors autocolor's ensureCar3D: one cached import, a mountId race
    // guard so a late callback never mounts into a canvas a newer mount owns,
    // one automatic retry after 600 ms, then the checklist.
    function ensureViewer() {
        var type = state.boatType;
        var canvas = byId("boatCanvas");
        if (!type || !canvas) return;
        // Already mounted (or still mounting) for this type. A viewer that
        // failed to build doesn't count: it is torn down and mounted again, or
        // the error would sit there for good.
        if (viewerType === type && !(viewer && viewer.loadFailed())) return;

        if (viewer) {
            viewer.destroy();
            viewer = null;
            canvas = freshCanvas();
        }
        viewerType = type;
        resetOverlay();

        var mountId = ++viewerMountId;
        loadBoat3D().then(function (mod) {
            // A later call already claimed the canvas and the overlay (the
            // customer changed type while the import was in flight).
            if (mountId !== viewerMountId) return;
            importRetried = false;
            try {
                viewer = mod.mountBoat3D({
                    boatType: type,
                    canvasEl: canvas,
                    canvasWrapEl: byId("boatCanvasWrap"),
                    overlayEl: byId("boatOverlay"),
                    errorEl: byId("boatError"),
                    loadingLabelEl: byId("boatLoading"),
                    buttonsEl: byId("boatViewButtons"),
                    isPartSelected: isZoneSelected,
                    onPartToggle: toggleZone,
                    // The same two under the names flow-spec §5.1 used.
                    isZoneSelected: isZoneSelected,
                    onZoneToggle: toggleZone,
                    onHover: onViewerHover,
                    onLoadError: openChecklist,
                    interactive: true,
                    spin: false,
                    loadErrorText: t("viewer.errorMount"),
                    showWater: true,
                    theme: CONFIG.theme
                });
            } catch (err) {
                // It downloaded and failed to build: no WebGL, or no context
                // left. Fetching the module again fixes nothing; the list does.
                viewerType = null;
                viewer = null;
                console.error("[wizard] Could not build the 3D viewer:", err);
                showViewerError("viewer.errorMount");
                openChecklist();
                return;
            }
            // boat3d.js hides the overlay itself once the boat is on screen
            // (class "hidden"), and opens it again if the build failed.
            if (viewer.loadFailed()) {
                showViewerError("viewer.errorMount");
                openChecklist();
            }
            if (state.antifoulingColor) paintAntifouling();
        }, function (err) {
            // Import failures only: a mountBoat3D that throws is handled above.
            if (mountId !== viewerMountId) return;
            viewerType = null;
            console.error("[wizard] Could not load the 3D viewer:", err);

            // One automatic retry before the checklist: what this catches is
            // almost always a dropped fetch, and asking again a moment later
            // usually works. The delay keeps the retry off the connection that
            // just died; loadBoat3D() already bumped the ?reintento= counter.
            if (!importRetried) {
                importRetried = true;
                setTimeout(function () {
                    // A newer mount owns the canvas by now; it does its own
                    // import, and the flag goes back so it gets its own retry.
                    if (mountId !== viewerMountId) { importRetried = false; return; }
                    ensureViewer();
                }, 600);
                return;
            }
            importRetried = false;
            showViewerError("viewer.errorImport");
            openChecklist();
        });
    }

    /* ---------- Submit, success, reset ---------- */

    function buildPayload() {
        var value = function (id) { var el = byId(id); return el ? clean(el.value) : ""; };
        var phone = value("phone");
        return {
            lang: I18N.getLang(),
            boatType: state.boatType,
            tier: state.tier,
            zones: orderedZones(),
            antifoulingColor: state.antifoulingColor || null,
            builder: value("builder"),
            model: value("model"),
            year: Number(value("year")),
            loa: parseLoa(value("loa")),
            registered: state.registered,
            berthKind: state.berthKind,
            registration: state.registered === "registrata" ? value("registration") : "",
            engineHours: value("engineHours") === "" ? null : Number(value("engineHours")),
            location: value("location"),
            serviceSite: serviceSite(),
            boatName: value("boatName"),
            colorCode: value("colorCode"),
            firstName: value("firstName"),
            lastName: value("lastName"),
            phone: phone.charAt(0) === "+" ? phone : "+39" + phone,
            email: value("email"),
            notes: (byId("notes") || { value: "" }).value.trim()
        };
    }

    // A 10-digit code, first digit non-zero. The modulo bias of a 32-bit
    // value over 9 or 10 is far below anything a demo code could care about.
    function demoCode() {
        var buf = new Uint32Array(10);
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(buf);
        } else {
            for (var k = 0; k < buf.length; k++) buf[k] = Math.floor(Math.random() * 4294967296);
        }
        var code = String(1 + (buf[0] % 9));
        for (var i = 1; i < buf.length; i++) code += String(buf[i] % 10);
        return code;
    }

    // Simulated: autocolor POSTed to a server, here a timer stands in for it.
    // The success screen still appears only after the "server" answers.
    function submitRequest() {
        if (submitting) return;
        submitting = true;
        setHint(null);
        refreshMain();
        var payload = buildPayload();
        setTimeout(function () {
            var code = demoCode();
            console.info("[cipressina] demo payload (nothing was sent):", payload, "code", code);
            lastSubmission = {
                code: code,
                boat: payload.builder + " " + payload.model,
                name: payload.firstName + " " + payload.lastName
            };
            submitting = false;
            submitted = true;
            history.pushState({ view: "wizard", step: "success" }, "", WIZARD_URL);
            renderSuccess({ focus: true });
        }, 600);
    }

    function renderSuccess(options) {
        shown.view = "wizard";
        shown.step = "success";
        stepEls.forEach(function (el) { el.hidden = true; el.classList.remove("is-active"); });
        showChrome(false);
        if (backBtn) backBtn.hidden = true;
        setHint(null);
        document.body.setAttribute("data-step", "success");
        var codeEl = byId("successCode");
        if (codeEl && lastSubmission) codeEl.textContent = lastSubmission.code;
        var lookupInput = byId("lookupId");
        if (lookupInput && lastSubmission) lookupInput.value = lastSubmission.code;
        if (successEl) successEl.hidden = false;
        updateTitle();
        if (options && options.focus) {
            focusHeading(successEl);
            scrollToTop();
        }
    }

    function resetWizard() {
        submitted = false;
        submitting = false;
        state = freshState();
        destroyViewer();
        $$("form.step", wizardEl).forEach(function (form) { form.reset(); });
        Object.keys(groups).forEach(function (id) { groups[id].reset(); });
        RULES.forEach(function (rule) { if (!rule.virtual) paint(rule, true); });
        updateRegistrationField();
        renderModelSource();
        renderAutofillNote();
        renderRegisteredNote();
        renderServiceSite();
        renderBoatSummary();
        fillModelList();
        renderChecklist();
        renderSummary();
        var picker = byId("zonesPicker");
        if (picker) picker.open = false;
        var codeEl = byId("successCode");
        if (codeEl) codeEl.textContent = "";
        goTo(1, "replace");
    }

    /* ---------- Wizard init ---------- */

    function initWizard() {
        if (!wizardEl || !stepEls.length) return;
        defineRules();

        $$("[data-type-icon]").forEach(function (el) { el.innerHTML = Z.TYPE_ICONS[el.getAttribute("data-type-icon")] || ""; });
        $$("img[data-type-thumb]").forEach(function (img) {
            var type = img.getAttribute("data-type-thumb");
            if (type) { bindThumb(img); } else { img.hidden = true; }
        });

        // Radiogroups
        var typeGroup = byId("boatType");
        if (typeGroup) groups.boatType = radioGroup(typeGroup, { selectedClass: "is-selected", onSelect: onBoatType });
        var registeredGroup = byId("registered");
        if (registeredGroup) {
            groups.registered = radioGroup(registeredGroup, {
                selectedClass: "is-selected",
                onSelect: function (value) {
                    state.registered = value;
                    updateRegistrationField();
                    checkId("registered", false);
                    renderRegisteredNote();
                    refreshMain();
                }
            });
        }
        var berthGroup = byId("berthKind");
        if (berthGroup) {
            groups.berthKind = radioGroup(berthGroup, {
                selectedClass: "is-selected",
                onSelect: function (value) {
                    state.berthKind = value;
                    checkId("berthKind", false);
                    refreshMain();
                }
            });
        }
        var tierGroup = byId("tier");
        if (tierGroup) {
            groups.tier = radioGroup(tierGroup, {
                selectedClass: "is-selected",
                onSelect: function (value) {
                    state.tier = value;
                    checkId("tier", false);
                    renderSummary();
                    refreshMain();
                }
            });
        }

        // Text controls: caps from the table, formatting on input, error on
        // blur, and a live repaint while an error is showing.
        RULES.forEach(function (rule) {
            if (rule.virtual || rule.radio) return;
            var el = rule.el;
            if (rule.max && el.tagName !== "SELECT") el.maxLength = rule.max;
            var onChange = function () {
                if (rule.format) {
                    var formatted = rule.format(el.value);
                    if (formatted !== el.value) el.value = formatted;
                }
                if (rule.id === "loa") {
                    renderRegisteredNote();
                    renderServiceSite();
                    if (state.autofillNote && el.value !== state.autoLoa) { state.autofillNote = false; renderAutofillNote(); }
                }
                if (rule.id === "loa" || rule.id === "year") renderBoatSummary();
                if (rule.err) check(rule, true);
                refreshMain();
            };
            el.addEventListener("input", onChange);
            if (el.tagName === "SELECT") el.addEventListener("change", onChange);
            el.addEventListener("blur", function () {
                if (rule.id === "loa") {
                    var n = parseLoa(el.value);
                    if (!isNaN(n)) el.value = formatNumber(n);
                }
                check(rule, true);
            });
        });
        Object.keys(OPTIONAL_MAX).forEach(function (id) {
            var el = byId(id);
            if (el) el.maxLength = OPTIONAL_MAX[id];
        });
        describeRules();

        // Builder and model
        fillBuilderList();
        fillModelList();
        var builderEl = byId("builder"), modelEl = byId("model");
        if (builderEl) builderEl.addEventListener("input", function () { fillModelList(); onModelCommit(); renderBoatSummary(); });
        if (modelEl) {
            modelEl.addEventListener("input", function () { onModelCommit(); renderBoatSummary(); });
            modelEl.addEventListener("change", function () { onModelCommit(); renderBoatSummary(); });
        }

        updateRegistrationField();
        renderServiceSite();

        // Step 3
        initAntifouling();
        var list = byId("zonesList");
        if (list) {
            list.addEventListener("click", function (event) {
                var remove = event.target.closest("[data-zone-remove]");
                if (!remove) return;
                var id = remove.getAttribute("data-zone-remove");
                var ids = orderedZones();
                var at = ids.indexOf(id);
                var neighbour = ids[at + 1] || ids[at - 1];
                setZone(id, false);
                // The button that had focus is gone: hand focus to a
                // neighbour, or to the summary when the list is now empty.
                var next = neighbour ? $('[data-zone-remove="' + neighbour + '"]', list) : byId("zonesSummary");
                if (next) next.focus();
            });
        }
        var clear = byId("zonesClear");
        if (clear) {
            clear.addEventListener("click", function () {
                state.zones = [];
                afterZonesChange();
                var summary = byId("zonesSummary");
                if (summary) summary.focus();
            });
        }
        var checklist = byId("zonesChecklist");
        if (checklist) {
            checklist.addEventListener("change", function (event) {
                if (event.target && event.target.type === "checkbox") setZone(event.target.value, event.target.checked);
            });
        }

        // Navigation and submit
        if (nextBtn) nextBtn.addEventListener("click", onMain);
        if (backBtn) {
            backBtn.addEventListener("click", function () {
                // Not while a request is on its way: going back mid-send left
                // the label and the eventual error on the wrong step.
                if (submitting) return;
                if (current > 1) goTo(current - 1, "push");
            });
        }
        // Enter inside a field is the same as the main button.
        $$("form.step", wizardEl).forEach(function (form) {
            form.addEventListener("submit", function (event) { event.preventDefault(); onMain(); });
        });
        var reset = byId("resetBtn");
        if (reset) reset.addEventListener("click", resetWizard);
    }

    /* ==================================================================
       8. Lookup (demo)
       ================================================================== */

    var STATUS_KEYS = ["ricevuta", "alaggio", "trasporto", "preparazione", "verniciatura",
        "antivegetativa", "varo", "pronta", "consegnata", "annullata"];
    var lookupResult = null;     // what is on screen, so a language change can redraw it
    var lookupErrorKey = null;
    var lookupBusy = false;

    function setPh(el, text) {
        el.textContent = "";
        var span = document.createElement("span");
        span.className = "ph";
        span.textContent = text;
        el.appendChild(span);
    }

    function renderLookupError() {
        var el = byId("lookupError"), input = byId("lookupId");
        if (!el) return;
        el.textContent = lookupErrorKey ? t(lookupErrorKey) : "";
        el.hidden = !lookupErrorKey;
        if (input) {
            if (lookupErrorKey) input.setAttribute("aria-invalid", "true");
            else input.removeAttribute("aria-invalid");
        }
    }

    function renderLookupResult() {
        var box = byId("lookupResult");
        if (!box) return;
        box.hidden = !lookupResult;
        if (!lookupResult) return;
        setText("resultId", lookupResult.code);
        var boat = byId("resultBoat"), name = byId("resultName");
        if (lookupResult.known) {
            if (boat) boat.textContent = lookupResult.known.boat;
            if (name) name.textContent = lookupResult.known.name;
        } else {
            if (boat) setPh(boat, t("lookup.res.sample"));
            if (name) setPh(name, t("lookup.res.sample"));
        }
        var status = byId("resultStatus");
        if (status) {
            status.textContent = t("status." + lookupResult.status);
            status.setAttribute("data-status", lookupResult.status);
        }
    }

    function initLookup() {
        var form = byId("lookupForm"), input = byId("lookupId"), button = byId("lookupSubmit");
        if (!form || !input) return;
        input.addEventListener("input", function () {
            var digits = digitsOnly(input.value, 10);
            if (digits !== input.value) input.value = digits;
            if (lookupErrorKey && digits.length === 10) { lookupErrorKey = null; renderLookupError(); }
        });
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (lookupBusy) return;
            var code = input.value;
            if (!/^\d{10}$/.test(code)) {
                lookupErrorKey = "lookup.err";
                lookupResult = null;
                renderLookupError();
                renderLookupResult();
                input.focus();
                return;
            }
            lookupErrorKey = null;
            renderLookupError();
            lookupBusy = true;
            if (button) { button.textContent = t("lookup.busy"); button.setAttribute("aria-disabled", "true"); }
            // Any 10 digits get a demo status, picked from the digits so the
            // same code always shows the same one. The code just "sent" in
            // this session is received, and shows its own boat and name.
            setTimeout(function () {
                var sum = 0;
                for (var i = 0; i < code.length; i++) sum += Number(code.charAt(i));
                var known = lastSubmission && lastSubmission.code === code ? lastSubmission : null;
                lookupResult = {
                    code: code,
                    status: known ? "ricevuta" : STATUS_KEYS[sum % (STATUS_KEYS.length - 1)],
                    known: known
                };
                lookupBusy = false;
                if (button) { button.textContent = t("lookup.submit"); button.removeAttribute("aria-disabled"); }
                renderLookupResult();
                var box = byId("lookupResult");
                if (box) { box.setAttribute("tabindex", "-1"); box.focus(); }
            }, 400);
        });
    }

    /* ==================================================================
       9. Language change and init
       ================================================================== */

    // Re-renders everything that was built from t() in JS; the static text
    // was already refreshed by I18N.apply.
    function onLanguage() {
        syncLangControls();
        setMenu(menuToggle ? menuToggle.classList.contains("is-open") : false);
        updateTitle();
        renderTierPrices();
        renderDiscountList();
        renderQuoteLine();
        labelSwatches();
        $$("[data-copy].is-copied").forEach(function (button) { button.textContent = t("btn.copied"); });

        if (wizardEl) {
            renderServiceSite();
            updateProgress();
            if (hintKey) setHint(hintKey);
            RULES.forEach(function (rule) {
                if (rule.err && rule.err.key && rule.errEl) rule.errEl.textContent = t(rule.err.key, rule.err.params);
            });
            if (viewerErrorKey) showViewerError(viewerErrorKey);
            renderModelSource();
            renderAutofillNote();
            renderBoatSummary();
            renderChecklist();
            renderSummary();
            refreshMain();
        }
        renderLookupError();
        renderLookupResult();
        if (lookupBusy) { var busy = byId("lookupSubmit"); if (busy) busy.textContent = t("lookup.busy"); }
    }

    function init() {
        I18N.apply(document);
        initMenu();
        initLang();
        initCopy();
        initChromeLinks();
        var year = byId("footYear");
        if (year) year.textContent = String(new Date().getFullYear());

        initHero();
        initQuoteLine();
        renderTierPrices();
        renderDiscountList();
        initLightbox();
        initWizard();
        initLookup();

        document.addEventListener("cipressina:lang", onLanguage);
        window.addEventListener("popstate", route);
        window.addEventListener("hashchange", route);
        readQueryPick();
        onLanguage();
        // Opening preventivo.html shows the wizard (or the lookup on #stato)
        // without stealing focus; index.html is the home view.
        route();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();

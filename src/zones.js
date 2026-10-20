/* =========================================================================
   zones.js: window.CIPRESSINA_ZONES, the data and the maths of a quote

   Boat equivalent of autocolor's src/parts.js. One file holds everything the
   estimate needs (zone labels, which zones each boat type has, the price
   list, the multi-zone discount, the euro formatter), so the home price
   sentence, the wizard summary and the checklist fallback can never disagree.

   EVERY PRICE HERE IS A PLACEHOLDER until the shop confirms its list
   (PLACEHOLDER = true, and estimate() says so in its result). Nothing is
   claimed about real tariffs, warranties, turnaround or maximum LOA.

   CAREFUL: BY_TYPE must list, per boat type, exactly the zone ids that
   boat3d.js builds (BOAT_MODELS[type].parts), in the same order. A zone the
   3D model has but this file doesn't is unclickable-in-the-list; one this
   file has but the model doesn't is a checkbox that paints nothing.

   Translations: EN/ES/FR are drafts, "traduzione da revisionare". The ES/FR
   terms in UNVERIFIED are standard nautical vocabulary that nobody has
   checked against a source yet (research.md §3 marks them with *).

   Classic script (no modules): loads before i18n.js and app.js.
   ========================================================================= */
(function () {
    "use strict";

    var W = typeof window !== "undefined" ? window : globalThis;
    var has = Object.prototype.hasOwnProperty;
    var PLACEHOLDER = true;

    // ---------- Boat types -------------------------------------------------
    // Same ids as boat3d.js BOAT_MODELS. i18n.js turns these into `type.<id>`
    // keys, so the labels live here once.
    var TYPES = {
        gommone:   { it: "Gommone / RIB",        en: "RIB / inflatable",    es: "Neumática / RIB",      fr: "Semi-rigide / RIB" },
        open:      { it: "Open / day cruiser",   en: "Open / day cruiser",  es: "Open / lancha de paseo", fr: "Open / day cruiser" },
        cabinato:  { it: "Cabinato",             en: "Cabin cruiser",       es: "Cabinada",             fr: "Cabin cruiser" },
        yacht:     { it: "Yacht",                en: "Yacht",               es: "Yate",                 fr: "Yacht" },
        vela:      { it: "Barca a vela",         en: "Sailboat",            es: "Velero",               fr: "Voilier" }
    };

    // ---------- Zones ------------------------------------------------------
    var LABELS = {
        it: {
            bottom: "Opera viva (antivegetativa)",
            boot: "Linea di galleggiamento",
            topside_port: "Opera morta, lato sinistro",
            topside_starboard: "Opera morta, lato destro",
            transom: "Specchio di poppa",
            deck: "Coperta",
            cabin: "Tuga / sovrastruttura",
            hardtop: "Hard-top",
            flybridge: "Fly",
            console: "Consolle",
            tube_port: "Tubolare sinistro",
            tube_starboard: "Tubolare destro",
            outboard: "Motore fuoribordo (carenatura)",
            sterndrive: "Piede poppiero",
            propeller: "Eliche e assi",
            rudder: "Timone",
            keel: "Chiglia / bulbo"
        },
        en: {
            bottom: "Underwater hull (antifouling)",
            boot: "Boot stripe",
            topside_port: "Port topside",
            topside_starboard: "Starboard topside",
            transom: "Transom",
            deck: "Deck",
            cabin: "Superstructure",
            hardtop: "Hardtop",
            flybridge: "Flybridge",
            console: "Console",
            tube_port: "Port tube",
            tube_starboard: "Starboard tube",
            outboard: "Outboard (cowling)",
            sterndrive: "Sterndrive",
            propeller: "Propellers and shafts",
            rudder: "Rudder",
            keel: "Keel / bulb"
        },
        es: {
            bottom: "Obra viva (antiincrustante)",
            boot: "Línea de flotación",
            topside_port: "Obra muerta, babor",
            topside_starboard: "Obra muerta, estribor",
            transom: "Espejo de popa",
            deck: "Cubierta",
            cabin: "Superestructura",
            hardtop: "Hard-top",
            flybridge: "Flybridge",
            console: "Consola",
            tube_port: "Flotador babor",
            tube_starboard: "Flotador estribor",
            outboard: "Fueraborda (carenado)",
            sterndrive: "Cola / pie",
            propeller: "Hélices y ejes",
            rudder: "Timón",
            keel: "Quilla / bulbo"
        },
        fr: {
            bottom: "Œuvres vives (antifouling)",
            boot: "Ligne de flottaison",
            topside_port: "Œuvres mortes, bâbord",
            topside_starboard: "Œuvres mortes, tribord",
            transom: "Tableau arrière",
            deck: "Pont",
            cabin: "Superstructure",
            hardtop: "Hard-top",
            flybridge: "Flybridge",
            console: "Console",
            tube_port: "Boudin bâbord",
            tube_starboard: "Boudin tribord",
            outboard: "Hors-bord (capot)",
            sterndrive: "Embase",
            propeller: "Hélices et arbres",
            rudder: "Gouvernail",
            keel: "Quille / lest"
        }
    };

    // Terms marked * in research.md §3 / brief.md: standard vocabulary, not
    // verified against a source. A native reviewer should go through these.
    var UNVERIFIED = {
        en: [],
        es: ["bottom", "boot", "topside_port", "topside_starboard", "transom", "deck", "cabin",
             "console", "tube_port", "tube_starboard", "outboard", "sterndrive", "propeller", "rudder", "keel"],
        fr: ["bottom", "boot", "topside_port", "topside_starboard", "deck", "cabin",
             "console", "tube_port", "tube_starboard", "outboard", "sterndrive", "propeller", "keel"]
    };

    // The zones of each boat type: a copy of boat3d.js BOAT_MODELS[type].parts,
    // same order (checked against it when this was written; the reviewer
    // checks it again). This is what the checklist renders and what a click
    // on the 3D model may toggle.
    var BY_TYPE = {
        gommone:   ["bottom", "topside_port", "topside_starboard", "tube_port", "tube_starboard", "console", "deck", "transom", "outboard"],
        open:      ["bottom", "boot", "topside_port", "topside_starboard", "transom", "deck", "console", "outboard"],
        cabinato:  ["bottom", "boot", "topside_port", "topside_starboard", "transom", "deck", "cabin", "hardtop", "outboard"],
        yacht:     ["bottom", "boot", "topside_port", "topside_starboard", "transom", "deck", "cabin", "flybridge"],
        vela:      ["bottom", "boot", "topside_port", "topside_starboard", "transom", "deck", "cabin", "keel", "rudder"]
    };

    // ---------- Maintenance packages -----------------------------------
    // The site's own package names and contents (i18n.js tier.*). A package is
    // a seasonal maintenance plan priced on the boat's length; the zones on
    // the 3D model are paint and repair jobs priced on top of it. «nessuno»
    // means no package, zone work only.
    var TIERS = ["base", "completo", "premium"];
    var NO_PACKAGE = "nessuno";
    var PACKAGE_CHOICES = TIERS.concat(NO_PACKAGE);

    // EUR per metre of LOA, with a floor. ALL PLACEHOLDER.
    var PACKAGES = {
        base:     { rate: 30, min: 180 },
        completo: { rate: 55, min: 350 },
        premium:  { rate: 80, min: 500 }
    };

    // Zone work: EUR per metre of LOA, `min` is the floor per zone. One rate
    // whatever the package. ALL PLACEHOLDER.
    var PRICES = {
        antifouling:    { rate: 40, min: 150 },
        stripe:         { rate: 12, min: 120 },
        topsides:       { rate: 85, min: 300 }, // per side
        transom:        { rate: 35, min: 150 },
        deck:           { rate: 70, min: 250 },
        superstructure: { rate: 65, min: 250 },
        appendage:      { rate: 28, min: 150 },
        small:          { rate: 14, min: 100 },
        tubes:          { rate: 35, min: 200 }  // per side
    };

    var PRICE_GROUP_OF = {
        bottom: "antifouling",
        boot: "stripe",
        topside_port: "topsides",
        topside_starboard: "topsides",
        transom: "transom",
        deck: "deck",
        cabin: "superstructure",
        hardtop: "superstructure",
        flybridge: "superstructure",
        console: "small",
        tube_port: "tubes",
        tube_starboard: "tubes",
        outboard: "small",
        sterndrive: "small",
        propeller: "small",
        rudder: "appendage",
        keel: "appendage"
    };

    // The multi-zone discount, in percent, indexed by how many priced zones
    // the request has: none for one, then 5, 7 and 9, and 10 from five up
    // (the last step is the cap). PLACEHOLDER, same curve as autocolor. It
    // comes off the subtotal, so the list keeps showing list prices. The home
    // page renders its discount list from this array.
    var DISCOUNT_STEPS = [0, 0, 5, 7, 9, 10];

    function discountRate(count) {
        if (!(count > 0)) return 0;
        return DISCOUNT_STEPS[Math.min(count, DISCOUNT_STEPS.length - 1)];
    }

    // ---------- Maths ------------------------------------------------------

    function perMetre(row, loa) {
        return Math.max(row.min, Math.round(row.rate * loa));
    }

    // The price of one zone at one length, or null when either is unknown.
    // hasOwnProperty throughout: an id such as "constructor" must not
    // resolve to an inherited Object method.
    function price(id, loa) {
        if (!has.call(PRICE_GROUP_OF, id)) return null;
        if (!(loa > 0)) return null;
        return perMetre(PRICES[PRICE_GROUP_OF[id]], loa);
    }

    // The price of a package at one length; null for «nessuno», an unknown
    // tier or an unknown length.
    function packagePrice(tier, loa) {
        if (!has.call(PACKAGES, tier)) return null;
        if (!(loa > 0)) return null;
        return perMetre(PACKAGES[tier], loa);
    }

    // Package + zones. The zone part follows parts.js estimate(): unpriced
    // zones add nothing and do not count towards the discount, which is
    // rounded to whole euros and only comes off the zones, never the package.
    function estimate(ids, tier, loa) {
        var subtotal = 0, priced = 0, unpriced = 0;
        (ids || []).forEach(function (id) {
            var value = price(id, loa);
            if (value === null) unpriced++;
            else { subtotal += value; priced++; }
        });
        var rate = discountRate(priced);
        var discount = Math.round(subtotal * rate / 100);
        var pkg = packagePrice(tier, loa) || 0;
        return {
            package: pkg,
            subtotal: subtotal,
            priced: priced,
            rate: rate,
            discount: discount,
            total: pkg + subtotal - discount,
            unpriced: unpriced,
            placeholder: PLACEHOLDER
        };
    }

    // The nudge under the zone list. Its three sentences live in i18n.js
    // (disc.first / disc.add / disc.max) so there is one place to translate;
    // the I18N object is looked up at call time because it loads after us.
    function discountHint(count, lang) {
        if (!(count > 0)) return "";
        var current = discountRate(count);
        var next = discountRate(count + 1);
        var key = next === current ? "disc.max" : (count === 1 ? "disc.first" : "disc.add");
        var i18n = W.CIPRESSINA_I18N;
        return i18n ? i18n.t(key, { next: next }, lang) : "";
    }

    // Always it-IT, in every UI language (client decision, flagged in the
    // brief): "1.250 €" with a no-break space before the euro sign. Don't
    // concatenate the sign by hand, and don't try es-ES (it prints "1250").
    // useGrouping "always" is needed: current CLDR sets it-IT's minimum
    // grouping digits to 2, so the plain formatter prints "1250 €" (measured
    // on Node 24 / ICU 78). Engines without the option ignore it.
    var eur = typeof Intl !== "undefined"
        ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" })
        : null;
    function formatEUR(n) {
        return eur ? eur.format(n) : String(Math.round(n)) + " €";
    }

    // The label of a zone in a language. Falls back to Italian, then to the
    // id itself, and never reads an inherited property.
    function label(id, lang) {
        var table = has.call(LABELS, lang) ? LABELS[lang] : LABELS.it;
        if (has.call(table, id)) return table[id];
        if (has.call(LABELS.it, id)) return LABELS.it[id];
        return String(id);
    }

    // ---------- Hero swatches (antivegetativa colours) ---------------------
    // research.md §5. No maker publishes hex values: ALL HEX ARE
    // APPROXIMATIONS, hence «colori indicativi» next to them. The order puts
    // «Originale» in the middle of an odd count (11), so the fan has one
    // upright strip. «Originale» is the 3D boat's own default antifouling colour
    // (boat3d.js DEFAULT_THEME.bottom, #1d3b8f); app.js uses the skin's
    // theme.bottom instead when it passes one.
    var SWATCHES = [
        { id: "bianco",      hex: "#F4F4F2", source: "Veneziani Raffaello Next" },
        { id: "azzurro",     hex: "#5B9BD5", source: "Veneziani Raffaello Next" },
        { id: "grigio12400", hex: "#8A8F94", source: "Hempel Mille NCT 12400" },
        { id: "grigioScuro", hex: "#4A4F55", source: "Veneziani Eurosprint Next" },
        { id: "verde",       hex: "#2E6B3A", source: "International Interspeed 6400 BQA643" },
        { id: "original",    hex: "#1D3B8F", source: "", placeholder: true },
        { id: "marrone",     hex: "#6B4A2B", source: "International Interspeed 6400 BQA648" },
        { id: "rosso",       hex: "#B22A2A", source: "Veneziani Raffaello Next" },
        { id: "bluScuro",    hex: "#14305E", source: "Veneziani Raffaello Next" },
        { id: "blu37110",    hex: "#1F2F4F", source: "Hempel Mille NCT 37110" },
        { id: "nero",        hex: "#1B1B1B", source: "Veneziani Raffaello Next" }
    ];

    // ---------- Builders and models (research.md §2) -----------------------
    // Step 1 offers these in a datalist; anything else is free text. `approx`
    // marks values the source gives with "~". beam is null where the source
    // has none. loa and beam are metres. (The Azimut S6 was flagged as
    // unverified when the type was «flybridge»; as a «yacht» it fits.)
    var BUILDERS = [
        { builder: "Beneteau", model: "Oceanis 40.1", type: "vela", loa: 12.87, beam: 4.18, source: "https://www.beneteau.com/en-us/oceanis/oceanis-401" },
        { builder: "Beneteau", model: "Oceanis 34.1", type: "vela", loa: 10.77, beam: 3.57, source: "https://www.beneteau.com/oceanis/oceanis-341" },
        { builder: "Beneteau", model: "Flyer 8 SUNdeck", type: "open", loa: 8.17, beam: 2.53, source: "https://www.beneteau.com/en-us/flyer/flyer-8-sundeck-v2" },
        { builder: "Jeanneau", model: "Cap Camarat 7.5 WA", type: "open", loa: 7.37, beam: 2.51, source: "https://www.jeanneau.com/boats/powerboat/7-cap-camarat-walk-around/669-cap-camarat-7-5-wa" },
        { builder: "Jeanneau", model: "Cap Camarat 10.5 WA", type: "open", loa: 9.95, beam: null, source: "https://www.jeanneau.com/en-au/boats/powerboat/7-cap-camarat-walk-around/655-cap-camarat-10-5wa" },
        { builder: "Bavaria", model: "C45", type: "vela", loa: 14.44, beam: 4.49, approx: true, source: "https://boat-specs.com/sailing/sailboats/bavaria-yachts/bavaria-c45-standard" },
        { builder: "Sessa Marine", model: "C38", type: "cabinato", loa: 11.83, beam: 3.75, source: "https://yacht.sessamarine.com/en/yacht/c38-cruiser-line/" },
        { builder: "Sessa Marine", model: "C3X", type: "cabinato", loa: 11.33, beam: 3.45, source: "https://yacht.sessamarine.com/en/yacht/c3x-ob/" },
        { builder: "Sessa Marine", model: "C42", type: "cabinato", loa: 13.10, beam: 3.90, source: "https://yacht.sessamarine.com/en/yacht/c42-yacht-line/" },
        { builder: "Sessa Marine", model: "C47", type: "cabinato", loa: 14.27, beam: 4.40, source: "https://yacht.sessamarine.com/en/yacht/c47/" },
        { builder: "Sessa Marine", model: "FLY54", type: "yacht", loa: 16.36, beam: null, source: "https://yacht.sessamarine.com/en/yacht/fly54-flybridge-line/" },
        { builder: "Ranieri International", model: "Voyager 23 S", type: "open", loa: 6.75, beam: 2.40, source: "https://www.ranieri-international.com/en/voyager-23-s.php" },
        { builder: "Ranieri International", model: "255 SL", type: "open", loa: 7.80, beam: 2.55, source: "https://www.ranieri-international.com/en/255-sl.php" },
        { builder: "Ranieri International", model: "275 SL", type: "open", loa: 8.20, beam: 2.55, source: "https://ranieri-international.com/en/275-sl/" },
        { builder: "Ranieri International", model: "Cayman 27 Sport Touring", type: "gommone", loa: 8.30, beam: 3.20, source: "https://itboat.com/models/10002-ranieri-international-cayman-27-sport-touring" },
        { builder: "Joker Boat", model: "Clubman 26", type: "gommone", loa: 7.93, beam: 3.00, source: "https://jokerboat.com/rhib/clubman-26/" },
        { builder: "Azimut", model: "S6", type: "yacht", loa: 18.0, beam: 4.75, approx: true, source: "https://www.yachtbuyer.com/en-us/yachts/compare/azimut-s6-vs-beneteau-monte-carlo-6s-b09a6d1" },
        { builder: "Cranchi", model: "E26 O/B", type: "open", loa: 7.85, beam: 2.49, source: "https://www.cranchi.com/wp-content/uploads/2026/06/catalogo_E26-OB_LD.pdf" },
        { builder: "Cranchi", model: "E30 Endurance", type: "cabinato", loa: 9.85, beam: 2.95, source: "https://cranchi.com/en/yachts/e30-endurance" },
        { builder: "Quicksilver", model: "Activ 675 Open", type: "open", loa: 7.16, beam: 2.55, source: "https://www.quicksilver-boats.com/media/productsheet/activ%20675%20open%20product%20sheet%20uk-en.pdf" },
        { builder: "Quicksilver", model: "675 Pilothouse", type: "cabinato", loa: 6.55, beam: 2.54, source: "https://www.quicksilver-boats.com/media/220786/products-sheet_quicksilver_675ph_en.pdf" }
    ];

    function norm(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase(); }

    function builderNames() {
        var seen = {}, out = [];
        BUILDERS.forEach(function (b) {
            if (!has.call(seen, b.builder)) { seen[b.builder] = true; out.push(b.builder); }
        });
        return out;
    }

    // Models of one builder; with no builder (or an unknown one typed so far)
    // the caller decides, so an empty/unknown name returns every model.
    function modelsFor(builder) {
        var b = norm(builder);
        var own = BUILDERS.filter(function (e) { return norm(e.builder) === b; });
        return own.length ? own : (b === "" ? BUILDERS.slice() : []);
    }

    // The catalogue entry for what the customer typed, or null. With no
    // builder typed, a model name that exists once is enough.
    function findModel(builder, model) {
        var b = norm(builder), m = norm(model);
        if (!m) return null;
        var hits = BUILDERS.filter(function (e) {
            return norm(e.model) === m && (b === "" || norm(e.builder) === b);
        });
        return hits.length === 1 ? hits[0] : null;
    }

    // ---------- Boat silhouettes for the type cards ------------------------
    // Side profiles in currentColor, one per type; app.js injects them into
    // every [data-type-icon="<type>"] element so the three skins don't each
    // carry their own drawing. Decorative: aria-hidden.
    function svg(inner) {
        return '<svg viewBox="0 0 96 40" width="96" height="40" fill="currentColor" aria-hidden="true" focusable="false">' + inner + "</svg>";
    }
    var TYPE_ICONS = {
        gommone: svg('<rect x="4" y="16" width="84" height="10" rx="5"/><path d="M10 28h72l-4 5H14z"/><path d="M42 16l2-7h8l2 7z"/><rect x="88" y="14" width="5" height="16" rx="1.5"/>'),
        open: svg('<path d="M4 20h84l-8 14H16z"/><path d="M38 20l8-8h7l-3 8z"/><rect x="88" y="18" width="4" height="12" rx="1.5"/>'),
        cabinato: svg('<path d="M4 22h86l-8 12H14z"/><path d="M24 22l8-10h26l10 10z"/>'),
        yacht: svg('<path d="M4 24h88l-8 11H14z"/><path d="M20 24v-8h46l8 8z"/><path d="M32 16v-7h22l4 7z"/>'),
        vela: svg('<path d="M6 28h80l-8 8H16z"/><rect x="45" y="2" width="2" height="26"/><path d="M43 4v22H18z"/><path d="M49 7l22 19H49z"/>')
    };

    // ---------- Workshop stages --------------------------------------------
    // A request's status, in workshop order: the CHECK list in
    // server/schema.sql (test/server.test.js compares them), each with a
    // `status.<id>` label in i18n.js. FINISHED are the jobs that are over.
    var STATUSES = ["ricevuta", "alaggio", "trasporto", "preparazione", "verniciatura",
        "antivegetativa", "varo", "pronta", "consegnata", "annullata"];
    var FINISHED = ["consegnata", "annullata"];

    W.CIPRESSINA_ZONES = {
        PLACEHOLDER: PLACEHOLDER,
        STATUSES: STATUSES,
        FINISHED: FINISHED,
        LABELS: LABELS,
        UNVERIFIED: UNVERIFIED,
        BY_TYPE: BY_TYPE,
        TYPES: TYPES,
        TYPE_ICONS: TYPE_ICONS,
        PRICES: PRICES,
        PRICE_GROUP_OF: PRICE_GROUP_OF,
        TIERS: TIERS,
        NO_PACKAGE: NO_PACKAGE,
        PACKAGE_CHOICES: PACKAGE_CHOICES,
        PACKAGES: PACKAGES,
        DISCOUNT_STEPS: DISCOUNT_STEPS,
        SWATCHES: SWATCHES,
        BUILDERS: BUILDERS,
        builderNames: builderNames,
        modelsFor: modelsFor,
        findModel: findModel,
        price: price,
        packagePrice: packagePrice,
        estimate: estimate,
        discountRate: discountRate,
        discountHint: discountHint,
        formatEUR: formatEUR,
        label: label
    };
})();

/* =========================================================================
   staff.js: the workshop panel, pgs/officina.html

   Ported from autocolor's src/staff.js (attendance branch), cut down for a
   shop that wants it SIMPLE: one script, Italian only, the site's own look.
   Two sessions (server/auth.js):

     - the shop computer («Officina»): the team cards; a worker taps their
       name (and PIN) to open their area, with the shift button, their boats
       and their attendance; «Cose da fare»; the boats list, where it gives
       boats to workers and moves their status;
     - the owner («Titolare»): alerts, the squad now (who is on shift, who
       works what, his notes, shifts to complete, history), attendance with
       schedules and PINs, the boats list (look only), and the public quote
       form for a customer at the counter.

   Nothing here protects data: the server checks every call. The page never
   compares its clock with the server's: running timers add the browser's
   elapsed time to the seconds the server counted.
   ========================================================================= */
(function () {
    "use strict";

    var Z = window.CIPRESSINA_ZONES;
    var I18N = window.CIPRESSINA_I18N;
    // i18n.js sets the page language from the site's stored choice; the panel is Italian.
    document.documentElement.lang = "it";
    function it(key, params) { return I18N ? I18N.t(key, params || {}, "it") : key; }

    var STATUSES = ["ricevuta", "alaggio", "trasporto", "preparazione", "verniciatura",
        "antivegetativa", "varo", "pronta", "consegnata", "annullata"];
    var FINISHED = ["consegnata", "annullata"];
    var NETWORK_MESSAGE = "Il server non risponde. Controlla la connessione e riprova.";
    var LIVE_KEY = "cipressina.officina.vivo";
    var NOTEPAD_KEY = "cipressina.officina.appunti";
    var ZONE_IDLE_MS = 60 * 1000;
    var CONFIRM_MS = 6 * 1000;
    var REFRESH_MS = 30 * 1000;
    var WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];

    var SELF = document.currentScript;
    var BOAT_URL = (function () {
        var u = new URL("./boat3d.js", SELF.src);
        var v = new URL(SELF.src).searchParams.get("v");
        if (v) u.searchParams.set("v", v);
        return u.href;
    })();

    /* ---------- small helpers ---------- */

    function byId(id) { return document.getElementById(id); }
    function show(el, visible) { el.hidden = !visible; }
    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = text;
        return node;
    }
    function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
    function button(text, className) {
        var b = el("button", className || "btn btn--outline", text);
        b.type = "button";
        return b;
    }
    function pad(n) { return String(n).padStart(2, "0"); }
    function initials(name) {
        return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0); }).join("").toUpperCase();
    }
    function nameOf(person) { return person ? person.name || person.workerId : ""; }

    function formatDuration(seconds) {
        var minutes = Math.max(0, Math.floor(seconds / 60));
        var h = Math.floor(minutes / 60), m = minutes % 60;
        return h > 0 ? h + " h " + pad(m) + " min" : m + " min";
    }
    function hoursLabel(seconds) { return (seconds / 3600).toFixed(1).replace(".", ",") + " h"; }
    function timeOf(instant) { var d = new Date(instant); return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
    function dateOf(instant) { return new Date(instant).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    function dayOf(instant) { return new Date(instant).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "numeric" }); }
    function sameDay(a, b) { return new Date(a).toDateString() === new Date(b).toDateString(); }
    function when(instant) {
        return sameDay(instant, Date.now()) ? "oggi alle " + timeOf(instant) : dayOf(instant) + " alle " + timeOf(instant);
    }
    // «2026-10-19» -> «lun 19/10».
    function shortDay(day) {
        var d = new Date(day + "T12:00:00");
        return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });
    }
    function inputDay(instant) { var d = new Date(instant); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

    function statusLabel(status) { return it("status." + status); }
    function tierLabel(tier) { return it("tier." + tier + ".name"); }
    function typeLabel(type) { return Z && Z.TYPES[type] ? Z.TYPES[type].it : type; }
    function zoneLabel(id) { return Z ? Z.label(id, "it") : id; }
    function boatTitle(row) { return [row.builder, row.model].filter(Boolean).join(" "); }

    function storageGet(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
    function storageSet(key, value) { try { window.localStorage.setItem(key, value); } catch (e) { /* blocked: fine */ } }
    function sessionGet(key) { try { return window.sessionStorage.getItem(key); } catch (e) { return null; } }
    function sessionSet(key, value) { try { if (value === null) window.sessionStorage.removeItem(key); else window.sessionStorage.setItem(key, value); } catch (e) { /* blocked */ } }

    // Every call goes through here. A failure becomes an Error with the
    // server's sentence, its status and code; `unauthorized` on a 401.
    function api(method, path, body) {
        var init = { method: method, credentials: "same-origin", headers: {} };
        if (body !== undefined) {
            init.headers["Content-Type"] = "application/json";
            init.body = JSON.stringify(body);
        }
        return fetch(path, init).then(function (response) {
            if (response.status === 204) return null;
            return response.json().catch(function () { return null; }).then(function (data) {
                if (!response.ok) {
                    var error = new Error((data && data.error) || "Qualcosa è andato storto. Riprova.");
                    error.status = response.status;
                    error.code = data && data.code;
                    error.unauthorized = response.status === 401;
                    throw error;
                }
                return data;
            });
        }, function () { throw new Error(NETWORK_MESSAGE); });
    }

    var errorEl = byId("staffError");
    function setError(message) {
        errorEl.textContent = message || "";
        show(errorEl, !!message);
        if (message) window.scrollTo({ top: 0 });
    }

    // What a failed call does to the whole page: a 401 is a dead session, a
    // `not-shop` is a cookie that became somebody else's; anything else is said.
    function fail(err) {
        if (err.unauthorized) return showLogin("La sessione è scaduta. Entra di nuovo.");
        if (err.code === "not-shop") return showLogin("Su questo computer è entrato qualcun altro. Entra di nuovo.");
        setError(err.message);
    }

    /* ---------- state and views ---------- */

    var viewer = null;          // { workerId, name, isBoss, isShop }
    var view = null;
    var team = null;            // GET /api/staff/team, with `at` = when it arrived
    var requests = [];
    var board = { notes: [], workers: [] };
    var squad = null;           // { shifts, workers, at }
    var refreshTimer = null;
    var holdRefresh = false;    // a form is open: do not rebuild the screen under it

    var VIEWS = {
        login: byId("viewLogin"), team: byId("viewTeam"), zone: byId("viewZone"), boats: byId("viewBoats"),
        profile: byId("viewProfile"), squad: byId("viewSquad"), attendance: byId("viewAttendance")
    };

    function paintView(next) {
        view = next;
        holdRefresh = false;
        Object.keys(VIEWS).forEach(function (key) { show(VIEWS[key], key === next); });
        var signedIn = next !== "login";
        show(byId("staffOut"), signedIn);
        show(byId("staffClock"), signedIn);
        var who = byId("staffWho");
        who.textContent = viewer ? (viewer.isBoss ? "Titolare · " + viewer.name : viewer.name) : "";
        show(who, signedIn && !!viewer);
        document.body.setAttribute("data-view", next);
        document.title = (next === "login" ? "Officina" : VIEWS[next].querySelector("h1").textContent) + " | Cipressina Barche";
        stopRefresh();
        if (next === "team" || next === "squad") startRefresh();
        if (next !== "zone") leaveZoneQuietly();
        var heading = VIEWS[next].querySelector("h1");
        if (heading) heading.focus();
        window.scrollTo({ top: 0 });
    }

    function goHome() {
        if (!viewer) return showLogin();
        if (viewer.isBoss) showProfile();
        else showTeam();
    }

    document.addEventListener("click", function (event) {
        var target = event.target.closest("[data-go]");
        if (!target) return;
        var where = target.getAttribute("data-go");
        setError("");
        if (where === "home") goHome();
        else if (where === "boats") showBoats();
        else if (where === "squad") showSquad();
        else if (where === "attendance") showAttendance();
    });

    function startRefresh() {
        refreshTimer = window.setInterval(function () {
            if (holdRefresh || document.hidden) return;
            refreshNow();
        }, REFRESH_MS);
    }
    function refreshNow() {
        if (view === "team") { loadTeam(true); loadBoard(); }
        else if (view === "squad") loadSquad(true);
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && !holdRefresh) refreshNow(); });
    function stopRefresh() {
        if (refreshTimer) window.clearInterval(refreshTimer);
        refreshTimer = null;
    }

    /* ---------- the clock and running timers ---------- */

    // One interval for everything that ticks: elements with data-base (seconds
    // the server counted) and data-at (when that answer arrived, browser ms).
    function tick() {
        var now = new Date();
        byId("staffClock").textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
        Array.prototype.forEach.call(document.querySelectorAll("[data-base]"), function (node) {
            var seconds = Number(node.dataset.base) + (Date.now() - Number(node.dataset.at)) / 1000;
            node.textContent = (node.dataset.prefix || "") + formatDuration(seconds);
        });
    }
    function timer(seconds, at, prefix) {
        var span = el("span", "timer");
        span.dataset.base = String(seconds);
        span.dataset.at = String(at);
        if (prefix) span.dataset.prefix = prefix;
        span.textContent = (prefix || "") + formatDuration(seconds);
        return span;
    }
    window.setInterval(tick, 1000);
    tick();

    /* ---------- login and logout ---------- */

    function showLogin(message) {
        viewer = null;
        team = null;
        requests = [];
        sessionSet(LIVE_KEY, null);
        closeDialogs();
        paintView("login");
        byId("loginPassword").value = "";
        var errorText = byId("loginError");
        errorText.textContent = message || "";
        show(errorText, !!message);
        setError("");
        byId("loginCode").focus();
    }

    byId("loginForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var code = byId("loginCode").value.trim();
        var password = byId("loginPassword").value;
        var errorText = byId("loginError");
        var problem = !code ? "Scrivi il codice." : !password ? "Scrivi la password." : "";
        errorText.textContent = problem;
        show(errorText, !!problem);
        if (problem) return (code ? byId("loginPassword") : byId("loginCode")).focus();
        var submit = byId("loginSubmit");
        submit.disabled = true;
        api("POST", "/api/staff/login", { workerId: code, password: password }).then(function (data) {
            submit.disabled = false;
            byId("loginPassword").value = "";
            viewer = data.viewer;
            sessionSet(LIVE_KEY, viewer.workerId);
            if (viewer.isBoss) {
                askPendingOnArrival = true;
                showProfile();
            } else {
                showTeam();
            }
        }, function (err) {
            submit.disabled = false;
            errorText.textContent = err.message;
            show(errorText, true);
            byId("loginPassword").focus();
        });
    });

    byId("staffOut").addEventListener("click", function () {
        // From any screen but home, «Esci» goes home; from home it logs out.
        if (view !== "team" && view !== "profile") return goHome();
        api("POST", "/api/staff/logout").catch(function () { /* the point is to stop showing data */ });
        showLogin();
    });

    function paintOutButton() {
        byId("staffOut").textContent = view === "team" || view === "profile" ? "Esci" : "Inizio";
    }

    /* ---------- the PIN pad ---------- */

    var pinDialog = byId("pinDialog");
    var pin = { digits: "", submit: null, busy: false };

    // `submit(pin)` returns a promise: resolved with a sentence to show (or ""
    // when it hands over), rejected with the server's error.
    function openPinPad(worker, lead, submit) {
        pin = { digits: "", submit: submit, busy: false };
        byId("pinName").textContent = nameOf(worker);
        byId("pinLead").textContent = lead;
        pinMessage("", false);
        pinKeysDisabled(false);
        paintPinDots();
        if (!pinDialog.open) pinDialog.showModal();
        pinDialog.querySelector('[data-key="1"]').focus();
    }
    function closePinPad() { pin.submit = null; if (pinDialog.open) pinDialog.close(); }
    function paintPinDots() {
        Array.prototype.forEach.call(pinDialog.querySelectorAll(".pin__dots span"), function (dot, i) {
            dot.classList.toggle("is-filled", i < pin.digits.length);
        });
        byId("pinStatus").textContent = pin.digits.length ? pin.digits.length + " di 4" : "";
    }
    function pinMessage(text, ok) {
        var node = byId("pinMessage");
        node.textContent = text;
        node.classList.toggle("is-ok", !!ok);
        show(node, !!text);
    }
    function pinKeysDisabled(disabled) {
        Array.prototype.forEach.call(byId("pinKeys").querySelectorAll("button"), function (b) {
            b.disabled = disabled && b.dataset.key !== "cancel";
        });
    }
    function pressPinKey(key) {
        if (key === "cancel") return closePinPad();
        if (pin.busy || !pin.submit) return;
        if (key === "back") { pin.digits = pin.digits.slice(0, -1); return paintPinDots(); }
        if (!/^[0-9]$/.test(key) || pin.digits.length >= 4) return;
        pin.digits += key;
        pinMessage("", false);
        paintPinDots();
        if (pin.digits.length === 4) sendPin();
    }
    function sendPin() {
        var submit = pin.submit;
        pin.busy = true;
        pinKeysDisabled(true);
        byId("pinStatus").textContent = "Controllo…";
        submit(pin.digits).then(function (done) {
            pin.busy = false;
            if (pin.submit !== submit) return;
            if (!done) return closePinPad();
            pinMessage(done, true);
            window.setTimeout(function () { if (pin.submit === submit) closePinPad(); }, 1000);
        }, function (err) {
            pin.busy = false;
            pin.digits = "";
            paintPinDots();
            if (pin.submit !== submit) return;
            if (/^(bad-pin|pin-required|no-pin|pin-locked)$/.test(err.code || "")) {
                pinMessage(err.message, false);
                pinKeysDisabled(err.code === "pin-locked" || err.code === "no-pin");
                var first = pinDialog.querySelector('[data-key="1"]');
                if (!first.disabled) first.focus();
                return;
            }
            closePinPad();
            fail(err);
        });
    }
    byId("pinKeys").addEventListener("click", function (event) {
        var key = event.target.closest("button[data-key]");
        if (key) pressPinKey(key.dataset.key);
    });
    pinDialog.addEventListener("keydown", function (event) {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (/^[0-9]$/.test(event.key)) { event.preventDefault(); pressPinKey(event.key); }
        else if (event.key === "Backspace") { event.preventDefault(); pressPinKey("back"); }
    });
    pinDialog.addEventListener("close", function () { pin.submit = null; });

    /* ---------- dialogs ---------- */

    document.addEventListener("click", function (event) {
        var closer = event.target.closest("[data-close]");
        if (closer) closer.closest("dialog").close();
    });
    // A click on the backdrop (the dialog element itself, outside its box) closes it.
    Array.prototype.forEach.call(document.querySelectorAll("dialog"), function (dialog) {
        dialog.addEventListener("click", function (event) {
            if (event.target !== dialog) return;
            // The dialog's own padding is also «the dialog»: only outside its box is the backdrop.
            var box = dialog.getBoundingClientRect();
            var inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
            if (!inside) dialog.close();
        });
    });
    function closeDialogs() {
        Array.prototype.forEach.call(document.querySelectorAll("dialog[open]"), function (dialog) { dialog.close(); });
    }

    /* ==================================================================
       Shop: the team screen
       ================================================================== */

    function showTeam() {
        paintView("team");
        paintOutButton();
        loadTeam(false);
        loadBoard();
        loadRequests(true);
    }

    function loadTeam(quiet) {
        return api("GET", "/api/staff/team").then(function (data) {
            takeTeam(data);
        }, function (err) {
            if (!quiet) fail(err);
            else if (err.unauthorized || err.code === "not-shop") fail(err);
        });
    }

    function takeTeam(data) {
        data.at = Date.now();
        team = data;
        if (view === "team") renderTeam();
        if (view === "zone") renderZone();
        if (view === "boats") renderBoats();
    }

    function workerById(workerId) {
        return team ? team.workers.filter(function (w) { return w.workerId === workerId; })[0] || null : null;
    }

    function shiftLine(worker, at) {
        if (worker.shift) return timer(worker.shift.seconds, at, "In turno da ");
        if (worker.autoClosed) return el("span", "", worker.autoClosed.reason === "max"
            ? "Il turno si è chiuso da solo dopo 12 ore"
            : "Il turno si è chiuso da solo alle 23:00");
        return el("span", "", worker.todaySeconds > 0 ? "Fuori turno · oggi " + formatDuration(worker.todaySeconds) : "Fuori turno");
    }

    function renderTeam() {
        var list = byId("crewList");
        clear(list);
        if (!team) return;
        byId("crewSummary").textContent = team.workers.length === 0
            ? "Nessun dipendente configurato."
            : team.onShift + " di " + team.workers.length + " in turno";
        team.workers.forEach(function (worker) {
            var item = el("li");
            var card = el("button", "crew-card" + (worker.shift ? " is-on" : ""));
            card.type = "button";
            card.dataset.worker = worker.workerId;
            card.appendChild(el("span", "avatar", initials(nameOf(worker))));
            var text = el("span", "crew-card__text");
            text.appendChild(el("span", "crew-card__name", nameOf(worker)));
            var state = el("span", "crew-card__state");
            state.appendChild(shiftLine(worker, team.at));
            text.appendChild(state);
            if (worker.boats.length) text.appendChild(el("span", "crew-card__boats", worker.boats.map(boatTitle).join(", ")));
            card.appendChild(text);
            card.addEventListener("click", function () { enterZone(worker.workerId); });
            item.appendChild(card);
            list.appendChild(item);
        });
        fillBoardSelects();
    }

    /* ---------- a worker's area ---------- */

    var zone = { id: null, pin: null, mine: null, confirm: false, confirmTimer: null, idleTimer: null, busy: false };

    function enterZone(workerId) {
        var worker = workerById(workerId);
        if (!worker) return;
        if (!worker.hasPin) return openZone(workerId, null, null);
        openPinPad(worker, "Scrivi il tuo PIN per entrare.", function submit(entered) {
            return api("POST", "/api/staff/attendance/mine", { workerId: workerId, pin: entered }).then(function (mine) {
                // «Annulla» while the PIN was being checked: stay on the cards.
                if (pin.submit === submit) openZone(workerId, entered, mine);
                return "";
            });
        });
    }

    function openZone(workerId, enteredPin, mine) {
        zone.id = workerId;
        zone.pin = enteredPin;
        zone.mine = mine;
        zone.confirm = false;
        paintView("zone");
        paintOutButton();
        renderZone();
        armZoneIdle();
    }

    function leaveZoneQuietly() {
        window.clearTimeout(zone.idleTimer);
        window.clearTimeout(zone.confirmTimer);
        zone = { id: null, pin: null, mine: null, confirm: false, confirmTimer: null, idleTimer: null, busy: false };
    }

    function armZoneIdle() {
        window.clearTimeout(zone.idleTimer);
        zone.idleTimer = window.setTimeout(function () { if (view === "zone") showTeam(); }, ZONE_IDLE_MS);
    }
    ["pointerdown", "keydown"].forEach(function (type) {
        document.addEventListener(type, function () { if (view === "zone") armZoneIdle(); }, true);
    });
    byId("zoneDone").addEventListener("click", showTeam);

    function renderZone() {
        var worker = workerById(zone.id);
        if (!worker) return showTeam();
        byId("zoneTitle").textContent = nameOf(worker);
        document.title = nameOf(worker) + " | Cipressina Barche";

        var state = byId("zoneShiftState");
        clear(state);
        state.appendChild(shiftLine(worker, team.at));
        var shiftNote = byId("zoneShiftNote");
        shiftNote.textContent = zone.note || "";
        show(shiftNote, !!zone.note);

        var b = byId("zoneShiftBtn");
        b.disabled = zone.busy;
        b.dataset.shift = zone.busy ? "busy" : worker.shift ? (zone.confirm ? "confirm" : "on") : "off";
        b.textContent = zone.busy ? "Un momento…"
            : !worker.shift ? "Inizia il turno"
                : zone.confirm ? "Premi di nuovo per finire" : "Finisci il turno";

        var list = byId("zoneBoats");
        clear(list);
        worker.boats.forEach(function (boat) {
            var item = el("li", "boat-list__item");
            item.appendChild(el("strong", "", boatTitle(boat)));
            if (boat.boatName) item.appendChild(el("span", "", " «" + boat.boatName + "»"));
            item.appendChild(el("span", "badge", statusLabel(boat.status)));
            list.appendChild(item);
        });
        show(byId("zoneBoatsEmpty"), worker.boats.length === 0);

        renderMine();
    }

    byId("zoneShiftBtn").addEventListener("click", function () {
        var worker = workerById(zone.id);
        if (!worker || zone.busy) return;
        var open = !worker.shift;
        // Without a PIN, ending takes two presses: the button changes in place,
        // and a double tap would otherwise start and end the day.
        if (!open && !zone.pin && !zone.confirm) {
            zone.confirm = true;
            zone.confirmTimer = window.setTimeout(function () { zone.confirm = false; if (view === "zone") renderZone(); }, CONFIRM_MS);
            return renderZone();
        }
        window.clearTimeout(zone.confirmTimer);
        zone.confirm = false;
        zone.busy = true;
        zone.note = "";
        renderZone();
        var id = zone.id;
        api("PUT", "/api/staff/shift", { workerId: id, open: open, pin: zone.pin || undefined }).then(function (data) {
            // The worker left meanwhile: the answer still updates the cards, not someone else's area.
            if (zone.id !== id) return takeTeam(data);
            zone.busy = false;
            var result = data.result;
            zone.note = result.started ? "Turno iniziato."
                : result.discarded ? "Turno di meno di 5 minuti: non è stato salvato."
                    : result.ended ? "Turno finito." : open ? "Il turno era già iniziato." : "Il turno era già finito.";
            takeTeam(data);
            if (zone.pin) refreshMine();
        }, function (err) {
            if (zone.id !== id) return;
            zone.busy = false;
            // The owner changed the PIN meanwhile: back to the cards.
            if (/^(bad-pin|pin-required|pin-locked)$/.test(err.code || "")) {
                showTeam();
                return setError(err.message);
            }
            renderZone();
            fail(err);
        });
    });

    function refreshMine() {
        if (!zone.pin) return;
        var id = zone.id;
        api("POST", "/api/staff/attendance/mine", { workerId: id, pin: zone.pin }).then(function (mine) {
            if (zone.id !== id) return;
            zone.mine = mine;
            renderMine();
        }, function () { /* the shift already saved; the summary can wait */ });
    }

    // A day's notes in words: «ritardo 12 min», «assenza», «in turno»…
    function dayNotes(row) {
        var notes = [];
        if (row.open) notes.push("in turno");
        if (row.incomplete) notes.push("da completare");
        if (row.lateMin) notes.push("ritardo " + formatDuration(row.lateMin * 60));
        if (row.overtimeMin) notes.push("straordinario " + formatDuration(row.overtimeMin * 60));
        if (row.absent) notes.push("assenza");
        if (row.missing) notes.push("non ancora arrivato");
        return notes.join(" · ");
    }
    function plannedLabel(row) {
        if (row.planned) return row.planned.from + "–" + row.planned.to;
        return row.scheduled ? "Riposo" : "—";
    }
    function daysTable(days, today) {
        var table = el("table", "days");
        var head = el("tr");
        ["Giorno", "Orario", "Entrata", "Uscita", "Ore", "Note"].forEach(function (label) {
            var th = el("th", "", label);
            th.scope = "col";
            head.appendChild(th);
        });
        var thead = el("thead");
        thead.appendChild(head);
        table.appendChild(thead);
        var body = el("tbody");
        days.forEach(function (row) {
            var tr = el("tr", row.day === today ? "is-today" : "");
            [shortDay(row.day), plannedLabel(row), row.firstIn ? timeOf(row.firstIn) : "",
                row.lastOut ? timeOf(row.lastOut) : row.open ? "…" : "",
                row.workedSec ? hoursLabel(row.workedSec) : "", dayNotes(row)].forEach(function (text, i) {
                var td = el("td", i === 5 && (row.absent || row.lateMin || row.incomplete) ? "is-flag" : "", text);
                tr.appendChild(td);
            });
            body.appendChild(tr);
        });
        table.appendChild(body);
        var wrap = el("div", "table-wrap");
        wrap.appendChild(table);
        return wrap;
    }

    function renderMine() {
        var box = byId("zoneMine");
        clear(box);
        show(byId("zoneMineNone"), !zone.mine);
        if (!zone.mine) return;
        var mine = zone.mine;
        var totals = el("p", "mine-totals");
        totals.textContent = "Questa settimana " + hoursLabel(mine.week.totals.workedSec)
            + " · questo mese " + hoursLabel(mine.month.totals.workedSec)
            + " · ritardi del mese " + mine.month.totals.lateCount
            + " · assenze del mese " + mine.month.totals.absences;
        box.appendChild(totals);
        box.appendChild(daysTable(mine.week.days, mine.today));
        if (mine.schedule) {
            var plan = el("p", "note");
            plan.textContent = "Il mio orario: " + [1, 2, 3, 4, 5, 6, 0].map(function (d) {
                var day = mine.schedule[d];
                return WEEKDAYS[d].slice(0, 3) + " " + (day ? day.from + "–" + day.to : "riposo");
            }).join(" · ");
            box.appendChild(plan);
        }
    }

    /* ---------- «Cose da fare» ---------- */

    function loadBoard() {
        return api("GET", "/api/staff/board").then(function (data) {
            board = data;
            renderBoard();
        }, function (err) {
            if (err.unauthorized || err.code === "not-shop") return fail(err);
            var e = byId("boardError");
            e.textContent = err.message;
            show(e, true);
        });
    }

    function fillBoardSelects() {
        var workers = board.workers.length ? board.workers : (team ? team.workers : []);
        [["boardTo", true], ["boardFrom", false]].forEach(function (pair) {
            var select = byId(pair[0]);
            var kept = select.value || (pair[0] === "boardFrom" ? sessionGet("cipressina.officina.da") || "" : "");
            clear(select);
            if (pair[1]) select.appendChild(new Option("Tutti", ""));
            else select.appendChild(new Option("Scegli…", ""));
            workers.forEach(function (w) { select.appendChild(new Option(nameOf(w), w.workerId)); });
            select.value = kept;
            if (select.value !== kept) select.value = "";
        });
    }

    function renderBoard() {
        fillBoardSelects();
        var list = byId("boardList");
        clear(list);
        board.notes.forEach(function (note) {
            var item = el("li", "board__item" + (note.kind === "boss" ? " is-boss" : ""));
            var text = el("div", "board__text");
            text.appendChild(el("span", "board__to", note.to ? "Per " + nameOf(note.to) : "Per tutti"));
            text.appendChild(el("span", "board__note", note.text));
            text.appendChild(el("span", "board__meta", (note.kind === "boss" ? "Dal titolare" : "Scritta da " + nameOf(note.from)) + ", " + when(note.createdAt)));
            item.appendChild(text);
            if (note.kind !== "boss") {
                var done = button("Fatto");
                done.setAttribute("aria-label", "Segna come fatta: " + note.text);
                done.addEventListener("click", function () {
                    done.disabled = true;
                    api("PATCH", "/api/staff/board/" + note.id, { done: true }).then(loadBoard, function (err) { done.disabled = false; fail(err); });
                });
                item.appendChild(done);
            }
            list.appendChild(item);
        });
        show(byId("boardEmpty"), board.notes.length === 0);
    }

    byId("boardForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var errorText = byId("boardError");
        var textEl = byId("boardText");
        var note = textEl.value.trim();
        var from = byId("boardFrom").value;
        var to = byId("boardTo").value || null;
        var problem = !note ? "Scrivi cosa c'è da fare." : !from ? "Scegli chi la scrive." : "";
        errorText.textContent = problem;
        show(errorText, !!problem);
        if (problem) return (!note ? textEl : byId("boardFrom")).focus();
        sessionSet("cipressina.officina.da", from);
        var send = function (enteredPin) {
            return api("POST", "/api/staff/board", { text: note, from: from, to: to, pin: enteredPin }).then(function () {
                textEl.value = "";
                loadBoard();
                return "Nota aggiunta.";
            });
        };
        var writer = workerById(from) || { workerId: from, name: byId("boardFrom").selectedOptions[0].textContent };
        if (writer.hasPin) return openPinPad(writer, "Scrivi il tuo PIN per firmare la nota.", send);
        send(undefined).catch(function (err) {
            // A team list older than the owner giving this worker a PIN.
            if (err.code === "pin-required") return openPinPad(writer, "Scrivi il tuo PIN per firmare la nota.", send);
            fail(err);
        });
    });

    /* ==================================================================
       Boats
       ================================================================== */

    function showBoats() {
        paintView("boats");
        paintOutButton();
        var shop = viewer && viewer.isShop;
        show(byId("boatsReadOnly"), !shop);
        show(byId("boatsNew"), !shop);
        loadRequests(false);
        if (shop) loadTeam(true);
    }

    (function fillStatusFilter() {
        var select = byId("boatsStatus");
        clear(select);
        select.appendChild(new Option("In lavorazione", ""));
        select.appendChild(new Option("Tutte", "*"));
        STATUSES.forEach(function (status) { select.appendChild(new Option(statusLabel(status), status)); });
    })();

    function loadRequests(quiet) {
        var status = byId("boatsStatus").value;
        var query = status && status !== "*" ? "?status=" + encodeURIComponent(status) : "";
        return api("GET", "/api/staff/requests" + query).then(function (data) {
            requests = data.requests;
            paintCounts();
            if (view === "boats") renderBoats();
        }, function (err) { if (!quiet || err.unauthorized) fail(err); });
    }

    function inProgress(row) { return FINISHED.indexOf(row.status) === -1; }

    function paintCounts() {
        var open = requests.filter(inProgress).length;
        byId("dockCount").textContent = String(open);
        byId("tileBoats").textContent = open === 1 ? "1 barca in lavorazione" : open + " barche in lavorazione";
    }

    byId("boatsStatus").addEventListener("change", function () { loadRequests(false); });
    byId("boatsSearch").addEventListener("input", function () { renderBoats(); });

    function haystack(row) {
        return [row.id, row.builder, row.model, row.boatName, row.registration, row.firstName, row.lastName,
            row.phone, row.location].filter(Boolean).join(" ").toLowerCase();
    }

    function renderBoats() {
        var body = byId("boatsBody");
        clear(body);
        var filter = byId("boatsStatus").value;
        var words = byId("boatsSearch").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var rows = requests.filter(function (row) {
            if (filter === "" && !inProgress(row)) return false;
            var text = haystack(row);
            return words.every(function (w) { return text.indexOf(w) !== -1; });
        });
        rows.forEach(function (row) { body.appendChild(boatRow(row)); });
        byId("boatsCount").textContent = rows.length === 1 ? "1 barca" : rows.length + " barche";
        show(byId("boatsEmpty"), rows.length === 0);
    }

    function cell(label, content) {
        var td = el("td");
        td.setAttribute("data-label", label);
        if (typeof content === "string") td.textContent = content;
        else if (content) td.appendChild(content);
        return td;
    }

    function boatRow(row) {
        var tr = el("tr");
        tr.dataset.id = row.id;
        var shop = viewer && viewer.isShop;

        var boat = el("div");
        boat.appendChild(el("strong", "", boatTitle(row)));
        var sub = [typeLabel(row.boatType), String(row.loa).replace(".", ",") + " m"];
        if (row.boatName) sub.push("«" + row.boatName + "»");
        boat.appendChild(el("span", "sub", sub.join(" · ")));
        boat.appendChild(el("span", "sub", "Codice " + row.id + (row.serviceSite ? " · " + (row.serviceSite === "cantiere" ? "in cantiere" : "in carrozzeria") : "")));
        tr.appendChild(cell("Barca", boat));

        var customer = el("div");
        customer.appendChild(el("span", "", row.firstName + " " + row.lastName));
        var phone = el("a", "sub", row.phone);
        phone.href = "tel:" + row.phone;
        customer.appendChild(phone);
        tr.appendChild(cell("Cliente", customer));

        tr.appendChild(cell("Arrivata", dateOf(row.createdAt)));

        var jobs = el("div");
        jobs.appendChild(el("span", "", row.tier === "nessuno" ? "Solo lavori" : tierLabel(row.tier)));
        var details = button(row.zones.length === 1 ? "1 zona · dettagli" : row.zones.length + " zone · dettagli", "linkish");
        details.addEventListener("click", function () { openBoat(row, details); });
        jobs.appendChild(details);
        tr.appendChild(cell("Lavori", jobs));

        tr.appendChild(cell("Stato", statusCell(row, shop)));
        tr.appendChild(cell("Chi ci lavora", holdersCell(row, shop)));
        return tr;
    }

    function statusCell(row, shop) {
        var held = row.holders && row.holders.length > 0;
        if (!shop || !held) {
            var wrap = el("div");
            wrap.appendChild(el("span", "badge badge--" + row.status, statusLabel(row.status)));
            if (shop && !held && inProgress(row)) wrap.appendChild(el("span", "sub", "Assegnala per cambiare lo stato"));
            return wrap;
        }
        var select = el("select", "status-select");
        select.setAttribute("aria-label", "Stato di " + boatTitle(row));
        STATUSES.forEach(function (status) { select.appendChild(new Option(statusLabel(status), status)); });
        select.value = row.status;
        select.addEventListener("change", function () {
            var next = select.value;
            select.disabled = true;
            api("PATCH", "/api/staff/requests/" + row.id, { status: next }).then(function (updated) {
                row.status = updated.status;
                row.holders = updated.holders;
                row.occupiedBy = updated.occupiedBy;
                paintCounts();
                renderBoats();
                loadTeam(true);
            }, function (err) {
                select.value = row.status;
                select.disabled = false;
                fail(err);
            });
        });
        return select;
    }

    function holdersCell(row, shop) {
        var wrap = el("div", "holders");
        var holders = row.holders || [];
        if (!shop) {
            wrap.textContent = holders.length ? holders.map(nameOf).join(", ") : "Nessuno";
            return wrap;
        }
        holders.forEach(function (holder) {
            var chip = el("span", "chip", nameOf(holder));
            var x = el("button", "chip__x", "✕");
            x.type = "button";
            x.setAttribute("aria-label", "Togli " + nameOf(holder) + " da " + boatTitle(row));
            x.addEventListener("click", function () { setHolder(row, holder.workerId, false, x); });
            chip.appendChild(x);
            wrap.appendChild(chip);
        });
        if (!inProgress(row)) {
            if (!holders.length) wrap.textContent = "—";
            return wrap;
        }
        if (holders.length >= 2) {
            wrap.appendChild(el("span", "sub", "Al completo (2)"));
            return wrap;
        }
        var select = el("select", "assign");
        select.setAttribute("aria-label", "Assegna " + boatTitle(row) + " a");
        var onShift = team ? team.workers.filter(function (w) {
            return w.shift && !holders.some(function (h) { return h.workerId === w.workerId; });
        }) : [];
        select.appendChild(new Option(!team ? "Carico la squadra…" : onShift.length ? "Assegna a…" : "Nessun altro in turno", ""));
        onShift.forEach(function (w) { select.appendChild(new Option(nameOf(w), w.workerId)); });
        select.disabled = onShift.length === 0;
        select.addEventListener("change", function () {
            if (select.value) setHolder(row, select.value, true, select);
        });
        wrap.appendChild(select);
        return wrap;
    }

    function setHolder(row, workerId, occupied, control) {
        control.disabled = true;
        api("PATCH", "/api/staff/requests/" + row.id + "/occupancy", { occupied: occupied, workerId: workerId }).then(function (data) {
            row.holders = data.holders;
            row.occupiedBy = data.occupiedBy;
            renderBoats();
            loadTeam(true);
        }, function (err) {
            control.disabled = false;
            fail(err);
            // Who is on shift, or who holds it, changed underneath: reload both.
            if (err.code === "off-shift" || err.code === "full") { loadTeam(true); loadRequests(true); }
        });
    }

    /* ---------- one boat's details, with its zones on the 3D model ---------- */

    var boatDialog = byId("boatDialog");
    var boatViewer = null;
    var boatMount = 0;
    var boatModule = null;

    function loadBoat3D() {
        if (!boatModule) {
            boatModule = import(BOAT_URL);
            boatModule.catch(function () { boatModule = null; });
        }
        return boatModule;
    }

    function fact(list, label, value) {
        if (value === null || value === undefined || value === "") return;
        list.appendChild(el("dt", "", label));
        var dd = el("dd");
        if (typeof value === "string") dd.textContent = value;
        else dd.appendChild(value);
        list.appendChild(dd);
    }

    function openBoat(row, trigger) {
        byId("boatDialogTitle").textContent = boatTitle(row) + (row.boatName ? " «" + row.boatName + "»" : "");
        var facts = byId("boatFacts");
        clear(facts);
        var zones = el("ul", "zone-list");
        row.zones.forEach(function (id) {
            var text = zoneLabel(id);
            if (id === "bottom" && row.antifoulingColor) text += " · " + it("sw." + row.antifoulingColor);
            zones.appendChild(el("li", "", text));
        });
        if (!row.zones.length) zones.appendChild(el("li", "", "Nessuna zona: solo il pacchetto"));
        fact(facts, "Lavori", (row.tier === "nessuno" ? "" : tierLabel(row.tier)));
        fact(facts, "Zone", zones);
        if (row.estimate) fact(facts, "Preventivo indicativo", Z.formatEUR(row.estimate.total));
        fact(facts, "Note del cliente", row.notes);
        fact(facts, "Cliente", row.firstName + " " + row.lastName);
        var phone = el("a", "", row.phone);
        phone.href = "tel:" + row.phone;
        fact(facts, "Telefono", phone);
        var mail = el("a", "", row.email);
        mail.href = "mailto:" + row.email;
        fact(facts, "Email", mail);
        fact(facts, "Barca", typeLabel(row.boatType) + " · " + String(row.loa).replace(".", ",") + " m · " + row.year);
        fact(facts, "Immatricolazione", row.registered === "registrata" ? row.registration : "Natante (non immatricolata)");
        fact(facts, "Dove si trova", [it("opt.berth." + row.berthKind), row.location].filter(Boolean).join(" · "));
        fact(facts, "Dove si lavora", row.serviceSite === "cantiere" ? "In cantiere" : row.serviceSite === "carrozzeria" ? "In carrozzeria" : "");
        fact(facts, "Ore motore", row.engineHours === null ? "" : String(row.engineHours));
        fact(facts, "Codice colore", row.colorCode);
        fact(facts, "Codice", row.id + " · arrivata il " + dateOf(row.createdAt));

        boatDialog.showModal();
        mountBoat(row);
        boatDialog.addEventListener("close", function onClose() {
            boatDialog.removeEventListener("close", onClose);
            destroyBoat();
            if (trigger && trigger.isConnected) trigger.focus();
        });
    }

    function mountBoat(row) {
        var mount = ++boatMount;
        var overlay = byId("boatOverlay");
        overlay.classList.remove("hidden");
        show(byId("boatLoading"), true);
        show(byId("boatError"), false);
        // A fresh canvas: a destroyed viewer's WebGL context stays bound to the old one.
        var old = byId("boatCanvas");
        var canvas = el("canvas");
        canvas.id = "boatCanvas";
        old.replaceWith(canvas);
        loadBoat3D().then(function (module) {
            if (mount !== boatMount || !boatDialog.open) return;
            boatViewer = module.mountBoat3D({
                boatType: row.boatType,
                canvasEl: canvas,
                canvasWrapEl: byId("boatCanvasWrap"),
                overlayEl: overlay,
                errorEl: byId("boatError"),
                loadingLabelEl: byId("boatLoading"),
                isPartSelected: function (id) { return row.zones.indexOf(id) !== -1; },
                onPartToggle: function () {},
                interactive: false,
                spin: true,
                spinPitch: row.zones.indexOf("bottom") !== -1 ? -10 : 14,
                showWater: false,
                loadErrorText: "Impossibile aprire il modello 3D. Le zone sono nell'elenco qui accanto."
            });
            var swatch = row.antifoulingColor && Z.SWATCHES.filter(function (s) { return s.id === row.antifoulingColor; })[0];
            if (swatch && boatViewer.setColors) boatViewer.setColors({ bottom: swatch.hex });
        }, function () {
            if (mount !== boatMount) return;
            show(byId("boatLoading"), false);
            var e = byId("boatError");
            e.textContent = "Impossibile aprire il modello 3D. Le zone sono nell'elenco qui accanto.";
            show(e, true);
        });
    }

    function destroyBoat() {
        boatMount++;
        if (boatViewer && boatViewer.destroy) boatViewer.destroy();
        boatViewer = null;
    }

    /* ==================================================================
       Owner: profile
       ================================================================== */

    var askPendingOnArrival = false;

    function showProfile() {
        paintView("profile");
        paintOutButton();
        var first = String(viewer.name || "").split(/\s+/)[0];
        byId("profileTitle").textContent = (new Date().getHours() >= 18 ? "Buonasera" : "Buongiorno") + (first ? ", " + first : "");
        document.title = "Titolare | Cipressina Barche";
        byId("notepad").value = storageGet(NOTEPAD_KEY + "." + viewer.workerId) || "";
        loadRequests(true);
        loadAlerts();
        loadSquad(true);
    }

    var notepadTimer = null;
    byId("notepad").addEventListener("input", function () {
        window.clearTimeout(notepadTimer);
        notepadTimer = window.setTimeout(function () {
            if (viewer) storageSet(NOTEPAD_KEY + "." + viewer.workerId, byId("notepad").value);
        }, 600);
    });

    var ALERTS = {
        incomplete: function (a) { return [a.count === 1 ? "1 turno da completare" : a.count + " turni da completare", "squad"]; },
        missing: function (a, names) { return ["Non ha ancora iniziato il turno: " + names, "squad"]; },
        late: function (a, names) { return [(a.count === 1 ? "1 ritardo" : a.count + " ritardi") + ": " + names, "attendance"]; },
        absent: function (a, names) { return [(a.count === 1 ? "1 assenza" : a.count + " assenze") + ": " + names, "attendance"]; },
        overtime: function (a, names) { return ["Straordinari: " + names, "attendance"]; },
        noPin: function (a, names) { return ["Senza PIN: " + names + ". Daglielo in Presenze → Orario e PIN", "attendance"]; },
        noSchedule: function (a, names) { return ["Senza orario: " + names + ". Impostalo in Presenze → Orario e PIN", "attendance"]; }
    };

    function loadAlerts() {
        api("GET", "/api/staff/attendance").then(function (data) {
            var names = {};
            data.workers.forEach(function (w) { names[w.workerId] = w.name || w.workerId; });
            var list = byId("alertsList");
            clear(list);
            data.alerts.forEach(function (alert) {
                var words = ALERTS[alert.kind](alert, alert.workers.map(function (id) { return names[id] || id; }).join(", "));
                var item = el("li");
                var link = button(words[0], "alert alert--" + alert.kind);
                link.setAttribute("data-go", words[1]);
                item.appendChild(link);
                list.appendChild(item);
            });
            show(byId("alertsNone"), data.alerts.length === 0);
        }, fail);
    }

    /* ==================================================================
       Owner: the squad now
       ================================================================== */

    function showSquad() {
        paintView("squad");
        paintOutButton();
        loadSquad(false);
    }
    byId("squadRefresh").addEventListener("click", function () { loadSquad(false); });

    function loadSquad(quiet) {
        return Promise.all([api("GET", "/api/staff/shifts"), api("GET", "/api/staff/workers")]).then(function (both) {
            squad = { shifts: both[0], workers: both[1].workers, at: Date.now() };
            paintSquadTile();
            if (view === "squad" && !holdRefresh) renderSquad();
            if (askPendingOnArrival) {
                askPendingOnArrival = false;
                if (squad.shifts.pending.length) openPendingDialog();
            }
        }, function (err) { if (!quiet || err.unauthorized) fail(err); });
    }

    function openShifts() {
        var open = [];
        squad.shifts.workers.forEach(function (w) {
            w.shifts.forEach(function (s) { if (s.open) open.push({ worker: w, shift: s }); });
        });
        return open.sort(function (a, b) { return b.shift.seconds - a.shift.seconds; });
    }

    function paintSquadTile() {
        var tile = byId("tileSquad");
        var pending = squad.shifts.pending.length;
        var onShift = openShifts().length;
        tile.textContent = pending
            ? (pending === 1 ? "1 turno da completare" : pending + " turni da completare")
            : onShift === 1 ? "1 in turno adesso" : onShift + " in turno adesso";
        tile.classList.toggle("is-alert", pending > 0);
    }

    function renderSquad() {
        var pendingList = byId("pendingList");
        clear(pendingList);
        squad.shifts.pending.forEach(function (shift) { pendingList.appendChild(pendingCard(shift, false)); });
        show(byId("pendingSection"), squad.shifts.pending.length > 0);

        var onList = byId("onShiftList");
        clear(onList);
        var open = openShifts();
        open.forEach(function (pair) { onList.appendChild(onShiftCard(pair.worker, pair.shift)); });
        show(byId("onShiftNone"), open.length === 0);

        var monitor = byId("monitorList");
        clear(monitor);
        var busy = squad.workers.filter(function (w) { return w.boats.length > 0; }).length;
        byId("monitorSummary").textContent = busy ? busy + " di " + squad.workers.length + " lavorano su una barca" : "Nessuno ha una barca assegnata adesso.";
        squad.workers.forEach(function (w) { monitor.appendChild(monitorCard(w)); });

        renderHistory();
    }

    function onShiftCard(worker, shift) {
        var card = el("li", "card");
        card.appendChild(el("h3", "", nameOf(worker)));
        var line = el("p", "card__line");
        line.appendChild(document.createTextNode("Dalle " + timeOf(shift.startedAt) + (sameDay(shift.startedAt, Date.now()) ? "" : " di " + dayOf(shift.startedAt)) + " · "));
        line.appendChild(timer(shift.seconds, squad.at));
        card.appendChild(line);
        var close = button("Chiudi il turno");
        close.addEventListener("click", function () {
            close.hidden = true;
            card.appendChild(exitForm(shift, true, function () { close.hidden = false; }));
        });
        card.appendChild(close);
        return card;
    }

    function pendingCard(shift, inDialog) {
        var card = el("li", "card card--warn");
        card.appendChild(el("h3", "", nameOf(shift)));
        card.appendChild(el("p", "card__line", "Iniziato " + when(shift.startedAt) + ", si è chiuso da solo " + when(shift.endedAt) + "."));
        // In the dialog the form is open at once; on the screen it opens on
        // demand, so the 30-second refresh only waits while one is in use.
        if (inDialog) {
            card.appendChild(exitForm(shift, false, null, true));
            return card;
        }
        var complete = button("Completa");
        complete.addEventListener("click", function () {
            complete.hidden = true;
            card.appendChild(exitForm(shift, false, function () { complete.hidden = false; }));
        });
        card.appendChild(complete);
        return card;
    }

    // «A che ora è uscito?»: the day (the start's, prefilled) and the time
    // (empty on purpose: closing at the moment he notices would credit the
    // night). `allowNow` adds «Chiudi adesso» for an open shift.
    function exitForm(shift, allowNow, onCancel, inDialog) {
        holdRefresh = true;
        var form = el("form", "exit-form");
        form.noValidate = true;
        var fields = el("div", "exit-form__fields");
        var dayField = el("div", "field");
        var dayInput = el("input");
        dayInput.type = "date";
        dayInput.value = inputDay(shift.startedAt);
        dayInput.id = "exitDay" + shift.id + (inDialog ? "d" : "");
        var dayLabel = el("label", "", "Giorno di uscita");
        dayLabel.htmlFor = dayInput.id;
        dayField.appendChild(dayLabel);
        dayField.appendChild(dayInput);
        var timeField = el("div", "field");
        var timeInput = el("input");
        timeInput.type = "time";
        timeInput.id = "exitTime" + shift.id + (inDialog ? "d" : "");
        var timeLabel = el("label", "", "Ora di uscita");
        timeLabel.htmlFor = timeInput.id;
        timeField.appendChild(timeLabel);
        timeField.appendChild(timeInput);
        fields.appendChild(dayField);
        fields.appendChild(timeField);
        form.appendChild(fields);
        var preview = el("p", "note");
        var error = el("p", "field__error");
        error.hidden = true;
        error.setAttribute("role", "alert");
        form.appendChild(preview);
        form.appendChild(error);
        var actions = el("div", "staff-actions");
        var save = el("button", "btn", allowNow ? "Chiudi a quest'ora" : "Salva");
        save.type = "submit";
        actions.appendChild(save);
        var now = null;
        if (allowNow) {
            now = button("Chiudi adesso");
            now.addEventListener("click", function () { now.disabled = true; send(null); });
            actions.appendChild(now);
        }
        if (onCancel) {
            var cancel = button("Annulla");
            cancel.addEventListener("click", function () { form.remove(); holdRefresh = false; onCancel(); });
            actions.appendChild(cancel);
        }
        form.appendChild(actions);

        function chosen() {
            if (!dayInput.value || !timeInput.value) return null;
            var end = new Date(dayInput.value + "T" + timeInput.value);
            return isNaN(end.getTime()) ? null : end;
        }
        function paintPreview() {
            var end = chosen();
            if (!end) { preview.textContent = ""; return; }
            var seconds = (end - new Date(shift.startedAt)) / 1000;
            preview.textContent = seconds < 0 ? "L'uscita è prima dell'inizio."
                : "Durata: " + formatDuration(seconds) + (seconds < squad.shifts.minimumSeconds ? ". Meno di 5 minuti: il turno verrà cancellato." : "");
        }
        dayInput.addEventListener("input", paintPreview);
        timeInput.addEventListener("input", paintPreview);

        function send(end) {
            error.hidden = true;
            if (end && end < new Date(shift.startedAt)) {
                error.textContent = "L'uscita è prima dell'inizio del turno.";
                error.hidden = false;
                return;
            }
            save.disabled = true;
            api("PATCH", "/api/staff/shifts/" + shift.id, end ? { endedAt: end.toISOString() } : {}).then(function () {
                holdRefresh = false;
                if (inDialog) {
                    form.closest("li").remove();
                    if (!byId("pendingDialogList").children.length) byId("pendingDialog").close();
                }
                loadSquad(true);
                loadAlerts();
            }, function (err) {
                save.disabled = false;
                if (now) now.disabled = false;
                if (err.unauthorized) return fail(err);
                error.textContent = err.message;
                error.hidden = false;
            });
        }
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var end = chosen();
            if (!end) {
                error.textContent = "Indica il giorno e l'ora in cui è uscito.";
                error.hidden = false;
                return (dayInput.value ? timeInput : dayInput).focus();
            }
            send(end);
        });
        window.setTimeout(function () { timeInput.focus(); }, 0);
        return form;
    }

    function openPendingDialog() {
        var list = byId("pendingDialogList");
        clear(list);
        squad.shifts.pending.forEach(function (shift) { list.appendChild(pendingCard(shift, true)); });
        byId("pendingDialog").showModal();
    }
    byId("pendingDialog").addEventListener("close", function () {
        holdRefresh = false;
        if (view === "squad") renderSquad();
    });

    function monitorCard(worker) {
        var card = el("li", "card" + (worker.boats.length ? "" : " card--idle"));
        card.appendChild(el("h3", "", nameOf(worker)));
        if (worker.boats.length) {
            var list = el("ul", "card__boats");
            worker.boats.forEach(function (boat) {
                var item = el("li");
                item.appendChild(el("span", "", boatTitle(boat) + (boat.boatName ? " «" + boat.boatName + "»" : "")));
                item.appendChild(el("span", "badge", statusLabel(boat.status)));
                list.appendChild(item);
            });
            card.appendChild(list);
        } else {
            card.appendChild(el("p", "card__line", "Nessuna barca"));
        }
        var note = el("p", "card__note");
        if (worker.note) {
            note.appendChild(el("strong", "", "La tua nota: "));
            note.appendChild(document.createTextNode(worker.note.text));
        }
        card.appendChild(note);
        var actions = el("div", "staff-actions");
        var write = button(worker.note ? "Modifica la nota" : "Scrivi una nota");
        write.addEventListener("click", function () { openNoteEditor(worker, card, actions); });
        actions.appendChild(write);
        if (worker.note) {
            var remove = button("Togli la nota");
            remove.addEventListener("click", function () { putNote(worker, "", remove); });
            actions.appendChild(remove);
        }
        card.appendChild(actions);
        return card;
    }

    function openNoteEditor(worker, card, actions) {
        holdRefresh = true;
        actions.hidden = true;
        var form = el("form", "note-editor");
        var area = el("textarea");
        area.maxLength = 500;
        area.rows = 3;
        area.value = worker.note ? worker.note.text : "";
        area.setAttribute("aria-label", "Nota per " + nameOf(worker));
        form.appendChild(area);
        form.appendChild(el("p", "note", "La vede sul computer dell'officina, in «Cose da fare»."));
        var row = el("div", "staff-actions");
        var save = el("button", "btn", "Salva");
        save.type = "submit";
        var cancel = button("Annulla");
        cancel.addEventListener("click", function () { form.remove(); actions.hidden = false; holdRefresh = false; });
        row.appendChild(save);
        row.appendChild(cancel);
        form.appendChild(row);
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            putNote(worker, area.value, save);
        });
        card.appendChild(form);
        area.focus();
    }

    function putNote(worker, text, control) {
        control.disabled = true;
        api("PUT", "/api/staff/workers/" + worker.workerId + "/note", { note: text }).then(function () {
            holdRefresh = false;
            loadSquad(false);
        }, function (err) { control.disabled = false; fail(err); });
    }

    function renderHistory() {
        var box = byId("historyList");
        clear(box);
        squad.shifts.workers.forEach(function (worker) {
            var block = el("section", "history__worker" + (worker.shifts.length ? "" : " card--idle"));
            block.appendChild(el("h3", "", nameOf(worker)));
            if (!worker.shifts.length) {
                block.appendChild(el("p", "note", "Nessun turno."));
                box.appendChild(block);
                return;
            }
            if (worker.total > worker.shifts.length) block.appendChild(el("p", "note", "Gli ultimi " + worker.shifts.length + " di " + worker.total + "."));
            var table = el("table", "days");
            var head = el("tr");
            ["Giorno", "Inizio", "Fine", "Durata"].forEach(function (label) { var th = el("th", "", label); th.scope = "col"; head.appendChild(th); });
            var thead = el("thead");
            thead.appendChild(head);
            table.appendChild(thead);
            var body = el("tbody");
            worker.shifts.forEach(function (shift) {
                var tr = el("tr");
                tr.appendChild(el("td", "", dayOf(shift.startedAt)));
                tr.appendChild(el("td", "", timeOf(shift.startedAt)));
                var end = shift.open ? "In corso" : (sameDay(shift.startedAt, shift.endedAt) ? "" : dayOf(shift.endedAt) + " ") + timeOf(shift.endedAt);
                if (shift.pending) end += " · da completare";
                else if (shift.autoClosed) end += " · chiuso da solo, ora del titolare";
                else if (shift.closedByBoss) end += " · chiuso dal titolare";
                tr.appendChild(el("td", "", end));
                tr.appendChild(el("td", "", shift.pending ? "—" : formatDuration(shift.seconds)));
                body.appendChild(tr);
            });
            table.appendChild(body);
            var wrap = el("div", "table-wrap");
            wrap.appendChild(table);
            block.appendChild(wrap);
            box.appendChild(block);
        });
    }

    /* ==================================================================
       Owner: attendance
       ================================================================== */

    var attendance = null;

    function addDays(day, n) {
        var d = new Date(day + "T12:00:00");
        d.setDate(d.getDate() + n);
        return inputDay(d);
    }
    function mondayOf(day) {
        var d = new Date(day + "T12:00:00");
        return addDays(day, -((d.getDay() + 6) % 7));
    }
    function presetRange(preset) {
        var today = inputDay(Date.now());
        if (preset === "lastWeek") { var from = addDays(mondayOf(today), -7); return [from, addDays(from, 6)]; }
        if (preset === "month") return [today.slice(0, 8) + "01", today];
        return [mondayOf(today), today];
    }
    function setPreset(preset) {
        var range = presetRange(preset);
        byId("attFrom").value = range[0];
        byId("attTo").value = range[1];
        Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (b) {
            var on = b.dataset.preset === preset;
            b.classList.toggle("is-active", on);
            b.setAttribute("aria-pressed", String(on));
        });
    }

    function showAttendance() {
        paintView("attendance");
        paintOutButton();
        if (!byId("attFrom").value) setPreset("week");
        loadAttendance();
    }

    document.addEventListener("click", function (event) {
        var preset = event.target.closest("[data-preset]");
        if (!preset) return;
        setPreset(preset.dataset.preset);
        loadAttendance();
    });
    byId("attRange").addEventListener("submit", function (event) {
        event.preventDefault();
        Array.prototype.forEach.call(document.querySelectorAll("[data-preset]"), function (b) {
            b.classList.remove("is-active");
            b.setAttribute("aria-pressed", "false");
        });
        loadAttendance();
    });
    byId("attPrint").addEventListener("click", function () {
        document.body.classList.add("print-days");
        window.print();
        document.body.classList.remove("print-days");
    });

    function loadAttendance() {
        var from = byId("attFrom").value, to = byId("attTo").value;
        var errorText = byId("attError");
        show(errorText, false);
        var query = "?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to);
        byId("attCsv").href = "/api/staff/attendance" + query + "&format=csv";
        api("GET", "/api/staff/attendance" + query).then(function (data) {
            attendance = data;
            renderAttendance();
        }, function (err) {
            if (err.unauthorized) return fail(err);
            errorText.textContent = err.message;
            show(errorText, true);
        });
    }

    function renderAttendance() {
        var body = byId("attBody");
        clear(body);
        byId("attGrace").textContent = String(attendance.graceMin);
        byId("attPrintTitle").textContent = "Presenze dal " + shortDay(attendance.from) + " al " + shortDay(attendance.to);
        attendance.workers.forEach(function (worker) {
            var t = worker.totals;
            var tr = el("tr", worker.onRoster ? "" : "is-gone");
            var nameCell = el("th");
            nameCell.scope = "row";
            var toggle = button(nameOf(worker), "linkish");
            toggle.setAttribute("aria-expanded", "false");
            nameCell.appendChild(toggle);
            if (!worker.hasPin || !worker.schedule) {
                nameCell.appendChild(el("span", "sub", [!worker.hasPin ? "senza PIN" : "", !worker.schedule ? "senza orario" : ""].filter(Boolean).join(" · ")));
            }
            tr.appendChild(nameCell);
            [String(t.daysWorked), hoursLabel(t.workedSec),
                t.lateCount ? t.lateCount + " · " + formatDuration(t.lateMin * 60) : "0",
                String(t.absences), t.overtimeMin ? formatDuration(t.overtimeMin * 60) : "0",
                t.incomplete ? String(t.incomplete) : "0"].forEach(function (text, i) {
                tr.appendChild(el("td", (i === 2 && t.lateCount) || (i === 3 && t.absences) || (i === 5 && t.incomplete) ? "is-flag" : "", text));
            });
            var actions = el("td", "no-print");
            if (worker.onRoster) {
                var settings = button("Orario e PIN");
                settings.addEventListener("click", function () { openSettings(worker, settings); });
                actions.appendChild(settings);
            }
            tr.appendChild(actions);
            body.appendChild(tr);

            var detail = el("tr", "att-days");
            detail.hidden = true;
            var td = el("td");
            td.colSpan = 8;
            td.appendChild(daysTable(worker.days, attendance.today));
            detail.appendChild(td);
            body.appendChild(detail);
            toggle.addEventListener("click", function () {
                detail.hidden = !detail.hidden;
                toggle.setAttribute("aria-expanded", String(!detail.hidden));
            });
        });
    }

    /* ---------- «Orario e PIN» ---------- */

    var settingsDialog = byId("settingsDialog");
    var settingsWorker = null;
    var settingsTrigger = null;
    var settingsBefore = "null";

    (function buildWeek() {
        var week = byId("settingsWeek");
        [1, 2, 3, 4, 5, 6, 0].forEach(function (d) {
            var row = el("div", "week__day");
            row.appendChild(el("span", "week__name", WEEKDAYS[d]));
            ["from", "to"].forEach(function (end) {
                var input = el("input");
                input.type = "time";
                input.dataset.day = String(d);
                input.dataset.end = end;
                input.setAttribute("aria-label", WEEKDAYS[d] + (end === "from" ? ", entrata" : ", uscita"));
                row.appendChild(input);
            });
            week.appendChild(row);
        });
    })();

    function openSettings(worker, trigger) {
        settingsWorker = worker;
        settingsTrigger = trigger;
        byId("settingsTitle").textContent = "Orario e PIN · " + nameOf(worker);
        byId("settingsPinState").textContent = worker.hasPin ? "Ha già un PIN. Scrivine uno nuovo per cambiarlo." : "Non ha ancora un PIN.";
        byId("settingsPin").value = "";
        byId("settingsPinClear").checked = false;
        show(byId("settingsPinClear").parentElement, worker.hasPin);
        Array.prototype.forEach.call(byId("settingsWeek").querySelectorAll("input"), function (input) {
            var day = worker.schedule ? worker.schedule[Number(input.dataset.day)] : null;
            input.value = day ? day[input.dataset.end] : "";
        });
        // Nothing set yet: the shop's opening hours as a starting point.
        if (!worker.schedule) {
            [1, 2, 3, 4, 5].forEach(function (d) { setDay(d, "07:15", "19:15"); });
            setDay(6, "07:30", "12:00");
        }
        settingsBefore = JSON.stringify(worker.schedule || null);
        show(byId("settingsError"), false);
        settingsDialog.showModal();
        byId("settingsPin").focus();
    }
    function setDay(d, from, to) {
        settingsDialog.querySelector('input[data-day="' + d + '"][data-end="from"]').value = from;
        settingsDialog.querySelector('input[data-day="' + d + '"][data-end="to"]').value = to;
    }
    settingsDialog.addEventListener("close", function () { if (settingsTrigger && settingsTrigger.isConnected) settingsTrigger.focus(); });
    byId("settingsPin").addEventListener("input", function () {
        var input = byId("settingsPin");
        input.value = input.value.replace(/\D/g, "").slice(0, 4);
    });

    byId("settingsForm").addEventListener("submit", function (event) {
        event.preventDefault();
        var errorText = byId("settingsError");
        var problem = "";
        var schedule = [0, 1, 2, 3, 4, 5, 6].map(function (d) {
            var from = settingsDialog.querySelector('input[data-day="' + d + '"][data-end="from"]').value;
            var to = settingsDialog.querySelector('input[data-day="' + d + '"][data-end="to"]').value;
            if (!from && !to) return null;
            if (!from || !to || from >= to) problem = problem || WEEKDAYS[d] + ": l'entrata deve venire prima dell'uscita.";
            return { from: from, to: to };
        });
        var body = {};
        var wanted = schedule.some(Boolean) ? schedule : null;
        // The opening hours are only a suggestion: setting just a PIN must not give a schedule.
        if (JSON.stringify(wanted) !== settingsBefore) body.schedule = wanted;
        var newPin = byId("settingsPin").value;
        if (byId("settingsPinClear").checked) body.pin = null;
        else if (newPin) {
            if (!/^[0-9]{4}$/.test(newPin)) problem = problem || "Il PIN è di 4 cifre.";
            body.pin = newPin;
        }
        if (!problem && Object.keys(body).length === 0) problem = "Niente da salvare: scrivi un PIN o cambia l'orario.";
        errorText.textContent = problem;
        show(errorText, !!problem);
        if (problem) return;
        api("PUT", "/api/staff/workers/" + settingsWorker.workerId + "/settings", body).then(function () {
            settingsDialog.close();
            loadAttendance();
            loadAlerts();
        }, function (err) {
            if (err.unauthorized) return fail(err);
            errorText.textContent = err.message;
            show(errorText, true);
        });
    });

    /* ==================================================================
       Start
       ================================================================== */

    // The shared computer keeps the cookie after the tab closes. A tab that
    // did not sign in itself (no marker in sessionStorage) does not inherit the
    // owner's session: it is ended on the server and the login shows. The
    // shop's session carries on, so reopening the panel during the day does
    // not ask for the password again.
    api("GET", "/api/staff/me").then(function (data) {
        viewer = data.viewer;
        var live = sessionGet(LIVE_KEY);
        if (viewer.isBoss && live !== viewer.workerId) {
            return api("POST", "/api/staff/logout").catch(function () {}).then(function () { showLogin(); });
        }
        sessionSet(LIVE_KEY, viewer.workerId);
        goHome();
    }, function (err) {
        if (err.status === 503) {
            showLogin();
            return setError(err.message);
        }
        showLogin(err.unauthorized ? "" : err.message);
    });
})();

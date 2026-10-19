'use strict';

/* =============================================================================
   Cipressina Barche: one process serves the site and the API (Render).
   Ported from autocolor's server/server.js, keeping only the public part:

       POST /api/requests        stores a wizard request in Neon, returns its code
       GET  /api/requests/:code  the lookup at pgs/preventivo.html#stato
       GET  /healthz             Render's health check (never touches the database)

   No framework; one dependency, `pg`.

       npm install
       npm run db:migrate        # once, and whenever server/schema.sql changes
       npm start                 # http://localhost:3000
   ========================================================================== */

require('./env');

const crypto = require('node:crypto');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { promisify } = require('node:util');
const zlib = require('node:zlib');

const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);
const db = require('./db');
const { createRequest, findRequest, ping, describe, pool, DATABASE_URL, unreachable } = db;
const { validateRequest, text, HttpError, BadRequest } = require('./validate');
const auth = require('./auth');
const attendance = require('./attendance');

const PORT = Number(process.env.PORT) || 3000;
// Loopback unless told otherwise; Render needs HOST=0.0.0.0 (render.yaml).
const HOST = process.env.HOST || '127.0.0.1';
// How many proxies append to X-Forwarded-For in front of this process (see clientIp).
const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;
const ROOT = path.join(__dirname, '..');
const MAX_BODY_BYTES = 32 * 1024;

/* -----------------------------------------------------------------------------
   What is public: an allowlist, so .env, server/, design/ (the .blend sources),
   .git and the docs are never served, and a file added at the root later is
   private until it is listed here.
-------------------------------------------------------------------------- */

const PUBLIC_FILES = new Set(['/index.html', '/styles.css', '/staff.css']);
const PUBLIC_DIRS = ['/pgs/', '/src/', '/img/', '/models/'];

function repoPath(filePath) {
    return '/' + path.relative(ROOT, filePath).split(path.sep).join('/');
}

// Lower case because macOS's file system is case-insensitive: /SERVER/db.js opens server/db.js.
function isPublic(pathname) {
    const lower = pathname.toLowerCase();
    if (!MIME[path.posix.extname(lower)]) return false;
    if (lower.split('/').some((segment) => segment.startsWith('.'))) return false;
    return PUBLIC_FILES.has(lower) || PUBLIC_DIRS.some((dir) => lower.startsWith(dir));
}

/* -----------------------------------------------------------------------------
   Client address and rate limits. In memory: they reset on every deploy or
   spin-down, which is fine for what they stop (a script walking codes or
   filling the table), not a serious attack.
-------------------------------------------------------------------------- */

// '203.0.113.7:53411' and '[2001:db8::1]:443' -> the bare address.
function bareIp(value) {
    const trimmed = value.trim();
    const bracketed = /^\[(.+)\](?::\d+)?$/.exec(trimmed);
    if (bracketed) return bracketed[1];
    const first = trimmed.indexOf(':');
    if (first !== -1 && first === trimmed.lastIndexOf(':')) return trimmed.slice(0, first);
    return trimmed;
}

/* X-Forwarded-For is built by appending, so it is read from the RIGHT: the
 * last TRUST_PROXY entries were written by the proxies, and the first of
 * those is the client. Reading from the left would let anyone forge their
 * address and dodge the limits. */
let warnedShortChain = false;
function clientIp(req) {
    const socketIp = req.socket.remoteAddress || 'unknown';
    if (TRUST_PROXY <= 0) return socketIp;
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map(bareIp).filter(Boolean);
    if (forwarded.length < TRUST_PROXY) {
        if (forwarded.length > 0 && !warnedShortChain) {
            warnedShortChain = true;
            console.warn(`\nWarning: x-forwarded-for has ${forwarded.length} hop(s) and TRUST_PROXY=${TRUST_PROXY}.`
                + ' The rate limits now count every visitor as one.\n');
        }
        return socketIp;
    }
    const candidate = forwarded[forwarded.length - TRUST_PROXY];
    if (net.isIP(candidate) === 0) return socketIp;
    return candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;
}

// IPv6 cut to its /64: one client usually controls the whole /64.
function rateKey(ip) {
    if (net.isIPv6(ip) !== true) return ip;
    const [head, tail = ''] = ip.split('::');
    const left = head ? head.split(':') : [];
    const right = tail ? tail.split(':') : [];
    const missing = ip.includes('::') ? 8 - left.length - right.length : 0;
    const groups = [...left, ...Array(Math.max(missing, 0)).fill('0'), ...right];
    return groups.slice(0, 4).map((group) => group.toLowerCase().replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

// Browsers send Origin on every POST. A missing one is not a browser (the
// limits cover those); a present one must be this site, or any page could
// make its visitors submit the form.
function isOwnOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    let host;
    try {
        host = new URL(origin).host;
    } catch {
        return false;
    }
    const own = [req.headers.host, process.env.RENDER_EXTERNAL_URL, process.env.CIPRESSINA_SITE_URL]
        .filter(Boolean)
        .map((value) => {
            try {
                return /^https?:\/\//.test(value) ? new URL(value).host : String(value).trim();
            } catch {
                return '';
            }
        });
    return own.includes(host);
}

const WINDOW_MS = 60_000;
const buckets = new Map(); // key -> { count, resetAt }

function rateLimit(key, limit) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    bucket.count += 1;
    return bucket.count <= limit;
}

// A minute bounds a burst, not patience: stored forms also get a 24 h count
// per address. Generous, because behind a mobile carrier's NAT one address
// can be many people.
const DAY_MS = 24 * 60 * 60 * 1000;
const FORMS_DAILY_PER_IP = Number(process.env.CIPRESSINA_FORMS_DAILY_IP) || 30;
// Wrong panel passwords: five a minute would still be 7,200 guesses a day.
const LOGIN_FAILURES_DAILY_PER_IP = 20;
const daily = new Map(); // key -> { count, resetAt }

// The day's count for a key, started afresh when its 24 h are up.
function dayCount(key) {
    const now = Date.now();
    let bucket = daily.get(key);
    if (!bucket || now > bucket.resetAt) {
        bucket = { count: 0, resetAt: now + DAY_MS };
        daily.set(key, bucket);
    }
    return bucket;
}

function formsDayCount(ip) {
    const bucket = dayCount(`forms:${rateKey(ip)}`);
    return bucket.count >= FORMS_DAILY_PER_IP ? null : bucket;
}

setInterval(() => {
    const now = Date.now();
    for (const map of [buckets, daily]) {
        for (const [key, bucket] of map) if (now > bucket.resetAt) map.delete(key);
    }
}, WINDOW_MS).unref();

/* -----------------------------------------------------------------------------
   HTTP helpers
-------------------------------------------------------------------------- */

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        const onData = (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                // Stop buffering but keep the socket, so the 400 still reaches the browser.
                req.off('data', onData);
                req.pause();
                reject(new BadRequest('Il modulo è troppo grande.'));
                return;
            }
            chunks.push(chunk);
        };
        req.on('data', onData);
        req.on('end', () => {
            if (size > MAX_BODY_BYTES) return;
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
            } catch {
                reject(new BadRequest('JSON non valido.'));
            }
        });
        req.on('error', reject);
    });
}

/* -----------------------------------------------------------------------------
   Static files: content-hash ETag + no-cache (a 304 when nothing changed, never
   a stale file), brotli/gzip kept in memory per file version. The models are
   most of it: GLBs still shrink under brotli.
-------------------------------------------------------------------------- */

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.glb': 'model/gltf-binary',
    '.woff2': 'font/woff2',
};

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.glb']);
const fileCache = new Map(); // key -> Promise<{ etag, buffer }> or Promise<Buffer>

function cacheKey(filePath, stat) {
    return `${filePath}:${stat.size}:${stat.mtimeMs}`;
}

function fileInfo(filePath, stat) {
    const key = cacheKey(filePath, stat);
    let entry = fileCache.get(key);
    if (!entry) {
        const keep = COMPRESSIBLE.has(path.extname(filePath).toLowerCase());
        entry = fsp.readFile(filePath).then((buffer) => ({
            // Content, not mtime: every deploy is a fresh checkout with new mtimes.
            etag: `"${crypto.createHash('sha1').update(buffer).digest('base64url')}"`,
            buffer: keep ? buffer : null,
        }));
        fileCache.set(key, entry);
        entry.catch(() => fileCache.delete(key));
    }
    return entry;
}

function compressed(filePath, stat, info, encoding) {
    const key = `${cacheKey(filePath, stat)}:${encoding}`;
    let entry = fileCache.get(key);
    if (!entry) {
        // Quality 5 above 1 MiB: within 1 % of 9 at a twentieth of the time.
        const quality = info.buffer.length > 1024 * 1024 ? 5 : 9;
        entry = encoding === 'br'
            ? brotli(info.buffer, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: quality } })
            : gzip(info.buffer, { level: 6 });
        fileCache.set(key, entry);
        entry.catch(() => fileCache.delete(key));
    }
    return entry;
}

function pickEncoding(req, ext) {
    if (!COMPRESSIBLE.has(ext)) return null;
    const accepted = String(req.headers['accept-encoding'] || '');
    if (/\bbr\b/.test(accepted)) return 'br';
    if (/\bgzip\b/.test(accepted)) return 'gzip';
    return null;
}

// Drops older versions of a file that changed on disk.
function pruneFileCache(filePath, currentKey) {
    for (const key of fileCache.keys()) {
        if (key.startsWith(`${filePath}:`) && !key.startsWith(currentKey)) fileCache.delete(key);
    }
}

function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Non trovato');
}

async function serveStatic(req, res, pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        throw new BadRequest('Indirizzo non valido.');
    }
    const filePath = path.join(ROOT, decoded === '/' ? 'index.html' : decoded);
    // One '..' too many would leave the project folder.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
        res.writeHead(403).end();
        return;
    }
    // The RESOLVED path ('/pgs/../.env' starts with /pgs/). 404, not 403, so probing confirms nothing.
    if (!isPublic(repoPath(filePath))) return notFound(res);

    let stat;
    try {
        stat = await fsp.stat(filePath);
    } catch {
        return notFound(res);
    }
    if (stat.isDirectory()) return notFound(res);

    const ext = path.extname(filePath).toLowerCase();
    const info = await fileInfo(filePath, stat);
    pruneFileCache(filePath, cacheKey(filePath, stat));
    const encoding = pickEncoding(req, ext);
    const headers = {
        'Content-Type': MIME[ext],
        'Cache-Control': 'no-cache',
        ETag: info.etag,
    };
    if (COMPRESSIBLE.has(ext)) headers.Vary = 'Accept-Encoding';

    const ifNoneMatch = String(req.headers['if-none-match'] || '');
    if (ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === info.etag)) {
        res.writeHead(304, headers).end();
        return;
    }

    if (!info.buffer) {
        headers['Content-Length'] = stat.size;
        res.writeHead(200, headers);
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
        return;
    }

    const body = encoding ? await compressed(filePath, stat, info, encoding) : info.buffer;
    if (encoding) {
        headers['Content-Encoding'] = encoding;
        // three.js's FileLoader sizes its progress from this (uncompressed bytes).
        headers['X-File-Size'] = info.buffer.length;
    }
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
}

/* -----------------------------------------------------------------------------
   API
-------------------------------------------------------------------------- */

const LOOKUP_PATH = /^\/api\/requests\/([0-9]{10})$/;
const NOT_FOUND = 'Nessuna richiesta con questo codice.';

async function handleApi(req, res, pathname) {
    const ip = clientIp(req);

    if (pathname.startsWith('/api/staff/')) return handleStaff(req, res, pathname, ip);

    if (req.method === 'POST' && pathname === '/api/requests') {
        // JSON only: a cross-site <form enctype="text/plain"> cannot set this header without a preflight.
        if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
            return sendJson(res, 415, { error: 'Il modulo va inviato come JSON.' });
        }
        if (!isOwnOrigin(req)) {
            console.warn(`[requests] refused origin ${req.headers.origin} (host ${req.headers.host})`);
            return sendJson(res, 403, { error: 'Invia la richiesta dal modulo del sito.' });
        }
        if (!rateLimit(`post:${rateKey(ip)}`, 10)) {
            return sendJson(res, 429, { error: 'Troppe richieste. Aspetta un minuto.' });
        }
        const today = formsDayCount(ip);
        if (!today) return sendJson(res, 429, { error: 'Troppe richieste oggi da questa connessione.' });
        const data = validateRequest(await readJsonBody(req));
        const created = await createRequest(data);
        // Counted once stored, so a refused form costs nothing.
        today.count += 1;
        // The hop count is how to check TRUST_PROXY on Render: it must be the number in render.yaml.
        const hops = String(req.headers['x-forwarded-for'] || '').split(',').filter((hop) => hop.trim()).length;
        console.log(`[requests] new request ${created.id} (${data.boatType}, ${data.tier}, ${data.zones.length} zones;`
            + ` x-forwarded-for hops ${hops}, TRUST_PROXY ${TRUST_PROXY})`);
        return sendJson(res, 201, created);
    }

    if (req.method === 'GET' && pathname.startsWith('/api/requests/')) {
        if (!rateLimit(`get:${rateKey(ip)}`, 30)) {
            return sendJson(res, 429, { error: 'Troppe verifiche. Aspetta un minuto.' });
        }
        const match = LOOKUP_PATH.exec(pathname);
        // Another length gets the same answer as an unknown code, so the valid shape is not revealed.
        const request = match ? await findRequest(match[1]) : null;
        if (!request) return sendJson(res, 404, { error: NOT_FOUND });
        return sendJson(res, 200, request);
    }

    return sendJson(res, 404, { error: 'Percorso non trovato.' });
}

/* -----------------------------------------------------------------------------
   The workshop panel's API (pgs/officina.html), ported from autocolor's
   attendance branch. Two sessions: the shop's (everybody at the shop computer,
   who names the worker on each action) and the owner's («titolare», who runs
   the shop: he reads everything, closes shifts, sets PINs and schedules, and
   writes notes, but takes no boat and changes no status).

   Every rule lives here and in server/db.js, never in the browser.
-------------------------------------------------------------------------- */

const STATUSES = new Set(['ricevuta', 'alaggio', 'trasporto', 'preparazione', 'verniciatura',
    'antivegetativa', 'varo', 'pronta', 'consegnata', 'annullata']);
const STAFF_PATH = /^\/api\/staff\/requests\/([0-9]{10})$/;
const OCCUPANCY_PATH = /^\/api\/staff\/requests\/([0-9]{10})\/occupancy$/;
const WORKER_NOTE_PATH = /^\/api\/staff\/workers\/([A-Za-z]{2}[0-9]{5})\/note$/;
const WORKER_SETTINGS_PATH = /^\/api\/staff\/workers\/([A-Za-z]{2}[0-9]{5})\/settings$/;
const STAFF_SHIFT_PATH = /^\/api\/staff\/shifts\/([0-9]{1,15})$/;
const STAFF_BOARD_PATH = /^\/api\/staff\/board\/([0-9]{1,15})$/;
const DAY_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

// Minutes past the scheduled start before an arrival is late, and past the
// scheduled length before extra time is overtime.
const LATE_GRACE_MIN = Number(process.env.CIPRESSINA_LATE_GRACE_MIN) || 10;
const MAX_ATTENDANCE_DAYS = 93;
const MAX_NOTE = 500;
const MAX_BOARD_NOTE = 200;
// About six weeks of working days per worker in the owner's history.
const SHIFTS_PER_WORKER = 30;

const nameFor = (code) => auth.workerName(code);
const holderOf = (workerId) => ({ workerId, name: nameFor(workerId) });

function withHolders(request) {
    return Object.assign({}, request, { holders: (request.occupiedBy || []).map(holderOf) });
}

// «Anna e Luca», for the refusals that say who holds a boat.
function holderNames(codes) {
    const named = (codes || []).map((code) => nameFor(code) || code);
    return named.length < 2 ? named.join('') : named.slice(0, -1).join(', ') + ' e ' + named[named.length - 1];
}

function sortedRoster() {
    return auth.listWorkerIds().sort((a, b) => (nameFor(a) || a).localeCompare(nameFor(b) || b, 'it'));
}

// The automatic shift rules (db.tidyShifts), before every shift read or write.
// A failure is logged once and does not fail the screen: they run again next time.
let shiftRulesFailing = false;
async function runShiftRules() {
    try {
        const result = await db.tidyShifts();
        for (const shift of result.expired) {
            console.log(`[officina] closed ${shift.workerId}'s shift ${shift.id} (12 h or ${db.SHIFT_CLOSE_HOUR}:00); waiting for the owner`);
        }
        if (result.dropped > 0) console.log(`[officina] deleted ${result.dropped} shift(s) under ${db.SHIFT_MIN_SECONDS / 60} min`);
        shiftRulesFailing = false;
    } catch (err) {
        if (!shiftRulesFailing) console.warn(`[officina] could not apply the shift rules: ${err.message}`);
        shiftRulesFailing = true;
    }
}

// Sent with every shift answer, so the page words its warnings with the server's numbers.
const SHIFT_LIMITS = Object.freeze({
    minimumSeconds: db.SHIFT_MIN_SECONDS,
    autoCloseAfter: db.SHIFT_MAX_SECONDS,
    closeHour: db.SHIFT_CLOSE_HOUR,
    longestSeconds: db.SHIFT_LONGEST_SECONDS,
});

function shiftView(shift) {
    return {
        id: shift.id, startedAt: shift.startedAt, endedAt: shift.endedAt, open: shift.open, seconds: shift.seconds,
        closedByBoss: shift.closedBy !== null, autoClosed: shift.autoClosed, pending: shift.pending, sinceStart: shift.sinceStart,
    };
}

function boatView(row) {
    return { id: row.id, builder: row.builder, model: row.model, boatName: row.boatName, status: row.status };
}

// workerId -> { pinHash, schedule, scheduleSince, hasPin }.
async function workerSettings() {
    const rows = await db.listWorkerSettings();
    return new Map(rows.map((row) => [row.workerId, {
        pinHash: row.pinHash, schedule: row.schedule, scheduleSince: row.scheduleSince, hasPin: !!row.pinHash,
    }]));
}

// Everything the team screen draws, and what PUT /shift answers with, so a
// press repaints the screen from one reply. The roster comes from the
// environment, so a worker who never started a shift is still on screen.
async function teamPayload() {
    const [today, pending, occupied, settings] = await Promise.all([
        db.listTodayShifts(), db.listNewestPendingShifts(), db.listOccupied(), workerSettings(),
    ]);
    const pendingBy = new Map(pending.map((shift) => [shift.workerId, shift]));
    const workers = sortedRoster().map(function (workerId) {
        const mine = today.filter((shift) => shift.workerId === workerId);
        const open = mine.find((shift) => shift.open) || null;
        const waiting = open ? null : pendingBy.get(workerId) || null;
        return {
            workerId,
            name: nameFor(workerId),
            hasPin: !!(settings.get(workerId) || {}).pinHash,
            shift: open ? { id: open.id, startedAt: open.startedAt, seconds: open.seconds } : null,
            // Today's worked seconds, closed shifts included.
            todaySeconds: mine.reduce((sum, shift) => sum + shift.seconds, 0),
            // With none running: whether the server closed the last one, and why.
            autoClosed: waiting ? { startedAt: waiting.startedAt, reason: waiting.seconds >= db.SHIFT_MAX_SECONDS ? 'max' : 'hour' } : null,
            boats: occupied.filter((row) => row.occupiedBy.indexOf(workerId) !== -1).map(boatView),
        };
    });
    return Object.assign({ workers, onShift: workers.filter((w) => w.shift).length }, SHIFT_LIMITS);
}

// With no password there is no panel: 503 tells «not set up» apart from «session expired».
function requireStaff(req) {
    if (!auth.isConfigured()) throw new HttpError(503, 'Il pannello dell\'officina non è configurato su questo server.');
    if (!auth.readSession(req)) throw new HttpError(401, 'Accedi per vedere il pannello.');
}

function requireBoss(req) {
    requireStaff(req);
    if (!auth.isBoss(auth.sessionWorkerId(req))) throw new HttpError(403, 'Questo è solo per il titolare.');
}

// The shop's routes: the owner takes no boat, changes no status and has no
// shift. `not-shop` lets a tab whose cookie changed hands go back to the login.
function requireShop(req, message) {
    requireStaff(req);
    if (!auth.isShop(auth.sessionWorkerId(req))) {
        throw new HttpError(403, message || 'Questo si fa dal computer dell\'officina.', 'not-shop');
    }
}

// The worker the shop session names on an action, checked against the roster.
function rosterCode(value) {
    const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (!auth.isRosterWorker(code)) throw new BadRequest('Quel codice non è di nessun dipendente.');
    return code;
}

function requireObject(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new BadRequest('Il corpo della richiesta non è valido.');
    return body;
}

// Wrong PINs per worker (one computer, so not per address): five within five
// minutes lock that worker's PIN until the window ends.
const PIN_TRIES = 5;
const PIN_LOCK_MS = 5 * 60 * 1000;
const pinFails = new Map(); // workerId -> { count, resetAt }

function requirePin(workerId, pinHash, entered) {
    const now = Date.now();
    let fails = pinFails.get(workerId);
    if (fails && now > fails.resetAt) {
        pinFails.delete(workerId);
        fails = null;
    }
    if (fails && fails.count >= PIN_TRIES) {
        const minutes = Math.ceil((fails.resetAt - now) / 60000);
        throw new HttpError(429, `Troppi tentativi. Aspetta ${minutes} min o chiedi al titolare.`, 'pin-locked');
    }
    // No PIN sent: a screen that did not know this worker has one. It asks now and spends no try.
    if (entered === undefined || entered === null) throw new HttpError(403, 'Scrivi il tuo PIN.', 'pin-required');
    if (typeof entered === 'string' && /^[0-9]{4}$/.test(entered) && auth.checkPin(entered, pinHash)) {
        pinFails.delete(workerId);
        return;
    }
    fails = fails || { count: 0, resetAt: now + PIN_LOCK_MS };
    fails.count += 1;
    pinFails.set(workerId, fails);
    const left = PIN_TRIES - fails.count;
    if (left === 0) console.warn(`[presenze] ${workerId}: PIN locked after ${PIN_TRIES} wrong tries`);
    throw new HttpError(403, left > 0
        ? `PIN sbagliato. ${left === 1 ? 'Ti resta 1 tentativo' : `Ti restano ${left} tentativi`}.`
        : `PIN sbagliato. Bloccato per ${PIN_LOCK_MS / 60000} minuti.`, 'bad-pin');
}

async function attendanceSummary(from, to, only) {
    const [shifts, settings] = await Promise.all([db.listShiftsBetween(from, to), workerSettings()]);
    return attendance.summarize({
        shifts: only ? shifts.filter((shift) => shift.workerId === only) : shifts,
        settings,
        roster: only ? [only] : auth.listWorkerIds(),
        from, to, now: new Date(), graceMin: LATE_GRACE_MIN,
    });
}

function dayParam(value, field) {
    if (value === null || value === '') return null;
    // Date.parse rolls «2026-02-31» over to March; the round trip refuses it.
    const parsed = DAY_RE.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!parsed || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new BadRequest(`Data non valida: ${field}.`);
    return value;
}

// The shop's session closes with the shop's day: a login during the day ends
// at 23:00 in Rome (when open shifts close); one at night (23:00 to 05:00)
// would otherwise expire mid-morning, so it ends at the next 06:00.
function shopSessionEnd(now) {
    const day = attendance.romeDay(now);
    const hour = Math.floor(attendance.romeMinutes(now) / 60);
    if (hour >= db.SHIFT_CLOSE_HOUR) return attendance.romeInstant(attendance.addDays(day, 1), 6);
    if (hour < 5) return attendance.romeInstant(day, 6);
    return attendance.romeInstant(day, db.SHIFT_CLOSE_HOUR);
}

function viewerOf(req) {
    return viewerFor(auth.sessionWorkerId(req));
}

function viewerFor(workerId) {
    const shop = auth.isShop(workerId);
    return { workerId, name: nameFor(workerId) || (shop ? 'Officina' : 'Titolare'), isBoss: auth.isBoss(workerId), isShop: shop };
}

const NOT_FOUND_REQUEST = 'Nessuna richiesta con questo codice.';
const BOSS_HANDS_OFF = 'Il titolare non prende barche e non cambia gli stati: si fa dal computer dell\'officina.';

async function handleStaff(req, res, pathname, ip) {
    if (pathname === '/api/staff/login' && req.method === 'POST') {
        // The same two gates as /api/requests: otherwise a foreign page could
        // post bad logins from the shop's connection and use up its daily failures.
        if (!/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
            return sendJson(res, 415, { error: 'Il modulo va inviato come JSON.' });
        }
        if (!isOwnOrigin(req)) return sendJson(res, 403, { error: 'Accedi dalla pagina dell\'officina.' });
        if (!auth.isConfigured() || !auth.hasLogins()) {
            return sendJson(res, 503, { error: 'Il pannello dell\'officina non è configurato su questo server.' });
        }
        // Only failures count: the whole shop signs in from one address.
        const loginKey = `login:${rateKey(ip)}`;
        const failuresToday = dayCount(loginKey);
        if (failuresToday.count >= LOGIN_FAILURES_DAILY_PER_IP) {
            return sendJson(res, 429, { error: 'Troppi tentativi sbagliati oggi da questa connessione. Riprova domani.' });
        }
        const failures = buckets.get(loginKey);
        if (failures && Date.now() <= failures.resetAt && failures.count >= 5) {
            return sendJson(res, 429, { error: 'Troppi tentativi. Aspetta un minuto.' });
        }
        const body = requireObject(await readJsonBody(req));
        // Both checks always run, and the answer does not say which failed, so
        // neither the timing nor the message tells a prober which codes exist.
        const workerId = auth.verifyLoginCode(body.workerId);
        const passwordOk = auth.verifyPassword(body.password);
        if (!workerId || !passwordOk) {
            rateLimit(loginKey, 5);
            failuresToday.count += 1;
            console.warn(`[officina] failed login from ${ip}`);
            return sendJson(res, 401, { error: 'Codice o password sbagliati.' });
        }
        console.log(`[officina] ${workerId} signed in from ${ip}`);
        const expiresAt = auth.isShop(workerId) ? shopSessionEnd(Date.now()) : undefined;
        res.setHeader('Set-Cookie', auth.cookieHeader(auth.createSession(workerId, expiresAt)));
        return sendJson(res, 200, { viewer: viewerFor(workerId) });
    }

    if (pathname === '/api/staff/logout' && req.method === 'POST') {
        auth.destroySession(auth.readToken(req));
        res.setHeader('Set-Cookie', auth.clearCookieHeader());
        return res.writeHead(204).end();
    }

    if (pathname === '/api/staff/me' && req.method === 'GET') {
        requireStaff(req);
        return sendJson(res, 200, { viewer: viewerOf(req) });
    }

    if (pathname === '/api/staff/requests' && req.method === 'GET') {
        requireStaff(req);
        const wanted = new URL(req.url, 'http://localhost').searchParams.get('status');
        if (wanted && !STATUSES.has(wanted)) throw new BadRequest('Stato non valido.');
        return sendJson(res, 200, { requests: (await db.listRequests(wanted)).map(withHolders) });
    }

    const statusMatch = STAFF_PATH.exec(pathname);
    if (statusMatch && req.method === 'PATCH') {
        requireShop(req, BOSS_HANDS_OFF);
        const body = requireObject(await readJsonBody(req));
        if (!STATUSES.has(body.status)) throw new BadRequest('Stato non valido.');
        const result = await db.updateRequestStatus(statusMatch[1], body.status);
        if (!result.ok && result.reason === 'not_found') return sendJson(res, 404, { error: NOT_FOUND_REQUEST });
        if (!result.ok) {
            return sendJson(res, 403, { error: 'Prima scegli chi ci lavora, poi cambia lo stato.', code: 'not-held' });
        }
        console.log(`[officina] ${result.id} -> ${result.status} (holders: ${result.holdersBefore.join(', ')})`);
        delete result.holdersBefore;
        return sendJson(res, 200, withHolders(result));
    }

    // Giving a boat to a worker needs their shift open and room (two at most);
    // taking one off needs nothing, and the code only has to be shaped like a
    // worker's, so somebody who left the roster can still be released.
    const occupancy = OCCUPANCY_PATH.exec(pathname);
    if (occupancy && req.method === 'PATCH') {
        requireShop(req, BOSS_HANDS_OFF);
        const body = requireObject(await readJsonBody(req));
        if (typeof body.occupied !== 'boolean') throw new BadRequest('Manca se assegnare o togliere.');
        if (body.occupied) {
            const workerId = rosterCode(body.workerId);
            await runShiftRules();
            const result = await db.occupyRequest(occupancy[1], workerId);
            if (!result.ok && result.reason === 'not_found') return sendJson(res, 404, { error: NOT_FOUND_REQUEST });
            if (!result.ok && result.reason === 'off_shift') {
                return sendJson(res, 409, { error: `${nameFor(workerId) || workerId} non ha iniziato il turno.`, code: 'off-shift' });
            }
            if (!result.ok) {
                return sendJson(res, 409, {
                    error: `Ci lavorano già ${holderNames(result.occupiedBy) || 'altri due'}: al massimo due persone per barca.`,
                    code: 'full',
                });
            }
            console.log(`[officina] ${occupancy[1]} given to ${workerId}`);
            return sendJson(res, 200, withHolders({ id: occupancy[1], occupiedBy: result.occupiedBy }));
        }
        const code = typeof body.workerId === 'string' ? body.workerId.trim().toUpperCase() : '';
        if (!auth.CODE_RE.test(code)) throw new BadRequest('Quel codice non ha la forma di un dipendente.');
        const result = await db.releaseRequest(occupancy[1], code);
        if (!result.ok) return sendJson(res, 404, { error: NOT_FOUND_REQUEST });
        console.log(`[officina] ${occupancy[1]} released by ${code}`);
        return sendJson(res, 200, withHolders({ id: occupancy[1], occupiedBy: result.occupiedBy }));
    }

    if (pathname === '/api/staff/team' && req.method === 'GET') {
        requireShop(req);
        await runShiftRules();
        return sendJson(res, 200, await teamPayload());
    }

    // The body says the state wanted, never «flip it»: a second tap or a stale
    // screen asks for what already is, where a toggle would undo it. A worker
    // with a PIN starts and ends their own shift only.
    if (pathname === '/api/staff/shift' && req.method === 'PUT') {
        requireShop(req, 'Il titolare non ha un turno.');
        const body = requireObject(await readJsonBody(req));
        if (typeof body.open !== 'boolean') throw new BadRequest('Manca se iniziare o finire il turno.');
        await runShiftRules();
        const workerId = rosterCode(body.workerId);
        const own = (await workerSettings()).get(workerId);
        if (own && own.pinHash) requirePin(workerId, own.pinHash, body.pin);
        const result = { workerId, started: false, ended: false, discarded: false };
        if (body.open) {
            result.started = (await db.startShift(workerId)).started;
            if (result.started) console.log(`[officina] ${workerId} started a shift`);
        } else {
            const ended = await db.endShift(workerId);
            result.ended = ended.ended;
            result.discarded = ended.discarded;
            if (ended.ended) console.log(`[officina] ${workerId} ended a shift after ${ended.shift.seconds}s${ended.discarded ? ' (deleted, too short)' : ''}`);
        }
        return sendJson(res, 200, Object.assign(await teamPayload(), { result }));
    }

    // «Cose da fare»: open notes newest first, with the owner's notes to each
    // worker pinned on top (nobody ticks those: they are his).
    if (pathname === '/api/staff/board' && req.method === 'GET') {
        requireShop(req);
        const [rows, bossNotes] = await Promise.all([db.listBoardNotes(), db.listWorkerNotes()]);
        const roster = sortedRoster();
        const pinned = roster
            .map((workerId) => bossNotes.find((note) => note.workerId === workerId))
            .filter(Boolean)
            .map((note) => ({ id: null, kind: 'boss', to: holderOf(note.workerId), from: null, text: note.note, createdAt: note.updatedAt }));
        const notes = rows.map((note) => ({
            id: note.id, kind: 'note', to: note.to ? holderOf(note.to) : null, from: holderOf(note.from), text: note.text, createdAt: note.createdAt,
        }));
        return sendJson(res, 200, { notes: pinned.concat(notes), workers: roster.map(holderOf) });
    }

    if (pathname === '/api/staff/board' && req.method === 'POST') {
        requireShop(req);
        const body = requireObject(await readJsonBody(req));
        const note = text(body.text, { max: MAX_BOARD_NOTE, field: 'la nota' });
        if (!note) throw new BadRequest('Scrivi cosa c\'è da fare.');
        const from = typeof body.from === 'string' ? body.from.trim().toUpperCase() : '';
        if (!auth.isRosterWorker(from)) throw new BadRequest('Scegli chi la scrive.');
        // The session is shared: a worker with a PIN signs their own notes.
        const own = (await workerSettings()).get(from);
        if (own && own.pinHash) requirePin(from, own.pinHash, body.pin);
        let to = null;
        if (body.to !== undefined && body.to !== null && body.to !== '') {
            to = typeof body.to === 'string' ? body.to.trim().toUpperCase() : '';
            if (!auth.isRosterWorker(to)) throw new BadRequest('Scegli per chi è.');
        }
        const created = await db.createBoardNote(to, from, note);
        console.log(`[officina] board: note ${created.id} from ${from}`);
        return sendJson(res, 201, { note: created });
    }

    const boardMatch = STAFF_BOARD_PATH.exec(pathname);
    if (boardMatch && req.method === 'PATCH') {
        requireShop(req);
        const body = requireObject(await readJsonBody(req));
        if (body.done !== true) throw new BadRequest('Si può solo segnare come fatta.');
        const done = await db.markBoardNoteDone(Number(boardMatch[1]));
        if (!done) return sendJson(res, 404, { error: 'Quella nota non esiste più.' });
        return sendJson(res, 200, done);
    }

    // The owner's monitor: every worker with the boats in their hands and his
    // note to them. A code that left the roster but still holds a boat is
    // listed too, or that boat would look free.
    if (pathname === '/api/staff/workers' && req.method === 'GET') {
        requireBoss(req);
        const held = new Map(auth.listWorkerIds().map((workerId) => [workerId, []]));
        const notes = new Map((await db.listWorkerNotes()).map((note) => [note.workerId, note]));
        for (const row of await db.listOccupied()) {
            for (const workerId of row.occupiedBy) {
                if (!held.has(workerId)) held.set(workerId, []);
                held.get(workerId).push(boatView(row));
            }
        }
        const workers = Array.from(held, ([workerId, boats]) => {
            const note = notes.get(workerId);
            return { workerId, name: nameFor(workerId), boats, note: note ? { text: note.note, updatedAt: note.updatedAt } : null };
        });
        // Who is working first, then by name.
        workers.sort((a, b) => ((b.boats.length > 0) - (a.boats.length > 0))
            || (a.name || a.workerId).localeCompare(b.name || b.workerId, 'it'));
        return sendJson(res, 200, { workers });
    }

    // One note per worker: a text sets it, an empty one takes it away.
    const noteMatch = WORKER_NOTE_PATH.exec(pathname);
    if (noteMatch && req.method === 'PUT') {
        requireBoss(req);
        const workerId = noteMatch[1].toUpperCase();
        if (!auth.isRosterWorker(workerId)) return sendJson(res, 404, { error: 'Quel codice non è di nessun dipendente.' });
        const body = requireObject(await readJsonBody(req));
        const note = text(body.note, { max: MAX_NOTE, field: 'la nota' });
        if (!note) {
            await db.clearWorkerNote(workerId);
            return sendJson(res, 200, { workerId, note: null });
        }
        const saved = await db.setWorkerNote(workerId, note, auth.sessionWorkerId(req));
        return sendJson(res, 200, { workerId, note: { text: saved.note, updatedAt: saved.updatedAt } });
    }

    // Each field optional: what the body leaves out stays, null clears it.
    const settingsMatch = WORKER_SETTINGS_PATH.exec(pathname);
    if (settingsMatch && req.method === 'PUT') {
        requireBoss(req);
        const workerId = settingsMatch[1].toUpperCase();
        if (!auth.isRosterWorker(workerId)) return sendJson(res, 404, { error: 'Quel codice non è di nessun dipendente.' });
        const body = requireObject(await readJsonBody(req));
        const change = {};
        if (body.pin !== undefined) {
            if (body.pin === null) change.pinHash = null;
            else if (typeof body.pin === 'string' && /^[0-9]{4}$/.test(body.pin)) change.pinHash = auth.hashPin(body.pin);
            else throw new BadRequest('Il PIN è di 4 cifre.');
        }
        if (body.schedule !== undefined) {
            change.schedule = body.schedule === null ? null : attendance.parseSchedule(body.schedule, db.SHIFT_CLOSE_HOUR);
            if (change.schedule === null && body.schedule !== null) {
                throw new BadRequest(`Orario non valido: ogni giorno di lavoro ha un'entrata prima dell'uscita, entro le ${db.SHIFT_CLOSE_HOUR}:00.`);
            }
        }
        if (Object.keys(change).length === 0) throw new BadRequest('Niente da salvare.');
        await db.putWorkerSettings(workerId, change);
        // A new PIN unlocks a locked one.
        if (change.pinHash !== undefined) pinFails.delete(workerId);
        console.log(`[presenze] ${workerId}: ${Object.keys(change).map((k) => (k === 'pinHash' ? 'PIN' : 'schedule')).join(' and ')} updated`);
        const saved = (await workerSettings()).get(workerId) || {};
        return sendJson(res, 200, { workerId, hasPin: !!saved.pinHash, schedule: saved.schedule || null });
    }

    // Every worker's latest shifts, plus the ones waiting for the owner's end time.
    if (pathname === '/api/staff/shifts' && req.method === 'GET') {
        requireBoss(req);
        await runShiftRules();
        const byWorker = new Map(auth.listWorkerIds().map((workerId) => [workerId, []]));
        for (const shift of await db.listShifts(SHIFTS_PER_WORKER)) {
            if (!byWorker.has(shift.workerId)) byWorker.set(shift.workerId, []);
            byWorker.get(shift.workerId).push(shift);
        }
        const workers = Array.from(byWorker, ([workerId, shifts]) => ({
            workerId, name: nameFor(workerId), shifts: shifts.map(shiftView), total: shifts.length > 0 ? shifts[0].total : 0,
        }));
        workers.sort((a, b) => (a.name || a.workerId).localeCompare(b.name || b.workerId, 'it'));
        const pending = (await db.listPendingShifts()).map((shift) => Object.assign(shiftView(shift), {
            workerId: shift.workerId, name: nameFor(shift.workerId),
        }));
        return sendJson(res, 200, Object.assign({ workers, pending, serverNow: new Date().toISOString() }, SHIFT_LIMITS));
    }

    // The owner closes a forgotten shift at the time the worker really left
    // (closing it when he notices would credit them with the night), or
    // completes one the server closed. `endedAt` ISO, or absent for «now».
    const shiftMatch = STAFF_SHIFT_PATH.exec(pathname);
    if (shiftMatch && req.method === 'PATCH') {
        requireBoss(req);
        await runShiftRules();
        const body = requireObject(await readJsonBody(req));
        let endedAt = null;
        if (body.endedAt !== undefined && body.endedAt !== null) {
            endedAt = typeof body.endedAt === 'string' ? new Date(body.endedAt) : null;
            if (!endedAt || isNaN(endedAt.getTime())) throw new BadRequest('Ora di uscita non valida.');
        }
        const result = await db.closeShift(Number(shiftMatch[1]), endedAt, auth.sessionWorkerId(req));
        if (!result.closed) {
            if (result.reason === 'missing') return sendJson(res, 404, { error: 'Quel turno non esiste più.' });
            if (result.reason === 'ended') return sendJson(res, 409, { error: 'Quel turno era già finito.' });
            throw new BadRequest({
                early: 'L\'uscita è prima dell\'inizio del turno.',
                now: 'Indica a che ora è uscito.',
                long: `Un turno non può durare più di ${db.SHIFT_LONGEST_SECONDS / 3600} ore.`,
                overlap: 'Quell\'uscita si sovrappone a un altro turno della stessa persona.',
            }[result.reason] || 'L\'ora di uscita non è ancora arrivata.');
        }
        console.log(`[officina] the owner closed ${result.shift.workerId}'s shift${result.discarded ? ' (deleted, too short)' : ` after ${result.shift.seconds}s`}`);
        return sendJson(res, 200, { shift: result.discarded ? null : shiftView(result.shift), discarded: result.discarded });
    }

    // The owner's attendance report: Rome days `from`..`to` (this week so far
    // by default), with the alerts his profile shows; `format=csv` for Excel.
    if (pathname === '/api/staff/attendance' && req.method === 'GET') {
        requireBoss(req);
        await runShiftRules();
        const params = new URL(req.url, 'http://localhost').searchParams;
        const today = attendance.romeDay(new Date());
        const from = dayParam(params.get('from'), 'inizio') || attendance.weekStart(today);
        const to = dayParam(params.get('to'), 'fine') || today;
        if (from > to) throw new BadRequest('La data di inizio è dopo quella di fine.');
        if (attendance.addDays(from, MAX_ATTENDANCE_DAYS) <= to) throw new BadRequest(`Al massimo ${MAX_ATTENDANCE_DAYS} giorni per volta.`);
        const summary = await attendanceSummary(from, to);
        if (params.get('format') === 'csv') {
            const csv = attendance.toCsv(summary, nameFor);
            res.writeHead(200, {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="presenze_${from}_${to}.csv"`,
                'Content-Length': Buffer.byteLength(csv),
                'Cache-Control': 'no-store',
            });
            return res.end(csv);
        }
        const workers = summary.workers.map((worker) => Object.assign({ name: nameFor(worker.workerId) }, worker));
        workers.sort((a, b) => (a.name || a.workerId).localeCompare(b.name || b.workerId, 'it'));
        return sendJson(res, 200, Object.assign({}, summary, { workers, alerts: attendance.alertsFrom(summary) }));
    }

    // A worker's own attendance on the shop computer, behind their PIN. POST so
    // the PIN travels in the body and never in a URL the history keeps.
    if (pathname === '/api/staff/attendance/mine' && req.method === 'POST') {
        requireShop(req);
        const body = requireObject(await readJsonBody(req));
        const workerId = rosterCode(body.workerId);
        const own = (await workerSettings()).get(workerId);
        if (!own || !own.pinHash) throw new HttpError(403, 'Non hai ancora un PIN. Chiedilo al titolare.', 'no-pin');
        requirePin(workerId, own.pinHash, body.pin);
        await runShiftRules();
        const today = attendance.romeDay(new Date());
        const weekFrom = attendance.weekStart(today);
        const [week, month] = await Promise.all([
            attendanceSummary(weekFrom, attendance.addDays(weekFrom, 6), workerId),
            attendanceSummary(attendance.monthStart(today), attendance.monthEnd(today), workerId),
        ]);
        return sendJson(res, 200, {
            workerId, name: nameFor(workerId), schedule: own.schedule || null, graceMin: LATE_GRACE_MIN, today,
            week: { from: week.from, to: week.to, days: week.workers[0].days, totals: week.workers[0].totals },
            month: { from: month.from, to: month.to, totals: month.workers[0].totals },
        });
    }

    return sendJson(res, 404, { error: 'Percorso non trovato.' });
}

const server = http.createServer(async (req, res) => {
    // A fixed base, inside a try: `GET //` or a bad Host make URL throw.
    let pathname;
    try {
        pathname = new URL(req.url, 'http://localhost').pathname;
    } catch {
        sendJson(res, 400, { error: 'Indirizzo non valido.' });
        return;
    }

    try {
        // Never touches the database: a sleeping Neon must not make Render restart us.
        if (pathname === '/healthz') return sendJson(res, 200, { ok: true });
        if (pathname.startsWith('/api/')) return await handleApi(req, res, pathname);
        if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, pathname);
        sendJson(res, 405, { error: 'Metodo non consentito.' });
    } catch (err) {
        if (err instanceof HttpError) {
            sendJson(res, err.status, err.code ? { error: err.message, code: err.code } : { error: err.message });
            return;
        }
        // A database that does not answer (Neon waking up) is a wait, not a
        // bug: 503, and the page tells the customer nothing was saved yet.
        if (unreachable(err)) {
            console.error('[db] not answering:', err.message || err.code || (err.errors || []).map((e) => e.message).join('; '));
            if (!res.headersSent) sendJson(res, 503, { error: 'Il database non risponde. Riprova tra un minuto.' });
            return;
        }
        // The detail stays in the log, so the table's structure does not leak.
        console.error('[error]', err);
        if (!res.headersSent) sendJson(res, 500, { error: 'Non è stato possibile elaborare la richiesta.' });
    }
});

async function start() {
    if (!DATABASE_URL) {
        console.error('\nDATABASE_URL is missing. Put the Neon URL in .env (see .env.example)'
            + ' or in the service\'s environment on Render.\n');
        process.exit(1);
    }
    try {
        await ping(4);
    } catch (err) {
        // A refused connection on every address is an AggregateError with an empty message.
        const detail = err.message || (err.errors || []).map((e) => e.message).join('; ') || err.code || err;
        console.error(`\nCould not connect to ${describe()}: ${detail}\nCheck DATABASE_URL.\n`);
        process.exit(1);
    }
    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') console.error(`\nPort ${PORT} is busy. Try PORT=3001 npm start\n`);
        else console.error(`\nCould not open the server: ${err.message}\n`);
        process.exit(1);
    });
    if (process.env.RENDER && ['127.0.0.1', 'localhost', '::1'].includes(HOST)) {
        console.warn(`\nWarning: HOST=${HOST} is not reachable from outside the container. Render needs HOST=0.0.0.0.\n`);
    }
    if (process.env.RENDER && TRUST_PROXY <= 0) {
        console.warn('\nWarning: TRUST_PROXY is missing. The rate limits count every visitor as one.\n');
    }
    server.listen(PORT, HOST, () => {
        console.log(`Cipressina on ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
        if (process.env.RENDER_GIT_COMMIT) {
            console.log(`Deployed: ${process.env.RENDER_GIT_BRANCH || '?'} @ ${process.env.RENDER_GIT_COMMIT.slice(0, 7)}`);
        }
        console.log(`Database: ${describe()}`);
        // A switched-off panel is a 503 from inside and a broken page from outside: name what is missing.
        const missing = [];
        if (!auth.isConfigured()) missing.push('CIPRESSINA_STAFF_PASSWORD');
        if (!auth.hasLogins()) missing.push('CIPRESSINA_SHOP_ID (or CIPRESSINA_BOSS_ID)');
        console.log(missing.length === 0
            ? `Workshop panel: /pgs/officina.html (${auth.listWorkerIds().length} workers)`
            : `Workshop panel off: missing ${missing.join(' and ')}.`);
    });
}

// An unhandled rejection ends the process in Node 20+; log it instead of taking the site down.
process.on('unhandledRejection', (reason) => {
    console.error(`[server] unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

// Finish what is running before dropping the pool (Render sends SIGTERM on deploy and spin-down).
for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        server.close(() => pool.end().then(() => process.exit(0)));
    });
}

start();

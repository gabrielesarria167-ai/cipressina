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
const { createRequest, findRequest, ping, describe, pool, DATABASE_URL, unreachable } = require('./db');
const { validateRequest, HttpError, BadRequest } = require('./validate');

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

const PUBLIC_FILES = new Set(['/index.html', '/styles.css']);
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
const daily = new Map(); // key -> { count, resetAt }

function formsDayCount(ip) {
    const key = `forms:${rateKey(ip)}`;
    const now = Date.now();
    let bucket = daily.get(key);
    if (!bucket || now > bucket.resetAt) {
        bucket = { count: 0, resetAt: now + DAY_MS };
        daily.set(key, bucket);
    }
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
            sendJson(res, err.status, { error: err.message });
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

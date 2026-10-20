'use strict';

/* =============================================================================
   Workshop panel sessions (pgs/officina.html). Ported from autocolor's
   server/auth.js.

   One shared password, CIPRESSINA_STAFF_PASSWORD, and two logins with it:

     - the shop's, CIPRESSINA_SHOP_ID («OFFICINA:Officina»): everybody at the
       shop, on the shop computer. It then says, on each action, which worker
       it is for, so the roster stays;
     - the owner's, CIPRESSINA_BOSS_ID («AB12345:Mario Rossi»): the «titolare».

   The roster, CIPRESSINA_WORKER_IDS («AB12345:Anna Bianchi,CD67890:Luca
   Verdi»), are not logins: they are who a shift, a boat in hand or a note
   belongs to. All of it lives in the environment and not in the repository,
   which is public: between them the codes and names say who works at the shop.

   Without the password (or without any login code) the panel answers 503
   instead of staying open. The check lives here, not in the browser: the page
   is a static file anyone can read.
   ========================================================================== */

require('./env');

const crypto = require('node:crypto');

const COOKIE_NAME = 'cipressina_staff';
const SESSION_MS = 8 * 60 * 60 * 1000;   // the owner's: one working day
const PASSWORD = process.env.CIPRESSINA_STAFF_PASSWORD || '';

// Workers' codes: initials and five digits (AB12345). The tables CHECK this
// shape, so a code like «ANNA» would pass here and fail on the first shift.
const CODE_RE = /^[A-Z]{2}[0-9]{5}$/;
// The shop's and the owner's codes are never stored as a worker, so any shape
// without spaces will do (the login trims what is typed).
const ANY_CODE_RE = /^\S{1,64}$/;

// «CODE:Name,CODE:Name» -> codes and names. Codes are upper-cased so «ab12345»
// matches; names are kept as written. A code without a name shows as the code.
function parseRoster(raw, variable, shape) {
    const codes = new Set();
    const names = new Map();
    for (const entry of String(raw || '').split(',')) {
        const colon = entry.indexOf(':');
        const code = (colon === -1 ? entry : entry.slice(0, colon)).trim().toUpperCase();
        if (!code) continue;
        if (!shape.test(code)) {
            console.warn(shape === CODE_RE
                ? `[auth] ${variable}: skipping «${code}», worker codes are two letters and five digits (AB12345)`
                : `[auth] ${variable}: skipping «${code}», a code cannot contain spaces`);
            continue;
        }
        codes.add(code);
        const name = colon === -1 ? '' : entry.slice(colon + 1).trim();
        if (name) names.set(code, name);
    }
    return { codes, names };
}

function firstOf(roster, variable) {
    const code = roster.codes.values().next().value || '';
    if (roster.codes.size > 1) console.warn(`[auth] ${variable} lists ${roster.codes.size} codes; only the first, ${code}, is used`);
    return code;
}

const roster = parseRoster(process.env.CIPRESSINA_WORKER_IDS, 'CIPRESSINA_WORKER_IDS', CODE_RE);
const WORKER_IDS = roster.codes;
const NAMES = roster.names;

const bossRoster = parseRoster(process.env.CIPRESSINA_BOSS_ID, 'CIPRESSINA_BOSS_ID', ANY_CODE_RE);
const BOSS_ID = firstOf(bossRoster, 'CIPRESSINA_BOSS_ID');
if (BOSS_ID && bossRoster.names.get(BOSS_ID)) NAMES.set(BOSS_ID, bossRoster.names.get(BOSS_ID));
// Listed as a worker too, the owner would show up in his own monitor.
if (BOSS_ID) WORKER_IDS.delete(BOSS_ID);

const shopRoster = parseRoster(process.env.CIPRESSINA_SHOP_ID, 'CIPRESSINA_SHOP_ID', ANY_CODE_RE);
let SHOP_ID = firstOf(shopRoster, 'CIPRESSINA_SHOP_ID');
if (SHOP_ID && SHOP_ID === BOSS_ID) {
    console.warn(`[auth] CIPRESSINA_SHOP_ID is the owner's code (${SHOP_ID}); the shop login is disabled`);
    SHOP_ID = '';
}
if (SHOP_ID) {
    if (WORKER_IDS.delete(SHOP_ID)) console.warn(`[auth] CIPRESSINA_SHOP_ID ${SHOP_ID} is also a worker; taking it off the roster`);
    if (shopRoster.names.get(SHOP_ID)) NAMES.set(SHOP_ID, shopRoster.names.get(SHOP_ID));
}
if (WORKER_IDS.size > 0 && !SHOP_ID) console.warn('[auth] there are workers but no CIPRESSINA_SHOP_ID: only the owner can sign in');
if (SHOP_ID && WORKER_IDS.size === 0) console.warn('[auth] CIPRESSINA_SHOP_ID is set but CIPRESSINA_WORKER_IDS is empty: nobody to show');

// In memory: a deploy or a free-plan spin-down signs everybody out, which a
// handful of people on one computer can live with.
const sessions = new Map(); // token -> { expiresAt, workerId }

function isConfigured() { return PASSWORD.length > 0; }
function hasLogins() { return SHOP_ID.length > 0 || BOSS_ID.length > 0; }
function normal(code) { return String(code || '').trim().toUpperCase(); }
function isBoss(code) { return !!BOSS_ID && normal(code) === BOSS_ID; }
function isShop(code) { return !!SHOP_ID && normal(code) === SHOP_ID; }
function isRosterWorker(code) { return WORKER_IDS.has(normal(code)); }
function listWorkerIds() { return Array.from(WORKER_IDS).sort(); }
/** The configured name, or '' (callers then show the code). */
function workerName(code) { return NAMES.get(normal(code)) || ''; }

// Digests compared, not strings: timingSafeEqual needs equal lengths, and the
// time taken must not tell a prober how many characters were right.
function verifyPassword(entered) {
    if (!isConfigured() || typeof entered !== 'string' || entered.length === 0) return false;
    const a = crypto.createHash('sha256').update(entered).digest();
    const b = crypto.createHash('sha256').update(PASSWORD).digest();
    return crypto.timingSafeEqual(a, b);
}

/* A worker's 4-digit PIN as «salt:hash» (scrypt). 10,000 combinations: what
   protects it is the attempt limit in server/server.js; the hash only keeps a
   database dump from showing everybody's PIN. */
function hashPin(pin) {
    const salt = crypto.randomBytes(16);
    return salt.toString('hex') + ':' + crypto.scryptSync(pin, salt, 32).toString('hex');
}

function checkPin(entered, stored) {
    if (typeof entered !== 'string' || typeof stored !== 'string') return false;
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const a = crypto.scryptSync(entered, Buffer.from(salt, 'hex'), 32);
    return crypto.timingSafeEqual(a, Buffer.from(hash, 'hex'));
}

/** The shop's or the owner's code, normalised, or '' for anything else (workers do not log in). */
function verifyLoginCode(entered) {
    if (typeof entered !== 'string') return '';
    const code = normal(entered);
    return (BOSS_ID && code === BOSS_ID) || (SHOP_ID && code === SHOP_ID) ? code : '';
}

function createSession(workerId, expiresAt) {
    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, { expiresAt: expiresAt || Date.now() + SESSION_MS, workerId: workerId || '' });
    return token;
}

function destroySession(token) {
    if (token) sessions.delete(token);
}

function readToken(req) {
    for (const part of String(req.headers.cookie || '').split(';')) {
        const eq = part.indexOf('=');
        if (eq > 0 && part.slice(0, eq).trim() === COOKIE_NAME) return part.slice(eq + 1).trim();
    }
    return '';
}

/** The request's token if its session is alive, else ''. */
function readSession(req) {
    const token = readToken(req);
    const session = sessions.get(token);
    if (!session) return '';
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return '';
    }
    return token;
}

function sessionWorkerId(req) {
    const token = readSession(req);
    return token ? sessions.get(token).workerId : '';
}

// HttpOnly (no script reads it), SameSite=Strict (it does not travel on
// requests born on another site), Secure behind a variable because
// http://localhost would drop it. Max-Age is what the session has left.
function cookieHeader(token) {
    const session = sessions.get(token);
    const left = session ? session.expiresAt - Date.now() : SESSION_MS;
    const parts = [`${COOKIE_NAME}=${token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/',
        `Max-Age=${Math.max(1, Math.floor(left / 1000))}`];
    if (process.env.CIPRESSINA_STAFF_COOKIE_SECURE === '1') parts.push('Secure');
    return parts.join('; ');
}

function clearCookieHeader() {
    return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) if (now > session.expiresAt) sessions.delete(token);
}, 60 * 60 * 1000).unref();

module.exports = {
    isConfigured, hasLogins, isBoss, isShop, isRosterWorker, listWorkerIds, workerName,
    verifyPassword, hashPin, checkPin, verifyLoginCode,
    createSession, destroySession, readSession, readToken, sessionWorkerId,
    cookieHeader, clearCookieHeader, CODE_RE,
};

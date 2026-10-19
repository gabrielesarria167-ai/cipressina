'use strict';

/* =============================================================================
   Access to the requests database: storing a request from the wizard and
   finding one by its code. Ported from autocolor's server/db.js.

   The database is Neon, reached through DATABASE_URL (the direct URL, not the
   -pooler one, with sslmode=verify-full). Locally the same: point .env at a
   Neon branch or at any Postgres.
   ========================================================================== */

const crypto = require('node:crypto');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';

const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    // Generous: Neon's free plan suspends compute when idle, and the first
    // connection after that pays for the startup on top of TLS.
    connectionTimeoutMillis: 15_000,
});

// An idle connection dropped by Neon emits 'error' on the pool; without a
// listener that is an uncaught exception and kills the process. The pool
// already discards the broken connection, so logging is enough.
pool.on('error', (err) => {
    console.error('[db] idle connection lost:', err.message);
});

// 10 digits, no leading zero, from crypto: the code is the lookup's only
// credential, so it must not be guessable from a known one.
function generateId() {
    return String(crypto.randomInt(1_000_000_000, 10_000_000_000));
}

/* Neon sleeps, and waking it takes longer than connecting. Only GETTING the
 * connection is retried, never the query: if pool.connect() fails nothing was
 * sent, so retrying cannot store a request twice under two codes. */
const UNREACHABLE_CODES = new Set([
    'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE',
    '57P01', '57P02', '57P03',   // shut down, shutting down, still starting
]);

function unreachable(err) {
    const code = err && err.code ? String(err.code) : '';
    if (UNREACHABLE_CODES.has(code)) return true;
    if (code.startsWith('08')) return true;   // Postgres's connection-exception class
    // pg and pg-pool report timeouts as plain Errors with no code. Not a bare
    // "timeout": that would also match a statement timeout, which is a bug.
    return /timeout exceeded|timeout expired|connection timeout|connection terminated|socket hang up/i
        .test(err && err.message ? err.message : '');
}

const CONNECT_ATTEMPTS = 3;

async function connect() {
    for (let attempt = 1; ; attempt++) {
        try {
            return await pool.connect();
        } catch (err) {
            if (!unreachable(err) || attempt >= CONNECT_ATTEMPTS) throw err;
            console.warn(`[db] ${err.code || 'no connection'} on connect`
                + ` (attempt ${attempt} of ${CONNECT_ATTEMPTS}); the database may be waking up`);
            await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
    }
}

async function query(text, values) {
    const client = await connect();
    try {
        return await client.query(text, values);
    } finally {
        client.release();
    }
}

const INSERT_REQUEST = `
    INSERT INTO requests (id, lang, boat_type, builder, model, model_year, loa, registered, registration,
                          berth_kind, engine_hours, location, service_site, boat_name, color_code,
                          tier, zones, antifouling_color, estimate,
                          first_name, last_name, phone, email, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24)
    RETURNING id, status, created_at
`;

const UNIQUE_VIOLATION = '23505';
const ID_ATTEMPTS = 5;

/** Stores a validated request (server/validate.js) and returns its code. */
async function createRequest(data) {
    for (let attempt = 1; attempt <= ID_ATTEMPTS; attempt++) {
        const id = generateId();
        try {
            const { rows } = await query(INSERT_REQUEST, [
                id, data.lang, data.boatType, data.builder, data.model, data.year, data.loa,
                data.registered, data.registration, data.berthKind, data.engineHours, data.location,
                data.serviceSite, data.boatName, data.colorCode,
                data.tier, data.zones, data.antifoulingColor, data.estimate,
                data.firstName, data.lastName, data.phone, data.email, data.notes,
            ]);
            return { id: rows[0].id.trim(), status: rows[0].status, createdAt: rows[0].created_at };
        } catch (err) {
            // A clash with an existing code (1 in 9,000 million): draw again.
            if (err.code !== UNIQUE_VIOLATION || attempt === ID_ATTEMPTS) throw err;
        }
    }
    throw new Error('Could not draw a free code'); // unreachable: the loop throws first
}

/**
 * Finds a request by its code. Only what the lookup shows, never the phone,
 * email or notes: the code travels on paper and in messages, and must not be
 * enough to pull anyone's contact details.
 */
async function findRequest(id) {
    const { rows } = await query(
        `SELECT id, builder, model, first_name, last_name, status FROM requests WHERE id = $1`,
        [id]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
        id: row.id.trim(),
        builder: row.builder,
        model: row.model,
        firstName: row.first_name,
        lastName: row.last_name,
        status: row.status,
    };
}

// Several attempts at startup on Neon: this runs before the port opens, and a
// failure there fails the deploy.
async function ping(attempts) {
    for (let attempt = 1; ; attempt++) {
        try {
            await pool.query('SELECT 1');
            return;
        } catch (err) {
            if (attempt >= attempts) throw err;
            await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
        }
    }
}

// Which database, for the startup log. Never the password inside the URL.
function describe() {
    try {
        const url = new URL(DATABASE_URL);
        return `${url.pathname.slice(1) || '(no name)'} on ${url.host}`;
    } catch {
        return '(DATABASE_URL could not be read)';
    }
}

module.exports = { createRequest, findRequest, ping, describe, pool, DATABASE_URL, unreachable };

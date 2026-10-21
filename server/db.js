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
                          tier, zones, antifouling_color, estimate, beam, options,
                          first_name, last_name, phone, email, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, $26)
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
                data.tier, data.zones, data.antifoulingColor, data.estimate, data.beam, data.options,
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

/* -----------------------------------------------------------------------------
   The workshop panel (pgs/officina.html), ported from autocolor's server/db.js.
   Who holds which boat, shifts, settings, the owner's notes and the shop's
   «Cose da fare». Every instant comes from the database's now(), never from
   a browser, and «today» is Rome's calendar day, worked out by Postgres.
-------------------------------------------------------------------------- */

// Finished jobs (src/zones.js): the list keeps only the newest 200 of them, the part that grows without end.
require('../src/zones.js');
const { FINISHED } = globalThis.CIPRESSINA_ZONES;
const STAFF_COLUMNS = `id, created_at, status, boat_type, builder, model, model_year, loa, registered,
                       registration, berth_kind, engine_hours, location, service_site, boat_name,
                       color_code, tier, zones, antifouling_color, estimate, beam, options,
                       first_name, last_name, phone, email, notes, occupied_by`;

function mapStaffRequest(row) {
    return {
        id: row.id.trim(),
        createdAt: row.created_at,
        status: row.status,
        boatType: row.boat_type,
        builder: row.builder,
        model: row.model,
        year: row.model_year,
        loa: Number(row.loa),
        beam: row.beam === null ? null : Number(row.beam),
        registered: row.registered,
        registration: row.registration,
        berthKind: row.berth_kind,
        engineHours: row.engine_hours,
        location: row.location,
        serviceSite: row.service_site,
        boatName: row.boat_name,
        colorCode: row.color_code,
        tier: row.tier,
        zones: row.zones || [],
        antifoulingColor: row.antifouling_color,
        estimate: row.estimate,
        options: row.options,
        firstName: row.first_name,
        lastName: row.last_name,
        phone: row.phone,
        email: row.email,
        notes: row.notes,
        // The codes of who holds it; server.js adds the names.
        occupiedBy: row.occupied_by || [],
    };
}

/** Every open request plus the newest 200 finished ones, newest first, optionally of one status. */
async function listRequests(status) {
    const { rows } = await query(
        `SELECT ${STAFF_COLUMNS}
           FROM requests
          WHERE ($1::text IS NULL OR status = $1)
            AND (status <> ALL($2::text[]) OR id IN (
                    SELECT id FROM requests
                     WHERE status = ANY($2::text[]) AND ($1::text IS NULL OR status = $1)
                     ORDER BY created_at DESC LIMIT 200))
          ORDER BY created_at DESC`,
        [status || null, FINISHED]
    );
    return rows.map(mapStaffRequest);
}

/** The boats somebody holds, for the team screen and the owner's monitor. */
async function listOccupied() {
    const { rows } = await query(
        `SELECT id, created_at, builder, model, boat_name, status, occupied_by
           FROM requests
          WHERE cardinality(occupied_by) > 0
          ORDER BY created_at DESC
          LIMIT 500`
    );
    return rows.map((row) => ({
        id: row.id.trim(),
        createdAt: row.created_at,
        builder: row.builder,
        model: row.model,
        boatName: row.boat_name,
        status: row.status,
        occupiedBy: row.occupied_by || [],
    }));
}

/* Changes a status, but only while somebody holds the boat, so the log can say
 * whose hands it was in (the session is the whole shop's). Check and change in
 * one statement: `cur` locks the row and reports who held it. A finished
 * status also releases the boat from both holders.
 * Returns { ok, id, status, occupiedBy, holdersBefore } or { ok: false, reason: 'not_found' | 'free' }. */
async function updateRequestStatus(id, status) {
    const { rows } = await query(
        `WITH cur AS (
             SELECT id, occupied_by FROM requests WHERE id = $1 FOR UPDATE
         ), upd AS (
             UPDATE requests r
                SET status = $2,
                    occupied_by = CASE WHEN $2 = ANY($3::text[]) THEN '{}'::text[] ELSE r.occupied_by END
               FROM cur
              WHERE r.id = cur.id AND cardinality(cur.occupied_by) > 0
          RETURNING r.id, r.status, r.occupied_by
         )
         SELECT cur.occupied_by AS holders, upd.id, upd.status, upd.occupied_by
           FROM cur LEFT JOIN upd ON true`,
        [id, status, FINISHED]
    );
    if (rows.length === 0) return { ok: false, reason: 'not_found' };
    const row = rows[0];
    if (!row.id) return { ok: false, reason: 'free' };
    return { ok: true, id: row.id.trim(), status: row.status, occupiedBy: row.occupied_by || [], holdersBefore: row.holders || [] };
}

// Two people at most on one boat. The column CHECKs the same number.
const MAX_HOLDERS = 2;

/* Gives a boat to a worker, if they are on shift and there is room. Counted
 * inside the statement that adds, so two people asking at once cannot both
 * take the last place. Taking what one already holds is fine.
 * Returns { ok: true, occupiedBy } or { ok: false, reason: 'not_found' | 'off_shift' | 'full', occupiedBy }. */
async function occupyRequest(id, workerId) {
    const { rows } = await query(
        `WITH cur AS (
             SELECT id, occupied_by FROM requests WHERE id = $1 FOR UPDATE
         ), shift AS (
             SELECT EXISTS (SELECT 1 FROM work_shifts WHERE worker_id = $2 AND ended_at IS NULL) AS on_shift
         ), upd AS (
             UPDATE requests r SET occupied_by = r.occupied_by || $2::text
               FROM cur, shift
              WHERE r.id = cur.id
                AND NOT (cur.occupied_by @> ARRAY[$2::text])
                AND cardinality(cur.occupied_by) < $3
                AND shift.on_shift
          RETURNING r.id, r.occupied_by
         )
         SELECT cur.occupied_by AS holders, shift.on_shift, upd.id, upd.occupied_by AS taken
           FROM cur CROSS JOIN shift LEFT JOIN upd ON true`,
        [id, workerId, MAX_HOLDERS]
    );
    if (rows.length === 0) return { ok: false, reason: 'not_found' };
    const row = rows[0];
    if (row.id) return { ok: true, occupiedBy: row.taken || [] };
    const holders = row.holders || [];
    if (holders.indexOf(workerId) !== -1) return { ok: true, occupiedBy: holders };
    if (!row.on_shift) return { ok: false, reason: 'off_shift', occupiedBy: holders };
    return { ok: false, reason: 'full', occupiedBy: holders };
}

/* Takes a worker off a boat. Needs no shift (ending the day leaves the holds),
 * and is fine when they did not hold it. Returns { ok, occupiedBy } or { ok: false } when the code does not exist. */
async function releaseRequest(id, workerId) {
    const { rows } = await query(
        `WITH cur AS (
             SELECT id, occupied_by FROM requests WHERE id = $1 FOR UPDATE
         ), upd AS (
             UPDATE requests r SET occupied_by = array_remove(r.occupied_by, $2::text)
               FROM cur
              WHERE r.id = cur.id AND cur.occupied_by @> ARRAY[$2::text]
          RETURNING r.id, r.occupied_by
         )
         SELECT cur.occupied_by AS holders, upd.id, upd.occupied_by AS left_with
           FROM cur LEFT JOIN upd ON true`,
        [id, workerId]
    );
    if (rows.length === 0) return { ok: false };
    const row = rows[0];
    return { ok: true, occupiedBy: (row.id ? row.left_with : row.holders) || [] };
}

/* ---- worker_notes: one note from the owner per worker ---- */

function mapNote(row) {
    return { workerId: row.worker_id, note: row.note, writtenBy: row.written_by, updatedAt: row.updated_at };
}

async function listWorkerNotes() {
    const { rows } = await query('SELECT worker_id, note, written_by, updated_at FROM worker_notes');
    return rows.map(mapNote);
}

// updated_at is set here: the DEFAULT only applies to the INSERT half of an upsert.
async function setWorkerNote(workerId, note, writtenBy) {
    const { rows } = await query(
        `INSERT INTO worker_notes (worker_id, note, written_by) VALUES ($1, $2, $3)
         ON CONFLICT (worker_id) DO UPDATE
                 SET note = EXCLUDED.note, written_by = EXCLUDED.written_by, updated_at = now()
           RETURNING worker_id, note, written_by, updated_at`,
        [workerId, note, writtenBy]
    );
    return mapNote(rows[0]);
}

async function clearWorkerNote(workerId) {
    await query('DELETE FROM worker_notes WHERE worker_id = $1', [workerId]);
}

/* ---- work_shifts ----
 * Shorter than SHIFT_MIN_SECONDS a shift is not kept (a start tapped by
 * mistake). An open one that reaches SHIFT_MAX_SECONDS, or is still open at
 * SHIFT_CLOSE_HOUR in Rome, is closed by the server and left «da completare»
 * for the owner. */
const SHIFT_MIN_SECONDS = 5 * 60;
const SHIFT_MAX_SECONDS = 12 * 60 * 60;
// The longest the owner can make a shift when he completes one.
const SHIFT_LONGEST_SECONDS = 16 * 60 * 60;
const SHIFT_CLOSE_HOUR = 23;
const SHIFT_TIME_ZONE = 'Europe/Rome';

// The first SHIFT_CLOSE_HOUR o'clock in Rome strictly after started_at, worked
// in Rome wall-clock time and turned back into an instant. Both constants are
// literals of this file, never input.
const SHIFT_CUTOFF = `((date_trunc('day', (started_at AT TIME ZONE '${SHIFT_TIME_ZONE}')
                                    - make_interval(hours => ${SHIFT_CLOSE_HOUR}))
                        + make_interval(days => 1, hours => ${SHIFT_CLOSE_HOUR}))
                       AT TIME ZONE '${SHIFT_TIME_ZONE}')`;
// Whichever comes first, the 12 h or 23:00. $1 is SHIFT_MAX_SECONDS.
const SHIFT_AUTO_END = `LEAST(${SHIFT_CUTOFF}, started_at + make_interval(secs => $1))`;
// integer, not bigint: pg hands bigint back as a string.
const SHIFT_SECONDS = `floor(extract(epoch FROM (coalesce(ended_at, now()) - started_at)))::integer`;
const SHIFT_COLUMNS = `id, worker_id, started_at, ended_at, closed_by, auto_closed_at, ${SHIFT_SECONDS} AS seconds`;
const SHIFT_PENDING = `auto_closed_at IS NOT NULL AND closed_by IS NULL`;

function mapShift(row) {
    const autoClosed = row.auto_closed_at !== null && row.auto_closed_at !== undefined;
    return {
        id: Number(row.id),
        workerId: row.worker_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        open: row.ended_at === null,
        seconds: row.seconds,
        closedBy: row.closed_by,
        autoClosed,
        pending: autoClosed && row.closed_by === null,
    };
}

/* The two automatic rules in one statement: close what reached 12 h or 23:00
 * (marked auto_closed_at, waiting for the owner), and delete closed shifts
 * under 5 minutes. Run before every shift read or write, so the rules hold
 * whenever anybody looks, with no timer keeping Neon awake. */
async function tidyShifts() {
    const { rows } = await query(
        `WITH expired AS (
             UPDATE work_shifts
                SET ended_at = ${SHIFT_AUTO_END}, auto_closed_at = now()
              WHERE ended_at IS NULL
                AND now() >= ${SHIFT_AUTO_END}
                AND ${SHIFT_AUTO_END} - started_at >= make_interval(secs => $2)
          RETURNING id, worker_id
         ), dropped AS (
             DELETE FROM work_shifts
              WHERE (ended_at IS NOT NULL AND ended_at - started_at < make_interval(secs => $2))
                 OR (ended_at IS NULL
                     AND now() >= ${SHIFT_AUTO_END}
                     AND ${SHIFT_AUTO_END} - started_at < make_interval(secs => $2))
          RETURNING id
         )
         SELECT 'expired' AS kind, id, worker_id FROM expired
         UNION ALL
         SELECT 'dropped', id, NULL FROM dropped`,
        [SHIFT_MAX_SECONDS, SHIFT_MIN_SECONDS]
    );
    return {
        expired: rows.filter((row) => row.kind === 'expired').map((row) => ({ id: Number(row.id), workerId: row.worker_id })),
        dropped: rows.filter((row) => row.kind === 'dropped').length,
    };
}

async function findOpenShift(workerId) {
    const { rows } = await query(`SELECT ${SHIFT_COLUMNS} FROM work_shifts WHERE worker_id = $1 AND ended_at IS NULL`, [workerId]);
    return rows.length > 0 ? mapShift(rows[0]) : null;
}

// Each worker's newest shift when the server closed it and the owner has not
// completed it: the team screen says why that worker is off.
async function listNewestPendingShifts() {
    const { rows } = await query(
        `SELECT ${SHIFT_COLUMNS}
           FROM (SELECT DISTINCT ON (worker_id) * FROM work_shifts ORDER BY worker_id, started_at DESC, id DESC) newest
          WHERE ${SHIFT_PENDING}`
    );
    return rows.map(mapShift);
}

/* Idempotent: the unique index allows one open shift, so a second tap gets the
 * running one back with its original start. Returns { started, shift }. */
async function startShift(workerId) {
    const { rows } = await query(
        `INSERT INTO work_shifts (worker_id) VALUES ($1)
         ON CONFLICT (worker_id) WHERE ended_at IS NULL DO NOTHING
           RETURNING ${SHIFT_COLUMNS}`,
        [workerId]
    );
    if (rows.length > 0) return { started: true, shift: mapShift(rows[0]) };
    return { started: false, shift: await findOpenShift(workerId) };
}

/* Idempotent as well: none open is { ended: false }. Under SHIFT_MIN_SECONDS
 * it is deleted instead ({ ended: true, discarded: true }). */
async function endShift(workerId) {
    const dropped = await query(
        `DELETE FROM work_shifts
          WHERE worker_id = $1 AND ended_at IS NULL AND now() - started_at < make_interval(secs => $2)
      RETURNING ${SHIFT_COLUMNS}`,
        [workerId, SHIFT_MIN_SECONDS]
    );
    if (dropped.rows.length > 0) return { ended: true, discarded: true, shift: mapShift(dropped.rows[0]) };
    const { rows } = await query(
        `UPDATE work_shifts SET ended_at = now() WHERE worker_id = $1 AND ended_at IS NULL RETURNING ${SHIFT_COLUMNS}`,
        [workerId]
    );
    return rows.length > 0
        ? { ended: true, discarded: false, shift: mapShift(rows[0]) }
        : { ended: false, discarded: false, shift: null };
}

// Whether the end given ($2, or now()) would pass the start of the same worker's later shift.
const OVERLAPS_LATER = `EXISTS (
                SELECT 1 FROM work_shifts later
                 WHERE later.worker_id = work_shifts.worker_id
                   AND later.id <> work_shifts.id
                   AND later.started_at >= work_shifts.started_at
                   AND later.started_at < coalesce($2::timestamptz, now()))`;

/* The owner sets the end of a shift a worker forgot to end, or of one the
 * server closed (pending). `endedAt` is a Date, or null for «now» (open shifts
 * only). The database compares it with the start and now(). Returns
 * { closed: true, discarded, shift } or { closed: false, reason }: missing,
 * ended, early, future, long, overlap or now. */
async function closeShift(id, endedAt, bossId) {
    const closable = `id = $1
            AND (ended_at IS NULL OR (${SHIFT_PENDING}))
            AND ($2::timestamptz IS NOT NULL OR ended_at IS NULL)
            AND coalesce($2::timestamptz, now()) BETWEEN started_at AND now()
            AND coalesce($2::timestamptz, now()) - started_at <= make_interval(secs => $4)
            AND NOT ${OVERLAPS_LATER}`;
    const dropped = await query(
        `DELETE FROM work_shifts
          WHERE ${closable} AND coalesce($2::timestamptz, now()) - started_at < make_interval(secs => $3)
      RETURNING ${SHIFT_COLUMNS}`,
        [id, endedAt, SHIFT_MIN_SECONDS, SHIFT_LONGEST_SECONDS]
    );
    if (dropped.rows.length > 0) return { closed: true, discarded: true, shift: mapShift(dropped.rows[0]) };
    const { rows } = await query(
        `UPDATE work_shifts SET ended_at = coalesce($2::timestamptz, now()), closed_by = $3
          WHERE ${closable}
      RETURNING ${SHIFT_COLUMNS}`,
        [id, endedAt, bossId, SHIFT_LONGEST_SECONDS]
    );
    if (rows.length > 0) return { closed: true, discarded: false, shift: mapShift(rows[0]) };
    // Nothing changed: a second read only picks the message.
    const found = await query(
        `SELECT ended_at IS NOT NULL AND NOT (${SHIFT_PENDING}) AS ended,
                ${SHIFT_PENDING} AS pending,
                $2::timestamptz < started_at AS early,
                $2::timestamptz > now() AS future,
                $2::timestamptz - started_at > make_interval(secs => $3) AS long,
                ${OVERLAPS_LATER} AS overlap
           FROM work_shifts WHERE id = $1`,
        [id, endedAt, SHIFT_LONGEST_SECONDS]
    );
    if (found.rows.length === 0) return { closed: false, reason: 'missing' };
    const row = found.rows[0];
    if (row.ended) return { closed: false, reason: 'ended' };
    if (row.pending && endedAt === null) return { closed: false, reason: 'now' };
    for (const reason of ['early', 'future', 'long', 'overlap']) if (row[reason]) return { closed: false, reason };
    return { closed: false, reason: 'future' };
}

/* Every worker's latest `perWorker` shifts, newest first, with how many they have in all. */
async function listShifts(perWorker) {
    const { rows } = await query(
        `SELECT id, worker_id, started_at, ended_at, closed_by, auto_closed_at, seconds, total
           FROM (SELECT id, worker_id, started_at, ended_at, closed_by, auto_closed_at,
                        ${SHIFT_SECONDS} AS seconds,
                        row_number() OVER (PARTITION BY worker_id ORDER BY started_at DESC, id DESC) AS rn,
                        (count(*) OVER (PARTITION BY worker_id))::integer AS total
                   FROM work_shifts) s
          WHERE rn <= $1
          ORDER BY worker_id, started_at DESC, id DESC`,
        [perWorker]
    );
    return rows.map((row) => Object.assign(mapShift(row), { total: row.total }));
}

/* Every shift waiting for the owner, oldest first. */
async function listPendingShifts() {
    const { rows } = await query(
        `SELECT ${SHIFT_COLUMNS}
           FROM work_shifts WHERE ${SHIFT_PENDING} ORDER BY started_at, id`
    );
    return rows.map(mapShift);
}

/* Shifts that overlap today in Rome, for the team screen. */
async function listTodayShifts() {
    const { rows } = await query(
        // The day's end in Rome wall-clock time too: on the night the clocks go back the day lasts 25 h.
        `WITH day AS (
             SELECT date_trunc('day', now() AT TIME ZONE '${SHIFT_TIME_ZONE}') AT TIME ZONE '${SHIFT_TIME_ZONE}' AS start,
                    (date_trunc('day', now() AT TIME ZONE '${SHIFT_TIME_ZONE}') + interval '1 day') AT TIME ZONE '${SHIFT_TIME_ZONE}' AS stop
         )
         SELECT s.*
           FROM day
           JOIN (SELECT ${SHIFT_COLUMNS} FROM work_shifts) s
             ON s.started_at < day.stop
            AND coalesce(s.ended_at, now()) > day.start
          ORDER BY s.started_at, s.id`
    );
    return rows.map(mapShift);
}

/* Shifts that started between two Rome days (inclusive), for the attendance report. */
async function listShiftsBetween(fromDay, toDay) {
    const { rows } = await query(
        `SELECT ${SHIFT_COLUMNS}
           FROM work_shifts
          WHERE started_at >= $1::date::timestamp AT TIME ZONE '${SHIFT_TIME_ZONE}'
            AND started_at < ($2::date + 1)::timestamp AT TIME ZONE '${SHIFT_TIME_ZONE}'
          ORDER BY worker_id, started_at, id`,
        [fromDay, toDay]
    );
    return rows.map(mapShift);
}

/* ---- worker_settings: PIN hash and weekly schedule ---- */

async function listWorkerSettings() {
    // to_char: pg would turn a date into a Date at local midnight.
    const { rows } = await query(
        `SELECT worker_id, pin_hash, schedule, to_char(schedule_since, 'YYYY-MM-DD') AS schedule_since FROM worker_settings`
    );
    return rows.map((row) => ({ workerId: row.worker_id, pinHash: row.pin_hash, schedule: row.schedule, scheduleSince: row.schedule_since }));
}

/* Writes what is given and keeps the rest: undefined stays, null clears. A
 * first schedule starts today in Rome. */
async function putWorkerSettings(workerId, { pinHash, schedule }) {
    const today = `(now() AT TIME ZONE '${SHIFT_TIME_ZONE}')::date`;
    await query(
        `INSERT INTO worker_settings (worker_id, pin_hash, schedule, schedule_since)
              VALUES ($1, $2, $3::jsonb, CASE WHEN $3::jsonb IS NULL THEN NULL ELSE ${today} END)
         ON CONFLICT (worker_id) DO UPDATE
                 SET pin_hash = CASE WHEN $4 THEN EXCLUDED.pin_hash ELSE worker_settings.pin_hash END,
                     schedule = CASE WHEN $5 THEN EXCLUDED.schedule ELSE worker_settings.schedule END,
                     schedule_since = CASE
                         WHEN NOT $5 THEN worker_settings.schedule_since
                         WHEN EXCLUDED.schedule IS NULL THEN NULL
                         ELSE coalesce(worker_settings.schedule_since, ${today})
                     END,
                     updated_at = now()`,
        [
            workerId,
            pinHash === undefined ? null : pinHash,
            schedule === undefined || schedule === null ? null : JSON.stringify(schedule),
            pinHash !== undefined,
            schedule !== undefined,
        ]
    );
}

/* ---- board_notes: the shop's «Cose da fare» ---- */

// A ceiling, not pagination: a list nobody ticks must not grow the answer for ever.
const BOARD_LIMIT = 200;

function mapBoardNote(row) {
    return { id: Number(row.id), to: row.to_worker, from: row.from_worker, text: row.note, createdAt: row.created_at };
}

async function listBoardNotes() {
    const { rows } = await query(
        `SELECT id, to_worker, from_worker, note, created_at FROM board_notes
          WHERE done_at IS NULL ORDER BY created_at DESC, id DESC LIMIT ${BOARD_LIMIT}`
    );
    return rows.map(mapBoardNote);
}

async function createBoardNote(to, from, note) {
    const { rows } = await query(
        `INSERT INTO board_notes (to_worker, from_worker, note) VALUES ($1, $2, $3)
           RETURNING id, to_worker, from_worker, note, created_at`,
        [to, from, note]
    );
    return mapBoardNote(rows[0]);
}

// Idempotent: coalesce keeps the first time it was ticked. null when there is no such note.
async function markBoardNoteDone(id) {
    const { rows } = await query(
        `UPDATE board_notes SET done_at = coalesce(done_at, now()) WHERE id = $1 RETURNING id, done_at`,
        [id]
    );
    return rows.length > 0 ? { id: Number(rows[0].id), doneAt: rows[0].done_at } : null;
}

/* ---- worker_photos: the team cards' faces ---- */

// workerId -> version (ms of the last change), for the photo's address: a new
// photo is a new address, so the old one can be cached for good.
async function listPhotoVersions() {
    let rows;
    try {
        ({ rows } = await query(`SELECT worker_id, (extract(epoch FROM updated_at) * 1000)::bigint AS version FROM worker_photos`));
    } catch (err) {
        // 42P01: the table is not there yet (schema.sql not applied). Initials
        // for everybody, rather than a shop screen down over the photos.
        if (err.code !== '42P01') throw err;
        return new Map();
    }
    return new Map(rows.map((row) => [row.worker_id, String(row.version)]));
}

async function getWorkerPhoto(workerId) {
    const { rows } = await query(`SELECT image, mime FROM worker_photos WHERE worker_id = $1`, [workerId]);
    return rows.length > 0 ? { image: rows[0].image, mime: rows[0].mime } : null;
}

async function setWorkerPhoto(workerId, image, mime) {
    const { rows } = await query(
        `INSERT INTO worker_photos (worker_id, image, mime) VALUES ($1, $2, $3)
         ON CONFLICT (worker_id) DO UPDATE SET image = EXCLUDED.image, mime = EXCLUDED.mime, updated_at = now()
         RETURNING (extract(epoch FROM updated_at) * 1000)::bigint AS version`,
        [workerId, image, mime]
    );
    return String(rows[0].version);
}

async function clearWorkerPhoto(workerId) {
    await query(`DELETE FROM worker_photos WHERE worker_id = $1`, [workerId]);
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

module.exports = {
    createRequest, findRequest, ping, describe, pool, DATABASE_URL, unreachable,
    listRequests, listOccupied, updateRequestStatus, occupyRequest, releaseRequest,
    listWorkerNotes, setWorkerNote, clearWorkerNote,
    tidyShifts, listNewestPendingShifts, startShift, endShift, closeShift, listShifts, listPendingShifts,
    listTodayShifts, listShiftsBetween,
    SHIFT_MIN_SECONDS, SHIFT_MAX_SECONDS, SHIFT_LONGEST_SECONDS, SHIFT_CLOSE_HOUR,
    listWorkerSettings, putWorkerSettings,
    listBoardNotes, createBoardNote, markBoardNoteDone,
    listPhotoVersions, getWorkerPhoto, setWorkerPhoto, clearWorkerPhoto,
};

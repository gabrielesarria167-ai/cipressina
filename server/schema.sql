-- =============================================================================
-- Cipressina Barche: schema of the requests database (Neon)
--
--     npm run db:migrate          # applies this file to DATABASE_URL
--
-- Idempotent: it can be applied again without losing data. When a CHECK list
-- changes, add an ALTER below: CREATE TABLE IF NOT EXISTS does not touch an
-- existing table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS requests (
    -- The 10-digit tracking code. Random, not sequential (server/db.js): it is
    -- the only credential for the lookup, and neighbouring numbers must not
    -- lead to other customers' requests.
    id                char(10)     PRIMARY KEY CHECK (id ~ '^[1-9][0-9]{9}$'),
    created_at        timestamptz  NOT NULL DEFAULT now(),

    -- The workshop's stages, as STATUSES in src/zones.js (test/server.test.js
    -- checks the two match). Each has a label in src/i18n.js (status.<id>).
    -- PLACEHOLDER vocabulary until the owner confirms it.
    status            text         NOT NULL DEFAULT 'ricevuta'
                                   CHECK (status IN ('ricevuta', 'alaggio', 'trasporto', 'preparazione',
                                                     'verniciatura', 'antivegetativa', 'varo', 'pronta',
                                                     'consegnata', 'annullata')),
    lang              text         NOT NULL CHECK (lang IN ('it', 'en', 'es', 'fr')),

    -- Step 1: the boat. Ids as in src/zones.js (TYPES, BY_TYPE, SWATCHES).
    boat_type         text         NOT NULL CHECK (boat_type IN ('gommone', 'open', 'cabinato', 'yacht', 'vela')),
    builder           text         NOT NULL,
    model             text         NOT NULL,
    model_year        integer      NOT NULL CHECK (model_year BETWEEN 1950 AND 2100),
    loa               numeric(4,2) NOT NULL CHECK (loa BETWEEN 2.5 AND 30),
    registered        text         NOT NULL CHECK (registered IN ('registrata', 'natante')),
    registration      text,
    berth_kind        text         NOT NULL CHECK (berth_kind IN ('acqua', 'terra', 'carrello')),
    engine_hours      integer      CHECK (engine_hours BETWEEN 0 AND 99999),
    location          text,
    -- Body shop (Olmo di Martellago) or shipyard, as the wizard derived it from
    -- the length (SHOP_MAX_LOA in src/app.js).
    service_site      text         CHECK (service_site IN ('carrozzeria', 'cantiere')),
    boat_name         text,
    color_code        text,

    -- Steps 2 and 3: the package and the zones picked on the 3D model.
    tier              text         NOT NULL CHECK (tier IN ('base', 'completo', 'premium', 'nessuno')),
    zones             text[]       NOT NULL DEFAULT '{}',
    antifouling_color text,
    -- The estimate the customer saw, recomputed by the server with
    -- src/zones.js at the moment of sending: { package, subtotal, priced,
    -- rate, discount, total, unpriced, placeholder }. Kept because the price
    -- list will change and the shop must know what this customer was quoted.
    estimate          jsonb        NOT NULL,

    -- Step 4 (names are asked in step 1).
    first_name        text         NOT NULL CHECK (length(btrim(first_name)) > 0),
    last_name         text         NOT NULL CHECK (length(btrim(last_name)) > 0),
    phone             text         NOT NULL CHECK (phone ~ '^\+[0-9]{8,15}$'),
    email             text         NOT NULL,
    notes             text
);

-- The workshop's list, newest first.
CREATE INDEX IF NOT EXISTS requests_created_at_idx ON requests (created_at DESC);

-- =============================================================================
-- The workshop panel (pgs/officina.html). Ported from autocolor's attendance
-- branch: who is working which boat, shifts, schedules and PINs, the shared
-- to-do list and the owner's notes to each worker.
--
-- No foreign keys to people: the roster lives in the environment
-- (CIPRESSINA_WORKER_IDS, see server/auth.js), not in a table. The CHECK on
-- the code shape (two letters, five digits) keeps typos out, and nothing is
-- deleted when somebody leaves the roster, so their history stays.
-- =============================================================================

-- Who has the boat in hand, by code, empty when nobody does. Two at most: a
-- pair works one boat. The CHECK reads the array joined by commas (a subquery
-- is not allowed in a CHECK); array_position keeps out a stray NULL, and the
-- comparison stops one person holding it twice.
ALTER TABLE requests ADD COLUMN IF NOT EXISTS occupied_by text[] NOT NULL DEFAULT '{}';
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_occupied_by_check;
ALTER TABLE requests ADD CONSTRAINT requests_occupied_by_check
    CHECK (cardinality(occupied_by) <= 2
           AND array_position(occupied_by, NULL) IS NULL
           AND (cardinality(occupied_by) < 2 OR occupied_by[1] <> occupied_by[2])
           AND array_to_string(occupied_by, ',') ~ '^([A-Z]{2}[0-9]{5}(,[A-Z]{2}[0-9]{5})?)?$');

-- What the owner has told each worker: one note per worker, so writing
-- replaces. Shown pinned on the shop's «Cose da fare» list.
CREATE TABLE IF NOT EXISTS worker_notes (
    worker_id  text        PRIMARY KEY CHECK (worker_id ~ '^[A-Z]{2}[0-9]{5}$'),
    note       text        NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 500),
    written_by text        NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- A worker's shift («turno»), NOT a login: logging out leaves it running.
-- Both instants come from the database's now(), never from a browser; the
-- length is derived from them. ended_at NULL means open, and the partial
-- unique index below allows one open shift per worker.
--
-- closed_by: the owner's code when he closed it for a worker who forgot.
-- auto_closed_at: when the server closed it itself (12 h, or 23:00 in Rome);
-- until the owner gives the real end (closed_by set) it is «da completare».
CREATE TABLE IF NOT EXISTS work_shifts (
    id             bigserial   PRIMARY KEY,
    worker_id      text        NOT NULL CHECK (worker_id ~ '^[A-Z]{2}[0-9]{5}$'),
    started_at     timestamptz NOT NULL DEFAULT now(),
    ended_at       timestamptz CHECK (ended_at IS NULL OR ended_at >= started_at),
    closed_by      text,
    auto_closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS work_shifts_pending_idx
    ON work_shifts (started_at) WHERE auto_closed_at IS NOT NULL AND closed_by IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS work_shifts_one_open_per_worker_idx
    ON work_shifts (worker_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS work_shifts_worker_started_idx
    ON work_shifts (worker_id, started_at DESC);

-- Each worker's 4-digit PIN (salt:hash from scrypt, server/auth.js; NULL = no
-- PIN) and weekly schedule: seven entries, index = weekday with 0 Sunday, each
-- null (day off) or {"from":"08:00","to":"17:00"} in Rome time. Days before
-- schedule_since are not measured, so a schedule set on Thursday makes no
-- absences on Monday.
CREATE TABLE IF NOT EXISTS worker_settings (
    worker_id      text        PRIMARY KEY CHECK (worker_id ~ '^[A-Z]{2}[0-9]{5}$'),
    pin_hash       text,
    schedule       jsonb       CHECK (schedule IS NULL OR jsonb_array_length(schedule) = 7),
    schedule_since date,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- The shop's «Cose da fare»: to_worker NULL is «Tutti». A note ticked off is
-- kept (done_at), never deleted, so a mis-tap loses nothing.
CREATE TABLE IF NOT EXISTS board_notes (
    id          bigserial   PRIMARY KEY,
    to_worker   text        CHECK (to_worker ~ '^[A-Z]{2}[0-9]{5}$'),
    from_worker text        NOT NULL CHECK (from_worker ~ '^[A-Z]{2}[0-9]{5}$'),
    note        text        NOT NULL CHECK (length(btrim(note)) BETWEEN 1 AND 200),
    created_at  timestamptz NOT NULL DEFAULT now(),
    done_at     timestamptz CHECK (done_at IS NULL OR done_at >= created_at)
);
CREATE INDEX IF NOT EXISTS board_notes_open_idx ON board_notes (created_at DESC) WHERE done_at IS NULL;

-- Each worker's photo for the team cards, set by the owner. In the database
-- and not in the repository, which is public: it only leaves the server to a
-- signed-in session (GET /api/staff/photo/:code). A 480x600 crop, made in
-- the owner's browser, so a few tens of KB.
CREATE TABLE IF NOT EXISTS worker_photos (
    worker_id  text        PRIMARY KEY CHECK (worker_id ~ '^[A-Z]{2}[0-9]{5}$'),
    image      bytea       NOT NULL CHECK (octet_length(image) <= 307200),
    mime       text        NOT NULL CHECK (mime IN ('image/webp', 'image/jpeg')),
    updated_at timestamptz NOT NULL DEFAULT now()
);

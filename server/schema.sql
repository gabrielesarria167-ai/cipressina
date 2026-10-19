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

    -- The workshop's stages. Each has a label in src/i18n.js (status.<id>).
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

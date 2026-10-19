'use strict';

/* =============================================================================
   Checks a request body from the wizard (src/app.js buildPayload) and turns
   it into the row server/db.js writes, or throws a BadRequest naming the
   first thing wrong. The browser validates too, but anyone can call the API
   directly. The rules mirror defineRules() in src/app.js; the ids come from
   src/zones.js, loaded here so the two sides cannot disagree.

   Messages are Italian: the page shows its own translated text per status
   code, so these are for the API caller and the log.
   ========================================================================== */

require('../src/zones.js');
const Z = globalThis.CIPRESSINA_ZONES;

// `code`, when given, travels with the message for the few answers a page acts on.
class HttpError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

class BadRequest extends HttpError {
    constructor(message) {
        super(400, message);
    }
}

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const LANGS = new Set(['it', 'en', 'es', 'fr']);
const REGISTERED = new Set(['registrata', 'natante']);
const BERTHS = new Set(['acqua', 'terra', 'carrello']);
const SITES = new Set(['carrozzeria', 'cantiere']);
const SWATCH_IDS = new Set(Z.SWATCHES.map((swatch) => swatch.id));
const YEAR_MIN = 1950;
const LOA_MIN = 2.5;
const LOA_MAX = 30;
const HOURS_MAX = 99999;
// The wizard sends Italian numbers with +39 already added, foreign ones with their own prefix.
const PHONE_RE = /^\+[0-9]{8,15}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const REGISTRATION_RE = /^[A-Z0-9][A-Z0-9 ]{2,14}$/;

// Empty or whitespace-only becomes null, never '', so the table holds real values or NULL.
function text(value, { max, required = false, field }) {
    if (value === undefined || value === null || value === '') {
        if (required) throw new BadRequest(`Manca ${field}.`);
        return null;
    }
    if (typeof value !== 'string') throw new BadRequest(`Valore non valido: ${field}.`);
    // Postgres refuses NUL in text; caught here it is a 400, not a 500 that «try again» never fixes.
    if (value.includes('\u0000')) throw new BadRequest(`Valore non valido: ${field}.`);
    const trimmed = value.trim();
    if (required && trimmed === '') throw new BadRequest(`Manca ${field}.`);
    if (trimmed.length > max) throw new BadRequest(`Testo troppo lungo: ${field}.`);
    return trimmed === '' ? null : trimmed;
}

function integer(value, { min, max, required = false, field }) {
    if (value === undefined || value === null || value === '') {
        if (required) throw new BadRequest(`Manca ${field}.`);
        return null;
    }
    const number = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new BadRequest(`Valore non valido: ${field}.`);
    }
    return number;
}

function oneOf(set, value, field) {
    if (!set.has(value)) throw new BadRequest(`Valore non valido: ${field}.`);
    return value;
}

function validateRequest(body) {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        throw new BadRequest('Il corpo della richiesta non è valido.');
    }

    const boatType = body.boatType;
    if (typeof boatType !== 'string' || !has(Z.BY_TYPE, boatType)) throw new BadRequest('Tipo di barca non valido.');
    const tier = oneOf(new Set(Z.PACKAGE_CHOICES), body.tier, 'il pacchetto');

    // Zones must belong to this boat type's model; order and duplicates are the client's business.
    if (!Array.isArray(body.zones)) throw new BadRequest('Zone non valide.');
    const allowed = new Set(Z.BY_TYPE[boatType]);
    const zones = [...new Set(body.zones)];
    if (zones.some((zone) => typeof zone !== 'string' || !allowed.has(zone))) throw new BadRequest('Zona non valida.');
    if (tier === Z.NO_PACKAGE && zones.length === 0) throw new BadRequest('Scegli almeno una zona o un pacchetto.');

    // The colour only means something while the bottom is one of the zones.
    let antifoulingColor = null;
    if (zones.includes('bottom') && body.antifoulingColor != null && body.antifoulingColor !== '') {
        antifoulingColor = oneOf(SWATCH_IDS, body.antifoulingColor, 'il colore antivegetativa');
    }

    const loa = typeof body.loa === 'number' ? body.loa : NaN;
    if (!Number.isFinite(loa) || loa < LOA_MIN || loa > LOA_MAX) throw new BadRequest('Lunghezza non valida.');

    const registered = oneOf(REGISTERED, body.registered, 'immatricolazione');
    let registration = null;
    if (registered === 'registrata') {
        registration = text(body.registration, { max: 15, required: true, field: 'la sigla di immatricolazione' }).toUpperCase();
        if (!REGISTRATION_RE.test(registration)) throw new BadRequest('Sigla di immatricolazione non valida.');
    }

    const phone = text(body.phone, { max: 16, required: true, field: 'il telefono' });
    if (!PHONE_RE.test(phone)) throw new BadRequest('Telefono non valido.');
    const email = text(body.email, { max: 254, required: true, field: "l'email" });
    if (!EMAIL_RE.test(email)) throw new BadRequest('Email non valida.');

    const builder = text(body.builder, { max: 60, required: true, field: 'il cantiere' });
    if (builder.length < 2) throw new BadRequest('Cantiere non valido.');

    const rounded = Math.round(loa * 100) / 100;
    return {
        lang: LANGS.has(body.lang) ? body.lang : 'it',
        boatType,
        builder,
        model: text(body.model, { max: 60, required: true, field: 'il modello' }),
        year: integer(body.year, { min: YEAR_MIN, max: new Date().getFullYear() + 1, required: true, field: "l'anno" }),
        loa: rounded,
        registered,
        registration,
        berthKind: oneOf(BERTHS, body.berthKind, 'dove si trova la barca'),
        engineHours: integer(body.engineHours, { min: 0, max: HOURS_MAX, field: 'le ore motore' }),
        location: text(body.location, { max: 80, field: 'il porto o la località' }),
        serviceSite: body.serviceSite == null ? null : oneOf(SITES, body.serviceSite, 'il luogo del lavoro'),
        boatName: text(body.boatName, { max: 40, field: 'il nome della barca' }),
        colorCode: text(body.colorCode, { max: 20, field: 'il codice colore' }),
        tier,
        zones,
        antifoulingColor,
        // The server's own figure, not the page's: a page left open across a
        // price change, or an edited request, must not set the quote.
        estimate: Z.estimate(zones, tier, rounded),
        firstName: text(body.firstName, { max: 80, required: true, field: 'il nome' }),
        lastName: text(body.lastName, { max: 80, required: true, field: 'il cognome' }),
        phone,
        email,
        notes: text(body.notes, { max: 2000, field: 'le note' }),
    };
}

// The decoded photo; the browser sends a 480x600 crop, far under it.
const MAX_PHOTO_BYTES = 300 * 1024;
// A data: URL of an image, and the first bytes that prove it is one.
const PHOTO_DATA_RE = /^data:(image\/(?:webp|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/;
const PHOTO_MAGIC = {
    'image/webp': (b) => b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP',
    'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
};

/** A worker's photo as the owner's page sends it (a data: URL) -> { image, mime }, or BadRequest. */
function validatePhoto(value) {
    const match = typeof value === 'string' ? PHOTO_DATA_RE.exec(value) : null;
    const image = match ? Buffer.from(match[2], 'base64') : null;
    if (!image || !PHOTO_MAGIC[match[1]](image)) throw new BadRequest('La foto va inviata come immagine WebP o JPEG.');
    if (image.length > MAX_PHOTO_BYTES) throw new BadRequest('La foto è troppo grande.');
    return { image, mime: match[1] };
}

module.exports = { validateRequest, validatePhoto, MAX_PHOTO_BYTES, text, HttpError, BadRequest };

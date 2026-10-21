'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, BadRequest } = require('../server/validate');

// What src/app.js buildPayload() sends for a complete request.
function payload(extra) {
    return Object.assign({
        lang: 'it', boatType: 'cabinato', tier: 'completo', zones: ['bottom', 'topside_port'],
        antifoulingColor: 'rosso', builder: 'Beneteau', model: 'Antares 8', year: 2015, loa: 8.5, beam: 3,
        registered: 'registrata', berthKind: 'acqua', registration: 've 1234 d', engineHours: null,
        location: '', serviceSite: 'cantiere', boatName: '', colorCode: '',
        firstName: 'Mario', lastName: 'Rossi', phone: '+393331234567', email: 'mario@example.it', notes: '',
    }, extra);
}

test('a complete request becomes a row, with the server computing the estimate', () => {
    const row = validateRequest(payload());
    assert.equal(row.registration, 'VE 1234 D');
    assert.equal(row.location, null);
    assert.equal(row.engineHours, null);
    assert.equal(row.beam, 3);
    assert.deepEqual(row.zones, ['bottom', 'topside_port']);
    assert.deepEqual(row.options, { finish: 'pastello', repair: 'stuccature', bottomWork: 'antivegetativa', nonSlip: false, hardware: false });
    // completo 55 €/m × 8.5 = 468; bottom (antifouling) 120 × 8.5 = 1020;
    // topside 8.5 × (8.5 × 0.11 freeboard) = 7.9475 m² × 300 = 2384; no discount.
    assert.equal(row.estimate.package, 468);
    assert.equal(row.estimate.subtotal, 1020 + 2384);
    assert.equal(row.estimate.custom, false);
    assert.equal(row.estimate.total, 468 + 1020 + 2384);
});

// The estimate of a request with no package, so the zones alone are in the total.
const total = (extra) => validateRequest(payload(Object.assign({ tier: 'nessuno' }, extra))).estimate.total;

test('metallic finish and non-slip add 25 % each to the base rate, not compounded', () => {
    // topside 7.9475 m² × 300 × 1.25 = 2980; deck 8.5 × 3 × 0.75 = 19.125 m² × 400 × 1.5 = 11475.
    const options = { finish: 'metallizzato', nonSlip: true };
    assert.equal(total({ zones: ['topside_port', 'deck'], options }), 2980 + 11475);
    // The non-slip applies to the deck only, the metallic to the topside too.
    assert.equal(total({ zones: ['topside_port'], options }), 2980);
});

test('moderate resin repair adds 25 % to the painted zones, not to the bottom', () => {
    const options = { repair: 'resinatura' };
    assert.equal(total({ zones: ['topside_port'], options }), 2980);
    assert.equal(total({ zones: ['bottom'], options }), 1020);
});

test('antifouling is 120 € per metre of LOA, 144 € above 10 m', () => {
    assert.equal(total({ zones: ['bottom'], loa: 9 }), 1080);
    assert.equal(total({ zones: ['bottom'], loa: 10 }), 1200);
    assert.equal(total({ zones: ['bottom'], loa: 12, beam: 3.5 }), 1728);
});

test('sandblasting is 400 € per m² of underwater area', () => {
    const options = { bottomWork: 'sabbiatura' };
    assert.equal(total({ zones: ['bottom'], options }), 8670);              // 8.5 × 3 × 0.85 = 21.675 m²
});

test('heavy repairs on a painted zone make the quote custom, with no total', () => {
    const options = { repair: 'gravose' };
    const row = validateRequest(payload({ options }));
    assert.equal(row.estimate.custom, true);
    assert.equal(row.estimate.total, null);
    // Only the bottom: nothing painted, so the price stands.
    const bottomOnly = validateRequest(payload({ zones: ['bottom'], options }));
    assert.equal(bottomOnly.estimate.custom, false);
    assert.equal(bottomOnly.estimate.total, 468 + 1020);
});

test('a price sent by the page is ignored', () => {
    assert.equal(validateRequest(payload({ estimate: { total: 1 } })).estimate.total > 1, true);
});

test('what the wizard would refuse, the server refuses', () => {
    const bad = [
        { boatType: 'constructor' },
        { tier: 'gratis' },
        { zones: ['flybridge'] },               // not a zone of a cabinato
        { zones: 'bottom' },
        { tier: 'nessuno', zones: [] },
        { loa: '8,5' },
        { loa: 31 },
        { beam: undefined },
        { beam: '3' },
        { beam: 0.5 },
        { beam: 9 },
        { beam: 8.5 },                          // not less than the length
        { options: 'gravose' },
        { options: { finish: 'lucido' } },
        { options: { repair: 'nessuna' } },
        { options: { bottomWork: 'sabbia' } },
        { options: { nonSlip: 'si' } },
        { options: { hardware: 1 } },
        { year: 1900 },
        { registered: 'registrata', registration: '' },
        { berthKind: 'luna' },
        { phone: '3331234567' },                // the page adds +39
        { email: 'mario@' },
        { firstName: '   ' },
        { builder: 'B' },
        { antifoulingColor: 'fucsia' },
        { notes: 'x'.repeat(2001) },
        { model: 'Antares\u00008' },        // Postgres refuses NUL
    ];
    for (const extra of bad) {
        assert.throws(() => validateRequest(payload(extra)), BadRequest, JSON.stringify(extra));
    }
    assert.throws(() => validateRequest(null), BadRequest);
    assert.throws(() => validateRequest([]), BadRequest);
});

test('optional and dependent fields', () => {
    const natante = validateRequest(payload({ registered: 'natante', registration: 'ignored' }));
    assert.equal(natante.registration, null);
    // The colour is dropped without the bottom among the zones.
    assert.equal(validateRequest(payload({ zones: ['deck'] })).antifoulingColor, null);
    assert.equal(validateRequest(payload({ tier: 'nessuno', zones: ['deck'] })).estimate.package, 0);
    assert.equal(validateRequest(payload({ lang: 'de' })).lang, 'it');
    assert.equal(validateRequest(payload({ beam: 3.456 })).beam, 3.46);
    assert.equal(validateRequest(payload({ options: { hardware: true } })).options.hardware, true);
    assert.equal(validateRequest(payload({ serviceSite: null })).serviceSite, null);
});

test('a worker photo must really be the WebP or JPEG it says, and small', () => {
    const { validatePhoto, MAX_PHOTO_BYTES } = require('../server/validate');
    const url = (mime, bytes) => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
    const webp = Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPVP8 '), Buffer.alloc(16)]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(validatePhoto(url('image/webp', webp)).mime, 'image/webp');
    assert.equal(validatePhoto(url('image/jpeg', jpeg)).image.length, jpeg.length);
    assert.throws(() => validatePhoto(url('image/jpeg', png)), BadRequest);
    assert.throws(() => validatePhoto(url('image/webp', jpeg)), BadRequest);
    assert.throws(() => validatePhoto(url('image/png', png)), BadRequest);
    assert.throws(() => validatePhoto(url('image/svg+xml', '<svg/>')), BadRequest);
    assert.throws(() => validatePhoto(42), BadRequest);
    assert.throws(() => validatePhoto(url('image/jpeg', Buffer.concat([jpeg, Buffer.alloc(MAX_PHOTO_BYTES)]))), /troppo grande/);
});

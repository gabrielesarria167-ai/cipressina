'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRequest, BadRequest } = require('../server/validate');

// What src/app.js buildPayload() sends for a complete request.
function payload(extra) {
    return Object.assign({
        lang: 'it', boatType: 'cabinato', tier: 'completo', zones: ['bottom', 'topside_port'],
        antifoulingColor: 'rosso', builder: 'Beneteau', model: 'Antares 8', year: 2015, loa: 8.5,
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
    assert.deepEqual(row.zones, ['bottom', 'topside_port']);
    // completo 55 €/m × 8.5 = 468; bottom 40 × 8.5 = 340; topside 85 × 8.5 = 723 (rounded); 2 zones: −5 %.
    assert.equal(row.estimate.package, 468);
    assert.equal(row.estimate.subtotal, 340 + 723);
    assert.equal(row.estimate.discount, Math.round((340 + 723) * 0.05));
    assert.equal(row.estimate.total, 468 + 340 + 723 - Math.round((340 + 723) * 0.05));
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

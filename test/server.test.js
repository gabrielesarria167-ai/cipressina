'use strict';

// Read once when server.js loads: the number render.yaml sets on Render.
process.env.TRUST_PROXY = '3';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPublic, clientIp, rateKey } = require('../server/server');

test('only the site is public: never .env, the server, the sources or the repo files', () => {
    for (const file of ['/.env', '/.git/config', '/server/db.js', '/SERVER/db.js', '/server/schema.sql',
        '/package.json', '/README.md', '/render.yaml', '/design/sketches/index.html',
        '/design/models/blend/open.blend', '/src/.hidden.js', '/pgs/.env', '/test/server.test.js']) {
        assert.equal(isPublic(file), false, file);
    }
    for (const file of ['/index.html', '/styles.css', '/staff.css', '/pgs/officina.html', '/src/staff.js',
        '/models/open.glb', '/img/logo-cipressina.jpg']) {
        assert.equal(isPublic(file), true, file);
    }
});

test('the statuses in src/zones.js are the CHECK list in server/schema.sql', () => {
    const sql = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'server', 'schema.sql'), 'utf8');
    const check = /CHECK \(status IN \(([^)]*)\)\)/.exec(sql);
    assert.ok(check, 'the status CHECK is in schema.sql');
    assert.deepEqual(check[1].match(/'[a-z]+'/g).map((s) => s.slice(1, -1)), globalThis.CIPRESSINA_ZONES.STATUSES);
});

function req(forwarded, socketIp = '10.0.0.9') {
    return { socket: { remoteAddress: socketIp }, headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded } };
}

test('the client address is read from the right of X-Forwarded-For, so a forged left part changes nothing', () => {
    assert.equal(clientIp(req('203.0.113.7, 198.51.100.1, 10.0.0.1')), '203.0.113.7');
    assert.equal(clientIp(req('1.2.3.4, 5.6.7.8, 203.0.113.7, 198.51.100.1, 10.0.0.1')), '203.0.113.7');
    assert.equal(clientIp(req('::ffff:203.0.113.7, 198.51.100.1, 10.0.0.1')), '203.0.113.7');
    // Shorter than the proxies in front, or not an address: the socket's.
    assert.equal(clientIp(req('198.51.100.1, 10.0.0.1')), '10.0.0.9');
    assert.equal(clientIp(req('not-an-ip, 198.51.100.1, 10.0.0.1')), '10.0.0.9');
});

test('rate limits count an IPv6 /64 as one client, an IPv4 address as itself', () => {
    assert.equal(rateKey('203.0.113.7'), '203.0.113.7');
    assert.equal(rateKey('2001:db8:1:2::a'), '2001:db8:1:2::/64');
    assert.equal(rateKey('2001:DB8:1:2:ffff::1'), '2001:db8:1:2::/64');
    assert.equal(rateKey('2001:db8::1'), '2001:db8:0:0::/64');
});

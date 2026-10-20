'use strict';

// The attendance rules (server/attendance.js) on hand-made shifts. Ported
// from autocolor. Mid-October 2026 Rome is on summer time, UTC+2.

const test = require('node:test');
const assert = require('node:assert/strict');
const attendance = require('../server/attendance.js');
const { hashPin, checkPin } = require('../server/auth.js');

const WEEKDAY = { from: '08:00', to: '17:00' };
// Mon-Sat 8-17, Sunday off.
const SCHEDULE = [null, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY, WEEKDAY];

// A closed shift between two Rome wall-clock times on one day.
function shift(workerId, day, from, to, extra) {
    const startedAt = new Date(`${day}T${from}:00+02:00`);
    const endedAt = new Date(`${day}T${to}:00+02:00`);
    return Object.assign({
        workerId, startedAt, endedAt, open: false, pending: false,
        seconds: (endedAt - startedAt) / 1000,
    }, extra);
}

function run(shifts, opts) {
    return attendance.summarize(Object.assign({
        shifts,
        settings: new Map([['AB12345', { schedule: SCHEDULE, hasPin: true }]]),
        roster: ['AB12345'],
        // Tuesday 2026-10-13 is the first day; «now» is Saturday 17th, 10:00 in Rome.
        from: '2026-10-13',
        to: '2026-10-17',
        now: new Date('2026-10-17T10:00:00+02:00'),
        graceMin: 10,
    }, opts));
}

function dayOf(summary, day) {
    return summary.workers[0].days.find((row) => row.day === day);
}

test('late only past the grace, and then the whole delay counts', () => {
    const s = run([
        shift('AB12345', '2026-10-13', '08:09', '17:00'),
        shift('AB12345', '2026-10-14', '08:25', '17:00'),
    ]);
    assert.equal(dayOf(s, '2026-10-13').lateMin, 0);
    assert.equal(dayOf(s, '2026-10-14').lateMin, 25);
    assert.equal(s.workers[0].totals.lateCount, 1);
});

test('overtime past the grace on a planned day, all of it on a day off', () => {
    const s = run([
        shift('AB12345', '2026-10-13', '08:00', '17:05'),
        shift('AB12345', '2026-10-14', '08:00', '18:30'),
        shift('AB12345', '2026-10-11', '09:00', '12:00'),
    ], { from: '2026-10-11' });
    assert.equal(dayOf(s, '2026-10-13').overtimeMin, 0);
    assert.equal(dayOf(s, '2026-10-14').overtimeMin, 90);
    assert.equal(dayOf(s, '2026-10-11').overtimeMin, 180);
    assert.equal(dayOf(s, '2026-10-11').lateMin, 0);
});

test('absent on a past planned day; today is «missing» only past start + grace', () => {
    const s = run([]);
    assert.equal(dayOf(s, '2026-10-15').absent, true);
    assert.equal(dayOf(s, '2026-10-17').absent, false);
    assert.equal(dayOf(s, '2026-10-17').missing, true);
    const early = run([], { now: new Date('2026-10-17T08:05:00+02:00') });
    assert.equal(dayOf(early, '2026-10-17').missing, false);
});

test('days before the schedule was first set are not absences', () => {
    const s = run([], { settings: new Map([['AB12345', { schedule: SCHEDULE, scheduleSince: '2026-10-16', hasPin: true }]]) });
    assert.equal(dayOf(s, '2026-10-15').absent, false);
    assert.equal(dayOf(s, '2026-10-15').planned, null);
    assert.equal(dayOf(s, '2026-10-15').scheduled, false);
    assert.equal(dayOf(s, '2026-10-17').scheduled, true);
    assert.equal(dayOf(s, '2026-10-16').absent, true);
});

test('a pending shift marks the day incomplete and earns no overtime', () => {
    const s = run([shift('AB12345', '2026-10-13', '08:00', '20:00', { pending: true })]);
    const row = dayOf(s, '2026-10-13');
    assert.equal(row.incomplete, true);
    assert.equal(row.overtimeMin, 0);
    assert.equal(s.workers[0].totals.incomplete, 1);
});

test('two shifts in one day are summed; the first start decides lateness', () => {
    const s = run([
        shift('AB12345', '2026-10-13', '08:00', '12:00'),
        shift('AB12345', '2026-10-13', '13:00', '17:00'),
    ]);
    const row = dayOf(s, '2026-10-13');
    assert.equal(row.workedSec, 8 * 3600);
    assert.equal(row.lateMin, 0);
    assert.equal(s.workers[0].totals.daysWorked, 1);
});

test('alerts name the kinds and the workers; setup gaps show up too', () => {
    const s = attendance.summarize({
        shifts: [], settings: new Map(), roster: ['AB12345'],
        from: '2026-10-17', to: '2026-10-17', now: new Date('2026-10-17T10:00:00+02:00'), graceMin: 10,
    });
    assert.deepEqual(attendance.alertsFrom(s).map((a) => a.kind), ['noPin', 'noSchedule']);
    assert.deepEqual(attendance.alertsFrom(run([])).map((a) => a.kind), ['missing', 'absent']);
});

test('CSV: BOM, semicolons, decimal comma, and no formulas', () => {
    const s = run([shift('AB12345', '2026-10-13', '08:00', '16:30')]);
    const csv = attendance.toCsv(s, () => '=HYPERLINK("x");Ana');
    assert.ok(csv.startsWith('﻿Codice;Dipendente;'));
    const line = csv.split('\r\n')[1];
    assert.ok(line.startsWith('AB12345;"\'=HYPERLINK(""x"");Ana";2026-10-13;Mar;08:00-17:00;08:00;16:30;8,50;'));
});

test('schedules: seven days, entry before exit, not past the close hour', () => {
    assert.deepEqual(attendance.parseSchedule(SCHEDULE, 23), SCHEDULE);
    assert.equal(attendance.parseSchedule(SCHEDULE.slice(1), 23), null);
    assert.equal(attendance.parseSchedule([null, { from: '17:00', to: '08:00' }, null, null, null, null, null], 23), null);
    assert.equal(attendance.parseSchedule([null, { from: '08:00', to: '23:30' }, null, null, null, null, null], 23), null);
    assert.equal(attendance.parseSchedule([null, { from: '8:00', to: '17:00' }, null, null, null, null, null], 23), null);
});

test('week and month bounds in Rome days, across the change from summer time', () => {
    assert.equal(attendance.weekStart('2026-10-18'), '2026-10-12');
    assert.equal(attendance.weekStart('2026-10-12'), '2026-10-12');
    assert.equal(attendance.monthEnd('2026-02-10'), '2026-02-28');
    // 22:30Z on the 17th is already the 18th in Rome (UTC+2).
    assert.equal(attendance.romeDay('2026-10-17T22:30:00Z'), '2026-10-18');
    // 23:00 in Rome: 21:00Z on summer time, 22:00Z after the clocks go back on the 25th.
    assert.equal(new Date(attendance.romeInstant('2026-10-24', 23)).toISOString(), '2026-10-24T21:00:00.000Z');
    assert.equal(new Date(attendance.romeInstant('2026-10-25', 23)).toISOString(), '2026-10-25T22:00:00.000Z');
    assert.equal(new Date(attendance.romeInstant('2026-10-25', 6)).toISOString(), '2026-10-25T05:00:00.000Z');
});

test('PIN hash round-trip', () => {
    const stored = hashPin('4821');
    assert.equal(checkPin('4821', stored), true);
    assert.equal(checkPin('4822', stored), false);
    assert.equal(checkPin('4821', 'garbage'), false);
});

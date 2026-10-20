'use strict';

/* -----------------------------------------------------------------------------
   Attendance: the shifts laid over each worker's weekly schedule. Late
   arrivals, overtime, absences, shifts still waiting for the owner, totals
   for a week or a month, and the CSV he pays wages from. Ported from
   autocolor's server/attendance.js.

   No database and no clock of its own: shifts, schedules and «now» come in as
   arguments, so the rules are tested without a server (test/attendance.test.js).
   Days are Rome calendar days, «2026-10-19». Rome has daylight saving time, so
   wall-clock times go through Intl (autocolor could use a fixed offset for Lima).
-------------------------------------------------------------------------- */

const TIME_ZONE = 'Europe/Rome';
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
const TIME_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

const wallFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

// An instant's Rome wall clock, as numbers.
function wall(instant) {
    const parts = {};
    for (const part of wallFormat.formatToParts(new Date(instant))) parts[part.type] = Number(part.value);
    return parts;
}

function romeDay(instant) {
    const w = wall(instant);
    return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

// Minutes since Rome midnight.
function romeMinutes(instant) {
    const w = wall(instant);
    return w.hour * 60 + w.minute;
}

function romeClock(instant) {
    const minutes = romeMinutes(instant);
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}

/** The instant at which Rome's clock shows `hour`:00 on `day` («2026-10-19»). */
function romeInstant(day, hour) {
    const guess = Date.parse(`${day}T00:00:00Z`) + hour * 60 * 60 * 1000;
    const offsetAt = (instant) => {
        const w = wall(instant);
        return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(instant / 1000) * 1000;
    };
    // Twice: the offset at the guess can differ from the one at the answer on a DST night.
    const first = guess - offsetAt(guess);
    return guess - offsetAt(first);
}

function addDays(day, n) {
    return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

function weekday(day) {
    return new Date(`${day}T00:00:00Z`).getUTCDay();
}

// The shop's week starts on Monday.
function weekStart(day) {
    return addDays(day, -((weekday(day) + 6) % 7));
}

function monthStart(day) {
    return day.slice(0, 8) + '01';
}

function monthEnd(day) {
    const [year, month] = day.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function toMinutes(clock) {
    const match = TIME_RE.exec(clock);
    return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * A weekly schedule as the owner sends it, normalised, or null when it is not
 * one: seven entries, index = weekday (0 Sunday), each null (day off) or
 * { from: 'HH:MM', to: 'HH:MM' }, from before to, to no later than `latest`
 * (the hour the server closes shifts at).
 */
function parseSchedule(value, latest) {
    if (!Array.isArray(value) || value.length !== 7) return null;
    const out = [];
    for (const entry of value) {
        if (entry === null) { out.push(null); continue; }
        if (!entry || typeof entry !== 'object') return null;
        if (!TIME_RE.test(entry.from) || !TIME_RE.test(entry.to)) return null;
        if (toMinutes(entry.from) >= toMinutes(entry.to)) return null;
        if (latest !== undefined && toMinutes(entry.to) > latest * 60) return null;
        out.push({ from: entry.from, to: entry.to });
    }
    return out;
}

/**
 * Every roster worker's days between `from` and `to` (inclusive) and their
 * totals. `shifts` are server/db.js shifts; a shift belongs to the Rome day it
 * started on. `settings` maps workerId -> { schedule, scheduleSince, hasPin }.
 *
 * Per day: `lateMin` counts only past the grace; `overtimeMin` is worked minus
 * planned, also past the grace (a day off worked is all overtime); `absent` is
 * a planned day already over with no shift; `missing` is today, past start +
 * grace, still no shift. A pending shift marks the day `incomplete` and earns
 * no overtime: its length is a placeholder until the owner gives it.
 */
function summarize({ shifts, settings, roster, from, to, now, graceMin }) {
    const today = romeDay(now);
    const nowMin = romeMinutes(now);
    const byWorker = new Map(roster.map((id) => [id, []]));
    for (const shift of shifts) {
        if (!byWorker.has(shift.workerId)) byWorker.set(shift.workerId, []);
        byWorker.get(shift.workerId).push(shift);
    }

    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);

    const workers = [];
    for (const [workerId, mine] of byWorker) {
        const own = settings.get(workerId) || {};
        const schedule = own.schedule || null;
        const totals = {
            daysWorked: 0, workedSec: 0, lateCount: 0, lateMin: 0,
            overtimeMin: 0, absences: 0, incomplete: 0,
        };
        const rows = days.map(function (d) {
            const scheduled = !!schedule && !(own.scheduleSince && d < own.scheduleSince);
            const planned = scheduled ? schedule[weekday(d)] : null;
            const dayShifts = mine
                .filter((shift) => romeDay(shift.startedAt) === d)
                .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
            const row = {
                day: d, scheduled, planned, firstIn: null, lastOut: null, open: false, workedSec: 0,
                lateMin: 0, overtimeMin: 0, absent: false, missing: false, incomplete: false,
            };

            if (dayShifts.length === 0) {
                if (planned && d < today) row.absent = true;
                if (planned && d === today && nowMin > toMinutes(planned.from) + graceMin
                    && nowMin < toMinutes(planned.to)) row.missing = true;
            } else {
                row.firstIn = dayShifts[0].startedAt;
                row.open = dayShifts.some((shift) => shift.open);
                row.lastOut = row.open ? null : dayShifts[dayShifts.length - 1].endedAt;
                row.workedSec = dayShifts.reduce((sum, shift) => sum + shift.seconds, 0);
                row.incomplete = dayShifts.some((shift) => shift.pending);
                if (planned) {
                    const late = romeMinutes(row.firstIn) - toMinutes(planned.from);
                    if (late > graceMin) row.lateMin = late;
                }
                if (!row.incomplete) {
                    const plannedMin = planned ? toMinutes(planned.to) - toMinutes(planned.from) : 0;
                    const extra = Math.floor(row.workedSec / 60) - plannedMin;
                    if (extra > graceMin) row.overtimeMin = extra;
                }
            }

            if (dayShifts.length > 0) totals.daysWorked += 1;
            totals.workedSec += row.workedSec;
            if (row.lateMin > 0) { totals.lateCount += 1; totals.lateMin += row.lateMin; }
            totals.overtimeMin += row.overtimeMin;
            if (row.absent) totals.absences += 1;
            if (row.incomplete) totals.incomplete += 1;
            return row;
        });
        workers.push({
            workerId, hasPin: !!own.hasPin, schedule, onRoster: roster.indexOf(workerId) !== -1,
            days: rows, totals,
        });
    }
    return { from, to, today, graceMin, workers };
}

/** What the owner should look at: each kind with how many and who (roster workers only). */
function alertsFrom(summary) {
    const kinds = [
        ['incomplete', (w) => w.totals.incomplete],
        ['missing', (w) => w.days.filter((d) => d.missing).length],
        ['late', (w) => w.totals.lateCount],
        ['absent', (w) => w.totals.absences],
        ['overtime', (w) => (w.totals.overtimeMin > 0 ? 1 : 0)],
        ['noPin', (w) => (w.hasPin ? 0 : 1)],
        ['noSchedule', (w) => (w.schedule ? 0 : 1)],
    ];
    const roster = summary.workers.filter((w) => w.onRoster);
    const alerts = [];
    for (const [kind, countOf] of kinds) {
        const hits = roster.filter((w) => countOf(w) > 0);
        if (hits.length === 0) continue;
        alerts.push({ kind, count: hits.reduce((sum, w) => sum + countOf(w), 0), workers: hits.map((w) => w.workerId) });
    }
    return alerts;
}

// A cell Excel will not run as a formula and that survives the separator.
function csvCell(value) {
    let text = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return /[;"\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function hours(seconds) {
    return (seconds / 3600).toFixed(2).replace('.', ',');
}

/** One line per worker and day, «;» with decimal commas and a BOM: what Excel in Italian opens into columns. */
function toCsv(summary, nameFor) {
    const lines = [[
        'Codice', 'Dipendente', 'Data', 'Giorno', 'Orario', 'Entrata', 'Uscita',
        'Ore lavorate', 'Minuti di ritardo', 'Minuti di straordinario', 'Assenza', 'Da completare',
    ]];
    for (const worker of summary.workers) {
        for (const row of worker.days) {
            lines.push([
                worker.workerId,
                nameFor(worker.workerId) || worker.workerId,
                row.day,
                WEEKDAYS[weekday(row.day)],
                row.planned ? `${row.planned.from}-${row.planned.to}` : row.scheduled ? 'riposo' : '',
                row.firstIn ? romeClock(row.firstIn) : '',
                row.lastOut ? romeClock(row.lastOut) : row.open ? 'in turno' : '',
                row.workedSec ? hours(row.workedSec) : '',
                row.lateMin || '',
                row.overtimeMin || '',
                row.absent ? 'sì' : '',
                row.incomplete ? 'sì' : '',
            ]);
        }
    }
    return '﻿' + lines.map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n';
}

module.exports = {
    summarize, alertsFrom, toCsv, parseSchedule,
    romeDay, romeMinutes, romeInstant, addDays, weekStart, monthStart, monthEnd,
};

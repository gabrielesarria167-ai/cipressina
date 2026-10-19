'use strict';

/* Loads the .env at the repo root into process.env (ported from autocolor's
   server/env.js). Whatever the environment already has wins, so a
   DATABASE_URL in front of the command beats the file. The .env is in
   .gitignore: the repository is public. */

const fs = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function parse(text) {
    const out = new Map();
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        // Quotes let a value carry spaces or a '#'; stripped only when they wrap it whole.
        const quoted = value.length >= 2 &&
            ((value[0] === '"' && value.endsWith('"')) || (value[0] === "'" && value.endsWith("'")));
        if (quoted) value = value.slice(1, -1);
        out.set(key, value);
    }
    return out;
}

function load() {
    let text;
    try {
        text = fs.readFileSync(ENV_PATH, 'utf8');
    } catch (err) {
        // No .env is normal: on Render the variables come from the environment.
        if (err.code !== 'ENOENT') console.warn(`Could not read ${ENV_PATH}: ${err.message}`);
        return;
    }
    for (const [key, value] of parse(text)) {
        if (process.env[key] === undefined) process.env[key] = value;
    }
}

load();

module.exports = { ENV_PATH };

'use strict';

/* Applies server/schema.sql to DATABASE_URL, from the work machine:

       npm run db:migrate

   Not run on deploy on purpose: a failing migration in Render's build would
   take the site down over a database problem. The whole file goes in one
   query with no parameters, so Postgres runs it as one implicit transaction
   (a failure leaves nothing half applied). schema.sql is idempotent. */

require('./env');

const fs = require('node:fs');
const path = require('node:path');
const { pool, describe, DATABASE_URL } = require('./db');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function main() {
    if (!DATABASE_URL) throw new Error('DATABASE_URL is missing (see .env.example)');
    console.log(`Applying ${SCHEMA_PATH}\nDatabase: ${describe()}`);
    await pool.query(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    console.log('Done.');
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        const detail = err.message || (err.errors || []).map((e) => e.message).join('; ') || err.code || String(err);
        console.error(`\nCould not apply the schema: ${detail}`);
        if (err.position) console.error(`  (character ${err.position} of schema.sql)`);
        await pool.end().catch(() => {});
        process.exit(1);
    });

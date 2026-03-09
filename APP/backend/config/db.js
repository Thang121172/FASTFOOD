const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});

console.log('[db] config =', {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD ? '***' : '(empty)',
});

// Startup DB check
(async () => {
    try {
        const client = await pool.connect();
        const r = await client.query('SELECT 1 as ok, current_database() AS db, current_user AS usr');
        console.log('[db] connected OK =>', r.rows[0]);
        client.release();
    } catch (e) {
        console.error('[db] initial connect FAILED');
        console.error('  code   :', e.code);
        console.error('  message:', e.message);
    }
})();

module.exports = pool;

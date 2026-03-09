const pool = require('../config/db');
const env = require('../config/env');
const { normEmail } = require('../utils/helpers');
const { otpRate } = require('../utils/rateLimiter');

exports.lastOtpDev = async (req, res) => {
    if (!env.DEBUG_SHOW_OTP) return res.status(403).json({ error: 'not_allowed' });

    const clientIP = (req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '').toString();
    const devTokenHeader = req.headers['x-dev-token'];
    const expectedToken = env.DEV_TOKEN || null;
    const isPrivate = clientIP.match(/^(127\.|::1|192\.168\.|10\.|172\.)/) !== null;

    if (!isPrivate) {
        if (!expectedToken) return res.status(403).json({ error: 'dev_token_required' });
        if (!devTokenHeader || devTokenHeader !== expectedToken) return res.status(403).json({ error: 'access_denied' });
    }

    const email = normEmail(req.query && req.query.email);
    if (!email) return res.status(400).json({ error: 'email required' });

    try {
        const ur = await pool.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email]);
        if (ur.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        const r = await pool.query('SELECT code,expires_at,used,attempts FROM otp_codes WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [ur.rows[0].id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'no_otp_found' });
        const row = r.rows[0];

        return res.json({
            ok: true,
            code: row.code || null,
            note: row.code ? undefined : 'plain code not stored',
            expires_at: row.expires_at,
            used: row.used,
            attempts: row.attempts,
        });
    } catch (e) {
        console.error('dev last-otp error', e);
        res.status(500).json({ error: 'failed' });
    }
};

exports.otpMetrics = async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
    try {
        const inMemory = {};
        for (const [email, rec] of otpRate.entries()) {
            const elapsed = Date.now() - rec.firstTs;
            inMemory[email] = {
                count: rec.count,
                firstTs: rec.firstTs,
                remaining: Math.max(0, env.OTP_LIMIT - rec.count),
                window_seconds_remaining: Math.max(0, Math.ceil((env.OTP_WINDOW_MS - elapsed) / 1000)),
            };
        }
        res.json({ inMemory, redis: null });
    } catch (err) {
        res.status(500).json({ error: 'failed' });
    }
};

exports.resetOtpMetrics = async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
    const email = normEmail(req.body && req.body.email);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
        otpRate.delete(email);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'failed' });
    }
};

exports.lastOtpAdmin = async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
    const email = normEmail(req.query && req.query.email);
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
        const ur = await pool.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [email]);
        if (ur.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        const r = await pool.query('SELECT code,expires_at,used,attempts FROM otp_codes WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [ur.rows[0].id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'no_otp_found' });
        const row = r.rows[0];
        return res.json({
            ok: true,
            code: env.DEBUG_SHOW_OTP ? row.code || null : null,
            expires_at: row.expires_at,
            used: row.used,
            attempts: row.attempts,
        });
    } catch (e) {
        res.status(500).json({ error: 'failed' });
    }
};

exports.smtpCheck = async (req, res) => {
    if (!req.user || req.user.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
    if (!env.SMTP_HOST) return res.status(400).json({ ok: false, note: 'SMTP not configured' });
    try {
        const nodemailer = require('nodemailer');
        const testTransport = nodemailer.createTransport({
            host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
            tls: { rejectUnauthorized: false },
        });
        const info = await testTransport.verify();
        res.json({ ok: true, info });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message || String(e) });
    }
};

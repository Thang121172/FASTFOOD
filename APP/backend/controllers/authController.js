const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');
const transporter = require('../config/mailer');
const { isAllDigits, isValidEmail, isGmailAddress, normEmail, issueTokens } = require('../utils/helpers');
const { otpRate } = require('../utils/rateLimiter');

let redis = null; // if you re-enable redis later

exports.sendOtp = async (req, res) => {
    const email = normEmail(req.body && req.body.email);
    if (!email) return res.status(400).json({ error: 'email required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    if (!isGmailAddress(email)) return res.status(400).json({ error: 'only_gmail_allowed' });

    try {
        const rec = otpRate.get(email) || { count: 0, firstTs: Date.now() };
        const elapsed = Date.now() - rec.firstTs;
        if (elapsed <= env.OTP_WINDOW_MS && rec.count >= env.OTP_LIMIT) {
            const remaining = env.OTP_WINDOW_MS - elapsed;
            const retry = Math.max(0, Math.ceil(remaining / 1000));
            res.set('Retry-After', String(retry));
            return res.status(429).json({ error: 'otp_rate_limited', retry_after_seconds: retry });
        }
        if (elapsed > env.OTP_WINDOW_MS) {
            rec.count = 0;
            rec.firstTs = Date.now();
        }
        rec.count += 1;
        otpRate.set(email, rec);
    } catch (e) {
        console.error('otp rate limiter error', e);
    }

    try {
        let user = null;
        const r = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
        if (r.rowCount === 0) {
            const create = await pool.query(
                'INSERT INTO users(username,email,role,verified,password) VALUES($1,$2,$3,$4,$5) ON CONFLICT (username) DO UPDATE SET email=EXCLUDED.email RETURNING id',
                [email, email, 'USER', false, '']
            );
            if (create.rowCount > 0) user = { id: create.rows[0].id };
            else {
                const r2 = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
                user = { id: r2.rows[0].id };
            }
        } else {
            user = { id: r.rows[0].id };
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const codeHash = bcrypt.hashSync(code, 10);
        const expires = new Date(Date.now() + 10 * 60 * 1000);

        const storePlain = env.ALLOW_SMOKE_SEED || env.DEBUG_SHOW_OTP;
        const plainForDb = storePlain ? code : null;
        await pool.query(
            'INSERT INTO otp_codes(user_id,code,code_hash,expires_at,attempts) VALUES($1,$2,$3,$4,$5)',
            [user.id, plainForDb, codeHash, expires, 0]
        );

        let sendResult = 'console';
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000;

        try {
            if (transporter) {
                let sent = false;
                while (!sent && retryCount < maxRetries) {
                    try {
                        await transporter.sendMail({
                            from: env.SMTP_FROM,
                            to: email,
                            subject: 'Your OTP',
                            text: `Your OTP is: ${code}`,
                        });
                        sendResult = 'smtp';
                        sent = true;
                    } catch (mailErr) {
                        retryCount++;
                        if (retryCount < maxRetries && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(mailErr.code)) {
                            await new Promise((resolve) => setTimeout(resolve, retryDelay * retryCount));
                        } else throw mailErr;
                    }
                }
            } else {
                console.log(`OTP for ${email}: ${code}`);
            }
        } catch (mailErr) {
            console.log(`OTP (fallback) for ${email}: ${code}`);
            sendResult = 'fallback';
        }

        res.json({ ok: true, note: 'OTP sent' });
    } catch (err) {
        console.error('send-otp error', err);
        res.status(500).json({ error: 'could not send otp' });
    }
};

exports.verifyOtp = async (req, res) => {
    const email = normEmail(req.body && req.body.email);
    const otp = req.body && req.body.otp;
    if (!email || !otp) return res.status(400).json({ error: 'email and otp required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });

    try {
        const r = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        const userId = r.rows[0].id;
        const or = await pool.query(
            'SELECT id,expires_at,used,attempts,code_hash FROM otp_codes WHERE user_id=$1 ORDER BY id DESC LIMIT 1',
            [userId]
        );
        if (or.rowCount === 0) return res.status(400).json({ error: 'otp_invalid' });
        const row = or.rows[0];
        if (row.used) return res.status(400).json({ error: 'code used' });
        if (row.attempts >= env.MAX_OTP_VERIFY_ATTEMPTS) return res.status(429).json({ error: 'too_many_attempts' });
        if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'code expired' });

        let ok = false;
        if (row.code_hash) ok = bcrypt.compareSync(otp, row.code_hash);

        if (!ok) {
            await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [row.id]);
            return res.status(400).json({ error: 'otp_invalid' });
        }

        await pool.query('UPDATE otp_codes SET used=true WHERE id=$1', [row.id]);
        await pool.query('UPDATE users SET verified=true WHERE id=$1', [userId]);

        const uRow = (await pool.query('SELECT id,username,role FROM users WHERE id=$1', [userId])).rows[0];
        const tokens = await issueTokens(uRow);

        res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            role: uRow.role,
        });
    } catch (err) {
        console.error('verify-otp error', err);
        res.status(500).json({ error: 'verify failed' });
    }
};

exports.resetPassword = async (req, res) => {
    const email = normEmail(req.body && req.body.email);
    const { otp, new_password } = req.body || {};
    if (!email || !otp || !new_password) return res.status(400).json({ error: 'email_otp_and_new_password_required' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
    if (isAllDigits(new_password) || String(new_password).length < 6) return res.status(400).json({ error: 'password_invalid' });

    try {
        const r = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'user not found' });
        const userId = r.rows[0].id;
        const or = await pool.query(
            'SELECT id,expires_at,used,attempts,code_hash,code FROM otp_codes WHERE user_id=$1 ORDER BY id DESC LIMIT 1',
            [userId]
        );
        if (or.rowCount === 0) return res.status(400).json({ error: 'otp_invalid' });
        const row = or.rows[0];
        if (row.used) return res.status(400).json({ error: 'code used' });
        if (row.attempts >= env.MAX_OTP_VERIFY_ATTEMPTS) return res.status(429).json({ error: 'too_many_attempts' });
        if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'code expired' });

        let ok = false;
        if (row.code_hash) ok = bcrypt.compareSync(otp, row.code_hash);
        else if (row.code) ok = String(otp) === String(row.code);

        if (!ok) {
            await pool.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [row.id]);
            return res.status(400).json({ error: 'otp_invalid' });
        }

        await pool.query('UPDATE otp_codes SET used=true WHERE id=$1', [row.id]);
        const hashed = bcrypt.hashSync(new_password, 10);
        await pool.query('UPDATE users SET password=$1, verified=true WHERE id=$2', [hashed, userId]);
        return res.json({ ok: true });
    } catch (e) {
        console.error('reset-password error', e);
        return res.status(500).json({ error: 'failed' });
    }
};

exports.register = async (req, res) => {
    try {
        const { username, password, role, name } = req.body || {};
        const email = normEmail(username);

        if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });
        if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
        if (!isGmailAddress(email)) return res.status(400).json({ error: 'only_gmail_allowed' });
        if (String(password).length < 6) return res.status(400).json({ error: 'password_too_short' });

        let finalRole = (role && String(role).toLowerCase()) || 'customer';
        const allowedRoles = ['customer', 'merchant', 'shipper', 'admin'];
        if (!allowedRoles.includes(finalRole)) {
            if (finalRole === 'user') finalRole = 'customer';
            else if (finalRole === 'shop') finalRole = 'merchant';
            else finalRole = 'customer';
        }

        const hashed = bcrypt.hashSync(password, 10);
        const client = await pool.connect();
        let userId;
        try {
            await client.query('BEGIN');
            const check = await client.query('SELECT id FROM auth_user WHERE username=$1', [email]);
            if (check.rowCount > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'user_already_exists' });
            }

            const userRes = await client.query(
                `INSERT INTO auth_user (password, is_superuser, username, first_name, last_name, email, is_staff, is_active, date_joined)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                [hashed, false, email, '', '', email, false, true, new Date()]
            );
            userId = userRes.rows[0].id;

            await client.query(
                `INSERT INTO accounts_profile (user_id, role, full_name) VALUES ($1, $2, $3)`,
                [userId, finalRole, name || '']
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        const userObj = { id: userId, username: email, role: finalRole };
        const tokens = await issueTokens(userObj);

        return res.json({
            ok: true,
            user: { id: userId, username: email, role: finalRole, name: name || null },
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    } catch (err) {
        console.error('[REGISTER] ❌ Error:', err);
        return res.status(500).json({ error: 'register_failed', message: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const email = normEmail(username);

        if (!email || !password) return res.status(400).json({ error: 'email_and_password_required' });

        const r = await pool.query(
            `SELECT u.id, u.username, u.password, u.is_active, p.role
       FROM auth_user u
       LEFT JOIN accounts_profile p ON u.id = p.user_id
       WHERE u.username=$1`,
            [email]
        );

        if (r.rowCount === 0) return res.status(400).json({ error: 'invalid_credentials' });
        const user = r.rows[0];
        const ok = bcrypt.compareSync(password, user.password);

        if (!ok) return res.status(400).json({ error: 'invalid_credentials' });

        const tokens = await issueTokens(user);

        return res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            role: user.role,
            verified: true
        });
    } catch (err) {
        console.error('[LOGIN] ❌ Error:', err);
        return res.status(500).json({ error: 'login_failed' });
    }
};

exports.refresh = async (req, res) => {
    try {
        const body = req.body || {};
        const rt = body.refresh_token || body.refreshToken || body.token;
        if (!rt) return res.status(400).json({ error: 'refresh_token_required' });

        let payload;
        try {
            payload = jwt.verify(rt, env.JWT_SECRET);
        } catch (e) {
            return res.status(401).json({ error: 'invalid_refresh_token' });
        }

        if (!payload || payload.type !== 'refresh' || !payload.id) {
            return res.status(401).json({ error: 'invalid_refresh_token' });
        }

        const r = await pool.query('SELECT id, username, role FROM users WHERE id=$1 LIMIT 1', [payload.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: 'user_not_found' });

        const user = r.rows[0];
        const tokens = await issueTokens(user);

        return res.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            role: user.role,
        });
    } catch (err) {
        console.error('auth/refresh error', err);
        return res.status(500).json({ error: 'refresh_failed' });
    }
};

exports.logout = async (req, res) => {
    try {
        const auth = req.headers.authorization || '';
        const parts = auth.split(' ');
        let jti = null;

        if (parts.length === 2 && parts[0] === 'Bearer') {
            try {
                const payload = jwt.verify(parts[1], env.JWT_SECRET);
                if (payload && payload.jti) jti = payload.jti;
            } catch (e) { }
        }

        if (jti) {
            try {
                await pool.query('INSERT INTO revoked_tokens (jti) VALUES ($1) ON CONFLICT (jti) DO NOTHING', [jti]);
            } catch (e) {
                console.error('logout: failed to insert revoked token', e);
            }
        }

        return res.json({ ok: true });
    } catch (err) {
        console.error('auth/logout error', err);
        return res.status(500).json({ error: 'logout_failed' });
    }
};

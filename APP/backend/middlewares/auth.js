const pool = require('../config/db');
const { extractTokenPayload } = require('../utils/helpers');

async function requireAuth(req, res, next) {
    const payload = extractTokenPayload(req);
    if (!payload) return res.status(401).json({ error: 'unauthenticated' });
    try {
        if (payload && payload.jti) {
            const rr = await pool.query(
                'SELECT id FROM revoked_tokens WHERE jti=$1 LIMIT 1',
                [payload.jti]
            );
            if (rr.rowCount > 0)
                return res.status(401).json({ error: 'token_revoked' });
        }
        req.user = payload;
        next();
    } catch (e) {
        console.error('requireAuth db error', e);
        res.status(500).json({ error: 'auth_failed' });
    }
}

module.exports = { requireAuth };

const jwt = require('jsonwebtoken');
const env = require('../config/env');

function extractTokenPayload(req) {
    const auth = req.headers.authorization;
    if (!auth) return null;
    const parts = auth.split(' ');
    if (parts.length !== 2) return null;
    try {
        return jwt.verify(parts[1], env.JWT_SECRET);
    } catch (err) {
        return null;
    }
}

function isAllDigits(s) {
    if (!s) return false;
    return /^\d+$/.test(String(s));
}

function isValidEmail(email) {
    if (!email) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isGmailAddress(email) {
    if (!isValidEmail(email)) return false;
    const d = String(email).toLowerCase().split('@')[1];
    return d === 'gmail.com' || d === 'googlemail.com';
}

function normEmail(s) {
    return String(s || '').trim().toLowerCase();
}

async function issueTokens(user) {
    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        jti: require('crypto').randomUUID(),
    };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: '1h',
        issuer: env.JWT_ISSUER,
    });
    const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        env.JWT_SECRET,
        { expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`, issuer: env.JWT_ISSUER }
    );
    return { accessToken, refreshToken };
}

module.exports = {
    extractTokenPayload,
    isAllDigits,
    isValidEmail,
    isGmailAddress,
    normEmail,
    issueTokens
};

require('dotenv').config({ override: true });

module.exports = {
    DB_HOST: process.env.DB_HOST || process.env.PGHOST || process.env.POSTGRES_HOST || '127.0.0.1',
    DB_PORT: parseInt(process.env.DB_PORT || process.env.PGPORT || process.env.POSTGRES_PORT || '5432', 10),
    DB_NAME: process.env.DB_NAME || process.env.POSTGRES_DB || process.env.PGDATABASE || 'fastfood',
    DB_USER: process.env.DB_USER || process.env.PGUSER || process.env.POSTGRES_USER || 'app',
    DB_PASSWORD: process.env.DB_PASSWORD || process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || '123456',
    JWT_SECRET: process.env.JWT_SECRET || 'supersecret',
    JWT_ISSUER: process.env.JWT_ISSUER || 'fastfood-app',
    REVOCATION_TTL_DAYS: parseInt(process.env.REVOCATION_TTL_DAYS || '7', 10),
    MAX_OTP_VERIFY_ATTEMPTS: parseInt(process.env.MAX_OTP_VERIFY_ATTEMPTS || '5', 10),
    REFRESH_TOKEN_TTL_DAYS: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    SMTP_SECURE: process.env.SMTP_SECURE === 'true',
    SMTP_USER: process.env.SMTP_USER ? String(process.env.SMTP_USER).trim() : undefined,
    SMTP_PASS: process.env.SMTP_PASS ? String(process.env.SMTP_PASS).replace(/\s+/g, '') : undefined,
    SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER,
    OTP_LIMIT: parseInt(process.env.OTP_LIMIT || '5', 10),
    OTP_WINDOW_MS: parseInt(process.env.OTP_WINDOW_MS || String(60 * 1000), 10),
    ALLOW_SMOKE_SEED: process.env.ALLOW_SMOKE_SEED === 'true',
    DEBUG_SHOW_OTP: process.env.DEBUG_SHOW_OTP === 'true',
    DEV_TOKEN: process.env.DEV_TOKEN,
    REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379/1'
};

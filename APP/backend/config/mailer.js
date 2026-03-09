const nodemailer = require('nodemailer');
const env = require('./env');

let transporter = null;

try {
    if (env.SMTP_HOST && env.SMTP_USER) {
        if (env.SMTP_PASS && env.SMTP_PASS !== process.env.SMTP_PASS) {
            console.log('Note: SMTP_PASS contained whitespace; using sanitized value.');
        }
        transporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
            tls: { rejectUnauthorized: false },
        });
    } else {
        console.log('SMTP not configured. OTPs will be logged to console and stored in DB for dev/testing.');
    }
} catch (e) {
    console.error('Nodemailer initialization failed:', e.message);
}

module.exports = transporter;

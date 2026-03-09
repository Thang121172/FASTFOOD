const env = require('../config/env');

const otpRate = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [email, rec] of otpRate.entries()) {
        if (now - rec.firstTs > env.OTP_WINDOW_MS) otpRate.delete(email);
    }
}, 60 * 1000);

module.exports = { otpRate };

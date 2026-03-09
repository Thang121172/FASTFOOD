const Redis = require('ioredis');
const env = require('./env');

const redisOptions = {
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 1, // Để cho phép tự động fallback khi Redis ngắt kết nối
};

let redisClient = null;

try {
    redisClient = new Redis(env.REDIS_URL, redisOptions);

    redisClient.on('connect', () => {
        console.log('[REDIS] Connected successfully');
    });

    redisClient.on('error', (err) => {
        console.error('[REDIS] Connection error:', err.message);
    });
} catch (error) {
    console.error('[REDIS] Initialization error:', error.message);
}

module.exports = redisClient;

const errorHandler = (err, req, res, next) => {
    console.error('[Global Error]', err.stack);
    res.status(err.status || 500).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'Lỗi server nội bộ',
        // stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
    });
};

module.exports = errorHandler;

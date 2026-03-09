const fs = require('fs');

exports.uploadImage = (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'no_file_uploaded', message: 'Không có file ảnh được upload' });
        const user_role = req.user.role;
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') {
            if (req.file.path) fs.unlinkSync(req.file.path);
            return res.status(403).json({ error: 'forbidden', message: 'Không có quyền upload ảnh' });
        }
        const protocol = req.protocol;
        const host = req.get('host');
        const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
        res.json({ success: true, url: imageUrl, filename: req.file.filename, size: req.file.size });
    } catch (err) {
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { }
        }
        res.status(500).json({ error: 'upload_failed', message: err.message || 'Không thể upload ảnh' });
    }
};

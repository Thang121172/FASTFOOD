const pool = require('../config/db');

exports.getCurrentUser = async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, username, email, phone, role FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'failed_to_fetch_profile' });
    }
};

exports.updateProfile = async (req, res) => {
    const { name, phone } = req.body;
    try {
        await pool.query(
            'UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone) WHERE id = $3',
            [name, phone, req.user.id]
        );
        res.json({ ok: true, message: 'profile_updated' });
    } catch (e) {
        res.status(500).json({ error: 'failed_to_update_profile' });
    }
};

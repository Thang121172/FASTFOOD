const pool = require('../config/db');

exports.createComplaint = async (req, res) => {
    const user_id = req.user.id;
    const { order_id, complaint_type, title, description } = req.body;
    try {
        const orderResult = await pool.query('SELECT id FROM orders WHERE id = $1 AND user_id = $2', [order_id, user_id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });
        const result = await pool.query(
            `INSERT INTO complaints (order_id, customer_id, complaint_type, title, description, status, created_at) VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW()) RETURNING id`,
            [order_id, user_id, complaint_type || 'OTHER', title, description]
        );
        res.json({ id: result.rows[0].id, message: 'complaint_created' });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_create_complaint' });
    }
};

exports.getComplaints = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    try {
        let query; let params = [];
        if (user_role === 'USER' || user_role === 'CUSTOMER') {
            query = 'SELECT * FROM complaints WHERE customer_id = $1 ORDER BY created_at DESC'; params = [user_id];
        } else if (user_role === 'MERCHANT') {
            query = `SELECT c.* FROM complaints c JOIN orders o ON o.id = c.order_id JOIN restaurants r ON r.id = o.restaurant_id WHERE r.id IN (SELECT restaurant_id FROM user_restaurants WHERE user_id = $1) ORDER BY c.created_at DESC`; params = [user_id];
        } else if (user_role === 'ADMIN') {
            query = 'SELECT * FROM complaints ORDER BY created_at DESC';
        } else {
            return res.status(403).json({ error: 'forbidden' });
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_get_complaints' });
    }
};

exports.respondComplaint = async (req, res) => {
    const complaintId = parseInt(req.params.id, 10);
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { response, status } = req.body;
    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const updateQuery = `UPDATE complaints SET response = $1, status = $2, handled_by = $3, resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE resolved_at END, updated_at = NOW() WHERE id = $4 RETURNING *`;
        const result = await pool.query(updateQuery, [response, status, user_id, complaintId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'complaint_not_found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_respond_complaint' });
    }
};

const pool = require('../config/db');

exports.createReview = async (req, res) => {
    const user_id = req.user.id;
    const { order_id, order_rating, merchant_rating, shipper_rating, comment, menu_item_reviews } = req.body;

    try {
        const orderResult = await pool.query('SELECT id, status, shipper_id FROM orders WHERE id = $1 AND user_id = $2', [order_id, user_id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });
        const order = orderResult.rows[0];
        if (order.status !== 'DELIVERED') return res.status(400).json({ error: 'can_only_review_delivered_orders' });

        const existingReview = await pool.query('SELECT id FROM reviews WHERE order_id = $1 AND customer_id = $2', [order_id, user_id]);
        if (existingReview.rows.length > 0) return res.status(400).json({ error: 'already_reviewed' });

        const reviewResult = await pool.query(
            `INSERT INTO reviews (order_id, customer_id, order_rating, merchant_rating, shipper_rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
            [order_id, user_id, order_rating || 5, merchant_rating, shipper_rating || (order.shipper_id ? shipper_rating : null), comment || '']
        );
        const reviewId = reviewResult.rows[0].id;

        if (menu_item_reviews && Array.isArray(menu_item_reviews)) {
            for (const itemReview of menu_item_reviews) {
                await pool.query(
                    `INSERT INTO menu_item_reviews (review_id, order_item_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, NOW())`,
                    [reviewId, itemReview.order_item_id, itemReview.rating || 5, itemReview.comment || '']
                );
            }
        }

        res.json({ id: reviewId, order_id, message: 'review_created' });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_create_review' });
    }
};

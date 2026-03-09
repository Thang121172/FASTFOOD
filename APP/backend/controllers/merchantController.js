const pool = require('../config/db');

exports.getMerchantMenu = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') {
            return res.status(403).json({ error: 'forbidden' });
        }

        let restaurantId;
        if (user_role === 'ADMIN') {
            restaurantId = parseInt(req.query.restaurant_id, 10);
            if (isNaN(restaurantId)) {
                return res.status(400).json({ error: 'restaurant_id_required_for_admin' });
            }
        } else {
            let restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1', [user_id]);
            if (restaurantResult.rows.length === 0) {
                try {
                    restaurantResult = await pool.query('SELECT restaurant_id as id FROM user_restaurants WHERE user_id = $1', [user_id]);
                } catch (e) { }
            }
            restaurantId = restaurantResult.rows.length === 0 ? user_id : restaurantResult.rows[0].id;
        }

        const result = await pool.query(
            'SELECT id, restaurant_id, name, description, price, image_url, created_at, updated_at FROM products WHERE restaurant_id = $1 ORDER BY id DESC',
            [restaurantId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_menu', message: err.message });
    }
};

exports.addMenuItem = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { name, description, price, image_url } = req.body;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        if (!name || !price) return res.status(400).json({ error: 'name_and_price_required' });
        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum < 0) return res.status(400).json({ error: 'invalid_price' });

        let restaurantId;
        if (user_role === 'ADMIN') {
            restaurantId = parseInt(req.body.restaurant_id, 10);
            if (isNaN(restaurantId)) return res.status(400).json({ error: 'restaurant_id_required_for_admin' });
        } else {
            let restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1', [user_id]);
            if (restaurantResult.rows.length === 0) {
                try {
                    restaurantResult = await pool.query('SELECT restaurant_id as id FROM user_restaurants WHERE user_id = $1', [user_id]);
                } catch (e) { }
            }
            if (restaurantResult.rows.length === 0) {
                const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [user_id]);
                const username = userResult.rows[0]?.username || `Merchant ${user_id}`;
                try {
                    const newRestaurantResult = await pool.query(
                        'INSERT INTO restaurants (name, address, rating) VALUES ($1, $2, $3) RETURNING id',
                        [`${username}'s Restaurant`, 'Chưa cập nhật', 0]
                    );
                    restaurantId = newRestaurantResult.rows[0].id;
                    try {
                        await pool.query(
                            'CREATE TABLE IF NOT EXISTS user_restaurants (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE, PRIMARY KEY (user_id, restaurant_id))'
                        );
                        await pool.query('INSERT INTO user_restaurants (user_id, restaurant_id) VALUES ($1, $2) ON CONFLICT (user_id, restaurant_id) DO NOTHING', [user_id, restaurantId]);
                    } catch (e) { }
                } catch (createErr) {
                    return res.status(500).json({ error: 'failed_to_create_restaurant', message: createErr.message });
                }
            } else {
                restaurantId = restaurantResult.rows[0].id;
            }
        }

        try {
            await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
          image_url TEXT
        )
      `);
            try {
                await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()');
                await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()');
            } catch (colErr) { }
        } catch (tableErr) { }

        let returnColumns = 'id, restaurant_id, name, description, price, image_url';
        try {
            const colCheck = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('created_at', 'updated_at')");
            const hasCreatedAt = colCheck.rows.some(r => r.column_name === 'created_at');
            const hasUpdatedAt = colCheck.rows.some(r => r.column_name === 'updated_at');
            if (hasCreatedAt) returnColumns += ', created_at';
            if (hasUpdatedAt) returnColumns += ', updated_at';
        } catch (checkErr) { }

        const result = await pool.query(
            `INSERT INTO products (restaurant_id, name, description, price, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING ${returnColumns}`,
            [restaurantId, name, description || null, priceNum, image_url || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_add_menu_item', message: err.message });
    }
};

exports.updateMenuItem = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const menuId = parseInt(req.params.id, 10);
    const { name, description, price, image_url } = req.body;

    try {
        if (isNaN(menuId)) return res.status(400).json({ error: 'invalid_menu_id' });
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        let merchantRestaurantId = null;
        if (user_role !== 'ADMIN') {
            let restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1', [user_id]);
            if (restaurantResult.rows.length === 0) {
                try {
                    restaurantResult = await pool.query('SELECT restaurant_id as id FROM user_restaurants WHERE user_id = $1', [user_id]);
                } catch (e) { }
            }
            merchantRestaurantId = restaurantResult.rows.length === 0 ? user_id : restaurantResult.rows[0].id;
        }

        let query = 'SELECT id, restaurant_id, name FROM products WHERE id = $1';
        const params = [menuId];
        if (user_role !== 'ADMIN' && merchantRestaurantId !== null) {
            query += ' AND restaurant_id = $2';
            params.push(merchantRestaurantId);
        }
        const checkResult = await pool.query(query, params);
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'menu_item_not_found' });

        const updates = [];
        const updateParams = [];
        let paramIndex = 1;

        if (name !== undefined) { updates.push(`name = $${paramIndex++}`); updateParams.push(name); }
        if (description !== undefined) { updates.push(`description = $${paramIndex++}`); updateParams.push(description); }
        if (price !== undefined) {
            const priceNum = parseFloat(price);
            if (isNaN(priceNum) || priceNum < 0) return res.status(400).json({ error: 'invalid_price' });
            updates.push(`price = $${paramIndex++}`); updateParams.push(priceNum);
        }
        if (image_url !== undefined) { updates.push(`image_url = $${paramIndex++}`); updateParams.push(image_url); }
        if (updates.length === 0) return res.status(400).json({ error: 'no_fields_to_update' });

        let hasUpdatedAt = false;
        try {
            const colCheck = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updated_at'");
            hasUpdatedAt = colCheck.rows.length > 0;
        } catch (checkErr) { }

        if (hasUpdatedAt) updates.push(`updated_at = NOW()`);
        updateParams.push(menuId);

        let returnColumns = 'id, restaurant_id, name, description, price, image_url';
        try {
            const colCheck = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name IN ('created_at', 'updated_at')");
            if (colCheck.rows.some(r => r.column_name === 'created_at')) returnColumns += ', created_at';
            if (colCheck.rows.some(r => r.column_name === 'updated_at')) returnColumns += ', updated_at';
        } catch (checkErr) { }

        const updateQuery = `UPDATE products SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING ${returnColumns}`;
        const result = await pool.query(updateQuery, updateParams);
        if (result.rows.length === 0) return res.status(404).json({ error: 'menu_item_not_found' });

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_update_menu_item', message: err.message });
    }
};

exports.deleteMenuItem = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const menuId = parseInt(req.params.id, 10);

    try {
        if (isNaN(menuId)) return res.status(400).json({ error: 'invalid_menu_id' });
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        let merchantRestaurantId = null;
        if (user_role !== 'ADMIN') {
            let restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1', [user_id]);
            if (restaurantResult.rows.length === 0) {
                try {
                    restaurantResult = await pool.query('SELECT restaurant_id as id FROM user_restaurants WHERE user_id = $1', [user_id]);
                } catch (e) { }
            }
            merchantRestaurantId = restaurantResult.rows.length === 0 ? user_id : restaurantResult.rows[0].id;
        }

        let query = 'SELECT id, restaurant_id, name FROM products WHERE id = $1';
        const params = [menuId];
        if (user_role !== 'ADMIN' && merchantRestaurantId !== null) {
            query += ' AND restaurant_id = $2';
            params.push(merchantRestaurantId);
        }
        const checkResult = await pool.query(query, params);
        if (checkResult.rows.length === 0) return res.status(404).json({ error: 'menu_item_not_found' });

        const deleteResult = await pool.query('DELETE FROM products WHERE id = $1', [menuId]);
        if (deleteResult.rowCount === 0) return res.status(404).json({ error: 'menu_item_not_found' });

        res.json({ success: true, message: 'Menu item deleted', id: menuId });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_delete_menu_item', message: err.message });
    }
};

exports.getMerchantOrders = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { status } = req.query;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        let restaurantId;
        if (user_role === 'ADMIN') {
            restaurantId = parseInt(req.query.restaurant_id, 10);
            if (isNaN(restaurantId)) return res.status(400).json({ error: 'restaurant_id_required_for_admin' });
        } else {
            const restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1 OR id IN (SELECT restaurant_id FROM user_restaurants WHERE user_id = $1)', [user_id]);
            restaurantId = restaurantResult.rows.length === 0 ? user_id : restaurantResult.rows[0].id;
        }

        let query = `
      SELECT o.id as order_id, o.status, COALESCE(o.total_amount, o.total, 0) as total, COALESCE(o.total_amount, o.total, 0) as total_amount, o.created_at, o.address, o.payment_method, u.username as customer_name
      FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE o.restaurant_id = $1
    `;
        const params = [restaurantId];

        if (status) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'pending' || statusLower === 'new') { query += ' AND (o.status = $2 OR o.status = $3)'; params.push('PENDING', 'CONFIRMED'); }
            else if (statusLower === 'preparing' || statusLower === 'in_progress') { query += ' AND (o.status = $2 OR o.status = $3)'; params.push('COOKING', 'PREPARING'); }
            else if (statusLower === 'ready') { query += ' AND (o.status = $2 OR o.status = $3)'; params.push('READY', 'HANDOVER'); }
            else if (statusLower === 'completed' || statusLower === 'delivered') { query += ' AND o.status = $2'; params.push('DELIVERED'); }
            else if (statusLower === 'cancelled' || statusLower === 'canceled') { query += ' AND o.status = $2'; params.push('CANCELED'); }
            else { query += ' AND o.status = $2'; params.push(status.toUpperCase()); }
        }
        query += ' ORDER BY o.created_at DESC';

        const result = await pool.query(query, params);
        const ordersWithItems = await Promise.all(
            result.rows.map(async (order) => {
                let itemsResult;
                try {
                    itemsResult = await pool.query(`SELECT oi.product_id, oi.quantity, oi.price, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, [order.order_id]);
                } catch (err) {
                    itemsResult = await pool.query(`SELECT oi.menu_item_id as product_id, oi.quantity, oi.unit_price as price, oi.item_name as product_name, p.name as product_name_from_menu FROM order_items oi LEFT JOIN menu_items p ON p.id = oi.menu_item_id WHERE oi.order_id = $1`, [order.order_id]);
                }

                const mappedItems = itemsResult.rows.map(item => {
                    const unitPrice = parseFloat(item.price) || 0;
                    const qty = parseInt(item.quantity) || 1;
                    const lineTotal = unitPrice * qty;
                    return { product_id: item.product_id, quantity: qty, price: unitPrice, line_total: lineTotal, product_name: item.product_name_from_menu || item.product_name || 'Unknown' };
                });

                let finalTotal = 0;
                if (mappedItems.length > 0) {
                    finalTotal = mappedItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || parseFloat(item.price) * parseInt(item.quantity) || 0), 0);
                } else {
                    finalTotal = parseFloat(order.total) || parseFloat(order.total_amount) || 0;
                }

                return { ...order, total: finalTotal, total_amount: finalTotal, items: mappedItems };
            })
        );

        res.json(ordersWithItems);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_orders' });
    }
};

exports.updateOrderStatus = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const orderId = parseInt(req.params.id, 10);
    const { status } = req.body;

    try {
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        if (!status) return res.status(400).json({ error: 'status_required' });

        let order;
        if (user_role !== 'ADMIN') {
            const restaurantResult = await pool.query('SELECT restaurant_id as id FROM user_restaurants WHERE user_id = $1', [user_id]);
            let merchantRestaurantIds = [];
            if (restaurantResult.rows.length > 0) merchantRestaurantIds = restaurantResult.rows.map(r => r.id);
            else {
                const fallbackResult = await pool.query('SELECT id FROM restaurants WHERE id = $1', [user_id]);
                merchantRestaurantIds = fallbackResult.rows.length > 0 ? [user_id] : [user_id];
            }
            const checkResult = await pool.query('SELECT restaurant_id, status FROM orders WHERE id = $1 AND restaurant_id = ANY($2::int[])', [orderId, merchantRestaurantIds]);
            if (checkResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });
            order = checkResult.rows[0];
        } else {
            const checkResult = await pool.query('SELECT restaurant_id, status FROM orders WHERE id = $1', [orderId]);
            if (checkResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });
            order = checkResult.rows[0];
        }

        const statusMap = {
            'preparing': 'COOKING', 'in_progress': 'COOKING', 'new': 'PENDING', 'pending': 'PENDING',
            'confirmed': 'CONFIRMED', 'ready': 'READY', 'shipping': 'DELIVERING', 'delivering': 'DELIVERING',
            'delivered': 'DELIVERED', 'completed': 'DELIVERED', 'cancelled': 'CANCELED', 'canceled': 'CANCELED',
            'cancel_requested': 'CANCEL_REQUESTED'
        };
        const statusLower = (status || '').toLowerCase().trim();
        const newStatus = statusMap[statusLower];
        if (!newStatus) return res.status(400).json({ error: 'invalid_status', received: status, allowed: Object.keys(statusMap) });

        const orderInfo = await pool.query('SELECT user_id FROM orders WHERE id = $1', [orderId]);
        const orderUserId = orderInfo.rows[0]?.user_id;

        await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, orderId]);
        try { await pool.query('INSERT INTO order_status_history (order_id, status, note) VALUES ($1, $2, $3)', [orderId, newStatus, `Status updated by merchant`]); } catch (historyErr) { }

        const io = req.app.get('io');
        if (io && orderUserId) {
            io.to(`order_${orderId}`).emit('statusUpdate', { orderId, status: newStatus });
            io.to(`user_${orderUserId}`).emit('orderUpdate', { orderId, status: newStatus });
        }

        res.json({ success: true, orderId, status: newStatus });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_update_order_status', message: err.message });
    }
};

exports.getMerchantRevenue = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { start_date, end_date } = req.query;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        let restaurantId;
        if (user_role === 'ADMIN') {
            restaurantId = parseInt(req.query.restaurant_id, 10);
            if (isNaN(restaurantId)) return res.status(400).json({ error: 'restaurant_id_required_for_admin' });
        } else {
            const restaurantResult = await pool.query('SELECT id FROM restaurants WHERE id = $1 OR id IN (SELECT restaurant_id FROM user_restaurants WHERE user_id = $1)', [user_id]);
            restaurantId = restaurantResult.rows.length === 0 ? user_id : restaurantResult.rows[0].id;
        }

        let query = `
      SELECT COUNT(*) as total_orders,
      COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN COALESCE(total_amount, total, 0) ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN COALESCE(total_amount, total, 0) ELSE 0 END), 0) as completed_revenue,
      COALESCE(SUM(CASE WHEN status = 'PENDING' OR status = 'CONFIRMED' THEN 1 ELSE 0 END), 0) as pending_orders,
      COALESCE(SUM(CASE WHEN status = 'PREPARING' OR status = 'COOKING' THEN 1 ELSE 0 END), 0) as preparing_orders,
      COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) as completed_orders
      FROM orders WHERE restaurant_id = $1
    `;
        const params = [restaurantId];
        if (start_date) { query += ' AND created_at >= $' + (params.length + 1); params.push(start_date); }
        if (end_date) { query += ' AND created_at <= $' + (params.length + 1); params.push(end_date); }

        const result = await pool.query(query, params);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_revenue' });
    }
};

exports.adjustStock = async (req, res) => {
    const menuItemId = parseInt(req.params.id, 10);
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { quantity, type } = req.body;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        const menuResult = await pool.query('SELECT id, stock, restaurant_id FROM menu_items WHERE id = $1', [menuItemId]);
        if (menuResult.rows.length === 0) return res.status(404).json({ error: 'menu_item_not_found' });

        const menuItem = menuResult.rows[0];
        let newStock = menuItem.stock;

        if (type === 'IN') newStock += Math.abs(quantity);
        else if (type === 'OUT') newStock = Math.max(0, newStock - Math.abs(quantity));
        else newStock = Math.max(0, quantity);

        await pool.query('UPDATE menu_items SET stock = $1 WHERE id = $2', [newStock, menuItemId]);
        res.json({ id: menuItemId, stock: newStock, message: 'stock_updated' });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_adjust_stock' });
    }
};

exports.handleOutOfStock = async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { action, substitutions, reductions, reason } = req.body;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const orderResult = await pool.query('SELECT id, restaurant_id FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            if (action === 'SUBSTITUTE' && substitutions) {
                for (const sub of substitutions) {
                    const newMenuResult = await client.query('SELECT name, price FROM menu_items WHERE id = $1', [sub.new_menu_item_id]);
                    if (newMenuResult.rows.length > 0) {
                        const newMenu = newMenuResult.rows[0];
                        await client.query(
                            'UPDATE order_items SET menu_item_id = $1, name_snapshot = $2, price_snapshot = $3, line_total = $3 * quantity WHERE id = $4',
                            [sub.new_menu_item_id, newMenu.name, newMenu.price, sub.order_item_id]
                        );
                    }
                }
            } else if (action === 'REDUCE' && reductions) {
                for (const red of reductions) {
                    await client.query(
                        'UPDATE order_items SET quantity = $1, line_total = price_snapshot * $1 WHERE id = $2',
                        [Math.max(1, red.new_quantity), red.order_item_id]
                    );
                }
            } else if (action === 'CANCEL') {
                await client.query("UPDATE orders SET status = 'CANCELED', payment_status = CASE WHEN payment_status = 'PAID' THEN 'REFUNDED' ELSE payment_status END WHERE id = $1", [orderId]);
                await client.query('COMMIT');
                return res.json({ id: orderId, status: 'CANCELED', message: 'order_canceled_due_to_out_of_stock' });
            }

            const totalResult = await client.query('SELECT SUM(line_total) as total FROM order_items WHERE order_id = $1', [orderId]);
            const total = totalResult.rows[0].total || 0;
            await client.query('UPDATE orders SET total_amount = $1 WHERE id = $2', [total, orderId]);
            await client.query('COMMIT');
            res.json({ id: orderId, total_amount: total, message: `handled_out_of_stock_with_${action}` });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'failed_to_handle_out_of_stock' });
    }
};

exports.processRefund = async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { amount, reason } = req.body;

    try {
        if (user_role !== 'MERCHANT' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const orderResult = await pool.query('SELECT id, total_amount, payment_status FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });
        const order = orderResult.rows[0];
        if (order.payment_status !== 'PAID') return res.status(400).json({ error: 'can_only_refund_paid_orders' });

        const refundAmount = amount ? Math.min(amount, order.total_amount) : order.total_amount;
        await pool.query("UPDATE orders SET payment_status = 'REFUNDED' WHERE id = $1", [orderId]);
        res.json({ id: orderId, refund_amount: refundAmount, payment_status: 'REFUNDED', message: 'refund_processed' });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_process_refund' });
    }
};

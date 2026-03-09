const pool = require('../config/db');

exports.getShipperOrders = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { status } = req.query;

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        const shipperCheck = await pool.query('SELECT id FROM shippers WHERE id = $1', [user_id]);
        if (shipperCheck.rows.length === 0 && user_role !== 'ADMIN') return res.status(403).json({ error: 'not_a_shipper' });

        let query = `
      SELECT o.id as order_id, o.status, o.shipper_id, COALESCE(o.total_amount, o.total, 0) as total, COALESCE(o.total_amount, o.total, 0) as total_amount, o.created_at, o.address, o.payment_method, o.restaurant_id, r.name as restaurant_name, u.username as customer_name
      FROM orders o LEFT JOIN restaurants r ON r.id = o.restaurant_id LEFT JOIN users u ON u.id = o.user_id WHERE 1=1
    `;
        const params = [];

        if (status) {
            const statusLower = status.toLowerCase();
            if (statusLower === 'available') { query += ' AND o.status IN ($1, $2, $3, $4) AND o.shipper_id IS NULL'; params.push('PENDING', 'CONFIRMED', 'COOKING', 'READY'); }
            else if (statusLower === 'delivering') { query += ' AND o.shipper_id = $1 AND o.status != $2 AND o.status != $3'; params.push(user_id, 'DELIVERED', 'CANCELED'); }
            else if (statusLower === 'completed') { query += ' AND o.shipper_id = $1 AND o.status = $2'; params.push(user_id, 'DELIVERED'); }
            else { query += ' AND o.status = $1'; params.push(status.toUpperCase()); }
        } else {
            query += ' AND o.shipper_id IS NULL AND o.status IN ($1, $2, $3, $4)'; params.push('PENDING', 'CONFIRMED', 'COOKING', 'READY');
        }
        query += ' ORDER BY o.created_at DESC';

        const result = await pool.query(query, params);
        const ordersWithItems = await Promise.all(
            result.rows.map(async (order) => {
                let itemsResult;
                try { itemsResult = await pool.query(`SELECT oi.product_id, oi.quantity, oi.price, p.name as product_name FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, [order.order_id]); }
                catch (err) { itemsResult = await pool.query(`SELECT oi.menu_item_id as product_id, oi.quantity, oi.unit_price as price, oi.item_name as product_name, p.name as product_name_from_menu FROM order_items oi LEFT JOIN menu_items p ON p.id = oi.menu_item_id WHERE oi.order_id = $1`, [order.order_id]); }

                const mappedItems = itemsResult.rows.map(item => {
                    const unitPrice = parseFloat(item.price) || 0;
                    const qty = parseInt(item.quantity) || 1;
                    const lineTotal = unitPrice * qty;
                    return { product_id: item.product_id, quantity: qty, price: unitPrice, line_total: lineTotal, product_name: item.product_name_from_menu || item.product_name || 'Unknown' };
                });

                let finalTotal = 0;
                if (mappedItems.length > 0) finalTotal = mappedItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || parseFloat(item.price) * parseInt(item.quantity) || 0), 0);
                else finalTotal = parseFloat(order.total) || parseFloat(order.total_amount) || 0;

                return { ...order, total: finalTotal, total_amount: finalTotal, items: mappedItems };
            })
        );
        res.json(ordersWithItems);
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_orders' });
    }
};

exports.acceptOrder = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const orderId = parseInt(req.params.id, 10);

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });

        const orderResult = await pool.query('SELECT id, status, shipper_id FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });

        const order = orderResult.rows[0];
        if (order.shipper_id != null) return res.status(400).json({ error: 'order_already_assigned' });

        const allowedStatuses = ['READY', 'CONFIRMED', 'COOKING', 'PENDING'];
        if (!allowedStatuses.includes(order.status) && order.shipper_id != null) {
            return res.status(400).json({ error: 'order_not_ready', current_status: order.status });
        }

        const shipperCheck = await pool.query('SELECT available FROM shippers WHERE id = $1', [user_id]);
        if (shipperCheck.rows.length === 0) return res.status(403).json({ error: 'not_a_shipper' });

        const currentStatus = order.status;
        let newStatus = currentStatus;

        try {
            await pool.query('UPDATE orders SET shipper_id = $1, status = $2, updated_at = NOW() WHERE id = $3', [user_id, 'SHIPPING', orderId]);
            newStatus = 'SHIPPING';
        } catch (updateErr) {
            if (updateErr.code === '23514' && updateErr.constraint === 'orders_status_check') {
                await pool.query('UPDATE orders SET shipper_id = $1, updated_at = NOW() WHERE id = $2', [user_id, orderId]);
                newStatus = currentStatus;
            } else throw updateErr;
        }

        try { await pool.query('INSERT INTO order_status_history (order_id, status, note) VALUES ($1, $2, $3)', [orderId, newStatus, `Shipper ${user_id} accepted and started delivery`]); } catch (e) { }

        const orderInfo = await pool.query('SELECT user_id, restaurant_id FROM orders WHERE id = $1', [orderId]);
        const orderUserId = orderInfo.rows[0]?.user_id;
        const orderRestaurantId = orderInfo.rows[0]?.restaurant_id;

        const updatedOrderResult = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId]);
        const finalStatus = updatedOrderResult.rows[0]?.status || newStatus;

        const io = req.app.get('io');
        if (io) {
            if (orderUserId) {
                io.to(`order_${orderId}`).emit('statusUpdate', { orderId, status: finalStatus, shipperId: user_id });
                io.to(`user_${orderUserId}`).emit('orderUpdate', { orderId, status: finalStatus, shipperId: user_id });
            }
            if (orderRestaurantId) io.to(`shop_${orderRestaurantId}`).emit('orderUpdate', { orderId, status: finalStatus, shipperId: user_id });
        }

        res.json({ success: true, orderId, status: finalStatus, shipper_id: user_id });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_accept_order', message: err.message });
    }
};

exports.updateOrderStatusStatus = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const orderId = parseInt(req.params.id, 10);
    const { status, reason } = req.body || {};

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });
        if (!status) return res.status(400).json({ error: 'status_required' });

        const orderResult = await pool.query('SELECT id, status, shipper_id FROM orders WHERE id = $1', [orderId]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });

        const order = orderResult.rows[0];
        if (order.shipper_id !== user_id && user_role !== 'ADMIN') return res.status(403).json({ error: 'order_not_assigned_to_shipper' });

        const statusMap = { 'picked_up': 'PICKED_UP', 'shipping': 'SHIPPING', 'delivering': 'DELIVERING', 'delivered': 'DELIVERED', 'canceled': 'CANCELED', 'cancelled': 'CANCELED', 'failed': 'CANCELED' };
        const statusLower = (status || '').toLowerCase().trim();
        const newStatus = statusMap[statusLower] || status.toUpperCase();

        const allowedStatuses = ['PICKED_UP', 'SHIPPING', 'DELIVERING', 'DELIVERED', 'CANCELED'];
        if (!allowedStatuses.includes(newStatus)) return res.status(400).json({ error: 'invalid_status', received: status, allowed: allowedStatuses });

        await pool.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, orderId]);
        try {
            const note = reason ? `Status updated by shipper: ${reason}` : `Status updated by shipper to ${newStatus}`;
            await pool.query('INSERT INTO order_status_history (order_id, status, note) VALUES ($1, $2, $3)', [orderId, newStatus, note]);
        } catch (e) { }

        if (newStatus === 'DELIVERED') await pool.query('UPDATE shippers SET available = true WHERE id = $1', [user_id]);

        const orderInfo = await pool.query('SELECT user_id FROM orders WHERE id = $1', [orderId]);
        const orderUserId = orderInfo.rows[0]?.user_id;

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

exports.getShipperOrderDetail = async (req, res) => {
    const orderIdParam = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });

        let query = `
      SELECT o.id as order_id, o.user_id, o.restaurant_id, o.status, o.total as total_amount, o.total, o.created_at, o.address, o.payment_method, o.shipper_id, r.name as restaurant_name, u.username as customer_name, s.vehicle_plate as shipper_vehicle_plate, u_shipper.phone as shipper_phone, u_shipper.username as shipper_name, u_shipper.email as shipper_email, s.lat as shipper_lat, s.lng as shipper_lng
      FROM orders o LEFT JOIN restaurants r ON r.id = o.restaurant_id LEFT JOIN users u ON u.id = o.user_id LEFT JOIN shippers s ON s.id = o.shipper_id LEFT JOIN users u_shipper ON u_shipper.id = o.shipper_id
      WHERE o.id = $1 AND (o.shipper_id = $2 OR o.shipper_id IS NULL OR o.status = 'READY')
    `;
        const params = [orderId, user_id];

        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'order_not_found', message: 'Order not found or not accessible' });

        const order = result.rows[0];
        let itemsResult;
        try { itemsResult = await pool.query('SELECT menu_item_id as product_id, quantity as qty, unit_price as price, item_name FROM order_items WHERE order_id = $1', [orderId]); }
        catch (err) {
            try { itemsResult = await pool.query('SELECT product_id, qty, price FROM order_items WHERE order_id = $1', [orderId]); }
            catch (err2) {
                try { itemsResult = await pool.query('SELECT product_id, quantity as qty, price FROM order_items WHERE order_id = $1', [orderId]); }
                catch (err3) { itemsResult = { rows: [] }; }
            }
        }

        const productIds = itemsResult.rows.map(row => row.product_id).filter(id => id != null);
        const productNamesMap = new Map();
        if (productIds.length > 0) {
            try {
                const productsResult = await pool.query('SELECT id, name FROM products WHERE id = ANY($1::int[])', [productIds]);
                productsResult.rows.forEach(row => productNamesMap.set(row.id, row.name));
            } catch (e) { }
        }

        const mappedItems = itemsResult.rows.map(row => {
            const productId = row.product_id;
            const qty = parseInt(row.qty) || 1;
            const price = parseFloat(row.price) || 0;
            const lineTotal = price * qty;
            const productName = row.item_name || productNamesMap.get(productId) || `Món #${productId}`;
            return { product_id: productId, qty: qty, quantity: qty, price: price, line_total: lineTotal, name: productName };
        });

        let statusHistoryResult;
        try { statusHistoryResult = await pool.query(`SELECT status, note, created_at, id FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]); }
        catch (err) {
            try { statusHistoryResult = await pool.query(`SELECT status, note, id FROM order_status_history WHERE order_id = $1 ORDER BY id ASC`, [orderId]); }
            catch (err2) { statusHistoryResult = { rows: [] }; }
        }

        const orderTotal = parseFloat(order.total_amount || order.total || 0);
        let calculatedTotal = 0;
        if (mappedItems.length > 0) {
            calculatedTotal = mappedItems.reduce((sum, item) => sum + (parseFloat(item.line_total) || (parseFloat(item.price) * parseInt(item.qty || item.quantity) || 0)), 0);
        } else { calculatedTotal = orderTotal; }

        const shipperInfo = order.shipper_id ? { shipper_id: order.shipper_id, shipper_name: order.shipper_name || order.shipper_email || 'N/A', shipper_email: order.shipper_email || null, shipper_phone: order.shipper_phone || null, vehicle_plate: order.shipper_vehicle_plate || null, shipper_lat: order.shipper_lat ? parseFloat(order.shipper_lat) : null, shipper_lng: order.shipper_lng ? parseFloat(order.shipper_lng) : null } : null;

        res.json({ order: { order_id: order.order_id, status: order.status, total: calculatedTotal, total_amount: calculatedTotal, address: order.address || null, payment_method: order.payment_method, created_at: order.created_at, restaurant_name: order.restaurant_name, restaurant_id: order.restaurant_id, user_id: order.user_id, shipper_id: order.shipper_id }, shipper: shipperInfo, items: mappedItems, history: statusHistoryResult.rows });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_order', message: err.message });
    }
};

exports.getShipperRevenue = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        const today = new Date(); today.setHours(0, 0, 0, 0); const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

        const todayRevenueResult = await pool.query(`SELECT COUNT(*) as today_orders, COALESCE(SUM(o.total), 0) as today_revenue FROM orders o WHERE o.shipper_id = $1 AND o.status = 'DELIVERED' AND o.updated_at >= $2 AND o.updated_at < $3`, [user_id, today, tomorrow]);
        const totalRevenueResult = await pool.query(`SELECT COUNT(*) as total_orders, COALESCE(SUM(o.total), 0) as total_revenue FROM orders o WHERE o.shipper_id = $1 AND o.status = 'DELIVERED'`, [user_id]);

        const todayData = todayRevenueResult.rows[0];
        const totalData = totalRevenueResult.rows[0];

        res.json({ today_revenue: parseFloat(todayData.today_revenue) || 0, today_orders: parseInt(todayData.today_orders) || 0, total_revenue: parseFloat(totalData.total_revenue) || 0, total_orders: parseInt(totalData.total_orders) || 0 });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_revenue', message: err.message });
    }
};

exports.getShipperProfile = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const result = await pool.query(`SELECT u.id, u.username, u.email, u.phone, s.available, s.vehicle_plate, s.lat, s.lng FROM users u LEFT JOIN shippers s ON s.id = u.id WHERE u.id = $1`, [user_id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'shipper_not_found' });
        const shipper = result.rows[0];
        res.json({ id: shipper.id, username: shipper.username, email: shipper.email, phone: shipper.phone || null, available: shipper.available, vehicle_plate: shipper.vehicle_plate || null, lat: shipper.lat ? parseFloat(shipper.lat) : null, lng: shipper.lng ? parseFloat(shipper.lng) : null });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_fetch_profile', message: err.message });
    }
};

exports.updateShipperProfile = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { username, email, phone, vehicle_plate } = req.body || {};
    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });

        if (username !== undefined && username !== null && username !== '') {
            const checkUsername = await pool.query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, user_id]);
            if (checkUsername.rows.length > 0) return res.status(400).json({ error: 'username_already_exists' });
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [username, user_id]);
        }

        if (email !== undefined && email !== null && email !== '') {
            const checkEmail = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, user_id]);
            if (checkEmail.rows.length > 0) return res.status(400).json({ error: 'email_already_exists' });
            await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, user_id]);
        }

        if (phone !== undefined) await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phone, user_id]);
        if (vehicle_plate !== undefined) await pool.query('UPDATE shippers SET vehicle_plate = $1 WHERE id = $2', [vehicle_plate, user_id]);

        const result = await pool.query(`SELECT u.id, u.username, u.email, u.phone, s.available, s.vehicle_plate, s.lat, s.lng FROM users u LEFT JOIN shippers s ON s.id = u.id WHERE u.id = $1`, [user_id]);
        const shipper = result.rows[0];
        res.json({ id: shipper.id, username: shipper.username, email: shipper.email, phone: shipper.phone || null, available: shipper.available, vehicle_plate: shipper.vehicle_plate || null, lat: shipper.lat ? parseFloat(shipper.lat) : null, lng: shipper.lng ? parseFloat(shipper.lng) : null });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_update_profile', message: err.message });
    }
};

exports.updateShipperLocation = async (req, res) => {
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { lat, lng, accuracy } = req.body || {};

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        if (lat == null || lng == null) return res.status(400).json({ error: 'lat_lng_required' });

        await pool.query('UPDATE accounts_profile SET latitude = $1, longitude = $2, location_updated_at = NOW() WHERE user_id = $3', [parseFloat(lat), parseFloat(lng), user_id]);

        const io = req.app.get('io');
        if (io) {
            io.to(`shipper_${user_id}`).emit('shipper:location', { shipperId: user_id, lat: parseFloat(lat), lng: parseFloat(lng), accuracy: accuracy ? parseFloat(accuracy) : null });
        }

        res.json({ success: true, lat: parseFloat(lat), lng: parseFloat(lng) });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_update_location', message: err.message });
    }
};

exports.reportIssue = async (req, res) => {
    const orderId = parseInt(req.params.id, 10);
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { issue_type, reason } = req.body;

    try {
        if (user_role !== 'SHIPPER' && user_role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' });
        const orderResult = await pool.query('SELECT id, status, note FROM orders WHERE id = $1 AND shipper_id = $2', [orderId, user_id]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'order_not_found_or_not_assigned' });

        const order = orderResult.rows[0];
        const newNote = `${order.note || ''}\n[Shipper Issue]: ${reason}`.trim();
        await pool.query("UPDATE orders SET status = 'CANCELED', note = $1 WHERE id = $2", [newNote, orderId]);
        res.json({ id: orderId, status: 'CANCELED', message: `issue_reported_${issue_type}` });
    } catch (err) {
        res.status(500).json({ error: 'failed_to_report_issue' });
    }
};

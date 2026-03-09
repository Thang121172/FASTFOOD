const pool = require('../config/db');

exports.createOrder = async (req, res) => {
    const { restaurant_id, items, address, payment_method, lat, lng } = req.body;
    const user_id = req.user.id;

    if (
        !restaurant_id ||
        !items ||
        !Array.isArray(items) ||
        items.length === 0 ||
        !address ||
        !payment_method
    ) {
        return res.status(400).json({ error: 'missing_required_fields_or_empty_items' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const itemIds = items.map((i) => i.product_id);
        const pricesResult = await client.query(
            'SELECT id, price, name FROM menus_menuitem WHERE id = ANY($1::int[])',
            [itemIds]
        );

        const priceMap = new Map();
        const nameMap = new Map();
        pricesResult.rows.forEach((row) => {
            priceMap.set(row.id, parseFloat(row.price));
            nameMap.set(row.id, row.name);
        });

        let totalAmount = 0;
        const orderItemsData = [];

        for (const item of items) {
            const productId = parseInt(item.product_id, 10);
            const quantity = parseInt(item.quantity, 10);

            if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'invalid_item_structure_or_quantity' });
            }

            const price = priceMap.get(productId);
            const name = nameMap.get(productId);

            if (price === undefined) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: `product_not_found: ${productId}` });
            }

            const lineTotal = price * quantity;
            totalAmount += lineTotal;
            orderItemsData.push({ productId, quantity, price, name, lineTotal });
        }

        if (totalAmount <= 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'order_total_must_be_positive' });
        }

        const note = `Payment Method: ${payment_method}`;

        const orderInsert = await client.query(
            `INSERT INTO orders_order (customer_id, merchant_id, delivery_address, total_amount, status, created_at, updated_at, note, delivery_lat, delivery_lng) 
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), $6, $7, $8) 
       RETURNING id, status, created_at`,
            [user_id, restaurant_id, address, totalAmount, 'PENDING', note, lat ? parseFloat(lat) : null, lng ? parseFloat(lng) : null]
        );
        const orderId = orderInsert.rows[0].id;
        const newOrder = orderInsert.rows[0];

        for (const item of orderItemsData) {
            await client.query(
                `INSERT INTO orders_orderitem (order_id, menu_item_id, name_snapshot, price_snapshot, quantity, line_total)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [orderId, item.productId, item.name, item.price, item.quantity, item.lineTotal]
            );
        }

        await client.query('COMMIT');

        const notificationPayload = {
            orderId,
            userId: user_id,
            restaurantId: restaurant_id,
            status: 'PENDING',
            totalAmount,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${user_id}`).emit('orderUpdate', notificationPayload);
            io.to('admins').emit('newOrderAlert', notificationPayload);
        }

        res.status(201).json({
            orderId: orderId,
            status: newOrder.status,
            totalAmount: totalAmount,
            created_at: newOrder.created_at,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('order creation error', err);
        res.status(500).json({ error: 'failed_to_create_order', message: err.message });
    } finally {
        client.release();
    }
};

exports.getOrderDetail = async (req, res) => {
    const orderIdParam = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;

    try {
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });

        let query = `
      SELECT 
        o.id as order_id,
        o.customer_id as user_id,
        o.merchant_id as restaurant_id,
        o.status,
        o.total_amount,
        o.created_at,
        o.delivery_address as address,
        o.delivery_lat,
        o.delivery_lng,
        o.shipper_id,
        r.name as restaurant_name,
        s.latitude as shipper_lat,
        s.longitude as shipper_lng,
        u_shipper.username as shipper_name,
        u_shipper.email as shipper_email
      FROM orders_order o
      LEFT JOIN menus_merchant r ON r.id = o.merchant_id
      LEFT JOIN accounts_profile s ON s.user_id = o.shipper_id
      LEFT JOIN auth_user u_shipper ON u_shipper.id = o.shipper_id
      WHERE o.id = $1
    `;
        const params = [orderId];

        if (user_role !== 'ADMIN' && user_role !== 'MERCHANT' && user_role !== 'SHIPPER') {
            query += ' AND o.customer_id = $2';
            params.push(user_id);
        } else if (user_role === 'MERCHANT') {
            query += ' AND r.owner_id = $2';
            params.push(user_id);
        } else if (user_role === 'SHIPPER') {
            query += ' AND (o.shipper_id = $2 OR o.shipper_id IS NULL)';
            params.push(user_id);
        }

        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });

        const order = result.rows[0];

        const itemsResult = await pool.query(
            `SELECT 
        oi.menu_item_id as product_id,
        oi.quantity,
        oi.price_snapshot as price,
        oi.name_snapshot as product_name,
        oi.line_total
      FROM orders_orderitem oi
      WHERE oi.order_id = $1`,
            [orderId]
        );

        const mappedItems = itemsResult.rows.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: parseFloat(item.price),
            line_total: parseFloat(item.line_total),
            product_name: item.product_name
        }));

        const shipperInfo = order.shipper_id ? {
            shipper_id: order.shipper_id,
            shipper_name: order.shipper_name || order.shipper_email || 'N/A',
            shipper_email: order.shipper_email || null,
            shipper_lat: order.shipper_lat ? parseFloat(order.shipper_lat) : null,
            shipper_lng: order.shipper_lng ? parseFloat(order.shipper_lng) : null,
        } : null;

        res.json({
            order: {
                order_id: order.order_id,
                status: order.status,
                total: parseFloat(order.total_amount),
                total_amount: parseFloat(order.total_amount),
                address: order.address,
                created_at: order.created_at,
                restaurant_name: order.restaurant_name,
                restaurant_id: order.restaurant_id,
                user_id: order.user_id,
                shipper: shipperInfo,
            },
            items: mappedItems,
            history: [],
        });
    } catch (err) {
        console.error('get order detail error', err);
        res.status(500).json({ error: 'failed_to_fetch_order', message: err.message });
    }
};

exports.getCustomerOrders = async (req, res) => {
    const user_id = req.user.id;
    const status = req.query.status;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 20;
    const offset = (page - 1) * pageSize;

    try {
        let query = `
      SELECT 
        o.id as order_id,
        o.status,
        o.total_amount,
        o.created_at,
        o.delivery_address as address,
        r.name as restaurant_name
      FROM orders_order o
      LEFT JOIN menus_merchant r ON r.id = o.merchant_id
      WHERE o.customer_id = $1
    `;
        const params = [user_id];

        if (status) {
            query += ' AND o.status = $2';
            params.push(status.toUpperCase());
        }

        query += ' ORDER BY o.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
        params.push(pageSize, offset);

        const result = await pool.query(query, params);
        const ordersWithItems = await Promise.all(
            result.rows.map(async (order) => {
                const itemsResult = await pool.query(
                    `SELECT 
            oi.menu_item_id as product_id,
            oi.quantity,
            oi.price_snapshot as price,
            oi.name_snapshot as product_name,
            oi.line_total
          FROM orders_orderitem oi
          WHERE oi.order_id = $1`,
                    [order.order_id]
                );

                const mappedItems = itemsResult.rows.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    line_total: parseFloat(item.line_total),
                    product_name: item.product_name
                }));

                return { ...order, items: mappedItems, total: parseFloat(order.total_amount) || 0 };
            })
        );

        res.json(ordersWithItems);
    } catch (err) {
        console.error('customer orders error', err);
        res.status(500).json({ error: 'failed_to_fetch_orders' });
    }
};

exports.getRecentOrders = async (req, res) => {
    const user_id = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    try {
        const result = await pool.query(
            `SELECT o.id as order_id, o.status, o.total_amount, o.created_at, o.delivery_address as address, r.name as restaurant_name
       FROM orders_order o LEFT JOIN menus_merchant r ON r.id = o.merchant_id
       WHERE o.customer_id = $1 ORDER BY o.created_at DESC LIMIT $2`,
            [user_id, limit]
        );

        const ordersWithItems = await Promise.all(
            result.rows.map(async (order) => {
                const itemsResult = await pool.query(
                    `SELECT oi.menu_item_id as product_id, oi.quantity, oi.price_snapshot as price, oi.name_snapshot as product_name, oi.line_total
           FROM orders_orderitem oi WHERE oi.order_id = $1`,
                    [order.order_id]
                );
                const mappedItems = itemsResult.rows.map(item => ({
                    product_id: item.product_id, quantity: item.quantity, price: parseFloat(item.price), line_total: parseFloat(item.line_total), product_name: item.product_name
                }));
                return { ...order, items: mappedItems, total: parseFloat(order.total_amount) || 0 };
            })
        );

        res.json(ordersWithItems);
    } catch (err) {
        console.error('customer recent orders error', err);
        res.status(500).json({ error: 'failed_to_fetch_orders' });
    }
};

exports.cancelOrder = async (req, res) => {
    const orderIdParam = req.params.id;
    const user_id = req.user.id;
    const user_role = req.user.role;
    const { reason } = req.body || {};

    try {
        const orderId = parseInt(orderIdParam, 10);
        if (isNaN(orderId)) return res.status(400).json({ error: 'invalid_order_id' });

        let query = `SELECT id, customer_id as user_id, status FROM orders_order WHERE id = $1`;
        const params = [orderId];

        if (user_role !== 'ADMIN' && user_role !== 'MERCHANT') {
            query += ' AND customer_id = $2';
            params.push(user_id);
        }

        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'order_not_found' });

        const order = result.rows[0];
        const orderStatus = (order.status || '').toUpperCase().trim();

        const immediateCancelStatuses = ['PENDING'];
        const requestCancelStatuses = ['CONFIRMED', 'COOKING', 'READY'];
        const nonCancellableStatuses = ['PICKED_UP', 'DELIVERING', 'DELIVERED', 'CANCELED', 'SHIPPING'];

        if (nonCancellableStatuses.includes(orderStatus)) {
            return res.status(400).json({ error: 'cannot_cancel_order', message: 'Không thể hủy đơn hàng' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const io = req.app.get('io');

            if (immediateCancelStatuses.includes(orderStatus)) {
                await client.query('UPDATE orders_order SET status = $1, updated_at = NOW() WHERE id = $2', ['CANCELED', orderId]);
                await client.query('COMMIT');

                const notificationPayload = { orderId, userId: order.user_id, status: 'CANCELED' };
                if (io) {
                    io.to(`user_${order.user_id}`).emit('orderUpdate', notificationPayload);
                    io.to('admins').emit('orderCancelled', notificationPayload);
                }

                return res.json({ success: true, orderId: orderId, status: 'CANCELED', message: 'Đơn hàng đã được hủy thành công' });
            } else if (requestCancelStatuses.includes(orderStatus)) {
                await client.query('UPDATE orders_order SET status = $1, updated_at = NOW() WHERE id = $2', ['CANCEL_REQUESTED', orderId]);
                await client.query('COMMIT');

                const notificationPayload = { orderId, userId: order.user_id, status: 'CANCEL_REQUESTED', reason: reason || 'Khách hàng yêu cầu hủy đơn' };
                if (io) {
                    io.to(`user_${order.user_id}`).emit('orderUpdate', notificationPayload);
                    io.to('admins').emit('newCancelRequest', notificationPayload);
                }

                return res.json({ success: true, orderId: orderId, status: 'CANCEL_REQUESTED', message: 'Yêu cầu hủy đơn đã được gửi. Đang chờ admin duyệt.' });
            } else {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'cannot_cancel_order', message: `Không thể hủy đơn hàng ở trạng thái này (${order.status})` });
            }
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('cancel order error', err);
        res.status(500).json({ error: 'failed_to_cancel_order', message: err.message });
    }
};

const pool = require('../config/db');
const redisClient = require('../config/redis');

// Lấy danh sách tất cả restaurants
exports.getAllRestaurants = async (req, res) => {
    try {
        const cacheKey = 'restaurants:all';
        if (redisClient) {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log('[REDIS] Cache hit for getAllRestaurants');
                return res.json(JSON.parse(cachedData));
            }
        }

        const r = await pool.query(
            'SELECT id, name, address, rating, image_url, lat, lng FROM restaurants ORDER BY id'
        );

        if (redisClient) {
            await redisClient.set(cacheKey, JSON.stringify(r.rows), 'EX', 300); // Cache 5 phút
        }

        return res.json(r.rows);
    } catch (e) {
        console.error('GET /api/v1/restaurants error', e);
        return res.status(500).json({ error: 'failed_to_fetch_restaurants' });
    }
};

// Haversine formula helper
function haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Get nearby merchants based on user's GPS location (new method with menus_merchant)
exports.getNearbyMerchants = async (req, res) => {
    try {
        const { lat, lng, radius = 10 } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng required' });
        }

        const userLat = parseFloat(lat);
        const userLng = parseFloat(lng);
        const maxRadius = parseFloat(radius); // km

        if (isNaN(userLat) || isNaN(userLng) || isNaN(maxRadius)) {
            return res.status(400).json({ error: 'invalid coordinates or radius' });
        }

        // Cache key name uses 2 decimal points for lat/lng to group nearby requests slightly
        const cacheKey = `merchants:nearby:${userLat.toFixed(2)}:${userLng.toFixed(2)}:${maxRadius}`;

        if (redisClient) {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                console.log(`[REDIS] Cache hit for ${cacheKey}`);
                return res.json(JSON.parse(cachedData));
            }
        }

        const result = await pool.query(
            `SELECT 
        id, 
        name, 
        address, 
        description,
        phone,
        latitude, 
        longitude,
        image_url,
        is_active
      FROM menus_merchant 
      WHERE is_active = true 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL`
        );

        const merchantsWithDistance = result.rows
            .map((merchant) => {
                const distance = haversineDistance(
                    userLat,
                    userLng,
                    parseFloat(merchant.latitude),
                    parseFloat(merchant.longitude)
                );

                return {
                    ...merchant,
                    distance: parseFloat(distance.toFixed(2)),
                };
            })
            .filter((m) => m.distance <= maxRadius)
            .sort((a, b) => a.distance - b.distance);

        const responseData = {
            merchants: merchantsWithDistance,
            total: merchantsWithDistance.length,
            userLocation: { lat: userLat, lng: userLng },
            radius: maxRadius,
        };

        if (redisClient) {
            await redisClient.set(cacheKey, JSON.stringify(responseData), 'EX', 300); // Cache 5 phút
        }

        res.json(responseData);
    } catch (err) {
        console.error('[MERCHANTS NEARBY] Error:', err);
        res.status(500).json({ error: 'failed_to_fetch_nearby_merchants', message: err.message });
    }
};

// Alias for backward compatibility (restaurants -> merchants)
exports.getNearbyRestaurantsOldDb = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'invalid_location', message: 'lat and lng are required' });
        }

        const r = await pool.query(
            `SELECT 
        id, 
        name, 
        address, 
        rating, 
        image_url, 
        lat, 
        lng,
        CASE 
          WHEN lat IS NOT NULL AND lng IS NOT NULL 
          THEN SQRT(POWER($1 - lat, 2) + POWER($2 - lng, 2)) * 111.0
          ELSE NULL 
        END AS distance
      FROM restaurants
      WHERE lat IS NOT NULL 
        AND lng IS NOT NULL
        AND SQRT(POWER($1 - lat, 2) + POWER($2 - lng, 2)) * 111.0 <= 15.0
      ORDER BY distance ASC
      LIMIT 50`,
            [lat, lng]
        );

        return res.json(r.rows);
    } catch (e) {
        console.error('GET /api/v1/restaurants/nearby error', e);
        return res.status(500).json({ error: 'failed_to_fetch_nearby_restaurants' });
    }
};

// Lấy chi tiết 1 restaurant
exports.getRestaurantById = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'invalid_restaurant_id' });
    }
    try {
        const r = await pool.query(
            'SELECT id, name, address, rating, image_url, lat, lng FROM restaurants WHERE id = $1',
            [id]
        );
        if (r.rowCount === 0) {
            return res.status(404).json({ error: 'restaurant_not_found' });
        }
        return res.json(r.rows[0]);
    } catch (e) {
        console.error('GET /api/v1/restaurants/:id error', e);
        return res.status(500).json({ error: 'failed_to_fetch_restaurant_detail' });
    }
};

// Lấy menu (products) của 1 restaurant
exports.getRestaurantMenu = async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
        return res.status(400).json({ error: 'invalid_restaurant_id' });
    }
    try {
        const r = await pool.query(
            'SELECT id, restaurant_id, name, description, price, image_url FROM products WHERE restaurant_id = $1 ORDER BY id',
            [id]
        );
        return res.json(r.rows);
    } catch (e) {
        console.error('GET /api/v1/restaurants/:id/menu error', e);
        return res.status(500).json({ error: 'failed_to_fetch_menu' });
    }
};

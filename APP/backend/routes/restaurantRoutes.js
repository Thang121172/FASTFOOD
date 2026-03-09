const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');

router.get('/restaurants', restaurantController.getAllRestaurants);
// Lưu ý: route detail (/:id) phải nằm sau các route cụ thể như /nearby để tránh conflict
router.get('/restaurants/nearby', restaurantController.getNearbyMerchants); // Hoặc mapping sang getNearbyRestaurantsOldDb tuỳ theo logic hiện tại
router.get('/merchants/nearby', restaurantController.getNearbyMerchants);
router.get('/restaurants/:id', restaurantController.getRestaurantById);
router.get('/restaurants/:id/menu', restaurantController.getRestaurantMenu);

module.exports = router;

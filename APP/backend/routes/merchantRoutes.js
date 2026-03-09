const express = require('express');
const router = express.Router();
const merchantController = require('../controllers/merchantController');
const { requireAuth } = require('../middlewares/auth');

router.get('/merchant/menu', requireAuth, merchantController.getMerchantMenu);
router.post('/merchant/menu', requireAuth, merchantController.addMenuItem);
router.patch('/merchant/menu/:id', requireAuth, merchantController.updateMenuItem);
router.delete('/merchant/menu/:id', requireAuth, merchantController.deleteMenuItem);
router.get('/merchant/orders', requireAuth, merchantController.getMerchantOrders);
router.patch('/merchant/orders/:id/status', requireAuth, merchantController.updateOrderStatus);
router.get('/merchant/revenue', requireAuth, merchantController.getMerchantRevenue);
router.post('/inventory/:id/adjust_stock', requireAuth, merchantController.adjustStock);
router.post('/merchant/orders/:id/handle_out_of_stock', requireAuth, merchantController.handleOutOfStock);
router.post('/merchant/orders/:id/refund', requireAuth, merchantController.processRefund);

module.exports = router;

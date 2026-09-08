const express = require('express');
const router = express.Router();
const {
  getSales, getSalesSummary, getDailySales, getMonthlySales, createSale, sendSaleEmail, getTopProducts
} = require('../controllers/salesController');
const { protect } = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(protect);

router.get('/', roleCheck('admin', 'manager', 'store_owner'), getSales);
router.get('/summary', roleCheck('admin', 'manager', 'store_owner'), getSalesSummary);
router.get('/daily', roleCheck('admin', 'manager', 'store_owner'), getDailySales);
router.get('/monthly', roleCheck('admin', 'manager', 'store_owner'), getMonthlySales);
router.get('/top-products', roleCheck('admin', 'manager', 'store_owner'), getTopProducts);

// Staff personal performance
const { getMySales } = require('../controllers/salesController');
router.get('/me', getMySales);

// Sales creation is open to staff as well (for POS)
router.post('/', roleCheck('admin', 'manager', 'store_owner', 'staff'), createSale);

// Send or resend bill email to customer
router.post('/:id/send-email', roleCheck('admin', 'manager', 'store_owner', 'staff'), sendSaleEmail);

// Delete sale is only for admin/store_owner
const { deleteSale } = require('../controllers/salesController');
router.delete('/:id', roleCheck('admin', 'store_owner'), deleteSale);

module.exports = router;

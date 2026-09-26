const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/payments.controller');

const router = express.Router();

router.get('/farmer/:id', requireAuth, asyncHandler(controller.listPaymentsForFarmer));
router.patch('/:id/process', requireAuth, requireRole('officer', 'admin'), asyncHandler(controller.processPayment));

module.exports = router;

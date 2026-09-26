const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/farmers.controller');

const router = express.Router();

router.get('/search', requireAuth, requireRole('operator', 'officer', 'admin'), asyncHandler(controller.searchFarmers));
router.get('/:id', requireAuth, asyncHandler(controller.getFarmerSummary));
router.put('/:id', requireAuth, asyncHandler(controller.updateFarmer));

module.exports = router;

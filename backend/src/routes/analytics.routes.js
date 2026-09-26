const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/analytics.controller');

const router = express.Router();

router.get('/overview', requireAuth, requireRole('admin', 'officer'), asyncHandler(controller.getOverview));
router.get('/centres', requireAuth, requireRole('admin', 'officer'), asyncHandler(controller.getCentrePerformance));

module.exports = router;

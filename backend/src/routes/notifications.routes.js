const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/notifications.controller');

const router = express.Router();

router.get('/farmer/:id', requireAuth, asyncHandler(controller.listNotificationsForFarmer));
router.post('/', requireAuth, requireRole('operator', 'officer', 'admin'), asyncHandler(controller.sendNotification));

module.exports = router;

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/queue.controller');

const router = express.Router();

router.get('/centre/:centreId', requireAuth, asyncHandler(controller.getCentreQueue));
router.get('/token/:tokenId', requireAuth, asyncHandler(controller.getTokenQueueStatus));

module.exports = router;

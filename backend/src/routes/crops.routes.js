const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/crops.controller');

const router = express.Router();

router.post('/', requireAuth, asyncHandler(controller.createCrop));
router.get('/farmer/:id', requireAuth, asyncHandler(controller.listCropsForFarmer));
router.patch('/:id/status', requireAuth, asyncHandler(controller.updateCropStatus));

module.exports = router;

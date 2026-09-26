const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/centres.controller');

const router = express.Router();

router.get('/', asyncHandler(controller.listCentres));
router.get('/workload', requireAuth, asyncHandler(controller.centreWorkload));
router.get('/:id', asyncHandler(controller.getCentre));

module.exports = router;

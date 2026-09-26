const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/auth');
const controller = require('../controllers/slots.controller');

const router = express.Router();

router.get('/centre/:id', asyncHandler(controller.listSlotsForCentre));
router.post('/book', requireAuth, asyncHandler(controller.bookSlot));

module.exports = router;

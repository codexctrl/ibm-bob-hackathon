const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/procurement.controller');
const rateSuggestion = require('../controllers/rateSuggestion.controller');

const router = express.Router();

// AI-assisted rate suggestion — must come before /:id-style routes.
router.get(
  '/rate-suggestion',
  requireAuth,
  requireRole('officer', 'admin'),
  asyncHandler(rateSuggestion.getRateSuggestion)
);

router.post('/weighing', requireAuth, requireRole('officer', 'admin'), asyncHandler(controller.recordWeighing));
router.post('/quality', requireAuth, requireRole('officer', 'admin'), asyncHandler(controller.recordQualityCheck));
router.post('/approve', requireAuth, requireRole('officer', 'admin'), asyncHandler(controller.approveProcurement));

module.exports = router;

const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/tokens.controller');

const router = express.Router();

router.post('/', requireAuth, asyncHandler(controller.issueToken));
router.get('/:id', requireAuth, asyncHandler(controller.getToken));
router.patch(
  '/:id/status',
  requireAuth,
  requireRole('officer', 'admin'),
  asyncHandler(controller.updateTokenStatus)
);

module.exports = router;

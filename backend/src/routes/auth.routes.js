const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth, requireRole } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', asyncHandler(authController.login));

// Operator/admin registers a farmer who has no smartphone.
router.post(
  '/assisted-register',
  requireAuth,
  requireRole('operator', 'admin'),
  asyncHandler(authController.assistedRegister)
);

module.exports = router;

'use strict';

const express = require('express');
const {
  login,
  getMe,
  logout,
  changePassword,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const {
  loginBodySchema,
  changePasswordBodySchema,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/login', authLimiter, validate({ body: loginBodySchema }), login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);
router.patch(
  '/change-password',
  authenticate,
  validate({ body: changePasswordBodySchema }),
  changePassword
);

module.exports = router;

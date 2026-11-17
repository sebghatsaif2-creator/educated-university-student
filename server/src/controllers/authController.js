'use strict';

const bcrypt = require('bcrypt');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { signToken } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Precomputed dummy hash to prevent username enumeration via timing side-channels
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('kunduz-dummy-timing-guard-password', 10);

/**
 * POST /api/auth/login
 * Authenticate an officer or admin and return a signed JWT.
 */
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};

  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    throw new AppError(
      'نام کاربری و رمز عبور الزامی است.',
      400,
      'AUTH_MISSING_CREDENTIALS'
    );
  }

  const normalizedUsername = username.trim().toLowerCase();
  const user = await User.findOne({ username: normalizedUsername }).select('+passwordHash');

  if (!user) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    throw new AppError(
      'نام کاربری یا رمز عبور نادرست است.',
      401,
      'AUTH_INVALID_CREDENTIALS'
    );
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError(
      'نام کاربری یا رمز عبور نادرست است.',
      401,
      'AUTH_INVALID_CREDENTIALS'
    );
  }

  if (!user.isActive) {
    throw new AppError(
      'حساب کاربری شما غیرفعال است. لطفاً با مدیر سیستم تماس بگیرید.',
      403,
      'AUTH_USER_INACTIVE'
    );
  }

  const now = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
  user.lastLoginAt = now;

  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: 'ورود موفقانه انجام شد.',
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn: env.jwtExpiresIn,
      user: user.toJSON(),
    },
  });
});

/**
 * GET /api/auth/me
 * Return profile of currently authenticated staff member.
 */
const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user.toJSON(),
    },
  });
});

/**
 * POST /api/auth/logout
 * Stateless JWT logout acknowledgement (client discards stored token).
 */
const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'خروج از سیستم موفقانه انجام شد.',
  });
});

/**
 * PATCH /api/auth/change-password
 * Allow an authenticated user to change their own password.
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (
    typeof currentPassword !== 'string' ||
    typeof newPassword !== 'string' ||
    !currentPassword ||
    !newPassword
  ) {
    throw new AppError(
      'رمز عبور فعلی و رمز عبور جدید الزامی است.',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new AppError(
      'رمز عبور جدید باید بین ۸ تا ۱۲۸ حرف باشد.',
      400,
      'VALIDATION_ERROR'
    );
  }

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) {
    throw new AppError('حساب کاربری یافت نشد.', 404, 'USER_NOT_FOUND');
  }

  const isCurrentValid = await user.comparePassword(currentPassword);
  if (!isCurrentValid) {
    throw new AppError('رمز عبور فعلی نادرست است.', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  const token = signToken(user);

  res.status(200).json({
    success: true,
    message: 'رمز عبور موفقانه تغییر یافت.',
    data: {
      token,
      tokenType: 'Bearer',
      expiresIn: env.jwtExpiresIn,
    },
  });
});

module.exports = {
  login,
  getMe,
  logout,
  changePassword,
};

'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const JWT_ISSUER = 'kunduz-university-cert-system';

/**
 * Generate a signed JWT for an authenticated staff user (officer | admin).
 * @param {import('mongoose').Document} user
 * @returns {string}
 */
function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      username: user.username,
      role: user.role,
    },
    env.jwtSecret,
    {
      expiresIn: env.jwtExpiresIn,
      issuer: JWT_ISSUER,
      algorithm: 'HS256',
    }
  );
}

/**
 * Express middleware: verify Bearer JWT and attach active User document to `req.user`.
 */
async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError(
        'احراز هویت الزامی است. لطفاً وارد سیستم شوید.',
        401,
        'AUTH_TOKEN_MISSING'
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError(
        'توکن احراز هویت ارسال نشده است.',
        401,
        'AUTH_TOKEN_MISSING'
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtSecret, {
        issuer: JWT_ISSUER,
        algorithms: ['HS256'],
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError(
          'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید.',
          401,
          'AUTH_TOKEN_EXPIRED'
        );
      }
      throw new AppError(
        'توکن احراز هویت نامعتبر است.',
        401,
        'AUTH_TOKEN_INVALID'
      );
    }

    const user = await User.findById(decoded.sub);
    if (!user) {
      throw new AppError(
        'حساب کاربری مربوط به این توکن یافت نشد.',
        401,
        'AUTH_USER_NOT_FOUND'
      );
    }

    if (!user.isActive) {
      throw new AppError(
        'حساب کاربری شما غیرفعال شده است. با مدیر سیستم تماس بگیرید.',
        403,
        'AUTH_USER_INACTIVE'
      );
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Role-based access control middleware factory.
 * Usage: `router.get('/users', authenticate, authorize('admin'), handler)`
 * @param  {...('officer'|'admin')} allowedRoles
 */
function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new AppError('احراز هویت الزامی است.', 401, 'AUTH_TOKEN_MISSING')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          'شما صلاحیت دسترسی به این بخش را ندارید.',
          403,
          'AUTH_FORBIDDEN'
        )
      );
    }

    return next();
  };
}

/**
 * Optional authentication: attaches `req.user` when a valid Bearer JWT is supplied,
 * otherwise proceeds silently as a public/unauthenticated caller.
 */
async function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return next();
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, env.jwtSecret, {
      issuer: JWT_ISSUER,
      algorithms: ['HS256'],
    });
    const user = await User.findById(decoded.sub);
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignore invalid/expired token on optional-auth public routes
  }
  return next();
}

module.exports = {
  signToken,
  authenticate,
  optionalAuthenticate,
  authorize,
  JWT_ISSUER,
};

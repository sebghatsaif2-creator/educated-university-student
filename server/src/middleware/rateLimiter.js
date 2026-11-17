'use strict';

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه بعد دوباره تلاش نمایید.',
  },
});

const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'تلاش‌های ورود بیش از حد مجاز است. لطفاً پس از ۱۵ دقیقه دوباره کوشش نمایید.',
  },
});

const publicRequestLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.nodeEnv === 'test' ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    code: 'REQUEST_RATE_LIMIT_EXCEEDED',
    message: 'تعداد ثبت درخواست از این دستگاه بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش نمایید.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  publicRequestLimiter,
};

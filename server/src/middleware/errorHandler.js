'use strict';

const env = require('../config/env');
const AppError = require('../utils/AppError');

/**
 * Wrap async Express route handlers and forward rejections to central errorHandler.
 */
function asyncHandler(fn) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched API routes.
 */
function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      `مسیر درخواستی یافت نشد: ${req.method} ${req.originalUrl}`,
      404,
      'ROUTE_NOT_FOUND'
    )
  );
}

/**
 * Central Express error handler.
 */
function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'خطای داخلی سرور رخ داد.';
  let details = err.details || null;

  // Malformed JSON request body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'فارمت داده‌های JSON ارسال‌شده نادرست است.';
  }
  // Payload too large
  else if (err.type === 'entity.too.large') {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'حجم درخواست بیش از حد مجاز است.';
  }
  // Zod schema validation error
  else if (err.name === 'ZodError' && Array.isArray(err.issues)) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details = err.issues.map((issue) => ({
      field: Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'root',
      message: issue.message || 'مقدار واردشده معتبر نیست.',
    }));
    message =
      details.length === 1
        ? details[0].message
        : 'اطلاعات واردشده معتبر نیست. لطفاً موارد مشخص‌شده را اصلاح نمایید.';
  }
  // Mongoose schema validation error
  else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'اطلاعات واردشده معتبر نیست.';
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }
  // Mongoose invalid ObjectId / type cast
  else if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `مقدار نامعتبر برای فیلد ${err.path}.`;
  }
  // MongoDB duplicate key error
  else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const fields = err.keyPattern
      ? Object.keys(err.keyPattern)
      : err.keyValue
        ? Object.keys(err.keyValue)
        : [];
    const fieldLabel = fields.length ? ` (${fields.join(', ')})` : '';
    message = `این مقدار قبلاً در سیستم ثبت شده است${fieldLabel}.`;
    if (fields.length) {
      details = fields.map((field) => ({ field, message: 'مقدار تکراری است.' }));
    }
  }
  // JWT errors if thrown outside authenticate middleware
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'AUTH_TOKEN_EXPIRED';
    message = 'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد شوید.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'AUTH_TOKEN_INVALID';
    message = 'توکن احراز هویت نامعتبر است.';
  }
  // Hide unexpected non-operational error internals
  else if (!err.isOperational && statusCode >= 500) {
    console.error('[error]', err);
    code = 'INTERNAL_ERROR';
    message = 'خطای غیرمنتظره در سرور رخ داد. لطفاً دوباره تلاش نمایید.';
  }

  const payload = {
    success: false,
    code,
    message,
  };

  if (details) {
    payload.details = details;
  }

  if (!env.isProd && statusCode >= 500 && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

module.exports = {
  asyncHandler,
  notFoundHandler,
  errorHandler,
};

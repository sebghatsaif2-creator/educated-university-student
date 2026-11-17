'use strict';

class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message (Dari primary)
   * @param {number} statusCode - HTTP status code
   * @param {string} [code] - Machine-readable error code
   * @param {Array|Object|null} [details] - Optional field validation details
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

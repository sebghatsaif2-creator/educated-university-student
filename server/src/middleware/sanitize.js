'use strict';

const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const PASSWORD_KEYS = new Set(['password', 'currentPassword', 'newPassword', 'confirmPassword']);

/**
 * Clean dangerous HTML/script constructs and control bytes from a string
 * while preserving full Dari/Pashto Unicode (including ZWNJ \u200C) and whitespace.
 * @param {string} input
 * @returns {string}
 */
function sanitizeString(input) {
  return (
    input
      // Remove null bytes and unsafe C0 control chars (preserve \t \n \r)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      // Strip <script>, <iframe>, <object>, <embed>, <style> blocks completely
      .replace(/<\s*(script|iframe|object|embed|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
      // Strip remaining HTML tags (preserves {{placeholder}} tokens and plain punctuation)
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Neutralize javascript: and vbscript: protocol schemes
      .replace(/\b(javascript|vbscript)\s*:/gi, '')
  );
}

/**
 * Recursively sanitize an arbitrary request value against NoSQL operator injection
 * ($-prefixed or dotted keys), prototype pollution, and XSS tags.
 * @param {unknown} value
 * @param {string} [parentKey]
 * @param {number} [depth]
 * @returns {unknown}
 */
function sanitizeValue(value, parentKey = '', depth = 0) {
  if (depth > 20 || value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Preserve exact characters in password fields (except null bytes)
    if (PASSWORD_KEYS.has(parentKey)) {
      return value.replace(/\u0000/g, '');
    }
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, parentKey, depth + 1));
  }

  if (typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    // Reject non-string objects injected into password fields (e.g. { "$ne": null })
    if (PASSWORD_KEYS.has(parentKey)) {
      return undefined;
    }

    const cleaned = {};
    for (const key of Object.keys(value)) {
      if (PROTOTYPE_KEYS.has(key)) continue;
      if (key.startsWith('$') || key.includes('.')) continue;
      cleaned[key] = sanitizeValue(value[key], key, depth + 1);
    }
    return cleaned;
  }

  return value;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params in place.
 */
function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    const cleanedQuery = sanitizeValue(req.query);
    for (const key of Object.keys(req.query)) {
      delete req.query[key];
    }
    Object.assign(req.query, cleanedQuery);
  }
  if (req.params && typeof req.params === 'object') {
    const cleanedParams = sanitizeValue(req.params);
    for (const key of Object.keys(req.params)) {
      delete req.params[key];
    }
    Object.assign(req.params, cleanedParams);
  }
  next();
}

module.exports = {
  sanitizeRequest,
  sanitizeValue,
  sanitizeString,
};

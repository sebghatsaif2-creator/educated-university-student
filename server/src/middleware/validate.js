'use strict';

const AppError = require('../utils/AppError');

/**
 * Format Zod v4 issues into a clean array of `{ field, message }` objects in Dari.
 * @param {Array} issues
 */
function formatZodIssues(issues = []) {
  return issues.map((issue) => ({
    field: Array.isArray(issue.path) && issue.path.length ? issue.path.join('.') : 'root',
    message: issue.message || 'مقدار واردشده معتبر نیست.',
  }));
}

/**
 * Express middleware factory validating `req.body`, `req.query`, and/or `req.params`
 * with Zod schemas and returning localized Dari validation error messages.
 *
 * @param {object} schemas
 * @param {import('zod').ZodTypeAny} [schemas.body]
 * @param {import('zod').ZodTypeAny} [schemas.query]
 * @param {import('zod').ZodTypeAny} [schemas.params]
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    const allIssues = [];

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params || {});
      if (!parsed.success) {
        allIssues.push(...formatZodIssues(parsed.error.issues));
      } else {
        for (const key of Object.keys(req.params)) delete req.params[key];
        Object.assign(req.params, parsed.data);
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query || {});
      if (!parsed.success) {
        allIssues.push(...formatZodIssues(parsed.error.issues));
      } else {
        for (const key of Object.keys(req.query)) delete req.query[key];
        Object.assign(req.query, parsed.data);
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body ?? {});
      if (!parsed.success) {
        allIssues.push(...formatZodIssues(parsed.error.issues));
      } else {
        req.body = parsed.data;
      }
    }

    if (allIssues.length > 0) {
      const primaryMessage =
        allIssues.length === 1
          ? allIssues[0].message
          : 'اطلاعات واردشده معتبر نیست. لطفاً موارد مشخص‌شده را اصلاح نمایید.';
      return next(new AppError(primaryMessage, 400, 'VALIDATION_ERROR', allIssues));
    }

    return next();
  };
}

module.exports = {
  validate,
  formatZodIssues,
};

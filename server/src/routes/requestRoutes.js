'use strict';

const express = require('express');
const {
  createRequest,
  trackRequest,
  listRequests,
  getRequestById,
  approveRequest,
  rejectRequest,
  updateFinalText,
  setRequestTemplate,
  regenerateRequestText,
  printRequest,
  previewRequestCertificate,
  generateRequestPdf,
} = require('../controllers/requestController');
const { authenticate, authorize } = require('../middleware/auth');
const { publicRequestLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../validators/common');
const {
  createRequestBodySchema,
  trackCodeParamSchema,
  listRequestsQuerySchema,
  approveRequestBodySchema,
  rejectRequestBodySchema,
  updateFinalTextBodySchema,
  setTemplateBodySchema,
  printRequestBodySchema,
  previewRequestQuerySchema,
  pdfRequestBodySchema,
} = require('../validators/requestValidators');

const router = express.Router();

// ---------------------------------------------------------------------------
// Public endpoints (Applicant — no login required)
// ---------------------------------------------------------------------------
router.post(
  '/',
  publicRequestLimiter,
  validate({ body: createRequestBodySchema }),
  createRequest
);

router.get(
  '/track/:code',
  validate({ params: trackCodeParamSchema }),
  trackRequest
);

// ---------------------------------------------------------------------------
// Protected endpoints (Officer & Admin workflow)
// ---------------------------------------------------------------------------
router.use(authenticate, authorize('officer', 'admin'));

router.get('/', validate({ query: listRequestsQuerySchema }), listRequests);
router.get('/:id', validate({ params: idParamSchema }), getRequestById);

// Approve (generates unique serial like KU-2026-000123, officialNo, and trilingual finalText)
const approveHandlers = [
  validate({ params: idParamSchema, body: approveRequestBodySchema }),
  approveRequest,
];
router.patch('/:id/approve', ...approveHandlers);
router.post('/:id/approve', ...approveHandlers);

// Reject with mandatory Dari reason
const rejectHandlers = [
  validate({ params: idParamSchema, body: rejectRequestBodySchema }),
  rejectRequest,
];
router.patch('/:id/reject', ...rejectHandlers);
router.post('/:id/reject', ...rejectHandlers);

// Update finalText per language (fa, ps, en)
const finalTextHandlers = [
  validate({ params: idParamSchema, body: updateFinalTextBodySchema }),
  updateFinalText,
];
router.patch('/:id/final-text', ...finalTextHandlers);
router.put('/:id/final-text', ...finalTextHandlers);

// Assign templateId (and optionally regenerate finalText)
const setTemplateHandlers = [
  validate({ params: idParamSchema, body: setTemplateBodySchema }),
  setRequestTemplate,
];
router.patch('/:id/template', ...setTemplateHandlers);
router.put('/:id/template', ...setTemplateHandlers);

// Rebuild default trilingual text from current template and gender
router.post(
  '/:id/regenerate-text',
  validate({ params: idParamSchema }),
  regenerateRequestText
);

// Live HTML certificate preview (A4 landscape, supports ?template=<keyOrId>)
router.get(
  '/:id/preview',
  validate({ params: idParamSchema, query: previewRequestQuerySchema }),
  previewRequestCertificate
);

// Render certificate PDF via Puppeteer and log entry in printLogs
router.post(
  '/:id/pdf',
  validate({ params: idParamSchema, body: pdfRequestBodySchema }),
  generateRequestPdf
);

// Record certificate print / reprint in printLogs
router.post(
  '/:id/print',
  validate({ params: idParamSchema, body: printRequestBodySchema }),
  printRequest
);

module.exports = router;

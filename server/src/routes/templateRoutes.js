'use strict';

const express = require('express');
const {
  listTemplates,
  getTemplate,
  previewTemplateSample,
  createTemplate,
  updateTemplate,
  toggleTemplateActive,
  deleteTemplate,
} = require('../controllers/templateController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  listTemplatesQuerySchema,
  templateIdOrKeyParamSchema,
  templatePreviewQuerySchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  toggleTemplateBodySchema,
} = require('../validators/adminValidators');

const router = express.Router();

// Officer & Admin: view active themes (admin can add ?all=true) & live sample previews
router.get(
  '/',
  authenticate,
  authorize('officer', 'admin'),
  validate({ query: listTemplatesQuerySchema }),
  listTemplates
);
router.get(
  '/:id/preview',
  authenticate,
  authorize('officer', 'admin'),
  validate({ params: templateIdOrKeyParamSchema, query: templatePreviewQuerySchema }),
  previewTemplateSample
);
router.get(
  '/:id',
  authenticate,
  authorize('officer', 'admin'),
  validate({ params: templateIdOrKeyParamSchema }),
  getTemplate
);

// Admin only: create, update (including textDefaults & isActive), toggle, delete
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createTemplateBodySchema }),
  createTemplate
);
router.patch(
  '/:id/toggle',
  authenticate,
  authorize('admin'),
  validate({ params: templateIdOrKeyParamSchema, body: toggleTemplateBodySchema }),
  toggleTemplateActive
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: templateIdOrKeyParamSchema, body: updateTemplateBodySchema }),
  updateTemplate
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: templateIdOrKeyParamSchema, body: updateTemplateBodySchema }),
  updateTemplate
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: templateIdOrKeyParamSchema }),
  deleteTemplate
);

module.exports = router;

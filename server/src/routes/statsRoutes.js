'use strict';

const express = require('express');
const { getSummary, getReport } = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { statsReportQuerySchema } = require('../validators/adminValidators');

const router = express.Router();

// Officer & Admin: quick summary card counts (preserved from Stage 1)
router.get('/summary', authenticate, authorize('officer', 'admin'), getSummary);

// Admin only: detailed statistical report
const reportHandlers = [
  authenticate,
  authorize('admin'),
  validate({ query: statsReportQuerySchema }),
  getReport,
];
router.get('/', ...reportHandlers);
router.get('/report', ...reportHandlers);

module.exports = router;

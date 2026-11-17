'use strict';

const express = require('express');
const { listPrintLogs } = require('../controllers/statsController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { listPrintLogsQuerySchema } = require('../validators/adminValidators');

const router = express.Router();

router.get(
  '/',
  authenticate,
  authorize('officer', 'admin'),
  validate({ query: listPrintLogsQuerySchema }),
  listPrintLogs
);

module.exports = router;

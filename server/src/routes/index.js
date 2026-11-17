'use strict';

const express = require('express');
const mongoose = require('mongoose');

const authRoutes = require('./authRoutes');
const requestRoutes = require('./requestRoutes');
const userRoutes = require('./userRoutes');
const facultyRoutes = require('./facultyRoutes');
const departmentRoutes = require('./departmentRoutes');
const templateRoutes = require('./templateRoutes');
const statsRoutes = require('./statsRoutes');
const printLogRoutes = require('./printLogRoutes');
const { verifyCertificate } = require('../controllers/verifyController');
const { validate } = require('../middleware/validate');
const { verifySerialParamSchema } = require('../validators/requestValidators');

const router = express.Router();

// Health check (public, offline LAN diagnostics)
router.get('/health', (_req, res) => {
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const readyState = mongoose.connection.readyState;

  res.status(readyState === 1 ? 200 : 503).json({
    success: readyState === 1,
    service: 'kunduz-university-certificate-api',
    institution: {
      fa: 'پوهنتون کندز — وزارت تحصیلات عالی',
      ps: 'د کندز پوهنتون — د لوړو زده کړو وزارت',
      en: 'Kunduz University — Ministry of Higher Education',
    },
    offlineMode: true,
    database: dbStates[readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Auth (/api/auth/*)
router.use('/auth', authRoutes);

// Certificate requests — public create & track + officer/admin workflow (/api/requests/*)
router.use('/requests', requestRoutes);

// Public QR verification (/api/verify/:serial)
router.get(
  '/verify/:serial',
  validate({ params: verifySerialParamSchema }),
  verifyCertificate
);

// Academic catalog — public read + admin CRUD
router.use('/faculties', facultyRoutes);
router.use('/departments', departmentRoutes);

// Certificate templates — officer/admin read + admin CRUD
router.use('/templates', templateRoutes);

// Staff accounts — admin CRUD
router.use('/users', userRoutes);

// Statistics & print audit logs
router.use('/stats', statsRoutes);
router.use('/print-logs', printLogRoutes);

module.exports = router;

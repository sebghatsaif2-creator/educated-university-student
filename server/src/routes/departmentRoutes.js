'use strict';

const express = require('express');
const {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/catalogController');
const {
  authenticate,
  optionalAuthenticate,
  authorize,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../validators/common');
const {
  listDepartmentsQuerySchema,
  createDepartmentBodySchema,
  updateDepartmentBodySchema,
} = require('../validators/adminValidators');

const router = express.Router();

// Public: GET /api/departments?faculty=<facultyId>
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: listDepartmentsQuerySchema }),
  listDepartments
);
router.get(
  '/:id',
  optionalAuthenticate,
  validate({ params: idParamSchema }),
  getDepartmentById
);

// Admin CRUD endpoints
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createDepartmentBodySchema }),
  createDepartment
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema, body: updateDepartmentBodySchema }),
  updateDepartment
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema, body: updateDepartmentBodySchema }),
  updateDepartment
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema }),
  deleteDepartment
);

module.exports = router;

'use strict';

const express = require('express');
const {
  listFaculties,
  getFacultyById,
  listDepartmentsByFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} = require('../controllers/catalogController');
const {
  authenticate,
  optionalAuthenticate,
  authorize,
} = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParamSchema } = require('../validators/common');
const {
  listFacultiesQuerySchema,
  createFacultyBodySchema,
  updateFacultyBodySchema,
  facultyIdParamSchema,
} = require('../validators/adminValidators');

const router = express.Router();

// Public read endpoints (admins may pass ?includeInactive=true with token)
router.get(
  '/',
  optionalAuthenticate,
  validate({ query: listFacultiesQuerySchema }),
  listFaculties
);
router.get(
  '/:facultyId/departments',
  validate({ params: facultyIdParamSchema }),
  listDepartmentsByFaculty
);
router.get(
  '/:id',
  optionalAuthenticate,
  validate({ params: idParamSchema }),
  getFacultyById
);

// Admin CRUD endpoints
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: createFacultyBodySchema }),
  createFaculty
);
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema, body: updateFacultyBodySchema }),
  updateFaculty
);
router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema, body: updateFacultyBodySchema }),
  updateFaculty
);
router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ params: idParamSchema }),
  deleteFaculty
);

module.exports = router;

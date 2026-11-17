'use strict';

const { Faculty, Department, Request } = require('../models');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../middleware/errorHandler');

// ===========================================================================
// Faculties (Public Read + Admin CRUD)
// ===========================================================================

/**
 * GET /api/faculties
 * Public: list active faculties nested with active departments.
 * Admin: pass `?includeInactive=true` with Bearer token to include inactive records.
 */
const listFaculties = asyncHandler(async (req, res) => {
  const showInactive =
    req.user?.role === 'admin' && req.query.includeInactive === true;
  const filter = showInactive ? {} : { isActive: true };

  const [faculties, departments] = await Promise.all([
    Faculty.find(filter).sort({ code: 1, 'name.fa': 1 }).lean(),
    Department.find(filter).sort({ code: 1, 'name.fa': 1 }).lean(),
  ]);

  const deptByFaculty = new Map();
  for (const dept of departments) {
    const key = dept.facultyId.toString();
    if (!deptByFaculty.has(key)) {
      deptByFaculty.set(key, []);
    }
    const { __v, ...cleanDept } = dept;
    deptByFaculty.get(key).push(cleanDept);
  }

  const data = faculties.map(({ __v, ...fac }) => ({
    ...fac,
    departments: deptByFaculty.get(fac._id.toString()) || [],
  }));

  res.status(200).json({
    success: true,
    count: data.length,
    data: { faculties: data },
  });
});

/**
 * GET /api/faculties/:id
 * Return a single faculty along with its departments.
 */
const getFacultyById = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const faculty = await Faculty.findById(req.params.id).lean();

  if (!faculty || (!faculty.isActive && !isAdmin)) {
    throw new AppError('پوهنځی مورد نظر یافت نشد.', 404, 'FACULTY_NOT_FOUND');
  }

  const deptFilter = isAdmin
    ? { facultyId: faculty._id }
    : { facultyId: faculty._id, isActive: true };
  const departments = await Department.find(deptFilter).sort({ code: 1, 'name.fa': 1 });

  const { __v, ...cleanFaculty } = faculty;

  res.status(200).json({
    success: true,
    data: {
      faculty: {
        ...cleanFaculty,
        departments,
      },
    },
  });
});

/**
 * GET /api/faculties/:facultyId/departments
 * Public: return active departments for a given faculty (preserved from Stage 1).
 */
const listDepartmentsByFaculty = asyncHandler(async (req, res) => {
  const { facultyId } = req.params;
  const faculty = await Faculty.findById(facultyId);
  if (!faculty || !faculty.isActive) {
    throw new AppError('پوهنځی مورد نظر یافت نشد.', 404, 'FACULTY_NOT_FOUND');
  }

  const departments = await Department.find({ facultyId, isActive: true }).sort({
    code: 1,
    'name.fa': 1,
  });

  res.status(200).json({
    success: true,
    count: departments.length,
    data: {
      faculty,
      departments,
    },
  });
});

/**
 * POST /api/faculties (Admin)
 * Create a new faculty with trilingual names (fa, ps, en).
 */
const createFaculty = asyncHandler(async (req, res) => {
  const { code, name, isActive } = req.body;

  if (code) {
    const codeExists = await Faculty.findOne({ code });
    if (codeExists) {
      throw new AppError('کود پوهنځی قبلاً ثبت شده است.', 409, 'DUPLICATE_KEY');
    }
  }

  const nameExists = await Faculty.findOne({ 'name.en': name.en });
  if (nameExists) {
    throw new AppError('پوهنځی با این نام انگلیسی قبلاً ثبت شده است.', 409, 'DUPLICATE_KEY');
  }

  const payload = { name, isActive };
  if (code) payload.code = code;

  const faculty = await Faculty.create(payload);

  res.status(201).json({
    success: true,
    message: 'پوهنځی جدید موفقانه ایجاد گردید.',
    data: { faculty },
  });
});

/**
 * PATCH|PUT /api/faculties/:id (Admin)
 * Update a faculty's code, trilingual names, or active state.
 */
const updateFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) {
    throw new AppError('پوهنځی مورد نظر یافت نشد.', 404, 'FACULTY_NOT_FOUND');
  }

  const { code, name, isActive } = req.body;

  if (code && code !== faculty.code) {
    const dupCode = await Faculty.findOne({ code, _id: { $ne: faculty._id } });
    if (dupCode) {
      throw new AppError('کود پوهنځی قبلاً ثبت شده است.', 409, 'DUPLICATE_KEY');
    }
    faculty.code = code;
  }

  if (name) {
    if (name.en && name.en !== faculty.name.en) {
      const dupName = await Faculty.findOne({ 'name.en': name.en, _id: { $ne: faculty._id } });
      if (dupName) {
        throw new AppError('پوهنځی با این نام انگلیسی قبلاً ثبت شده است.', 409, 'DUPLICATE_KEY');
      }
    }
    faculty.name = {
      fa: name.fa ?? faculty.name.fa,
      ps: name.ps ?? faculty.name.ps,
      en: name.en ?? faculty.name.en,
    };
  }

  if (typeof isActive === 'boolean') {
    faculty.isActive = isActive;
  }

  await faculty.save();

  res.status(200).json({
    success: true,
    message: 'اطلاعات پوهنځی موفقانه ویرایش گردید.',
    data: { faculty },
  });
});

/**
 * DELETE /api/faculties/:id (Admin)
 * Delete a faculty if no departments or certificate requests depend on it.
 */
const deleteFaculty = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) {
    throw new AppError('پوهنځی مورد نظر یافت نشد.', 404, 'FACULTY_NOT_FOUND');
  }

  const [deptCount, reqCount] = await Promise.all([
    Department.countDocuments({ facultyId: faculty._id }),
    Request.countDocuments({ facultyId: faculty._id }),
  ]);

  if (deptCount > 0 || reqCount > 0) {
    throw new AppError(
      'این پوهنځی دارای دیپارتمنت یا درخواست ثبت‌شده است و قابل حذف نمی‌باشد؛ می‌توانید آن را غیرفعال نمایید.',
      409,
      'FACULTY_IN_USE'
    );
  }

  await faculty.deleteOne();

  res.status(200).json({
    success: true,
    message: 'پوهنځی موفقانه حذف گردید.',
  });
});

// ===========================================================================
// Departments (Public GET /api/departments?faculty= + Admin CRUD)
// ===========================================================================

/**
 * GET /api/departments?faculty=<facultyId>
 * Public: list active departments (optionally filtered by faculty).
 * Admin: pass `?includeInactive=true` with Bearer token to include inactive records.
 */
const listDepartments = asyncHandler(async (req, res) => {
  const { faculty, facultyId, includeInactive } = req.query;
  const targetFacultyId = faculty || facultyId;
  const showInactive = req.user?.role === 'admin' && includeInactive === true;

  const filter = {};
  if (!showInactive) {
    filter.isActive = true;
  }

  if (targetFacultyId) {
    const parentFaculty = await Faculty.findById(targetFacultyId).select('code name isActive');
    if (!parentFaculty || (!parentFaculty.isActive && !showInactive)) {
      throw new AppError('پوهنځی مورد نظر یافت نشد.', 404, 'FACULTY_NOT_FOUND');
    }
    filter.facultyId = parentFaculty._id;
  }

  const departments = await Department.find(filter)
    .populate('facultyId', 'code name isActive')
    .sort({ code: 1, 'name.fa': 1 });

  res.status(200).json({
    success: true,
    count: departments.length,
    data: { departments },
  });
});

/**
 * GET /api/departments/:id
 * Get a single department by ID.
 */
const getDepartmentById = asyncHandler(async (req, res) => {
  const isAdmin = req.user?.role === 'admin';
  const department = await Department.findById(req.params.id).populate(
    'facultyId',
    'code name isActive'
  );

  if (!department || (!department.isActive && !isAdmin)) {
    throw new AppError('دیپارتمنت مورد نظر یافت نشد.', 404, 'DEPARTMENT_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { department },
  });
});

/**
 * POST /api/departments (Admin)
 * Create a new department under an existing faculty with trilingual names.
 */
const createDepartment = asyncHandler(async (req, res) => {
  const { facultyId, code, name, isActive } = req.body;

  const faculty = await Faculty.findById(facultyId);
  if (!faculty) {
    throw new AppError('پوهنځی انتخاب‌شده یافت نشد.', 404, 'FACULTY_NOT_FOUND');
  }

  const existing = await Department.findOne({ facultyId, 'name.en': name.en });
  if (existing) {
    throw new AppError(
      'این دیپارتمنت قبلاً در پوهنځی انتخاب‌شده ثبت گردیده است.',
      409,
      'DUPLICATE_KEY'
    );
  }

  const payload = { facultyId, name, isActive };
  if (code) payload.code = code;

  const created = await Department.create(payload);
  const department = await Department.findById(created._id).populate(
    'facultyId',
    'code name isActive'
  );

  res.status(201).json({
    success: true,
    message: 'دیپارتمنت جدید موفقانه ایجاد گردید.',
    data: { department },
  });
});

/**
 * PATCH|PUT /api/departments/:id (Admin)
 * Update a department's faculty, code, trilingual names, or active status.
 */
const updateDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) {
    throw new AppError('دیپارتمنت مورد نظر یافت نشد.', 404, 'DEPARTMENT_NOT_FOUND');
  }

  const { facultyId, code, name, isActive } = req.body;

  if (facultyId && facultyId !== department.facultyId.toString()) {
    const targetFaculty = await Faculty.findById(facultyId);
    if (!targetFaculty) {
      throw new AppError('پوهنځی انتخاب‌شده یافت نشد.', 404, 'FACULTY_NOT_FOUND');
    }
    department.facultyId = targetFaculty._id;
  }

  if (code !== undefined) {
    department.code = code;
  }

  if (name) {
    const nextEn = name.en ?? department.name.en;
    const dup = await Department.findOne({
      facultyId: department.facultyId,
      'name.en': nextEn,
      _id: { $ne: department._id },
    });
    if (dup) {
      throw new AppError(
        'دیپارتمنتی با این نام انگلیسی در این پوهنځی قبلاً ثبت شده است.',
        409,
        'DUPLICATE_KEY'
      );
    }

    department.name = {
      fa: name.fa ?? department.name.fa,
      ps: name.ps ?? department.name.ps,
      en: nextEn,
    };
  }

  if (typeof isActive === 'boolean') {
    department.isActive = isActive;
  }

  await department.save();
  const populated = await Department.findById(department._id).populate(
    'facultyId',
    'code name isActive'
  );

  res.status(200).json({
    success: true,
    message: 'اطلاعات دیپارتمنت موفقانه ویرایش گردید.',
    data: { department: populated },
  });
});

/**
 * DELETE /api/departments/:id (Admin)
 * Delete a department if no certificate requests reference it.
 */
const deleteDepartment = asyncHandler(async (req, res) => {
  const department = await Department.findById(req.params.id);
  if (!department) {
    throw new AppError('دیپارتمنت مورد نظر یافت نشد.', 404, 'DEPARTMENT_NOT_FOUND');
  }

  const reqCount = await Request.countDocuments({ departmentId: department._id });
  if (reqCount > 0) {
    throw new AppError(
      'برای این دیپارتمنت درخواست تصدیق‌نامه ثبت شده است و قابل حذف نمی‌باشد؛ می‌توانید آن را غیرفعال نمایید.',
      409,
      'DEPARTMENT_IN_USE'
    );
  }

  await department.deleteOne();

  res.status(200).json({
    success: true,
    message: 'دیپارتمنت موفقانه حذف گردید.',
  });
});

module.exports = {
  listFaculties,
  getFacultyById,
  listDepartmentsByFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};

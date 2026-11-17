'use strict';

const {
  User,
  Faculty,
  Department,
  Template,
  Request,
  PrintLog,
  Asset,
} = require('../models');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../middleware/errorHandler');
const { parseDateBoundary } = require('../validators/common');

/**
 * GET /api/stats/summary (Officer | Admin)
 * Quick dashboard counts (preserved from Stage 1).
 */
const getSummary = asyncHandler(async (_req, res) => {
  const [
    statusGroups,
    facultiesCount,
    departmentsCount,
    templatesCount,
    printLogsCount,
    assetsCount,
  ] = await Promise.all([
    Request.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Faculty.countDocuments({ isActive: true }),
    Department.countDocuments({ isActive: true }),
    Template.countDocuments({ isActive: true }),
    PrintLog.countDocuments(),
    Asset.countDocuments({ isActive: true }),
  ]);

  const requestsByStatus = {
    pending: 0,
    approved: 0,
    rejected: 0,
    printed: 0,
    total: 0,
  };

  for (const row of statusGroups) {
    if (Object.prototype.hasOwnProperty.call(requestsByStatus, row._id)) {
      requestsByStatus[row._id] = row.count;
      requestsByStatus.total += row.count;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      requests: requestsByStatus,
      faculties: facultiesCount,
      departments: departmentsCount,
      templates: templatesCount,
      printLogs: printLogsCount,
      assets: assetsCount,
    },
  });
});

/**
 * GET /api/stats/report (Admin)
 * Comprehensive statistical report across requests, faculties, genders, degrees, and prints.
 */
const getReport = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const start = parseDateBoundary(dateFrom, 'start');
  const end = parseDateBoundary(dateTo, 'end');

  if (start && end && start > end) {
    throw new AppError(
      'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
      400,
      'VALIDATION_ERROR'
    );
  }

  const reqFilter = {};
  const printFilter = {};
  if (start || end) {
    reqFilter.createdAt = {};
    printFilter.printedAt = {};
    if (start) {
      reqFilter.createdAt.$gte = start;
      printFilter.printedAt.$gte = start;
    }
    if (end) {
      reqFilter.createdAt.$lte = end;
      printFilter.printedAt.$lte = end;
    }
  }

  const [
    requests,
    faculties,
    departmentsCount,
    users,
    templates,
    assetsCount,
    printLogs,
    recentPrints,
  ] = await Promise.all([
    Request.find(reqFilter)
      .select('status facultyId gender degreeLevel gradYearSH createdAt')
      .lean(),
    Faculty.find().select('code name isActive').sort({ code: 1 }).lean(),
    Department.countDocuments({ isActive: true }),
    User.find().select('role isActive').lean(),
    Template.find().select('key name isActive').lean(),
    Asset.countDocuments({ isActive: true }),
    PrintLog.find(printFilter).select('templateKey isReprint printedAt').lean(),
    PrintLog.find(printFilter)
      .populate('requestId', 'firstName fatherName trackingCode serial status')
      .populate('printedBy', 'name username role')
      .sort({ printedAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const byStatus = { pending: 0, approved: 0, rejected: 0, printed: 0, total: requests.length };
  const byGender = { male: 0, female: 0 };
  const byDegreeLevel = { associate: 0, bachelor: 0, master: 0, phd: 0 };
  const facultyStatsMap = new Map();
  const yearMap = new Map();

  for (const fac of faculties) {
    facultyStatsMap.set(fac._id.toString(), {
      facultyId: fac._id,
      code: fac.code || '',
      name: fac.name,
      isActive: fac.isActive,
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      printed: 0,
    });
  }

  for (const r of requests) {
    if (Object.prototype.hasOwnProperty.call(byStatus, r.status)) {
      byStatus[r.status] += 1;
    }
    if (Object.prototype.hasOwnProperty.call(byGender, r.gender)) {
      byGender[r.gender] += 1;
    }
    if (Object.prototype.hasOwnProperty.call(byDegreeLevel, r.degreeLevel)) {
      byDegreeLevel[r.degreeLevel] += 1;
    }

    const fKey = r.facultyId?.toString();
    if (fKey && facultyStatsMap.has(fKey)) {
      const entry = facultyStatsMap.get(fKey);
      entry.total += 1;
      if (Object.prototype.hasOwnProperty.call(entry, r.status)) {
        entry[r.status] += 1;
      }
    }

    if (r.gradYearSH != null) {
      yearMap.set(r.gradYearSH, (yearMap.get(r.gradYearSH) || 0) + 1);
    }
  }

  const byGradYearSH = Array.from(yearMap.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([gradYearSH, count]) => ({ gradYearSH, count }));

  let initialPrints = 0;
  let reprints = 0;
  const templatePrintCounts = new Map();
  for (const log of printLogs) {
    if (log.isReprint) reprints += 1;
    else initialPrints += 1;
    templatePrintCounts.set(
      log.templateKey,
      (templatePrintCounts.get(log.templateKey) || 0) + 1
    );
  }

  const printsByTemplate = Array.from(templatePrintCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([templateKey, count]) => ({ templateKey, count }));

  const userSummary = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    admins: users.filter((u) => u.role === 'admin').length,
    officers: users.filter((u) => u.role === 'officer').length,
  };

  res.status(200).json({
    success: true,
    data: {
      period: {
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      },
      requests: {
        byStatus,
        byGender,
        byDegreeLevel,
        byFaculty: Array.from(facultyStatsMap.values()),
        byGradYearSH,
      },
      prints: {
        total: printLogs.length,
        initialPrints,
        reprints,
        byTemplate: printsByTemplate,
        recent: recentPrints.map(({ __v, ...rest }) => rest),
      },
      system: {
        users: userSummary,
        faculties: faculties.filter((f) => f.isActive).length,
        totalFaculties: faculties.length,
        departments: departmentsCount,
        activeTemplates: templates.filter((t) => t.isActive).length,
        totalTemplates: templates.length,
        assets: assetsCount,
      },
      generatedAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /api/print-logs (Officer | Admin)
 * List immutable print audit records with optional filters & pagination.
 */
const listPrintLogs = asyncHandler(async (req, res) => {
  const { requestId, printedBy, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (requestId) filter.requestId = requestId;
  if (printedBy) filter.printedBy = printedBy;

  if (dateFrom || dateTo) {
    const start = parseDateBoundary(dateFrom, 'start');
    const end = parseDateBoundary(dateTo, 'end');
    if (start && end && start > end) {
      throw new AppError(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
        400,
        'VALIDATION_ERROR'
      );
    }
    filter.printedAt = {};
    if (start) filter.printedAt.$gte = start;
    if (end) filter.printedAt.$lte = end;
  }

  const skip = (page - 1) * limit;

  const [total, printLogs] = await Promise.all([
    PrintLog.countDocuments(filter),
    PrintLog.find(filter)
      .populate('requestId', 'firstName fatherName trackingCode serial officialNo status')
      .populate('templateId', 'key name')
      .populate('printedBy', 'name username role')
      .sort({ printedAt: -1 })
      .skip(skip)
      .limit(limit),
  ]);

  res.status(200).json({
    success: true,
    count: printLogs.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    data: { printLogs },
  });
});

module.exports = {
  getSummary,
  getReport,
  listPrintLogs,
};

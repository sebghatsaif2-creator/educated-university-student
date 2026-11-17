'use strict';

const crypto = require('crypto');
const {
  Request,
  Faculty,
  Department,
  PrintLog,
} = require('../models');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  getCurrentSolarHijriYear,
  generateTrackingCode,
} = require('../utils/trackingCode');
const { generateCertificateText } = require('../services/textGenerator');
const {
  generateCertificateSerial,
  generateOfficialNo,
} = require('../services/serialGenerator');
const {
  resolveActiveTemplate,
  recordRequestPrint,
} = require('../services/printService');
const {
  prepareCertificateRender,
  generateCertificatePdf,
} = require('../services/pdfService');
const { parseDateBoundary, escapeRegex } = require('../validators/common');
const { normalizeDigits } = require('../validators/requestValidators');

/**
 * Helper: load a request with all standard references populated.
 */
function populateRequestQuery(query) {
  return query
    .populate('facultyId', 'code name isActive')
    .populate('departmentId', 'code name facultyId isActive')
    .populate('templateId', 'key name labels isActive isDefault')
    .populate('approvedBy', 'name username role');
}

/**
 * Allocate a guaranteed-unique tracking code for a new request.
 */
async function createUniqueTrackingCode() {
  const shYear = getCurrentSolarHijriYear();
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const code = generateTrackingCode(shYear);
    const exists = await Request.findOne({ trackingCode: code }).select('_id').lean();
    if (!exists) return code;
  }
  throw new AppError(
    'خطا در تولید کود پیگیری یکتا. لطفاً دوباره تلاش نمایید.',
    500,
    'TRACKING_CODE_ERROR'
  );
}

/**
 * POST /api/requests (Public — Applicant)
 * Create a new certificate request and return its unique trackingCode.
 */
const createRequest = asyncHandler(async (req, res) => {
  const {
    firstName,
    fatherName,
    firstNameI18n,
    fatherNameI18n,
    gender,
    nationalId,
    phone,
    email,
    facultyId,
    departmentId,
    gradYearSH,
    gradYearAD,
    degreeLevel,
    notes,
  } = req.body;

  const [faculty, department] = await Promise.all([
    Faculty.findById(facultyId),
    Department.findById(departmentId),
  ]);

  if (!faculty || !faculty.isActive) {
    throw new AppError('پوهنځی انتخاب‌شده یافت نشد یا غیرفعال است.', 404, 'FACULTY_NOT_FOUND');
  }

  if (!department || !department.isActive) {
    throw new AppError(
      'دیپارتمنت انتخاب‌شده یافت نشد یا غیرفعال است.',
      404,
      'DEPARTMENT_NOT_FOUND'
    );
  }

  if (department.facultyId.toString() !== faculty._id.toString()) {
    throw new AppError(
      'دیپارتمنت انتخاب‌شده مربوط به پوهنځی انتخاب‌شده نمی‌باشد.',
      400,
      'DEPARTMENT_FACULTY_MISMATCH'
    );
  }

  const resolvedGradYearAD = gradYearAD != null ? gradYearAD : gradYearSH + 621;
  const trackingCode = await createUniqueTrackingCode();

  const created = await Request.create({
    firstName,
    fatherName,
    firstNameI18n: {
      fa: firstNameI18n?.fa || '',
      ps: firstNameI18n?.ps || '',
      en: firstNameI18n?.en || '',
    },
    fatherNameI18n: {
      fa: fatherNameI18n?.fa || '',
      ps: fatherNameI18n?.ps || '',
      en: fatherNameI18n?.en || '',
    },
    gender,
    nationalId,
    phone,
    email: email || '',
    facultyId: faculty._id,
    departmentId: department._id,
    gradYearSH,
    gradYearAD: resolvedGradYearAD,
    degreeLevel,
    notes: notes || '',
    trackingCode,
    status: 'pending',
  });

  const populated = await populateRequestQuery(Request.findById(created._id));

  res.status(201).json({
    success: true,
    message:
      'درخواست تصدیق‌نامه شما موفقانه ثبت گردید. لطفاً کود پیگیری خود را برای پیگیری بعدی حفظ نمایید.',
    data: {
      trackingCode: created.trackingCode,
      request: populated,
    },
  });
});

/**
 * GET /api/requests/track/:code (Public — Applicant)
 * Track a request's current status using its unique trackingCode.
 */
const trackRequest = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const request = await Request.findOne({ trackingCode: code })
    .populate('facultyId', 'code name')
    .populate('departmentId', 'code name')
    .lean();

  if (!request) {
    throw new AppError(
      'درخواستی با این کود پیگیری در سیستم یافت نشد.',
      404,
      'REQUEST_NOT_FOUND'
    );
  }

  const isApprovedOrPrinted = request.status === 'approved' || request.status === 'printed';

  res.status(200).json({
    success: true,
    data: {
      request: {
        trackingCode: request.trackingCode,
        firstName: request.firstName,
        fatherName: request.fatherName,
        gender: request.gender,
        faculty: request.facultyId
          ? { _id: request.facultyId._id, code: request.facultyId.code, name: request.facultyId.name }
          : null,
        department: request.departmentId
          ? {
              _id: request.departmentId._id,
              code: request.departmentId.code,
              name: request.departmentId.name,
            }
          : null,
        gradYearSH: request.gradYearSH,
        gradYearAD: request.gradYearAD,
        degreeLevel: request.degreeLevel,
        status: request.status,
        rejectReason: request.status === 'rejected' ? request.rejectReason : '',
        serial: isApprovedOrPrinted ? request.serial || null : null,
        officialNo: isApprovedOrPrinted ? request.officialNo || '' : '',
        approvedAt: request.approvedAt || null,
        printedAt: request.printedAt || null,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      },
    },
  });
});

/**
 * GET /api/requests (Officer | Admin)
 * List certificate requests with filtering (status, faculty, department, date range, search) & pagination.
 */
const listRequests = asyncHandler(async (req, res) => {
  const {
    status,
    faculty,
    facultyId,
    department,
    departmentId,
    date,
    dateFrom,
    dateTo,
    gradYearSH,
    search,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = req.query;

  const filter = {};

  if (status) {
    filter.status = status;
  }

  const resolvedFaculty = faculty || facultyId;
  if (resolvedFaculty) {
    filter.facultyId = resolvedFaculty;
  }

  const resolvedDept = department || departmentId;
  if (resolvedDept) {
    filter.departmentId = resolvedDept;
  }

  if (gradYearSH != null) {
    filter.gradYearSH = gradYearSH;
  }

  if (date) {
    filter.createdAt = {
      $gte: parseDateBoundary(date, 'start'),
      $lte: parseDateBoundary(date, 'end'),
    };
  } else if (dateFrom || dateTo) {
    const start = parseDateBoundary(dateFrom, 'start');
    const end = parseDateBoundary(dateTo, 'end');
    if (start && end && start > end) {
      throw new AppError(
        'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.',
        400,
        'VALIDATION_ERROR'
      );
    }
    filter.createdAt = {};
    if (start) filter.createdAt.$gte = start;
    if (end) filter.createdAt.$lte = end;
  }

  if (search) {
    const normalizedSearch = normalizeDigits(search);
    const rx = new RegExp(escapeRegex(search), 'i');
    const rxNorm = new RegExp(escapeRegex(normalizedSearch), 'i');
    filter.$or = [
      { firstName: rx },
      { fatherName: rx },
      { 'firstNameI18n.fa': rx },
      { 'firstNameI18n.ps': rx },
      { 'firstNameI18n.en': rx },
      { nationalId: rxNorm },
      { trackingCode: rxNorm },
      { serial: rxNorm },
      { officialNo: rxNorm },
      { phone: rxNorm },
    ];
  }

  const skip = (page - 1) * limit;
  const sortOrder = sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };

  const [total, requests] = await Promise.all([
    Request.countDocuments(filter),
    populateRequestQuery(Request.find(filter).sort(sortOrder).skip(skip).limit(limit)),
  ]);

  res.status(200).json({
    success: true,
    count: requests.length,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    data: { requests },
  });
});

/**
 * GET /api/requests/:id (Officer | Admin)
 * Get full details of a single request plus its print audit log.
 */
const getRequestById = asyncHandler(async (req, res) => {
  const request = await populateRequestQuery(Request.findById(req.params.id));
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  const printLogs = await PrintLog.find({ requestId: request._id })
    .populate('printedBy', 'name username role')
    .populate('templateId', 'key name')
    .sort({ printedAt: -1 });

  res.status(200).json({
    success: true,
    data: {
      request,
      printLogs,
    },
  });
});

/**
 * PATCH /api/requests/:id/approve (Officer | Admin)
 * Approve a pending request: assigns atomic serial (KU-YYYY-000123), officialNo,
 * active templateId, and generated trilingual gender-aware finalText.
 */
const approveRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'approved' || request.status === 'printed') {
    throw new AppError(
      'این درخواست قبلاً تأیید شده است.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'درخواست ردشده قابل تأیید مستقیم نمی‌باشد.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const {
    templateId: preferredTemplateId,
    officialNo: customOfficialNo,
    firstNameI18n,
    fatherNameI18n,
    finalText: customFinalText,
  } = req.body;

  const [template, faculty, department] = await Promise.all([
    resolveActiveTemplate(preferredTemplateId, request.templateId),
    Faculty.findById(request.facultyId),
    Department.findById(request.departmentId),
  ]);

  if (!faculty || !department) {
    throw new AppError(
      'پوهنځی یا دیپارتمنت مرتبط با این درخواست یافت نشد.',
      400,
      'CATALOG_REFERENCE_MISSING'
    );
  }

  // Apply optional trilingual name spellings prior to generating certificate text
  if (firstNameI18n) {
    request.firstNameI18n = {
      fa: firstNameI18n.fa ?? request.firstNameI18n?.fa ?? '',
      ps: firstNameI18n.ps ?? request.firstNameI18n?.ps ?? '',
      en: firstNameI18n.en ?? request.firstNameI18n?.en ?? '',
    };
  }
  if (fatherNameI18n) {
    request.fatherNameI18n = {
      fa: fatherNameI18n.fa ?? request.fatherNameI18n?.fa ?? '',
      ps: fatherNameI18n.ps ?? request.fatherNameI18n?.ps ?? '',
      en: fatherNameI18n.en ?? request.fatherNameI18n?.en ?? '',
    };
  }

  const serial = await generateCertificateSerial();
  const officialNo =
    customOfficialNo ||
    (await generateOfficialNo({ facultyCode: faculty.code || 'REG' }));

  request.serial = serial;
  request.officialNo = officialNo;
  request.templateId = template._id;

  const generatedText = generateCertificateText({
    template,
    request,
    faculty,
    department,
  });

  request.finalText = {
    fa: customFinalText?.fa || generatedText.fa,
    ps: customFinalText?.ps || generatedText.ps,
    en: customFinalText?.en || generatedText.en,
  };

  request.status = 'approved';
  request.rejectReason = '';
  request.approvedBy = req.user._id;
  request.approvedAt = new Date();

  await request.save();

  const populated = await populateRequestQuery(Request.findById(request._id));

  res.status(200).json({
    success: true,
    message: 'درخواست موفقانه تأیید گردید و شماره سریال و نمبر رسمی صادر شد.',
    data: { request: populated },
  });
});

/**
 * PATCH /api/requests/:id/reject (Officer | Admin)
 * Reject a pending request with a mandatory Dari reason.
 */
const rejectRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'printed') {
    throw new AppError(
      'درخواست چاپ‌شده قابل رد کردن نمی‌باشد.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (request.status === 'approved') {
    throw new AppError(
      'درخواست تأییدشده قابل رد کردن نمی‌باشد.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'این درخواست قبلاً رد شده است.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  request.status = 'rejected';
  request.rejectReason = req.body.rejectReason;
  await request.save();

  const populated = await populateRequestQuery(Request.findById(request._id));

  res.status(200).json({
    success: true,
    message: 'درخواست با ذکر دلیل رد گردید.',
    data: { request: populated },
  });
});

/**
 * PATCH /api/requests/:id/final-text (Officer | Admin)
 * Update certificate `finalText` per language (fa, ps, en) without clobbering omitted languages.
 */
const updateFinalText = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'ویرایش متن تصدیق‌نامه برای درخواست ردشده مجاز نیست.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const { finalText, firstNameI18n, fatherNameI18n } = req.body;

  request.finalText = {
    fa: finalText.fa !== undefined ? finalText.fa : request.finalText?.fa || '',
    ps: finalText.ps !== undefined ? finalText.ps : request.finalText?.ps || '',
    en: finalText.en !== undefined ? finalText.en : request.finalText?.en || '',
  };

  if (firstNameI18n) {
    request.firstNameI18n = {
      fa: firstNameI18n.fa ?? request.firstNameI18n?.fa ?? '',
      ps: firstNameI18n.ps ?? request.firstNameI18n?.ps ?? '',
      en: firstNameI18n.en ?? request.firstNameI18n?.en ?? '',
    };
  }
  if (fatherNameI18n) {
    request.fatherNameI18n = {
      fa: fatherNameI18n.fa ?? request.fatherNameI18n?.fa ?? '',
      ps: fatherNameI18n.ps ?? request.fatherNameI18n?.ps ?? '',
      en: fatherNameI18n.en ?? request.fatherNameI18n?.en ?? '',
    };
  }

  await request.save();

  const populated = await populateRequestQuery(Request.findById(request._id));

  res.status(200).json({
    success: true,
    message: 'متن تصدیق‌نامه موفقانه به‌روزرسانی گردید.',
    data: { request: populated },
  });
});

/**
 * PATCH /api/requests/:id/template (Officer | Admin)
 * Assign an active certificate theme (`templateId`) and optionally rebuild `finalText`.
 */
const setRequestTemplate = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'تغییر قالب برای درخواست ردشده مجاز نیست.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const { templateId, regenerateText } = req.body;
  const template = await resolveActiveTemplate(templateId);

  request.templateId = template._id;

  const isTextCurrentlyEmpty =
    !request.finalText?.fa?.trim() &&
    !request.finalText?.ps?.trim() &&
    !request.finalText?.en?.trim();

  const shouldRegenerate =
    regenerateText === true || (regenerateText === undefined && isTextCurrentlyEmpty);

  if (shouldRegenerate) {
    const [faculty, department] = await Promise.all([
      Faculty.findById(request.facultyId),
      Department.findById(request.departmentId),
    ]);
    request.finalText = generateCertificateText({
      template,
      request,
      faculty,
      department,
    });
  }

  await request.save();

  const populated = await populateRequestQuery(Request.findById(request._id));

  res.status(200).json({
    success: true,
    message: 'قالب تصدیق‌نامه موفقانه تنظیم گردید.',
    data: { request: populated },
  });
});

/**
 * POST /api/requests/:id/regenerate-text (Officer | Admin)
 * Rebuild trilingual `finalText` from the assigned (or default) template and request data.
 */
const regenerateRequestText = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'تولید متن برای درخواست ردشده مجاز نیست.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const [template, faculty, department] = await Promise.all([
    resolveActiveTemplate(null, request.templateId),
    Faculty.findById(request.facultyId),
    Department.findById(request.departmentId),
  ]);

  request.templateId = template._id;
  request.finalText = generateCertificateText({
    template,
    request,
    faculty,
    department,
  });
  await request.save();

  const populated = await populateRequestQuery(Request.findById(request._id));

  res.status(200).json({
    success: true,
    message: 'متن پیش‌فرض سه‌زبانه موفقانه بازسازی گردید.',
    data: { request: populated },
  });
});

/**
 * POST /api/requests/:id/print (Officer | Admin)
 * Mark request as printed and record an immutable audit entry in `printLogs`.
 */
const printRequest = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  const { printLog, isReprint } = await recordRequestPrint({
    request,
    userId: req.user._id,
    templateId: req.body.templateId || null,
    reprintReason: req.body.reprintReason || '',
    ipAddress: req.ip || '',
  });

  const [populatedRequest, populatedLog] = await Promise.all([
    populateRequestQuery(Request.findById(request._id)),
    PrintLog.findById(printLog._id)
      .populate('printedBy', 'name username role')
      .populate('templateId', 'key name'),
  ]);

  res.status(200).json({
    success: true,
    message: isReprint
      ? 'چاپ مجدد تصدیق‌نامه موفقانه در گزارش چاپ ثبت گردید.'
      : 'چاپ تصدیق‌نامه موفقانه ثبت گردید.',
    data: {
      isReprint,
      request: populatedRequest,
      printLog: populatedLog,
    },
  });
});

/**
 * GET /api/requests/:id/preview (Officer | Admin)
 * Return live offline HTML certificate preview (optional `?template=<keyOrId>`).
 */
const previewRequestCertificate = asyncHandler(async (req, res) => {
  const request = await populateRequestQuery(Request.findById(req.params.id));
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (request.status === 'rejected') {
    throw new AppError(
      'پیش‌نمایش تصدیق‌نامه برای درخواست ردشده مجاز نیست.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  const templateSelector = req.query.template || req.query.theme || null;
  const isChromeless = req.query.chromeless === true;
  const cspNonce = crypto.randomBytes(16).toString('base64');

  const rendered = await prepareCertificateRender({
    request,
    templateSelector,
    embedAssets: false,
    cspNonce,
    chromeless: isChromeless,
    includeScript: !isChromeless,
  });

  // Strict offline CSP permitting only the nonced autofit script & local fonts/logos
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'`
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Certificate-Theme', rendered.themeKey);

  if (rendered.warnings.length > 0) {
    res.setHeader('X-Certificate-Has-Warning', 'true');
    res.setHeader(
      'X-Certificate-Warning',
      encodeURIComponent(rendered.warnings.join(' | '))
    );
  }

  res.status(200).send(rendered.html);
});

/**
 * POST /api/requests/:id/pdf (Officer | Admin)
 * Render a single-page A4 landscape trilingual PDF via Puppeteer, write an entry
 * in `printLogs`, mark the request as `printed`, and stream back the PDF binary.
 */
const generateRequestPdf = asyncHandler(async (req, res) => {
  const request = await Request.findById(req.params.id);
  if (!request) {
    throw new AppError('درخواست مورد نظر یافت نشد.', 404, 'REQUEST_NOT_FOUND');
  }

  if (!['approved', 'printed'].includes(request.status)) {
    throw new AppError(
      'فقط درخواست‌های تأییدشده قابل چاپ و تولید PDF می‌باشند.',
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }

  if (!request.serial) {
    throw new AppError(
      'این درخواست فاقد شماره سریال معتبر است.',
      400,
      'MISSING_SERIAL'
    );
  }

  const templateSelector = req.body.templateId || req.body.templateKey || null;

  const { pdfBuffer, template, themeKey, warnings } = await generateCertificatePdf({
    request,
    templateSelector,
  });

  // Record audit entry in `printLogs` and transition request to `printed`
  const { printLog, isReprint } = await recordRequestPrint({
    request,
    userId: req.user._id,
    templateId: template._id,
    reprintReason: req.body.reprintReason || '',
    ipAddress: req.ip || '',
  });

  const safeFilename = `certificate-${String(request.serial).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.setHeader('Content-Length', String(pdfBuffer.length));
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Certificate-Serial', request.serial);
  res.setHeader('X-Certificate-Theme', themeKey);
  res.setHeader('X-Print-Log-Id', printLog._id.toString());
  res.setHeader('X-Is-Reprint', String(isReprint));

  if (warnings.length > 0) {
    res.setHeader('X-Certificate-Has-Warning', 'true');
    res.setHeader('X-Certificate-Warning', encodeURIComponent(warnings.join(' | ')));
  }

  res.status(200).end(pdfBuffer);
});

module.exports = {
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
};

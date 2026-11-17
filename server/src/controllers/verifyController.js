'use strict';

const { Request } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * GET /api/verify/:serial (Public — QR Code Verification)
 * Return minimal, privacy-safe certificate verification details (name, faculty, year, status).
 */
const verifyCertificate = asyncHandler(async (req, res) => {
  const { serial } = req.params;

  const request = await Request.findOne({
    serial,
    status: { $in: ['approved', 'printed'] },
  })
    .populate('facultyId', 'code name')
    .populate('departmentId', 'code name')
    .lean();

  if (!request) {
    return res.status(404).json({
      success: false,
      verified: false,
      code: 'CERTIFICATE_NOT_FOUND',
      message: 'تصدیق‌نامه‌ای با این شماره سریال در سیستم پوهنتون کندز یافت نشد.',
    });
  }

  return res.status(200).json({
    success: true,
    verified: true,
    message: 'تصدیق‌نامه معتبر و در سیستم پوهنتون کندز ثبت می‌باشد.',
    data: {
      serial: request.serial,
      officialNo: request.officialNo || '',
      name: request.firstName,
      fatherName: request.fatherName,
      nameI18n: {
        fa: request.firstNameI18n?.fa || request.firstName,
        ps: request.firstNameI18n?.ps || request.firstName,
        en: request.firstNameI18n?.en || request.firstName,
      },
      faculty: request.facultyId?.name || { fa: '', ps: '', en: '' },
      department: request.departmentId?.name || { fa: '', ps: '', en: '' },
      degreeLevel: request.degreeLevel,
      year: {
        sh: request.gradYearSH,
        ad: request.gradYearAD,
      },
      gradYearSH: request.gradYearSH,
      gradYearAD: request.gradYearAD,
      status: request.status,
      approvedAt: request.approvedAt || null,
      printedAt: request.printedAt || null,
    },
  });
});

module.exports = {
  verifyCertificate,
};

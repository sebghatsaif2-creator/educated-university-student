'use strict';

const { Template, PrintLog, Faculty, Department } = require('../models');
const AppError = require('../utils/AppError');
const { generateCertificateText } = require('./textGenerator');

/**
 * Resolve an active template by explicit ID, fallback ID, default flag, or first active.
 * @param {string|import('mongoose').Types.ObjectId|null} [preferredId]
 * @param {string|import('mongoose').Types.ObjectId|null} [fallbackId]
 */
async function resolveActiveTemplate(preferredId = null, fallbackId = null) {
  if (preferredId) {
    const tpl = await Template.findById(preferredId);
    if (!tpl || !tpl.isActive) {
      throw new AppError(
        'قالب انتخاب‌شده یافت نشد یا غیرفعال می‌باشد.',
        400,
        'TEMPLATE_INACTIVE_OR_NOT_FOUND'
      );
    }
    return tpl;
  }

  if (fallbackId) {
    const existingTpl = await Template.findById(fallbackId);
    if (existingTpl && existingTpl.isActive) {
      return existingTpl;
    }
  }

  const defaultTpl =
    (await Template.findOne({ isActive: true, isDefault: true })) ||
    (await Template.findOne({ isActive: true }).sort({ createdAt: 1 }));

  if (!defaultTpl) {
    throw new AppError(
      'هیچ قالب فعالی در سیستم وجود ندارد. لطفاً ابتدا یک قالب را فعال نمایید.',
      400,
      'NO_ACTIVE_TEMPLATE'
    );
  }

  return defaultTpl;
}

/**
 * Mark an approved/printed request as printed and append an audit entry in `printLogs`.
 * Shared by the print workflow endpoint and the upcoming Puppeteer PDF endpoint.
 *
 * @param {object} options
 * @param {import('mongoose').Document} options.request
 * @param {import('mongoose').Types.ObjectId} options.userId
 * @param {string|null} [options.templateId]
 * @param {string} [options.reprintReason]
 * @param {string} [options.ipAddress]
 */
async function recordRequestPrint({
  request,
  userId,
  templateId = null,
  reprintReason = '',
  ipAddress = '',
}) {
  if (!['approved', 'printed'].includes(request.status)) {
    throw new AppError(
      'فقط درخواست‌های تأییدشده قابل چاپ می‌باشند.',
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

  const template = await resolveActiveTemplate(templateId, request.templateId);

  // Ensure trilingual finalText is populated prior to printing
  const hasAllTexts =
    request.finalText?.fa?.trim() &&
    request.finalText?.ps?.trim() &&
    request.finalText?.en?.trim();

  if (!hasAllTexts) {
    const [faculty, department] = await Promise.all([
      Faculty.findById(request.facultyId),
      Department.findById(request.departmentId),
    ]);
    const generated = generateCertificateText({
      template,
      request,
      faculty,
      department,
    });
    request.finalText = {
      fa: request.finalText?.fa?.trim() || generated.fa,
      ps: request.finalText?.ps?.trim() || generated.ps,
      en: request.finalText?.en?.trim() || generated.en,
    };
  }

  const priorCount = await PrintLog.countDocuments({ requestId: request._id });
  const isReprint = request.status === 'printed' || priorCount > 0;
  const now = new Date();

  request.templateId = template._id;
  request.status = 'printed';
  request.printedAt = now;
  await request.save();

  const printLog = await PrintLog.create({
    requestId: request._id,
    templateId: template._id,
    templateKey: template.key,
    printedBy: userId,
    serial: request.serial || '',
    officialNo: request.officialNo || '',
    isReprint,
    reprintReason: isReprint ? String(reprintReason || '').trim() : '',
    ipAddress: String(ipAddress || '').trim(),
    printedAt: now,
  });

  return { request, template, printLog, isReprint };
}

module.exports = {
  resolveActiveTemplate,
  recordRequestPrint,
};

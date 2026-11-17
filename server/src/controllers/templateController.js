'use strict';

const crypto = require('crypto');
const { Template, Request, PrintLog } = require('../models');
const { TEMPLATE_KEYS } = require('../models/Template');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../middleware/errorHandler');
const {
  DEFAULT_TEXT_TEMPLATES,
  generateCertificateText,
} = require('../services/textGenerator');
const {
  buildVerifyUrl,
  generateQrDataUrl,
  loadCertificateAssets,
} = require('../services/pdfService');
const { renderCertificateHtml } = require('../templates/certificateTemplate');
const { OBJECT_ID_REGEX } = require('../validators/common');

const SAMPLE_PREVIEW_DATA = {
  faculty: {
    code: 'CS',
    name: {
      fa: 'پوهنځی کمپیوتر ساینس',
      ps: 'د کمپیوټر ساینس پوهنځی',
      en: 'Faculty of Computer Science',
    },
  },
  department: {
    code: 'SE',
    name: {
      fa: 'انجنیری نرم‌افزار',
      ps: 'سافټویر انجینري',
      en: 'Software Engineering',
    },
  },
  male: {
    firstName: 'احمد فواد',
    fatherName: 'غلام فاروق',
    firstNameI18n: { fa: 'احمد فواد', ps: 'احمد فواد', en: 'Ahmad Fawad' },
    fatherNameI18n: { fa: 'غلام فاروق', ps: 'غلام فاروق', en: 'Ghulam Farooq' },
    gender: 'male',
    nationalId: '1399-0201-45821',
    degreeLevel: 'bachelor',
    gradYearSH: 1404,
    gradYearAD: 2025,
    serial: 'KU-2026-000101',
    officialNo: '1405/CS/0101',
  },
  female: {
    firstName: 'فرشته',
    fatherName: 'محمد اسماعیل',
    firstNameI18n: { fa: 'فرشته', ps: 'فرښته', en: 'Fereshta' },
    fatherNameI18n: { fa: 'محمد اسماعیل', ps: 'محمد اسماعیل', en: 'Mohammad Ismail' },
    gender: 'female',
    nationalId: '1400-0719-88341',
    degreeLevel: 'bachelor',
    gradYearSH: 1404,
    gradYearAD: 2025,
    serial: 'KU-2026-000102',
    officialNo: '1405/CS/0102',
  },
};

/**
 * Locate a template by either MongoDB ObjectId or theme `key` slug.
 */
async function findTemplateByIdOrKey(idOrKey) {
  if (OBJECT_ID_REGEX.test(idOrKey)) {
    return Template.findById(idOrKey);
  }
  return Template.findOne({ key: idOrKey.toLowerCase() });
}

/**
 * GET /api/templates (Officer | Admin)
 * List certificate themes. Admin may pass `?all=true` or `?includeInactive=true` to see inactive themes.
 */
const listTemplates = asyncHandler(async (req, res) => {
  const showAll =
    req.user.role === 'admin' &&
    (req.query.all === true || req.query.includeInactive === true);
  const filter = showAll ? {} : { isActive: true };
  const templates = await Template.find(filter).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    count: templates.length,
    data: { templates },
  });
});

/**
 * GET /api/templates/:id (Officer | Admin)
 * Get a single template by ID or key slug (e.g. `/api/templates/official`).
 */
const getTemplate = asyncHandler(async (req, res) => {
  const template = await findTemplateByIdOrKey(req.params.id);
  if (!template || (!template.isActive && req.user.role !== 'admin')) {
    throw new AppError('قالب مورد نظر یافت نشد.', 404, 'TEMPLATE_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { template },
  });
});

/**
 * POST /api/templates (Admin)
 * Create a new certificate template (falls back to DEFAULT_TEXT_TEMPLATES if omitted).
 */
const createTemplate = asyncHandler(async (req, res) => {
  const { key, name, labels, description, isActive, isDefault, textDefaults } = req.body;

  const existing = await Template.findOne({ key });
  if (existing) {
    throw new AppError('قالبی با این کلید قبلاً در سیستم ثبت شده است.', 409, 'DUPLICATE_KEY');
  }

  if (isDefault && !isActive) {
    throw new AppError(
      'قالب غیرفعال نمی‌تواند به عنوان قالب پیش‌فرض انتخاب شود.',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (isDefault) {
    await Template.updateMany({ isDefault: true }, { $set: { isDefault: false } });
  }

  const template = await Template.create({
    key,
    name,
    labels: labels || { fa: name, ps: name, en: key },
    description: description || '',
    isActive,
    isDefault,
    textDefaults: textDefaults || DEFAULT_TEXT_TEMPLATES,
  });

  res.status(201).json({
    success: true,
    message: 'قالب جدید موفقانه ایجاد گردید.',
    data: { template },
  });
});

/**
 * PATCH|PUT /api/templates/:id (Admin)
 * Update template metadata, activate/deactivate, default status, or default texts (male/female in fa/ps/en).
 */
const updateTemplate = asyncHandler(async (req, res) => {
  const template = await findTemplateByIdOrKey(req.params.id);
  if (!template) {
    throw new AppError('قالب مورد نظر یافت نشد.', 404, 'TEMPLATE_NOT_FOUND');
  }

  const { name, labels, description, isActive, isDefault, textDefaults } = req.body;

  // Prevent deactivating the last active template in the system
  if (isActive === false && template.isActive) {
    const otherActive = await Template.countDocuments({
      _id: { $ne: template._id },
      isActive: true,
    });
    if (otherActive === 0) {
      throw new AppError(
        'حداقل یک قالب فعال باید در سیستم باقی بماند.',
        400,
        'LAST_ACTIVE_TEMPLATE'
      );
    }
  }

  const nextIsActive = isActive !== undefined ? isActive : template.isActive;
  if (isDefault === true && !nextIsActive) {
    throw new AppError(
      'قالب غیرفعال نمی‌تواند به عنوان قالب پیش‌فرض تنظیم شود.',
      400,
      'VALIDATION_ERROR'
    );
  }

  if (name !== undefined) template.name = name;
  if (description !== undefined) template.description = description;
  if (labels) {
    template.labels = {
      fa: labels.fa ?? template.labels?.fa ?? '',
      ps: labels.ps ?? template.labels?.ps ?? '',
      en: labels.en ?? template.labels?.en ?? '',
    };
  }

  if (textDefaults) {
    for (const lang of ['fa', 'ps', 'en']) {
      if (textDefaults[lang]) {
        template.textDefaults[lang] = {
          male: textDefaults[lang].male ?? template.textDefaults[lang].male,
          female: textDefaults[lang].female ?? template.textDefaults[lang].female,
        };
      }
    }
  }

  if (typeof isActive === 'boolean') {
    template.isActive = isActive;
    if (!isActive && template.isDefault) {
      template.isDefault = false;
    }
  }

  if (typeof isDefault === 'boolean') {
    if (isDefault) {
      await Template.updateMany(
        { _id: { $ne: template._id }, isDefault: true },
        { $set: { isDefault: false } }
      );
    }
    template.isDefault = isDefault;
  }

  await template.save();

  res.status(200).json({
    success: true,
    message: 'قالب تصدیق‌نامه موفقانه ویرایش گردید.',
    data: { template },
  });
});

/**
 * PATCH /api/templates/:id/toggle (Admin)
 * Activate or deactivate a template (accepts optional `{ isActive }`, or flips current value).
 */
const toggleTemplateActive = asyncHandler(async (req, res) => {
  const template = await findTemplateByIdOrKey(req.params.id);
  if (!template) {
    throw new AppError('قالب مورد نظر یافت نشد.', 404, 'TEMPLATE_NOT_FOUND');
  }

  const targetState =
    typeof req.body.isActive === 'boolean' ? req.body.isActive : !template.isActive;

  if (!targetState && template.isActive) {
    const otherActive = await Template.countDocuments({
      _id: { $ne: template._id },
      isActive: true,
    });
    if (otherActive === 0) {
      throw new AppError(
        'حداقل یک قالب فعال باید در سیستم باقی بماند.',
        400,
        'LAST_ACTIVE_TEMPLATE'
      );
    }
  }

  template.isActive = targetState;
  if (!targetState && template.isDefault) {
    template.isDefault = false;
  }
  await template.save();

  res.status(200).json({
    success: true,
    message: targetState ? 'قالب موفقانه فعال گردید.' : 'قالب موفقانه غیرفعال گردید.',
    data: { template },
  });
});

/**
 * DELETE /api/templates/:id (Admin)
 * Delete a custom template (built-in 8 themes or referenced templates must be deactivated instead).
 */
const deleteTemplate = asyncHandler(async (req, res) => {
  const template = await findTemplateByIdOrKey(req.params.id);
  if (!template) {
    throw new AppError('قالب مورد نظر یافت نشد.', 404, 'TEMPLATE_NOT_FOUND');
  }

  if (TEMPLATE_KEYS.includes(template.key)) {
    throw new AppError(
      'قالب‌های اصلی سیستم قابل حذف نمی‌باشند؛ در صورت نیاز می‌توانید آن را غیرفعال نمایید.',
      400,
      'BUILTIN_TEMPLATE_PROTECTED'
    );
  }

  const [reqRefs, logRefs] = await Promise.all([
    Request.countDocuments({ templateId: template._id }),
    PrintLog.countDocuments({ templateId: template._id }),
  ]);

  if (reqRefs > 0 || logRefs > 0) {
    throw new AppError(
      'این قالب در درخواست‌ها یا گزارش‌های چاپ استفاده شده و قابل حذف نیست؛ آن را غیرفعال نمایید.',
      409,
      'TEMPLATE_IN_USE'
    );
  }

  await template.deleteOne();

  res.status(200).json({
    success: true,
    message: 'قالب موفقانه حذف گردید.',
  });
});

/**
 * GET /api/templates/:id/preview (Officer | Admin)
 * Render a live offline HTML preview of a certificate template populated with
 * sample graduate data (used by the Officer template picker & Admin template editor).
 */
const previewTemplateSample = asyncHandler(async (req, res) => {
  const template = await findTemplateByIdOrKey(req.params.id);
  if (!template || (!template.isActive && req.user.role !== 'admin')) {
    throw new AppError('قالب مورد نظر یافت نشد.', 404, 'TEMPLATE_NOT_FOUND');
  }

  const gender = req.query.gender === 'female' ? 'female' : 'male';
  const isChromeless = req.query.chromeless !== false;
  const sampleReq = SAMPLE_PREVIEW_DATA[gender];

  const finalText = generateCertificateText({
    template,
    request: sampleReq,
    faculty: SAMPLE_PREVIEW_DATA.faculty,
    department: SAMPLE_PREVIEW_DATA.department,
  });

  const [assets, qrDataUrl] = await Promise.all([
    loadCertificateAssets(),
    generateQrDataUrl(buildVerifyUrl(sampleReq.serial)),
  ]);

  const cspNonce = crypto.randomBytes(16).toString('base64');
  const rendered = renderCertificateHtml({
    themeKey: template.key,
    faculty: SAMPLE_PREVIEW_DATA.faculty,
    finalText,
    serial: sampleReq.serial,
    officialNo: sampleReq.officialNo,
    qrDataUrl,
    assets,
    embedAssets: false,
    isDraft: false,
    cspNonce,
    chromeless: isChromeless,
    includeScript: !isChromeless,
  });

  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'nonce-${cspNonce}'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'`
  );
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Certificate-Theme', rendered.themeKey);
  res.status(200).send(rendered.html);
});

module.exports = {
  listTemplates,
  getTemplate,
  previewTemplateSample,
  createTemplate,
  updateTemplate,
  toggleTemplateActive,
  deleteTemplate,
};

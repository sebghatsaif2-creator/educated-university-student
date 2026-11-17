'use strict';

const { z } = require('zod');
const { REQUEST_STATUSES, GENDERS, DEGREE_LEVELS } = require('../models/Request');
const {
  objectIdSchema,
  optionalTrilingualNameSchema,
  dateQueryField,
  paginationFields,
} = require('./common');

const PHONE_REGEX = /^[+0-9()\-\s۰-۹]{7,30}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize Persian/Dari digits (۰-۹) and Arabic-Indic digits (٠-٩) to ASCII 0-9.
 */
function normalizeDigits(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

const yearSHSchema = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeDigits(v.trim()) : v),
  z.coerce
    .number({ error: 'سال فراغت (هجری شمسی) باید عدد باشد.' })
    .int({ error: 'سال فراغت (هجری شمسی) باید عدد صحیح باشد.' })
    .min(1350, { error: 'سال فراغت هجری شمسی باید بین ۱۳۵۰ تا ۱۴۵۰ باشد.' })
    .max(1450, { error: 'سال فراغت هجری شمسی باید بین ۱۳۵۰ تا ۱۴۵۰ باشد.' })
);

const yearADSchema = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeDigits(v.trim()) : v),
  z.coerce
    .number({ error: 'سال فراغت (میلادی) باید عدد باشد.' })
    .int({ error: 'سال فراغت (میلادی) باید عدد صحیح باشد.' })
    .min(1970, { error: 'سال فراغت میلادی باید بین ۱۹۷۰ تا ۲۰۷۵ باشد.' })
    .max(2075, { error: 'سال فراغت میلادی باید بین ۱۹۷۰ تا ۲۰۷۵ باشد.' })
);

// Public: POST /api/requests
const createRequestBodySchema = z.object({
  firstName: z
    .string({ error: 'نام متقاضی الزامی است.' })
    .trim()
    .min(2, { error: 'نام متقاضی باید حداقل ۲ حرف باشد.' })
    .max(120, { error: 'نام متقاضی نباید بیشتر از ۱۲۰ حرف باشد.' }),
  fatherName: z
    .string({ error: 'نام پدر الزامی است.' })
    .trim()
    .min(2, { error: 'نام پدر باید حداقل ۲ حرف باشد.' })
    .max(120, { error: 'نام پدر نباید بیشتر از ۱۲۰ حرف باشد.' }),
  firstNameI18n: optionalTrilingualNameSchema,
  fatherNameI18n: optionalTrilingualNameSchema,
  gender: z.enum(GENDERS, {
    error: 'جنسیت الزامی است و باید male (ذکور) یا female (اناث) باشد.',
  }),
  nationalId: z
    .string({ error: 'نمبر تذکره الزامی است.' })
    .trim()
    .transform(normalizeDigits)
    .pipe(
      z
        .string()
        .min(3, { error: 'نمبر تذکره باید حداقل ۳ حرف یا رقم باشد.' })
        .max(60, { error: 'نمبر تذکره نباید بیشتر از ۶۰ حرف باشد.' })
    ),
  phone: z
    .string({ error: 'شماره تماس الزامی است.' })
    .trim()
    .regex(PHONE_REGEX, { error: 'شماره تماس واردشده معتبر نیست.' })
    .transform(normalizeDigits),
  email: z
    .string({ error: 'ایمیل باید رشته متنی باشد.' })
    .trim()
    .toLowerCase()
    .max(150, { error: 'ایمیل نباید بیشتر از ۱۵۰ حرف باشد.' })
    .refine((val) => val === '' || EMAIL_REGEX.test(val), {
      error: 'فارمت ایمیل واردشده نادرست است.',
    })
    .optional()
    .default(''),
  facultyId: objectIdSchema('شناسه پوهنځی'),
  departmentId: objectIdSchema('شناسه دیپارتمنت'),
  gradYearSH: yearSHSchema,
  gradYearAD: yearADSchema.optional(),
  degreeLevel: z
    .enum(DEGREE_LEVELS, {
      error: 'مقطع تحصیلی معتبر نیست (associate | bachelor | master | phd).',
    })
    .default('bachelor'),
  notes: z
    .string({ error: 'یادداشت باید رشته متنی باشد.' })
    .trim()
    .max(1000, { error: 'یادداشت نباید بیشتر از ۱۰۰۰ حرف باشد.' })
    .optional()
    .default(''),
});

// Public: GET /api/requests/track/:code
const trackCodeParamSchema = z.object({
  code: z
    .string({ error: 'کود پیگیری الزامی است.' })
    .trim()
    .min(4, { error: 'کود پیگیری واردشده معتبر نیست.' })
    .max(40, { error: 'کود پیگیری واردشده معتبر نیست.' })
    .transform((v) => v.toUpperCase()),
});

// Public: GET /api/verify/:serial
const verifySerialParamSchema = z.object({
  serial: z
    .string({ error: 'شماره سریال الزامی است.' })
    .trim()
    .min(4, { error: 'شماره سریال واردشده معتبر نیست.' })
    .max(60, { error: 'شماره سریال واردشده معتبر نیست.' })
    .transform((v) => v.toUpperCase()),
});

// Officer/Admin: GET /api/requests
const listRequestsQuerySchema = z.object({
  status: z
    .enum(REQUEST_STATUSES, {
      error: 'وضعیت انتخاب‌شده معتبر نیست (pending | approved | rejected | printed).',
    })
    .optional(),
  faculty: objectIdSchema('شناسه پوهنځی').optional(),
  facultyId: objectIdSchema('شناسه پوهنځی').optional(),
  department: objectIdSchema('شناسه دیپارتمنت').optional(),
  departmentId: objectIdSchema('شناسه دیپارتمنت').optional(),
  date: dateQueryField('تاریخ').optional(),
  dateFrom: dateQueryField('تاریخ شروع').optional(),
  dateTo: dateQueryField('تاریخ پایان').optional(),
  gradYearSH: yearSHSchema.optional(),
  search: z
    .string({ error: 'عبارت جستجو باید رشته متنی باشد.' })
    .trim()
    .max(120, { error: 'عبارت جستجو نباید بیشتر از ۱۲۰ حرف باشد.' })
    .optional(),
  sort: z
    .enum(['newest', 'oldest'], { error: 'ترتیب نمایش باید newest یا oldest باشد.' })
    .default('newest'),
  ...paginationFields,
});

const partialFinalTextSchema = z.object({
  fa: z
    .string({ error: 'متن دری باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'متن دری نمی‌تواند خالی باشد.' })
    .max(4000, { error: 'متن دری نباید بیشتر از ۴۰۰۰ حرف باشد.' })
    .optional(),
  ps: z
    .string({ error: 'متن پشتو باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'متن پشتو نمی‌تواند خالی باشد.' })
    .max(4000, { error: 'متن پشتو نباید بیشتر از ۴۰۰۰ حرف باشد.' })
    .optional(),
  en: z
    .string({ error: 'متن انگلیسی باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'متن انگلیسی نمی‌تواند خالی باشد.' })
    .max(4000, { error: 'متن انگلیسی نباید بیشتر از ۴۰۰۰ حرف باشد.' })
    .optional(),
});

// Officer/Admin: PATCH /api/requests/:id/approve
const approveRequestBodySchema = z.object({
  templateId: objectIdSchema('شناسه قالب').optional(),
  officialNo: z
    .string({ error: 'نمبر رسمی باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'نمبر رسمی نمی‌تواند خالی باشد.' })
    .max(80, { error: 'نمبر رسمی نباید بیشتر از ۸۰ حرف باشد.' })
    .optional(),
  firstNameI18n: optionalTrilingualNameSchema,
  fatherNameI18n: optionalTrilingualNameSchema,
  finalText: partialFinalTextSchema.optional(),
});

// Officer/Admin: PATCH /api/requests/:id/reject
const rejectRequestBodySchema = z
  .object({
    reason: z
      .string({ error: 'دلیل رد درخواست باید رشته متنی باشد.' })
      .trim()
      .max(500, { error: 'دلیل رد درخواست نباید بیشتر از ۵۰۰ حرف باشد.' })
      .optional(),
    rejectReason: z
      .string({ error: 'دلیل رد درخواست باید رشته متنی باشد.' })
      .trim()
      .max(500, { error: 'دلیل رد درخواست نباید بیشتر از ۵۰۰ حرف باشد.' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const combined = (data.reason || data.rejectReason || '').trim();
    if (combined.length < 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['rejectReason'],
        message: 'ذکر دلیل رد درخواست (حداقل ۳ حرف) الزامی است.',
      });
    }
  })
  .transform((data) => ({
    rejectReason: (data.reason || data.rejectReason || '').trim(),
  }));

// Officer/Admin: PATCH /api/requests/:id/final-text
// Supports either `{ fa, ps, en }` directly OR `{ finalText: { fa, ps, en }, firstNameI18n, fatherNameI18n }`
const updateFinalTextBodySchema = z
  .object({
    fa: partialFinalTextSchema.shape.fa,
    ps: partialFinalTextSchema.shape.ps,
    en: partialFinalTextSchema.shape.en,
    finalText: partialFinalTextSchema.optional(),
    firstNameI18n: optionalTrilingualNameSchema,
    fatherNameI18n: optionalTrilingualNameSchema,
  })
  .superRefine((data, ctx) => {
    const merged = {
      fa: data.finalText?.fa ?? data.fa,
      ps: data.finalText?.ps ?? data.ps,
      en: data.finalText?.en ?? data.en,
    };
    if (!merged.fa && !merged.ps && !merged.en) {
      ctx.addIssue({
        code: 'custom',
        path: ['finalText'],
        message: 'حداقل متن یکی از زبان‌ها (fa، ps یا en) باید ارسال گردد.',
      });
    }
  })
  .transform((data) => ({
    finalText: {
      ...(data.finalText?.fa ?? data.fa ? { fa: data.finalText?.fa ?? data.fa } : {}),
      ...(data.finalText?.ps ?? data.ps ? { ps: data.finalText?.ps ?? data.ps } : {}),
      ...(data.finalText?.en ?? data.en ? { en: data.finalText?.en ?? data.en } : {}),
    },
    firstNameI18n: data.firstNameI18n,
    fatherNameI18n: data.fatherNameI18n,
  }));

// Officer/Admin: PATCH /api/requests/:id/template
const setTemplateBodySchema = z.object({
  templateId: objectIdSchema('شناسه قالب'),
  regenerateText: z
    .boolean({ error: 'مقدار regenerateText باید بولین (true/false) باشد.' })
    .optional(),
});

// Officer/Admin: POST /api/requests/:id/print
const printRequestBodySchema = z.object({
  templateId: objectIdSchema('شناسه قالب').optional(),
  reprintReason: z
    .string({ error: 'دلیل چاپ مجدد باید رشته متنی باشد.' })
    .trim()
    .max(400, { error: 'دلیل چاپ مجدد نباید بیشتر از ۴۰۰ حرف باشد.' })
    .optional()
    .default(''),
});

// Officer/Admin: GET /api/requests/:id/preview
const previewRequestQuerySchema = z.object({
  template: z
    .string({ error: 'شناسه یا کلید قالب باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'کلید قالب نمی‌تواند خالی باشد.' })
    .max(60, { error: 'کلید قالب معتبر نیست.' })
    .optional(),
  theme: z
    .string({ error: 'کلید قالب باید رشته متنی باشد.' })
    .trim()
    .min(1, { error: 'کلید قالب نمی‌تواند خالی باشد.' })
    .max(60, { error: 'کلید قالب معتبر نیست.' })
    .optional(),
  chromeless: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((v) => v === '1' || v === 'true'),
});

// Officer/Admin: POST /api/requests/:id/pdf
const pdfRequestBodySchema = z.object({
  templateId: objectIdSchema('شناسه قالب').optional(),
  templateKey: z
    .string({ error: 'کلید قالب باید رشته متنی باشد.' })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, { error: 'کلید قالب معتبر نیست.' })
    .max(40, { error: 'کلید قالب معتبر نیست.' })
    .optional(),
  reprintReason: z
    .string({ error: 'دلیل چاپ مجدد باید رشته متنی باشد.' })
    .trim()
    .max(400, { error: 'دلیل چاپ مجدد نباید بیشتر از ۴۰۰ حرف باشد.' })
    .optional()
    .default(''),
});

module.exports = {
  normalizeDigits,
  createRequestBodySchema,
  trackCodeParamSchema,
  verifySerialParamSchema,
  listRequestsQuerySchema,
  approveRequestBodySchema,
  rejectRequestBodySchema,
  updateFinalTextBodySchema,
  setTemplateBodySchema,
  printRequestBodySchema,
  previewRequestQuerySchema,
  pdfRequestBodySchema,
};

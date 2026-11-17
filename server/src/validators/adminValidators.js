'use strict';

const { z } = require('zod');
const { USER_ROLES } = require('../models/User');
const {
  objectIdSchema,
  trilingualRequiredSchema,
  dateQueryField,
  booleanQuerySchema,
  paginationFields,
} = require('./common');

// ---------------------------------------------------------------------------
// Users (Admin CRUD)
// ---------------------------------------------------------------------------
const listUsersQuerySchema = z.object({
  role: z.enum(USER_ROLES, { error: 'نقش کاربر باید officer یا admin باشد.' }).optional(),
  isActive: booleanQuerySchema.optional(),
  search: z.string().trim().max(80, { error: 'عبارت جستجو بیش از حد طولانی است.' }).optional(),
});

const createUserBodySchema = z.object({
  name: z
    .string({ error: 'نام کاربر الزامی است.' })
    .trim()
    .min(2, { error: 'نام کاربر باید حداقل ۲ حرف باشد.' })
    .max(120, { error: 'نام کاربر نباید بیشتر از ۱۲۰ حرف باشد.' }),
  username: z
    .string({ error: 'نام کاربری الزامی است.' })
    .trim()
    .toLowerCase()
    .min(3, { error: 'نام کاربری باید حداقل ۳ حرف باشد.' })
    .max(50, { error: 'نام کاربری نباید بیشتر از ۵۰ حرف باشد.' })
    .regex(/^[a-z0-9._-]+$/, {
      error: 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و نشانه‌های . _ - باشد.',
    }),
  password: z
    .string({ error: 'رمز عبور الزامی است.' })
    .min(8, { error: 'رمز عبور باید حداقل ۸ حرف باشد.' })
    .max(128, { error: 'رمز عبور نباید بیشتر از ۱۲۸ حرف باشد.' }),
  role: z
    .enum(USER_ROLES, { error: 'نقش کاربر باید officer یا admin باشد.' })
    .default('officer'),
  isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).default(true),
});

const updateUserBodySchema = z
  .object({
    name: z
      .string({ error: 'نام کاربر باید رشته متنی باشد.' })
      .trim()
      .min(2, { error: 'نام کاربر باید حداقل ۲ حرف باشد.' })
      .max(120, { error: 'نام کاربر نباید بیشتر از ۱۲۰ حرف باشد.' })
      .optional(),
    username: z
      .string({ error: 'نام کاربری باید رشته متنی باشد.' })
      .trim()
      .toLowerCase()
      .min(3, { error: 'نام کاربری باید حداقل ۳ حرف باشد.' })
      .max(50, { error: 'نام کاربری نباید بیشتر از ۵۰ حرف باشد.' })
      .regex(/^[a-z0-9._-]+$/, {
        error: 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و نشانه‌های . _ - باشد.',
      })
      .optional(),
    password: z
      .string({ error: 'رمز عبور باید رشته متنی باشد.' })
      .min(8, { error: 'رمز عبور باید حداقل ۸ حرف باشد.' })
      .max(128, { error: 'رمز عبور نباید بیشتر از ۱۲۸ حرف باشد.' })
      .optional(),
    role: z.enum(USER_ROLES, { error: 'نقش کاربر باید officer یا admin باشد.' }).optional(),
    isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'حداقل یک فیلد برای ویرایش کاربر باید ارسال شود.',
  });

// ---------------------------------------------------------------------------
// Faculties (Public list + Admin CRUD)
// ---------------------------------------------------------------------------
const listFacultiesQuerySchema = z.object({
  includeInactive: booleanQuerySchema.optional(),
});

const facultyCodeSchema = z
  .string({ error: 'کود پوهنځی باید رشته متنی باشد.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'کود پوهنځی نمی‌تواند خالی باشد.' })
  .max(20, { error: 'کود پوهنځی نباید بیشتر از ۲۰ حرف باشد.' })
  .regex(/^[A-Z0-9_-]+$/, {
    error: 'کود پوهنځی فقط می‌تواند شامل حروف انگلیسی، اعداد، _ و - باشد.',
  });

const createFacultyBodySchema = z.object({
  code: facultyCodeSchema.optional(),
  name: trilingualRequiredSchema('پوهنځی'),
  isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).default(true),
});

const partialTrilingualSchema = z
  .object({
    fa: z
      .string({ error: 'نام دری باید رشته متنی باشد.' })
      .trim()
      .min(2, { error: 'نام دری باید حداقل ۲ حرف باشد.' })
      .max(160, { error: 'نام دری نباید بیشتر از ۱۶۰ حرف باشد.' })
      .optional(),
    ps: z
      .string({ error: 'نام پشتو باید رشته متنی باشد.' })
      .trim()
      .min(2, { error: 'نام پشتو باید حداقل ۲ حرف باشد.' })
      .max(160, { error: 'نام پشتو نباید بیشتر از ۱۶۰ حرف باشد.' })
      .optional(),
    en: z
      .string({ error: 'نام انگلیسی باید رشته متنی باشد.' })
      .trim()
      .min(2, { error: 'نام انگلیسی باید حداقل ۲ حرف باشد.' })
      .max(160, { error: 'نام انگلیسی نباید بیشتر از ۱۶۰ حرف باشد.' })
      .optional(),
  })
  .refine((v) => v.fa || v.ps || v.en, {
    error: 'حداقل یکی از نام‌های دری، پشتو یا انگلیسی باید وارد شود.',
  });

const updateFacultyBodySchema = z
  .object({
    code: facultyCodeSchema.optional(),
    name: partialTrilingualSchema.optional(),
    isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'حداقل یک فیلد برای ویرایش پوهنځی باید ارسال شود.',
  });

const facultyIdParamSchema = z.object({
  facultyId: objectIdSchema('شناسه پوهنځی'),
});

// ---------------------------------------------------------------------------
// Departments (Public GET /api/departments?faculty= + Admin CRUD)
// ---------------------------------------------------------------------------
const listDepartmentsQuerySchema = z.object({
  faculty: objectIdSchema('شناسه پوهنځی').optional(),
  facultyId: objectIdSchema('شناسه پوهنځی').optional(),
  includeInactive: booleanQuerySchema.optional(),
});

const deptCodeSchema = z
  .string({ error: 'کود دیپارتمنت باید رشته متنی باشد.' })
  .trim()
  .toUpperCase()
  .min(1, { error: 'کود دیپارتمنت نمی‌تواند خالی باشد.' })
  .max(20, { error: 'کود دیپارتمنت نباید بیشتر از ۲۰ حرف باشد.' })
  .regex(/^[A-Z0-9_-]+$/, {
    error: 'کود دیپارتمنت فقط می‌تواند شامل حروف انگلیسی، اعداد، _ و - باشد.',
  });

const createDepartmentBodySchema = z.object({
  facultyId: objectIdSchema('شناسه پوهنځی'),
  code: deptCodeSchema.optional(),
  name: trilingualRequiredSchema('دیپارتمنت'),
  isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).default(true),
});

const updateDepartmentBodySchema = z
  .object({
    facultyId: objectIdSchema('شناسه پوهنځی').optional(),
    code: deptCodeSchema.optional(),
    name: partialTrilingualSchema.optional(),
    isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'حداقل یک فیلد برای ویرایش دیپارتمنت باید ارسال شود.',
  });

// ---------------------------------------------------------------------------
// Templates (Staff list/get + Admin CRUD / activate / deactivate / textDefaults)
// ---------------------------------------------------------------------------
const listTemplatesQuerySchema = z.object({
  all: booleanQuerySchema.optional(),
  includeInactive: booleanQuerySchema.optional(),
});

const templateIdOrKeyParamSchema = z.object({
  id: z
    .string({ error: 'شناسه یا کلید قالب الزامی است.' })
    .trim()
    .min(1, { error: 'شناسه یا کلید قالب الزامی است.' })
    .max(60, { error: 'شناسه یا کلید قالب معتبر نیست.' }),
});

const genderedTextRequiredSchema = (langLabel) =>
  z.object(
    {
      male: z
        .string({ error: `متن ذکور (${langLabel}) الزامی است.` })
        .trim()
        .min(10, { error: `متن ذکور (${langLabel}) باید حداقل ۱۰ حرف باشد.` })
        .max(4000, { error: `متن ذکور (${langLabel}) نباید بیشتر از ۴۰۰۰ حرف باشد.` }),
      female: z
        .string({ error: `متن اناث (${langLabel}) الزامی است.` })
        .trim()
        .min(10, { error: `متن اناث (${langLabel}) باید حداقل ۱۰ حرف باشد.` })
        .max(4000, { error: `متن اناث (${langLabel}) نباید بیشتر از ۴۰۰۰ حرف باشد.` }),
    },
    { error: `متن پیش‌فرض ${langLabel} (ذکور و اناث) الزامی است.` }
  );

const genderedTextPartialSchema = (langLabel) =>
  z
    .object({
      male: z
        .string({ error: `متن ذکور (${langLabel}) باید رشته متنی باشد.` })
        .trim()
        .min(10, { error: `متن ذکور (${langLabel}) باید حداقل ۱۰ حرف باشد.` })
        .max(4000, { error: `متن ذکور (${langLabel}) نباید بیشتر از ۴۰۰۰ حرف باشد.` })
        .optional(),
      female: z
        .string({ error: `متن اناث (${langLabel}) باید رشته متنی باشد.` })
        .trim()
        .min(10, { error: `متن اناث (${langLabel}) باید حداقل ۱۰ حرف باشد.` })
        .max(4000, { error: `متن اناث (${langLabel}) نباید بیشتر از ۴۰۰۰ حرف باشد.` })
        .optional(),
    })
    .optional();

const createTemplateBodySchema = z.object({
  key: z
    .string({ error: 'کلید قالب الزامی است.' })
    .trim()
    .toLowerCase()
    .min(2, { error: 'کلید قالب باید حداقل ۲ حرف باشد.' })
    .max(40, { error: 'کلید قالب نباید بیشتر از ۴۰ حرف باشد.' })
    .regex(/^[a-z0-9-]+$/, {
      error: 'کلید قالب فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره باشد.',
    }),
  name: z
    .string({ error: 'نام قالب الزامی است.' })
    .trim()
    .min(2, { error: 'نام قالب باید حداقل ۲ حرف باشد.' })
    .max(120, { error: 'نام قالب نباید بیشتر از ۱۲۰ حرف باشد.' }),
  labels: z
    .object({
      fa: z.string().trim().max(120).optional().default(''),
      ps: z.string().trim().max(120).optional().default(''),
      en: z.string().trim().max(120).optional().default(''),
    })
    .optional(),
  description: z
    .string()
    .trim()
    .max(400, { error: 'توضیحات قالب نباید بیشتر از ۴۰۰ حرف باشد.' })
    .optional()
    .default(''),
  isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).default(true),
  isDefault: z.boolean({ error: 'مقدار پیش‌فرض بودن باید true یا false باشد.' }).default(false),
  textDefaults: z
    .object({
      fa: genderedTextRequiredSchema('دری'),
      ps: genderedTextRequiredSchema('پشتو'),
      en: genderedTextRequiredSchema('انگلیسی'),
    })
    .optional(),
});

const updateTemplateBodySchema = z
  .object({
    name: z
      .string({ error: 'نام قالب باید رشته متنی باشد.' })
      .trim()
      .min(2, { error: 'نام قالب باید حداقل ۲ حرف باشد.' })
      .max(120, { error: 'نام قالب نباید بیشتر از ۱۲۰ حرف باشد.' })
      .optional(),
    labels: z
      .object({
        fa: z.string().trim().max(120).optional(),
        ps: z.string().trim().max(120).optional(),
        en: z.string().trim().max(120).optional(),
      })
      .optional(),
    description: z
      .string()
      .trim()
      .max(400, { error: 'توضیحات قالب نباید بیشتر از ۴۰۰ حرف باشد.' })
      .optional(),
    isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).optional(),
    isDefault: z.boolean({ error: 'مقدار پیش‌فرض بودن باید true یا false باشد.' }).optional(),
    textDefaults: z
      .object({
        fa: genderedTextPartialSchema('دری'),
        ps: genderedTextPartialSchema('پشتو'),
        en: genderedTextPartialSchema('انگلیسی'),
      })
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: 'حداقل یک فیلد برای ویرایش قالب باید ارسال شود.',
  });

const toggleTemplateBodySchema = z.object({
  isActive: z.boolean({ error: 'وضعیت فعال بودن باید true یا false باشد.' }).optional(),
});

// ---------------------------------------------------------------------------
// Stats Report & Print Logs
// ---------------------------------------------------------------------------
const statsReportQuerySchema = z.object({
  dateFrom: dateQueryField('تاریخ شروع').optional(),
  dateTo: dateQueryField('تاریخ پایان').optional(),
});

const listPrintLogsQuerySchema = z.object({
  requestId: objectIdSchema('شناسه درخواست').optional(),
  printedBy: objectIdSchema('شناسه کاربر').optional(),
  dateFrom: dateQueryField('تاریخ شروع').optional(),
  dateTo: dateQueryField('تاریخ پایان').optional(),
  ...paginationFields,
});

const templatePreviewQuerySchema = z.object({
  gender: z.enum(['male', 'female']).optional().default('male'),
  chromeless: booleanQuerySchema.optional(),
});

module.exports = {
  listUsersQuerySchema,
  createUserBodySchema,
  updateUserBodySchema,
  listFacultiesQuerySchema,
  createFacultyBodySchema,
  updateFacultyBodySchema,
  facultyIdParamSchema,
  listDepartmentsQuerySchema,
  createDepartmentBodySchema,
  updateDepartmentBodySchema,
  listTemplatesQuerySchema,
  templateIdOrKeyParamSchema,
  templatePreviewQuerySchema,
  createTemplateBodySchema,
  updateTemplateBodySchema,
  toggleTemplateBodySchema,
  statsReportQuerySchema,
  listPrintLogsQuerySchema,
};

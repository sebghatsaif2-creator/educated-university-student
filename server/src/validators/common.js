'use strict';

const { z } = require('zod');

const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T[\d:.+-Z]+)?$/;

function objectIdSchema(label = 'شناسه') {
  return z
    .string({ error: `${label} الزامی است.` })
    .trim()
    .regex(OBJECT_ID_REGEX, { error: `${label} معتبر نیست.` });
}

const idParamSchema = z.object({
  id: objectIdSchema('شناسه'),
});

function trilingualRequiredSchema(entityLabel = 'این بخش') {
  return z.object(
    {
      fa: z
        .string({ error: `نام دری ${entityLabel} الزامی است.` })
        .trim()
        .min(2, { error: `نام دری ${entityLabel} باید حداقل ۲ حرف باشد.` })
        .max(160, { error: `نام دری ${entityLabel} نباید بیشتر از ۱۶۰ حرف باشد.` }),
      ps: z
        .string({ error: `نام پشتو ${entityLabel} الزامی است.` })
        .trim()
        .min(2, { error: `نام پشتو ${entityLabel} باید حداقل ۲ حرف باشد.` })
        .max(160, { error: `نام پشتو ${entityLabel} نباید بیشتر از ۱۶۰ حرف باشد.` }),
      en: z
        .string({ error: `نام انگلیسی ${entityLabel} الزامی است.` })
        .trim()
        .min(2, { error: `نام انگلیسی ${entityLabel} باید حداقل ۲ حرف باشد.` })
        .max(160, { error: `نام انگلیسی ${entityLabel} نباید بیشتر از ۱۶۰ حرف باشد.` }),
    },
    { error: `نام سه‌زبانه (دری، پشتو، انگلیسی) برای ${entityLabel} الزامی است.` }
  );
}

const optionalTrilingualNameSchema = z
  .object({
    fa: z.string({ error: 'متن دری باید رشته متنی باشد.' }).trim().max(120, { error: 'متن دری نباید بیشتر از ۱۲۰ حرف باشد.' }).optional(),
    ps: z.string({ error: 'متن پشتو باید رشته متنی باشد.' }).trim().max(120, { error: 'متن پشتو نباید بیشتر از ۱۲۰ حرف باشد.' }).optional(),
    en: z.string({ error: 'متن انگلیسی باید رشته متنی باشد.' }).trim().max(120, { error: 'متن انگلیسی نباید بیشتر از ۱۲۰ حرف باشد.' }).optional(),
  })
  .optional();

function dateQueryField(label = 'تاریخ') {
  return z
    .string({ error: `${label} باید رشته متنی باشد.` })
    .trim()
    .regex(ISO_DATE_REGEX, { error: `فارمت ${label} نادرست است (نمونه: 2026-11-17).` })
    .refine((val) => !Number.isNaN(Date.parse(val)), {
      error: `${label} واردشده معتبر نیست.`,
    });
}

/**
 * Parse a YYYY-MM-DD or ISO date string into start-of-day or end-of-day UTC Date.
 */
function parseDateBoundary(dateStr, boundary = 'start') {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(
      boundary === 'end' ? `${dateStr}T23:59:59.999Z` : `${dateStr}T00:00:00.000Z`
    );
  }
  return new Date(dateStr);
}

/**
 * Escape user input before building a MongoDB `$regex` filter.
 */
function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const booleanQuerySchema = z
  .enum(['true', 'false'], { error: 'مقدار باید true یا false باشد.' })
  .transform((val) => val === 'true');

const paginationFields = {
  page: z.coerce
    .number({ error: 'شماره صفحه باید عدد باشد.' })
    .int({ error: 'شماره صفحه باید عدد صحیح باشد.' })
    .min(1, { error: 'شماره صفحه باید حداقل ۱ باشد.' })
    .default(1),
  limit: z.coerce
    .number({ error: 'تعداد در هر صفحه باید عدد باشد.' })
    .int({ error: 'تعداد در هر صفحه باید عدد صحیح باشد.' })
    .min(1, { error: 'تعداد در هر صفحه باید حداقل ۱ باشد.' })
    .max(100, { error: 'تعداد در هر صفحه نباید بیشتر از ۱۰۰ باشد.' })
    .default(20),
};

module.exports = {
  OBJECT_ID_REGEX,
  objectIdSchema,
  idParamSchema,
  trilingualRequiredSchema,
  optionalTrilingualNameSchema,
  dateQueryField,
  parseDateBoundary,
  escapeRegex,
  booleanQuerySchema,
  paginationFields,
};

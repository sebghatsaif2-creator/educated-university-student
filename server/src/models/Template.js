'use strict';

const mongoose = require('mongoose');

const TEMPLATE_KEYS = Object.freeze([
  'classic',
  'official',
  'green',
  'modern',
  'watermark',
  'cream',
  'blue-stripes',
  'gold-corners',
]);

const genderedTextSchema = new mongoose.Schema(
  {
    male: {
      type: String,
      required: [true, 'متن پیش‌فرض برای ذکور الزامی است.'],
      trim: true,
    },
    female: {
      type: String,
      required: [true, 'متن پیش‌فرض برای اناث الزامی است.'],
      trim: true,
    },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'کلید قالب الزامی است.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'کلید قالب فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد و خط تیره باشد.'],
    },
    name: {
      type: String,
      required: [true, 'نام قالب الزامی است.'],
      trim: true,
      maxlength: [120, 'نام قالب نباید بیشتر از ۱۲۰ حرف باشد.'],
    },
    labels: {
      fa: { type: String, trim: true, default: '' },
      ps: { type: String, trim: true, default: '' },
      en: { type: String, trim: true, default: '' },
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'توضیحات قالب نباید بیشتر از ۴۰۰ حرف باشد.'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    textDefaults: {
      fa: { type: genderedTextSchema, required: true },
      ps: { type: genderedTextSchema, required: true },
      en: { type: genderedTextSchema, required: true },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Render trilingual certificate text for a given gender using `{{placeholder}}` values.
 * @param {'male'|'female'} gender
 * @param {Record<string, Record<string, string>|string>} values - Per-language or shared placeholder map
 * @returns {{ fa: string, ps: string, en: string }}
 */
templateSchema.methods.renderText = function renderText(gender, values = {}) {
  const safeGender = gender === 'female' ? 'female' : 'male';
  const result = { fa: '', ps: '', en: '' };

  for (const lang of ['fa', 'ps', 'en']) {
    const raw = this.textDefaults?.[lang]?.[safeGender] || '';
    const langVars = {
      ...(typeof values.shared === 'object' ? values.shared : {}),
      ...(typeof values[lang] === 'object' ? values[lang] : {}),
    };
    result[lang] = raw.replace(/\{\{(\w+)\}\}/g, (_match, token) => {
      if (Object.prototype.hasOwnProperty.call(langVars, token) && langVars[token] != null) {
        return String(langVars[token]);
      }
      if (typeof values[token] === 'string' || typeof values[token] === 'number') {
        return String(values[token]);
      }
      return '';
    });
  }

  return result;
};

const Template = mongoose.model('Template', templateSchema);

module.exports = Template;
module.exports.TEMPLATE_KEYS = TEMPLATE_KEYS;

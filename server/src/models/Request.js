'use strict';

const mongoose = require('mongoose');

const REQUEST_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'printed']);
const GENDERS = Object.freeze(['male', 'female']);
const DEGREE_LEVELS = Object.freeze(['associate', 'bachelor', 'master', 'phd']);

const finalTextSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, default: '' },
    ps: { type: String, trim: true, default: '' },
    en: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const optionalTrilingualSchema = new mongoose.Schema(
  {
    fa: { type: String, trim: true, default: '' },
    ps: { type: String, trim: true, default: '' },
    en: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'نام متقاضی الزامی است.'],
      trim: true,
      maxlength: [120, 'نام متقاضی نباید بیشتر از ۱۲۰ حرف باشد.'],
    },
    fatherName: {
      type: String,
      required: [true, 'نام پدر الزامی است.'],
      trim: true,
      maxlength: [120, 'نام پدر نباید بیشتر از ۱۲۰ حرف باشد.'],
    },
    // Optional trilingual spelling overrides used when printing trilingual certificates
    firstNameI18n: {
      type: optionalTrilingualSchema,
      default: () => ({ fa: '', ps: '', en: '' }),
    },
    fatherNameI18n: {
      type: optionalTrilingualSchema,
      default: () => ({ fa: '', ps: '', en: '' }),
    },
    gender: {
      type: String,
      enum: {
        values: GENDERS,
        message: 'جنسیت باید male یا female باشد.',
      },
      required: [true, 'جنسیت الزامی است.'],
    },
    nationalId: {
      type: String,
      required: [true, 'نمبر تذکره الزامی است.'],
      trim: true,
      maxlength: [60, 'نمبر تذکره نباید بیشتر از ۶۰ حرف باشد.'],
    },
    phone: {
      type: String,
      required: [true, 'شماره تماس الزامی است.'],
      trim: true,
      maxlength: [30, 'شماره تماس نباید بیشتر از ۳۰ حرف باشد.'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
      maxlength: [150, 'ایمیل نباید بیشتر از ۱۵۰ حرف باشد.'],
      validate: {
        validator(val) {
          if (!val) return true;
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        },
        message: 'فارمت ایمیل نادرست است.',
      },
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'انتخاب پوهنځی الزامی است.'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'انتخاب دیپارتمنت الزامی است.'],
      index: true,
    },
    gradYearSH: {
      type: Number,
      required: [true, 'سال فراغت (هجری شمسی) الزامی است.'],
      min: [1350, 'سال فراغت هجری شمسی معتبر نیست.'],
      max: [1450, 'سال فراغت هجری شمسی معتبر نیست.'],
    },
    gradYearAD: {
      type: Number,
      required: [true, 'سال فراغت (میلادی) الزامی است.'],
      min: [1970, 'سال فراغت میلادی معتبر نیست.'],
      max: [2075, 'سال فراغت میلادی معتبر نیست.'],
    },
    degreeLevel: {
      type: String,
      enum: {
        values: DEGREE_LEVELS,
        message: 'مقطع تحصیلی معتبر نیست (associate | bachelor | master | phd).',
      },
      required: [true, 'مقطع تحصیلی الزامی است.'],
      default: 'bachelor',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'یادداشت نباید بیشتر از ۱۰۰۰ حرف باشد.'],
    },
    trackingCode: {
      type: String,
      required: [true, 'کود پیگیری الزامی است.'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: REQUEST_STATUSES,
        message: 'وضعیت درخواست معتبر نیست.',
      },
      required: true,
      default: 'pending',
      index: true,
    },
    rejectReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'دلیل رد درخواست نباید بیشتر از ۵۰۰ حرف باشد.'],
    },
    // Left undefined until assigned so sparse unique index allows multiple unassigned requests
    serial: {
      type: String,
      trim: true,
      maxlength: [60, 'شماره سریال نباید بیشتر از ۶۰ حرف باشد.'],
    },
    officialNo: {
      type: String,
      trim: true,
      default: '',
      maxlength: [80, 'نمبر مکتوب / ثبت رسمی نباید بیشتر از ۸۰ حرف باشد.'],
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      default: null,
    },
    finalText: {
      type: finalTextSchema,
      default: () => ({ fa: '', ps: '', en: '' }),
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    printedAt: {
      type: Date,
      default: null,
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

requestSchema.index({ serial: 1 }, { unique: true, sparse: true });
requestSchema.index({ status: 1, createdAt: -1 });
requestSchema.index({ nationalId: 1 });

const Request = mongoose.model('Request', requestSchema);

module.exports = Request;
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
module.exports.GENDERS = GENDERS;
module.exports.DEGREE_LEVELS = DEGREE_LEVELS;

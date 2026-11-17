'use strict';

const mongoose = require('mongoose');

const trilingualDeptNameSchema = new mongoose.Schema(
  {
    fa: {
      type: String,
      required: [true, 'نام دری دیپارتمنت الزامی است.'],
      trim: true,
      maxlength: [160, 'نام دری دیپارتمنت نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
    ps: {
      type: String,
      required: [true, 'نام پشتو دیپارتمنت الزامی است.'],
      trim: true,
      maxlength: [160, 'نام پشتو دیپارتمنت نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
    en: {
      type: String,
      required: [true, 'نام انگلیسی دیپارتمنت الزامی است.'],
      trim: true,
      maxlength: [160, 'نام انگلیسی دیپارتمنت نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
  },
  { _id: false }
);

const departmentSchema = new mongoose.Schema(
  {
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Faculty',
      required: [true, 'انتخاب پوهنځی برای دیپارتمنت الزامی است.'],
      index: true,
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: [20, 'کود دیپارتمنت نباید بیشتر از ۲۰ حرف باشد.'],
    },
    name: {
      type: trilingualDeptNameSchema,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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

departmentSchema.index({ facultyId: 1, 'name.en': 1 }, { unique: true });

const Department = mongoose.model('Department', departmentSchema);

module.exports = Department;

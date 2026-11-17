'use strict';

const mongoose = require('mongoose');

const trilingualNameSchema = new mongoose.Schema(
  {
    fa: {
      type: String,
      required: [true, 'نام دری پوهنځی الزامی است.'],
      trim: true,
      maxlength: [160, 'نام دری نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
    ps: {
      type: String,
      required: [true, 'نام پشتو پوهنځی الزامی است.'],
      trim: true,
      maxlength: [160, 'نام پشتو نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
    en: {
      type: String,
      required: [true, 'نام انگلیسی پوهنځی الزامی است.'],
      trim: true,
      maxlength: [160, 'نام انگلیسی نباید بیشتر از ۱۶۰ حرف باشد.'],
    },
  },
  { _id: false }
);

const facultySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: [20, 'کود پوهنځی نباید بیشتر از ۲۰ حرف باشد.'],
    },
    name: {
      type: trilingualNameSchema,
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
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
  }
);

facultySchema.index({ code: 1 }, { unique: true, sparse: true });
facultySchema.index({ 'name.en': 1 }, { unique: true });

facultySchema.virtual('departments', {
  ref: 'Department',
  localField: '_id',
  foreignField: 'facultyId',
});

const Faculty = mongoose.model('Faculty', facultySchema);

module.exports = Faculty;

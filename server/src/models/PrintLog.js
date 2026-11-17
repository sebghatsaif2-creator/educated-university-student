'use strict';

const mongoose = require('mongoose');

const printLogSchema = new mongoose.Schema(
  {
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      required: [true, 'شناسه درخواست الزامی است.'],
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: [true, 'شناسه قالب الزامی است.'],
    },
    templateKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    printedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'شناسه کاربر چاپ‌کننده الزامی است.'],
      index: true,
    },
    serial: {
      type: String,
      trim: true,
      default: '',
    },
    officialNo: {
      type: String,
      trim: true,
      default: '',
    },
    isReprint: {
      type: Boolean,
      default: false,
    },
    reprintReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [400, 'دلیل چاپ مجدد نباید بیشتر از ۴۰۰ حرف باشد.'],
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    printedAt: {
      type: Date,
      default: Date.now,
      index: true,
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

const PrintLog = mongoose.model('PrintLog', printLogSchema);

module.exports = PrintLog;

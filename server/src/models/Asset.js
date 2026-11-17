'use strict';

const mongoose = require('mongoose');

const ASSET_TYPES = Object.freeze(['logo', 'watermark', 'signature', 'stamp', 'font', 'other']);

const assetSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'کلید فایل الزامی است.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_-]+$/, 'کلید فایل فقط می‌تواند شامل حروف کوچک انگلیسی، اعداد، _ و - باشد.'],
    },
    name: {
      type: String,
      required: [true, 'نام فایل الزامی است.'],
      trim: true,
      maxlength: [140, 'نام فایل نباید بیشتر از ۱۴۰ حرف باشد.'],
    },
    type: {
      type: String,
      enum: {
        values: ASSET_TYPES,
        message: 'نوع فایل معتبر نیست.',
      },
      required: true,
      default: 'logo',
      index: true,
    },
    filePath: {
      type: String,
      required: [true, 'مسیر فایل الزامی است.'],
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
      default: 'application/octet-stream',
    },
    fileSize: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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

const Asset = mongoose.model('Asset', assetSchema);

module.exports = Asset;
module.exports.ASSET_TYPES = ASSET_TYPES;

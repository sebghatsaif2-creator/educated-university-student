'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const env = require('../config/env');

const USER_ROLES = Object.freeze(['officer', 'admin']);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'نام کاربر الزامی است.'],
      trim: true,
      maxlength: [120, 'نام کاربر نباید بیشتر از ۱۲۰ حرف باشد.'],
    },
    username: {
      type: String,
      required: [true, 'نام کاربری الزامی است.'],
      unique: true,
      lowercase: true,
      trim: true,
      minlength: [3, 'نام کاربری باید حداقل ۳ حرف باشد.'],
      maxlength: [50, 'نام کاربری نباید بیشتر از ۵۰ حرف باشد.'],
      match: [/^[a-z0-9._-]+$/, 'نام کاربری فقط می‌تواند شامل حروف انگلیسی، اعداد و . _ - باشد.'],
    },
    passwordHash: {
      type: String,
      required: [true, 'رمز عبور الزامی است.'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: 'نقش کاربر باید officer یا admin باشد.',
      },
      required: [true, 'نقش کاربر الزامی است.'],
      default: 'officer',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.statics.hashPassword = async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, env.bcryptSaltRounds);
};

userSchema.methods.comparePassword = async function comparePassword(candidatePassword) {
  if (!this.passwordHash || typeof candidatePassword !== 'string') {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.USER_ROLES = USER_ROLES;

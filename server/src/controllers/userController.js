'use strict';

const { User, Request, PrintLog } = require('../models');
const AppError = require('../utils/AppError');
const { asyncHandler } = require('../middleware/errorHandler');
const { escapeRegex } = require('../validators/common');

/**
 * GET /api/users (Admin)
 * List staff accounts with optional role, isActive, and search filters.
 */
const listUsers = asyncHandler(async (req, res) => {
  const { role, isActive, search } = req.query;
  const filter = {};

  if (role) filter.role = role;
  if (typeof isActive === 'boolean') filter.isActive = isActive;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: rx }, { username: rx }];
  }

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    count: users.length,
    data: { users },
  });
});

/**
 * GET /api/users/:id (Admin)
 * Get a single staff account by ID.
 */
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('کاربر مورد نظر یافت نشد.', 404, 'USER_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: { user: user.toJSON() },
  });
});

/**
 * POST /api/users (Admin)
 * Create a new officer or admin user.
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, username, password, role, isActive } = req.body;

  const existing = await User.findOne({ username });
  if (existing) {
    throw new AppError('این نام کاربری قبلاً در سیستم ثبت شده است.', 409, 'DUPLICATE_KEY');
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name,
    username,
    passwordHash,
    role,
    isActive,
  });

  res.status(201).json({
    success: true,
    message: 'کاربر جدید موفقانه ایجاد گردید.',
    data: { user: user.toJSON() },
  });
});

/**
 * PATCH|PUT /api/users/:id (Admin)
 * Update user details, role, active state, or reset password.
 */
const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('+passwordHash');
  if (!user) {
    throw new AppError('کاربر مورد نظر یافت نشد.', 404, 'USER_NOT_FOUND');
  }

  const { name, username, password, role, isActive } = req.body;
  const isSelf = user._id.toString() === req.user._id.toString();

  if (isSelf && isActive === false) {
    throw new AppError(
      'شما نمی‌توانید حساب کاربری خودتان را غیرفعال نمایید.',
      400,
      'SELF_DEACTIVATION_FORBIDDEN'
    );
  }

  if (isSelf && role && role !== 'admin') {
    throw new AppError(
      'شما نمی‌توانید نقش مدیریتی حساب خودتان را تغییر دهید.',
      400,
      'SELF_DEMOTION_FORBIDDEN'
    );
  }

  // Ensure at least one active admin remains in the system
  const losingAdminAccess =
    user.role === 'admin' &&
    user.isActive &&
    ((role && role !== 'admin') || isActive === false);

  if (losingAdminAccess) {
    const otherActiveAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
    });
    if (otherActiveAdmins === 0) {
      throw new AppError(
        'حداقل یک مدیر فعال باید در سیستم باقی بماند.',
        400,
        'LAST_ADMIN_PROTECTED'
      );
    }
  }

  if (username && username !== user.username) {
    const dup = await User.findOne({ username, _id: { $ne: user._id } });
    if (dup) {
      throw new AppError('این نام کاربری قبلاً در سیستم ثبت شده است.', 409, 'DUPLICATE_KEY');
    }
    user.username = username;
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  if (password) {
    user.passwordHash = await User.hashPassword(password);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'اطلاعات کاربر موفقانه ویرایش گردید.',
    data: { user: user.toJSON() },
  });
});

/**
 * DELETE /api/users/:id (Admin)
 * Delete a user if they have no audit references; otherwise prompt deactivation.
 */
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('کاربر مورد نظر یافت نشد.', 404, 'USER_NOT_FOUND');
  }

  if (user._id.toString() === req.user._id.toString()) {
    throw new AppError(
      'شما نمی‌توانید حساب کاربری خودتان را حذف نمایید.',
      400,
      'SELF_DELETE_FORBIDDEN'
    );
  }

  if (user.role === 'admin' && user.isActive) {
    const otherAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: 'admin',
      isActive: true,
    });
    if (otherAdmins === 0) {
      throw new AppError(
        'حذف آخرین مدیر فعال سیستم مجاز نیست.',
        400,
        'LAST_ADMIN_PROTECTED'
      );
    }
  }

  const [approvedRefs, printRefs] = await Promise.all([
    Request.countDocuments({ approvedBy: user._id }),
    PrintLog.countDocuments({ printedBy: user._id }),
  ]);

  if (approvedRefs > 0 || printRefs > 0) {
    throw new AppError(
      'این کاربر دارای سوابق تأیید یا چاپ تصدیق‌نامه است و قابل حذف نمی‌باشد؛ به جای حذف آن را غیرفعال نمایید.',
      409,
      'USER_HAS_AUDIT_RECORDS'
    );
  }

  await user.deleteOne();

  res.status(200).json({
    success: true,
    message: 'حساب کاربری موفقانه حذف گردید.',
  });
});

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};

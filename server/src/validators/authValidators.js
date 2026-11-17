'use strict';

const { z } = require('zod');

const loginBodySchema = z.object({
  username: z
    .string({ error: 'نام کاربری الزامی است.' })
    .trim()
    .min(1, { error: 'نام کاربری الزامی است.' })
    .max(50, { error: 'نام کاربری نباید بیشتر از ۵۰ حرف باشد.' }),
  password: z
    .string({ error: 'رمز عبور الزامی است.' })
    .min(1, { error: 'رمز عبور الزامی است.' })
    .max(128, { error: 'رمز عبور نباید بیشتر از ۱۲۸ حرف باشد.' }),
});

const changePasswordBodySchema = z.object({
  currentPassword: z
    .string({ error: 'رمز عبور فعلی الزامی است.' })
    .min(1, { error: 'رمز عبور فعلی الزامی است.' })
    .max(128, { error: 'رمز عبور فعلی نباید بیشتر از ۱۲۸ حرف باشد.' }),
  newPassword: z
    .string({ error: 'رمز عبور جدید الزامی است.' })
    .min(8, { error: 'رمز عبور جدید باید حداقل ۸ حرف باشد.' })
    .max(128, { error: 'رمز عبور جدید نباید بیشتر از ۱۲۸ حرف باشد.' }),
});

module.exports = {
  loginBodySchema,
  changePasswordBodySchema,
};

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IconEye } from '../components/Icons';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || '/officer/requests';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('لطفاً نام کاربری خود را وارد نمایید.');
      return;
    }
    if (!password) {
      setError('لطفاً رمز عبور خود را وارد نمایید.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login(username.trim(), password);
      toast.success(`خوش آمدید، ${loggedUser.name}!`);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || 'نام کاربری یا رمز عبور نادرست است.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container section-gap auth-container">
      <div className="card auth-card">
        <div className="auth-header">
          <img
            src="/logos/university-logo.png"
            alt="نشان پوهنتون کندز"
            className="auth-logo"
          />
          <h1 className="auth-title">ورود کارمندان و مدیریت</h1>
          <p className="auth-subtitle">
            معاونیت امور محصلان پوهنتون کندز — ویژه کارمندان صدور تصدیق‌نامه و مدیر سیستم
          </p>
        </div>

        <form onSubmit={handleSubmit} className="form-stack" noValidate>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="login-username" className="form-label">
              نام کاربری <span className="req">*</span>
            </label>
            <input
              id="login-username"
              type="text"
              dir="ltr"
              autoComplete="username"
              autoFocus
              className="form-input ltr-input"
              placeholder="officer یا admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              رمز عبور <span className="req">*</span>
            </label>
            <div className="password-field">
              <input
                id="login-password"
                type={showPwd ? 'text' : 'password'}
                dir="ltr"
                autoComplete="current-password"
                className="form-input ltr-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                title={showPwd ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
              >
                <IconEye size={17} />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block mt-2"
            disabled={submitting}
          >
            {submitting ? 'در حال ورود به سیستم...' : 'ورود به سیستم'}
          </button>
        </form>

        <p className="auth-footnote">
          فارغ‌التحصیلان و متقاضیان نیازی به ورود ندارند و از بخش «ثبت درخواست» و «پیگیری درخواست»
          استفاده می‌نمایند.
        </p>
      </div>
    </div>
  );
}

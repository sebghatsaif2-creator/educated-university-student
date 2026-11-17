import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ROLE_LABELS } from '../utils/format';
import Modal from './Modal';
import { IconKey, IconLogout, IconMenu } from './Icons';

export default function Layout({ children }) {
  const { user, isAuthenticated, isAdmin, logout, changePassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    closeMenu();
    await logout();
    toast.info('از حساب کاربری خود خارج شدید.');
    navigate('/login');
  };

  const openPwdModal = () => {
    closeMenu();
    setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPwdError('');
    setPwdOpen(true);
  };

  const handlePwdSubmit = async (e) => {
    e.preventDefault();
    setPwdError('');

    if (!pwdForm.currentPassword) {
      setPwdError('رمز عبور فعلی را وارد نمایید.');
      return;
    }
    if (pwdForm.newPassword.length < 8) {
      setPwdError('رمز عبور جدید باید حداقل ۸ حرف باشد.');
      return;
    }
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      setPwdError('تکرار رمز عبور جدید با رمز عبور جدید مطابقت ندارد.');
      return;
    }

    setPwdSaving(true);
    try {
      await changePassword(pwdForm.currentPassword, pwdForm.newPassword);
      setPwdOpen(false);
      toast.success('رمز عبور شما موفقانه تغییر یافت.');
    } catch (err) {
      setPwdError(err.message || 'خطا در تغییر رمز عبور.');
    } finally {
      setPwdSaving(false);
    }
  };

  const navClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <div className="app-shell" dir="rtl">
      {/* Official Institutional Header */}
      <header className="site-header no-print">
        <div className="header-gold-bar" />
        <div className="container header-inner">
          <Link to="/" className="brand-block" onClick={closeMenu}>
            <div className="brand-logos">
              <img
                src="/logos/university-logo.png"
                alt="نشان رسمی پوهنتون کندز"
                className="brand-logo-main"
              />
              <img
                src="/logos/ministry-logo.png"
                alt="نشان وزارت تحصیلات عالی"
                className="brand-logo-sub"
              />
            </div>
            <div className="brand-text">
              <span className="brand-ministry">وزارت تحصیلات عالی — ریاست پوهنتون کندز</span>
              <span className="brand-title">سیستم درخواست و چاپ تصدیق‌نامه فراغت</span>
              <span className="brand-office">معاونیت امور محصلان (شبکه داخلی آفلاین)</span>
            </div>
          </Link>

          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="باز کردن منوی ناوبری"
          >
            <IconMenu size={22} />
          </button>

          <div className={`header-actions${menuOpen ? ' open' : ''}`}>
            <nav className="main-nav" aria-label="منوی اصلی">
              <NavLink to="/" end className={navClass} onClick={closeMenu}>
                ثبت درخواست
              </NavLink>
              <NavLink to="/track" className={navClass} onClick={closeMenu}>
                پیگیری درخواست
              </NavLink>
              <NavLink to="/verify" className={navClass} onClick={closeMenu}>
                تأیید اصالت سند
              </NavLink>

              {isAuthenticated && (
                <>
                  <span className="nav-divider" aria-hidden="true" />
                  <NavLink to="/officer/requests" className={navClass} onClick={closeMenu}>
                    درخواست‌ها
                  </NavLink>
                  <NavLink to="/officer/templates" className={navClass} onClick={closeMenu}>
                    قالب‌ها
                  </NavLink>
                </>
              )}

              {isAdmin && (
                <>
                  <span className="nav-divider" aria-hidden="true" />
                  <NavLink to="/admin/users" className={navClass} onClick={closeMenu}>
                    کاربران
                  </NavLink>
                  <NavLink to="/admin/catalog" className={navClass} onClick={closeMenu}>
                    پوهنځی و دیپارتمنت
                  </NavLink>
                  <NavLink to="/admin/templates" className={navClass} onClick={closeMenu}>
                    مدیریت قالب‌ها
                  </NavLink>
                  <NavLink to="/admin/reports" className={navClass} onClick={closeMenu}>
                    گزارش‌ها
                  </NavLink>
                </>
              )}
            </nav>

            <div className="user-bar">
              {isAuthenticated ? (
                <>
                  <div className="user-chip">
                    <span className="user-chip-name">{user.name}</span>
                    <span className="user-chip-role">{ROLE_LABELS[user.role] || user.role}</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost-light btn-sm"
                    onClick={openPwdModal}
                    title="تغییر رمز عبور"
                  >
                    <IconKey size={16} />
                    <span className="hide-desktop-compact">رمز عبور</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={handleLogout}
                  >
                    <IconLogout size={16} />
                    <span>خروج</span>
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className="btn btn-gold btn-sm"
                  onClick={closeMenu}
                >
                  ورود کارمندان
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="site-main">{children}</main>

      {/* Institutional Offline Footer */}
      <footer className="site-footer no-print">
        <div className="container footer-inner">
          <div>
            <strong>پوهنتون کندز — معاونیت امور محصلان</strong>
            <span className="footer-sep">|</span>
            <span>وزارت تحصیلات عالی</span>
          </div>
          <div className="footer-meta">
            <span className="offline-pill">شبکه محلی ۱۰۰٪ آفلاین (LAN)</span>
          </div>
        </div>
      </footer>

      {/* Change Own Password Modal */}
      <Modal
        open={pwdOpen}
        title="تغییر رمز عبور حساب کاربری"
        onClose={() => !pwdSaving && setPwdOpen(false)}
        size="sm"
      >
        <form onSubmit={handlePwdSubmit} className="form-stack" noValidate>
          {pwdError && <div className="alert alert-error">{pwdError}</div>}

          <div className="form-group">
            <label htmlFor="cur-pwd" className="form-label">
              رمز عبور فعلی <span className="req">*</span>
            </label>
            <input
              id="cur-pwd"
              type="password"
              dir="ltr"
              className="form-input ltr-input"
              value={pwdForm.currentPassword}
              onChange={(e) => setPwdForm((p) => ({ ...p, currentPassword: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-pwd" className="form-label">
              رمز عبور جدید (حداقل ۸ حرف) <span className="req">*</span>
            </label>
            <input
              id="new-pwd"
              type="password"
              dir="ltr"
              className="form-input ltr-input"
              value={pwdForm.newPassword}
              onChange={(e) => setPwdForm((p) => ({ ...p, newPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="cfm-pwd" className="form-label">
              تکرار رمز عبور جدید <span className="req">*</span>
            </label>
            <input
              id="cfm-pwd"
              type="password"
              dir="ltr"
              className="form-input ltr-input"
              value={pwdForm.confirmPassword}
              onChange={(e) => setPwdForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </div>

          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPwdOpen(false)}
              disabled={pwdSaving}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
              {pwdSaving ? 'در حال ذخیره...' : 'ثبت رمز جدید'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

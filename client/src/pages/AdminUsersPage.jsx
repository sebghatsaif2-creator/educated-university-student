import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, extractFieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { ROLE_LABELS, formatDateTime } from '../utils/format';
import { IconEdit, IconPlus, IconSearch, IconTrash, IconUsers } from '../components/Icons';

const EMPTY_USER_FORM = {
  name: '',
  username: '',
  password: '',
  role: 'officer',
  isActive: true,
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_USER_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/users', {
        query: {
          role: roleFilter,
          isActive: activeFilter,
          search: search.trim(),
        },
      });
      setUsers(res.data?.users || []);
    } catch (err) {
      setError(err.message || 'خطا در بارگذاری فهرست کاربران.');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, activeFilter, search]);

  useEffect(() => {
    const t = window.setTimeout(loadUsers, 220);
    return () => window.clearTimeout(t);
  }, [loadUsers]);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm(EMPTY_USER_FORM);
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setForm({
      name: u.name || '',
      username: u.username || '',
      password: '',
      role: u.role || 'officer',
      isActive: Boolean(u.isActive),
    });
    setFieldErrors({});
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');
    const errs = {};

    if (form.name.trim().length < 2) {
      errs.name = 'نام و تخلص کاربر باید حداقل ۲ حرف باشد.';
    }
    if (!/^[a-z0-9._-]{3,50}$/.test(form.username.trim().toLowerCase())) {
      errs.username = 'نام کاربری باید ۳ تا ۵۰ حرف انگلیسی کوچک، عدد یا نقطه/خط‌تیره باشد.';
    }
    if (!editingUser && form.password.length < 8) {
      errs.password = 'رمز عبور باید حداقل ۸ حرف باشد.';
    }
    if (editingUser && form.password && form.password.length < 8) {
      errs.password = 'رمز عبور جدید باید حداقل ۸ حرف باشد.';
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        role: form.role,
        isActive: form.isActive,
      };
      if (form.password) body.password = form.password;

      if (editingUser) {
        await apiFetch(`/users/${editingUser._id}`, { method: 'PATCH', body });
        toast.success('اطلاعات کاربر موفقانه ویرایش گردید.');
      } else {
        await apiFetch('/users', { method: 'POST', body });
        toast.success('حساب کاربری جدید موفقانه ایجاد گردید.');
      }

      setModalOpen(false);
      loadUsers();
    } catch (err) {
      setFieldErrors(extractFieldErrors(err));
      setFormError(err.message || 'خطا در ذخیره اطلاعات کاربر.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await apiFetch(`/users/${u._id}`, {
        method: 'PATCH',
        body: { isActive: !u.isActive },
      });
      toast.success(u.isActive ? 'حساب کاربری غیرفعال شد.' : 'حساب کاربری فعال شد.');
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'خطا در تغییر وضعیت کاربر.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/users/${deleteTarget._id}`, { method: 'DELETE' });
      toast.success('حساب کاربری حذف گردید.');
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      toast.error(err.message || 'امکان حذف این کاربر وجود ندارد.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            <IconUsers size={24} /> مدیریت کاربران سیستم
          </h1>
          <p className="page-subtitle">
            ایجاد، ویرایش، تغییر نقش، بازنشانی رمز عبور و فعال/غیرفعال‌سازی حساب‌های کارمندان و
            مدیران
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <IconPlus size={18} />
          <span>ایجاد کاربر جدید</span>
        </button>
      </div>

      {/* Filters */}
      <section className="card filter-panel mt-4">
        <div className="filter-grid-3">
          <div className="form-group">
            <label htmlFor="usr-search" className="form-label">
              جستجوی نام یا نام کاربری
            </label>
            <div className="input-with-icon">
              <IconSearch size={17} className="input-icon" />
              <input
                id="usr-search"
                type="search"
                className="form-input"
                placeholder="جستجو..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="usr-role" className="form-label">
              نقش کاربری
            </label>
            <select
              id="usr-role"
              className="form-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">همه نقش‌ها</option>
              <option value="admin">مدیر سیستم (admin)</option>
              <option value="officer">کارمند امور محصلان (officer)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="usr-active" className="form-label">
              وضعیت حساب
            </label>
            <select
              id="usr-active"
              className="form-select"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="">همه حساب‌ها</option>
              <option value="true">فعال</option>
              <option value="false">غیرفعال</option>
            </select>
          </div>
        </div>
      </section>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {/* Users Table */}
      <section className="card table-card mt-4">
        {loading ? (
          <div className="table-loader">
            <div className="spinner" />
            <span>در حال بارگذاری کاربران...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted">کاربری مطابق جستجو یافت نشد.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>نام کامل</th>
                  <th>نام کاربری</th>
                  <th>نقش</th>
                  <th>وضعیت</th>
                  <th>آخرین ورود</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u._id === currentUser?._id;
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="cell-primary">
                          {u.name} {isSelf && <span className="tag tag-slate">شما</span>}
                        </div>
                      </td>
                      <td>
                        <code className="code-pill" dir="ltr">
                          {u.username}
                        </code>
                      </td>
                      <td>
                        <span className={`tag ${u.role === 'admin' ? 'tag-gold' : 'tag-blue'}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {u.isActive ? (
                          <span className="tag tag-green">فعال</span>
                        ) : (
                          <span className="tag tag-red">غیرفعال</span>
                        )}
                      </td>
                      <td className="cell-sub">{formatDateTime(u.lastLoginAt)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => openEditModal(u)}
                          >
                            <IconEdit size={14} />
                            <span>ویرایش</span>
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => handleToggleActive(u)}
                              >
                                {u.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger-outline btn-xs"
                                onClick={() => setDeleteTarget(u)}
                                title="حذف کاربر"
                              >
                                <IconTrash size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create / Edit User Modal */}
      <Modal
        open={modalOpen}
        title={editingUser ? `ویرایش کاربر: ${editingUser.name}` : 'ایجاد حساب کاربری جدید'}
        onClose={() => !saving && setModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSave} className="form-stack" noValidate>
          {formError && <div className="alert alert-error">{formError}</div>}

          <div className="form-group">
            <label htmlFor="u-name" className="form-label">
              نام و تخلص <span className="req">*</span>
            </label>
            <input
              id="u-name"
              type="text"
              className={`form-input${fieldErrors.name ? ' input-error' : ''}`}
              placeholder="مثال: سید حامد رحیمی"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
            {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="u-username" className="form-label">
              نام کاربری (انگلیسی) <span className="req">*</span>
            </label>
            <input
              id="u-username"
              type="text"
              dir="ltr"
              className={`form-input ltr-input${fieldErrors.username ? ' input-error' : ''}`}
              placeholder="officer2"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            />
            {fieldErrors.username && <span className="field-error">{fieldErrors.username}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="u-password" className="form-label">
              {editingUser
                ? 'رمز عبور جدید (خالی بگذارید اگر تغییر نمی‌دهید)'
                : 'رمز عبور (حداقل ۸ حرف)'}{' '}
              {!editingUser && <span className="req">*</span>}
            </label>
            <input
              id="u-password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              className={`form-input ltr-input${fieldErrors.password ? ' input-error' : ''}`}
              placeholder="حداقل ۸ حرف"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="u-role" className="form-label">
                نقش دسترسی
              </label>
              <select
                id="u-role"
                className="form-select"
                value={form.role}
                disabled={editingUser?._id === currentUser?._id}
                onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              >
                <option value="officer">کارمند امور محصلان (officer)</option>
                <option value="admin">مدیر سیستم (admin)</option>
              </select>
            </div>

            <div className="form-group form-group-center">
              <label className="checkbox-inline mt-4">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  disabled={editingUser?._id === currentUser?._id}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span>حساب کاربری فعال باشد</span>
              </label>
            </div>
          </div>

          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={saving}
              onClick={() => setModalOpen(false)}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'در حال ذخیره...' : editingUser ? 'ثبت تغییرات' : 'ایجاد کاربر'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title="حذف حساب کاربری"
        onClose={() => !deleting && setDeleteTarget(null)}
        size="sm"
      >
        <p className="text-muted">
          آیا از حذف کاربر <strong>{deleteTarget?.name}</strong> (
          <code dir="ltr">{deleteTarget?.username}</code>) اطمینان دارید؟
        </p>
        <div className="form-actions-end mt-4">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={deleting}
            onClick={() => setDeleteTarget(null)}
          >
            انصراف
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? 'در حال حذف...' : 'بله، حذف شود'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

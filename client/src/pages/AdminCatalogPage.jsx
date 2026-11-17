import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { toDariDigits } from '../utils/format';
import { IconBuilding, IconEdit, IconPlus, IconTrash } from '../components/Icons';

const EMPTY_FACULTY = {
  code: '',
  name: { fa: '', ps: '', en: '' },
  isActive: true,
};

const EMPTY_DEPT = {
  facultyId: '',
  code: '',
  name: { fa: '', ps: '', en: '' },
  isActive: true,
};

export default function AdminCatalogPage() {
  const toast = useToast();

  const [faculties, setFaculties] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Faculty modal
  const [facModalOpen, setFacModalOpen] = useState(false);
  const [editingFac, setEditingFac] = useState(null);
  const [facForm, setFacForm] = useState(EMPTY_FACULTY);
  const [facError, setFacError] = useState('');
  const [facSaving, setFacSaving] = useState(false);

  // Department modal
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT);
  const [deptError, setDeptError] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/faculties', { query: { includeInactive: 'true' } });
      const list = res.data?.faculties || [];
      setFaculties(list);
      setSelectedFacultyId((prev) => {
        if (prev && list.some((f) => f._id === prev)) return prev;
        return list[0]?._id || '';
      });
    } catch (err) {
      setError(err.message || 'خطا در بارگذاری پوهنځی‌ها و دیپارتمنت‌ها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const selectedFaculty = useMemo(
    () => faculties.find((f) => f._id === selectedFacultyId) || null,
    [faculties, selectedFacultyId]
  );

  // Faculty handlers
  const openNewFaculty = () => {
    setEditingFac(null);
    setFacForm(EMPTY_FACULTY);
    setFacError('');
    setFacModalOpen(true);
  };

  const openEditFaculty = (fac) => {
    setEditingFac(fac);
    setFacForm({
      code: fac.code || '',
      name: {
        fa: fac.name?.fa || '',
        ps: fac.name?.ps || '',
        en: fac.name?.en || '',
      },
      isActive: Boolean(fac.isActive),
    });
    setFacError('');
    setFacModalOpen(true);
  };

  const handleSaveFaculty = async (e) => {
    e.preventDefault();
    setFacError('');

    if (
      facForm.name.fa.trim().length < 2 ||
      facForm.name.ps.trim().length < 2 ||
      facForm.name.en.trim().length < 2
    ) {
      setFacError('وارد نمودن نام پوهنځی به هر سه زبان (دری، پشتو و انگلیسی) الزامی است.');
      return;
    }

    setFacSaving(true);
    try {
      const body = {
        name: {
          fa: facForm.name.fa.trim(),
          ps: facForm.name.ps.trim(),
          en: facForm.name.en.trim(),
        },
        isActive: facForm.isActive,
      };
      if (facForm.code.trim()) body.code = facForm.code.trim().toUpperCase();

      if (editingFac) {
        await apiFetch(`/faculties/${editingFac._id}`, { method: 'PATCH', body });
        toast.success('پوهنځی موفقانه ویرایش گردید.');
      } else {
        const res = await apiFetch('/faculties', { method: 'POST', body });
        if (res.data?.faculty?._id) {
          setSelectedFacultyId(res.data.faculty._id);
        }
        toast.success('پوهنځی جدید موفقانه اضافه گردید.');
      }
      setFacModalOpen(false);
      loadCatalog();
    } catch (err) {
      setFacError(err.message || 'خطا در ذخیره پوهنځی.');
    } finally {
      setFacSaving(false);
    }
  };

  const handleDeleteFaculty = async (fac) => {
    if (!window.confirm(`آیا از حذف پوهنځی «${fac.name?.fa}» اطمینان دارید؟`)) return;
    try {
      await apiFetch(`/faculties/${fac._id}`, { method: 'DELETE' });
      toast.success('پوهنځی حذف گردید.');
      loadCatalog();
    } catch (err) {
      toast.error(err.message || 'امکان حذف این پوهنځی وجود ندارد.');
    }
  };

  // Department handlers
  const openNewDept = (facultyId) => {
    setEditingDept(null);
    setDeptForm({
      ...EMPTY_DEPT,
      facultyId: facultyId || selectedFacultyId || faculties[0]?._id || '',
    });
    setDeptError('');
    setDeptModalOpen(true);
  };

  const openEditDept = (dept) => {
    setEditingDept(dept);
    setDeptForm({
      facultyId:
        (typeof dept.facultyId === 'object' ? dept.facultyId._id : dept.facultyId) ||
        selectedFacultyId,
      code: dept.code || '',
      name: {
        fa: dept.name?.fa || '',
        ps: dept.name?.ps || '',
        en: dept.name?.en || '',
      },
      isActive: Boolean(dept.isActive),
    });
    setDeptError('');
    setDeptModalOpen(true);
  };

  const handleSaveDept = async (e) => {
    e.preventDefault();
    setDeptError('');

    if (!deptForm.facultyId) {
      setDeptError('لطفاً پوهنځی مربوطه را انتخاب نمایید.');
      return;
    }
    if (
      deptForm.name.fa.trim().length < 2 ||
      deptForm.name.ps.trim().length < 2 ||
      deptForm.name.en.trim().length < 2
    ) {
      setDeptError('وارد نمودن نام دیپارتمنت به هر سه زبان (دری، پشتو و انگلیسی) الزامی است.');
      return;
    }

    setDeptSaving(true);
    try {
      const body = {
        facultyId: deptForm.facultyId,
        name: {
          fa: deptForm.name.fa.trim(),
          ps: deptForm.name.ps.trim(),
          en: deptForm.name.en.trim(),
        },
        isActive: deptForm.isActive,
      };
      if (deptForm.code.trim()) body.code = deptForm.code.trim().toUpperCase();

      if (editingDept) {
        await apiFetch(`/departments/${editingDept._id}`, { method: 'PATCH', body });
        toast.success('دیپارتمنت موفقانه ویرایش گردید.');
      } else {
        await apiFetch('/departments', { method: 'POST', body });
        toast.success('دیپارتمنت جدید موفقانه ایجاد گردید.');
      }
      setSelectedFacultyId(deptForm.facultyId);
      setDeptModalOpen(false);
      loadCatalog();
    } catch (err) {
      setDeptError(err.message || 'خطا در ذخیره دیپارتمنت.');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleDeleteDept = async (dept) => {
    if (!window.confirm(`آیا از حذف دیپارتمنت «${dept.name?.fa}» اطمینان دارید؟`)) return;
    try {
      await apiFetch(`/departments/${dept._id}`, { method: 'DELETE' });
      toast.success('دیپارتمنت حذف گردید.');
      loadCatalog();
    } catch (err) {
      toast.error(err.message || 'امکان حذف این دیپارتمنت وجود ندارد.');
    }
  };

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            <IconBuilding size={24} /> مدیریت پوهنځی‌ها و دیپارتمنت‌ها
          </h1>
          <p className="page-subtitle">
            تنظیم ساختار علمی پوهنتون کندز با نام‌های سه‌زبانه رسمی (دری، پشتو و انگلیسی) جهت درج در
            تصدیق‌نامه‌ها
          </p>
        </div>
        <div className="action-row-inline">
          <button type="button" className="btn btn-primary" onClick={openNewFaculty}>
            <IconPlus size={17} />
            <span>پوهنځی جدید</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={faculties.length === 0}
            onClick={() => openNewDept(selectedFacultyId)}
          >
            <IconPlus size={17} />
            <span>دیپارتمنت جدید</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <span>در حال بارگذاری ساختار علمی...</span>
        </div>
      ) : (
        <div className="catalog-split mt-4">
          {/* Faculties List Column */}
          <section className="card catalog-faculties">
            <div className="card-header-flex">
              <h2 className="section-title">پوهنځی‌ها ({toDariDigits(faculties.length)})</h2>
            </div>

            <ul className="faculty-list mt-3">
              {faculties.map((fac) => {
                const isSelected = fac._id === selectedFacultyId;
                return (
                  <li
                    key={fac._id}
                    className={`faculty-item${isSelected ? ' active' : ''}${
                      !fac.isActive ? ' inactive' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="faculty-select-btn"
                      onClick={() => setSelectedFacultyId(fac._id)}
                    >
                      <div className="faculty-item-top">
                        <strong>{fac.name?.fa}</strong>
                        {fac.code && (
                          <code className="code-pill" dir="ltr">
                            {fac.code}
                          </code>
                        )}
                      </div>
                      <div className="faculty-item-sub font-pashto">{fac.name?.ps}</div>
                      <div className="faculty-item-sub" dir="ltr">
                        {fac.name?.en}
                      </div>
                      <div className="faculty-item-meta">
                        <span className="tag tag-slate">
                          {toDariDigits(fac.departments?.length || 0)} دیپارتمنت
                        </span>
                        {!fac.isActive && <span className="tag tag-red">غیرفعال</span>}
                      </div>
                    </button>

                    <div className="faculty-item-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => openEditFaculty(fac)}
                        title="ویرایش پوهنځی"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-danger"
                        onClick={() => handleDeleteFaculty(fac)}
                        title="حذف پوهنځی"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Departments Panel for Selected Faculty */}
          <section className="card catalog-depts">
            {selectedFaculty ? (
              <>
                <div className="card-header-flex">
                  <div>
                    <h2 className="section-title">
                      دیپارتمنت‌های {selectedFaculty.name?.fa}
                    </h2>
                    <p className="text-muted text-sm">
                      <span className="font-pashto">{selectedFaculty.name?.ps}</span> ·{' '}
                      <bdo dir="ltr">{selectedFaculty.name?.en}</bdo>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openNewDept(selectedFaculty._id)}
                  >
                    <IconPlus size={16} />
                    <span>افزودن دیپارتمنت</span>
                  </button>
                </div>

                {!selectedFaculty.departments || selectedFaculty.departments.length === 0 ? (
                  <div className="empty-state mt-3">
                    <p className="text-muted">هنوز دیپارتمنتی برای این پوهنځی ثبت نشده است.</p>
                  </div>
                ) : (
                  <div className="table-responsive mt-3">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>کود</th>
                          <th>نام دری</th>
                          <th>نام پشتو</th>
                          <th>نام انگلیسی</th>
                          <th>وضعیت</th>
                          <th>عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedFaculty.departments.map((dept) => (
                          <tr key={dept._id}>
                            <td>
                              <code className="code-pill" dir="ltr">
                                {dept.code || '—'}
                              </code>
                            </td>
                            <td className="cell-primary">{dept.name?.fa}</td>
                            <td className="font-pashto">{dept.name?.ps}</td>
                            <td dir="ltr" className="text-left">
                              {dept.name?.en}
                            </td>
                            <td>
                              {dept.isActive ? (
                                <span className="tag tag-green">فعال</span>
                              ) : (
                                <span className="tag tag-red">غیرفعال</span>
                              )}
                            </td>
                            <td>
                              <div className="table-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  onClick={() => openEditDept(dept)}
                                >
                                  <IconEdit size={14} />
                                  <span>ویرایش</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger-outline btn-xs"
                                  onClick={() => handleDeleteDept(dept)}
                                  title="حذف دیپارتمنت"
                                >
                                  <IconTrash size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p className="text-muted">یک پوهنځی را از فهرست سمت راست انتخاب نمایید.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Faculty Create / Edit Modal */}
      <Modal
        open={facModalOpen}
        title={editingFac ? `ویرایش پوهنځی: ${editingFac.name?.fa}` : 'ایجاد پوهنځی جدید'}
        onClose={() => !facSaving && setFacModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSaveFaculty} className="form-stack" noValidate>
          {facError && <div className="alert alert-error">{facError}</div>}

          <div className="form-group">
            <label htmlFor="fac-fa" className="form-label">
              نام پوهنځی به دری <span className="req">*</span>
            </label>
            <input
              id="fac-fa"
              type="text"
              className="form-input"
              placeholder="مثال: پوهنځی کمپیوتر ساینس"
              value={facForm.name.fa}
              onChange={(e) =>
                setFacForm((p) => ({ ...p, name: { ...p.name, fa: e.target.value } }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="fac-ps" className="form-label">
              نام پوهنځی به پشتو <span className="req">*</span>
            </label>
            <input
              id="fac-ps"
              type="text"
              className="form-input font-pashto"
              placeholder="بېلګه: د کمپیوټر ساینس پوهنځی"
              value={facForm.name.ps}
              onChange={(e) =>
                setFacForm((p) => ({ ...p, name: { ...p.name, ps: e.target.value } }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="fac-en" className="form-label">
              نام پوهنځی به انگلیسی <span className="req">*</span>
            </label>
            <input
              id="fac-en"
              type="text"
              dir="ltr"
              className="form-input ltr-input"
              placeholder="e.g. Faculty of Computer Science"
              value={facForm.name.en}
              onChange={(e) =>
                setFacForm((p) => ({ ...p, name: { ...p.name, en: e.target.value } }))
              }
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="fac-code" className="form-label">
                کود اختصاری (انگلیسی، مثلاً CS)
              </label>
              <input
                id="fac-code"
                type="text"
                dir="ltr"
                className="form-input ltr-input"
                placeholder="CS"
                value={facForm.code}
                onChange={(e) => setFacForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>

            <div className="form-group form-group-center">
              <label className="checkbox-inline mt-4">
                <input
                  type="checkbox"
                  checked={facForm.isActive}
                  onChange={(e) => setFacForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span>فعال و قابل انتخاب در فورم</span>
              </label>
            </div>
          </div>

          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={facSaving}
              onClick={() => setFacModalOpen(false)}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={facSaving}>
              {facSaving ? 'در حال ذخیره...' : editingFac ? 'ثبت تغییرات' : 'ایجاد پوهنځی'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Department Create / Edit Modal */}
      <Modal
        open={deptModalOpen}
        title={editingDept ? `ویرایش دیپارتمنت: ${editingDept.name?.fa}` : 'افزودن دیپارتمنت جدید'}
        onClose={() => !deptSaving && setDeptModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSaveDept} className="form-stack" noValidate>
          {deptError && <div className="alert alert-error">{deptError}</div>}

          <div className="form-group">
            <label htmlFor="dep-fac" className="form-label">
              پوهنځی مربوطه <span className="req">*</span>
            </label>
            <select
              id="dep-fac"
              className="form-select"
              value={deptForm.facultyId}
              onChange={(e) => setDeptForm((p) => ({ ...p, facultyId: e.target.value }))}
            >
              <option value="">— انتخاب پوهنځی —</option>
              {faculties.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name?.fa} ({f.code || f.name?.en})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="dep-fa" className="form-label">
              نام دیپارتمنت به دری <span className="req">*</span>
            </label>
            <input
              id="dep-fa"
              type="text"
              className="form-input"
              placeholder="مثال: انجنیری نرم‌افزار"
              value={deptForm.name.fa}
              onChange={(e) =>
                setDeptForm((p) => ({ ...p, name: { ...p.name, fa: e.target.value } }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="dep-ps" className="form-label">
              نام دیپارتمنت به پشتو <span className="req">*</span>
            </label>
            <input
              id="dep-ps"
              type="text"
              className="form-input font-pashto"
              placeholder="بېلګه: سافټویر انجینري"
              value={deptForm.name.ps}
              onChange={(e) =>
                setDeptForm((p) => ({ ...p, name: { ...p.name, ps: e.target.value } }))
              }
            />
          </div>

          <div className="form-group">
            <label htmlFor="dep-en" className="form-label">
              نام دیپارتمنت به انگلیسی <span className="req">*</span>
            </label>
            <input
              id="dep-en"
              type="text"
              dir="ltr"
              className="form-input ltr-input"
              placeholder="e.g. Software Engineering"
              value={deptForm.name.en}
              onChange={(e) =>
                setDeptForm((p) => ({ ...p, name: { ...p.name, en: e.target.value } }))
              }
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="dep-code" className="form-label">
                کود اختصاری (اختیاری، مثلاً SE)
              </label>
              <input
                id="dep-code"
                type="text"
                dir="ltr"
                className="form-input ltr-input"
                placeholder="SE"
                value={deptForm.code}
                onChange={(e) => setDeptForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>

            <div className="form-group form-group-center">
              <label className="checkbox-inline mt-4">
                <input
                  type="checkbox"
                  checked={deptForm.isActive}
                  onChange={(e) => setDeptForm((p) => ({ ...p, isActive: e.target.checked }))}
                />
                <span>فعال و قابل انتخاب</span>
              </label>
            </div>
          </div>

          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={deptSaving}
              onClick={() => setDeptModalOpen(false)}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-primary" disabled={deptSaving}>
              {deptSaving ? 'در حال ذخیره...' : editingDept ? 'ثبت تغییرات' : 'ایجاد دیپارتمنت'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

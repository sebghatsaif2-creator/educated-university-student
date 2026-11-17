import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, clearTemplatePreviewCache } from '../api/client';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import TemplateSampleCard from '../components/TemplateSampleCard';
import CertificatePreview from '../components/CertificatePreview';
import { TEMPLATE_PLACEHOLDERS } from '../utils/format';
import { IconCheck, IconEdit, IconGrid } from '../components/Icons';

export default function AdminTemplatesPage() {
  const toast = useToast();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewGender, setPreviewGender] = useState('male');
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Fullscreen inspect
  const [inspected, setInspected] = useState(null);

  // Template + Default Texts Editor Modal
  const [editingTpl, setEditingTpl] = useState(null);
  const [editGenderTab, setEditGenderTab] = useState('male');
  const [activeLangFocus, setActiveLangFocus] = useState('fa');
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/templates', { query: { all: 'true' } });
      setTemplates(res.data?.templates || []);
    } catch (err) {
      setError(err.message || 'خطا در بارگذاری قالب‌ها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleToggleActive = async (tpl) => {
    try {
      const res = await apiFetch(`/templates/${tpl._id}/toggle`, {
        method: 'PATCH',
        body: { isActive: !tpl.isActive },
      });
      toast.success(res.message || 'وضعیت قالب تغییر یافت.');
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'خطا در تغییر وضعیت قالب.');
    }
  };

  const handleSetDefault = async (tpl) => {
    try {
      await apiFetch(`/templates/${tpl._id}`, {
        method: 'PATCH',
        body: { isActive: true, isDefault: true },
      });
      toast.success(`قالب «${tpl.labels?.fa || tpl.name}» به عنوان قالب پیش‌فرض تنظیم شد.`);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'خطا در تنظیم قالب پیش‌فرض.');
    }
  };

  const openEditTemplate = (tpl) => {
    setEditingTpl(tpl);
    setEditGenderTab('male');
    setActiveLangFocus('fa');
    setEditError('');
    setEditForm({
      name: tpl.name || '',
      labels: {
        fa: tpl.labels?.fa || tpl.name || '',
        ps: tpl.labels?.ps || '',
        en: tpl.labels?.en || '',
      },
      description: tpl.description || '',
      isActive: Boolean(tpl.isActive),
      isDefault: Boolean(tpl.isDefault),
      textDefaults: {
        fa: {
          male: tpl.textDefaults?.fa?.male || '',
          female: tpl.textDefaults?.fa?.female || '',
        },
        ps: {
          male: tpl.textDefaults?.ps?.male || '',
          female: tpl.textDefaults?.ps?.female || '',
        },
        en: {
          male: tpl.textDefaults?.en?.male || '',
          female: tpl.textDefaults?.en?.female || '',
        },
      },
    });
  };

  const updateDefaultText = (lang, gender, val) => {
    setEditForm((prev) => ({
      ...prev,
      textDefaults: {
        ...prev.textDefaults,
        [lang]: {
          ...prev.textDefaults[lang],
          [gender]: val,
        },
      },
    }));
  };

  const insertToken = (token) => {
    if (!editForm) return;
    const cur = editForm.textDefaults[activeLangFocus][editGenderTab] || '';
    const spacer = cur && !cur.endsWith(' ') ? ' ' : '';
    updateDefaultText(activeLangFocus, editGenderTab, `${cur}${spacer}${token}`);
    toast.info(`متغیر ${token} به انتهای متن ${activeLangFocus.toUpperCase()} افزوده شد.`, 2200);
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!editingTpl || !editForm) return;
    setEditError('');

    if (editForm.name.trim().length < 2) {
      setEditError('نام قالب باید حداقل ۲ حرف باشد.');
      return;
    }

    for (const lang of ['fa', 'ps', 'en']) {
      for (const g of ['male', 'female']) {
        if ((editForm.textDefaults[lang][g] || '').trim().length < 10) {
          setEditError('تمام متن‌های پیش‌فرض (دری، پشتو و انگلیسی برای ذکور و اناث) باید حداقل ۱۰ حرف باشند.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      await apiFetch(`/templates/${editingTpl._id}`, {
        method: 'PATCH',
        body: {
          name: editForm.name.trim(),
          labels: {
            fa: editForm.labels.fa.trim(),
            ps: editForm.labels.ps.trim(),
            en: editForm.labels.en.trim(),
          },
          description: editForm.description.trim(),
          isActive: editForm.isActive,
          isDefault: editForm.isDefault,
          textDefaults: editForm.textDefaults,
        },
      });

      clearTemplatePreviewCache(editingTpl._id);
      clearTemplatePreviewCache(editingTpl.key);
      setRefreshCounter((c) => c + 1);
      setEditingTpl(null);
      toast.success('قالب و متن‌های پیش‌فرض سه‌زبانه موفقانه ذخیره گردید.');
      loadTemplates();
    } catch (err) {
      setEditError(err.message || 'خطا در ذخیره تنظیمات قالب.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">
            <IconGrid size={24} /> مدیریت قالب‌ها و متن‌های پیش‌فرض
          </h1>
          <p className="page-subtitle">
            فعال/غیرفعال‌سازی ۸ قالب تصدیق‌نامه، انتخاب قالب پیش‌فرض و ویرایش متن‌های پیش‌فرض
            سه‌زبانه (ذکور و اناث)
          </p>
        </div>

        <div className="segmented-control" role="group" aria-label="جنسیت نمونه پیش‌نمایش">
          <button
            type="button"
            className={`seg-btn${previewGender === 'male' ? ' active' : ''}`}
            onClick={() => setPreviewGender('male')}
          >
            پیش‌نمایش ذکور
          </button>
          <button
            type="button"
            className={`seg-btn${previewGender === 'female' ? ' active' : ''}`}
            onClick={() => setPreviewGender('female')}
          >
            پیش‌نمایش اناث
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <span>در حال بارگذاری قالب‌ها...</span>
        </div>
      ) : (
        <div className="template-grid mt-4">
          {templates.map((tpl) => (
            <TemplateSampleCard
              key={tpl._id}
              template={tpl}
              gender={previewGender}
              refreshKey={refreshCounter}
              onInspect={(t, html) => setInspected({ template: t, html })}
              actions={
                <div className="admin-tpl-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => openEditTemplate(tpl)}
                  >
                    <IconEdit size={14} />
                    <span>ویرایش و متن پیش‌فرض</span>
                  </button>
                  {!tpl.isDefault && tpl.isActive && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-xs"
                      onClick={() => handleSetDefault(tpl)}
                    >
                      پیش‌فرض
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-xs ${
                      tpl.isActive ? 'btn-danger-outline' : 'btn-success'
                    }`}
                    onClick={() => handleToggleActive(tpl)}
                  >
                    {tpl.isActive ? 'غیرفعال' : 'فعال‌سازی'}
                  </button>
                </div>
              }
            />
          ))}
        </div>
      )}

      {/* Template & Trilingual Gendered Default Text Editor Modal */}
      <Modal
        open={Boolean(editingTpl && editForm)}
        title={
          editingTpl
            ? `ویرایش قالب و متن‌های پیش‌فرض: ${editingTpl.name} (theme-${editingTpl.key})`
            : ''
        }
        onClose={() => !saving && setEditingTpl(null)}
        size="xl"
      >
        {editForm && (
          <form onSubmit={handleSaveTemplate} className="form-stack" noValidate>
            {editError && <div className="alert alert-error">{editError}</div>}

            <div className="form-grid-3">
              <div className="form-group">
                <label htmlFor="tpl-name" className="form-label">
                  نام دری قالب <span className="req">*</span>
                </label>
                <input
                  id="tpl-name"
                  type="text"
                  className="form-input"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      name: e.target.value,
                      labels: { ...p.labels, fa: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="tpl-ps" className="form-label">
                  عنوان پشتو
                </label>
                <input
                  id="tpl-ps"
                  type="text"
                  className="form-input font-pashto"
                  value={editForm.labels.ps}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      labels: { ...p.labels, ps: e.target.value },
                    }))
                  }
                />
              </div>

              <div className="form-group">
                <label htmlFor="tpl-en" className="form-label">
                  عنوان انگلیسی
                </label>
                <input
                  id="tpl-en"
                  type="text"
                  dir="ltr"
                  className="form-input ltr-input"
                  value={editForm.labels.en}
                  onChange={(e) =>
                    setEditForm((p) => ({
                      ...p,
                      labels: { ...p.labels, en: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-grid-2">
              <div className="form-group">
                <label htmlFor="tpl-desc" className="form-label">
                  توضیح کوتاه قالب
                </label>
                <input
                  id="tpl-desc"
                  type="text"
                  className="form-input"
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              <div className="form-group checkbox-row-group">
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        isActive: e.target.checked,
                        isDefault: e.target.checked ? p.isDefault : false,
                      }))
                    }
                  />
                  <span>قالب فعال باشد</span>
                </label>
                <label className="checkbox-inline">
                  <input
                    type="checkbox"
                    checked={editForm.isDefault}
                    disabled={!editForm.isActive}
                    onChange={(e) => setEditForm((p) => ({ ...p, isDefault: e.target.checked }))}
                  />
                  <span>قالب پیش‌فرض سیستم</span>
                </label>
              </div>
            </div>

            <hr className="divider" />

            {/* Gender Switcher + Clickable Placeholder Chips */}
            <div className="card-header-flex">
              <div>
                <h4 className="section-title">متن‌های پیش‌فرض سه‌زبانه تصدیق‌نامه</h4>
                <p className="text-muted text-sm">
                  با کلیک روی هر متغیر، آن را به متن در حال ویرایش اضافه نمایید.
                </p>
              </div>

              <div className="segmented-control" role="tablist">
                <button
                  type="button"
                  className={`seg-btn${editGenderTab === 'male' ? ' active' : ''}`}
                  onClick={() => setEditGenderTab('male')}
                >
                  متن ذکور (محترم / ښاغلي / Mr.)
                </button>
                <button
                  type="button"
                  className={`seg-btn${editGenderTab === 'female' ? ' active' : ''}`}
                  onClick={() => setEditGenderTab('female')}
                >
                  متن اناث (محترمه / ځلانده / Ms.)
                </button>
              </div>
            </div>

            <div className="token-chips">
              {TEMPLATE_PLACEHOLDERS.map((ph) => (
                <button
                  key={ph.token}
                  type="button"
                  className="token-chip"
                  onClick={() => insertToken(ph.token)}
                  title={`افزودن ${ph.label}`}
                >
                  <code dir="ltr">{ph.token}</code>
                  <span>{ph.label}</span>
                </button>
              ))}
            </div>

            <div className="trilingual-editor-grid">
              <div className="form-group">
                <label htmlFor="def-ps" className="form-label">
                  متن پیش‌فرض پشتو ({editGenderTab === 'male' ? 'ذکور' : 'اناث'})
                </label>
                <textarea
                  id="def-ps"
                  dir="rtl"
                  rows={7}
                  className="form-textarea font-pashto"
                  value={editForm.textDefaults.ps[editGenderTab]}
                  onFocus={() => setActiveLangFocus('ps')}
                  onChange={(e) => updateDefaultText('ps', editGenderTab, e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="def-fa" className="form-label">
                  متن پیش‌فرض دری ({editGenderTab === 'male' ? 'ذکور' : 'اناث'})
                </label>
                <textarea
                  id="def-fa"
                  dir="rtl"
                  rows={7}
                  className="form-textarea"
                  value={editForm.textDefaults.fa[editGenderTab]}
                  onFocus={() => setActiveLangFocus('fa')}
                  onChange={(e) => updateDefaultText('fa', editGenderTab, e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="def-en" className="form-label">
                  متن پیش‌فرض انگلیسی ({editGenderTab === 'male' ? 'Male' : 'Female'})
                </label>
                <textarea
                  id="def-en"
                  dir="ltr"
                  rows={7}
                  className="form-textarea ltr-input font-english"
                  value={editForm.textDefaults.en[editGenderTab]}
                  onFocus={() => setActiveLangFocus('en')}
                  onChange={(e) => updateDefaultText('en', editGenderTab, e.target.value)}
                />
              </div>
            </div>

            <div className="form-actions-end">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => setEditingTpl(null)}
              >
                انصراف
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <IconCheck size={17} />
                <span>{saving ? 'در حال ذخیره...' : 'ذخیره تغییرات قالب و متن‌ها'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Fullscreen Preview Modal */}
      <Modal
        open={Boolean(inspected)}
        title={
          inspected
            ? `پیش‌نمایش بزرگ قالب: ${inspected.template.labels?.fa || inspected.template.name}`
            : ''
        }
        onClose={() => setInspected(null)}
        size="xl"
      >
        {inspected && (
          <div className="modal-cert-wrap">
            <CertificatePreview html={inspected.html} title={inspected.template.name} />
          </div>
        )}
      </Modal>
    </div>
  );
}

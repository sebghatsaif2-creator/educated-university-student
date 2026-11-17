import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import TemplateSampleCard from '../components/TemplateSampleCard';
import CertificatePreview from '../components/CertificatePreview';
import Modal from '../components/Modal';

export default function OfficerTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gender, setGender] = useState('male');
  const [inspected, setInspected] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch('/templates')
      .then((res) => {
        if (active) setTemplates(res.data?.templates || []);
      })
      .catch((err) => {
        if (active) setError(err.message || 'خطا در بارگذاری قالب‌ها.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">گالری قالب‌های تصدیق‌نامه (پیش‌نمایش زنده)</h1>
          <p className="page-subtitle">
            پیش‌نمایش زنده همه قالب‌های فعال سه‌زبانه با اطلاعات نمونه در قطع A4 افقی — برای انتخاب
            قالب یک درخواست، وارد صفحه جزئیات همان درخواست شوید.
          </p>
        </div>

        <div className="segmented-control" role="group" aria-label="جنسیت نمونه پیش‌نمایش">
          <button
            type="button"
            className={`seg-btn${gender === 'male' ? ' active' : ''}`}
            onClick={() => setGender('male')}
          >
            نمونه ذکور
          </button>
          <button
            type="button"
            className={`seg-btn${gender === 'female' ? ' active' : ''}`}
            onClick={() => setGender('female')}
          >
            نمونه اناث
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="page-loader">
          <div className="spinner" />
          <span>در حال بارگذاری قالب‌های فعال...</span>
        </div>
      ) : (
        <div className="template-grid">
          {templates.map((tpl) => (
            <TemplateSampleCard
              key={tpl._id}
              template={tpl}
              gender={gender}
              onInspect={(template, html) => setInspected({ template, html })}
              actions={null}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(inspected)}
        title={
          inspected
            ? `پیش‌نمایش کامل قالب: ${inspected.template.labels?.fa || inspected.template.name} (theme-${inspected.template.key})`
            : ''
        }
        onClose={() => setInspected(null)}
        size="xl"
      >
        {inspected && (
          <div className="modal-cert-wrap">
            <CertificatePreview
              html={inspected.html}
              title={`پیش‌نمایش کامل ${inspected.template.name}`}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

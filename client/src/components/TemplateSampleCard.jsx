import React, { useEffect, useState } from 'react';
import { fetchTemplateSampleHtml } from '../api/client';
import CertificatePreview from './CertificatePreview';
import { IconCheck, IconExpand } from './Icons';

export default function TemplateSampleCard({
  template,
  gender = 'male',
  refreshKey = 0,
  selected = false,
  onSelect = null,
  onInspect = null,
  selecting = false,
  actions = null,
}) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    fetchTemplateSampleHtml(template._id || template.key, {
      gender,
      forceRefresh: refreshKey > 0,
    })
      .then((resHtml) => {
        if (active) setHtml(resHtml);
      })
      .catch((err) => {
        if (active) setError(err.message || 'خطا در پیش‌نمایش');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [template._id, template.key, gender, refreshKey]);

  return (
    <article
      className={`template-card${selected ? ' template-card-selected' : ''}${
        template.isActive === false ? ' template-card-inactive' : ''
      }`}
    >
      <div className="template-thumb-wrap">
        <CertificatePreview
          html={html}
          loading={loading}
          error={error}
          title={`پیش‌نمایش قالب ${template.name}`}
        />

        {onInspect && html && (
          <button
            type="button"
            className="template-zoom-btn"
            onClick={() => onInspect(template, html)}
            title="بزرگ‌نمایی پیش‌نمایش قالب"
          >
            <IconExpand size={15} />
            <span>بزرگ‌نمایی</span>
          </button>
        )}

        {selected && (
          <span className="template-selected-pill">
            <IconCheck size={14} />
            <span>قالب انتخاب‌شده</span>
          </span>
        )}
      </div>

      <div className="template-card-body">
        <div className="template-card-top">
          <div>
            <h3 className="template-card-title">{template.labels?.fa || template.name}</h3>
            <span className="template-card-key" dir="ltr">
              theme-{template.key}
              {template.labels?.en ? ` · ${template.labels.en}` : ''}
            </span>
          </div>
          <div className="template-badges">
            {template.isDefault && <span className="tag tag-gold">پیش‌فرض</span>}
            {template.isActive === false ? (
              <span className="tag tag-red">غیرفعال</span>
            ) : (
              <span className="tag tag-green">فعال</span>
            )}
          </div>
        </div>

        {template.description && (
          <p className="template-card-desc">{template.description}</p>
        )}

        <div className="template-card-footer">
          {actions ? (
            actions
          ) : onSelect ? (
            <button
              type="button"
              className={`btn btn-sm btn-block ${selected ? 'btn-secondary' : 'btn-primary'}`}
              disabled={selecting || selected || template.isActive === false}
              onClick={() => onSelect(template)}
            >
              {selected ? (
                <>
                  <IconCheck size={16} />
                  <span>قالب فعلی این درخواست</span>
                </>
              ) : selecting ? (
                <span>در حال اعمال قالب...</span>
              ) : (
                <span>انتخاب این قالب</span>
              )}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

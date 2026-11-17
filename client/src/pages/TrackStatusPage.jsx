import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import {
  DEGREE_LABELS,
  GENDER_LABELS,
  STATUS_META,
  formatDateTime,
  toAsciiDigits,
} from '../utils/format';
import { IconAlert, IconSearch, IconShield } from '../components/Icons';

const STEPS = [
  { key: 'pending', title: 'ثبت درخواست', subtitle: 'دریافت در سیستم' },
  { key: 'approved', title: 'بررسی و تأیید', subtitle: 'صدور شماره سریال' },
  { key: 'printed', title: 'چاپ تصدیق‌نامه', subtitle: 'آماده تسلیم‌دهی' },
];

function getStepIndex(status) {
  if (status === 'printed') return 2;
  if (status === 'approved') return 1;
  return 0;
}

export default function TrackStatusPage() {
  const { code: routeCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialCode = (routeCode || searchParams.get('code') || '').trim();
  const [inputCode, setInputCode] = useState(initialCode);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupCode = useCallback(async (rawCode) => {
    const cleaned = toAsciiDigits(rawCode).trim().toUpperCase();
    if (!cleaned) {
      setError('لطفاً کود پیگیری خود را وارد نمایید.');
      setRecord(null);
      return;
    }
    if (cleaned.length < 4) {
      setError('کود پیگیری واردشده معتبر نیست.');
      setRecord(null);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/requests/track/${encodeURIComponent(cleaned)}`, {
        auth: false,
      });
      setRecord(res.data?.request || null);
    } catch (err) {
      setRecord(null);
      setError(err.message || 'درخواستی با این کود پیگیری یافت نشد.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCode) {
      setInputCode(initialCode);
      lookupCode(initialCode);
    }
  }, [initialCode, lookupCode]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = toAsciiDigits(inputCode).trim().toUpperCase();
    if (!cleaned) {
      setError('لطفاً کود پیگیری خود را وارد نمایید.');
      return;
    }
    if (cleaned !== routeCode) {
      navigate(`/track/${encodeURIComponent(cleaned)}`, { replace: false });
    } else {
      lookupCode(cleaned);
    }
  };

  const activeStep = record ? getStepIndex(record.status) : 0;
  const statusInfo = record ? STATUS_META[record.status] : null;

  return (
    <div className="container section-gap narrow-container">
      <div className="page-heading">
        <h1 className="page-title">پیگیری وضعیت درخواست تصدیق‌نامه</h1>
        <p className="page-subtitle">
          کود پیگیری دریافتی هنگام ثبت درخواست (مانند <code dir="ltr">KU-1405-XXXXXX</code>) را وارد
          نمایید تا آخرین وضعیت درخواست خود را مشاهده کنید.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card lookup-bar" noValidate>
        <div className="lookup-input-wrap">
          <input
            type="text"
            dir="ltr"
            className="form-input ltr-input lookup-input"
            placeholder="KU-1405-TST002"
            aria-label="کود پیگیری درخواست"
            value={inputCode}
            onChange={(e) => {
              setInputCode(e.target.value);
              if (error) setError('');
            }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <IconSearch size={18} />
            <span>{loading ? 'در حال جستجو...' : 'جستجوی وضعیت'}</span>
          </button>
        </div>
        {error && (
          <div className="alert alert-error mt-3" role="alert">
            {error}
          </div>
        )}
      </form>

      {record && (
        <section className="card mt-4" aria-label="نتیجه پیگیری درخواست">
          <div className="card-header-flex">
            <div>
              <span className="eyebrow-label">کود پیگیری</span>
              <h2 className="mono-heading" dir="ltr">
                {record.trackingCode}
              </h2>
            </div>
            <StatusBadge status={record.status} size="lg" />
          </div>

          {statusInfo && (
            <p className={`status-callout callout-${statusInfo.tone}`}>
              {statusInfo.description}
            </p>
          )}

          {/* Visual 3-Step RTL Progress Bar (when not rejected) */}
          {record.status !== 'rejected' ? (
            <ol className="progress-stepper" aria-label="مراحل طی‌شده درخواست">
              {STEPS.map((step, idx) => {
                const state =
                  idx < activeStep ? 'done' : idx === activeStep ? 'current' : 'upcoming';
                return (
                  <li key={step.key} className={`step-item step-${state}`}>
                    <div className="step-circle">{idx < activeStep ? '✓' : idx + 1}</div>
                    <div className="step-text">
                      <strong>{step.title}</strong>
                      <span>{step.subtitle}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="reject-reason-box" role="alert">
              <div className="reject-reason-title">
                <IconAlert size={18} />
                <strong>دلیل رد درخواست:</strong>
              </div>
              <p>{record.rejectReason || 'دلیلی ثبت نشده است.'}</p>
            </div>
          )}

          <dl className="detail-grid mt-4">
            <div>
              <dt>نام فارغ‌التحصیل</dt>
              <dd>{record.firstName}</dd>
            </div>
            <div>
              <dt>نام پدر</dt>
              <dd>{record.fatherName}</dd>
            </div>
            <div>
              <dt>جنسیت</dt>
              <dd>{GENDER_LABELS[record.gender] || record.gender}</dd>
            </div>
            <div>
              <dt>مقطع تحصیلی</dt>
              <dd>{DEGREE_LABELS[record.degreeLevel] || record.degreeLevel}</dd>
            </div>
            <div>
              <dt>پوهنځی</dt>
              <dd>{record.faculty?.name?.fa || '—'}</dd>
            </div>
            <div>
              <dt>دیپارتمنت</dt>
              <dd>{record.department?.name?.fa || '—'}</dd>
            </div>
            <div>
              <dt>سال فراغت</dt>
              <dd>
                {record.gradYearSH} هـ.ش ({record.gradYearAD} میلادی)
              </dd>
            </div>
            <div>
              <dt>تاریخ ثبت درخواست</dt>
              <dd>{formatDateTime(record.createdAt)}</dd>
            </div>

            {record.serial && (
              <div>
                <dt>شماره سریال تصدیق‌نامه</dt>
                <dd>
                  <code className="code-pill" dir="ltr">
                    {record.serial}
                  </code>
                </dd>
              </div>
            )}
            {record.officialNo && (
              <div>
                <dt>نمبر ثبت رسمی (ثبت ګڼه)</dt>
                <dd>
                  <code className="code-pill" dir="ltr">
                    {record.officialNo}
                  </code>
                </dd>
              </div>
            )}
            {record.approvedAt && (
              <div>
                <dt>تاریخ تأیید</dt>
                <dd>{formatDateTime(record.approvedAt)}</dd>
              </div>
            )}
            {record.printedAt && (
              <div>
                <dt>تاریخ چاپ</dt>
                <dd>{formatDateTime(record.printedAt)}</dd>
              </div>
            )}
          </dl>

          {record.serial && (
            <div className="card-footer-row">
              <Link
                to={`/verify/${encodeURIComponent(record.serial)}`}
                className="btn btn-secondary btn-sm"
              >
                <IconShield size={16} />
                <span>مشاهده صفحه تأیید اصالت تصدیق‌نامه</span>
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

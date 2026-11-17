import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import { DEGREE_LABELS, formatDateTime } from '../utils/format';
import {
  IconCheck,
  IconCheckCircle,
  IconCopy,
  IconFileText,
  IconPrinter,
  IconSearch,
} from '../components/Icons';

export default function ApplicantSuccessPage() {
  const { code = '' } = useParams();
  const location = useLocation();
  const toast = useToast();

  const trackingCode = decodeURIComponent(code || location.state?.trackingCode || '').toUpperCase();
  const [details, setDetails] = useState(() => {
    const passed = location.state?.request;
    if (!passed) return null;
    return {
      firstName: passed.firstName,
      fatherName: passed.fatherName,
      faculty: passed.facultyId || passed.faculty,
      department: passed.departmentId || passed.department,
      degreeLevel: passed.degreeLevel,
      gradYearSH: passed.gradYearSH,
      gradYearAD: passed.gradYearAD,
      status: passed.status || 'pending',
      createdAt: passed.createdAt,
    };
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (details || !trackingCode) return undefined;
    let active = true;
    apiFetch(`/requests/track/${encodeURIComponent(trackingCode)}`, { auth: false })
      .then((res) => {
        if (active && res.data?.request) {
          setDetails(res.data.request);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [details, trackingCode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(trackingCode);
      setCopied(true);
      toast.success('کود پیگیری در حافظه کاپی شد.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.info(`کود پیگیری شما: ${trackingCode}`);
    }
  };

  return (
    <div className="container section-gap narrow-container">
      <div className="card success-card receipt-printable">
        <div className="print-only receipt-print-header">
          <img src="/logos/university-logo.png" alt="" width="56" height="56" />
          <div>
            <strong>پوهنتون کندز — معاونیت امور محصلان</strong>
            <div>رسید ثبت درخواست تصدیق‌نامه فراغت</div>
          </div>
        </div>

        <div className="success-icon-wrap">
          <IconCheckCircle size={48} />
        </div>

        <h1 className="success-title">درخواست شما موفقانه ثبت گردید!</h1>
        <p className="success-subtitle">
          لطفاً کود پیگیری ذیل را یادداشت یا چاپ نمایید. برای بررسی وضعیت درخواست و مراجعه به معاونیت
          امور محصلان به این کود ضرورت خواهید داشت.
        </p>

        <div className="tracking-code-box">
          <span className="tracking-code-label">کود پیگیری یکتا</span>
          <div className="tracking-code-row">
            <code className="tracking-code-value" dir="ltr">
              {trackingCode}
            </code>
            <button
              type="button"
              className="btn btn-secondary btn-sm no-print"
              onClick={handleCopy}
            >
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              <span>{copied ? 'کاپی شد' : 'کاپی کود'}</span>
            </button>
          </div>
        </div>

        {details && (
          <dl className="detail-grid receipt-details">
            <div>
              <dt>نام و نام پدر</dt>
              <dd>
                {details.firstName} فرزند {details.fatherName}
              </dd>
            </div>
            <div>
              <dt>وضعیت فعلی</dt>
              <dd>
                <StatusBadge status={details.status} size="sm" />
              </dd>
            </div>
            <div>
              <dt>پوهنځی</dt>
              <dd>{details.faculty?.name?.fa || '—'}</dd>
            </div>
            <div>
              <dt>دیپارتمنت</dt>
              <dd>{details.department?.name?.fa || '—'}</dd>
            </div>
            <div>
              <dt>مقطع و سال فراغت</dt>
              <dd>
                {DEGREE_LABELS[details.degreeLevel] || details.degreeLevel} — سال{' '}
                {details.gradYearSH} هـ.ش ({details.gradYearAD} م)
              </dd>
            </div>
            <div>
              <dt>زمان ثبت درخواست</dt>
              <dd>{formatDateTime(details.createdAt)}</dd>
            </div>
          </dl>
        )}

        <div className="action-row-center no-print">
          <Link
            to={`/track/${encodeURIComponent(trackingCode)}`}
            className="btn btn-primary"
          >
            <IconSearch size={18} />
            <span>پیگیری وضعیت درخواست</span>
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.print()}
          >
            <IconPrinter size={18} />
            <span>چاپ رسید پیگیری</span>
          </button>
          <Link to="/" className="btn btn-ghost">
            <IconFileText size={18} />
            <span>ثبت درخواست جدید</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

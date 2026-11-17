import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { DEGREE_LABELS, formatDateTime, toAsciiDigits } from '../utils/format';
import { IconCheckCircle, IconSearch, IconXCircle } from '../components/Icons';

export default function VerifyPage() {
  const { serial: routeSerial } = useParams();
  const navigate = useNavigate();

  const [serialInput, setSerialInput] = useState(routeSerial || '');
  const [loading, setLoading] = useState(false);
  const [cert, setCert] = useState(null);
  const [notFoundMsg, setNotFoundMsg] = useState('');
  const [inputError, setInputError] = useState('');

  const runVerify = useCallback(async (rawSerial) => {
    const cleaned = toAsciiDigits(rawSerial).trim().toUpperCase();
    if (!cleaned) {
      setInputError('لطفاً شماره سریال تصدیق‌نامه را وارد نمایید.');
      return;
    }
    if (cleaned.length < 4) {
      setInputError('شماره سریال واردشده معتبر نیست.');
      return;
    }

    setLoading(true);
    setInputError('');
    setNotFoundMsg('');
    setCert(null);

    try {
      const res = await apiFetch(`/verify/${encodeURIComponent(cleaned)}`, {
        auth: false,
      });
      setCert(res.data || null);
    } catch (err) {
      setCert(null);
      setNotFoundMsg(
        err.message || 'تصدیق‌نامه‌ای با این شماره سریال در سیستم پوهنتون کندز یافت نشد.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (routeSerial) {
      const decoded = decodeURIComponent(routeSerial);
      setSerialInput(decoded);
      runVerify(decoded);
    } else {
      setCert(null);
      setNotFoundMsg('');
    }
  }, [routeSerial, runVerify]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = toAsciiDigits(serialInput).trim().toUpperCase();
    if (!cleaned) {
      setInputError('لطفاً شماره سریال تصدیق‌نامه را وارد نمایید.');
      return;
    }
    if (cleaned !== routeSerial) {
      navigate(`/verify/${encodeURIComponent(cleaned)}`);
    } else {
      runVerify(cleaned);
    }
  };

  return (
    <div className="container section-gap narrow-container">
      {/* Official Emblem Header */}
      <div className="verify-header-card card">
        <div className="verify-logos">
          <img
            src="/logos/university-logo.png"
            alt="نشان پوهنتون کندز"
            className="verify-logo-ku"
          />
          <img
            src="/logos/ministry-logo.png"
            alt="نشان وزارت تحصیلات عالی"
            className="verify-logo-mohe"
          />
        </div>
        <h1 className="page-title">سامانه تأیید اصالت تصدیق‌نامه فراغت</h1>
        <p className="page-subtitle">
          پوهنتون کندز — معاونیت امور محصلان | با اسکن کود QR روی تصدیق‌نامه یا وارد نمودن شماره
          سریال (مانند <code dir="ltr">KU-2026-000001</code>) صحت سند را بررسی نمایید.
        </p>

        <form onSubmit={handleSubmit} className="lookup-bar-inline mt-3" noValidate>
          <div className="lookup-input-wrap">
            <input
              type="text"
              dir="ltr"
              className="form-input ltr-input lookup-input"
              placeholder="KU-2026-000001"
              aria-label="شماره سریال تصدیق‌نامه"
              value={serialInput}
              onChange={(e) => {
                setSerialInput(e.target.value);
                if (inputError) setInputError('');
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <IconSearch size={18} />
              <span>{loading ? 'در حال بررسی...' : 'تأیید اصالت'}</span>
            </button>
          </div>
          {inputError && <div className="alert alert-error mt-3">{inputError}</div>}
        </form>
      </div>

      {/* Verified Certificate Card */}
      {cert && (
        <section className="card verify-result verify-valid mt-4" aria-live="polite">
          <div className="verify-banner verify-banner-valid">
            <IconCheckCircle size={34} />
            <div>
              <h2>تصدیق‌نامه معتبر و مورد تأیید می‌باشد</h2>
              <p>این سند رسماً در دیتابیس معاونیت امور محصلان پوهنتون کندز ثبت گردیده است.</p>
            </div>
          </div>

          <dl className="detail-grid mt-4">
            <div>
              <dt>شماره سریال</dt>
              <dd>
                <code className="code-pill code-pill-lg" dir="ltr">
                  {cert.serial}
                </code>
              </dd>
            </div>
            <div>
              <dt>وضعیت سند</dt>
              <dd>
                <StatusBadge status={cert.status} />
              </dd>
            </div>
            <div>
              <dt>نام فارغ‌التحصیل</dt>
              <dd>
                <strong>{cert.nameI18n?.fa || cert.name}</strong>
                {cert.nameI18n?.en && cert.nameI18n.en !== cert.name && (
                  <span className="sub-ltr" dir="ltr">
                    {cert.nameI18n.en}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt>نام پدر</dt>
              <dd>{cert.fatherName || '—'}</dd>
            </div>
            <div>
              <dt>پوهنځی</dt>
              <dd>
                <div>{cert.faculty?.fa || '—'}</div>
                {cert.faculty?.ps && <div className="sub-ps font-pashto">{cert.faculty.ps}</div>}
                {cert.faculty?.en && (
                  <div className="sub-ltr" dir="ltr">
                    {cert.faculty.en}
                  </div>
                )}
              </dd>
            </div>
            <div>
              <dt>دیپارتمنت</dt>
              <dd>
                <div>{cert.department?.fa || '—'}</div>
                {cert.department?.en && (
                  <div className="sub-ltr" dir="ltr">
                    {cert.department.en}
                  </div>
                )}
              </dd>
            </div>
            <div>
              <dt>مقطع تحصیلی</dt>
              <dd>{DEGREE_LABELS[cert.degreeLevel] || cert.degreeLevel}</dd>
            </div>
            <div>
              <dt>سال فراغت</dt>
              <dd>
                {cert.year?.sh ?? cert.gradYearSH} هـ.ش ({cert.year?.ad ?? cert.gradYearAD} میلادی)
              </dd>
            </div>
            {cert.officialNo && (
              <div>
                <dt>نمبر ثبت رسمی (د ثبت ګڼه)</dt>
                <dd>
                  <code className="code-pill" dir="ltr">
                    {cert.officialNo}
                  </code>
                </dd>
              </div>
            )}
            {cert.approvedAt && (
              <div>
                <dt>تاریخ تأیید رسمی</dt>
                <dd>{formatDateTime(cert.approvedAt, { withTime: false })}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {/* Invalid / Not Found Result */}
      {notFoundMsg && !loading && (
        <section className="card verify-result verify-invalid mt-4" role="alert">
          <div className="verify-banner verify-banner-invalid">
            <IconXCircle size={34} />
            <div>
              <h2>تصدیق‌نامه در سیستم یافت نشد</h2>
              <p>{notFoundMsg}</p>
            </div>
          </div>
          <p className="verify-help-note">
            لطفاً از درستی شماره سریال واردشده اطمینان حاصل نمایید. در صورت مشکوک بودن سند، جهت بررسی
            حضوری با معاونیت امور محصلان پوهنتون کندز تماس بگیرید.
          </p>
        </section>
      )}
    </div>
  );
}

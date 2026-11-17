import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, extractFieldErrors } from '../api/client';
import { useToast } from '../context/ToastContext';
import { DEGREE_OPTIONS, toAsciiDigits } from '../utils/format';
import { IconFileText, IconSearch, IconShield } from '../components/Icons';

const INITIAL_FORM = {
  firstName: '',
  fatherName: '',
  gender: 'male',
  nationalId: '',
  facultyId: '',
  departmentId: '',
  degreeLevel: 'bachelor',
  gradYearSH: '1404',
  gradYearAD: '2025',
  phone: '',
  email: '',
  notes: '',
  firstNamePs: '',
  firstNameEn: '',
  fatherNamePs: '',
  fatherNameEn: '',
};

const PHONE_RE = /^[+0-9()\-\s]{7,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ApplicantSubmitPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(INITIAL_FORM);
  const [adEditedManually, setAdEditedManually] = useState(false);
  const [showTrilingual, setShowTrilingual] = useState(false);

  const [faculties, setFaculties] = useState([]);
  const [loadingFaculties, setLoadingFaculties] = useState(true);

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load active faculties on mount
  useEffect(() => {
    let active = true;
    setLoadingFaculties(true);
    apiFetch('/faculties', { auth: false })
      .then((res) => {
        if (active) setFaculties(res.data?.faculties || []);
      })
      .catch((err) => {
        if (active) setFormError(err.message || 'خطا در دریافت فهرست پوهنځی‌ها.');
      })
      .finally(() => {
        if (active) setLoadingFaculties(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Dependent Department Dropdown: load departments whenever facultyId changes
  useEffect(() => {
    if (!form.facultyId) {
      setDepartments([]);
      return undefined;
    }

    let active = true;
    setLoadingDepts(true);
    apiFetch('/departments', {
      auth: false,
      query: { faculty: form.facultyId },
    })
      .then((res) => {
        if (active) setDepartments(res.data?.departments || []);
      })
      .catch(() => {
        // Fallback to nested departments from /api/faculties if already loaded
        if (active) {
          const matched = faculties.find((f) => f._id === form.facultyId);
          setDepartments(matched?.departments || []);
        }
      })
      .finally(() => {
        if (active) setLoadingDepts(false);
      });

    return () => {
      active = false;
    };
  }, [form.facultyId, faculties]);

  const setField = (name, value) => {
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'facultyId') {
        next.departmentId = '';
      }
      if (name === 'gradYearSH' && !adEditedManually) {
        const shNum = Number(toAsciiDigits(value).trim());
        if (Number.isInteger(shNum) && shNum >= 1350 && shNum <= 1450) {
          next.gradYearAD = String(shNum + 621);
        } else if (!value.trim()) {
          next.gradYearAD = '';
        }
      }
      return next;
    });

    setErrors((prev) => {
      if (!prev[name] && !(name === 'facultyId' && prev.departmentId)) return prev;
      const copy = { ...prev };
      delete copy[name];
      if (name === 'facultyId') delete copy.departmentId;
      return copy;
    });
  };

  const validateDari = () => {
    const nextErrors = {};

    if (!form.firstName.trim()) {
      nextErrors.firstName = 'وارد کردن نام متقاضی الزامی است.';
    } else if (form.firstName.trim().length < 2) {
      nextErrors.firstName = 'نام متقاضی باید حداقل ۲ حرف باشد.';
    }

    if (!form.fatherName.trim()) {
      nextErrors.fatherName = 'وارد کردن نام پدر الزامی است.';
    } else if (form.fatherName.trim().length < 2) {
      nextErrors.fatherName = 'نام پدر باید حداقل ۲ حرف باشد.';
    }

    if (!['male', 'female'].includes(form.gender)) {
      nextErrors.gender = 'لطفاً جنسیت را انتخاب نمایید.';
    }

    const cleanNid = toAsciiDigits(form.nationalId).trim();
    if (!cleanNid) {
      nextErrors.nationalId = 'وارد کردن نمبر تذکره الزامی است.';
    } else if (cleanNid.length < 3) {
      nextErrors.nationalId = 'نمبر تذکره باید حداقل ۳ رقم یا حرف باشد.';
    }

    if (!form.facultyId) {
      nextErrors.facultyId = 'لطفاً پوهنځی خود را انتخاب نمایید.';
    }

    if (!form.departmentId) {
      nextErrors.departmentId = 'لطفاً دیپارتمنت خود را انتخاب نمایید.';
    }

    const shRaw = toAsciiDigits(form.gradYearSH).trim();
    const shNum = Number(shRaw);
    if (!shRaw) {
      nextErrors.gradYearSH = 'سال فراغت (هجری شمسی) الزامی است.';
    } else if (!Number.isInteger(shNum) || shNum < 1350 || shNum > 1450) {
      nextErrors.gradYearSH = 'سال فراغت هجری شمسی باید عددی بین ۱۳۵۰ تا ۱۴۵۰ باشد.';
    }

    const adRaw = toAsciiDigits(form.gradYearAD).trim();
    if (adRaw) {
      const adNum = Number(adRaw);
      if (!Number.isInteger(adNum) || adNum < 1970 || adNum > 2075) {
        nextErrors.gradYearAD = 'سال فراغت میلادی باید عددی بین ۱۹۷۰ تا ۲۰۷۵ باشد.';
      }
    }

    const cleanPhone = toAsciiDigits(form.phone).trim();
    if (!cleanPhone) {
      nextErrors.phone = 'وارد کردن شماره تماس الزامی است.';
    } else if (!PHONE_RE.test(cleanPhone)) {
      nextErrors.phone = 'شماره تماس معتبر نیست (حداقل ۷ رقم، مثلاً 0700123456).';
    }

    const cleanEmail = form.email.trim();
    if (cleanEmail && !EMAIL_RE.test(cleanEmail)) {
      nextErrors.email = 'فارمت ایمیل واردشده نادرست است.';
    }

    if (form.notes.trim().length > 1000) {
      nextErrors.notes = 'یادداشت نباید بیشتر از ۱۰۰۰ حرف باشد.';
    }

    return nextErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const validationErrors = validateDari();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormError('لطفاً موارد مشخص‌شده در فورم را اصلاح و تکمیل نمایید.');
      return;
    }

    const gradYearSH = Number(toAsciiDigits(form.gradYearSH).trim());
    const adRaw = toAsciiDigits(form.gradYearAD).trim();
    const gradYearAD = adRaw ? Number(adRaw) : gradYearSH + 621;

    const payload = {
      firstName: form.firstName.trim(),
      fatherName: form.fatherName.trim(),
      gender: form.gender,
      nationalId: toAsciiDigits(form.nationalId).trim(),
      phone: toAsciiDigits(form.phone).trim(),
      email: form.email.trim(),
      facultyId: form.facultyId,
      departmentId: form.departmentId,
      degreeLevel: form.degreeLevel,
      gradYearSH,
      gradYearAD,
      notes: form.notes.trim(),
      firstNameI18n: {
        fa: form.firstName.trim(),
        ps: form.firstNamePs.trim(),
        en: form.firstNameEn.trim(),
      },
      fatherNameI18n: {
        fa: form.fatherName.trim(),
        ps: form.fatherNamePs.trim(),
        en: form.fatherNameEn.trim(),
      },
    };

    setSubmitting(true);
    try {
      const res = await apiFetch('/requests', {
        method: 'POST',
        auth: false,
        body: payload,
      });

      const code = res.data?.trackingCode;
      toast.success('درخواست تصدیق‌نامه شما موفقانه ثبت گردید.');
      navigate(`/request-success/${encodeURIComponent(code)}`, {
        state: {
          trackingCode: code,
          request: res.data?.request || null,
        },
      });
    } catch (err) {
      const serverFieldErrors = extractFieldErrors(err);
      if (Object.keys(serverFieldErrors).length > 0) {
        setErrors(serverFieldErrors);
      }
      setFormError(err.message || 'ثبت درخواست با خطا مواجه گردید.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container section-gap">
      {/* Institutional Hero Strip */}
      <section className="hero-banner">
        <div className="hero-content">
          <h1 className="hero-title">ثبت درخواست تصدیق‌نامه فراغت</h1>
          <p className="hero-subtitle">
            فارغ‌التحصیلان محترم پوهنتون کندز می‌توانند بدون نیاز به حساب کاربری، فورم ذیل را با دقت
            خانه‌پری نموده و کود پیگیری یکتا دریافت نمایند.
          </p>
        </div>
        <div className="hero-quick-links">
          <Link to="/track" className="btn btn-outline-light">
            <IconSearch size={17} />
            <span>پیگیری درخواست قبلی</span>
          </Link>
          <Link to="/verify" className="btn btn-ghost-light">
            <IconShield size={17} />
            <span>تأیید اصالت سند</span>
          </Link>
        </div>
      </section>

      {/* Main Submission Form */}
      <form onSubmit={handleSubmit} className="card form-card" noValidate>
        {formError && (
          <div className="alert alert-error" role="alert">
            {formError}
          </div>
        )}

        {/* Section 1: Personal Info */}
        <div className="form-section">
          <div className="form-section-header">
            <span className="step-num">۱</span>
            <div>
              <h2 className="form-section-title">مشخصات شهرت فارغ‌التحصیل</h2>
              <p className="form-section-desc">
                لطفاً نام، نام پدر و نمبر تذکره را مطابق تذکره تابعیت و اسناد تحصیلی وارد نمایید.
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                نام (به دری) <span className="req">*</span>
              </label>
              <input
                id="firstName"
                type="text"
                className={`form-input${errors.firstName ? ' input-error' : ''}`}
                placeholder="مثال: احمد فواد"
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
              />
              {errors.firstName && <span className="field-error">{errors.firstName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fatherName" className="form-label">
                نام پدر (به دری) <span className="req">*</span>
              </label>
              <input
                id="fatherName"
                type="text"
                className={`form-input${errors.fatherName ? ' input-error' : ''}`}
                placeholder="مثال: غلام فاروق"
                value={form.fatherName}
                onChange={(e) => setField('fatherName', e.target.value)}
              />
              {errors.fatherName && <span className="field-error">{errors.fatherName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">
                جنسیت <span className="req">*</span>
              </label>
              <div className="radio-pill-group" role="radiogroup" aria-label="جنسیت">
                <label className={`radio-pill${form.gender === 'male' ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="male"
                    checked={form.gender === 'male'}
                    onChange={() => setField('gender', 'male')}
                  />
                  <span>ذکور (مرد)</span>
                </label>
                <label className={`radio-pill${form.gender === 'female' ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="female"
                    checked={form.gender === 'female'}
                    onChange={() => setField('gender', 'female')}
                  />
                  <span>اناث (زن)</span>
                </label>
              </div>
              {errors.gender && <span className="field-error">{errors.gender}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="nationalId" className="form-label">
                نمبر تذکره تابعیت <span className="req">*</span>
              </label>
              <input
                id="nationalId"
                type="text"
                dir="ltr"
                className={`form-input ltr-input${errors.nationalId ? ' input-error' : ''}`}
                placeholder="1400-0201-45821"
                value={form.nationalId}
                onChange={(e) => setField('nationalId', e.target.value)}
              />
              {errors.nationalId && <span className="field-error">{errors.nationalId}</span>}
            </div>
          </div>

          {/* Optional Trilingual Name Spelling */}
          <div className="optional-box">
            <button
              type="button"
              className="optional-toggle"
              onClick={() => setShowTrilingual((v) => !v)}
              aria-expanded={showTrilingual}
            >
              <span>
                درج املای دقیق نام و نام پدر به انگلیسی و پشتو (اختیاری — برای تصدیق‌نامه سه‌زبانه)
              </span>
              <span className="toggle-indicator">{showTrilingual ? 'بستن −' : 'باز کردن +'}</span>
            </button>

            {showTrilingual && (
              <div className="form-grid-2 optional-body">
                <div className="form-group">
                  <label htmlFor="firstNameEn" className="form-label">
                    نام به انگلیسی (First / Full Name)
                  </label>
                  <input
                    id="firstNameEn"
                    type="text"
                    dir="ltr"
                    className="form-input ltr-input"
                    placeholder="e.g. Ahmad Fawad"
                    value={form.firstNameEn}
                    onChange={(e) => setField('firstNameEn', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fatherNameEn" className="form-label">
                    نام پدر به انگلیسی (Father&#39;s Name)
                  </label>
                  <input
                    id="fatherNameEn"
                    type="text"
                    dir="ltr"
                    className="form-input ltr-input"
                    placeholder="e.g. Ghulam Farooq"
                    value={form.fatherNameEn}
                    onChange={(e) => setField('fatherNameEn', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="firstNamePs" className="form-label">
                    نام به پشتو (نوم)
                  </label>
                  <input
                    id="firstNamePs"
                    type="text"
                    dir="rtl"
                    className="form-input font-pashto"
                    placeholder="بېلګه: احمد فواد"
                    value={form.firstNamePs}
                    onChange={(e) => setField('firstNamePs', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="fatherNamePs" className="form-label">
                    نام پدر به پشتو (د پلار نوم)
                  </label>
                  <input
                    id="fatherNamePs"
                    type="text"
                    dir="rtl"
                    className="form-input font-pashto"
                    placeholder="بېلګه: غلام فاروق"
                    value={form.fatherNamePs}
                    onChange={(e) => setField('fatherNamePs', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Academic Info (Dependent Faculty -> Department) */}
        <div className="form-section">
          <div className="form-section-header">
            <span className="step-num">۲</span>
            <div>
              <h2 className="form-section-title">مشخصات تحصیلی</h2>
              <p className="form-section-desc">
                ابتدا پوهنځی را انتخاب کنید تا دیپارتمنت‌های مربوط به آن نمایش داده شود.
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="facultyId" className="form-label">
                پوهنځی <span className="req">*</span>
              </label>
              <select
                id="facultyId"
                className={`form-select${errors.facultyId ? ' input-error' : ''}`}
                value={form.facultyId}
                onChange={(e) => setField('facultyId', e.target.value)}
                disabled={loadingFaculties}
              >
                <option value="">
                  {loadingFaculties ? 'در حال بارگذاری پوهنځی‌ها...' : '— انتخاب پوهنځی —'}
                </option>
                {faculties.map((fac) => (
                  <option key={fac._id} value={fac._id}>
                    {fac.name?.fa} ({fac.name?.en})
                  </option>
                ))}
              </select>
              {errors.facultyId && <span className="field-error">{errors.facultyId}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="departmentId" className="form-label">
                دیپارتمنت <span className="req">*</span>
              </label>
              <select
                id="departmentId"
                className={`form-select${errors.departmentId ? ' input-error' : ''}`}
                value={form.departmentId}
                onChange={(e) => setField('departmentId', e.target.value)}
                disabled={!form.facultyId || loadingDepts}
              >
                <option value="">
                  {!form.facultyId
                    ? '— ابتدا پوهنځی را انتخاب نمایید —'
                    : loadingDepts
                      ? 'در حال بارگذاری دیپارتمنت‌ها...'
                      : departments.length === 0
                        ? 'هیچ دیپارتمنت فعالی یافت نشد'
                        : '— انتخاب دیپارتمنت —'}
                </option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name?.fa} ({dept.name?.en})
                  </option>
                ))}
              </select>
              {errors.departmentId && <span className="field-error">{errors.departmentId}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="degreeLevel" className="form-label">
                مقطع تحصیلی <span className="req">*</span>
              </label>
              <select
                id="degreeLevel"
                className="form-select"
                value={form.degreeLevel}
                onChange={(e) => setField('degreeLevel', e.target.value)}
              >
                {DEGREE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2-tight">
              <div className="form-group">
                <label htmlFor="gradYearSH" className="form-label">
                  سال فراغت (هـ.ش) <span className="req">*</span>
                </label>
                <input
                  id="gradYearSH"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className={`form-input ltr-input${errors.gradYearSH ? ' input-error' : ''}`}
                  placeholder="1404"
                  value={form.gradYearSH}
                  onChange={(e) => setField('gradYearSH', e.target.value)}
                />
                {errors.gradYearSH && <span className="field-error">{errors.gradYearSH}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="gradYearAD" className="form-label">
                  سال فراغت (میلادی)
                </label>
                <input
                  id="gradYearAD"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className={`form-input ltr-input${errors.gradYearAD ? ' input-error' : ''}`}
                  placeholder="2025"
                  value={form.gradYearAD}
                  onChange={(e) => {
                    setAdEditedManually(true);
                    setField('gradYearAD', e.target.value);
                  }}
                />
                {errors.gradYearAD && <span className="field-error">{errors.gradYearAD}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: Contact & Notes */}
        <div className="form-section">
          <div className="form-section-header">
            <span className="step-num">۳</span>
            <div>
              <h2 className="form-section-title">اطلاعات تماس و یادداشت</h2>
              <p className="form-section-desc">
                شماره تماس فعال جهت هماهنگی احتمالی با معاونیت امور محصلان الزامی است.
              </p>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                شماره تماس <span className="req">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                dir="ltr"
                className={`form-input ltr-input${errors.phone ? ' input-error' : ''}`}
                placeholder="0700123456"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
              />
              {errors.phone && <span className="field-error">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email" className="form-label">
                ایمیل آدرس (اختیاری)
              </label>
              <input
                id="email"
                type="email"
                dir="ltr"
                className={`form-input ltr-input${errors.email ? ' input-error' : ''}`}
                placeholder="student@example.af"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
              />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes" className="form-label">
              توضیحات یا یادداشت تکمیلی (اختیاری)
            </label>
            <textarea
              id="notes"
              rows={3}
              className={`form-textarea${errors.notes ? ' input-error' : ''}`}
              placeholder="در صورت داشتن توضیح خاص (مثلاً شماره آی‌دی محصلی یا سمستر فراغت) اینجا بنویسید..."
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
            />
            {errors.notes && <span className="field-error">{errors.notes}</span>}
          </div>
        </div>

        {/* Submit Bar */}
        <div className="form-submit-bar">
          <p className="form-hint">
            پس از ثبت درخواست، یک <strong>کود پیگیری یکتا</strong> برای شما صادر می‌شود.
          </p>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={submitting || loadingFaculties}
          >
            <IconFileText size={19} />
            <span>{submitting ? 'در حال ثبت درخواست...' : 'ثبت درخواست و دریافت کود پیگیری'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

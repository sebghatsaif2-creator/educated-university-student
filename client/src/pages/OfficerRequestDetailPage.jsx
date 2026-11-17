import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  apiFetch,
  fetchRequestPreviewHtml,
  generateCertificatePdfBlob,
} from '../api/client';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import CertificatePreview from '../components/CertificatePreview';
import TemplateSampleCard from '../components/TemplateSampleCard';
import {
  DEGREE_LABELS,
  GENDER_LABELS,
  formatDateTime,
  openPdfForPrint,
  toDariDigits,
  triggerBlobDownload,
} from '../utils/format';
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconEdit,
  IconExpand,
  IconFileText,
  IconGrid,
  IconPrinter,
  IconRefresh,
  IconShield,
  IconXCircle,
} from '../components/Icons';

export default function OfficerRequestDetailPage({ defaultTab = 'details' }) {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();

  const activeTab = searchParams.get('tab') || defaultTab;
  const setTab = (tab) => {
    setSearchParams(tab === 'details' ? {} : { tab }, { replace: true });
  };

  const [reqDoc, setReqDoc] = useState(null);
  const [printLogs, setPrintLogs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editable finalText state (fa, ps, en)
  const [draftText, setDraftText] = useState({ fa: '', ps: '', en: '' });
  const [savingText, setSavingText] = useState(false);
  const [resettingText, setResettingText] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Live preview state (for this request)
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [fitWarning, setFitWarning] = useState('');
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  // Template picker state
  const [sampleGender, setSampleGender] = useState('male');
  const [regenOnTemplateChange, setRegenOnTemplateChange] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState('');
  const [inspectedSample, setInspectedSample] = useState(null);

  // Approve modal state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveForm, setApproveForm] = useState({
    templateId: '',
    officialNo: '',
    firstNameFa: '',
    firstNamePs: '',
    firstNameEn: '',
    fatherNameFa: '',
    fatherNamePs: '',
    fatherNameEn: '',
  });
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');

  // Reject modal state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState('');

  // PDF & Print action state (+ reprint reason modal)
  const [pdfBusyMode, setPdfBusyMode] = useState(''); // '' | 'download' | 'print'
  const [reprintModalMode, setReprintModalMode] = useState(''); // '' | 'download' | 'print'
  const [reprintReason, setReprintReason] = useState('');

  const syncDraftFromRequest = useCallback((doc) => {
    setDraftText({
      fa: doc?.finalText?.fa || '',
      ps: doc?.finalText?.ps || '',
      en: doc?.finalText?.en || '',
    });
    if (doc?.gender) {
      setSampleGender(doc.gender);
    }
  }, []);

  const loadAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError('');
      try {
        const [reqRes, tplRes] = await Promise.all([
          apiFetch(`/requests/${encodeURIComponent(id)}`),
          apiFetch('/templates'),
        ]);
        const loadedReq = reqRes.data?.request || null;
        setReqDoc(loadedReq);
        setPrintLogs(reqRes.data?.printLogs || []);
        setTemplates(tplRes.data?.templates || []);
        if (loadedReq && !silent) {
          syncDraftFromRequest(loadedReq);
        }
      } catch (err) {
        setError(err.message || 'خطا در بارگذاری جزئیات درخواست.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, syncDraftFromRequest]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const currentTemplateId =
    (typeof reqDoc?.templateId === 'object' ? reqDoc?.templateId?._id : reqDoc?.templateId) ||
    templates.find((t) => t.isDefault)?._id ||
    templates[0]?._id ||
    '';

  const currentTemplateKey = useMemo(() => {
    if (typeof reqDoc?.templateId === 'object' && reqDoc.templateId?.key) {
      return reqDoc.templateId.key;
    }
    const found = templates.find((t) => t._id === currentTemplateId);
    return found?.key || 'official';
  }, [reqDoc, templates, currentTemplateId]);

  // Fetch base HTML certificate for this request whenever entering editor tab or switching request status/serial
  const loadRequestPreview = useCallback(
    async (templateOverride = '') => {
      if (!reqDoc || reqDoc.status === 'rejected') return;
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const res = await fetchRequestPreviewHtml(reqDoc._id, {
          template: templateOverride || currentTemplateKey,
          chromeless: true,
        });
        setPreviewHtml(res.html);
        if (res.warning) setFitWarning(res.warning);
      } catch (err) {
        setPreviewError(err.message || 'خطا در بارگذاری پیش‌نمایش تصدیق‌نامه.');
      } finally {
        setPreviewLoading(false);
      }
    },
    [reqDoc, currentTemplateKey]
  );

  useEffect(() => {
    if (activeTab === 'editor' && reqDoc && reqDoc.status !== 'rejected') {
      loadRequestPreview();
    }
  }, [activeTab, reqDoc?._id, reqDoc?.status, reqDoc?.serial, loadRequestPreview]);

  // Check if officer modified any of the 3 text areas compared to saved DB text
  const isTextDirty = useMemo(() => {
    if (!reqDoc) return false;
    return (
      draftText.fa !== (reqDoc.finalText?.fa || '') ||
      draftText.ps !== (reqDoc.finalText?.ps || '') ||
      draftText.en !== (reqDoc.finalText?.en || '')
    );
  }, [draftText, reqDoc]);

  const hasLiveText = Boolean(
    draftText.fa.trim() || draftText.ps.trim() || draftText.en.trim()
  );

  const handleFitChange = useCallback(({ warning }) => {
    setFitWarning(warning || '');
  }, []);

  // Open Approve dialog pre-populated with current applicant names & default template
  const openApproveDialog = () => {
    setApproveError('');
    setApproveForm({
      templateId: currentTemplateId,
      officialNo: reqDoc?.officialNo || '',
      firstNameFa: reqDoc?.firstNameI18n?.fa || reqDoc?.firstName || '',
      firstNamePs: reqDoc?.firstNameI18n?.ps || reqDoc?.firstName || '',
      firstNameEn: reqDoc?.firstNameI18n?.en || '',
      fatherNameFa: reqDoc?.fatherNameI18n?.fa || reqDoc?.fatherName || '',
      fatherNamePs: reqDoc?.fatherNameI18n?.ps || reqDoc?.fatherName || '',
      fatherNameEn: reqDoc?.fatherNameI18n?.en || '',
    });
    setApproveOpen(true);
  };

  const handleApproveSubmit = async (e) => {
    e.preventDefault();
    setApproveError('');
    setApproving(true);
    try {
      const body = {
        firstNameI18n: {
          fa: approveForm.firstNameFa.trim(),
          ps: approveForm.firstNamePs.trim(),
          en: approveForm.firstNameEn.trim(),
        },
        fatherNameI18n: {
          fa: approveForm.fatherNameFa.trim(),
          ps: approveForm.fatherNamePs.trim(),
          en: approveForm.fatherNameEn.trim(),
        },
      };
      if (approveForm.templateId) body.templateId = approveForm.templateId;
      if (approveForm.officialNo.trim()) body.officialNo = approveForm.officialNo.trim();

      const res = await apiFetch(`/requests/${encodeURIComponent(id)}/approve`, {
        method: 'PATCH',
        body,
      });

      const updated = res.data?.request;
      setReqDoc(updated);
      syncDraftFromRequest(updated);
      setApproveOpen(false);
      toast.success(`درخواست تأیید شد. شماره سریال صادرشده: ${updated?.serial}`);
      setTab('editor');
    } catch (err) {
      setApproveError(err.message || 'خطا در تأیید درخواست.');
    } finally {
      setApproving(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    setRejectError('');
    if (rejectReason.trim().length < 3) {
      setRejectError('لطفاً دلیل رد درخواست را (حداقل ۳ حرف) به دری بنویسید.');
      return;
    }
    setRejecting(true);
    try {
      const res = await apiFetch(`/requests/${encodeURIComponent(id)}/reject`, {
        method: 'PATCH',
        body: { reason: rejectReason.trim() },
      });
      setReqDoc(res.data?.request);
      setRejectOpen(false);
      setRejectReason('');
      toast.info('درخواست با ذکر دلیل رد گردید.');
    } catch (err) {
      setRejectError(err.message || 'خطا در رد درخواست.');
    } finally {
      setRejecting(false);
    }
  };

  // Assign a template from the Template Picker or editor dropdown
  const handleSelectTemplate = async (template, { forceRegen = false } = {}) => {
    if (!template || !reqDoc) return;
    setApplyingTemplateId(template._id);
    try {
      const shouldRegen = forceRegen || regenOnTemplateChange;
      const res = await apiFetch(`/requests/${encodeURIComponent(reqDoc._id)}/template`, {
        method: 'PATCH',
        body: {
          templateId: template._id,
          regenerateText: shouldRegen,
        },
      });
      const updated = res.data?.request;
      setReqDoc(updated);
      if (shouldRegen || !hasLiveText) {
        syncDraftFromRequest(updated);
      }
      toast.success(`قالب «${template.labels?.fa || template.name}» انتخاب گردید.`);
    } catch (err) {
      toast.error(err.message || 'خطا در تغییر قالب.');
    } finally {
      setApplyingTemplateId('');
    }
  };

  // Save edited trilingual finalText (fa, ps, en)
  const saveFinalText = async ({ silentToast = false } = {}) => {
    if (!draftText.fa.trim() || !draftText.ps.trim() || !draftText.en.trim()) {
      toast.error('متن هر سه زبان (دری، پشتو و انگلیسی) باید تکمیل باشد.');
      return false;
    }

    setSavingText(true);
    try {
      const res = await apiFetch(`/requests/${encodeURIComponent(reqDoc._id)}/final-text`, {
        method: 'PATCH',
        body: {
          finalText: {
            fa: draftText.fa.trim(),
            ps: draftText.ps.trim(),
            en: draftText.en.trim(),
          },
        },
      });
      const updated = res.data?.request;
      setReqDoc(updated);
      syncDraftFromRequest(updated);
      if (!silentToast) {
        toast.success('تغییرات متن سه‌زبانه تصدیق‌نامه ذخیره گردید.');
      }
      return true;
    } catch (err) {
      toast.error(err.message || 'خطا در ذخیره متن تصدیق‌نامه.');
      return false;
    } finally {
      setSavingText(false);
    }
  };

  // Reset finalText back to gender-aware template defaults
  const handleResetToDefaultText = async () => {
    setResettingText(true);
    try {
      const res = await apiFetch(
        `/requests/${encodeURIComponent(reqDoc._id)}/regenerate-text`,
        { method: 'POST' }
      );
      const updated = res.data?.request;
      setReqDoc(updated);
      syncDraftFromRequest(updated);
      setConfirmResetOpen(false);
      toast.success('متن تصدیق‌نامه به حالت پیش‌فرض سه‌زبانه بازگردانده شد.');
    } catch (err) {
      toast.error(err.message || 'خطا در بازگردانی متن پیش‌فرض.');
    } finally {
      setResettingText(false);
    }
  };

  // Execute PDF download or direct Print (both log to `printLogs`)
  const executePdfOrPrint = async (mode, reason = '') => {
    if (!reqDoc) return;

    // Auto-save unsaved edits before rendering official PDF
    if (isTextDirty) {
      const saved = await saveFinalText({ silentToast: true });
      if (!saved) return;
    }

    setPdfBusyMode(mode);
    try {
      const result = await generateCertificatePdfBlob(reqDoc._id, {
        templateId: currentTemplateId || undefined,
        reprintReason: reason.trim(),
      });

      if (mode === 'download') {
        triggerBlobDownload(result.blob, result.filename);
        toast.success(
          result.isReprint
            ? `فایل PDF (چاپ مجدد) آماده دانلود شد و در گزارش چاپ ثبت گردید.`
            : `فایل PDF تصدیق‌نامه (${result.serial}) دانلود و در گزارش چاپ ثبت گردید.`
        );
      } else {
        openPdfForPrint(result.blob);
        toast.success('تصدیق‌نامه برای چاپ ارسال و در تاریخچه چاپ ثبت گردید.');
      }

      if (result.warning) {
        toast.warning(result.warning);
      }

      setReprintModalMode('');
      setReprintReason('');
      await loadAll({ silent: true });
    } catch (err) {
      toast.error(err.message || 'خطا در تولید و چاپ فایل PDF.');
    } finally {
      setPdfBusyMode('');
    }
  };

  const requestPdfAction = (mode) => {
    if (!reqDoc) return;
    if (!['approved', 'printed'].includes(reqDoc.status)) {
      toast.warning('ابتدا درخواست را تأیید نمایید تا شماره سریال صادر و امکان چاپ فعال گردد.');
      return;
    }
    if (reqDoc.status === 'printed') {
      setReprintReason('');
      setReprintModalMode(mode);
      return;
    }
    executePdfOrPrint(mode, '');
  };

  if (loading) {
    return (
      <div className="page-loader">
        <div className="spinner" />
        <span>در حال بارگذاری اطلاعات درخواست...</span>
      </div>
    );
  }

  if (error || !reqDoc) {
    return (
      <div className="container section-gap">
        <div className="alert alert-error">{error || 'درخواست مورد نظر یافت نشد.'}</div>
        <Link to="/officer/requests" className="btn btn-secondary mt-3">
          بازگشت به فهرست درخواست‌ها
        </Link>
      </div>
    );
  }

  const canIssuePdf = reqDoc.status === 'approved' || reqDoc.status === 'printed';
  const isRejected = reqDoc.status === 'rejected';
  const isPending = reqDoc.status === 'pending';

  return (
    <div className="container section-gap">
      {/* Breadcrumb & Top Bar */}
      <div className="breadcrumb-row">
        <Link to="/officer/requests" className="back-link">
          → بازگشت به فهرست درخواست‌ها
        </Link>
        {reqDoc.serial && (
          <Link
            to={`/verify/${encodeURIComponent(reqDoc.serial)}`}
            className="back-link"
          >
            <IconShield size={15} />
            <span>صفحه تأیید عمومی ({reqDoc.serial})</span>
          </Link>
        )}
      </div>

      {/* Header Summary Card */}
      <section className="card detail-hero-card">
        <div className="detail-hero-main">
          <div>
            <div className="detail-hero-badges">
              <StatusBadge status={reqDoc.status} size="lg" />
              <code className="code-pill" dir="ltr" title="کود پیگیری">
                {reqDoc.trackingCode}
              </code>
              {reqDoc.serial && (
                <code className="code-pill code-pill-navy" dir="ltr" title="شماره سریال تصدیق‌نامه">
                  {reqDoc.serial}
                </code>
              )}
              {reqDoc.officialNo && (
                <span className="tag tag-slate" title="نمبر ثبت رسمی">
                  د ثبت ګڼه: <bdo dir="ltr">{reqDoc.officialNo}</bdo>
                </span>
              )}
            </div>
            <h1 className="detail-hero-name">
              {reqDoc.firstName}{' '}
              <span className="detail-hero-father">فرزند {reqDoc.fatherName}</span>
            </h1>
            <p className="detail-hero-meta">
              {reqDoc.facultyId?.name?.fa} — دیپارتمنت {reqDoc.departmentId?.name?.fa} | مقطع{' '}
              {DEGREE_LABELS[reqDoc.degreeLevel] || reqDoc.degreeLevel} | سال فراغت{' '}
              {reqDoc.gradYearSH} هـ.ش ({reqDoc.gradYearAD} م)
            </p>
          </div>

          <div className="detail-hero-actions">
            {isPending && (
              <>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={openApproveDialog}
                >
                  <IconCheck size={18} />
                  <span>تأیید درخواست و صدور سریال</span>
                </button>
                <button
                  type="button"
                  className="btn btn-danger-outline"
                  onClick={() => {
                    setRejectError('');
                    setRejectReason('');
                    setRejectOpen(true);
                  }}
                >
                  <IconXCircle size={18} />
                  <span>رد درخواست</span>
                </button>
              </>
            )}

            {canIssuePdf && (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={Boolean(pdfBusyMode)}
                  onClick={() => requestPdfAction('download')}
                >
                  <IconDownload size={18} />
                  <span>
                    {pdfBusyMode === 'download'
                      ? 'در حال تولید PDF...'
                      : reqDoc.status === 'printed'
                        ? 'تولید مجدد PDF'
                        : 'تولید و دانلود PDF'}
                  </span>
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  disabled={Boolean(pdfBusyMode)}
                  onClick={() => requestPdfAction('print')}
                >
                  <IconPrinter size={18} />
                  <span>
                    {pdfBusyMode === 'print' ? 'در حال آماده‌سازی چاپ...' : 'چاپ تصدیق‌نامه'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Workspace Sub-Navigation Tabs */}
        {!isRejected && (
          <div className="workspace-tabs" role="tablist" aria-label="بخش‌های مدیریت درخواست">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'details'}
              className={`workspace-tab${activeTab === 'details' ? ' active' : ''}`}
              onClick={() => setTab('details')}
            >
              <IconFileText size={17} />
              <span>جزئیات درخواست و سوابق چاپ ({toDariDigits(printLogs.length)})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'templates'}
              className={`workspace-tab${activeTab === 'templates' ? ' active' : ''}`}
              onClick={() => setTab('templates')}
            >
              <IconGrid size={17} />
              <span>انتخاب قالب تصدیق‌نامه ({toDariDigits(templates.length)} قالب)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'editor'}
              className={`workspace-tab${activeTab === 'editor' ? ' active' : ''}`}
              onClick={() => setTab('editor')}
            >
              <IconEdit size={17} />
              <span>ویرایش متن سه‌زبانه و پیش‌نمایش زنده</span>
              {isTextDirty && <span className="dirty-dot" title="تغییرات ذخیره‌نشده" />}
            </button>
          </div>
        )}
      </section>

      {/* =================================================================
          TAB 1: Request Details & Print Audit Logs
         ================================================================= */}
      {(activeTab === 'details' || isRejected) && (
        <>
          {isRejected && (
            <div className="reject-reason-box mt-4" role="alert">
              <div className="reject-reason-title">
                <IconAlert size={18} />
                <strong>این درخواست رد گردیده است — دلیل رد:</strong>
              </div>
              <p>{reqDoc.rejectReason || '—'}</p>
            </div>
          )}

          <section className="card mt-4">
            <h2 className="section-title">مشخصات کامل متقاضی و دوره تحصیلی</h2>
            <dl className="detail-grid detail-grid-3 mt-3">
              <div>
                <dt>نام (دری)</dt>
                <dd>{reqDoc.firstNameI18n?.fa || reqDoc.firstName}</dd>
              </div>
              <div>
                <dt>نام (پشتو)</dt>
                <dd className="font-pashto">{reqDoc.firstNameI18n?.ps || '—'}</dd>
              </div>
              <div>
                <dt>نام (انگلیسی)</dt>
                <dd dir="ltr" className="text-left">
                  {reqDoc.firstNameI18n?.en || '—'}
                </dd>
              </div>

              <div>
                <dt>نام پدر (دری)</dt>
                <dd>{reqDoc.fatherNameI18n?.fa || reqDoc.fatherName}</dd>
              </div>
              <div>
                <dt>نام پدر (پشتو)</dt>
                <dd className="font-pashto">{reqDoc.fatherNameI18n?.ps || '—'}</dd>
              </div>
              <div>
                <dt>نام پدر (انگلیسی)</dt>
                <dd dir="ltr" className="text-left">
                  {reqDoc.fatherNameI18n?.en || '—'}
                </dd>
              </div>

              <div>
                <dt>جنسیت</dt>
                <dd>{GENDER_LABELS[reqDoc.gender] || reqDoc.gender}</dd>
              </div>
              <div>
                <dt>نمبر تذکره</dt>
                <dd>
                  <code className="code-pill" dir="ltr">
                    {reqDoc.nationalId}
                  </code>
                </dd>
              </div>
              <div>
                <dt>شماره تماس</dt>
                <dd dir="ltr" className="text-left">
                  {reqDoc.phone}
                </dd>
              </div>

              <div>
                <dt>ایمیل</dt>
                <dd dir="ltr" className="text-left">
                  {reqDoc.email || '—'}
                </dd>
              </div>
              <div>
                <dt>پوهنځی (دری / پشتو / انگلیسی)</dt>
                <dd>
                  <div>{reqDoc.facultyId?.name?.fa || '—'}</div>
                  <div className="cell-sub font-pashto">{reqDoc.facultyId?.name?.ps}</div>
                  <div className="cell-sub" dir="ltr">
                    {reqDoc.facultyId?.name?.en}
                  </div>
                </dd>
              </div>
              <div>
                <dt>دیپارتمنت (دری / پشتو / انگلیسی)</dt>
                <dd>
                  <div>{reqDoc.departmentId?.name?.fa || '—'}</div>
                  <div className="cell-sub font-pashto">{reqDoc.departmentId?.name?.ps}</div>
                  <div className="cell-sub" dir="ltr">
                    {reqDoc.departmentId?.name?.en}
                  </div>
                </dd>
              </div>

              <div>
                <dt>مقطع تحصیلی</dt>
                <dd>{DEGREE_LABELS[reqDoc.degreeLevel] || reqDoc.degreeLevel}</dd>
              </div>
              <div>
                <dt>سال فراغت</dt>
                <dd>
                  {reqDoc.gradYearSH} هجری شمسی ({reqDoc.gradYearAD} میلادی)
                </dd>
              </div>
              <div>
                <dt>قالب انتخاب‌شده</dt>
                <dd>
                  {reqDoc.templateId?.name || 'پیش‌فرض سیستم'}{' '}
                  {reqDoc.templateId?.key && (
                    <code className="code-pill" dir="ltr">
                      theme-{reqDoc.templateId.key}
                    </code>
                  )}
                </dd>
              </div>

              <div>
                <dt>زمان ثبت درخواست</dt>
                <dd>{formatDateTime(reqDoc.createdAt)}</dd>
              </div>
              <div>
                <dt>تأییدکننده و زمان تأیید</dt>
                <dd>
                  {reqDoc.approvedAt
                    ? `${reqDoc.approvedBy?.name || '—'} — ${formatDateTime(reqDoc.approvedAt)}`
                    : 'هنوز تأیید نشده'}
                </dd>
              </div>
              <div>
                <dt>آخرین زمان چاپ</dt>
                <dd>{formatDateTime(reqDoc.printedAt)}</dd>
              </div>
            </dl>

            {reqDoc.notes && (
              <div className="notes-box mt-3">
                <strong>یادداشت متقاضی:</strong>
                <p>{reqDoc.notes}</p>
              </div>
            )}
          </section>

          {/* Print Audit Logs Table */}
          <section className="card mt-4">
            <h2 className="section-title">
              تاریخچه چاپ تصدیق‌نامه ({toDariDigits(printLogs.length)} بار)
            </h2>
            {printLogs.length === 0 ? (
              <p className="text-muted mt-2">
                تا هنوز هیچ چاپی برای این درخواست ثبت نشده است.
              </p>
            ) : (
              <div className="table-responsive mt-3">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>زمان چاپ</th>
                      <th>کاربر چاپ‌کننده</th>
                      <th>قالب استفاده‌شده</th>
                      <th>نوع چاپ</th>
                      <th>دلیل چاپ مجدد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printLogs.map((log) => (
                      <tr key={log._id}>
                        <td>{formatDateTime(log.printedAt)}</td>
                        <td>{log.printedBy?.name || log.printedBy?.username || '—'}</td>
                        <td>
                          {log.templateId?.name || log.templateKey || '—'}{' '}
                          {log.templateKey && (
                            <code className="code-pill" dir="ltr">
                              {log.templateKey}
                            </code>
                          )}
                        </td>
                        <td>
                          {log.isReprint ? (
                            <span className="tag tag-amber">چاپ مجدد</span>
                          ) : (
                            <span className="tag tag-green">چاپ اول</span>
                          )}
                        </td>
                        <td>{log.reprintReason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* =================================================================
          TAB 2: Template Picker (Grid of Small Live Sample Previews)
         ================================================================= */}
      {activeTab === 'templates' && !isRejected && (
        <section className="mt-4">
          <div className="card picker-toolbar">
            <div>
              <h2 className="section-title">انتخاب قالب تصدیق‌نامه (پیش‌نمایش زنده نمونه)</h2>
              <p className="text-muted text-sm">
                هر کارت پیش‌نمایش زنده واقعی قالب را با اطلاعات نمونه نمایش می‌دهد. قالب مورد نظر را
                برای این درخواست انتخاب نمایید.
              </p>
            </div>

            <div className="picker-controls">
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={regenOnTemplateChange}
                  onChange={(e) => setRegenOnTemplateChange(e.target.checked)}
                />
                <span>بازسازی متن پیش‌فرض مطابق قالب جدید</span>
              </label>

              <div className="segmented-control" role="group" aria-label="جنسیت نمونه">
                <button
                  type="button"
                  className={`seg-btn${sampleGender === 'male' ? ' active' : ''}`}
                  onClick={() => setSampleGender('male')}
                >
                  نمونه ذکور
                </button>
                <button
                  type="button"
                  className={`seg-btn${sampleGender === 'female' ? ' active' : ''}`}
                  onClick={() => setSampleGender('female')}
                >
                  نمونه اناث
                </button>
              </div>
            </div>
          </div>

          <div className="template-grid mt-4">
            {templates.map((tpl) => (
              <TemplateSampleCard
                key={tpl._id}
                template={tpl}
                gender={sampleGender}
                selected={tpl._id === currentTemplateId}
                selecting={applyingTemplateId === tpl._id}
                onSelect={(selectedTpl) => handleSelectTemplate(selectedTpl)}
                onInspect={(inspectedTpl, html) =>
                  setInspectedSample({ template: inspectedTpl, html })
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* =================================================================
          TAB 3: Trilingual Text Editor + Live Certificate Preview + Print
         ================================================================= */}
      {activeTab === 'editor' && !isRejected && (
        <section className="editor-workspace mt-4">
          {isPending && (
            <div className="alert alert-warning">
              <IconAlert size={18} />
              <div>
                <strong>این درخواست هنوز در حالت «در انتظار بررسی» است.</strong> پیش‌نمایش فعلی به
                صورت پیش‌نویس نمایش داده می‌شود. جهت صدور شماره سریال، تولید PDF و چاپ رسمی روی دکمه{' '}
                <button type="button" className="link-btn" onClick={openApproveDialog}>
                  «تأیید درخواست و صدور سریال»
                </button>{' '}
                کلیک نمایید.
              </div>
            </div>
          )}

          {/* Top Action & Theme Toolbar */}
          <div className="card editor-toolbar">
            <div className="editor-theme-select">
              <label htmlFor="live-theme-select" className="form-label-inline">
                قالب تصدیق‌نامه:
              </label>
              <select
                id="live-theme-select"
                className="form-select form-select-sm"
                value={currentTemplateId}
                disabled={Boolean(applyingTemplateId)}
                onChange={(e) => {
                  const chosen = templates.find((t) => t._id === e.target.value);
                  if (chosen) handleSelectTemplate(chosen);
                }}
              >
                {templates.map((tpl) => (
                  <option key={tpl._id} value={tpl._id}>
                    {tpl.labels?.fa || tpl.name} (theme-{tpl.key})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setTab('templates')}
              >
                <IconGrid size={16} />
                <span>مشاهده همه قالب‌ها</span>
              </button>
            </div>

            <div className="editor-action-btns">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={resettingText || savingText}
                onClick={() => setConfirmResetOpen(true)}
              >
                <IconRefresh size={16} />
                <span>بازگردانی به متن پیش‌فرض</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={savingText || (!isTextDirty && hasLiveText)}
                onClick={() => saveFinalText()}
              >
                <IconCheck size={16} />
                <span>
                  {savingText
                    ? 'در حال ذخیره...'
                    : isTextDirty
                      ? 'ذخیره تغییرات متن *'
                      : 'متن ذخیره شده'}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={!canIssuePdf || Boolean(pdfBusyMode)}
                onClick={() => requestPdfAction('download')}
              >
                <IconDownload size={16} />
                <span>
                  {pdfBusyMode === 'download' ? 'در حال تولید...' : 'تولید PDF'}
                </span>
              </button>

              <button
                type="button"
                className="btn btn-gold btn-sm"
                disabled={!canIssuePdf || Boolean(pdfBusyMode)}
                onClick={() => requestPdfAction('print')}
              >
                <IconPrinter size={16} />
                <span>{pdfBusyMode === 'print' ? 'آماده‌سازی...' : 'چاپ'}</span>
              </button>
            </div>
          </div>

          {/* Live Length / Auto-Shrink Warning */}
          {fitWarning && (
            <div className="alert alert-warning mt-3" role="status">
              <IconAlert size={18} />
              <span>{fitWarning}</span>
            </div>
          )}

          {/* Live A4 Landscape Certificate Preview */}
          <div className="card live-preview-card mt-4">
            <div className="live-preview-header">
              <div>
                <h2 className="section-title">پیش‌نمایش زنده تصدیق‌نامه (A4 افقی — یک صفحه)</h2>
                <span className="text-muted text-sm">
                  با ویرایش هر یک از متن‌های دری، پشتو یا انگلیسی در پایین، پیش‌نمایش به‌صورت آنی
                  به‌روزرسانی می‌شود.
                </span>
              </div>
              <div className="live-preview-tools">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadRequestPreview()}
                  title="بازخوانی از سرور"
                >
                  <IconRefresh size={15} />
                  <span>بازخوانی</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFullscreenPreview(true)}
                  disabled={!previewHtml}
                >
                  <IconExpand size={15} />
                  <span>بزرگ‌نمایی کامل</span>
                </button>
              </div>
            </div>

            <div className="live-preview-stage">
              <CertificatePreview
                html={previewHtml}
                loading={previewLoading}
                error={previewError}
                liveText={hasLiveText ? draftText : null}
                liveThemeKey={currentTemplateKey}
                onFitChange={handleFitChange}
                title={`پیش‌نمایش زنده تصدیق‌نامه ${reqDoc.firstName}`}
              />
            </div>
          </div>

          {/* Three Editable Text Areas: Dari (fa), Pashto (ps), English (en) */}
          <div className="card mt-4">
            <div className="card-header-flex">
              <div>
                <h2 className="section-title">ویرایش متن سه‌زبانه تصدیق‌نامه</h2>
                <p className="text-muted text-sm">
                  ترتیب ستون‌ها در تصدیق‌نامه چاپی: چپ انگلیسی (LTR) · وسط دری (RTL) · راست پشتو
                  (RTL)
                </p>
              </div>
              {!hasLiveText && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={resettingText}
                  onClick={handleResetToDefaultText}
                >
                  <IconRefresh size={15} />
                  <span>تولید متن پیش‌فرض برای ویرایش</span>
                </button>
              )}
            </div>

            <div className="trilingual-editor-grid mt-3">
              {/* Pashto Column (Right column on certificate) */}
              <div className="editor-lang-box">
                <div className="editor-lang-header">
                  <label htmlFor="edit-ps" className="form-label">
                    متن پشتو — تاییدلیک (ستون راست · RTL)
                  </label>
                  <span className="char-counter">{toDariDigits(draftText.ps.length)} حرف</span>
                </div>
                <textarea
                  id="edit-ps"
                  dir="rtl"
                  lang="ps"
                  rows={9}
                  className="form-textarea editor-textarea font-pashto"
                  placeholder="د تصدیق‌پاڼې پښتو متن..."
                  value={draftText.ps}
                  onChange={(e) => setDraftText((p) => ({ ...p, ps: e.target.value }))}
                />
              </div>

              {/* Dari Column (Middle column on certificate) */}
              <div className="editor-lang-box">
                <div className="editor-lang-header">
                  <label htmlFor="edit-fa" className="form-label">
                    متن دری — تصدیق‌نامه (ستون وسط · RTL)
                  </label>
                  <span className="char-counter">{toDariDigits(draftText.fa.length)} حرف</span>
                </div>
                <textarea
                  id="edit-fa"
                  dir="rtl"
                  lang="fa"
                  rows={9}
                  className="form-textarea editor-textarea"
                  placeholder="متن دری تصدیق‌نامه..."
                  value={draftText.fa}
                  onChange={(e) => setDraftText((p) => ({ ...p, fa: e.target.value }))}
                />
              </div>

              {/* English Column (Left column on certificate) */}
              <div className="editor-lang-box">
                <div className="editor-lang-header">
                  <label htmlFor="edit-en" className="form-label">
                    متن انگلیسی — Completion Certificate (ستون چپ · LTR)
                  </label>
                  <span className="char-counter">{toDariDigits(draftText.en.length)} حرف</span>
                </div>
                <textarea
                  id="edit-en"
                  dir="ltr"
                  lang="en"
                  rows={9}
                  className="form-textarea editor-textarea ltr-input font-english"
                  placeholder="English certificate body text..."
                  value={draftText.en}
                  onChange={(e) => setDraftText((p) => ({ ...p, en: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-actions-between mt-4">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={resettingText}
                onClick={() => setConfirmResetOpen(true)}
              >
                <IconRefresh size={17} />
                <span>بازگردانی به متن پیش‌فرض</span>
              </button>

              <div className="action-row-inline">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={savingText || !isTextDirty}
                  onClick={() => saveFinalText()}
                >
                  <IconCheck size={17} />
                  <span>{savingText ? 'در حال ذخیره...' : 'ذخیره تغییرات متن'}</span>
                </button>
                {canIssuePdf && (
                  <>
                    <button
                      type="button"
                      className="btn btn-success"
                      disabled={Boolean(pdfBusyMode)}
                      onClick={() => requestPdfAction('download')}
                    >
                      <IconDownload size={17} />
                      <span>تولید و دانلود PDF</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-gold"
                      disabled={Boolean(pdfBusyMode)}
                      onClick={() => requestPdfAction('print')}
                    >
                      <IconPrinter size={17} />
                      <span>چاپ تصدیق‌نامه</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =================================================================
          MODALS: Approve | Reject | Reset Default | Reprint | Zoom
         ================================================================= */}

      {/* Approve Request Modal */}
      <Modal
        open={approveOpen}
        title="تأیید درخواست و صدور شماره سریال رسمی"
        onClose={() => !approving && setApproveOpen(false)}
        size="lg"
      >
        <form onSubmit={handleApproveSubmit} className="form-stack" noValidate>
          {approveError && <div className="alert alert-error">{approveError}</div>}

          <p className="text-muted text-sm">
            با تأیید این درخواست، شماره سریال یکتا (<code dir="ltr">KU-YYYY-XXXXXX</code>)، نمبر ثبت
            رسمی و متن سه‌زبانه متناسب با جنسیت ({GENDER_LABELS[reqDoc.gender]}) به صورت خودکار تولید
            می‌گردد. در صورت نیاز املای انگلیسی و پشتوی نام را تکمیل یا اصلاح نمایید:
          </p>

          <div className="form-grid-2">
            <div className="form-group">
              <label htmlFor="apr-tpl" className="form-label">
                قالب اولیه تصدیق‌نامه
              </label>
              <select
                id="apr-tpl"
                className="form-select"
                value={approveForm.templateId}
                onChange={(e) => setApproveForm((p) => ({ ...p, templateId: e.target.value }))}
              >
                {templates.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.labels?.fa || t.name} ({t.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="apr-offno" className="form-label">
                نمبر ثبت رسمی — د ثبت ګڼه (اختیاری؛ خالی = خودکار)
              </label>
              <input
                id="apr-offno"
                type="text"
                dir="ltr"
                className="form-input ltr-input"
                placeholder={`مثال: ${reqDoc.gradYearSH}/${reqDoc.facultyId?.code || 'KU'}/0125`}
                value={approveForm.officialNo}
                onChange={(e) => setApproveForm((p) => ({ ...p, officialNo: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="apr-fn-en" className="form-label">
                نام به انگلیسی
              </label>
              <input
                id="apr-fn-en"
                type="text"
                dir="ltr"
                className="form-input ltr-input"
                placeholder="Graduate Name in English"
                value={approveForm.firstNameEn}
                onChange={(e) => setApproveForm((p) => ({ ...p, firstNameEn: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="apr-fat-en" className="form-label">
                نام پدر به انگلیسی
              </label>
              <input
                id="apr-fat-en"
                type="text"
                dir="ltr"
                className="form-input ltr-input"
                placeholder="Father's Name in English"
                value={approveForm.fatherNameEn}
                onChange={(e) => setApproveForm((p) => ({ ...p, fatherNameEn: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="apr-fn-ps" className="form-label">
                نام به پشتو
              </label>
              <input
                id="apr-fn-ps"
                type="text"
                dir="rtl"
                className="form-input font-pashto"
                value={approveForm.firstNamePs}
                onChange={(e) => setApproveForm((p) => ({ ...p, firstNamePs: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label htmlFor="apr-fat-ps" className="form-label">
                نام پدر به پشتو
              </label>
              <input
                id="apr-fat-ps"
                type="text"
                dir="rtl"
                className="form-input font-pashto"
                value={approveForm.fatherNamePs}
                onChange={(e) => setApproveForm((p) => ({ ...p, fatherNamePs: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={approving}
              onClick={() => setApproveOpen(false)}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-success" disabled={approving}>
              <IconCheck size={17} />
              <span>{approving ? 'در حال تأیید...' : 'تأیید نهایی و صدور سریال'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Reject Request Modal */}
      <Modal
        open={rejectOpen}
        title="رد درخواست تصدیق‌نامه"
        onClose={() => !rejecting && setRejectOpen(false)}
        size="sm"
      >
        <form onSubmit={handleRejectSubmit} className="form-stack" noValidate>
          {rejectError && <div className="alert alert-error">{rejectError}</div>}
          <p className="text-muted text-sm">
            دلیل رد درخواست برای متقاضی در صفحه پیگیری نمایش داده خواهد شد.
          </p>
          <div className="form-group">
            <label htmlFor="rej-reason" className="form-label">
              دلیل رد درخواست <span className="req">*</span>
            </label>
            <textarea
              id="rej-reason"
              rows={4}
              className="form-textarea"
              placeholder="مثال: عدم مطابقت نمبر تذکره با دفتر ثبت فارغان پوهنځی..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={rejecting}
              onClick={() => setRejectOpen(false)}
            >
              انصراف
            </button>
            <button type="submit" className="btn btn-danger" disabled={rejecting}>
              {rejecting ? 'در حال ثبت...' : 'ثبت رد درخواست'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Reset to Default Text Modal */}
      <Modal
        open={confirmResetOpen}
        title="بازگردانی به متن پیش‌فرض"
        onClose={() => !resettingText && setConfirmResetOpen(false)}
        size="sm"
      >
        <p className="text-muted">
          آیا مطمئن هستید که می‌خواهید متن هر سه زبان (دری، پشتو و انگلیسی) به متن پیش‌فرض قالب فعلی
          بازگردانده شود؟ ویرایش‌های دستی قبلی جایگزین خواهند شد.
        </p>
        <div className="form-actions-end mt-4">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={resettingText}
            onClick={() => setConfirmResetOpen(false)}
          >
            انصراف
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={resettingText}
            onClick={handleResetToDefaultText}
          >
            <IconRefresh size={16} />
            <span>{resettingText ? 'در حال بازسازی...' : 'بله، بازگردانی شود'}</span>
          </button>
        </div>
      </Modal>

      {/* Reprint Reason Modal */}
      <Modal
        open={Boolean(reprintModalMode)}
        title="چاپ مجدد تصدیق‌نامه (ثبت در تاریخچه چاپ)"
        onClose={() => !pdfBusyMode && setReprintModalMode('')}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executePdfOrPrint(reprintModalMode, reprintReason);
          }}
          className="form-stack"
        >
          <p className="text-muted text-sm">
            این تصدیق‌نامه قبلاً چاپ شده است. این عملیات به عنوان <strong>چاپ مجدد</strong> در گزارش
            چاپ (<code dir="ltr">printLogs</code>) ثبت می‌شود.
          </p>
          <div className="form-group">
            <label htmlFor="reprint-reason" className="form-label">
              دلیل چاپ مجدد (اختیاری)
            </label>
            <input
              id="reprint-reason"
              type="text"
              className="form-input"
              placeholder="مثال: تغییر قالب یا آسیب‌دیدگی کاغذ هنگام چاپ..."
              value={reprintReason}
              onChange={(e) => setReprintReason(e.target.value)}
            />
          </div>
          <div className="form-actions-end">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={Boolean(pdfBusyMode)}
              onClick={() => setReprintModalMode('')}
            >
              انصراف
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={Boolean(pdfBusyMode)}
            >
              {pdfBusyMode
                ? 'در حال تولید PDF...'
                : reprintModalMode === 'print'
                  ? 'تأیید و چاپ مجدد'
                  : 'تأیید و دانلود PDF'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Fullscreen Live Request Preview Modal */}
      <Modal
        open={fullscreenPreview}
        title={`پیش‌نمایش بزرگ تصدیق‌نامه — ${reqDoc.firstName} (${reqDoc.serial || 'پیش‌نویس'})`}
        onClose={() => setFullscreenPreview(false)}
        size="xl"
      >
        <div className="modal-cert-wrap">
          <CertificatePreview
            html={previewHtml}
            liveText={hasLiveText ? draftText : null}
            liveThemeKey={currentTemplateKey}
            title="پیش‌نمایش بزرگ تصدیق‌نامه"
          />
        </div>
      </Modal>

      {/* Fullscreen Sample Template Inspect Modal */}
      <Modal
        open={Boolean(inspectedSample)}
        title={
          inspectedSample
            ? `پیش‌نمایش نمونه قالب: ${inspectedSample.template.labels?.fa || inspectedSample.template.name}`
            : ''
        }
        onClose={() => setInspectedSample(null)}
        size="xl"
        footer={
          inspectedSample && (
            <div className="form-actions-end">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setInspectedSample(null)}
              >
                بستن
              </button>
              {inspectedSample.template._id !== currentTemplateId && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const tpl = inspectedSample.template;
                    setInspectedSample(null);
                    handleSelectTemplate(tpl);
                  }}
                >
                  <IconCheck size={16} />
                  <span>انتخاب این قالب برای درخواست</span>
                </button>
              )}
            </div>
          )
        }
      >
        {inspectedSample && (
          <div className="modal-cert-wrap">
            <CertificatePreview
              html={inspectedSample.html}
              title={inspectedSample.template.name}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

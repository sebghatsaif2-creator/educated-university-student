import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { DEGREE_LABELS, GENDER_LABELS, formatDateTime, toDariDigits } from '../utils/format';
import { IconRefresh } from '../components/Icons';

export default function AdminReportsPage() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [report, setReport] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logPage, setLogPage] = useState(1);
  const [logPagination, setLogPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [repRes, logRes] = await Promise.all([
        apiFetch('/stats/report', { query: { dateFrom, dateTo } }),
        apiFetch('/print-logs', { query: { dateFrom, dateTo, page: logPage, limit: 12 } }),
      ]);
      setReport(repRes.data || null);
      setLogs(logRes.data?.printLogs || []);
      if (logRes.pagination) setLogPagination(logRes.pagination);
    } catch (err) {
      setError(err.message || 'خطا در دریافت گزارش احصائیوی.');
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, logPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const st = report?.requests?.byStatus || {};

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">گزارش احصائیوی و دفتر ثبت چاپ تصدیق‌نامه‌ها</h1>
          <p className="page-subtitle">
            آمار کلی درخواست‌ها به تفکیک پوهنځی، جنسیت، مقطع تحصیلی و تاریخچه کامل چاپ‌ها
          </p>
        </div>

        <div className="action-row-inline">
          <input
            type="date"
            dir="ltr"
            className="form-input ltr-input form-input-sm"
            aria-label="از تاریخ"
            value={dateFrom}
            onChange={(e) => {
              setLogPage(1);
              setDateFrom(e.target.value);
            }}
          />
          <span className="text-muted">تا</span>
          <input
            type="date"
            dir="ltr"
            className="form-input ltr-input form-input-sm"
            aria-label="تا تاریخ"
            value={dateTo}
            onChange={(e) => {
              setLogPage(1);
              setDateTo(e.target.value);
            }}
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setLogPage(1);
              }}
            >
              پاک‌سازی
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={loadData}>
            <IconRefresh size={15} />
            <span>تازه‌سازی</span>
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {loading && !report ? (
        <div className="page-loader">
          <div className="spinner" />
          <span>در حال تهیه گزارش احصائیوی...</span>
        </div>
      ) : (
        report && (
          <>
            {/* Status + Print KPIs */}
            <div className="kpi-grid mt-4">
              <div className="kpi-card kpi-navy static">
                <span className="kpi-value">{toDariDigits(st.total ?? 0)}</span>
                <span className="kpi-label">مجموع درخواست‌ها</span>
              </div>
              <div className="kpi-card kpi-amber static">
                <span className="kpi-value">{toDariDigits(st.pending ?? 0)}</span>
                <span className="kpi-label">در انتظار بررسی</span>
              </div>
              <div className="kpi-card kpi-green static">
                <span className="kpi-value">{toDariDigits(st.approved ?? 0)}</span>
                <span className="kpi-label">تأیید شده</span>
              </div>
              <div className="kpi-card kpi-blue static">
                <span className="kpi-value">{toDariDigits(st.printed ?? 0)}</span>
                <span className="kpi-label">چاپ شده</span>
              </div>
              <div className="kpi-card kpi-gold static">
                <span className="kpi-value">{toDariDigits(report.prints?.total ?? 0)}</span>
                <span className="kpi-label">
                  کل دفعات چاپ ({toDariDigits(report.prints?.reprints ?? 0)} مجدد)
                </span>
              </div>
            </div>

            {/* Gender & Degree Breakdown */}
            <div className="form-grid-2 mt-4">
              <section className="card">
                <h2 className="section-title">تفکیک بر اساس جنسیت</h2>
                <div className="stat-bars mt-3">
                  {['male', 'female'].map((g) => {
                    const count = report.requests?.byGender?.[g] || 0;
                    const pct = st.total ? Math.round((count / st.total) * 100) : 0;
                    return (
                      <div key={g} className="stat-bar-row">
                        <div className="stat-bar-label">
                          <span>{GENDER_LABELS[g]}</span>
                          <strong>
                            {toDariDigits(count)} ({toDariDigits(pct)}٪)
                          </strong>
                        </div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="card">
                <h2 className="section-title">تفکیک بر اساس مقطع تحصیلی</h2>
                <div className="stat-bars mt-3">
                  {['bachelor', 'master', 'phd', 'associate'].map((deg) => {
                    const count = report.requests?.byDegreeLevel?.[deg] || 0;
                    const pct = st.total ? Math.round((count / st.total) * 100) : 0;
                    return (
                      <div key={deg} className="stat-bar-row">
                        <div className="stat-bar-label">
                          <span>{DEGREE_LABELS[deg]}</span>
                          <strong>{toDariDigits(count)}</strong>
                        </div>
                        <div className="stat-bar-track">
                          <div className="stat-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* By Faculty Table */}
            <section className="card table-card mt-4">
              <div className="table-card-header">
                <h2 className="section-title">آمار درخواست‌ها به تفکیک پوهنځی</h2>
              </div>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>پوهنځی</th>
                      <th>مجموع</th>
                      <th>در انتظار</th>
                      <th>تأیید شده</th>
                      <th>چاپ شده</th>
                      <th>رد شده</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.requests?.byFaculty || []).map((f) => (
                      <tr key={f.facultyId}>
                        <td className="cell-primary">
                          {f.name?.fa}{' '}
                          {f.code && (
                            <code className="code-pill" dir="ltr">
                              {f.code}
                            </code>
                          )}
                        </td>
                        <td>
                          <strong>{toDariDigits(f.total)}</strong>
                        </td>
                        <td>{toDariDigits(f.pending)}</td>
                        <td>{toDariDigits(f.approved)}</td>
                        <td>{toDariDigits(f.printed)}</td>
                        <td>{toDariDigits(f.rejected)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Full Print Logs Audit Table */}
            <section className="card table-card mt-4">
              <div className="table-card-header">
                <h2 className="section-title">
                  دفتر ثبت چاپ تصدیق‌نامه‌ها — printLogs ({toDariDigits(logPagination.total)} ثبت)
                </h2>
              </div>
              {logs.length === 0 ? (
                <div className="empty-state">
                  <p className="text-muted">هیچ سابقه چاپی در این بازه زمانی یافت نشد.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>شماره سریال</th>
                        <th>فارغ‌التحصیل</th>
                        <th>قالب</th>
                        <th>کاربر چاپ‌کننده</th>
                        <th>نوع</th>
                        <th>زمان چاپ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id}>
                          <td>
                            <code className="code-pill" dir="ltr">
                              {log.serial}
                            </code>
                          </td>
                          <td>
                            {log.requestId ? (
                              <Link
                                to={`/officer/requests/${log.requestId._id}`}
                                className="table-link"
                              >
                                {log.requestId.firstName} فرزند {log.requestId.fatherName}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {log.templateId?.name || log.templateKey}{' '}
                            <code className="code-pill" dir="ltr">
                              {log.templateKey}
                            </code>
                          </td>
                          <td>{log.printedBy?.name || '—'}</td>
                          <td>
                            {log.isReprint ? (
                              <span className="tag tag-amber" title={log.reprintReason || ''}>
                                چاپ مجدد
                              </span>
                            ) : (
                              <span className="tag tag-green">چاپ اول</span>
                            )}
                          </td>
                          <td className="cell-sub">{formatDateTime(log.printedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {logPagination.totalPages > 1 && (
                <div className="pagination-bar">
                  <span className="text-muted text-sm">
                    صفحه {toDariDigits(logPagination.page)} از{' '}
                    {toDariDigits(logPagination.totalPages)}
                  </span>
                  <div className="pagination-btns">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={logPage <= 1}
                      onClick={() => setLogPage((p) => p - 1)}
                    >
                      قبلی
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={logPage >= logPagination.totalPages}
                      onClick={() => setLogPage((p) => p + 1)}
                    >
                      بعدی
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}

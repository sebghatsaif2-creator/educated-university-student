import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { DEGREE_LABELS, formatDateTime, toDariDigits } from '../utils/format';
import { IconEye, IconRefresh, IconSearch } from '../components/Icons';

const KPI_CARDS = [
  { key: '', label: 'همه درخواست‌ها', field: 'total', tone: 'navy' },
  { key: 'pending', label: 'در انتظار بررسی', field: 'pending', tone: 'amber' },
  { key: 'approved', label: 'تأیید شده (آماده چاپ)', field: 'approved', tone: 'green' },
  { key: 'printed', label: 'چاپ شده', field: 'printed', tone: 'blue' },
  { key: 'rejected', label: 'رد شده', field: 'rejected', tone: 'red' },
];

export default function OfficerRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [summary, setSummary] = useState(null);
  const [faculties, setFaculties] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    faculty: searchParams.get('faculty') || '',
    department: searchParams.get('department') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    sort: searchParams.get('sort') || 'newest',
    search: searchParams.get('search') || '',
    page: Number(searchParams.get('page')) || 1,
  });

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load summary KPIs + faculties once
  const loadSummary = useCallback(() => {
    apiFetch('/stats/summary')
      .then((res) => setSummary(res.data?.requests || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSummary();
    apiFetch('/faculties', { auth: false })
      .then((res) => setFaculties(res.data?.faculties || []))
      .catch(() => {});
  }, [loadSummary]);

  // Dependent department options for selected faculty filter
  useEffect(() => {
    if (!filters.faculty) {
      setDepartments([]);
      return;
    }
    const found = faculties.find((f) => f._id === filters.faculty);
    if (found?.departments) {
      setDepartments(found.departments);
    } else {
      apiFetch('/departments', { auth: false, query: { faculty: filters.faculty } })
        .then((res) => setDepartments(res.data?.departments || []))
        .catch(() => setDepartments([]));
    }
  }, [filters.faculty, faculties]);

  // Debounce search text into filters
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchDraft ? prev : { ...prev, search: searchDraft, page: 1 }
      );
    }, 320);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  // Sync active filters to URL & load requests list
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/requests', {
        query: {
          status: filters.status,
          faculty: filters.faculty,
          department: filters.department,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          sort: filters.sort,
          search: filters.search,
          page: filters.page,
          limit: 15,
        },
      });
      setRequests(res.data?.requests || []);
      if (res.pagination) setPagination(res.pagination);
    } catch (err) {
      setError(err.message || 'خطا در دریافت فهرست درخواست‌ها.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const nextParams = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v && !(k === 'page' && v === 1) && !(k === 'sort' && v === 'newest')) {
        nextParams[k] = String(v);
      }
    });
    setSearchParams(nextParams, { replace: true });
    fetchList();
  }, [filters, fetchList, setSearchParams]);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'faculty' ? { department: '' } : {}),
      page: 1,
    }));
  };

  const resetFilters = () => {
    setSearchDraft('');
    setFilters({
      status: '',
      faculty: '',
      department: '',
      dateFrom: '',
      dateTo: '',
      sort: 'newest',
      search: '',
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    filters.status ||
      filters.faculty ||
      filters.department ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.search
  );

  return (
    <div className="container section-gap">
      <div className="page-header-row">
        <div>
          <h1 className="page-title">مدیریت درخواست‌های تصدیق‌نامه</h1>
          <p className="page-subtitle">
            بررسی، تأیید یا رد درخواست‌ها، انتخاب قالب، ویرایش متن سه‌زبانه و چاپ تصدیق‌نامه
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => {
            loadSummary();
            fetchList();
          }}
        >
          <IconRefresh size={16} />
          <span>تازه‌سازی</span>
        </button>
      </div>

      {/* Interactive Status Summary Strip */}
      {summary && (
        <div className="kpi-grid" role="group" aria-label="خلاصه وضعیت درخواست‌ها">
          {KPI_CARDS.map((card) => {
            const isSelected = filters.status === card.key;
            return (
              <button
                key={card.key || 'all'}
                type="button"
                className={`kpi-card kpi-${card.tone}${isSelected ? ' kpi-selected' : ''}`}
                onClick={() => updateFilter('status', card.key)}
              >
                <span className="kpi-value">{toDariDigits(summary[card.field] ?? 0)}</span>
                <span className="kpi-label">{card.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search & Filters Bar */}
      <section className="card filter-panel mt-4" aria-label="جستجو و فلتر درخواست‌ها">
        <div className="filter-grid">
          <div className="form-group filter-search-col">
            <label htmlFor="req-search" className="form-label">
              جستجو
            </label>
            <div className="input-with-icon">
              <IconSearch size={17} className="input-icon" />
              <input
                id="req-search"
                type="search"
                className="form-input"
                placeholder="نام، نام پدر، تذکره، کود پیگیری، سریال یا تماس..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="flt-status" className="form-label">
              وضعیت
            </label>
            <select
              id="flt-status"
              className="form-select"
              value={filters.status}
              onChange={(e) => updateFilter('status', e.target.value)}
            >
              <option value="">همه وضعیت‌ها</option>
              <option value="pending">در انتظار بررسی</option>
              <option value="approved">تأیید شده</option>
              <option value="printed">چاپ شده</option>
              <option value="rejected">رد شده</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="flt-faculty" className="form-label">
              پوهنځی
            </label>
            <select
              id="flt-faculty"
              className="form-select"
              value={filters.faculty}
              onChange={(e) => updateFilter('faculty', e.target.value)}
            >
              <option value="">همه پوهنځی‌ها</option>
              {faculties.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name?.fa}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="flt-dept" className="form-label">
              دیپارتمنت
            </label>
            <select
              id="flt-dept"
              className="form-select"
              value={filters.department}
              disabled={!filters.faculty}
              onChange={(e) => updateFilter('department', e.target.value)}
            >
              <option value="">همه دیپارتمنت‌ها</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name?.fa}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="flt-from" className="form-label">
              از تاریخ
            </label>
            <input
              id="flt-from"
              type="date"
              dir="ltr"
              className="form-input ltr-input"
              value={filters.dateFrom}
              onChange={(e) => updateFilter('dateFrom', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="flt-to" className="form-label">
              تا تاریخ
            </label>
            <input
              id="flt-to"
              type="date"
              dir="ltr"
              className="form-input ltr-input"
              value={filters.dateTo}
              onChange={(e) => updateFilter('dateTo', e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="flt-sort" className="form-label">
              ترتیب نمایش
            </label>
            <select
              id="flt-sort"
              className="form-select"
              value={filters.sort}
              onChange={(e) => updateFilter('sort', e.target.value)}
            >
              <option value="newest">جدیدترین ابتدا</option>
              <option value="oldest">قدیمی‌ترین ابتدا</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="filter-footer">
            <span className="text-muted text-sm">
              نتایج یافت‌شده: <strong>{toDariDigits(pagination.total)}</strong> مورد
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
              پاک‌سازی همه فلترها
            </button>
          </div>
        )}
      </section>

      {error && <div className="alert alert-error mt-4">{error}</div>}

      {/* Requests Table */}
      <section className="card table-card mt-4">
        {loading ? (
          <div className="table-loader">
            <div className="spinner" />
            <span>در حال بارگذاری درخواست‌ها...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <h3>هیچ درخواستی مطابق فلترهای فعلی یافت نشد</h3>
            <p className="text-muted">
              عبارت جستجو یا فلترهای انتخاب‌شده را تغییر دهید تا درخواست‌های دیگر نمایش داده شوند.
            </p>
            {hasActiveFilters && (
              <button type="button" className="btn btn-secondary btn-sm mt-2" onClick={resetFilters}>
                نمایش همه درخواست‌ها
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>کود پیگیری / سریال</th>
                  <th>نام و نام پدر</th>
                  <th>پوهنځی و دیپارتمنت</th>
                  <th>مقطع / سال</th>
                  <th>وضعیت</th>
                  <th>تاریخ ثبت</th>
                  <th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req._id}>
                    <td>
                      <code className="code-pill" dir="ltr">
                        {req.trackingCode}
                      </code>
                      {req.serial && (
                        <div className="sub-code" dir="ltr">
                          {req.serial}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="cell-primary">{req.firstName}</div>
                      <div className="cell-sub">فرزند {req.fatherName}</div>
                    </td>
                    <td>
                      <div className="cell-primary">{req.facultyId?.name?.fa || '—'}</div>
                      <div className="cell-sub">{req.departmentId?.name?.fa || '—'}</div>
                    </td>
                    <td>
                      <div className="cell-primary">
                        {DEGREE_LABELS[req.degreeLevel] || req.degreeLevel}
                      </div>
                      <div className="cell-sub">{req.gradYearSH} هـ.ش</div>
                    </td>
                    <td>
                      <StatusBadge status={req.status} size="sm" />
                    </td>
                    <td className="cell-sub">{formatDateTime(req.createdAt, { withTime: false })}</td>
                    <td>
                      <Link
                        to={`/officer/requests/${req._id}`}
                        className="btn btn-primary btn-sm"
                      >
                        <IconEye size={15} />
                        <span>بررسی و چاپ</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="pagination-bar">
            <span className="text-muted text-sm">
              صفحه {toDariDigits(pagination.page)} از {toDariDigits(pagination.totalPages)} (مجموع{' '}
              {toDariDigits(pagination.total)} درخواست)
            </span>
            <div className="pagination-btns">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
              >
                صفحه قبلی
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
              >
                صفحه بعدی
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

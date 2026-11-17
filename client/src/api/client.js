/**
 * Offline Relative-URL API Client — Kunduz University Certificate System
 * All requests use same-origin `/api/*` paths (zero external hosts, LAN-safe).
 */

const TOKEN_STORAGE_KEY = 'ku_cert_auth_token';

const templatePreviewCache = new Map();

export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors in restricted browsing modes
  }
}

export function clearTemplatePreviewCache(templateKeyOrId) {
  if (!templateKeyOrId) {
    templatePreviewCache.clear();
    return;
  }
  const needle = String(templateKeyOrId);
  for (const key of templatePreviewCache.keys()) {
    if (key.startsWith(`${needle}:`)) {
      templatePreviewCache.delete(key);
    }
  }
}

export class ApiError extends Error {
  constructor(message, { status = 500, code = 'ERROR', errors = [] } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = Array.isArray(errors) ? errors : [];
  }
}

let unauthorizedListener = null;

export function onUnauthorized(listener) {
  unauthorizedListener = listener;
}

function buildQueryString(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      sp.set(key, String(val).trim());
    }
  });
  const str = sp.toString();
  return str ? `?${str}` : '';
}

async function parseErrorResponse(res) {
  let payload = null;
  try {
    const text = await res.text();
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const message =
    payload?.message ||
    (res.status === 401
      ? 'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد سیستم شوید.'
      : res.status === 403
        ? 'شما صلاحیت دسترسی به این بخش را ندارید.'
        : res.status === 404
          ? 'مورد درخواستی در سیستم یافت نشد.'
          : 'خطا در ارتباط با سرور رخ داد. لطفاً دوباره تلاش نمایید.');

  return new ApiError(message, {
    status: res.status,
    code: payload?.code || 'API_ERROR',
    errors: payload?.errors || [],
  });
}

/**
 * Standard JSON API call helper.
 */
export async function apiFetch(path, { method = 'GET', query, body, auth = true } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = auth ? getStoredToken() : '';
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}${buildQueryString(query)}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'ارتباط با سرور محلی برقرار نشد. لطفاً اتصال شبکه داخلی (LAN) را بررسی نمایید.',
      { status: 0, code: 'NETWORK_ERROR' }
    );
  }

  if (!res.ok) {
    const err = await parseErrorResponse(res);
    if (res.status === 401 && auth && token && path !== '/auth/login' && path !== '/auth/change-password') {
      setStoredToken('');
      if (typeof unauthorizedListener === 'function') {
        unauthorizedListener();
      }
    }
    throw err;
  }

  return res.json();
}

/**
 * Fetch live HTML preview for a specific certificate request (`GET /api/requests/:id/preview`).
 */
export async function fetchRequestPreviewHtml(requestId, { template = '', chromeless = true } = {}) {
  const token = getStoredToken();
  const query = buildQueryString({
    template: template || undefined,
    chromeless: chromeless ? '1' : undefined,
  });

  let res;
  try {
    res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/preview${query}`, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new ApiError('خطا در بارگذاری پیش‌نمایش تصدیق‌نامه.', { status: 0, code: 'NETWORK_ERROR' });
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const html = await res.text();
  const rawWarning = res.headers.get('x-certificate-warning');
  const warning = rawWarning ? decodeURIComponent(rawWarning) : '';
  const theme = res.headers.get('x-certificate-theme') || '';

  return { html, warning, theme };
}

/**
 * Fetch live sample HTML preview for a template card (`GET /api/templates/:id/preview`).
 * Cached in memory so template grids render instantaneously when revisited.
 */
export async function fetchTemplateSampleHtml(
  templateIdOrKey,
  { gender = 'male', forceRefresh = false } = {}
) {
  const cacheKey = `${templateIdOrKey}:${gender}`;
  if (!forceRefresh && templatePreviewCache.has(cacheKey)) {
    return templatePreviewCache.get(cacheKey);
  }

  const token = getStoredToken();
  const query = buildQueryString({ gender, chromeless: 'true' });

  let res;
  try {
    res = await fetch(
      `/api/templates/${encodeURIComponent(templateIdOrKey)}/preview${query}`,
      {
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
  } catch {
    throw new ApiError('خطا در بارگذاری پیش‌نمایش قالب.', { status: 0, code: 'NETWORK_ERROR' });
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const html = await res.text();
  templatePreviewCache.set(cacheKey, html);
  return html;
}

/**
 * Generate a single-page A4 landscape PDF (`POST /api/requests/:id/pdf`) and record `printLogs`.
 */
export async function generateCertificatePdfBlob(
  requestId,
  { templateId, templateKey, reprintReason = '' } = {}
) {
  const token = getStoredToken();
  const payload = {};
  if (templateId) payload.templateId = templateId;
  if (templateKey) payload.templateKey = templateKey;
  if (reprintReason) payload.reprintReason = reprintReason;

  let res;
  try {
    res = await fetch(`/api/requests/${encodeURIComponent(requestId)}/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new ApiError('خطا در تولید فایل PDF تصدیق‌نامه.', { status: 0, code: 'NETWORK_ERROR' });
  }

  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  const blob = await res.blob();
  const serial = res.headers.get('x-certificate-serial') || 'certificate';
  const theme = res.headers.get('x-certificate-theme') || '';
  const isReprint = res.headers.get('x-is-reprint') === 'true';
  const printLogId = res.headers.get('x-print-log-id') || '';
  const rawWarning = res.headers.get('x-certificate-warning');
  const warning = rawWarning ? decodeURIComponent(rawWarning) : '';

  return {
    blob,
    filename: `certificate-${serial.replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`,
    serial,
    theme,
    isReprint,
    printLogId,
    warning,
  };
}

/**
 * Convert Zod field errors returned by the backend into `{ [fieldPath]: message }`.
 */
export function extractFieldErrors(err) {
  const map = {};
  if (err && Array.isArray(err.errors)) {
    for (const item of err.errors) {
      const key = item.field || item.path;
      if (key && !map[key]) {
        map[key] = item.message;
      }
    }
  }
  return map;
}

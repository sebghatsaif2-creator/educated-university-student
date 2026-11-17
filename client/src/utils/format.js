/**
 * Dari RTL Labels, Date/Digit Formatters & Certificate Fit Helpers
 */

export const STATUS_META = {
  pending: {
    label: 'در انتظار بررسی',
    tone: 'amber',
    description: 'درخواست شما ثبت شده و در صف بررسی معاونیت امور محصلان قرار دارد.',
  },
  approved: {
    label: 'تأیید شده',
    tone: 'green',
    description: 'درخواست شما تأیید گردیده و شماره سریال رسمی صادر شده است؛ آماده چاپ می‌باشد.',
  },
  printed: {
    label: 'چاپ شده',
    tone: 'blue',
    description: 'تصدیق‌نامه شما چاپ گردیده و آماده تسلیم‌دهی در معاونیت امور محصلان است.',
  },
  rejected: {
    label: 'رد شده',
    tone: 'red',
    description: 'درخواست شما پس از بررسی رد گردیده است. لطفاً دلیل درج‌شده را مطالعه نمایید.',
  },
};

export const DEGREE_LABELS = {
  associate: 'فوق دیپلوم',
  bachelor: 'لیسانس',
  master: 'ماستری',
  phd: 'دوکتورا',
};

export const DEGREE_OPTIONS = [
  { value: 'bachelor', label: 'لیسانس (Bachelor)' },
  { value: 'master', label: 'ماستری (Master)' },
  { value: 'phd', label: 'دوکتورا (PhD)' },
  { value: 'associate', label: 'فوق دیپلوم (Associate)' },
];

export const GENDER_LABELS = {
  male: 'ذکور (مرد)',
  female: 'اناث (زن)',
};

export const ROLE_LABELS = {
  admin: 'مدیر سیستم',
  officer: 'کارمند امور محصلان',
};

export const TEMPLATE_PLACEHOLDERS = [
  { token: '{{name}}', label: 'نام فارغ‌التحصیل' },
  { token: '{{fatherName}}', label: 'نام پدر' },
  { token: '{{faculty}}', label: 'نام پوهنځی' },
  { token: '{{department}}', label: 'نام دیپارتمنت' },
  { token: '{{degree}}', label: 'مقطع تحصیلی' },
  { token: '{{gradYearSH}}', label: 'سال فراغت (هـ.ش)' },
  { token: '{{gradYearAD}}', label: 'سال فراغت (میلادی)' },
  { token: '{{nationalId}}', label: 'نمبر تذکره' },
  { token: '{{serial}}', label: 'شماره سریال' },
  { token: '{{officialNo}}', label: 'نمبر رسمی' },
];

/**
 * Convert Dari/Persian (۰-۹) and Arabic (٠-٩) digits to standard ASCII 0-9.
 */
export function toAsciiDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Convert ASCII 0-9 digits to Dari/Persian digits (۰-۹) for polished UI display.
 */
export function toDariDigits(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\d/g, (d) => String.fromCharCode(0x06f0 + Number(d)));
}

/**
 * Format an ISO timestamp cleanly for Dari RTL users (local offline Intl formatter).
 */
export function formatDateTime(isoString, { withTime = true } = {}) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '—';

  try {
    const options = withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
    return new Intl.DateTimeFormat('fa-AF-u-ca-persian', options).format(date);
  } catch {
    return date.toISOString().slice(0, withTime ? 16 : 10).replace('T', ' ');
  }
}

/**
 * Mirror server-side `analyzeTextFit` thresholds for instant client-side auto-shrink feedback.
 */
export function evaluateClientTextFit(finalText = {}) {
  const lengths = {
    en: String(finalText.en || '').trim().length,
    fa: String(finalText.fa || '').trim().length,
    ps: String(finalText.ps || '').trim().length,
  };
  const maxLength = Math.max(lengths.en, lengths.fa, lengths.ps);

  let densityClass = '';
  if (maxLength > 1050) {
    densityClass = 'density-ultra';
  } else if (maxLength > 800) {
    densityClass = 'density-dense';
  } else if (maxLength > 600) {
    densityClass = 'density-compact';
  }

  let warning = '';
  if (maxLength > 1350) {
    warning =
      'متن تصدیق‌نامه بسیار طولانی است؛ اندازه فونت به حداقل کاهش یافت. لطفاً جهت خوانایی بهتر متن را کوتاه‌تر نمایید.';
  } else if (maxLength > 760) {
    warning =
      'متن تصدیق‌نامه طولانی‌تر از حد معمول است و اندازه فونت به‌صورت خودکار برای جای‌گیری در یک صفحه A4 کوچک گردید.';
  }

  return { lengths, maxLength, densityClass, warning };
}

/**
 * Trigger a browser download from a Blob without leaving dangling object URLs.
 */
export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Open a generated PDF Blob for direct local LAN printing.
 */
export function openPdfForPrint(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => {
      try {
        win.focus();
        win.print();
      } catch {
        // User can print directly from the opened browser PDF viewer
      }
    });
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    return true;
  }

  // Fallback hidden iframe if pop-ups are blocked
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Ignore cross-frame viewer restrictions
    }
    window.setTimeout(() => {
      iframe.remove();
      URL.revokeObjectURL(url);
    }, 120000);
  };
  document.body.appendChild(iframe);
  return true;
}

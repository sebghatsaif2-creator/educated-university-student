'use strict';

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

const env = require('../config/env');
const { Template, Faculty, Department, Asset } = require('../models');
const AppError = require('../utils/AppError');
const { generateCertificateText } = require('./textGenerator');
const { resolveActiveTemplate } = require('./printService');
const { renderCertificateHtml } = require('../templates/certificateTemplate');
const { OBJECT_ID_REGEX } = require('../validators/common');

const COMMON_SYSTEM_BROWSERS = [
  '/usr/local/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

let sharedBrowserPromise = null;

/**
 * Build the offline LAN verification URL encoded inside each certificate's QR code.
 * @param {string} serial
 * @returns {string}
 */
function buildVerifyUrl(serial) {
  const cleanSerial = encodeURIComponent(String(serial || '').trim());
  return `${env.lanBaseUrl}/verify/${cleanSerial}`;
}

/**
 * Generate a local PNG Data URL QR code (100% offline using the `qrcode` package).
 * @param {string} targetUrl
 * @returns {Promise<string>}
 */
async function generateQrDataUrl(targetUrl) {
  return QRCode.toDataURL(targetUrl, {
    type: 'image/png',
    width: 300,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#111111',
      light: '#ffffff',
    },
  });
}

/**
 * Search `./offline/chromium` (created via `@puppeteer/browsers install chrome@stable --path ./offline/chromium`)
 * for a portable pre-downloaded Chrome/Chromium executable on Linux, Windows, or macOS.
 */
function findPortableOfflineChromium(dir, depth = 0) {
  if (depth > 5 || !fs.existsSync(dir)) return '';
  const targetNames = new Set([
    'chrome',
    'chromium',
    'chrome.exe',
    'Google Chrome for Testing',
    'Google Chrome',
  ]);
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return '';
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && targetNames.has(entry.name)) {
      return full;
    }
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const found = findPortableOfflineChromium(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }
  }
  return '';
}

/**
 * Resolve the Chrome/Chromium executable path from `.env`, `./offline/chromium`,
 * Puppeteer cache, or local OS installation — never triggers a runtime download.
 * @returns {string|undefined}
 */
function resolveBrowserExecutablePath() {
  if (env.puppeteerExecutablePath) {
    if (!fs.existsSync(env.puppeteerExecutablePath)) {
      throw new AppError(
        `فایل مرورگر Chromium در مسیر تنظیم‌شده (${env.puppeteerExecutablePath}) یافت نشد. لطفاً مقدار PUPPETEER_EXECUTABLE_PATH را در فایل .env بررسی نمایید.`,
        500,
        'BROWSER_EXECUTABLE_NOT_FOUND'
      );
    }
    return env.puppeteerExecutablePath;
  }

  const portableDir = path.resolve(__dirname, '../../../offline/chromium');
  const portableBin = findPortableOfflineChromium(portableDir);
  if (portableBin) {
    return portableBin;
  }

  try {
    const bundled = puppeteer.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // Fall through to system browser discovery
  }

  for (const candidate of COMMON_SYSTEM_BROWSERS) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

/**
 * Launch or reuse a shared headless Chromium instance for fast 100% offline PDF generation.
 */
async function getBrowser() {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing && existing.connected) {
        return existing;
      }
    } catch {
      sharedBrowserPromise = null;
    }
    sharedBrowserPromise = null;
  }

  const executablePath = resolveBrowserExecutablePath();
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-sync',
      '--disable-translate',
      '--safebrowsing-disable-auto-update',
      '--dns-prefetch-disable',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-pings',
      '--font-render-hinting=none',
    ],
  };

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  sharedBrowserPromise = puppeteer.launch(launchOptions).then((browser) => {
    browser.on('disconnected', () => {
      sharedBrowserPromise = null;
    });
    return browser;
  });

  try {
    return await sharedBrowserPromise;
  } catch (err) {
    sharedBrowserPromise = null;
    throw new AppError(
      `خطا در راه‌اندازی سرویس تولید PDF (Puppeteer): ${err.message}`,
      500,
      'PDF_ENGINE_ERROR'
    );
  }
}

/**
 * Close the shared Puppeteer browser cleanly (used in shutdown hooks, scripts, and tests).
 */
async function closeBrowser() {
  if (!sharedBrowserPromise) return;
  const promise = sharedBrowserPromise;
  sharedBrowserPromise = null;
  try {
    const browser = await promise;
    if (browser && browser.connected) {
      await browser.close();
    }
  } catch {
    // Ignore close errors during shutdown
  }
}

/**
 * Load active logo/watermark asset file paths from MongoDB, with local fallbacks.
 */
async function loadCertificateAssets() {
  const rows = await Asset.find({
    key: { $in: ['university-logo', 'ministry-logo', 'watermark-logo'] },
    isActive: true,
  })
    .select('key filePath')
    .lean();

  const map = new Map(rows.map((r) => [r.key, r.filePath]));
  return {
    universityLogo: map.get('university-logo') || '/public/logos/university-logo.png',
    ministryLogo: map.get('ministry-logo') || '/public/logos/ministry-logo.png',
    watermarkLogo:
      map.get('watermark-logo') ||
      map.get('university-logo') ||
      '/public/logos/university-logo.png',
  };
}

/**
 * Resolve an active template from an optional ID or theme key string, or fall back to request/default.
 */
async function resolveTemplateForRender(templateSelector, requestTemplateId) {
  if (templateSelector) {
    const raw = String(templateSelector).trim();
    const tpl = OBJECT_ID_REGEX.test(raw)
      ? await Template.findById(raw)
      : await Template.findOne({ key: raw.toLowerCase() });

    if (!tpl || !tpl.isActive) {
      throw new AppError(
        'قالب انتخاب‌شده یافت نشد یا غیرفعال می‌باشد.',
        400,
        'TEMPLATE_INACTIVE_OR_NOT_FOUND'
      );
    }
    return tpl;
  }

  const fallbackId =
    requestTemplateId && typeof requestTemplateId === 'object'
      ? requestTemplateId._id
      : requestTemplateId;

  return resolveActiveTemplate(null, fallbackId || null);
}

/**
 * Assemble complete HTML + QR + metadata for certificate preview or PDF rendering.
 *
 * @param {object} options
 * @param {object} options.request - Request document or plain object
 * @param {string|null} [options.templateSelector] - Optional template `_id` or `key` override
 * @param {object|null} [options.templateDoc] - Optional preloaded Template document
 * @param {boolean} [options.regenerateForTemplate] - Force using template defaults instead of stored finalText
 * @param {boolean} [options.embedAssets] - Inline local fonts & logos as data URIs
 * @param {string} [options.cspNonce] - Optional CSP nonce for HTML preview
 */
async function prepareCertificateRender({
  request,
  templateSelector = null,
  templateDoc = null,
  regenerateForTemplate = false,
  embedAssets = false,
  cspNonce = '',
  chromeless = false,
  includeScript = true,
}) {
  const facultyId =
    request.facultyId && typeof request.facultyId === 'object'
      ? request.facultyId._id
      : request.facultyId;
  const departmentId =
    request.departmentId && typeof request.departmentId === 'object'
      ? request.departmentId._id
      : request.departmentId;

  const [template, faculty, department, assets] = await Promise.all([
    templateDoc || resolveTemplateForRender(templateSelector, request.templateId),
    request.facultyId?.name ? request.facultyId : Faculty.findById(facultyId).lean(),
    request.departmentId?.name ? request.departmentId : Department.findById(departmentId).lean(),
    loadCertificateAssets(),
  ]);

  if (!faculty || !department) {
    throw new AppError(
      'پوهنځی یا دیپارتمنت مرتبط با این درخواست یافت نشد.',
      400,
      'CATALOG_REFERENCE_MISSING'
    );
  }

  const generated = generateCertificateText({
    template,
    request,
    faculty,
    department,
  });

  const finalText = regenerateForTemplate
    ? generated
    : {
        fa: request.finalText?.fa?.trim() || generated.fa,
        ps: request.finalText?.ps?.trim() || generated.ps,
        en: request.finalText?.en?.trim() || generated.en,
      };

  const isDraft = !request.serial;
  const qrSerial = request.serial || request.trackingCode || 'PREVIEW';
  const verifyUrl = buildVerifyUrl(qrSerial);
  const qrDataUrl = await generateQrDataUrl(verifyUrl);

  const rendered = renderCertificateHtml({
    themeKey: template.key,
    faculty,
    finalText,
    serial: request.serial || '',
    officialNo: request.officialNo || '',
    qrDataUrl,
    assets,
    embedAssets,
    isDraft,
    cspNonce,
    chromeless,
    includeScript,
  });

  return {
    html: rendered.html,
    themeKey: rendered.themeKey,
    themeClass: rendered.themeClass,
    template,
    faculty,
    department,
    finalText,
    verifyUrl,
    warnings: [...rendered.warnings],
    fit: rendered.fit,
  };
}

/**
 * Render a pre-built certificate HTML string to a single-page A4 landscape PDF buffer via Puppeteer.
 *
 * @param {string} html - Complete self-contained certificate HTML (with embedded local fonts & logos)
 * @param {object} [options]
 * @param {string} [options.screenshotPath] - Optional PNG path for offline visual verification
 * @returns {Promise<{ pdfBuffer: Buffer, fitResult: { shrunkColumns: Array, overflowColumns: Array } }>}
 */
async function renderHtmlToPdfBuffer(html, { screenshotPath = '' } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Strictly block any accidental external HTTP(S) call (100% offline enforcement)
    await page.setRequestInterception(true);
    page.on('request', (interceptedReq) => {
      const url = interceptedReq.url();
      if (url.startsWith('data:') || url.startsWith('about:') || url.startsWith('blob:')) {
        interceptedReq.continue();
      } else {
        interceptedReq.abort();
      }
    });

    // Exact A4 landscape viewport (297mm x 210mm @ 96 DPI = 1123 x 794 CSS px)
    await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load', timeout: 20000 });

    // Wait until all local @font-face fonts finish decoding and execute single-page autofit
    const fitResult = await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      if (typeof window.__runCertAutoFit === 'function') {
        return window.__runCertAutoFit();
      }
      return { shrunkColumns: [], overflowColumns: [] };
    });

    if (screenshotPath) {
      await page.emulateMediaType('print');
      await page.screenshot({
        path: screenshotPath,
        type: 'png',
        clip: { x: 0, y: 0, width: 1123, height: 794 },
      });
    }

    const rawPdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      pageRanges: '1',
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
    });

    return {
      pdfBuffer: Buffer.from(rawPdf),
      fitResult: fitResult || { shrunkColumns: [], overflowColumns: [] },
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * End-to-end helper: prepare certificate HTML (with local QR, logos, fonts) and render PDF.
 */
async function generateCertificatePdf(options) {
  const prepared = await prepareCertificateRender({
    ...options,
    embedAssets: true,
  });

  const { pdfBuffer, fitResult } = await renderHtmlToPdfBuffer(prepared.html, {
    screenshotPath: options.screenshotPath || '',
  });

  const warnings = [...prepared.warnings];
  if (fitResult.overflowColumns && fitResult.overflowColumns.length > 0) {
    warnings.push(
      `هشدار: متن ستون (${fitResult.overflowColumns.join(', ')}) بیش از ظرفیت یک صفحه A4 است؛ لطفاً متن را کوتاه‌تر نمایید.`
    );
  } else if (
    warnings.length === 0 &&
    fitResult.shrunkColumns &&
    fitResult.shrunkColumns.length > 0
  ) {
    warnings.push(
      'اندازه فونت به صورت خودکار تنظیم شد تا تمام متن در یک صفحه A4 افقی جای گیرد.'
    );
  }

  return {
    pdfBuffer,
    template: prepared.template,
    finalText: prepared.finalText,
    verifyUrl: prepared.verifyUrl,
    themeKey: prepared.themeKey,
    warnings,
    fitResult,
  };
}

module.exports = {
  buildVerifyUrl,
  generateQrDataUrl,
  resolveBrowserExecutablePath,
  getBrowser,
  closeBrowser,
  loadCertificateAssets,
  prepareCertificateRender,
  renderHtmlToPdfBuffer,
  generateCertificatePdf,
};

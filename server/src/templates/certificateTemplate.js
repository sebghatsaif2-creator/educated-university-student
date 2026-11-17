'use strict';

const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const { TEMPLATE_KEYS } = require('../models/Template');

const CSS_PATH = path.join(__dirname, 'certificate.css');

// In-memory cache of base64-encoded offline fonts and logos for zero-network Puppeteer rendering
const binaryDataUriCache = new Map();

const FONT_FILES = Object.freeze([
  {
    family: 'Vazirmatn',
    weight: 400,
    file: 'vazirmatn-arabic-400-normal.woff2',
    range: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFC',
  },
  {
    family: 'Vazirmatn',
    weight: 400,
    file: 'vazirmatn-latin-400-normal.woff2',
    range: 'U+0000-00FF, U+2000-206F',
  },
  {
    family: 'Vazirmatn',
    weight: 600,
    file: 'vazirmatn-arabic-600-normal.woff2',
    range: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFC',
  },
  {
    family: 'Vazirmatn',
    weight: 600,
    file: 'vazirmatn-latin-600-normal.woff2',
    range: 'U+0000-00FF, U+2000-206F',
  },
  {
    family: 'Vazirmatn',
    weight: 700,
    file: 'vazirmatn-arabic-700-normal.woff2',
    range: 'U+0600-06FF, U+0750-077F, U+08A0-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFC',
  },
  {
    family: 'Vazirmatn',
    weight: 700,
    file: 'vazirmatn-latin-700-normal.woff2',
    range: 'U+0000-00FF, U+2000-206F',
  },
  {
    family: 'Noto Naskh Arabic',
    weight: 400,
    file: 'noto-naskh-arabic-arabic-400-normal.woff2',
    range: null,
  },
  {
    family: 'Noto Naskh Arabic',
    weight: 600,
    file: 'noto-naskh-arabic-arabic-600-normal.woff2',
    range: null,
  },
  {
    family: 'Noto Naskh Arabic',
    weight: 700,
    file: 'noto-naskh-arabic-arabic-700-normal.woff2',
    range: null,
  },
  {
    family: 'EB Garamond',
    weight: 400,
    file: 'eb-garamond-latin-400-normal.woff2',
    range: null,
  },
  {
    family: 'EB Garamond',
    weight: 600,
    file: 'eb-garamond-latin-600-normal.woff2',
    range: null,
  },
  {
    family: 'EB Garamond',
    weight: 700,
    file: 'eb-garamond-latin-700-normal.woff2',
    range: null,
  },
]);

// Length thresholds (characters per column) for proactive single-page font scaling & warnings
const LENGTH_THRESHOLDS = Object.freeze({
  compact: 500,
  dense: 720,
  ultra: 980,
  warning: 850,
  maxSafe: 1550,
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function detectMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.ttf') return 'font/ttf';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function fileToDataUri(absPath) {
  if (binaryDataUriCache.has(absPath)) {
    return binaryDataUriCache.get(absPath);
  }
  if (!fs.existsSync(absPath)) {
    return '';
  }
  const mime = detectMimeType(absPath);
  const b64 = fs.readFileSync(absPath).toString('base64');
  const uri = `data:${mime};base64,${b64}`;
  binaryDataUriCache.set(absPath, uri);
  return uri;
}

/**
 * Resolve a public asset path (e.g. `/public/logos/university-logo.png`) to either
 * a local URL (for browser preview) or an embedded data URI (for standalone Puppeteer PDF).
 */
function resolveLogoSrc(publicPath, fallbackFile, embedAssets) {
  const rel = publicPath
    ? publicPath.replace(/^\/?(public\/)?/, '')
    : `logos/${fallbackFile}`;
  const candidateAbs = path.join(env.publicDir, rel);
  const fallbackAbs = path.join(env.publicDir, 'logos', fallbackFile);
  const chosenAbs = fs.existsSync(candidateAbs) ? candidateAbs : fallbackAbs;

  if (embedAssets) {
    return fileToDataUri(chosenAbs);
  }

  const relativeFromPublic = path
    .relative(env.publicDir, chosenAbs)
    .split(path.sep)
    .join('/');
  return `/public/${relativeFromPublic}`;
}

/**
 * Build offline `@font-face` rules pointing strictly to local `public/fonts` files.
 */
function buildFontFaceCss(embedAssets = false) {
  const blocks = [];

  for (const font of FONT_FILES) {
    const absPath = path.join(env.publicDir, 'fonts', font.file);
    if (!fs.existsSync(absPath)) continue;

    const srcUrl = embedAssets
      ? fileToDataUri(absPath)
      : `/public/fonts/${font.file}`;

    blocks.push(
      `@font-face {\n` +
        `  font-family: '${font.family}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${font.weight};\n` +
        `  font-display: block;\n` +
        `  src: url('${srcUrl}') format('woff2');\n` +
        (font.range ? `  unicode-range: ${font.range};\n` : '') +
        `}`
    );
  }

  return blocks.join('\n');
}

/**
 * Convert multi-paragraph plain text into safe escaped `<p>` elements.
 * For RTL columns (Dari & Pashto), isolates hyphenated/slashed ID & serial tokens
 * (e.g. `1400-0512-33190`) in `<span class="ltr-token" dir="ltr">` so BiDi never
 * reorders segments or splits them mid-code across line breaks.
 */
function renderParagraphs(text, { isRtl = false } = {}) {
  const paragraphs = String(text || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!paragraphs.length) {
    return '<p></p>';
  }

  return paragraphs
    .map((p) => {
      let safe = escapeHtml(p);
      if (isRtl) {
        safe = safe.replace(
          /\(([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+)\)|\b([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+)\b/g,
          (match, parenCode, bareCode) =>
            parenCode
              ? `<span class="ltr-token" dir="ltr">(${parenCode})</span>`
              : `<span class="ltr-token" dir="ltr">${bareCode}</span>`
        );
      }
      return `<p>${safe}</p>`;
    })
    .join('\n');
}

/**
 * Evaluate body text length across all 3 columns to choose a density class and flag warnings.
 * @param {{ fa?: string, ps?: string, en?: string }} finalText
 */
function analyzeTextFit(finalText = {}) {
  const lengths = {
    en: String(finalText.en || '').trim().length,
    fa: String(finalText.fa || '').trim().length,
    ps: String(finalText.ps || '').trim().length,
  };
  const maxLength = Math.max(lengths.en, lengths.fa, lengths.ps);

  let densityClass = '';
  if (maxLength > LENGTH_THRESHOLDS.ultra) {
    densityClass = 'density-ultra';
  } else if (maxLength > LENGTH_THRESHOLDS.dense) {
    densityClass = 'density-dense';
  } else if (maxLength > LENGTH_THRESHOLDS.compact) {
    densityClass = 'density-compact';
  }

  const warnings = [];
  if (maxLength > LENGTH_THRESHOLDS.maxSafe) {
    warnings.push(
      'متن تصدیق‌نامه بسیار طولانی است؛ اندازه فونت به حداقل کاهش یافت. لطفاً جهت خوانایی بهتر متن را کوتاه‌تر نمایید.'
    );
  } else if (maxLength > LENGTH_THRESHOLDS.warning) {
    warnings.push(
      'متن تصدیق‌نامه طولانی‌تر از حد معمول است و اندازه فونت به‌صورت خودکار برای جای‌گیری در یک صفحه A4 کوچک گردید.'
    );
  }

  return { lengths, maxLength, densityClass, warnings };
}

/**
 * Shared inline SVG decorations for corner stripes, gold ribbons, and classical ornaments.
 * Controlled strictly by `.theme-<key>` CSS rules (zero external files).
 */
function buildThemeSvgDecor() {
  return `
  <svg class="cert-svg-decor" viewBox="0 0 297 210" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="goldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e5c86b" />
        <stop offset="48%" stop-color="#b68924" />
        <stop offset="100%" stop-color="#dfc060" />
      </linearGradient>
      <linearGradient id="tealCorner" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#317696" />
        <stop offset="100%" stop-color="#1e536e" />
      </linearGradient>
      <linearGradient id="blueDeep" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0a58a8" />
        <stop offset="100%" stop-color="#1473c7" />
      </linearGradient>
      <linearGradient id="blueSky" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4aaae6" />
        <stop offset="100%" stop-color="#87ccf2" />
      </linearGradient>
    </defs>

    <!-- THEME: blue-stripes (modeled directly on Kunduz University Agriculture sample) -->
    <g class="svg-blue-stripes">
      <!-- Top-left layered diagonal blue corner stripes -->
      <polygon points="0,0 74,0 24,23 0,88" fill="#8bcdf2" opacity="0.55" />
      <polygon points="0,0 60,0 16,22 0,74" fill="url(#blueSky)" />
      <polygon points="0,0 44,0 11,17 0,54" fill="url(#blueDeep)" />
      <polygon points="5.5,5.5 34,5.5 5.5,41" fill="none" stroke="#ffffff" stroke-width="0.45" opacity="0.7" />
      <!-- Top-right royal blue vertical accent bar -->
      <rect x="289" y="5.5" width="3.2" height="38" fill="#0d62b3" />
      <rect x="286.6" y="5.5" width="1.1" height="24" fill="#5bb4e8" />

      <!-- Bottom-right mirrored layered diagonal blue corner stripes -->
      <polygon points="297,210 223,210 273,187 297,122" fill="#8bcdf2" opacity="0.55" />
      <polygon points="297,210 237,210 281,188 297,136" fill="url(#blueSky)" />
      <polygon points="297,210 253,210 286,193 297,156" fill="url(#blueDeep)" />
      <polygon points="291.5,204.5 263,204.5 291.5,169" fill="none" stroke="#ffffff" stroke-width="0.45" opacity="0.7" />
      <!-- Bottom-left royal blue vertical accent bar -->
      <rect x="4.8" y="166.5" width="3.2" height="38" fill="#0d62b3" />
      <rect x="9.3" y="180.5" width="1.1" height="24" fill="#5bb4e8" />
    </g>

    <!-- THEME: gold-corners (modeled on Kunduz University Education sample + gold corner ornaments) -->
    <g class="svg-gold-corners">
      <!-- Top-left teal corner + metallic gold diagonal ribbon -->
      <polygon points="0,0 56,0 0,56" fill="url(#tealCorner)" />
      <polygon points="29,0 38,0 0,38 0,29" fill="url(#goldRibbon)" />
      <line x1="40.5" y1="0" x2="0" y2="40.5" stroke="#c59b34" stroke-width="0.55" opacity="0.85" />
      <polygon points="56,0 62,0 0,62 0,56" fill="#d9c17c" opacity="0.42" />

      <!-- Bottom-right mirrored teal corner + metallic gold diagonal ribbon -->
      <polygon points="297,210 241,210 297,154" fill="url(#tealCorner)" />
      <polygon points="268,210 259,210 297,172 297,181" fill="url(#goldRibbon)" />
      <line x1="256.5" y1="210" x2="297" y2="169.5" stroke="#c59b34" stroke-width="0.55" opacity="0.85" />
      <polygon points="241,210 235,210 297,148 297,154" fill="#d9c17c" opacity="0.42" />

      <!-- Top-right & bottom-left delicate gold corner ornaments -->
      <path d="M266,8.5 L288.5,8.5 L288.5,31" fill="none" stroke="url(#goldRibbon)" stroke-width="1.4" />
      <path d="M272,11.2 L285.8,11.2 L285.8,25" fill="none" stroke="#c59b34" stroke-width="0.55" />
      <polygon points="288.5,8.5 283.5,8.5 288.5,13.5" fill="url(#goldRibbon)" />
      <circle cx="282.5" cy="14.5" r="1.2" fill="#c59b34" />

      <path d="M31,201.5 L8.5,201.5 L8.5,179" fill="none" stroke="url(#goldRibbon)" stroke-width="1.4" />
      <path d="M25,198.8 L11.2,198.8 L11.2,185" fill="none" stroke="#c59b34" stroke-width="0.55" />
      <polygon points="8.5,201.5 13.5,201.5 8.5,196.5" fill="url(#goldRibbon)" />
      <circle cx="14.5" cy="195.5" r="1.2" fill="#c59b34" />
    </g>

    <!-- THEME: classic (navy & gold corner rosettes) -->
    <g class="svg-classic-corners" fill="none" stroke="#c59b27" stroke-width="0.6">
      <rect x="6.5" y="6.5" width="7" height="7" fill="#13294b" stroke="#c59b27" stroke-width="0.55" />
      <polygon points="10,7.8 12.2,10 10,12.2 7.8,10" fill="#c59b27" stroke="none" />

      <rect x="283.5" y="6.5" width="7" height="7" fill="#13294b" stroke="#c59b27" stroke-width="0.55" />
      <polygon points="287,7.8 289.2,10 287,12.2 284.8,10" fill="#c59b27" stroke="none" />

      <rect x="6.5" y="196.5" width="7" height="7" fill="#13294b" stroke="#c59b27" stroke-width="0.55" />
      <polygon points="10,197.8 12.2,200 10,202.2 7.8,200" fill="#c59b27" stroke="none" />

      <rect x="283.5" y="196.5" width="7" height="7" fill="#13294b" stroke="#c59b27" stroke-width="0.55" />
      <polygon points="287,197.8 289.2,200 287,202.2 284.8,200" fill="#c59b27" stroke="none" />
    </g>

    <!-- THEME: green (emerald & gold corner star medallions) -->
    <g class="svg-green-medallions">
      <rect x="5.5" y="5.5" width="7.5" height="7.5" fill="#0d4a33" stroke="#c49a2c" stroke-width="0.55" />
      <polygon points="9.25,6.8 11.7,9.25 9.25,11.7 6.8,9.25" fill="#c49a2c" />

      <rect x="284" y="5.5" width="7.5" height="7.5" fill="#0d4a33" stroke="#c49a2c" stroke-width="0.55" />
      <polygon points="287.75,6.8 290.2,9.25 287.75,11.7 285.3,9.25" fill="#c49a2c" />

      <rect x="5.5" y="197" width="7.5" height="7.5" fill="#0d4a33" stroke="#c49a2c" stroke-width="0.55" />
      <polygon points="9.25,198.3 11.7,200.75 9.25,203.2 6.8,200.75" fill="#c49a2c" />

      <rect x="284" y="197" width="7.5" height="7.5" fill="#0d4a33" stroke="#c49a2c" stroke-width="0.55" />
      <polygon points="287.75,198.3 290.2,200.75 287.75,203.2 285.3,200.75" fill="#c49a2c" />
    </g>

    <!-- THEME: cream (classic sepia/bronze stepped corner flourishes) -->
    <g class="svg-cream-corners" fill="none" stroke="#7c4e20" stroke-width="0.7">
      <path d="M12,16 L12,12 L16,12 M14,12 L14,14 L12,14" />
      <path d="M285,16 L285,12 L281,12 M283,12 L283,14 L285,14" />
      <path d="M12,194 L12,198 L16,198 M14,198 L14,196 L12,196" />
      <path d="M285,194 L285,198 L281,198 M283,198 L283,196 L285,196" />
    </g>
  </svg>`;
}

/**
 * Inline client/Puppeteer autofit script: guarantees no column body ever overflows
 * its allocated A4 height by stepping font-size down to a readable 6.6pt floor,
 * storing exact fit metrics on `window.__certFitResult` for Puppeteer inspection.
 */
function buildAutoFitScript(cspNonce = '') {
  const nonceAttr = cspNonce ? ` nonce="${escapeHtml(cspNonce)}"` : '';
  return `<script${nonceAttr}>
(function () {
  function fitColumns() {
    var result = { shrunkColumns: [], overflowColumns: [] };
    var bodies = document.querySelectorAll('.col-body');
    var MIN_PT = 6.6;
    var STEP_PT = 0.25;

    for (var i = 0; i < bodies.length; i++) {
      var el = bodies[i];
      var col = el.getAttribute('data-col') || String(i);
      var computed = window.getComputedStyle(el);
      var px = parseFloat(computed.fontSize) || 13;
      var pt = px * 0.75;
      var startPt = pt;
      var lhRatio = (parseFloat(computed.lineHeight) || px * 1.7) / px;
      var shrunk = false;

      while (el.scrollHeight > el.clientHeight + 1 && pt > MIN_PT) {
        pt = Math.max(MIN_PT, Math.round((pt - STEP_PT) * 100) / 100);
        lhRatio = Math.max(1.32, lhRatio - 0.015);
        el.style.fontSize = pt + 'pt';
        el.style.lineHeight = String(Math.round(lhRatio * 100) / 100);
        shrunk = true;
      }

      if (shrunk) {
        result.shrunkColumns.push({ col: col, fromPt: Math.round(startPt * 10) / 10, toPt: pt });
      }
      if (el.scrollHeight > el.clientHeight + 2) {
        result.overflowColumns.push(col);
      }
    }

    window.__certFitResult = result;
    return result;
  }

  window.__runCertAutoFit = fitColumns;

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitColumns);
  } else {
    window.addEventListener('load', fitColumns);
  }
})();
</script>`;
}

/**
 * Render the shared A4 landscape trilingual certificate HTML document.
 *
 * @param {object} options
 * @param {string} options.themeKey - One of the 8 theme keys (or custom key; sanitized)
 * @param {object} options.faculty - `{ name: { fa, ps, en } }`
 * @param {{ fa: string, ps: string, en: string }} options.finalText - Trilingual body texts
 * @param {string} [options.serial] - Unique serial number (e.g. `KU-2026-000123`)
 * @param {string} [options.officialNo] - Official number shown at top of Pashto column
 * @param {string} [options.qrDataUrl] - Pre-generated offline QR code data URL
 * @param {object} [options.assets] - Optional `{ universityLogo, ministryLogo, watermarkLogo }` public paths
 * @param {boolean} [options.embedAssets] - Inline local fonts & logos as data URIs (for Puppeteer)
 * @param {boolean} [options.isDraft] - True when previewing an unapproved request without serial
 * @param {string} [options.cspNonce] - Optional CSP nonce for inline `<style>` and `<script>`
 * @returns {{ html: string, themeClass: string, warnings: string[], fit: object }}
 */
function renderCertificateHtml({
  themeKey = 'official',
  faculty = {},
  finalText = { fa: '', ps: '', en: '' },
  serial = '',
  officialNo = '',
  qrDataUrl = '',
  assets = {},
  embedAssets = false,
  isDraft = false,
  cspNonce = '',
  chromeless = false,
  includeScript = true,
}) {
  const safeKey = String(themeKey || 'official')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  const resolvedKey = safeKey || (TEMPLATE_KEYS.includes('official') ? 'official' : 'classic');
  const themeClass = `theme-${resolvedKey}`;

  const baseCss = fs.readFileSync(CSS_PATH, 'utf8');
  const fontFaceCss = buildFontFaceCss(embedAssets);

  const universityLogoSrc = resolveLogoSrc(
    assets.universityLogo,
    'university-logo.png',
    embedAssets
  );
  const ministryLogoSrc = resolveLogoSrc(
    assets.ministryLogo,
    'ministry-logo.png',
    embedAssets
  );
  const watermarkLogoSrc = resolveLogoSrc(
    assets.watermarkLogo || assets.universityLogo,
    'university-logo.png',
    embedAssets
  );

  const facultyEn = faculty?.name?.en || '';
  const facultyFa = faculty?.name?.fa || '';
  const facultyPs = faculty?.name?.ps || '';

  const displaySerial = serial || (isDraft ? 'PREVIEW-DRAFT' : '—');
  const displayOfficialNo = officialNo || '—';

  const fit = analyzeTextFit(finalText);
  const pageClasses = ['certificate-page', themeClass, fit.densityClass]
    .filter(Boolean)
    .join(' ');

  const nonceAttr = cspNonce ? ` nonce="${escapeHtml(cspNonce)}"` : '';
  const warningBannerHtml =
    !embedAssets && fit.warnings.length > 0
      ? `<div class="preview-warning-banner" role="alert">⚠ ${escapeHtml(fit.warnings.join(' '))}</div>`
      : '';

  const qrContentHtml = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="QR ${escapeHtml(displaySerial)}" />`
    : `<span style="font-size:6pt;color:#666;">QR</span>`;

  const htmlClassAttr = chromeless ? ' class="chromeless-root"' : '';
  const bodyClassAttr = chromeless ? ' class="chromeless"' : '';
  const scriptHtml = includeScript ? buildAutoFitScript(cspNonce) : '';

  const html = `<!DOCTYPE html>
<html lang="fa" dir="ltr"${htmlClassAttr}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>تصدیق‌نامه پوهنتون کندز — ${escapeHtml(displaySerial)}</title>
  <style${nonceAttr}>
${fontFaceCss}
${baseCss}
  </style>
</head>
<body${bodyClassAttr}>
  ${warningBannerHtml}
  <article class="${escapeHtml(pageClasses)}" data-theme="${escapeHtml(resolvedKey)}">
    <!-- Background & Theme Frame Layers -->
    <div class="cert-sheet"></div>
    <div class="cert-frame-outer"></div>
    <div class="cert-frame-inner"></div>
    <div class="cert-side-stripe"></div>
    <div class="cert-watermark" aria-hidden="true">
      <img src="${watermarkLogoSrc}" alt="" />
    </div>
    ${buildThemeSvgDecor()}

    <!-- Main Single-Page Certificate Content -->
    <div class="cert-content">
      <!-- Top Emblem Bar (Kunduz University center, Ministry smaller beside it) + Official No on Pashto side -->
      <div class="cert-top-bar">
        <div class="cert-logos">
          <img class="logo-ministry" src="${ministryLogoSrc}" alt="Ministry of Higher Education Logo" />
          <img class="logo-university" src="${universityLogoSrc}" alt="Kunduz University Logo" />
        </div>
        <div class="pashto-official-box" dir="rtl" lang="ps">
          <span class="pashto-official-label">د ثبت ګڼه:</span>
          <span class="pashto-official-value" dir="ltr">${escapeHtml(displayOfficialNo)}</span>
        </div>
      </div>

      <!-- Three-Column Header: English (Left LTR) | Dari (Middle RTL) | Pashto (Right RTL) -->
      <header class="cert-header-grid">
        <div class="hdr-col hdr-col-en" dir="ltr" lang="en">
          <p class="hdr-ministry">Ministry of Higher Education</p>
          <p class="hdr-univ">Kunduz University</p>
          <p class="hdr-office">Vice Chancellor&#39;s Office of Students Affairs</p>
          <p class="hdr-faculty">${escapeHtml(facultyEn)}</p>
        </div>

        <div class="hdr-col hdr-col-fa" dir="rtl" lang="fa">
          <p class="hdr-ministry">وزارت تحصیلات عالی</p>
          <p class="hdr-univ">ریاست پوهنتون کندز</p>
          <p class="hdr-office">معاونیت امور محصلان</p>
          <p class="hdr-faculty">${escapeHtml(facultyFa)}</p>
        </div>

        <div class="hdr-col hdr-col-ps" dir="rtl" lang="ps">
          <p class="hdr-ministry">د لوړو زده کړو وزارت</p>
          <p class="hdr-univ">د کندز پوهنتون</p>
          <p class="hdr-office">د محصلانو د چارو معاونیت</p>
          <p class="hdr-faculty">${escapeHtml(facultyPs)}</p>
        </div>
      </header>

      <!-- Three-Column Titles & Body Text -->
      <section class="cert-body-grid">
        <div class="cert-col cert-col-en" dir="ltr" lang="en">
          <h2 class="col-title">Completion Certificate</h2>
          <div class="col-body" data-col="en">
            ${renderParagraphs(finalText.en)}
          </div>
        </div>

        <div class="cert-col cert-col-fa" dir="rtl" lang="fa">
          <h2 class="col-title">تصدیق‌نامه</h2>
          <div class="col-body" data-col="fa">
            ${renderParagraphs(finalText.fa, { isRtl: true })}
          </div>
        </div>

        <div class="cert-col cert-col-ps" dir="rtl" lang="ps">
          <h2 class="col-title">تاییدلیک</h2>
          <div class="col-body" data-col="ps">
            ${renderParagraphs(finalText.ps, { isRtl: true })}
          </div>
        </div>
      </section>

      <!-- Bottom Signatures, Stamps, QR Code & Serial Number -->
      <footer class="cert-footer">
        <!-- Vice Chancellor of Student Affairs -->
        <div class="sig-block sig-vc">
          <div class="sig-main">
            <div>
              <div class="sig-role-rtl" dir="rtl">
                <span lang="fa">معاون امور محصلان</span>
                <span class="sig-role-sep">/</span>
                <span class="sig-role-ps" lang="ps">د محصلانو د چارو مرستیال</span>
              </div>
              <div class="sig-role-en" dir="ltr" lang="en">Vice Chancellor of Students Affairs</div>
            </div>
            <div class="sig-line-area">
              <div class="sig-line"></div>
              <div class="sig-caption" dir="rtl">محل امضا / Signature</div>
            </div>
          </div>
          <div class="stamp-circle" aria-label="Stamp area">
            <span class="stamp-label-fa" dir="rtl">محل مهر</span>
            <span class="stamp-label-en" dir="ltr">Stamp</span>
          </div>
        </div>

        <!-- QR Code & Unique Serial Number -->
        <div class="qr-block">
          <div class="qr-frame">
            ${qrContentHtml}
          </div>
          <div class="serial-badge" dir="ltr">${escapeHtml(displaySerial)}</div>
          <div class="verify-caption" dir="rtl">کود تأیید اصالت</div>
        </div>

        <!-- Faculty Dean -->
        <div class="sig-block sig-dean">
          <div class="stamp-circle" aria-label="Stamp area">
            <span class="stamp-label-fa" dir="rtl">محل مهر</span>
            <span class="stamp-label-en" dir="ltr">Stamp</span>
          </div>
          <div class="sig-main">
            <div>
              <div class="sig-role-rtl" dir="rtl">
                <span lang="fa">رئیس پوهنځی</span>
                <span class="sig-role-sep">/</span>
                <span class="sig-role-ps" lang="ps">د پوهنځي رئیس</span>
              </div>
              <div class="sig-role-en" dir="ltr" lang="en">Faculty Dean</div>
            </div>
            <div class="sig-line-area">
              <div class="sig-line"></div>
              <div class="sig-caption" dir="rtl">محل امضا / Signature</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </article>
  ${scriptHtml}
</body>
</html>`;

  return {
    html,
    themeKey: resolvedKey,
    themeClass,
    warnings: fit.warnings,
    fit,
  };
}

module.exports = {
  LENGTH_THRESHOLDS,
  analyzeTextFit,
  renderCertificateHtml,
};

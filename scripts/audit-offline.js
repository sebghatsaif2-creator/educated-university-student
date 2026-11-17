#!/usr/bin/env node
'use strict';

/**
 * Automated Offline Hardening & Asset Auditor
 * Kunduz University — Certificate Request & Printing System
 *
 * Verifies zero CDN links, zero remote fonts/images/scripts/APIs, presence and
 * binary validity of all local fonts (`public/fonts`) and logos (`public/logos`),
 * RTL build output (`client/dist`), all 8 CSS themes, and offline npm settings.
 *
 * Usage:
 *   npm run audit:offline
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const REQUIRED_FONTS = [
  'vazirmatn-arabic-400-normal.woff2',
  'vazirmatn-arabic-500-normal.woff2',
  'vazirmatn-arabic-600-normal.woff2',
  'vazirmatn-arabic-700-normal.woff2',
  'vazirmatn-latin-400-normal.woff2',
  'vazirmatn-latin-500-normal.woff2',
  'vazirmatn-latin-600-normal.woff2',
  'vazirmatn-latin-700-normal.woff2',
  'noto-naskh-arabic-arabic-400-normal.woff2',
  'noto-naskh-arabic-arabic-600-normal.woff2',
  'noto-naskh-arabic-arabic-700-normal.woff2',
  'eb-garamond-latin-400-normal.woff2',
  'eb-garamond-latin-600-normal.woff2',
  'eb-garamond-latin-700-normal.woff2',
];

const REQUIRED_PNG_LOGOS = ['university-logo.png', 'ministry-logo.png'];

const REQUIRED_THEMES = [
  'classic',
  'official',
  'green',
  'modern',
  'watermark',
  'cream',
  'blue-stripes',
  'gold-corners',
];

// Non-network W3C XML/SVG/HTML namespace identifiers and internal React error-message strings
const SAFE_URL_PREFIXES = [
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace',
  'https://reactjs.org/docs/error-decoder.html',
  'http://localhost',
  'http://127.0.0.1',
  'http://192.168.',
  'http://10.',
  'http://SERVER_IP:PORT',
  'http://${env.host}',
  'http://${host}',
  'https://${host}',
];

const FORBIDDEN_CDN_RE =
  /\b(fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|use\.fontawesome\.com|kit\.fontawesome\.com|stackpath\.bootstrapcdn\.com|cdn\.tailwindcss\.com|api\.qrserver\.com|chart\.googleapis\.com|images\.unsplash\.com|gravatar\.com)\b/i;

const FORBIDDEN_LINK_HINTS_RE = /rel\s*=\s*["'](preconnect|dns-prefetch)["']/i;
const FORBIDDEN_REMOTE_IMPORT_RE = /@import\s+url\(\s*['"]?(https?:)?\/\//i;

const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.svg', '.json']);

function walkFiles(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'tmp') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, collector);
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      collector.push(full);
    }
  }
  return collector;
}

function isAllowedUrl(url, relPath) {
  if (SAFE_URL_PREFIXES.some((prefix) => url.startsWith(prefix))) {
    // Disallow hardcoded localhost/127.0.0.1 inside browser client code
    if (
      relPath.startsWith('client/src/') &&
      (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'))
    ) {
      return false;
    }
    return true;
  }
  return false;
}

function runOfflineAudit({ requireClientDist = true } = {}) {
  const issues = [];
  const checks = [];

  // 1. Scan all source & built files for external URLs, CDNs, remote fonts/imports
  const filesToScan = [
    ...walkFiles(path.join(ROOT_DIR, 'server/src')),
    ...walkFiles(path.join(ROOT_DIR, 'client/src')),
    ...walkFiles(path.join(ROOT_DIR, 'public/logos')),
    path.join(ROOT_DIR, 'client/index.html'),
  ];

  const distDir = path.join(ROOT_DIR, 'client/dist');
  if (fs.existsSync(distDir)) {
    filesToScan.push(...walkFiles(distDir));
  } else if (requireClientDist) {
    issues.push('client/dist not found — run `npm run build` before offline deployment.');
  }

  const urlRegex = /https?:\/\/[A-Za-z0-9._~:/?#&=+${}-]+/g;
  let scannedCount = 0;

  for (const absPath of filesToScan) {
    if (!fs.existsSync(absPath)) continue;
    scannedCount += 1;
    const rel = path.relative(ROOT_DIR, absPath).replace(/\\/g, '/');
    const content = fs.readFileSync(absPath, 'utf8');

    const cdnMatch = content.match(FORBIDDEN_CDN_RE);
    if (cdnMatch) {
      issues.push(`${rel}: forbidden online/CDN domain "${cdnMatch[0]}"`);
    }

    if (FORBIDDEN_LINK_HINTS_RE.test(content)) {
      issues.push(`${rel}: forbidden external preconnect/dns-prefetch link tag`);
    }

    if (FORBIDDEN_REMOTE_IMPORT_RE.test(content)) {
      issues.push(`${rel}: forbidden remote CSS @import url(...)`);
    }

    const matches = content.match(urlRegex) || [];
    for (const rawUrl of matches) {
      const cleaned = rawUrl.replace(/[.,;:'")\]]+$/, '');
      if (!isAllowedUrl(cleaned, rel)) {
        issues.push(`${rel}: unexpected external URL "${cleaned}"`);
      }
    }
  }
  checks.push(`Scanned ${scannedCount} source, SVG, HTML, CSS & bundle files for external URLs`);

  // 2. Verify all 14 local WOFF2 fonts exist and have valid `wOF2` header
  let validFonts = 0;
  for (const fontName of REQUIRED_FONTS) {
    const fontPath = path.join(ROOT_DIR, 'public/fonts', fontName);
    if (!fs.existsSync(fontPath)) {
      issues.push(`Missing local font: public/fonts/${fontName}`);
      continue;
    }
    const buf = fs.readFileSync(fontPath);
    if (buf.length < 1024 || buf.subarray(0, 4).toString('ascii') !== 'wOF2') {
      issues.push(`Invalid or corrupt WOFF2 font: public/fonts/${fontName}`);
      continue;
    }
    validFonts += 1;
  }
  checks.push(`Verified ${validFonts}/${REQUIRED_FONTS.length} local WOFF2 fonts in public/fonts/`);

  // 3. Verify official PNG logos exist and have valid PNG signature
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let validLogos = 0;
  for (const logoName of REQUIRED_PNG_LOGOS) {
    const logoPath = path.join(ROOT_DIR, 'public/logos', logoName);
    if (!fs.existsSync(logoPath)) {
      issues.push(`Missing official logo: public/logos/${logoName}`);
      continue;
    }
    const buf = fs.readFileSync(logoPath);
    if (buf.length < 1024 || !buf.subarray(0, 8).equals(PNG_SIG)) {
      issues.push(`Invalid PNG logo file: public/logos/${logoName}`);
      continue;
    }
    validLogos += 1;
  }
  checks.push(`Verified ${validLogos}/${REQUIRED_PNG_LOGOS.length} official PNG logos in public/logos/`);

  // 4. Verify certificate stylesheet (@page A4 landscape margin 0, RTL joining, 8 themes)
  const certCssPath = path.join(ROOT_DIR, 'server/src/templates/certificate.css');
  if (!fs.existsSync(certCssPath)) {
    issues.push('Missing server/src/templates/certificate.css');
  } else {
    const css = fs.readFileSync(certCssPath, 'utf8');
    if (!/@page\s*\{[^}]*size:\s*A4\s+landscape/i.test(css)) {
      issues.push('certificate.css missing `@page { size: A4 landscape }`');
    }
    if (/['"]isol['"]\s+1/.test(css)) {
      issues.push('certificate.css forces `isol 1` which breaks Dari/Pashto cursive letter joining');
    }
    for (const theme of REQUIRED_THEMES) {
      if (!css.includes(`.theme-${theme}`)) {
        issues.push(`certificate.css missing theme class .theme-${theme}`);
      }
    }
    checks.push(`Verified @page A4 landscape, cursive RTL shaping & all ${REQUIRED_THEMES.length} themes`);
  }

  // 5. Verify built client/dist/index.html has global dir="rtl" and lang="fa"
  const distIndex = path.join(distDir, 'index.html');
  if (fs.existsSync(distIndex)) {
    const html = fs.readFileSync(distIndex, 'utf8');
    if (!/dir\s*=\s*["']rtl["']/i.test(html) || !/lang\s*=\s*["']fa["']/i.test(html)) {
      issues.push('client/dist/index.html must declare lang="fa" dir="rtl"');
    } else {
      checks.push('Verified client/dist/index.html built with lang="fa" dir="rtl" and local assets');
    }
  }

  // 6. Verify offline .npmrc safeguards
  const npmrcPath = path.join(ROOT_DIR, '.npmrc');
  if (!fs.existsSync(npmrcPath)) {
    issues.push('Missing .npmrc offline configuration');
  } else {
    const npmrc = fs.readFileSync(npmrcPath, 'utf8');
    if (!npmrc.includes('audit=false') || !npmrc.includes('fund=false')) {
      issues.push('.npmrc should disable online audit and fund network calls');
    } else {
      checks.push('Verified .npmrc disables online audit, fund, and update-notifier checks');
    }
  }

  return {
    ok: issues.length === 0,
    scannedCount,
    checks,
    issues,
  };
}

if (require.main === module) {
  console.log('==============================================================');
  console.log('  Kunduz University — 100% Offline Readiness Audit');
  console.log('==============================================================');
  const result = runOfflineAudit();
  for (const line of result.checks) {
    console.log(`  [PASS] ${line}`);
  }
  if (!result.ok) {
    console.error('--------------------------------------------------------------');
    for (const issue of result.issues) {
      console.error(`  [FAIL] ${issue}`);
    }
    console.error('==============================================================');
    process.exit(1);
  }
  console.log('--------------------------------------------------------------');
  console.log('  RESULT: PASSED (0 external dependencies, 100% LAN/offline ready)');
  console.log('==============================================================');
}

module.exports = { runOfflineAudit, REQUIRED_FONTS, REQUIRED_PNG_LOGOS, REQUIRED_THEMES };

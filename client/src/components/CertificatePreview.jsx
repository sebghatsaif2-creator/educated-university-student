import React, { useCallback, useEffect, useRef, useState } from 'react';
import { evaluateClientTextFit } from '../utils/format';

// Exact A4 landscape dimensions in CSS pixels at 96 DPI (297mm × 210mm)
const SHEET_WIDTH = 1123;
const SHEET_HEIGHT = 794;

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildParagraphHtml(text, isRtl) {
  const lines = String(text || '')
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return '<p></p>';

  return lines
    .map((line) => {
      let safe = escapeHtml(line);
      if (isRtl) {
        safe = safe.replace(
          /\(([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+)\)|\b([A-Za-z0-9]+(?:[-/][A-Za-z0-9]+)+)\b/g,
          (_m, parenCode, bareCode) =>
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
 * Run single-page column auto-shrink directly against the same-origin preview iframe DOM
 * (mirrors `window.__runCertAutoFit` used in Puppeteer without requiring inline scripts).
 */
function runDocumentAutoFit(doc) {
  if (!doc) return { shrunk: false, overflow: false };
  const bodies = doc.querySelectorAll('.col-body');
  let shrunk = false;
  let overflow = false;

  bodies.forEach((el) => {
    el.style.fontSize = '';
    el.style.lineHeight = '';

    const win = doc.defaultView;
    if (!win) return;
    const computed = win.getComputedStyle(el);
    let sizePx = parseFloat(computed.fontSize) || 13;
    const startPx = sizePx;
    const isRtl = el.closest('[dir="rtl"]') !== null;
    const minPx = 8.4;
    let lineRatio = isRtl ? 1.88 : 1.56;

    let guard = 0;
    while (el.scrollHeight > el.clientHeight + 2 && sizePx > minPx && guard < 40) {
      sizePx = Math.max(minPx, sizePx - 0.35);
      lineRatio = Math.max(isRtl ? 1.5 : 1.3, lineRatio - 0.015);
      el.style.fontSize = `${sizePx.toFixed(2)}px`;
      el.style.lineHeight = lineRatio.toFixed(2);
      guard += 1;
    }

    if (sizePx < startPx - 0.2) shrunk = true;
    if (el.scrollHeight > el.clientHeight + 3) overflow = true;
  });

  return { shrunk, overflow };
}

/**
 * Responsive scaled A4 landscape live certificate preview.
 * Works both as compact cards in the 8-template picker and as a full-size live editor canvas.
 */
export default function CertificatePreview({
  html,
  loading = false,
  error = '',
  liveText = null,
  liveThemeKey = '',
  title = 'پیش‌نمایش تصدیق‌نامه',
  interactive = false,
  onFitChange = null,
}) {
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const [scale, setScale] = useState(0.32);
  const [frameReady, setFrameReady] = useState(false);

  // Measure wrapper width and compute exact scale factor for 1123x794 sheet
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const updateScale = () => {
      const width = el.clientWidth || 360;
      setScale(width / SHEET_WIDTH);
    };

    updateScale();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateScale);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // Reset ready flag whenever source HTML is replaced
  useEffect(() => {
    setFrameReady(false);
  }, [html]);

  // Apply live text edits, theme class swaps, density tiers & DOM auto-shrink in place
  const syncLiveDom = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    const pageEl = doc.querySelector('.certificate-page');
    if (!pageEl) return;

    if (liveThemeKey) {
      const safeKey = String(liveThemeKey).toLowerCase().replace(/[^a-z0-9-]/g, '');
      Array.from(pageEl.classList).forEach((cls) => {
        if (cls.startsWith('theme-')) pageEl.classList.remove(cls);
      });
      if (safeKey) {
        pageEl.classList.add(`theme-${safeKey}`);
        pageEl.setAttribute('data-theme', safeKey);
      }
    }

    let warning = '';
    if (liveText) {
      const enEl = doc.querySelector('[data-col="en"]');
      const faEl = doc.querySelector('[data-col="fa"]');
      const psEl = doc.querySelector('[data-col="ps"]');
      if (enEl) enEl.innerHTML = buildParagraphHtml(liveText.en, false);
      if (faEl) faEl.innerHTML = buildParagraphHtml(liveText.fa, true);
      if (psEl) psEl.innerHTML = buildParagraphHtml(liveText.ps, true);

      const fit = evaluateClientTextFit(liveText);
      pageEl.classList.remove('density-compact', 'density-dense', 'density-ultra');
      if (fit.densityClass) {
        pageEl.classList.add(fit.densityClass);
      }
      warning = fit.warning;
    }

    const domFit = runDocumentAutoFit(doc);
    if (domFit.overflow) {
      warning =
        'هشدار: متن یکی از ستون‌ها بیش از ظرفیت یک صفحه A4 افقی است؛ لطفاً متن را کوتاه‌تر نمایید.';
    } else if (!warning && domFit.shrunk) {
      warning =
        'اندازه فونت به‌صورت خودکار کوچک شد تا تمام متن در یک صفحه A4 افقی جای گیرد.';
    }

    onFitChange?.({ warning, ...domFit });
  }, [liveText, liveThemeKey, onFitChange]);

  useEffect(() => {
    if (frameReady) {
      syncLiveDom();
    }
  }, [frameReady, syncLiveDom]);

  const handleLoad = () => {
    const doc = iframeRef.current?.contentDocument;
    setFrameReady(true);
    syncLiveDom();
    if (doc?.fonts?.ready) {
      doc.fonts.ready.then(() => syncLiveDom()).catch(() => {});
    }
  };

  const scaledHeight = Math.round(SHEET_HEIGHT * scale);

  return (
    <div
      ref={containerRef}
      className="cert-preview-viewport"
      dir="ltr"
      style={{ height: `${scaledHeight}px` }}
    >
      {html && (
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          onLoad={handleLoad}
          className="cert-preview-iframe"
          tabIndex={interactive ? 0 : -1}
          style={{
            width: `${SHEET_WIDTH}px`,
            height: `${SHEET_HEIGHT}px`,
            transform: `scale(${scale})`,
            pointerEvents: interactive ? 'auto' : 'none',
            opacity: frameReady ? 1 : 0,
          }}
        />
      )}

      {(loading || (!frameReady && html && !error)) && (
        <div className="cert-preview-overlay" dir="rtl">
          <div className="spinner spinner-sm" />
          <span>در حال آماده‌سازی پیش‌نمایش...</span>
        </div>
      )}

      {error && !loading && (
        <div className="cert-preview-overlay cert-preview-error" dir="rtl">
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

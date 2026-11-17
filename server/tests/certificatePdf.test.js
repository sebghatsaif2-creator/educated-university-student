'use strict';

// Ensure tests run against an isolated database, never production/dev DB
process.env.NODE_ENV = 'test';
process.env.LAN_BASE_URL = 'http://192.168.1.10:5000';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const app = require('../src/app');
const { seed } = require('../src/seed/seed');
const {
  User,
  Faculty,
  Department,
  Template,
  Request,
  PrintLog,
  Asset,
  Counter,
} = require('../src/models');
const { TEMPLATE_KEYS } = require('../src/models/Template');
const {
  renderCertificateHtml,
  analyzeTextFit,
} = require('../src/templates/certificateTemplate');
const {
  buildVerifyUrl,
  generateQrDataUrl,
  closeBrowser,
} = require('../src/services/pdfService');

function buildTestDbUri(baseUri) {
  const url = new URL(baseUri);
  const dbName = (url.pathname.replace(/^\//, '') || 'kunduz_certificates') + '_test';
  url.pathname = `/${dbName}`;
  return url.toString();
}

async function clearTestCollections() {
  await Promise.all([
    PrintLog.deleteMany({}),
    Request.deleteMany({}),
    Department.deleteMany({}),
    Faculty.deleteMany({}),
    Template.deleteMany({}),
    Asset.deleteMany({}),
    Counter.deleteMany({}),
    User.deleteMany({}),
  ]);
}

function countPdfPages(buf) {
  const latin1 = buf.toString('latin1');
  return (latin1.match(/\/Type\s*\/Page\b/g) || []).length;
}

function getPdfMediaBox(buf) {
  const latin1 = buf.toString('latin1');
  const match = latin1.match(/\/MediaBox\s*\[\s*([^\]]+)\]/);
  if (!match) return null;
  return match[1].trim().split(/\s+/).map(Number);
}

describe('Certificate template, QR, preview & Puppeteer PDF (Stage 3)', () => {
  let officerToken;
  let pendingReq;
  let approvedReq;
  let rejectedReq;

  before(async () => {
    await connectDB(buildTestDbUri(env.mongodbUri));
    await seed({ reset: true, silent: true });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seed.officerUsername, password: env.seed.officerPassword });
    assert.equal(loginRes.status, 200);
    officerToken = loginRes.body.data.token;

    pendingReq = await Request.findOne({ trackingCode: 'KU-1405-TST001' });
    approvedReq = await Request.findOne({ trackingCode: 'KU-1405-TST002' });
    rejectedReq = await Request.findOne({ trackingCode: 'KU-1405-TST005' });
  });

  after(async () => {
    await closeBrowser();
    await clearTestCollections();
    await disconnectDB();
  });

  it('renders shared trilingual HTML across all 8 theme-<key> themes with 100% offline local fonts & logos', async () => {
    const verifyUrl = buildVerifyUrl('KU-2026-000099');
    assert.equal(verifyUrl, 'http://192.168.1.10:5000/verify/KU-2026-000099');

    const qrDataUrl = await generateQrDataUrl(verifyUrl);
    assert.match(qrDataUrl, /^data:image\/png;base64,/);

    for (const key of TEMPLATE_KEYS) {
      const rendered = renderCertificateHtml({
        themeKey: key,
        faculty: {
          name: {
            en: 'Faculty of Computer Science',
            fa: 'پوهنځی کمپیوتر ساینس',
            ps: 'د کمپیوټر ساینس پوهنځی',
          },
        },
        finalText: {
          en: 'This is to certify that Mr. Ahmad completed his studies.',
          fa: 'بدین‌وسیله تصدیق می‌گردد که محترم احمد دارنده تذکره (1400-0201-45821) فارغ گردید.',
          ps: 'په دې توګه تصدیق کېږي چې ښاغلي احمد د (1400-0201-45821) تذکرې لرونکی فارغ شو.',
        },
        serial: 'KU-2026-000099',
        officialNo: '1405/CS/0099',
        qrDataUrl,
        embedAssets: false,
      });

      assert.equal(rendered.themeClass, `theme-${key}`);
      assert.ok(rendered.html.includes(`class="certificate-page theme-${key}"`));

      // Required trilingual headers
      assert.ok(rendered.html.includes('Ministry of Higher Education'));
      assert.ok(rendered.html.includes('Kunduz University'));
      assert.ok(rendered.html.includes('Vice Chancellor&#39;s Office of Students Affairs'));
      assert.ok(rendered.html.includes('وزارت تحصیلات عالی'));
      assert.ok(rendered.html.includes('ریاست پوهنتون کندز'));
      assert.ok(rendered.html.includes('معاونیت امور محصلان'));
      assert.ok(rendered.html.includes('د لوړو زده کړو وزارت'));
      assert.ok(rendered.html.includes('د کندز پوهنتون'));
      assert.ok(rendered.html.includes('د محصلانو د چارو معاونیت'));

      // Required column titles, Pashto official number, signatures, serial, fonts & logos
      assert.ok(rendered.html.includes('د ثبت ګڼه:'));
      assert.ok(rendered.html.includes('1405/CS/0099'));
      assert.ok(rendered.html.includes('Completion Certificate'));
      assert.ok(rendered.html.includes('تصدیق‌نامه'));
      assert.ok(rendered.html.includes('تاییدلیک'));
      assert.ok(rendered.html.includes('Vice Chancellor of Students Affairs'));
      assert.ok(rendered.html.includes('Faculty Dean'));
      assert.ok(rendered.html.includes('KU-2026-000099'));
      assert.ok(rendered.html.includes('Vazirmatn'));
      assert.ok(rendered.html.includes('Noto Naskh Arabic'));
      assert.ok(rendered.html.includes('/public/logos/university-logo.png'));
      assert.ok(rendered.html.includes('/public/logos/ministry-logo.png'));

      // BiDi isolation for parenthesized national IDs in RTL text
      assert.ok(
        rendered.html.includes('<span class="ltr-token" dir="ltr">(1400-0201-45821)</span>')
      );

      // Zero external CDN / online URLs (only W3C SVG xmlns namespace strings allowed)
      const withoutSvgNs = rendered.html.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '');
      assert.equal(
        /https?:\/\//i.test(withoutSvgNs),
        false,
        `Unexpected external URL found in theme-${key}`
      );
    }
  });

  it('serves live HTML preview on GET /api/requests/:id/preview and supports all 8 themes', async () => {
    // Unauthenticated rejected
    const unauthRes = await request(app).get(`/api/requests/${approvedReq._id}/preview`);
    assert.equal(unauthRes.status, 401);

    // Rejected request blocked
    const rejRes = await request(app)
      .get(`/api/requests/${rejectedReq._id}/preview`)
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(rejRes.status, 409);

    // Pending request renders draft watermark preview
    const draftRes = await request(app)
      .get(`/api/requests/${pendingReq._id}/preview`)
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(draftRes.status, 200);
    assert.match(draftRes.headers['content-type'], /text\/html/);
    assert.ok(draftRes.text.includes('PREVIEW-DRAFT'));

    // Approved request previews cleanly with ?template=<key> override across all 8 themes
    for (const key of TEMPLATE_KEYS) {
      const res = await request(app)
        .get(`/api/requests/${approvedReq._id}/preview`)
        .query({ template: key })
        .set('Authorization', `Bearer ${officerToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.headers['x-certificate-theme'], key);
      assert.ok(res.text.includes(`theme-${key}`));
      assert.ok(res.text.includes(approvedReq.serial));
    }
  });

  it('generates a single-page A4 landscape PDF on POST /api/requests/:id/pdf and writes printLogs', async () => {
    // Pending requests cannot be printed to PDF
    const pendingPdf = await request(app)
      .post(`/api/requests/${pendingReq._id}/pdf`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({});
    assert.equal(pendingPdf.status, 409);

    const logsBefore = await PrintLog.countDocuments({ requestId: approvedReq._id });
    assert.equal(logsBefore, 0);

    // First official PDF generation
    const pdfRes = await request(app)
      .post(`/api/requests/${approvedReq._id}/pdf`)
      .set('Authorization', `Bearer ${officerToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ templateKey: 'blue-stripes' });

    assert.equal(pdfRes.status, 200);
    assert.match(pdfRes.headers['content-type'], /application\/pdf/);
    assert.equal(pdfRes.headers['x-certificate-serial'], approvedReq.serial);
    assert.equal(pdfRes.headers['x-certificate-theme'], 'blue-stripes');
    assert.equal(pdfRes.headers['x-is-reprint'], 'false');
    assert.ok(pdfRes.headers['x-print-log-id']);

    // Verify valid single-page A4 landscape PDF binary (297mm x 210mm ≈ 841.9pt x 595pt)
    assert.equal(pdfRes.body.subarray(0, 5).toString('ascii'), '%PDF-');
    assert.equal(countPdfPages(pdfRes.body), 1);
    const box = getPdfMediaBox(pdfRes.body);
    assert.ok(box, 'PDF MediaBox should exist');
    assert.ok(box[2] > 835 && box[2] < 848, `Expected A4 landscape width ~842pt, got ${box[2]}`);
    assert.ok(box[3] > 590 && box[3] < 600, `Expected A4 landscape height ~595pt, got ${box[3]}`);

    // Confirm Request status moved to `printed` and printLog recorded
    const updatedReq = await Request.findById(approvedReq._id);
    assert.equal(updatedReq.status, 'printed');
    assert.ok(updatedReq.printedAt);

    // Second PDF generation -> recorded as reprint in printLogs
    const reprintRes = await request(app)
      .post(`/api/requests/${approvedReq._id}/pdf`)
      .set('Authorization', `Bearer ${officerToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({
        templateKey: 'gold-corners',
        reprintReason: 'چاپ مجدد با قالب گوشه‌های طلایی',
      });

    assert.equal(reprintRes.status, 200);
    assert.equal(reprintRes.headers['x-certificate-theme'], 'gold-corners');
    assert.equal(reprintRes.headers['x-is-reprint'], 'true');
    assert.equal(countPdfPages(reprintRes.body), 1);

    const logs = await PrintLog.find({ requestId: approvedReq._id }).sort({ printedAt: 1 });
    assert.equal(logs.length, 2);
    assert.equal(logs[0].isReprint, false);
    assert.equal(logs[1].isReprint, true);
    assert.equal(logs[1].reprintReason, 'چاپ مجدد با قالب گوشه‌های طلایی');
  });

  it('auto-shrinks long certificate text onto 1 A4 page and emits a Dari length warning', async () => {
    const otherApproved = await Request.findOne({ trackingCode: 'KU-1405-TST006' });
    const longFinalText = {
      en: `${otherApproved.finalText.en} Additionally, throughout her four-year undergraduate curriculum she successfully completed all compulsory laboratory courses, teaching practicums, research seminars, and her final senior capstone thesis defense with high academic distinction and exemplary conduct, earning formal commendation from the Department Academic Council and the Faculty Examination Committee of Kunduz University. Authenticity may be verified via the QR code and serial number below.`,
      fa: `${otherApproved.finalText.fa} همچنان موصوفه در جریان چهار سال دوره تحصیلی لیسانس خویش تمام مضامین حتمی، کریدیت‌های عملی و لابراتواری، سیمینارهای علمی و دفاع مونوگراف پایان‌نامه تحصیلی خویش را با نمره عالی، اخلاق نیکو و پابندی کامل به لوایح و مقررات اکادمیک وزارت تحصیلات عالی موفقانه سپری نموده و مورد تأیید شورای علمی دیپارتمنت و کمیته امتحانات پوهنځی قرار گرفته است. اصالت این سند از طریق کود QR و شماره سریال قابل تأیید می‌باشد.`,
      ps: `${otherApproved.finalText.ps} همدارنګه نوموړې د خپلې څلور کلنې تحصیلي دورې په ترڅ کې ټول حتمي نظري او عملي لابراتواري مضامین، علمي سیمینارونه او د فراغت مونوګراف دفاع په لوړو نمرو، غوره اخلاقو او د لوړو زده کړو وزارت د اکاډمیکو مقرراتو له مخې په بریالیتوب سره بشپړ کړي او د څانګې د علمي شورا او د پوهنځي د ازموینو کمېټې له خوا تایید شوې ده. د دې سند رښتینولي د سریال نمبر او کیو آر کوډ له لارې تاییدېدای شي.`,
    };

    const fit = analyzeTextFit(longFinalText);
    assert.ok(fit.densityClass.length > 0);
    assert.ok(fit.warnings.length > 0);

    const editRes = await request(app)
      .patch(`/api/requests/${otherApproved._id}/final-text`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ finalText: longFinalText });
    assert.equal(editRes.status, 200);

    const pdfRes = await request(app)
      .post(`/api/requests/${otherApproved._id}/pdf`)
      .set('Authorization', `Bearer ${officerToken}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .send({ templateKey: 'classic', reprintReason: '' });

    assert.equal(pdfRes.status, 200);
    assert.equal(countPdfPages(pdfRes.body), 1);
    assert.equal(pdfRes.headers['x-certificate-has-warning'], 'true');
    const decodedWarning = decodeURIComponent(pdfRes.headers['x-certificate-warning']);
    assert.ok(decodedWarning.includes('صفحه A4'));
  });
});

'use strict';

process.env.NODE_ENV = 'test';
process.env.LAN_BASE_URL = 'http://192.168.1.10:5000';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const dns = require('dns');
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
  prepareCertificateRender,
  buildVerifyUrl,
  getBrowser,
  closeBrowser,
} = require('../src/services/pdfService');
const { runOfflineAudit } = require('../../scripts/audit-offline');
const { runBackup, pruneOldBackups } = require('../../scripts/backup-db');

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '::1', 'localhost', '::ffff:127.0.0.1']);

function buildTestDbUri(baseUri) {
  const url = new URL(baseUri);
  const dbName = `${url.pathname.replace(/^\//, '') || 'kunduz_certificates'}_test`;
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

/**
 * Install an in-process network kill-switch that blocks any non-loopback TCP connection
 * or external DNS lookup, simulating a completely disconnected LAN host.
 */
function installExternalNetworkBlocker() {
  const blocked = [];
  const origConnect = net.Socket.prototype.connect;
  const origLookup = dns.lookup;

  net.Socket.prototype.connect = function patchedConnect(...args) {
    const first = args[0];
    let host = '';
    if (first && typeof first === 'object' && !Array.isArray(first)) {
      if (first.path) {
        // Unix domain socket (local IPC)
        return origConnect.apply(this, args);
      }
      host = first.host || '127.0.0.1';
    } else if (typeof args[1] === 'string' && !net.isIP(args[1]) && Number.isInteger(first)) {
      host = args[1];
    } else if (typeof args[1] === 'string') {
      host = args[1];
    } else {
      host = '127.0.0.1';
    }

    if (!LOOPBACK_HOSTS.has(String(host).toLowerCase())) {
      blocked.push(`tcp:${host}`);
      const err = new Error(`OFFLINE_MODE_BLOCKED: outbound connection to ${host}`);
      err.code = 'ENETUNREACH';
      process.nextTick(() => this.emit('error', err));
      return this;
    }
    return origConnect.apply(this, args);
  };

  dns.lookup = function patchedLookup(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const lower = String(hostname || '').toLowerCase();
    if (!LOOPBACK_HOSTS.has(lower)) {
      blocked.push(`dns:${hostname}`);
      const err = new Error(`OFFLINE_MODE_BLOCKED: DNS lookup for ${hostname}`);
      err.code = 'ENOTFOUND';
      return process.nextTick(() => cb(err));
    }
    return origLookup.call(dns, hostname, options, callback);
  };

  return {
    blocked,
    restore() {
      net.Socket.prototype.connect = origConnect;
      dns.lookup = origLookup;
    },
  };
}

function parseBinaryResponse(res, cb) {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
}

function inspectPdfBuffer(buf) {
  const raw = buf.toString('latin1');
  const pages = (raw.match(/\/Type\s*\/Page\b/g) || []).length;
  const boxMatch = raw.match(/\/MediaBox\s*\[\s*([^\]]+)\]/);
  const mediaBox = boxMatch ? boxMatch[1].trim().split(/\s+/).map(Number) : null;
  const imageCount = (raw.match(/\/Subtype\s*\/Image\b/g) || []).length;
  const hasVazirmatn = /Vazirmatn/i.test(raw);
  const hasNotoNaskh = /NotoNaskhArabic/i.test(raw);
  const hasGaramond = /EBGaramond/i.test(raw);
  return {
    header: buf.subarray(0, 5).toString('ascii'),
    pages,
    mediaBox,
    imageCount,
    hasVazirmatn,
    hasNotoNaskh,
    hasGaramond,
  };
}

describe('Stage 5 — Offline Hardening, Full Core Flow (All 8 Themes) & Backup Retention', () => {
  let netGuard;
  let officerToken;

  before(async () => {
    await connectDB(buildTestDbUri(env.mongodbUri));
    await seed({ reset: true, silent: true });
    netGuard = installExternalNetworkBlocker();

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: env.seed.officerUsername, password: env.seed.officerPassword });
    assert.equal(loginRes.status, 200);
    officerToken = loginRes.body.data.token;
  });

  after(async () => {
    if (netGuard) netGuard.restore();
    await closeBrowser();
    await clearTestCollections();
    await disconnectDB();
  });

  it('passes static offline audit (zero CDNs/external URLs, valid local fonts, logos & RTL dist)', () => {
    const audit = runOfflineAudit({ requireClientDist: true });
    assert.equal(
      audit.ok,
      true,
      `Offline audit failed:\n${audit.issues.join('\n')}`
    );
  });

  it('executes full offline flow with external network blocked: submit -> approve -> all 8 themes -> edit -> PDF + QR', async () => {
    // 1. Public dependent faculty -> department lookup
    const facRes = await request(app).get('/api/faculties');
    assert.equal(facRes.status, 200);
    const csFac = facRes.body.data.faculties.find((f) => f.code === 'CS');
    assert.ok(csFac);

    const deptRes = await request(app).get('/api/departments').query({ faculty: csFac._id });
    assert.equal(deptRes.status, 200);
    const dept = deptRes.body.data.departments[0];
    assert.ok(dept);

    // 2. Submit new certificate request (Applicant)
    const submitRes = await request(app)
      .post('/api/requests')
      .send({
        firstName: 'نرگس',
        fatherName: 'محمد هارون',
        firstNameI18n: { fa: 'نرگس', ps: 'نرګس', en: 'Nargis' },
        fatherNameI18n: { fa: 'محمد هارون', ps: 'محمد هارون', en: 'Mohammad Haroon' },
        gender: 'female',
        nationalId: '1401-0611-33490',
        phone: '0700987654',
        facultyId: csFac._id,
        departmentId: dept._id,
        degreeLevel: 'bachelor',
        gradYearSH: 1404,
        gradYearAD: 2025,
      });
    assert.equal(submitRes.status, 201);
    const { trackingCode } = submitRes.body.data;
    const reqId = submitRes.body.data.request._id;
    assert.match(trackingCode, /^KU-\d{4}-[A-Z0-9]{6}$/);

    // 3. Track status before approval
    const trackPending = await request(app).get(`/api/requests/track/${trackingCode}`);
    assert.equal(trackPending.status, 200);
    assert.equal(trackPending.body.data.request.status, 'pending');

    // 4. Approve request (Officer)
    const approveRes = await request(app)
      .patch(`/api/requests/${reqId}/approve`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({ officialNo: '1405/CS/0888' });
    assert.equal(approveRes.status, 200);
    const approved = approveRes.body.data.request;
    assert.match(approved.serial, /^KU-\d{4}-\d{6}$/);
    assert.equal(approved.officialNo, '1405/CS/0888');
    assert.ok(approved.finalText.fa.includes('محترمه'));
    assert.ok(approved.finalText.ps.includes('ځلانده'));
    assert.ok(approved.finalText.en.includes('Ms.'));

    // 5. Pick EACH of the 8 themes, verify sample + request preview, and generate 1-page A4 landscape PDF
    const tplRes = await request(app)
      .get('/api/templates')
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(tplRes.status, 200);
    const tplMap = new Map(tplRes.body.data.templates.map((t) => [t.key, t]));
    assert.equal(TEMPLATE_KEYS.length, 8);

    for (const key of TEMPLATE_KEYS) {
      const tpl = tplMap.get(key);
      assert.ok(tpl, `Missing seeded template "${key}"`);

      // Template picker live sample preview
      const sampleRes = await request(app)
        .get(`/api/templates/${tpl._id}/preview`)
        .query({ gender: 'female', chromeless: 'true' })
        .set('Authorization', `Bearer ${officerToken}`);
      assert.equal(sampleRes.status, 200);
      assert.ok(sampleRes.text.includes(`theme-${key}`));

      // Assign theme to request
      const setTplRes = await request(app)
        .patch(`/api/requests/${reqId}/template`)
        .set('Authorization', `Bearer ${officerToken}`)
        .send({ templateId: tpl._id });
      assert.equal(setTplRes.status, 200);

      // Generate PDF for this theme
      const pdfRes = await request(app)
        .post(`/api/requests/${reqId}/pdf`)
        .set('Authorization', `Bearer ${officerToken}`)
        .buffer(true)
        .parse(parseBinaryResponse)
        .send({ reprintReason: `آزمایش آفلاین قالب ${key}` });
      assert.equal(pdfRes.status, 200);
      assert.equal(pdfRes.headers['x-certificate-theme'], key);

      const meta = inspectPdfBuffer(pdfRes.body);
      assert.equal(meta.header, '%PDF-');
      assert.equal(meta.pages, 1, `Expected 1 page for theme-${key}, got ${meta.pages}`);
      assert.ok(meta.mediaBox[2] > 838 && meta.mediaBox[2] < 846, 'A4 landscape width ~841.9pt');
      assert.ok(meta.mediaBox[3] > 591 && meta.mediaBox[3] < 599, 'A4 landscape height ~595.0pt');
      assert.equal(meta.hasVazirmatn, true, `Vazirmatn font must be embedded in theme-${key}`);
      assert.equal(meta.hasNotoNaskh, true, `Noto Naskh Arabic font must be embedded in theme-${key}`);
      assert.equal(meta.hasGaramond, true, `EB Garamond font must be embedded in theme-${key}`);
      assert.ok(meta.imageCount >= 3, `KU logo, MoHE logo & QR must embed in theme-${key}`);
    }

    // 6. Edit text in all 3 languages -> reset to default -> edit again -> generate final PDF with QR
    const editRes = await request(app)
      .patch(`/api/requests/${reqId}/final-text`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        finalText: {
          fa: `${approved.finalText.fa} (با درجه عالی)`,
          ps: `${approved.finalText.ps} (په لوړه درجه)`,
          en: `${approved.finalText.en} (Graduated with honors.)`,
        },
      });
    assert.equal(editRes.status, 200);
    assert.ok(editRes.body.data.request.finalText.fa.includes('با درجه عالی'));

    const resetRes = await request(app)
      .post(`/api/requests/${reqId}/regenerate-text`)
      .set('Authorization', `Bearer ${officerToken}`);
    assert.equal(resetRes.status, 200);
    assert.equal(resetRes.body.data.request.finalText.fa.includes('با درجه عالی'), false);

    const finalEditRes = await request(app)
      .patch(`/api/requests/${reqId}/final-text`)
      .set('Authorization', `Bearer ${officerToken}`)
      .send({
        finalText: {
          fa: `${approved.finalText.fa} این سند رسماً تأیید گردید.`,
          ps: `${approved.finalText.ps} دا سند په رسمي ډول تایید شو.`,
          en: `${approved.finalText.en} Officially verified and issued.`,
        },
      });
    assert.equal(finalEditRes.status, 200);

    const finalPdf = await request(app)
      .post(`/api/requests/${reqId}/pdf`)
      .set('Authorization', `Bearer ${officerToken}`)
      .buffer(true)
      .parse(parseBinaryResponse)
      .send({ templateKey: 'blue-stripes', reprintReason: 'چاپ نهایی پس از ویرایش متن' });
    assert.equal(finalPdf.status, 200);
    assert.equal(inspectPdfBuffer(finalPdf.body).pages, 1);

    // 7. Verify QR target URL & public verification endpoint + printLogs count (9 prints total)
    assert.equal(
      buildVerifyUrl(approved.serial),
      `http://192.168.1.10:5000/verify/${approved.serial}`
    );

    const verifyRes = await request(app).get(`/api/verify/${approved.serial}`);
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.verified, true);
    assert.equal(verifyRes.body.data.name, 'نرگس');
    assert.equal(verifyRes.body.data.status, 'printed');

    const logs = await PrintLog.find({ requestId: reqId }).sort({ printedAt: 1 });
    assert.equal(logs.length, 9);
    assert.equal(logs[0].isReprint, false);
    assert.equal(logs[8].isReprint, true);

    // 8. Confirm ZERO outbound internet / DNS calls occurred across the entire flow
    assert.deepEqual(
      netGuard.blocked,
      [],
      `Unexpected external network attempts: ${netGuard.blocked.join(', ')}`
    );
  });

  it('confirms local fonts, logos, QR image, cursive Dari/Pashto RTL joining & 1-page fit in Chromium', async () => {
    const sampleReq = await Request.findOne({ trackingCode: 'KU-1405-TST003' }).populate(
      'facultyId departmentId'
    );
    const prepared = await prepareCertificateRender({
      request: sampleReq,
      templateSelector: 'gold-corners',
      embedAssets: true,
    });

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (r.url().startsWith('data:') || r.url().startsWith('about:')) r.continue();
        else r.abort();
      });
      await page.setViewport({ width: 1123, height: 794, deviceScaleFactor: 1 });
      await page.setContent(prepared.html, { waitUntil: 'load' });

      const metrics = await page.evaluate(async () => {
        await document.fonts.ready;
        const fit = window.__runCertAutoFit();

        const loadedFamilies = new Set();
        document.fonts.forEach((f) => {
          if (f.status === 'loaded') loadedFamilies.add(f.family.replace(/['"]/g, ''));
        });

        const kuLogo = document.querySelector('.logo-university');
        const moheLogo = document.querySelector('.logo-ministry');
        const qrImg = document.querySelector('.qr-frame img');

        const enCol = document.querySelector('.cert-col-en');
        const faCol = document.querySelector('.cert-col-fa');
        const psCol = document.querySelector('.cert-col-ps');

        // Verify HarfBuzz cursive Arabic/Dari/Pashto joining (joined word is narrower than ZWNJ-split isolated glyphs)
        function measureCursiveJoining(word, fontFamily) {
          const probe = document.createElement('span');
          probe.dir = 'rtl';
          probe.style.cssText = `position:fixed;visibility:hidden;white-space:nowrap;font:18px "${fontFamily}";font-feature-settings:normal;letter-spacing:0;`;
          probe.textContent = word;
          document.body.appendChild(probe);
          const joinedWidth = probe.getBoundingClientRect().width;
          probe.textContent = Array.from(word).join('\u200c');
          const unjoinedWidth = probe.getBoundingClientRect().width;
          probe.remove();
          return { joinedWidth, unjoinedWidth, isJoined: joinedWidth < unjoinedWidth * 0.92 };
        }

        const pageRect = document.querySelector('.certificate-page').getBoundingClientRect();

        return {
          loadedFamilies: Array.from(loadedFamilies),
          kuLogoOk: Boolean(kuLogo && kuLogo.complete && kuLogo.naturalWidth >= 200),
          moheLogoOk: Boolean(moheLogo && moheLogo.complete && moheLogo.naturalWidth >= 100),
          qrImgOk: Boolean(qrImg && qrImg.complete && qrImg.naturalWidth >= 100),
          enDir: getComputedStyle(enCol).direction,
          faDir: getComputedStyle(faCol).direction,
          psDir: getComputedStyle(psCol).direction,
          faFeatures: getComputedStyle(faCol).fontFeatureSettings,
          psFeatures: getComputedStyle(psCol).fontFeatureSettings,
          dariJoining: measureCursiveJoining('تصدیقنامه', 'Vazirmatn'),
          pashtoJoining: measureCursiveJoining('پوهنځی', 'Noto Naskh Arabic'),
          pageWidth: Math.round(pageRect.width),
          pageHeight: Math.round(pageRect.height),
          overflowColumns: fit.overflowColumns,
        };
      });

      assert.ok(metrics.loadedFamilies.includes('Vazirmatn'));
      assert.ok(metrics.loadedFamilies.includes('Noto Naskh Arabic'));
      assert.ok(metrics.loadedFamilies.includes('EB Garamond'));
      assert.equal(metrics.kuLogoOk, true, 'University logo must decode cleanly');
      assert.equal(metrics.moheLogoOk, true, 'Ministry logo must decode cleanly');
      assert.equal(metrics.qrImgOk, true, 'Offline QR image must decode cleanly');
      assert.equal(metrics.enDir, 'ltr');
      assert.equal(metrics.faDir, 'rtl');
      assert.equal(metrics.psDir, 'rtl');
      assert.equal(metrics.faFeatures, 'normal');
      assert.equal(metrics.psFeatures, 'normal');
      assert.equal(metrics.dariJoining.isJoined, true, 'Dari glyphs must join cursively');
      assert.equal(metrics.pashtoJoining.isJoined, true, 'Pashto glyphs must join cursively');
      assert.ok(Math.abs(metrics.pageWidth - 1123) <= 2, 'Exact 297mm A4 landscape width');
      assert.ok(Math.abs(metrics.pageHeight - 794) <= 2, 'Exact 210mm A4 landscape height');
      assert.deepEqual(metrics.overflowColumns, []);
    } finally {
      await page.close();
    }
  });

  it('writes dated MongoDB backup folders, keeps strictly the latest 14, and preserves old backups on failure', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ku-backup-test-'));
    const backupDir = path.join(tmpRoot, 'backups');
    const mockDump = path.join(tmpRoot, 'mock-mongodump.js');
    const mockLauncher = path.join(tmpRoot, 'mock-mongodump.sh');

    try {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(path.join(backupDir, 'KEEP_ME_NOTE.txt'), 'do not delete', 'utf8');

      // Seed 16 historical daily backup folders (2026-11-01 .. 2026-11-16)
      for (let d = 1; d <= 16; d += 1) {
        const day = String(d).padStart(2, '0');
        fs.mkdirSync(path.join(backupDir, `backup-2026-11-${day}`));
      }

      // Create portable offline mock mongodump executable
      fs.writeFileSync(
        mockDump,
        `const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
         if (process.env.FAIL_DUMP === '1') process.exit(2);
         const outArg = process.argv.find((a) => a.startsWith('--out='));
         const dbDir = path.join(outArg.slice(6), 'kunduz_certificates');
         fs.mkdirSync(dbDir, { recursive: true });
         fs.writeFileSync(path.join(dbDir, 'requests.bson.gz'), zlib.gzipSync('sample-bson'));
         fs.writeFileSync(path.join(dbDir, 'requests.metadata.json.gz'), zlib.gzipSync('{}'));`,
        'utf8'
      );
      fs.writeFileSync(mockLauncher, `#!/usr/bin/env sh\nexec "${process.execPath}" "${mockDump}" "$@"\n`, {
        mode: 0o755,
      });

      // Run backup on 2026-11-17 (17th folder) -> keeps 2026-11-04 .. 2026-11-17 (14 total), prunes 01..03
      const result = runBackup({
        backupDir,
        keepCount: 14,
        mongodumpBin: mockLauncher,
        now: new Date('2026-11-17T02:00:00Z'),
        silent: true,
      });

      assert.equal(result.folderName, 'backup-2026-11-17');
      assert.equal(result.kept.length, 14);
      assert.deepEqual(result.pruned.sort(), [
        'backup-2026-11-01',
        'backup-2026-11-02',
        'backup-2026-11-03',
      ]);
      assert.ok(fs.existsSync(path.join(result.finalDir, 'SHA256SUMS.txt')));
      assert.ok(fs.existsSync(path.join(result.finalDir, 'backup-info.json')));
      assert.ok(fs.existsSync(path.join(backupDir, 'KEEP_ME_NOTE.txt')));

      // Simulate a failed dump -> must NOT prune existing 14 good backups or leave staging dirs
      process.env.FAIL_DUMP = '1';
      assert.throws(() =>
        runBackup({
          backupDir,
          keepCount: 14,
          mongodumpBin: mockLauncher,
          now: new Date('2026-11-18T02:00:00Z'),
          silent: true,
        })
      );
      delete process.env.FAIL_DUMP;

      const afterFail = pruneOldBackups(backupDir, 14);
      assert.equal(afterFail.kept.length, 14);
      assert.ok(afterFail.kept.includes('backup-2026-11-04'));
    } finally {
      delete process.env.FAIL_DUMP;
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

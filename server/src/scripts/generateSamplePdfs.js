'use strict';

/**
 * Offline Sample PDF Generator — Kunduz University Certificate System
 *
 * Generates all 8 themed A4 landscape trilingual certificate PDFs from seeded
 * MongoDB data (alternating male and female graduates across faculties) so they
 * can be inspected visually offline.
 *
 * Usage:
 *   npm run generate:samples
 *   npm run generate:samples -- --out ./server/tmp/sample-pdfs
 *   npm run generate:samples -- --screenshots
 */

const fs = require('fs');
const path = require('path');

const { connectDB, disconnectDB } = require('../config/db');
const { Template, Request } = require('../models');
const { TEMPLATE_KEYS } = require('../models/Template');
const { generateCertificatePdf, closeBrowser } = require('../services/pdfService');

function parseArgs(argv) {
  let outDir = path.resolve(__dirname, '../../tmp/sample-pdfs');
  let screenshots = false;

  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1]) {
      outDir = path.resolve(process.cwd(), argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--screenshots') {
      screenshots = true;
    }
  }

  return { outDir, screenshots };
}

async function generateAllSamples({ outDir, screenshots = false }) {
  console.log('==============================================================');
  console.log('  Kunduz University — Generating All 8 Themed Sample PDFs');
  console.log('==============================================================');

  await connectDB();

  const [templates, allRequests] = await Promise.all([
    Template.find({ key: { $in: TEMPLATE_KEYS } }),
    Request.find({ status: { $ne: 'rejected' } })
      .populate('facultyId', 'code name')
      .populate('departmentId', 'code name')
      .sort({ trackingCode: 1 }),
  ]);

  if (templates.length === 0 || allRequests.length === 0) {
    throw new Error(
      'Seeded templates or requests not found. Please run `npm run seed` first.'
    );
  }

  // Prefer approved/printed requests first, then pending requests (assigned demo serials in memory only)
  const approvedFirst = [
    ...allRequests.filter((r) => r.status === 'approved' || r.status === 'printed'),
    ...allRequests.filter((r) => r.status === 'pending'),
  ];

  const tplByKey = new Map(templates.map((t) => [t.key, t]));
  fs.mkdirSync(outDir, { recursive: true });

  const screenshotDir = screenshots ? path.join(outDir, 'previews') : '';
  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const results = [];

  for (let idx = 0; idx < TEMPLATE_KEYS.length; idx += 1) {
    const key = TEMPLATE_KEYS[idx];
    const template = tplByKey.get(key);
    if (!template) {
      console.warn(`[warn] Template "${key}" missing from database — skipped.`);
      continue;
    }

    const baseReq = approvedFirst[idx % approvedFirst.length].toObject();
    const demoSerial =
      baseReq.serial || `KU-2026-00010${idx + 1}`;
    const demoOfficialNo =
      baseReq.officialNo || `1405/${baseReq.facultyId?.code || 'KU'}/010${idx + 1}`;

    const sampleRequest = {
      ...baseReq,
      serial: demoSerial,
      officialNo: demoOfficialNo,
    };

    const num = String(idx + 1).padStart(2, '0');
    const pdfFilename = `certificate-${num}-${key}.pdf`;
    const pdfPath = path.join(outDir, pdfFilename);
    const pngPath = screenshotDir
      ? path.join(screenshotDir, `certificate-${num}-${key}.png`)
      : '';

    const started = Date.now();
    const { pdfBuffer, verifyUrl, warnings, fitResult } = await generateCertificatePdf({
      request: sampleRequest,
      templateDoc: template,
      regenerateForTemplate: true,
      screenshotPath: pngPath,
    });

    fs.writeFileSync(pdfPath, pdfBuffer);
    const elapsedMs = Date.now() - started;
    const sizeKb = (pdfBuffer.length / 1024).toFixed(1);

    console.log(
      `  [${num}/08] theme-${key.padEnd(13)} -> ${pdfFilename} (${sizeKb} KB, ${elapsedMs}ms) | ${sampleRequest.gender.padEnd(6)} | ${demoSerial}`
    );
    if (warnings.length > 0) {
      console.log(`          note: ${warnings.join(' ')}`);
    }

    results.push({
      key,
      pdfPath,
      pngPath,
      bytes: pdfBuffer.length,
      serial: demoSerial,
      verifyUrl,
      gender: sampleRequest.gender,
      fitResult,
    });
  }

  console.log('--------------------------------------------------------------');
  console.log(`  Generated ${results.length} offline A4 landscape PDFs in:`);
  console.log(`  ${outDir}`);
  console.log('==============================================================');

  return results;
}

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  generateAllSamples(options)
    .then(async () => {
      await closeBrowser();
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[samples] Failed:', err.message);
      await closeBrowser();
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = { generateAllSamples };

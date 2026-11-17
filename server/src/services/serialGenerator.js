'use strict';

const Counter = require('../models/Counter');
const Request = require('../models/Request');
const { getCurrentSolarHijriYear } = require('../utils/trackingCode');

/**
 * Atomically increment a named counter and return its next integer sequence.
 * @param {string} key
 * @returns {Promise<number>}
 */
async function nextSequence(key) {
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  return doc.seq;
}

/**
 * Ensure a counter's value is at least `minSeq` (used by seeders/migrations).
 * @param {string} key
 * @param {number} minSeq
 */
async function ensureCounterAtLeast(key, minSeq) {
  const existing = await Counter.findOne({ key });
  if (!existing) {
    await Counter.create({ key, seq: minSeq });
  } else if (existing.seq < minSeq) {
    existing.seq = minSeq;
    await existing.save();
  }
}

/**
 * Format a certificate serial number, e.g. `KU-2026-000123`.
 * @param {number} year
 * @param {number} seq
 * @returns {string}
 */
function formatSerial(year, seq) {
  return `KU-${year}-${String(seq).padStart(6, '0')}`;
}

/**
 * Atomically generate a guaranteed-unique certificate serial (e.g. `KU-2026-000123`).
 * @param {Date} [date]
 * @returns {Promise<string>}
 */
async function generateCertificateSerial(date = new Date()) {
  const year = date.getUTCFullYear();
  const key = `serial:${year}`;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const seq = await nextSequence(key);
    const candidate = formatSerial(year, seq);
    const conflict = await Request.findOne({ serial: candidate }).select('_id').lean();
    if (!conflict) {
      return candidate;
    }
  }

  throw new Error('Unable to allocate a unique certificate serial number.');
}

/**
 * Atomically generate an official registration number (نمبر ثبت / صادره رسمی),
 * e.g. `1405/CS/0001`.
 * @param {object} [options]
 * @param {string} [options.facultyCode]
 * @param {Date} [options.date]
 * @returns {Promise<string>}
 */
async function generateOfficialNo({ facultyCode = 'REG', date = new Date() } = {}) {
  const shYear = getCurrentSolarHijriYear(date);
  const cleanCode =
    String(facultyCode || 'REG')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'REG';

  const key = `official:${shYear}:${cleanCode}`;
  const seq = await nextSequence(key);
  return `${shYear}/${cleanCode}/${String(seq).padStart(4, '0')}`;
}

module.exports = {
  nextSequence,
  ensureCounterAtLeast,
  formatSerial,
  generateCertificateSerial,
  generateOfficialNo,
};

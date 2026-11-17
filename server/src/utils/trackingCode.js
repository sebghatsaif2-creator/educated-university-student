'use strict';

const crypto = require('crypto');

// Unambiguous uppercase alphanumeric charset (excludes 0/O, 1/I/L for easy reading on paper)
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Convert a Gregorian year approximately to Solar Hijri (هجری شمسی).
 * @param {Date} [date]
 * @returns {number}
 */
function getCurrentSolarHijriYear(date = new Date()) {
  const month = date.getUTCMonth() + 1; // 1..12
  const day = date.getUTCDate();
  const gYear = date.getUTCFullYear();
  // Nowruz is around March 21
  return month < 3 || (month === 3 && day < 21) ? gYear - 622 : gYear - 621;
}

/**
 * Generate a collision-resistant applicant tracking code (e.g. KU-1405-7H3K9P).
 * @param {number} [shYear]
 * @returns {string}
 */
function generateTrackingCode(shYear = getCurrentSolarHijriYear()) {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `KU-${shYear}-${suffix}`;
}

module.exports = {
  getCurrentSolarHijriYear,
  generateTrackingCode,
};

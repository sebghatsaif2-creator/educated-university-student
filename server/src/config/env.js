'use strict';

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '../../../.env');
const serverEnvPath = path.resolve(__dirname, '../../.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(serverEnvPath)) {
  dotenv.config({ path: serverEnvPath, override: false });
}

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

const DEFAULT_PLACEHOLDER_SECRET = 'change-this-to-a-strong-offline-secret-min-32-chars';
let jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
  if (isProd) {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production.');
  }
  jwtSecret = 'kunduz-univ-dev-only-jwt-secret-key-do-not-use-in-prod';
  if (nodeEnv !== 'test') {
    console.warn('[config] JWT_SECRET not set in .env — using development fallback secret.');
  }
} else if (isProd && (jwtSecret === DEFAULT_PLACEHOLDER_SECRET || jwtSecret.length < 32)) {
  throw new Error(
    'FATAL: JWT_SECRET must be replaced with a unique secret of at least 32 characters in production.'
  );
}

if (isProd && !process.env.MONGODB_URI) {
  throw new Error('FATAL: MONGODB_URI environment variable must be set in production.');
}

const saltRoundsRaw = parseIntEnv(process.env.BCRYPT_SALT_ROUNDS, 12);
const bcryptSaltRounds = Math.min(Math.max(saltRoundsRaw, 10), 15);

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const trustProxyRaw = process.env.TRUST_PROXY;
const trustProxy =
  trustProxyRaw === 'true'
    ? true
    : Number.isFinite(Number(trustProxyRaw)) && Number(trustProxyRaw) > 0
      ? Number(trustProxyRaw)
      : false;

const defaultPort = parseIntEnv(process.env.PORT, 5000);
const lanBaseUrl = (process.env.LAN_BASE_URL || `http://localhost:${defaultPort}`)
  .trim()
  .replace(/\/+$/, '');
const puppeteerExecutablePath = (process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();

const env = Object.freeze({
  nodeEnv,
  isProd,
  host: process.env.HOST || '0.0.0.0',
  port: defaultPort,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kunduz_certificates',
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptSaltRounds,
  corsOrigins,
  lanBaseUrl,
  puppeteerExecutablePath,
  trustProxy,
  rateLimitWindowMs: parseIntEnv(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  rateLimitMax: parseIntEnv(process.env.RATE_LIMIT_MAX, 200),
  authRateLimitWindowMs: parseIntEnv(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  authRateLimitMax: parseIntEnv(process.env.AUTH_RATE_LIMIT_MAX, 15),
  publicDir: path.resolve(__dirname, '../../../public'),
  seed: Object.freeze({
    adminUsername: (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase(),
    adminPassword: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
    adminName: (process.env.SEED_ADMIN_NAME || 'مدیر سیستم پوهنتون کندز').trim(),
    officerUsername: (process.env.SEED_OFFICER_USERNAME || 'officer').trim().toLowerCase(),
    officerPassword: process.env.SEED_OFFICER_PASSWORD || 'Officer@12345',
    officerName: (process.env.SEED_OFFICER_NAME || 'کارمند مدیریت عمومی محصلان').trim(),
  }),
});

module.exports = env;

'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const apiRoutes = require('./routes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { sanitizeRequest } = require('./middleware/sanitize');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

if (env.trustProxy) {
  app.set('trust proxy', env.trustProxy);
}

app.disable('x-powered-by');

// Security headers tuned for 100% offline local-network (HTTP/HTTPS) operation.
// CSP strictly restricts fonts, scripts, styles, images, and API calls to local origin.
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  fontSrc: ["'self'", 'data:'],
  imgSrc: ["'self'", 'data:', 'blob:'],
  frameSrc: ["'self'", 'blob:', 'data:'],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  // Disabled intentionally so offline HTTP LAN clients (e.g. http://192.168.x.x) do not fail
  upgradeInsecureRequests: null,
};

if (env.isProd) {
  cspDirectives.frameAncestors = ["'self'"];
} else {
  cspDirectives.frameAncestors = ["'self'", 'https:'];
}

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: cspDirectives,
    },
    frameguard: env.isProd ? { action: 'sameorigin' } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
    hsts: false, // Offline LAN runs without public CA HTTPS unless terminated at local proxy
  })
);

// CORS configuration tuned for same-origin and offline university LAN access (http://SERVER_IP:PORT)
const PRIVATE_LAN_ORIGIN_RE =
  /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/i;

app.use(
  cors((req, callback) => {
    const origin = req.header('Origin');
    const host = req.header('Host');
    const sameOrigin =
      origin && host && (origin === `http://${host}` || origin === `https://${host}`);
    const allowed =
      !origin ||
      sameOrigin ||
      !env.isProd ||
      origin === env.lanBaseUrl ||
      PRIVATE_LAN_ORIGIN_RE.test(origin) ||
      env.corsOrigins.includes('*') ||
      env.corsOrigins.includes(origin);

    callback(null, {
      origin: allowed,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  })
);

// HTTP request logging
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.isProd ? 'combined' : 'dev'));
}

// Body parsers with sensible size caps
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// Input sanitization (NoSQL operator stripping + XSS tag removal)
app.use(sanitizeRequest);

// Serve local offline fonts and logos from repository root `public/`
const staticOptions = {
  maxAge: env.isProd ? '7d' : 0,
  immutable: false,
  dotfiles: 'ignore',
  setHeaders(res, filePath) {
    if (filePath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    } else if (filePath.endsWith('.woff')) {
      res.setHeader('Content-Type', 'font/woff');
    } else if (filePath.endsWith('.ttf')) {
      res.setHeader('Content-Type', 'font/ttf');
    }
  },
};

app.use('/public', express.static(env.publicDir, staticOptions));
app.use('/fonts', express.static(path.join(env.publicDir, 'fonts'), staticOptions));
app.use('/logos', express.static(path.join(env.publicDir, 'logos'), staticOptions));

// Apply rate limiting and mount REST API
app.use('/api', apiLimiter, apiRoutes);

// Serve the built offline Dari RTL frontend (`client/dist`) so `npm start` runs everything
const clientDistDir = path.resolve(__dirname, '../../client/dist');
const clientIndexHtml = path.join(clientDistDir, 'index.html');

if (env.nodeEnv !== 'test') {
  const distStatic = express.static(clientDistDir, {
    maxAge: env.isProd ? '7d' : 0,
    index: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.woff2')) {
        res.setHeader('Content-Type', 'font/woff2');
      }
    },
  });

  app.use((req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/public') ||
      req.path.startsWith('/fonts') ||
      req.path.startsWith('/logos')
    ) {
      return next();
    }
    return distStatic(req, res, next);
  });

  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/public') ||
      req.path.startsWith('/fonts') ||
      req.path.startsWith('/logos')
    ) {
      return next();
    }
    if (fs.existsSync(clientIndexHtml)) {
      res.setHeader('Cache-Control', 'no-cache');
      return res.sendFile(clientIndexHtml);
    }
    if (req.path === '/') {
      return res.status(200).json({
        success: true,
        name: 'سیستم درخواست و چاپ تصدیق‌نامه پوهنتون کندز',
        nameEn: 'Kunduz University Certificate Request & Printing System',
        stage: 4,
        offlineMode: true,
        note: 'Run `npm run build` to build client/dist and serve the Dari RTL UI from Express.',
      });
    }
    return next();
  });
}

// 404 & central error handler
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

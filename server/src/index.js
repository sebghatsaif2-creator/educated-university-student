'use strict';

const http = require('http');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { closeBrowser } = require('./services/pdfService');
const app = require('./app');

let server;

async function startServer() {
  try {
    await connectDB();

    server = http.createServer(app);
    server.listen(env.port, env.host, () => {
      console.log(
        `[server] Kunduz University Certificate API running (${env.nodeEnv}) on http://${env.host}:${env.port}`
      );
      console.log(`[server] Offline assets served from: ${env.publicDir}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`\n[server] Received ${signal}. Shutting down gracefully...`);
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await closeBrowser();
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[server] Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[server] Unhandled promise rejection:', reason);
});

startServer();

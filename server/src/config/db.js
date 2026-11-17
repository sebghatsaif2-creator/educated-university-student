'use strict';

const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.mongodbUri) {
  const conn = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000,
    autoIndex: !env.isProd,
  });

  if (env.nodeEnv !== 'test') {
    console.log(`[db] Connected to MongoDB: ${conn.connection.host}/${conn.connection.name}`);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB runtime error:', err.message);
  });

  return conn;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    if (env.nodeEnv !== 'test') {
      console.log('[db] Disconnected from MongoDB.');
    }
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};

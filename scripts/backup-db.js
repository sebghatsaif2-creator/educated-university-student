#!/usr/bin/env node
'use strict';

/**
 * Cross-Platform Daily MongoDB Backup Utility (Linux, Windows Server, macOS)
 * Kunduz University — Certificate Request & Printing System
 *
 * Runs `mongodump --uri=<MONGODB_URI> --gzip --out=<BACKUP_DIR>/backup-YYYY-MM-DD`,
 * writes a SHA-256 integrity manifest, and keeps strictly the latest 14 dated folders.
 *
 * Usage:
 *   npm run backup
 *   node scripts/backup-db.js --dir ./backups --keep 14
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATED_BACKUP_RE = /^backup-\d{4}-\d{2}-\d{2}(?:_\d{6})?$/;

// Load root .env via server's dotenv if present
try {
  // eslint-disable-next-line global-require
  const dotenv = require(path.join(ROOT_DIR, 'server/node_modules/dotenv'));
  dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });
} catch {
  // Fallback if invoked before dotenv load
}

function formatDateParts(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return { datePart, timePart };
}

function chooseDatedFolderName(backupDir, date = new Date()) {
  const { datePart, timePart } = formatDateParts(date);
  const base = `backup-${datePart}`;
  if (!fs.existsSync(path.join(backupDir, base))) {
    return base;
  }
  return `${base}_${timePart}`;
}

function collectFilesRecursive(dir, list = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(full, list);
    } else if (entry.isFile()) {
      list.push(full);
    }
  }
  return list;
}

function writeChecksumManifest(targetDir) {
  const files = collectFilesRecursive(targetDir)
    .filter((f) => {
      const base = path.basename(f);
      return base !== 'SHA256SUMS.txt' && base !== 'backup-info.json';
    })
    .sort();

  let totalBytes = 0;
  const lines = [];
  for (const file of files) {
    const buf = fs.readFileSync(file);
    totalBytes += buf.length;
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    const rel = `./${path.relative(targetDir, file).replace(/\\/g, '/')}`;
    lines.push(`${hash}  ${rel}`);
  }

  fs.writeFileSync(path.join(targetDir, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
  return { fileCount: files.length, totalBytes };
}

/**
 * List all valid dated backup folders sorted newest-first, delete anything beyond `keepCount`.
 * Never touches unrelated files or staging folders.
 */
function pruneOldBackups(backupDir, keepCount = 14) {
  if (!Number.isInteger(keepCount) || keepCount < 1) {
    throw new Error(`Invalid keepCount: ${keepCount}`);
  }
  if (!fs.existsSync(backupDir)) {
    return { kept: [], pruned: [] };
  }

  const datedDirs = fs
    .readdirSync(backupDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && DATED_BACKUP_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .reverse(); // Newest YYYY-MM-DD(_HHMMSS) first

  const kept = datedDirs.slice(0, keepCount);
  const pruned = datedDirs.slice(keepCount);

  for (const oldFolder of pruned) {
    fs.rmSync(path.join(backupDir, oldFolder), { recursive: true, force: true });
  }

  return { kept, pruned };
}

/**
 * Run a full compressed `mongodump` into a dated folder and keep the latest `keepCount` backups.
 */
function runBackup({
  mongodbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kunduz_certificates',
  backupDir = process.env.BACKUP_DIR || path.join(ROOT_DIR, 'backups'),
  keepCount = Number(process.env.BACKUP_KEEP_COUNT || 14),
  mongodumpBin = process.env.MONGODUMP_PATH || 'mongodump',
  now = new Date(),
  silent = false,
} = {}) {
  const resolvedBackupDir = path.isAbsolute(backupDir)
    ? backupDir
    : path.resolve(ROOT_DIR, backupDir);

  if (!Number.isInteger(keepCount) || keepCount < 1) {
    throw new Error(`BACKUP_KEEP_COUNT must be a positive integer (got ${keepCount}).`);
  }

  fs.mkdirSync(resolvedBackupDir, { recursive: true });

  const folderName = chooseDatedFolderName(resolvedBackupDir, now);
  const finalDir = path.join(resolvedBackupDir, folderName);
  const stagingDir = path.join(resolvedBackupDir, `.staging-${folderName}-${process.pid}`);

  fs.mkdirSync(stagingDir, { recursive: true });

  try {
    if (!silent) {
      console.log(`[backup] Starting MongoDB dump -> ${finalDir}`);
    }

    const proc = spawnSync(
      mongodumpBin,
      [`--uri=${mongodbUri}`, '--gzip', `--out=${stagingDir}`],
      { encoding: 'utf8', stdio: silent ? 'pipe' : 'inherit' }
    );

    if (proc.error) {
      if (proc.error.code === 'ENOENT') {
        throw new Error(
          `'${mongodumpBin}' not found in PATH. Install MongoDB Database Tools offline (see docs/BACKUP_RESTORE.md) or set MONGODUMP_PATH.`
        );
      }
      throw proc.error;
    }

    if (proc.status !== 0) {
      throw new Error(`mongodump exited with status ${proc.status}: ${proc.stderr || ''}`.trim());
    }

    const dumpFiles = collectFilesRecursive(stagingDir).filter(
      (f) => f.endsWith('.bson.gz') || f.endsWith('.metadata.json.gz') || f.endsWith('.bson')
    );
    if (dumpFiles.length === 0) {
      throw new Error(
        'mongodump created 0 dump files — aborting without rotating previous backups.'
      );
    }

    const { fileCount, totalBytes } = writeChecksumManifest(stagingDir);
    const meta = {
      service: 'kunduz-university-certificate-system',
      createdAt: now.toISOString(),
      folder: folderName,
      dumpFiles: fileCount,
      totalBytes,
      compression: 'gzip',
    };
    fs.writeFileSync(
      path.join(stagingDir, 'backup-info.json'),
      `${JSON.stringify(meta, null, 2)}\n`,
      'utf8'
    );

    fs.renameSync(stagingDir, finalDir);

    const rotation = pruneOldBackups(resolvedBackupDir, keepCount);

    if (!silent) {
      const sizeKb = (totalBytes / 1024).toFixed(1);
      console.log(`[backup] Saved ${folderName} (${fileCount} files, ${sizeKb} KB)`);
      if (rotation.pruned.length > 0) {
        console.log(`[backup] Pruned old backups: ${rotation.pruned.join(', ')}`);
      }
      console.log(
        `[backup] Retained ${rotation.kept.length}/${keepCount} dated backups in ${resolvedBackupDir}`
      );
    }

    return {
      folderName,
      finalDir,
      fileCount,
      totalBytes,
      kept: rotation.kept,
      pruned: rotation.pruned,
    };
  } catch (err) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

function parseCliArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      opts.backupDir = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--keep' && argv[i + 1]) {
      opts.keepCount = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--uri' && argv[i + 1]) {
      opts.mongodbUri = argv[i + 1];
      i += 1;
    }
  }
  return opts;
}

if (require.main === module) {
  try {
    runBackup(parseCliArgs(process.argv.slice(2)));
  } catch (err) {
    console.error(`[backup] ERROR: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  DATED_BACKUP_RE,
  formatDateParts,
  chooseDatedFolderName,
  pruneOldBackups,
  runBackup,
};

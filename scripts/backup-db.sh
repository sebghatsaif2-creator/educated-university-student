#!/usr/bin/env bash
# ==============================================================================
# Kunduz University — Daily Offline MongoDB Backup Script
# Dumps MongoDB via `mongodump --gzip` to a dated folder (`backup-YYYY-MM-DD`)
# and automatically retains only the most recent 14 backups.
#
# Usage:
#   ./scripts/backup-db.sh
#   BACKUP_DIR=/mnt/usb-backup BACKUP_KEEP_COUNT=14 ./scripts/backup-db.sh
#
# Daily cron example (runs every night at 02:00 AM):
#   0 2 * * * /opt/kunduz-certificates/scripts/backup-db.sh >> /var/log/ku-cert-backup.log 2>&1
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# Load defaults from .env if present (without overriding explicit environment vars)
read_env_var() {
  local key="$1"
  if [[ -f "${ENV_FILE}" ]]; then
    grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | sed -e 's/^[[:space:]"'\'']*//' -e 's/[[:space:]"'\'']*$//' || true
  fi
}

MONGODB_URI="${MONGODB_URI:-$(read_env_var MONGODB_URI)}"
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/kunduz_certificates}"

RAW_BACKUP_DIR="${BACKUP_DIR:-$(read_env_var BACKUP_DIR)}"
RAW_BACKUP_DIR="${RAW_BACKUP_DIR:-./backups}"
if [[ "${RAW_BACKUP_DIR}" = /* ]]; then
  RESOLVED_BACKUP_DIR="${RAW_BACKUP_DIR}"
else
  RESOLVED_BACKUP_DIR="${PROJECT_ROOT}/${RAW_BACKUP_DIR#./}"
fi

KEEP_COUNT="${BACKUP_KEEP_COUNT:-$(read_env_var BACKUP_KEEP_COUNT)}"
KEEP_COUNT="${KEEP_COUNT:-14}"

if ! [[ "${KEEP_COUNT}" =~ ^[0-9]+$ ]] || [[ "${KEEP_COUNT}" -lt 1 ]]; then
  echo "[backup] ERROR: BACKUP_KEEP_COUNT must be a positive integer (got '${KEEP_COUNT}')." >&2
  exit 1
fi

if ! command -v mongodump >/dev/null 2>&1; then
  echo "[backup] ERROR: 'mongodump' is not installed or not in PATH." >&2
  echo "[backup] Install MongoDB Database Tools offline (see docs/BACKUP_RESTORE.md)." >&2
  exit 1
fi

mkdir -p "${RESOLVED_BACKUP_DIR}"

DATE_STAMP="$(date +%Y-%m-%d)"
TIME_STAMP="$(date +%H%M%S)"
FOLDER_NAME="backup-${DATE_STAMP}"

# Avoid overwriting an earlier backup from the same day if triggered manually
if [[ -e "${RESOLVED_BACKUP_DIR}/${FOLDER_NAME}" ]]; then
  FOLDER_NAME="backup-${DATE_STAMP}_${TIME_STAMP}"
fi

FINAL_DIR="${RESOLVED_BACKUP_DIR}/${FOLDER_NAME}"
STAGING_DIR="${RESOLVED_BACKUP_DIR}/.staging-${FOLDER_NAME}-$$"

cleanup_staging() {
  if [[ -d "${STAGING_DIR}" ]]; then
    rm -rf "${STAGING_DIR}"
  fi
}
trap cleanup_staging EXIT

echo "[backup] $(date -Iseconds) — Starting MongoDB backup to ${FINAL_DIR}"
mkdir -p "${STAGING_DIR}"

# Execute compressed offline MongoDB dump
mongodump --uri="${MONGODB_URI}" --gzip --out="${STAGING_DIR}"

# Verify at least one BSON or metadata file was created before committing/pruning
FILE_COUNT="$(find "${STAGING_DIR}" -type f \( -name '*.bson.gz' -o -name '*.metadata.json.gz' \) | wc -l | tr -d ' ')"
if [[ "${FILE_COUNT}" -eq 0 ]]; then
  echo "[backup] ERROR: mongodump produced 0 collection files — aborting without rotating old backups." >&2
  exit 1
fi

# Generate SHA-256 checksums for offline integrity verification
if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "${STAGING_DIR}"
    find . -type f ! -name 'SHA256SUMS.txt' ! -name 'backup-info.json' -print0 \
      | sort -z \
      | xargs -0 sha256sum > SHA256SUMS.txt
  )
fi

TOTAL_SIZE="$(du -sh "${STAGING_DIR}" | awk '{print $1}')"
cat > "${STAGING_DIR}/backup-info.json" <<EOF
{
  "service": "kunduz-university-certificate-system",
  "createdAt": "$(date -Iseconds)",
  "folder": "${FOLDER_NAME}",
  "dumpFiles": ${FILE_COUNT},
  "size": "${TOTAL_SIZE}",
  "compression": "gzip"
}
EOF

# Atomically promote staging folder to final dated folder
mv "${STAGING_DIR}" "${FINAL_DIR}"
echo "[backup] Dump succeeded: ${FOLDER_NAME} (${FILE_COUNT} files, ${TOTAL_SIZE})"

# Rotate dated folders: keep strictly the newest ${KEEP_COUNT} backups
mapfile -t ALL_BACKUPS < <(
  find "${RESOLVED_BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d -name 'backup-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*' \
    -printf '%f\n' | sort -r
)

TOTAL_BACKUPS="${#ALL_BACKUPS[@]}"
PRUNED=0
if [[ "${TOTAL_BACKUPS}" -gt "${KEEP_COUNT}" ]]; then
  for ((i = KEEP_COUNT; i < TOTAL_BACKUPS; i++)); do
    OLD_NAME="${ALL_BACKUPS[$i]}"
    rm -rf "${RESOLVED_BACKUP_DIR:?}/${OLD_NAME}"
    echo "[backup] Pruned old backup: ${OLD_NAME}"
    PRUNED=$((PRUNED + 1))
  done
fi

REMAINING=$((TOTAL_BACKUPS - PRUNED))
echo "[backup] Completed successfully. Retained ${REMAINING}/${KEEP_COUNT} dated backups in ${RESOLVED_BACKUP_DIR}"

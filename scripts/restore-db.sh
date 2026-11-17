#!/usr/bin/env bash
# ==============================================================================
# Kunduz University — Offline MongoDB Restore Script
# Restores a dated backup folder created by `scripts/backup-db.sh` or `npm run backup`.
#
# Usage:
#   ./scripts/restore-db.sh ./backups/backup-2026-11-17
#   ./scripts/restore-db.sh ./backups/backup-2026-11-17 --yes
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-dated-backup-folder> [--yes]" >&2
  echo "Example: $0 ./backups/backup-2026-11-17" >&2
  exit 1
fi

BACKUP_PATH="$1"
AUTO_CONFIRM="${2:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

read_env_var() {
  local key="$1"
  if [[ -f "${ENV_FILE}" ]]; then
    grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 | cut -d'=' -f2- | sed -e 's/^[[:space:]"'\'']*//' -e 's/[[:space:]"'\'']*$//' || true
  fi
}

MONGODB_URI="${MONGODB_URI:-$(read_env_var MONGODB_URI)}"
MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/kunduz_certificates}"
DB_NAME="$(echo "${MONGODB_URI}" | sed -E 's|^mongodb(\+srv)?://[^/]+/([^?]+).*|\2|')"

if [[ ! -d "${BACKUP_PATH}" ]]; then
  echo "[restore] ERROR: Backup directory not found: ${BACKUP_PATH}" >&2
  exit 1
fi

if ! command -v mongorestore >/dev/null 2>&1; then
  echo "[restore] ERROR: 'mongorestore' is not installed or not in PATH." >&2
  echo "[restore] Install MongoDB Database Tools offline (see docs/BACKUP_RESTORE.md)." >&2
  exit 1
fi

# Verify SHA-256 checksums when present
if [[ -f "${BACKUP_PATH}/SHA256SUMS.txt" ]] && command -v sha256sum >/dev/null 2>&1; then
  echo "[restore] Verifying backup integrity (SHA256SUMS.txt)..."
  (cd "${BACKUP_PATH}" && sha256sum --check --quiet SHA256SUMS.txt)
  echo "[restore] Integrity check passed."
fi

DUMP_SUBDIR="${BACKUP_PATH}/${DB_NAME}"
if [[ ! -d "${DUMP_SUBDIR}" ]]; then
  # Find first subdirectory containing .bson.gz files
  FIRST_BSON="$(find "${BACKUP_PATH}" -maxdepth 2 -type f -name '*.bson.gz' | head -n 1 || true)"
  if [[ -z "${FIRST_BSON}" ]]; then
    echo "[restore] ERROR: No .bson.gz dump files found inside ${BACKUP_PATH}" >&2
    exit 1
  fi
  DUMP_SUBDIR="$(dirname "${FIRST_BSON}")"
fi

echo "=============================================================="
echo "  Target MongoDB database : ${DB_NAME}"
echo "  Source backup folder    : ${DUMP_SUBDIR}"
echo "  Mode                    : --gzip --drop (replaces existing collections)"
echo "=============================================================="

if [[ "${AUTO_CONFIRM}" != "--yes" ]]; then
  read -r -p "Proceed with restore? Type 'yes' to confirm: " ANSWER
  if [[ "${ANSWER}" != "yes" ]]; then
    echo "[restore] Cancelled by user."
    exit 0
  fi
fi

mongorestore --uri="${MONGODB_URI}" --gzip --drop --dir="${DUMP_SUBDIR}"
echo "[restore] $(date -Iseconds) — Database '${DB_NAME}' restored successfully!"

#!/bin/bash
# Purpose: Restore Firestore snapshot from production to staging for testing
# Usage: ./dr-restore-staging.sh [export-dir] [staging-project]

set -euo pipefail

EXPORT_DIR=${1:-$(cat /tmp/backup_path.txt 2>/dev/null || echo "")}
STAGING_PROJECT=${2:-hmatologia2-staging}

if [ -z "${EXPORT_DIR}" ]; then
  echo "Usage: $0 <export-dir> [staging-project]"
  echo "Example: $0 gs://hmatologia2-backups/backup_20260506_100000 hmatologia2-staging"
  exit 1
fi

echo "[$(date)] Starting Firestore import from ${EXPORT_DIR} to project ${STAGING_PROJECT}"

gcloud firestore import "${EXPORT_DIR}" \
  --async \
  --project="${STAGING_PROJECT}"

OPERATION=$(gcloud firestore operations list --project="${STAGING_PROJECT}" --filter="operationType:IMPORT" --limit=1 --format="value(name)")
echo "[$(date)] Import operation: ${OPERATION}"

# Wait for import to complete
while true; do
  STATUS=$(gcloud firestore operations describe "${OPERATION}" --project="${STAGING_PROJECT}" --format="value(done)")
  if [ "${STATUS}" == "True" ]; then
    echo "[$(date)] Import completed successfully"
    exit 0
  fi
  echo "[$(date)] Waiting for import... (checking every 60s)"
  sleep 60
done

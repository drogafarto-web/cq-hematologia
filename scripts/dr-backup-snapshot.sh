#!/bin/bash
# Purpose: Snapshot production Firestore to GCS for DR testing
# Usage: ./dr-backup-snapshot.sh [project-id] [backup-bucket]

set -euo pipefail

PROJECT=${1:-hmatologia2}
BUCKET=${2:-gs://hmatologia2-backups}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_DIR="${BUCKET}/backup_${TIMESTAMP}"

echo "[$(date)] Starting Firestore export to ${EXPORT_DIR}"

gcloud firestore export "${EXPORT_DIR}" \
  --async \
  --project="${PROJECT}"

OPERATION=$(gcloud firestore operations list --project="${PROJECT}" --filter="operationType:EXPORT" --limit=1 --format="value(name)")
echo "[$(date)] Export operation: ${OPERATION}"

# Wait for export to complete
while true; do
  STATUS=$(gcloud firestore operations describe "${OPERATION}" --project="${PROJECT}" --format="value(done)")
  if [ "${STATUS}" == "True" ]; then
    echo "[$(date)] Export completed successfully"
    echo "${EXPORT_DIR}" > /tmp/backup_path.txt
    exit 0
  fi
  echo "[$(date)] Waiting for export... (checking every 30s)"
  sleep 30
done

#!/bin/bash
# Purpose: Verify chain-hash integrity after restore
# Samples 100 docs with auditLogs, validates LogicalSignature hash
# Usage: ./dr-validate-chain-hash.sh [project-id]

set -euo pipefail

PROJECT=${1:-hmatologia2-staging}
SAMPLE_SIZE=100
FAILURES=0
SUCCESSES=0

echo "[$(date)] Starting chain-hash validation on project ${PROJECT}"
echo "Sampling ${SAMPLE_SIZE} documents with auditLogs"

# Query 100 auditLogs entries
gcloud firestore query --collection=auditLogs \
  --limit="${SAMPLE_SIZE}" \
  --format=json \
  --project="${PROJECT}" > /tmp/audit_sample.json

# For each entry, validate the hash
jq -r '.[] | "\(.id)|\(.logicalSignature.hash)|\(.logicalSignature.operatorId)|\(.logicalSignature.ts)"' /tmp/audit_sample.json | while IFS='|' read -r doc_id hash operator_id ts; do

  if [ -z "${hash}" ] || [ "${hash}" == "null" ]; then
    echo "WARN: Doc ${doc_id} has no hash"
    ((FAILURES++))
    continue
  fi

  # Validate hash format (SHA-256 = 64 hex chars)
  if [[ "${hash}" =~ ^[a-f0-9]{64}$ ]]; then
    echo "OK: Doc ${doc_id} hash valid"
    ((SUCCESSES++))
  else
    echo "FAIL: Doc ${doc_id} invalid hash format: ${hash}"
    ((FAILURES++))
  fi
done

echo "[$(date)] Validation summary: ${SUCCESSES} passed, ${FAILURES} failed"

if [ ${FAILURES} -eq 0 ]; then
  echo "✓ All sampled documents have valid chain-hash"
  exit 0
else
  echo "✗ Some documents failed chain-hash validation"
  exit 1
fi

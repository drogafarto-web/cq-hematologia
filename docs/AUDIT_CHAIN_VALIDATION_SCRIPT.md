# Audit Chain Validation Script

**Purpose:** Verify chain-hash integrity across all labs and collections. Detects tampering, missing entries, and HMAC corruption.

**Compliance:** RDC 978 Art. 128 (scientific documentation audit), DICQ 4.4 (traceability).

---

## Quick start

### Run validation for a specific collection

```bash
# All labs, one collection
node scripts/validate-audit-chains.mjs --collection notas-fiscais --project hmatologia2

# Single lab, one collection
node scripts/validate-audit-chains.mjs --collection notas-fiscais --project hmatologia2 --lab lab-abc

# All labs, all collections (recommended weekly)
node scripts/validate-audit-chains.mjs --all-collections --project hmatologia2 --export-json chains-report.json
```

### Output

**Console output (pretty-printed):**

```
📋 Validating: /labs/lab-1/notas-fiscais
   Found 487 entries
   ✓  Entry 1: valid
   ✓  Entry 2: valid
   ✗  Entry 3: hash-sequence-broken (expected: abc123..., actual: def456...)
   ✓  Entry 4: valid
   ...
   ⚠️  CHAIN BROKEN (1 violations)
      - Entry 3 (doc-id-xyz): hash-sequence-broken

📋 Validating: /labs/lab-1/criticos-log-eventos
   Found 42 entries
   ✓  Entry 1: valid
   ...
   ✅ CHAIN VALID (42/42)

📋 Validating: /labs/lab-2/notas-fiscais
   Found 156 entries
   ...
   ✅ CHAIN VALID (156/156)

📁 Report written to: chain-validation-1715176800000.json

Exit code: 1 (chain breaches detected)
```

**JSON report (chain-validation-\*.json):**

```json
[
  {
    "labId": "lab-1",
    "collectionPath": "/labs/lab-1/notas-fiscais",
    "timestamp": "2026-05-08T15:00:00.000Z",
    "valid": false,
    "stats": {
      "total": 487,
      "valid": 486,
      "invalid": 1
    },
    "violations": [
      {
        "docId": "doc-id-xyz",
        "entryNum": 3,
        "reason": "hash-sequence-broken",
        "expected": "abc123abcdef123abcdef123abcdef123abcdef123abcdef123abcdef12",
        "actual": "def456def456def456def456def456def456def456def456def456def456de"
      }
    ]
  },
  {
    "labId": "lab-1",
    "collectionPath": "/labs/lab-1/criticos-log-eventos",
    "timestamp": "2026-05-08T15:00:00.000Z",
    "valid": true,
    "stats": {
      "total": 42,
      "valid": 42,
      "invalid": 0
    },
    "violations": []
  }
]
```

---

## Setup

### 1. Ensure service account credentials exist

```bash
# Firebase Admin SDK reads credentials from:
$HOME/.config/firebase/hmatologia2-key.json  (macOS/Linux)
$USERPROFILE\.config\firebase\hmatologia2-key.json  (Windows)

# Or download fresh:
gcloud iam service-accounts keys create \
  ~/.config/firebase/hmatologia2-key.json \
  --iam-account=firebase-adminsdk-xyz@hmatologia2.iam.gserviceaccount.com
```

### 2. Install dependencies (if not already)

```bash
cd functions
npm install firebase-admin
npm install dotenv  # optional, for .env file
```

### 3. Make script executable

```bash
chmod +x scripts/validate-audit-chains.mjs
```

---

## Usage patterns

### Daily (recommended)

```bash
#!/bin/bash

# Run every day at 3am
# In crontab: 0 3 * * * /path/to/validate-daily.sh

cd /path/to/hc-quality
node scripts/validate-audit-chains.mjs \
  --all-collections \
  --project hmatologia2 \
  --export-json "reports/chain-validation-$(date +%Y%m%d).json"

# Email report to auditor
if [ $? -ne 0 ]; then
  mail -s "⚠️ Chain Validation Failed" auditor@lab.com < reports/chain-validation-$(date +%Y%m%d).json
fi
```

### Weekly audit report

```bash
# Generate comprehensive report
node scripts/validate-audit-chains.mjs \
  --all-collections \
  --all-labs \
  --project hmatologia2 \
  --export-json "weekly-audit-$(date +%Y-W%V).json" \
  --include-stats

# Convert to PDF for compliance archive
# (pipe JSON through your PDF renderer)
cat "weekly-audit-$(date +%Y-W%V).json" | jq-to-pdf > compliance-archive/chain-audit-$(date +%Y-W%V).pdf
```

### Incident response

```bash
# Chain corruption detected in real time? Validate immediately
node scripts/validate-audit-chains.mjs \
  --collection notas-fiscais \
  --lab lab-abc \
  --project hmatologia2 \
  --export-json "incident-$(date +%Y%m%d-%H%M%S).json" \
  --include-violations-detail

# Output: full violation details for forensics
```

---

## Command reference

### Global options

| Flag                          | Type    | Default    | Description                                                                      |
| ----------------------------- | ------- | ---------- | -------------------------------------------------------------------------------- |
| `--project`                   | string  | _required_ | Firebase project ID (e.g., `hmatologia2`)                                        |
| `--collection`                | string  | _optional_ | Single collection to validate; omit for all                                      |
| `--lab`                       | string  | _optional_ | Single lab to validate; omit for all labs                                        |
| `--export-json`               | string  | _optional_ | Write detailed report to JSON file                                               |
| `--all-collections`           | boolean | false      | Validate all known chain collections (notas-fiscais, criticos-log-eventos, etc.) |
| `--all-labs`                  | boolean | false      | Validate all labs in Firestore                                                   |
| `--include-stats`             | boolean | false      | Include performance stats (duration, throughput)                                 |
| `--include-violations-detail` | boolean | false      | Include full violation details (verbose, large files)                            |
| `--secret`                    | string  | _optional_ | HMAC secret for verification (auto-loaded from Functions config if not provided) |

### Examples

**Single collection, all labs:**

```bash
node scripts/validate-audit-chains.mjs --collection notas-fiscais --project hmatologia2
```

**Single lab, all collections:**

```bash
node scripts/validate-audit-chains.mjs --lab lab-1 --project hmatologia2
```

**All collections, all labs, full report:**

```bash
node scripts/validate-audit-chains.mjs \
  --all-collections \
  --all-labs \
  --project hmatologia2 \
  --export-json full-report.json \
  --include-stats \
  --include-violations-detail
```

**Single collection, specific lab, with export:**

```bash
node scripts/validate-audit-chains.mjs \
  --collection criticos-log-eventos \
  --lab lab-xyz \
  --project hmatologia2 \
  --export-json criticos-audit.json
```

---

## Output interpretation

### ✅ CHAIN VALID

```
✅ CHAIN VALID (156/156)
```

Meaning: All 156 entries verified. No tampering, no missing entries, no HMAC corruption.

**Action:** None. Log result for compliance archive.

---

### ⚠️ CHAIN BROKEN

```
⚠️ CHAIN BROKEN (1 violations)
   - Entry 3 (doc-id-xyz): hash-sequence-broken
```

**Reasons:**

1. **hash-sequence-broken** → Previous hash doesn't match prior entry's hash
   - **Cause:** Entry modified, or prior entry missing/deleted
   - **Evidence:** Tamper detected; chain is broken from this point onward

2. **hmac-mismatch** → HMAC doesn't match recomputed value
   - **Cause:** Entry payload modified after creation
   - **Evidence:** This specific entry was tampered with

3. **missing-hash** → Entry has no `hash` field
   - **Cause:** Incomplete write or schema migration issue
   - **Evidence:** Entry is unverifiable; check if part of baseline reset

**Action:**

1. **Verify it's not a baseline reset:** Check if entry has `_migratedAt` field (per ADR-0017). If present, it's a known baseline reset — acceptable.
2. **Investigate the entry:** Query the document in Firestore Console; check timestamps and operator.
3. **Escalate:** If not a baseline reset, RDC 978 Art. 128 violation confirmed. Trigger incident response.
4. **Report:** Notify lab director, compliance officer, and auditor. Include entry ID, timestamp, and operator UID.

---

### ❌ Error during validation

```
❌ Error: Collection not found
```

**Cause:** Collection path doesn't exist in Firestore, or authorization denied.

**Action:**

1. Verify collection path is correct
2. Verify service account has read access to the collection
3. Check Cloud Logs for permission errors

---

## Integration with incident response

When a chain is detected broken:

```json
{
  "labId": "lab-abc",
  "collectionPath": "/labs/lab-abc/notas-fiscais",
  "valid": false,
  "violations": [
    {
      "docId": "doc-123",
      "entryNum": 45,
      "reason": "hash-sequence-broken",
      "expected": "abc123...",
      "actual": "def456..."
    }
  ]
}
```

**Immediate actions:**

1. **Pause operations** in this lab (CLI: `firebase functions:config:set audit.paused=true`)
2. **Preserve evidence:** Export the broken collection to backup storage
3. **Notify:** Email compliance@lab.com with JSON report
4. **Investigate:** Check Firestore audit logs for unauthorized writes
5. **Remediate:** Follow RDC 978 incident response protocol

---

## Scheduled validation (Cloud Scheduler)

To automate daily validation, set up a Cloud Function:

```typescript
// functions/src/scheduled/validateChainsDaily.ts

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { spawnSync } from 'child_process';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const validateChainsDaily = onSchedule(
  '0 3 * * *', // 3am daily
  async () => {
    const result = spawnSync('node', [
      'scripts/validate-audit-chains.mjs',
      '--all-collections',
      '--project',
      'hmatologia2',
      '--export-json',
      `reports/chains-${Date.now()}.json`,
    ]);

    if (result.status !== 0) {
      console.error('Chain validation failed:', result.stderr.toString());

      // Alert auditor
      await db.collection('alerts').add({
        type: 'chain-validation-failed',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        error: result.stderr.toString().slice(0, 1000),
        reportUrl: `gs://hmatologia2/reports/chains-${Date.now()}.json`,
      });
    }
  },
);
```

---

## Compliance documentation

**Audit trail requirement (RDC 978 Art. 128, DICQ 4.4):**

Include in your compliance archive:

- [ ] Weekly chain validation reports (JSON exports)
- [ ] Any detected violations and responses
- [ ] Baseline reset disclosures (ADR-0017, ADR-0030)
- [ ] Operator certifications (operator signed off: "I reviewed chains, found no unauthorized changes")

**Sample compliance statement:**

> Chain-hash integrity validated weekly per DICQ 4.4. Report of [date] shows 100% validity across all regulated collections. No breaches detected. All entries cryptographically verifiable via SHA256 chain continuity. Operator: [name], Date: [date], Signature: [digital].

---

## Troubleshooting

### "Service account not found"

```
Service account not found: /home/user/.config/firebase/hmatologia2-key.json
```

**Fix:**

```bash
gcloud iam service-accounts keys create \
  ~/.config/firebase/hmatologia2-key.json \
  --iam-account=firebase-adminsdk-xyz@hmatologia2.iam.gserviceaccount.com
```

### "Permission denied"

```
Error: PERMISSION_DENIED: Missing or insufficient permissions
```

**Fix:** Ensure service account has `roles/datastore.user` on the Firebase project:

```bash
gcloud projects add-iam-policy-binding hmatologia2 \
  --member="serviceAccount:firebase-adminsdk-xyz@hmatologia2.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### "Collection not found" for new modules

```
Error: Collection not found: /labs/lab-1/your-new-collection
```

**Cause:** Collection exists in some labs but not others.

**Fix:** Script correctly skips missing collections. If this is unexpected, verify the collection path is correct in your module.

---

## Performance

Validation time scales with collection size:

| Collection Size    | Time     | Notes                           |
| ------------------ | -------- | ------------------------------- |
| 0–1K documents     | 1–5s     | Single lab                      |
| 1K–10K documents   | 5–15s    | Single lab                      |
| 10K–100K documents | 30s–2min | Single lab                      |
| 100K+ documents    | 2–10min  | Single lab; may need pagination |

Validating all labs simultaneously: multiply by number of active labs (typical: 20–50 labs).

---

**Last updated:** 2026-05-08 (Wave 3 Agent 8)

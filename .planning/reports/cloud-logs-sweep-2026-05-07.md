# Cloud Logs Sweep — 2026-05-07

**Project:** `hmatologia2` · **Region:** `southamerica-east1` · **Window:** last 48h

**Already addressed (excluded from this report):**

- HMAC secret rotation (ADR-0017)
- LGPD `solicitacoes-exclusao` composite index (deployed)
- `aggregateAnalytics` 256 → 512 MiB bump

## Summary

- Total ERROR logs (48h, sampled top 200): **200**
- Distinct error classes: **5**
- BLOCKING issues: **3**
- DEGRADING issues: **2**
- NOISE issues: **0**

| #   | Issue                                                                                 | Service                                                                                                                                                                                            | Severity  | Count                |
| --- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------------------- |
| 1   | Missing `insumo-movimentacoes` index (DESC, not ASC)                                  | `onInsumoMovimentacaoCreate`                                                                                                                                                                       | BLOCKING  | 56                   |
| 2   | Missing `sgq-documentos` composite index (codigo+status)                              | `lgpd_scheduledAnnualReview`                                                                                                                                                                       | BLOCKING  | 2 (every cron tick)  |
| 3   | Missing `risks` composite index (deletadoEm+reviewDate+status)                        | `risks_scheduledReview`                                                                                                                                                                            | BLOCKING  | 1+ (every cron tick) |
| 4   | Memory limit 256 MiB exceeded on multiple functions still at default                  | `lgpd_scheduledAnnualReview`, `scheduledMarcarLeiturasPerdidas`, `ec_scheduledAlertasVencimento`, `labApoio_checkExpiry`, `anonimizarRespostas`, `risks_scheduledReview`, `scheduledExpireInsumos` | DEGRADING | 11                   |
| 5   | `validateChainIntegrityScheduled` reading old HMAC env var (`HCQ_SIGNATURE_HMAC_KEY`) | `validateChainIntegrityScheduled`                                                                                                                                                                  | DEGRADING | 1 (every 24h)        |

---

## Issue 1 — Missing `insumo-movimentacoes` index, wrong direction (BLOCKING)

**Function:** `onInsumoMovimentacaoCreate` (Firestore trigger)
**Cloud Run service:** `oninsumomovimentacaocreate`
**Occurrences:** 56 in 48h (every insumo movement create — chainHash is broken in production)
**Error:**

```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

**Required index (decoded from URL):**

- Collection group: `insumo-movimentacoes`
- Fields: `insumoId ASC`, `timestamp DESC`, `__name__ DESC`

**Root cause:** `firestore.indexes.json` line 122-128 declares the index with `timestamp ASCENDING`, but `chainHash.ts:76` queries `.orderBy('timestamp', 'desc')`. Field order/direction mismatch → no index match → query fails. **Audit chain hash is silently failing for every insumo movement** since deploy.

**File to edit:** `C:\hc quality\firestore.indexes.json` (line 126)

**Fix (edit the JSON):**

```json
{
  "collectionGroup": "insumo-movimentacoes",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "insumoId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ]
}
```

**Deploy command:**

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```

**Compliance impact:** RDC 978 audit trail (chain hash) for insumos is broken. Every movement created in last 48h+ has no `chainHash` linking — backfill needed after fix.

---

## Issue 2 — Missing `sgq-documentos` index for LGPD annual review (BLOCKING)

**Function:** `lgpd_scheduledAnnualReview` (Cloud Scheduler, hourly)
**Cloud Run service:** `lgpd-scheduledannualreview`
**Occurrences:** Every scheduler tick (~hourly) — 100% failure rate in window
**Error:**

```
Error: 9 FAILED_PRECONDITION: The query requires an index.
```

**Required index (decoded):**

- Collection group: `sgq-documentos`
- Fields: `codigo ASC`, `status ASC`, `__name__ ASC`

**Root cause:** `functions/src/modules/lgpd/scheduledAnnualReview.ts` queries `sgq-documentos` with composite `where(codigo) + where(status)` but no index declared.

**File to edit:** `C:\hc quality\firestore.indexes.json`

**Fix — append:**

```json
{
  "collectionGroup": "sgq-documentos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "codigo", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

**Deploy command:**

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```

**Compliance impact:** LGPD POL-LGPD-001 / IT-LGPD-DPIA-001 annual review job has not run successfully in 48h+. DPIA review notifications are not being generated.

---

## Issue 3 — Missing `risks` composite index for periodic review (BLOCKING)

**Function:** `risks_scheduledReview` (Cloud Scheduler)
**Cloud Run service:** `scheduledreview`
**Occurrences:** Every scheduler tick — 100% failure rate
**Error:**

```
Error: 9 FAILED_PRECONDITION: The query requires an index.
The query contains range and inequality filters on multiple fields...
```

**Required index (decoded):**

- Collection group: `risks`
- Fields: `deletadoEm ASC`, `reviewDate ASC`, `status ASC`, `__name__ ASC`

**Root cause:** `functions/src/modules/risks/scheduledReview.ts` queries with `deletadoEm == null + reviewDate <= now + status` but no index declared. Note the range-on-multiple-fields warning — this needs Firestore's recent multi-range index feature.

**File to edit:** `C:\hc quality\firestore.indexes.json`

**Fix — append:**

```json
{
  "collectionGroup": "risks",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "deletadoEm", "order": "ASCENDING" },
    { "fieldPath": "reviewDate", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" }
  ]
}
```

**Deploy command:**

```bash
firebase deploy --only firestore:indexes --project hmatologia2
```

**Compliance impact:** RDC 978 Art. 86 + DICQ 4.14.6 — risks past `reviewDate` are not being flagged. Risk register integrity broken.

---

## Issue 4 — Multiple scheduled functions still default to 256 MiB and are crossing the limit (DEGRADING)

**Functions affected (memory exceeded ≥1× in window):**

- `lgpd_scheduledAnnualReview` — 256–259 MiB (3 hits) — **also Issue 2**
- `scheduledMarcarLeiturasPerdidas` — 2 hits
- `ec_scheduledAlertasVencimento` — 1 hit
- `labApoio_checkExpiry` — 1 hit
- `anonimizarRespostas` — 1 hit
- `risks_scheduledReview` — 1 hit (also Issue 3)
- `scheduledExpireInsumos` — 1 hit

**Root cause:** Default `functions.runWith({ memory: '256MB' })` (or no override) in scheduled functions that hold large Firestore result sets. Same pattern that bit `aggregateAnalytics` — not solved by the one-off bump.

**Fix — pattern across all scheduled functions:**

```typescript
// In each function file's options:
export const fooScheduled = onSchedule({
  schedule: '...',
  region: 'southamerica-east1',
  memory: '512MiB',  // ← add/raise from default
  timeoutSeconds: 540,
}, async (event) => { ... });
```

**Files to edit (priority order):**

1. `functions/src/modules/lgpd/scheduledAnnualReview.ts`
2. `functions/src/modules/risks/scheduledReview.ts`
3. `functions/src/modules/insumos/scheduledExpireInsumos.ts` (or wherever it lives)
4. `functions/src/modules/labApoio/checkExpiry.ts`
5. `functions/src/modules/educacaoContinuada/scheduledAlertasVencimento.ts`
6. `functions/src/modules/.../scheduledMarcarLeiturasPerdidas.ts`
7. `functions/src/modules/nps/anonimizarRespostas.ts`

**Deploy command (after fix):**

```bash
cd functions && npm run build && cd ..
firebase deploy --only functions:lgpd_scheduledAnnualReview,functions:risks_scheduledReview,functions:scheduledExpireInsumos,functions:labApoio_checkExpiry,functions:ec_scheduledAlertasVencimento,functions:scheduledMarcarLeiturasPerdidas,functions:anonimizarRespostas --project hmatologia2
```

**Note:** A few of these crashes happened in 1 instance over 48h, so OOM is borderline. Tenant data growth will worsen. Bump preemptively.

---

## Issue 5 — `validateChainIntegrityScheduled` still references retired env var (DEGRADING)

**Function:** `validateChainIntegrityScheduled`
**Occurrences:** 1 in window (runs ~daily)
**Error:**

```
Error: HCQ_SIGNATURE_HMAC_KEY environment variable not set
```

**Root cause:** ADR-0017 rotated to a Secret Manager-backed `defineSecret(...)` flow. This function still does `process.env.HCQ_SIGNATURE_HMAC_KEY` direct lookup instead of binding the secret. The job thus crashes — chain integrity verifier never runs.

**File to edit:** Find with `grep -rn "HCQ_SIGNATURE_HMAC_KEY" functions/src/` — likely `functions/src/modules/signatures/scheduled.ts` or similar.

**Fix:**

```typescript
import { defineSecret } from 'firebase-functions/params';
const hmacKey = defineSecret('HCQ_SIGNATURE_HMAC_KEY');

export const validateChainIntegrityScheduled = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'southamerica-east1',
    secrets: [hmacKey], // ← bind here
  },
  async () => {
    const key = hmacKey.value(); // ← read via .value() not process.env
    // ...
  },
);
```

**Deploy command:**

```bash
firebase deploy --only functions:validateChainIntegrityScheduled --project hmatologia2
```

**Compliance impact:** Tamper-evidence verifier silently down. If chain were corrupted, no daily alarm.

---

## Suggested execution order

1. **Indexes** (Issues 1, 2, 3) — single edit to `firestore.indexes.json`, single `firebase deploy --only firestore:indexes`. Unblocks 3 BLOCKING issues in one shot.
2. **HMAC secret binding** (Issue 5) — small code change, restores tamper-evidence verifier.
3. **Memory bumps** (Issue 4) — batch into one functions deploy after grouping the 7 files.
4. **Backfill chainHash** for insumo movements created in the broken window — separate task, not blocking.

## Data sources

- `gcloud logging read "severity>=ERROR" --project=hmatologia2 --limit=200 --freshness=48h`
- Firestore index URL base64 protos decoded for field+direction extraction
- Cross-referenced with `firestore.indexes.json` (current deployed state)
- `functions/src/modules/insumos/chainHash.ts` for query confirmation

# Runtime Health Verification — 2026-05-07 08:19 UTC

Project: `hmatologia2` · Region: `southamerica-east1` · Source: gcloud + Cloud Logs (last 1–2h, freshness)

---

## Index states (target collections)

All target indexes are `READY`. Total composite indexes in project: **77**.

| Collection group       | Fields (order)                                          | State                                   |
| ---------------------- | ------------------------------------------------------- | --------------------------------------- |
| `risks`                | `labId:A, deletadoEm:A, status:A, npr:D, __name__:D`    | READY                                   |
| `risks`                | `labId:A, deletadoEm:A, reviewDate:A, __name__:A`       | READY                                   |
| `risks`                | `deletadoEm:A, reviewDate:A, status:A, __name__:A` (CG) | READY                                   |
| `sgq-documentos`       | `codigo:A, status:A, __name__:A`                        | READY                                   |
| `lgpd`                 | `criadoEm:D, deletadoEm:A, __name__:A`                  | READY                                   |
| `lgpd-solicitacoes`    | `status:A, data_prazo:A, __name__:A`                    | READY                                   |
| `insumo-movimentacoes` | `insumoId:A, timestamp:D, __name__:D`                   | READY                                   |
| `insumo-movimentacoes` | `insumoId:A, timestamp:A, __name__:A`                   | READY                                   |
| `records`              | `status:A, deletadoEm:A, __name__:A`                    | READY (but **wrong order** — see below) |

Verification: `gcloud firestore indexes composite list --project=hmatologia2`.

---

## Functions verified

| Function                          | Memory                        | Secrets                                | Last run                                       | Status                                                            |
| --------------------------------- | ----------------------------- | -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| `aggregateAnalytics`              | **512 MiB** ✅ (bump applied) | —                                      | 2026-05-07 11:01:01 UTC                        | ⚠️ no memory error, but FAILED_PRECONDITION on `records` index    |
| `onInsumoMovimentacaoCreate`      | 256 MiB                       | —                                      | No invocations in last 12h (no triggers fired) | ✅ no errors observed; index DESC deployed and READY              |
| `validateChainIntegrityScheduled` | 256 MiB                       | `HCQ_SIGNATURE_HMAC_KEY` (v7) ✅ bound | Next scheduled run pending                     | ✅ secret confirmed in `serviceConfig.secretEnvironmentVariables` |
| `lgpd_scheduledAnnualReview`      | n/a verified                  | n/a                                    | Scheduled (12h+)                               | ✅ index deployed READY                                           |
| `scheduledReview` (risks)         | n/a verified                  | n/a                                    | Scheduled (12h+)                               | ✅ indexes deployed READY                                         |

---

## Last 1h ERROR logs (severity≥ERROR + matches for FAILED_PRECONDITION / Memory limit)

1. **2026-05-07 11:01:02 UTC — `aggregateAnalytics`** — `FAILED_PRECONDITION: The query requires an index` for collectionGroup `records` with fields `deletadoEm:ASC, status:ASC, __name__:ASC`. Lab `labclin-riopomba` failed to aggregate. Result: `0/1 labs succeeded in 589ms`.
   - **Root cause:** existing index has fields `status:A, deletadoEm:A` — Firestore composite indexes are field-order-sensitive, so a separate index with the reversed order (`deletadoEm:A, status:A`) is required.
   - **Decoded missing index spec (from b64 in error URL):** `projects/hmatologia2/databases/(default)/collectionGroups/records/indexes/_  fields=[deletadoEm:ASC, status:ASC, __name__:ASC]`
   - **Fix:** add to `firestore.indexes.json` and deploy.

2. **2026-05-07 11:00:08 UTC — `ec-scheduledalertasvencimento` (educacao-continuada)** — `Memory limit of 256 MiB exceeded with 259 MiB used`. Same pattern as the analytics fix earlier today. Function needs memory bump to 512 MiB.

3. **2026-05-07 10:01:05 UTC — `aggregateAnalytics`** — `Memory limit of 256 MiB exceeded with 257 MiB used`. **Pre-bump run** — confirms the 512 MiB deploy took effect between 10:01 and 11:01 (deploy rollout visible at 10:48–10:50 in service logs). ✅ No further memory errors at 11:01.

No `onInsumoMovimentacaoCreate` errors in last 12h. The DESC index fix is in place; the function did not run during this window so no real-traffic confirmation, but the prerequisite (READY index with correct direction) is satisfied.

---

## Conclusion

⚠️ **Pending — 2 follow-ups required before declaring stable**

| Status | Item                                                                                                                                                                                                                                                            |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅     | `aggregateAnalytics` 512 MiB bump confirmed working — no memory errors at 11:01 (was failing at 10:01)                                                                                                                                                          |
| ✅     | `validateChainIntegrityScheduled` has `HCQ_SIGNATURE_HMAC_KEY` v7 bound at runtime                                                                                                                                                                              |
| ✅     | All target indexes (`risks` ×3, `sgq-documentos`, `lgpd`, `lgpd-solicitacoes`, `insumo-movimentacoes` ×2) `READY`                                                                                                                                               |
| ✅     | `onInsumoMovimentacaoCreate` DESC index `READY`; no error logs                                                                                                                                                                                                  |
| ❌     | **NEW**: `aggregateAnalytics` blocked by missing `records` collectionGroup index (`deletadoEm:A, status:A, __name__:A`). Existing index has reversed field order — add new entry to `firestore.indexes.json`. Aggregation produced 0/1 labs succeeded at 11:01. |
| ❌     | **NEW**: `ec-scheduledalertasvencimento` exceeding 256 MiB (259 MiB used at 11:00). Apply same 512 MiB bump pattern.                                                                                                                                            |

**Net delta vs. start of day:** the two original bugs (analytics OOM, insumo index) are resolved; one new index requirement and one analogous OOM in a sibling function surfaced. Action needed before next hourly tick (next analytics run: ~12:01 UTC).

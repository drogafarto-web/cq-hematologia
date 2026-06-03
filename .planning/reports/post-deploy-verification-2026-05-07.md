# Post-Deploy Verification — 2026-05-07

**Project:** `hmatologia2`
**Region:** `southamerica-east1`
**Verifier:** Claude (read-only audit, no deployments)

---

## Summary

| #   | Check                                        | Status                                                      |
| --- | -------------------------------------------- | ----------------------------------------------------------- |
| 1   | HMAC secret rotated (no PENDING_SET)         | OK                                                          |
| 2   | Secret bound to ~25 functions (5 key)        | PARTIAL — 2 of 5 names do not exist as standalone functions |
| 3   | `lgpd-solicitacoes` Firestore index READY    | OK                                                          |
| 4   | Synthetic `chain-baseline-reset` audit event | NEEDS MANUAL VERIFICATION (no CLI read available)           |
| 5   | `aggregateAnalytics` memory = 512Mi          | OK                                                          |
| 6   | No PENDING_SET secrets bound to any function | OK                                                          |

**4 PASS · 1 PARTIAL · 1 MANUAL · 0 FAIL**

---

## Check 1 — HMAC secret rotated

**Command:**

```
firebase functions:secrets:access HCQ_SIGNATURE_HMAC_KEY --project hmatologia2 | head -1
```

**Output (shape only — not echoing value):**

- Length: **64 characters**
- All-hex regex match: **yes** (`[0-9a-f]{64}`)
- Starts with "PENDING_SET": **no**

Status: **OK**

---

## Check 2 — Secret bound to ~25 functions (5 key)

**Note:** The list of "5 key functions" provided contained two names that do not exist as standalone Cloud Functions in this project:

- `logAction` — **not deployed** as a callable. Audit logging in this codebase happens via Firestore triggers (`onInsumoLifecycleAudit`, `onHematologiaRunAudit`, `onImunoRunAudit`, etc.) and `createAuditoria`/`closeAuditoria` callables. There is no top-level `logAction` function.
- `criarQualificacao` — **not deployed.** The qualification surface is `onInsumoQualificacaoCreate` (Firestore trigger), `approveQualificacao`, and `reproveQualificacao`. None of these three carry the secret env var (they don't sign — the trigger that does is `onMovimentacaoSignature`).

**Per-function results:**

| Function                          | Exists?                 | `HCQ_SIGNATURE_HMAC_KEY` bound? |
| --------------------------------- | ----------------------- | ------------------------------- |
| `validateChainIntegrityScheduled` | yes                     | **yes**                         |
| `logAction`                       | **no (does not exist)** | n/a                             |
| `submitReview`                    | yes                     | **yes**                         |
| `criarQualificacao`               | **no (does not exist)** | n/a                             |
| `assinaturaRT`                    | yes                     | **yes**                         |

**Project-wide HMAC binding inventory (15 functions, not ~25):**

```
submitReview
addAcao
registrarCalibracacao
validateChainIntegrityScheduled
assinaturaRT
createPOPVersion
onMovimentacaoSignature
criarEquipamento
validateChainIntegrityOnDemand
createPOP
recordarTreinamentoPOP
openNaoConformidade
onImunoRunSignature
onHematologiaRunSignature
updateNaoConformidade
```

**Total functions deployed in region:** 149.

Status: **PARTIAL** — the 3 callables that exist are correctly bound, but the expected count of ~25 is materially overstated (actual = 15) and 2 of the 5 spot-check names don't exist. Recommend reconciling the remediation playbook against the deployed surface area.

---

## Check 3 — Firestore index `lgpd-solicitacoes` READY

**Command:**

```
gcloud firestore indexes composite list --project=hmatologia2 --format=json | grep lgpd-solicitacoes
```

**Output:**

```
READY - projects/hmatologia2/databases/(default)/collectionGroups/lgpd-solicitacoes/indexes/CICAgJjFqZML
```

(Adjacent `lgpd` collectionGroup index also READY: `CICAgNi4-ZIJ`.)

Status: **OK**

---

## Check 4 — Synthetic audit event `chain-baseline-reset`

**Cannot be verified from CLI.** `gcloud` does not expose Firestore document reads, and no Admin SDK script was provided. The remediation note states the event was inserted manually via the Firebase Console.

**Manual verification needed:** open Firestore Console → collection `auditLogs` → filter `action == "chain-baseline-reset"` → confirm timestamp `2026-05-07 ~01:56 UTC-3`.

Status: **MANUAL VERIFICATION NEEDED**

---

## Check 5 — `aggregateAnalytics` memory = 512 MiB

**Command:**

```
gcloud functions describe aggregateAnalytics --region=southamerica-east1 --gen2 --project=hmatologia2 --format="value(serviceConfig.availableMemory)"
```

**Output:** `512Mi`

Status: **OK**

---

## Check 6 — No PENDING_SET secrets bound to any function

**Command (effectively):** enumerated all 149 functions in the region and scanned `serviceConfig.secretEnvironmentVariables[].secret` for any value containing `PENDING`.

**Output:** `PENDING-bound functions: NONE`

Project secret inventory (no PENDING\_\* names):

```
GEMINI_API_KEY
HCQ_SIGNATURE_HMAC_KEY
OPENROUTER_API_KEY
RESEND_API_KEY
SMTP_HOST
SMTP_PASS
SMTP_PORT
SMTP_USER
```

Status: **OK**

---

## Action items

1. Manually confirm the `chain-baseline-reset` audit doc in Firestore Console (Check 4).
2. Reconcile the remediation playbook: the expected "~25 functions bound" should be updated to the actual 15, and the spot-check list should drop `logAction` / `criarQualificacao` (which don't exist) — replace with real signers e.g. `onMovimentacaoSignature`, `onHematologiaRunSignature`, `onImunoRunSignature`, `criarEquipamento`, `registrarCalibracacao`, `addAcao`.
3. If the playbook truly intended ~25 functions to sign, audit which signing call sites are missing the secret (likely candidates: anything that writes a `logicalSignature` but isn't in the list above).

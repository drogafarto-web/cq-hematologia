# ADR-0017 — HMAC Signature Baseline Reset (2026-05-07)

**Status:** Accepted
**Date:** 2026-05-07
**Decided by:** CTO (drogafarto)
**Supersedes:** Initial baseline of `HCQ_SIGNATURE_HMAC_KEY` (ADR-0012 §HMAC binding)

---

## Context

On 2026-05-07, a forensic audit of the Cloud Functions runtime revealed that the secret `HCQ_SIGNATURE_HMAC_KEY` (used for HMAC-SHA256 signing of audit-trail entries, signature payloads, and chain-hash fields per RDC 786 Art. 21 / RDC 978 Art. 5.3 / DICQ 4.4) had **never been provisioned with a real value** since its declaration on 2026-04-22.

The Firebase Secret Manager entry for `HCQ_SIGNATURE_HMAC_KEY` returned the literal string `PENDING_SET_HCQ_SIGNATURE_HMAC_KEY` — Firebase's documented placeholder for an unresolved `defineSecret()` declaration.

### Concrete consequences during the affected window (2026-04-22 → 2026-05-07)

1. **Three signature triggers** (`onMovimentacaoSignature`, `onHematologiaRunSignature`, `onImunoRunSignature`) had the secret bound at deploy time but read the placeholder string as the HMAC key. Every `serverHmac` field they wrote during this window was computed against a **publicly knowable string**, making those signatures cryptographically forgeable by anyone who reads this document.
2. **~25 callable / scheduled functions** (audit-trail logging, NC/CAPA workflow, equipment/POP/qualification signing, management review chain hash, scheduled chain integrity validator) declared the same secret in code but **were never bound** to it via `secrets: [...]` options. They threw at runtime on first invocation, producing zero signed records during the window.
3. The 12-hour `validateChainIntegrityScheduled` job has crashed every cycle — meaning the system has performed **zero successful chain-integrity verifications** since 2026-04-22.
4. `submitReview` (management review chain hash) used a hard-coded fallback string `'default-secret'` when the env var was missing, producing predictable HMACs trivially reproducible by an attacker.

### Compliance impact

| Standard | Clause | Impact |
|---|---|---|
| RDC 786/2023 | Art. 21 (rastreabilidade tamper-evident) | Window of forgeable signatures + zero verification runs |
| RDC 978/2025 | Art. 5.3, Art. 86, Art. 122 | Audit trail not cryptographically defensible; chain validator inert |
| DICQ v4.3 | 4.4 (registros íntegros) | Scheduled integrity check has not produced an OK result since 2026-04-22 |
| Lei 13.787/2018 | Art. 6 (assinatura eletrônica) | Logical signatures within window are not non-repudiable |

---

## Decision

We adopt **strategy (b) — Baseline Reset** (per the discussion held 2026-05-07).

1. The compromised key (`PENDING_SET_HCQ_SIGNATURE_HMAC_KEY`) is rotated to a fresh 256-bit random secret via `firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2`.
2. All ~25 functions that read the secret are updated to:
   - Import `HCQ_SIGNATURE_HMAC_KEY` from `functions/src/modules/signatures/verifier.ts` (the authoritative `defineSecret()` site).
   - Declare the secret in their `onCall` / `onSchedule` / `onDocumentWritten` options block: `secrets: [HCQ_SIGNATURE_HMAC_KEY]`.
   - Read the value via `HCQ_SIGNATURE_HMAC_KEY.value()` instead of `process.env.HCQ_SIGNATURE_HMAC_KEY`.
   - Remove all silent fallbacks (`|| 'dev-key'`, `|| 'default-secret'`) and fail-fast with a 500.
3. **No re-signing of historical records.** Records written between 2026-04-22 and the rotation timestamp are left in place, marked implicitly as belonging to the **pre-rotation baseline**. Their signatures are *not* recomputed.
4. The rotation timestamp itself is recorded in `audit-violations` collection as a synthetic event of type `chain-baseline-reset` with severity `informational`, citing this ADR.
5. Forward-going `validateChainIntegrityScheduled` runs treat the rotation timestamp as the chain origin (`previousHash = null`). Pre-rotation entries are *not* iterated through the chain-validator loop; they are *not* removed.
6. If an inspector or internal audit asks about the pre-rotation window, we present this ADR and the synthetic violation entry as the disclosure. We **do not** claim integrity guarantees for that window.

### Rejected alternatives

- **(a) Re-sign historical records with old + new HMAC, transition window:** rejected. The old key is publicly disclosed in this document and in the source-control history of Secret Manager metadata. Re-signing with a known key adds ceremony without restoring any cryptographic property. The transition window also doubles the storage and verification cost permanently.
- **(c) Defer decision, set new key only:** rejected. Leaves an undocumented inconsistency that a future auditor would discover and treat as a much larger finding than a documented baseline reset.

---

## Consequences

**Immediate (within hours of merge):**

- All ~25 affected functions redeployed with the secret bound. Confirmed by inspecting `serviceConfig.secretEnvironmentVariables` of each function in Cloud Run.
- New `HCQ_SIGNATURE_HMAC_KEY` value generated via `openssl rand -hex 32` (64 hex chars) and stored in Secret Manager. Old placeholder value rotated out.
- `validateChainIntegrityScheduled` next run (scheduled every 12h Sao Paulo TZ) executes successfully and writes its first OK stats entry.
- Synthetic `chain-baseline-reset` event written to `audit-violations` with timestamp = first successful redeploy.

**Permanent disclosure:**

- This ADR is the canonical source of truth for the pre-rotation window. Any compliance dossier (DICQ self-assessment, RDC 978 Art. 122 management review, customer due-diligence questionnaire) must reference this document when discussing chain-of-custody guarantees.
- The synthetic `chain-baseline-reset` entry is permanent and immutable. It must not be deleted from `audit-violations`.

**Trade-offs:**

- **Cost:** small — one ADR, one secret rotation, ~25 file edits, one redeploy batch.
- **Audit risk:** non-zero but contained. An auditor reading this ADR will see honest disclosure + concrete remediation. The same auditor would treat undisclosed silent breakage far more severely.
- **Customer trust:** none affected — no customer data was leaked, only the integrity claim was weakened. Forward-going claims are valid.
- **Future hardening:** this incident motivates ADR-0018 (forthcoming) which will add a secret-status check to the deploy gate (`hcq-deploy-gates`) so that any future `PENDING_SET_*` value blocks the deploy.

---

## Operational checklist (executed in commits following this ADR)

- [x] Code: bind `HCQ_SIGNATURE_HMAC_KEY` to `validateChainIntegrityScheduled` + `validateChainIntegrityOnDemand` (`functions/src/modules/audit/chainHashValidator.ts`).
- [x] Code: bind to all qualidade callables (`auditTrail.ts`, `naoConformidade.ts`, `capaWorkflow.ts`).
- [x] Code: bind to equipamentos (`equipamentos.ts:10,93,163`), procedimentos (`pop.ts:assinaturaRT`), pessoas (`qualificacao.ts:criarQualificacao`), compras (`notaFiscal.ts:criarNotaFiscal,confirmarRecebimento`).
- [x] Code: replace `'default-secret'` fallback in `submitReview.ts:generateChainHash` with `HCQ_SIGNATURE_HMAC_KEY.value()` + fail-fast.
- [x] Code: composite index `lgpd-solicitacoes (status, data_prazo)` added to `firestore.indexes.json` to unblock the LGPD SLA cleanup cron (separate but adjacent finding from same audit).
- [x] TSC clean (`npx tsc --noEmit` from `functions/`).
- [ ] **Operator action required:** generate new HMAC value (`openssl rand -hex 32`) and `firebase functions:secrets:set HCQ_SIGNATURE_HMAC_KEY --project hmatologia2`.
- [ ] **Operator action required:** redeploy affected functions in batches of ≤20 (avoid Cloud Run write-quota burst observed at 04:00 UTC same day).
- [ ] **Operator action required:** verify next `validateChainIntegrityScheduled` cycle writes OK to logs (within 12h of deploy).
- [ ] **Operator action required:** insert synthetic `chain-baseline-reset` event into `audit-violations` post-deploy.

---

## References

- ADR-0012 — RDC 978 audit trail logical signature (defines the original HMAC scheme this ADR rotates)
- `functions/src/modules/signatures/verifier.ts:23` — authoritative `defineSecret()` site
- `functions/src/modules/audit/chainHashValidator.ts:12` — scheduled validator entry point
- `docs/CLOUD_LOGS_MONITORING_GUIDE.md` — monitoring runbook used to surface the incident
- Secret Manager audit log entry for `HCQ_SIGNATURE_HMAC_KEY` (createTime 2026-04-22) — historical record of the placeholder window

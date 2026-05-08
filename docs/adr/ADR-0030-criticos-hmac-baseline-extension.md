# ADR-0030 — Criticos Audit Trail: HMAC Baseline Reset Extension (2026-05-08)

**Status:** Accepted
**Date:** 2026-05-08
**Decided by:** CTO (drogafarto)
**Extends:** ADR-0017 (HMAC Signature Baseline Reset — 2026-05-07)
**Related:** ADR-0012 (RDC 978 audit trail logical signature), ADR-0013 (Critical Results State Machine), ADR-0023 (Critical Values Escalation 4-State Machine)

> **Numbering note:** the number 0019 is already used twice in this repository (`ADR-0019-phase-3-schema-design.md`, `ADR-0019-critical-values-escalation.md`). To avoid a third collision and preserve immutability, this ADR is filed as 0030, immediately after the highest-numbered ADR (`ADR-0029-mobile-architecture-react-native-offline-sync.md`). The committee assignment referenced "ADR-0019" — read this document as the substantive answer to that ask.

---

## Context

ADR-0017 declared a baseline reset for the HMAC chain on 2026-05-07 in response to the 15-day `PENDING_SET_HCQ_SIGNATURE_HMAC_KEY` window. That ADR enumerated the three signature triggers (`onMovimentacaoSignature`, `onHematologiaRunSignature`, `onImunoRunSignature`) and the ~25 callables that were affected by the *secret-value* incident — i.e. functions whose `serverHmac` was computed against a public placeholder string.

A separate, narrower defect was identified in `functions/src/modules/criticos/index.ts` during the Wave 1 sweep on 2026-05-08:

- The criticos callables (`registerCriticoDetection`, `acknowledgeEscalacao`) and the schedule + webhook (`escalacaoCriticos`, `escalacaoCriticos_webhook`) wrote `criticos-log-eventos` documents whose `assinatura.hash` was the literal empty string `''`, with a `// Would generate hash` TODO comment.
- This is **not** the secret-value bug from ADR-0017. The criticos code never read the HMAC secret in the first place — it skipped chain-hash generation entirely, emitting an empty-string hash and never linking to the prior event. The audit-trail document was structurally well-formed but cryptographically void.
- The defect was undetected by the deploy-time Firestore rules check because writes to `labs/{labId}/criticos-log-eventos/{docId}` go through the Admin SDK (`allow create: if false` for clients in `firestore.rules:1903`), which bypasses rules entirely. The `validSignature(d)` rule with `d.assinatura.hash.size() == 64` exists for client-driven regulatory writes but is not evaluated on Admin-SDK writes.
- Wave 1 Agent 1's fix (commit `a6e01ad`, 2026-05-08 14:16 BRT) introduced `buildLogEventoSignature()` which fetches the prior event for the same `escalacaoId`, computes a real HMAC-SHA256 chain hash via `shared/signature.generateChainHash()`, and links via the new `eventoAnteriorId` field. Forward-going criticos events are correctly chained per RDC 978 Art. 128.

### Affected window

The criticos module timeline:

| Date | Commit | State |
|---|---|---|
| 2026-05-07 10:07 BRT | `4d00db6` (Phase 3 Complete) | Placeholder stubs only — no Firestore writes performed |
| 2026-05-08 12:36 BRT | `3d92df4` (3-tier SLA types) | Types only — no logic changes |
| 2026-05-08 12:37 BRT | `04877e2` (tierEngine) | Pure logic — no Firestore writes |
| 2026-05-08 ~13:00 BRT | (criticos production shell, commit `5d9f7dc` per `git log --all`) | Real callables ship with `hash: ''` literals |
| 2026-05-08 14:16 BRT | `a6e01ad` (Wave 1 Agent 1 fix) | Empty-hash regression closed |

The criticos module was **not part of the v1.3 production deploy on 2026-05-07**. Phase 6/7 (where criticos lives) is a v1.4 deliverable per `.planning/v1.4-PROJECT-SCOPE.md`. The defective code existed in `main` for under two hours and was fixed before any `firebase deploy --only functions:registerCriticoDetection` (or sibling) reached production. The branch was running locally against the emulator only.

### Estimated affected document count

- **Production (`hmatologia2`):** zero. Criticos callables were never deployed in the defective state.
- **Local emulators / dev branches:** small but non-zero. Any engineer who ran `npm test` or the emulator suite against the post-`5d9f7dc`, pre-`a6e01ad` code path produced ephemeral `criticos-log-eventos` documents with `hash: ''`. Emulator state is not persisted across runs and is not regulatory; we do not migrate it.
- **Per-environment estimate during the ~2-hour window:** 0–10 documents per dev machine, all in emulator volumes, none auditable.

The audit committee asked: "did the baseline reset cover the criticos chain too?" — the literal answer is that there is **no production criticos chain to reset**. But because the question is reasonable and the empty-hash regression is real in source-control history, we adopt the same disclosure posture as ADR-0017: document the window explicitly, flag any pre-fix documents that *do* surface in production (e.g. from a future restore-from-backup of an emulator volume that was mistakenly imported), and define the chain origin for forward-going criticos events as the first post-`a6e01ad` write per `escalacaoId`.

---

## Decision

We extend ADR-0017's baseline-reset semantics to the criticos chain with the following clauses:

1. **No historical re-signing.** Consistent with ADR-0017 §3, we do not recompute signatures for any criticos event written before commit `a6e01ad` (2026-05-08 14:16 BRT). The original `timestamp`, `operadorId`, and `detalhes` fields would be preserved if such a document were ever migrated to production, but the `assinatura.hash` cannot be made authentic retroactively without rewriting history (see Alternatives §A).

2. **Defensive migration script, idempotent and admin-only.** We ship `functions/scripts/markCriticosBaselineReset.ts` — a one-shot script that scans every lab's `criticos-log-eventos` and `criticos-escalacoes` collections for documents with `assinatura.hash == ''` *or* `assinatura.hash.length != 64` *and* `criadoEm` (or `timestamp`) before the cutoff `2026-05-08T18:16:00Z` (one hour after `a6e01ad`'s merge for safety margin), and stamps them with `signatureBaselineReset: true` plus `baselineResetAdr: 'ADR-0030'` and `baselineResetAt: <serverTimestamp>`. The script does **not** modify the original signature, timestamp, or any audit field — it only adds the marker. The script is **not run as part of this commit**; it exists as defense-in-depth in case any emulator export is ever loaded into production by mistake, or in case a forensic audit surfaces such a document.

3. **Forward chain origin.** The first post-fix `criticos-log-eventos` document per `escalacaoId` is treated as the chain origin (`previousHash = null`, `eventoAnteriorId` absent). This matches `buildLogEventoSignature()`'s behavior in `a6e01ad` and ADR-0017's "rotation timestamp = chain origin" semantics.

4. **No synthetic `chain-baseline-reset` event in `audit-violations`.** ADR-0017 wrote one for the secret-value incident because production records existed during that window. Criticos has no production records to disclose; writing a synthetic event would imply a corruption that did not reach production. We document the window in this ADR instead and let the committee read it as the disclosure.

5. **Compliance posture.** For the auditor: the criticos audit trail's chain-integrity guarantee starts at first write after 2026-05-08 14:16 BRT. Pre-fix code was never deployed. This ADR + the migration script's existence demonstrate that the system would correctly mark and disclose any pre-fix document if one were discovered.

---

## Consequences

**Immediate:**

- `docs/adr/ADR-0030-criticos-hmac-baseline-extension.md` lands in the canonical ADR set.
- `functions/scripts/markCriticosBaselineReset.ts` is committed but **not run**. It will execute manually only if a forensic finding requires it.
- `docs/adr/README.md` indexes this ADR.

**Forward:**

- Every criticos event from 2026-05-08 14:16 BRT onward chains correctly. The 12-hour `validateChainIntegrityScheduled` job (post-ADR-0017 fix) will iterate the criticos chain on its next cycle and write its first OK stats entry for this collection.
- Any future regression that re-introduces empty-hash literals will be caught by Phase 5 work-in-progress to extend `validateChainIntegrityScheduled` to scan `criticos-log-eventos` (currently scoped to `audit-trail` and `chain-events` only). That extension is a separate ticket; this ADR notes the gap.

**Trade-offs:**

- **Audit risk:** very low. Production never saw the defect. The disclosure is precautionary, not corrective.
- **Cost:** one ADR, one script (~80 LOC), one INDEX edit. No deploy, no rotation, no operator action.
- **Symmetry with ADR-0017:** intentional. An auditor reading both ADRs sees a consistent disclosure pattern — same posture, same vocabulary (`signatureBaselineReset`, `chain origin`), same refusal to fabricate authenticity by re-signing with a current key.

---

## Alternatives considered

**(A) Full re-sign of historical records with current secret + current logic.**
Rejected. Even setting aside that no production records exist, re-signing would falsely assert that the original event was authenticated at write time, when in fact it was not. The original timestamp and operatorId would be preserved but the cryptographic claim would be retroactive — exactly the property ADR-0017 §49 rejected. Consistency matters more than convenience.

**(B) Delete pre-fix records.**
Rejected. Same reason ADR-0017 §3 rejected deletion: tamper-evidence requires the record of the breakage to remain. If any pre-fix document ever surfaces, marking it (clause 2) is honest; deleting it is destruction of evidence.

**(C) Treat the empty-hash regression as out-of-scope for ADR-0017 and remain silent.**
Rejected. ADR-0017's audit posture is "honest disclosure beats undisclosed silent breakage". The committee asked the question; the answer goes on paper.

**(D) Block the fix until the migration script is also executed.**
Rejected. The fix (`a6e01ad`) is a regression close — shipping it immediately is the right call. The migration is defense-in-depth for a population we believe to be empty in production. Coupling them slows down the regression close for no incremental safety.

---

## Operational checklist

- [x] Author ADR-0030.
- [x] Author migration script `functions/scripts/markCriticosBaselineReset.ts` (admin-only, dry-run by default, idempotent).
- [x] Update `docs/adr/README.md` to index this ADR.
- [ ] **Optional follow-up (Phase 5):** extend `validateChainIntegrityScheduled` to scan `criticos-log-eventos` per-lab so any future empty-hash or broken-link regression is detected within 12 hours of write.
- [ ] **Optional follow-up:** add a Vitest unit test that asserts every code path in `functions/src/modules/criticos/index.ts` calls `buildLogEventoSignature()` before writing a `CriticosLogEvento` (regression guard against re-introducing `hash: ''`).
- [ ] **Operator action only-if-needed:** if a future restore or import surfaces pre-fix criticos documents in production, run `npx ts-node functions/scripts/markCriticosBaselineReset.ts --all-labs --confirm` (script defaults to dry-run) and attach the output to the audit dossier.

---

## References

- ADR-0017 — HMAC Signature Baseline Reset (2026-05-07) — parent baseline-reset decision
- ADR-0018 — Deploy Gate: Secret-Status Check — prevents the secret-value class of regression
- ADR-0012 — RDC 978 audit trail via LogicalSignature — defines the chain-hash contract this fix restored
- ADR-0023 — Critical Values Escalation 4-State Machine — defines the criticos state transitions whose audit trail was affected
- `functions/src/modules/criticos/index.ts` — fixed in commit `a6e01ad` (Wave 1 Agent 1)
- `functions/src/shared/signature.ts` — canonical `generateChainHash()` site
- `functions/scripts/markCriticosBaselineReset.ts` — defensive migration (this ADR)
- `firestore.rules:1903` — `criticos-log-eventos` rule block (Admin-SDK only, no client signature validation)
- RDC 978/2025 Art. 128 — tamper-evident audit-trail requirement for critical-value notification

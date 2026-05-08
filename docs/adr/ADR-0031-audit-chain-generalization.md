# ADR-0031 — Audit Chain Hash Pattern: Generalization & Reusability (2026-05-08)

**Status:** Accepted
**Date:** 2026-05-08
**Decided by:** CTO (drogafarto) + Wave 3 Agent 8
**Extends:** ADR-0017 (HMAC Signature Baseline Reset), ADR-0030 (Criticos HMAC Baseline Extension)
**Related:** ADR-0012 (RDC 978 audit trail logical signature), ADR-0002 (Supplier traceability)

---

## Context

Waves 2–4 implemented a chain-HMAC audit pattern for Invoice (`notaFiscal`) audits and Critical Value (`criticos`) escalation events. Each entry cryptographically references the prior entry via `previousHash`, creating a tamper-evident audit trail that detects if any historical record is modified — the hash continuity breaks, and a gap is visible to auditors.

The pattern is:

```
Entry N:   hash = SHA256(hmac + payload + previousHash[N-1] + operatorId + timestamp)
           ↓
Entry N+1: previousHash = hash[N]
           hash = SHA256(hmac + payload + previousHash[N] + operatorId + timestamp)
           ↓ [If N+1's payload is modified]
           previousHash[N+2] points to old hash[N], but entry N+1 now computes to a new hash
           → Auditor runs validateChainIntegrity(): detects mismatch at entry N+2
```

Today, `writeChainedAudit` helper exists in `functions/src/shared/audit/writeChainedAudit.ts`, and the cryptographic primitives live in `functions/src/modules/audit/cryptoAudit.ts`. But:

1. **Pattern is undocumented** — engineers don't know it exists or how to reuse it.
2. **No cookbook** — adopting the pattern requires reading two modules + test files.
3. **Ad-hoc indexes** — each new collection needs manual Firestore index creation.
4. **Limited validation** — `validateChainIntegrity` isn't widely known; no scheduled job validates criticos chains.

**Future modules** that require RDC 978 Art. 128 auditing (compras, riscos, biosseguranca, lab-apoio, NOTIVISA) should adopt this pattern. Generalization + documentation enables that adoption in parallel with feature work.

---

## Decision

We formalize the chain-hash audit pattern as a reusable **system pattern** with published documentation, cookbooks, and helper generalization:

### 1. Document the pattern: `docs/PATTERNS_AUDIT_CHAIN_HASH.md`

- **When to use** (RDC 978 Art. 128, DICQ 4.4, tamper detection)
- **How it works** (visual chain diagram, math, validation semantics)
- **API reference** (`writeChainedAudit()`, `validateChainIntegrity()`)
- **Firestore schema** (chain collection + failure marker sibling)
- **Implementation checklist** (5-step process)
- **Testing strategies** (unit + integration)
- **Monitoring & alerts**

### 2. Publish cookbook: `docs/AUDIT_CHAIN_HASH_COOKBOOK.md`

Three scenarios with copy-paste templates:

- **Scenario 1:** Adding chain hash to a new module (greenfield) — two templates
- **Scenario 2:** Retrofitting chain hash to existing module — two templates (migration + feature flag gradual rollout)
- **Scenario 3:** Validating chain continuity (auditor workflow) — two templates (on-demand script + scheduled job)

Plus quick-reference table of common mistakes.

### 3. Index documentation: `docs/FIRESTORE_INDEXES_AUDIT_CHAINS.md`

- Indexes required for `getPreviousHashInCollection` and failure marker queries
- JSON configuration for `firestore.indexes.json`
- Checklist: "adding a new chained collection"
- Performance expectations by collection size
- Troubleshooting slow queries

### 4. Validation script guide: `docs/AUDIT_CHAIN_VALIDATION_SCRIPT.md`

- Standalone Node.js script (`scripts/validate-audit-chains.mjs`) to verify chain integrity across all labs
- Command reference (all flags, examples)
- Output interpretation (what each violation type means)
- Integration with incident response
- Scheduled validation via Cloud Function
- Compliance documentation templates

### 5. Keep helper as-is: `functions/src/shared/audit/writeChainedAudit.ts`

No code changes to the helper — it's already correct. Documentation describes how to use it; no refactoring needed.

### 6. Reference in CLAUDE.md and rule files

Update:
- **`CLAUDE.md`** — add links to pattern docs in "Convenções invioláveis" section
- **`.claude/rules/firestore-security.md`** — clarify when chain-audit rules are needed
- **Feature module `CLAUDE.md` files** — mention pattern if module uses chain auditing

---

## Consequences

### Immediate

- 4 documentation files (pattern, cookbook, indexes, validation) committed to `docs/`
- 1 ADR (this one) committed to `docs/adr/`
- No code changes required
- No deploy impact

### Forward (Phases 4–9 adoption)

Modules adopting chain-audit can now:

- Reference `PATTERNS_AUDIT_CHAIN_HASH.md` for design context
- Copy from `AUDIT_CHAIN_HASH_COOKBOOK.md` for implementation
- Use pre-built `firestore.indexes.json` entries for indexes
- Leverage `validate-audit-chains.mjs` for auditor workflows

**Projected adoption:**
- **Phase 4 (May 20):** NOTIVISA likely uses chain audit for submission events
- **Phase 6–7 (May–June):** Risk management (riscos) + Biosecurity (biosseguranca) + Critical values (criticos)
- **Phase 8–9:** Lab support contracts (lab-apoio), process variations

No blockers; modules can adopt independently.

### Training impact

- New engineers onboarding in Phase 3+ can read `PATTERNS_AUDIT_CHAIN_HASH.md` + cookbook in 30 minutes
- Eliminates the "how do I add auditing to my module?" knowledge gap

### Compliance posture

- **RDC 978 Art. 128:** Chain-hash pattern is now the canonical answer to "how do we implement tamper-proof audit trails?"
- **DICQ 4.4:** Validation script + scheduled job provide continuous traceability verification
- **Audit committee:** Can point to this ADR + documentation when asked "is the chain pattern mature for reuse?"

---

## Trade-offs

| Aspect | Choice | Rationale |
|---|---|---|
| Code vs. docs | Docs only, no helper changes | Helper is already proven (Wave 2). Documentation enables reuse without code churn. |
| Generalization scope | Full coverage: 3 scenarios + 4 docs | Comprehensive enough for parallel Phase 4–9 adoption; narrow enough to avoid gold-plating. |
| Cookbook templates | Copy-paste ready, real-world | Engineers prefer concrete examples over abstract patterns. Three scenarios cover 80% of use cases. |
| Validation script | Standalone Node.js, not CF | On-demand auditor tool is more trustworthy than automated script (auditor controls when it runs). |
| Indexes | Explicit, not auto-created | Firestore rules are law; explicit indexes make performance contracts clear. |

---

## Alternatives considered

**(A) Extract helper to a more generic `chainHashHelper.ts`.**
Rejected. Current helper is already in `shared/audit/`; renaming adds no value. Documentation achieves the same reusability goal without code motion.

**(B) Publish pattern as a separate npm package (@hcq/chain-audit).**
Rejected. Too early; monorepo is simpler. Revisit if other projects adopt the pattern.

**(C) Encrypt chain payloads with per-lab key.**
Rejected. Out of scope — chain-hash is about integrity (detect tampering), not confidentiality. Encryption is a separate ADR if needed.

**(D) Require chain-audit for ALL regulatory writes.**
Rejected. Not all regulatory writes require tamper-detection (e.g., user preferences, static configurations). RDC 978 Art. 128 applies to "scientific and technical documentation" — use chain-audit where auditors need to prove integrity, not everywhere.

**(E) Build a UI dashboard for chain breach investigation.**
Rejected. Auditors are technical; CLI tools + JSON reports are sufficient for Phase 4. UI can be added as a nice-to-have in Phase 9.

---

## Compliance alignment

| Standard | Article | Requirement | Satisfied by | Evidence |
|---|---|---|---|---|
| RDC 978 | Art. 128 | Audit trail of scientific documentation | Chain HMAC pattern | `validateChainIntegrity()` detects tampering |
| DICQ | 4.4 | Traceability of audit records | `previousHash` link + `operadorId` | Chain continuity proves no records deleted |
| DICQ | 4.4.1 | Immutability | SHA256 continuity | Hash mismatch = tampering detected |
| DICQ | 4.4.2 | Operator identity | `operadorId == request.auth.uid` | Bound to Firebase Auth claim at write time |

---

## Implementation roadmap

| Milestone | Task | Owner | Timeline |
|---|---|---|---|
| **This commit** | Publish 4 docs + ADR-0031 | Wave 3 Agent 8 | 2026-05-08 |
| **Phase 4 prep** | Link from `v1.4-KICKOFF-SUMMARY.md` | CTO | 2026-05-10 |
| **NOTIVISA Phase 4** | Implement chain audit for submission events; reference cookbook | Wave 4 | 2026-05-20+ |
| **Phase 6+ onboarding** | New module team reads pattern doc + cookbook; implements per template | Module lead | Per phase schedule |
| **Phase 5 validation** | Extend `validateChainIntegrityScheduled` to include criticos | Wave 5 | 2026-05 |

---

## References

- **Pattern documentation:** `docs/PATTERNS_AUDIT_CHAIN_HASH.md`
- **Cookbook:** `docs/AUDIT_CHAIN_HASH_COOKBOOK.md`
- **Indexes:** `docs/FIRESTORE_INDEXES_AUDIT_CHAINS.md`
- **Validation script:** `docs/AUDIT_CHAIN_VALIDATION_SCRIPT.md`
- **Helper implementation:** `functions/src/shared/audit/writeChainedAudit.ts`
- **Crypto module:** `functions/src/modules/audit/cryptoAudit.ts`
- **Canonical use:** `functions/src/modules/compras/notaFiscal.ts`
- **Related ADRs:** ADR-0017 (baseline reset), ADR-0030 (criticos extension), ADR-0012 (logical signature)

---

**Last updated:** 2026-05-08 (Wave 3 Agent 8)

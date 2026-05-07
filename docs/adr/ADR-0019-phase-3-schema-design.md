# ADR-0019 — Phase 3 Schema Design: 5 New Collections + Indices

**Status:** Accepted
**Date:** 2026-05-07
**Decided by:** CTO (drogafarto)
**Related:** ADR-0014 (NOTIVISA), ADR-0015 (Patient Portal)

---

## Context

Phases 4–12 introduce five new use cases:
1. **Patient Portal** (Phase 4) — patient-facing lab results web interface with white-label branding
2. **NOTIVISA Integration** (Phase 5) — automatic regulatory notification submission for critical results
3. **Critical Escalation** (Phase 6) — on-call escalation workflow (SMS/email) for critical values
4. **IA Strip Analysis** (Phase 9) — Gemini Vision feedback loop for immunology strip OCR training
5. **Laudo Draft Editing** (Phase 7) — concurrent RT editing of laudos with pessimistic locking

Each domain introduces new collections to Firestore. The decision is whether to denormalize into existing structures (e.g., add `portal_config` fields to lab doc, add `draft` subcollection to each laudo), or keep collections separate. This ADR documents the chosen design.

---

## Problem

Multiple implementation paths exist:

**(a) Monolithic approach:** Add optional fields to existing documents.
- Example: `labs/{labId}` gains `portalConfig`, `notivisaEnabled`, `criticosThreshold`, `draftLaudo` nested objects.
- **Downside:** Schema bloat, mixed concerns, harder to audit (which field belongs to which module), composite indices become ambiguous, security rules harder to write per-domain.

**(b) Collection per domain (chosen):** Create separate collections under `labs/{labId}/` for each feature.
- Example: `labs/{labId}/portal-configuracao/{docId}`, `labs/{labId}/notivisa-outbox/{docId}`, etc.
- **Upside:** Clean isolation, independent scaling, clear audit scope (NOTIVISA logs are separate from portal config), Firestore rules are module-specific, each domain owns its indices.

**(c) Hybrid:** Shared `features-enabled` flag doc + separate collections only for domains that are active.
- **Downside:** Still requires configuration doc; doesn't simplify the decision.

**Why it matters:** Firestore storage, query performance, and security-rule complexity scale with schema design. A poorly denormalized schema creates technical debt in 3–6 months (phases 10–15).

---

## Decision

We adopt **approach (b) — Collection per domain** with the following structure:

```
labs/{labId}/
  portal-configuracao/
    {config-doc-id}: { logoCdnUrl, primaryColor, termsHTML, ... }
  
  notivisa-outbox/
    {queue-event-id}: { laudo_id, status, attempts, payload, ... }
  
  criticos-escalacoes/
    {escalation-id}: { resultado_id, sms_sent_to, resolved_at, ... }
  
  imuno-ias-dev/
    {training-image-id}: { imageUrl, classesDetected, feedback, ... }
  
  laudos-draft/
    {draft-id}: { laudo_id, edited_by, locked_until_ts, status, ... }
```

Each collection:
- Resides under `labs/{labId}/` (multi-tenant isolation via labId path)
- Has its own Firestore composite indices (no cross-domain indices)
- Defines its own Firestore security rules (module-specific read/write permissions)
- Owns its own subcollections (e.g., `notivisa-outbox/events`, `notivisa-outbox/audit`)

### Design Constraints

1. **No cross-collection joins** — queries run within a single collection. Denormalized references (e.g., laudo doc stores its current draft ID) are acceptable if performance requires it.
2. **Soft-delete applies** — all collections follow RN-06 (soft delete only); no hard deletes.
3. **Audit trail via `events` subcollections** — each collection can have a `{collectionRoot}/audit/{eventId}` subcollection for immutable event log (per ADR-0012).
4. **No temporal queries across collections** — e.g., "all draft edits + NOTIVISA submissions between date X and Y" is two separate queries, not one.

---

## Alternatives Considered

**(a) Monolithic nested objects in `labs/{labId}`**
- **Rejected.** Schema bloat, mixed audit concerns, hard to audit ("which feature made this change?"), Firestore rules become a 200-line god rule instead of 5 per-domain rules. Violates separation of concerns.

**(b) Top-level collections outside lab hierarchy** (e.g., `portal-configs/{labId}`, `notivisa-queue/{labId}`)
- **Rejected.** Breaks multi-tenant isolation pattern established in RN-06. New operators unfamiliar with the codebase would not know where portal config lives.

**(c) Single unified "features" collection** with polymorphic documents (e.g., `labs/{labId}/features/{featureType}`)
- **Rejected.** Firestore has no tagged unions. Queries become `where('featureType', '==', 'portal')` which is slower than a native collection query and makes rules overly generic.

---

## Consequences

**Immediate (within sprint):**
- Create 5 new Firestore collections + 7 composite indices (per task 03-01 PLAN).
- Add TypeScript types for each collection in `src/core/domain/types/`.
- Write Firestore rules for each collection (`firestore.rules` gains ~150 LOC of module-specific rules).
- Create test fixtures for each collection in test suite.

**Positive:**
- Clear separation of concerns; each feature team works in isolation.
- Firestore rules are auditable per-domain (e.g., "is portal-configuracao secured correctly?").
- Indices are feature-specific; no cross-feature index bloat.
- Schema evolution per feature doesn't require reindexing unrelated data.
- Audit logs for each feature can be archived independently.

**Negative:**
- More collections to manage (5 new, potential to grow to 15+ by Phase 12).
- No single "feature config" document (portal + NOTIVISA + critical config live in separate places); operators must know where each feature lives.
- Cross-feature analytics (e.g., "labs with portal + NOTIVISA enabled") requires separate queries to each config collection and client-side join.

**Cost:**
- Firestore free tier allows unlimited collections; no per-collection pricing. Composite indices: ~0.01 reads per query hit (standard Firestore pricing).
- Maintenance: operators must understand the multi-collection hierarchy (mitigation: add a `SCHEMA.md` doc that diagrams the hierarchy and explains each collection's purpose).

**Trade-offs:**
- **Simplicity vs. Isolation:** Monolithic would be simpler to query ("get all lab settings in one read"); we chose isolation for auditability + team independence.
- **Now vs. Later:** This design is locked in Phase 3 and is hard to refactor to monolithic in Phase 10+. We accept the commitment.

---

## Operational Checklist

- [x] Decision documented and agreed by CTO.
- [ ] **Phase 3 Task 03-01:** Create 5 collections in Firestore Console + 7 indices.
- [ ] **Phase 3 Task 03-02:** Add TypeScript types for each collection.
- [ ] **Phase 3 Task 03-03:** Write Firestore rules for each collection (~30 rules total).
- [ ] **Phase 3 Task 03-04:** Add test fixtures and validation tests.
- [ ] **Post-Phase 3:** Update `docs/SCHEMA.md` with hierarchy diagram + collection descriptions.
- [ ] **Post-Phase 3:** Reference this ADR in each module's CLAUDE.md for future maintainers.

---

## References

- `.planning/phases/03-schema-extensions/03-01-PLAN.md` — collection specifications + field schemas
- `firestore.rules` — security rules (will be updated per ADR-0019-phase-3-schema-design-rules.md)
- `src/core/domain/types/` — TypeScript types (will be created)
- ADR-0012 — Soft delete pattern + audit trail
- ADR-0014 — NOTIVISA integration (uses notivisa-outbox collection)
- ADR-0015 — Patient portal (uses portal-configuracao collection)

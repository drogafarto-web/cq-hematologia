# Phases Archive

Archived planning trees from `.planning/phases/`. **Do not use as authoritative source.** Each archived directory has a top-level `_ARCHIVED_<date>.md` note pointing to its canonical replacement.

Archive policy: history-preserving move (`git mv`). Content is read-only here for traceability — never delete, never modify in place.

---

## Index

| Archived path | Original path | Date | Reason | Canonical replacement |
| --- | --- | --- | --- | --- |
| `_archive/05-criticos-ia/` | `phases/05-criticos-ia/` | 2026-05-08 | Earlier draft of Phase 5 (Critical Values + IA Strip), superseded by `-strip` variant | `phases/05-criticos-ia-strip/PHASE_5_OVERVIEW.md` |
| `_archive/05-auditoria-interna/` | `phases/05-auditoria-interna/` | 2026-05-08 | v1.2 Phase 5 (Internal Audit module). Module shipped 2026-05-06. v1.4 internal audit work moved to Phase 13 | `phases/13-dicq-audit/` |
| `_archive/05-portals/` | `phases/05-portals/` | 2026-05-08 | Early patient-portal research. v1.4 portals scope re-numbered: Phase 4 (NOTIVISA portal) and Phase 11 (Patient Portal Phase 2) | `phases/04-portal-notivisa/`, `phases/11-patient-portal-phase2/` |

---

## Authority

The audit-approved canonical Phase 5 plan is `.planning/phases/05-criticos-ia-strip/PHASE_5_OVERVIEW.md` (per `.planning/PHASE_5_CRITICAL_FINDINGS.md` line 117).

Phase 5 scope (v1.4):
- Critical Values escalation (Tasks 05-01, 05-02)
- IA Strip Classifier — RDT serology only, NOT laudo OCR (Tasks 05-03, 05-04)

Stale references to archived paths in other planning docs were updated in the same commit that archived these dirs. If you encounter a broken reference, update it to point to the canonical replacement above.

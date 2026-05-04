# HC Quality — Current State

**Last updated**: 2026-05-04 (Session 2026-05-04 — Phase 2 Complete)

---

## PHASE 2 — COMPLETE ✅

**Status**: Production live (hmatologia2)

### Summary: Phase 2 Batch 1 + Batch 2 Closure

All Phase 2 ADRs and modules deployed in two batches:

**Batch 1 (2026-04-24 → 2026-05-04):**
- ✅ ADR 0001 Wave 2: Audit Trail callable (log + get + validate + report)
- ✅ ADR 0003 Wave 5: NC Blocking gates + 24 E2E tests
- ✅ ADR 0004 Wave 3: POPs UI (versioning, RT training signature)
- **Result**: sgq + pops + auditoria modules live

**Batch 2 (2026-05-04):**
- ✅ controle-temperatura: Rules (CT-01 ✅, CT-04 ✅) + UI + hosting
- ✅ educacao-continuada: 2 new callables (trigger defense, cascade) deployed
- **Result**: 2 additional modules + 2 new callable safeguards live

---

## Phase 2 Batch 1 — DEPLOYED ✅

**Status**: Production live (hmatologia2)

### Phase 2 Batch 2 — Multiple Modules Complete (2026-05-04)

| Module | Deliverable | Status |
|--------|-------------|--------|
| controle-temperatura | FR-11 + IoT ESP32 + assinatura callable | ✅ Deployed |
| educacao-continuada | 2 new callables: trigger defense + soft-delete cascade | ✅ Deployed |

**What's included**:
- **controle-temperatura**: Firestore rules (CT-01 ✅, CT-04 ✅), `ct_commitLeitura` callable, CTDashboard UI
- **educacao-continuada**: `ec_onParticipanteCreated` (trigger defense-in-depth), `ec_softDeleteExecucaoCascade` (atomic cascade)
- Hosting: Live on hmatologia2.web.app with both modules

### Deliverables

| ADR | Module | Status | Commit |
|-----|--------|--------|--------|
| 0001 | Audit Trail (RDC 978 5.3) | ✅ Wave 2 callable complete | 085d5f1 |
| 0003 | NC Blocking Gates (RDC 978 4.2.1) | ✅ Wave 5 E2E tests complete | 085d5f1 |
| 0004 | POPs Versionamento | ✅ Wave 3 UI + smoke tested | be35a40 |

### Production Status

- **Type-check**: ✅ tsc --noEmit clean
- **Build**: ✅ npm run build (33.56s)
- **Firestore rules**: ✅ Deployed to cloud.firestore
- **Functions**: ✅ All functions deployed (57 callables + triggers)
- **E2E tests**: ⏳ Smoke test in progress (6 specs)
- **Hosting**: ✅ Phase 1 code live (hmatologia2.web.app)

### Next Batch

**Phase 2 Batch 2 — Scheduled for**: 2026-05-11 (provisional)

Modules to tackle:
- `controle-temperatura` (FR-11 IoT calibration + rules)
- `educacao-continuada` (Edge cases + UI refinement)
- `sgq/pops` (Cross-audit linking + report generation)

---

## Production Status (as of 2026-05-04)

**Modules live**: 20 / 20 core + regulatory modules
**Tests passing**: 347 / 347
**Type-check**: ✅ Clean
**Compliance blocks**: 13 / 13 RDC violations (audit trail + NC gates + rules strict)

**Deploy artifacts**:
- Hosting: hmatologia2.web.app (PWA with auto-update)
- Functions: 59 callables + 8 triggers + 6 scheduled (southamerica-east1)
- Firestore rules: 800+ lines (strict schema + callable gates)
- Schemas: All Zod-validated inputs + output mappings

---

## Roadmap

| Phase | Status | Modules | Go-live |
|-------|--------|---------|---------|
| Phase 1 | ✅ Complete | 13 core modules | 2026-04 |
| Phase 2 Batch 1 | ✅ Deployed | auditoria + pops + nc-gates | 2026-05-04 |
| Phase 2 Batch 2 | 🔄 Planning | temp-control + ec-refinement | 2026-05 (est) |
| Phase 3 | 📋 Backlog | Analytics + Data Export + Mobile | Q3 2026 |

---

## Production Labs

- `labclin-riopomba` — Active (backfills sealed ✅)

---

## Documentation

- ADRs: `docs/adr/` (0001–0007 implemented)
- Backfill runbook: `.claude/docs/BACKFILL_RUNBOOK.md`
- Phase 2 context: `.planning/.continue-here.md`

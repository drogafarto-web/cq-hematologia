-   **State**: DEPLOYED (v1.4-STABLE)
-   **Last Action**: Full Firebase deployment (Hosting, Firestore, Functions) successful.
-   **Next Action**: Handover and user validation.

## Deployment Progress (v1.4)
- [x] MP-0: Merge & Resolve Conflicts
- [x] MP-1: Firestore Rules & Indexes
- [x] MP-2: Web App Build & Deploy (Hosting)
- [x] MP-3: Cloud Functions Build (Resolved import.meta blocker)
- [x] MP-4: Cloud Functions Deploy
- [x] MP-5: Final Verification (v1.4 live)

---

# HC Quality — Current State

**Last updated**: 2026-05-06 (Session 2026-05-06 — Phase 12 Plan 03 Complete)

---

## PHASE 12 — SGD + Drive Importer (v1.3 Riopomba Migration) ✅

**Status**: Plans 01–03 COMPLETE (3,300 LOC production code). Plans 04–06 ready for execution.

**Phase 12 Completion Status**:
- ✅ Plan 12-01: SGQ schema extension (15 types, LD, hierarchy, multi-tenant) — 2026-04-24
- ✅ Plan 12-02: UI components (LM-01, hierarquia tree, distribuição matrix, transição vigência) — 2026-05-05
- ✅ Plan 12-03: Drive Importer (OAuth + 5 callables + 5-step wizard) — 2026-05-06
- ⏳ Plan 12-04: Riopomba pilot (30 docs staging) — execution playbook ready
- ⏳ Plan 12-05: Production migration (80 docs) — execution playbook ready
- ⏳ Plan 12-06: Polish + deploy + ADR 0012 — execution playbook ready

**What's Complete (2026-05-06)**:
- ✅ OAuth2 client (google-auth-library) with token refresh + Firestore storage
- ✅ LM-01 Google Sheets parser (15 document types, 17 sectors, Zod validation)
- ✅ Drive API wrapper (list files, preview/download docs, HTML sanitization)
- ✅ 5 Cloud Functions callables:
  - oauthCallbackDrive (HTTP callback, code → tokens)
  - listarDocsDrive (parse LM-01, list Drive files, detect gaps)
  - previewDocDrive (download + export as markdown/PDF)
  - classificarDocAuto (heuristic classification: código → tipo + confidence)
  - aprovarBatchImport (atomic writeBatch create + idempotent hash dedup)
- ✅ 5-step ImporterWizard React components (consent → list → preview → mapping → confirm)
- ✅ Drive import service layer (client-side callable wrappers)
- ✅ Idempotent batch import (SHA256(driveFileId + labId) deduplication)
- ✅ Audit logging on all operations (sgq-import-jobs, sgq-import-logs, sgq-classificacao-logs)
- ✅ Multi-tenant enforcement (labId in all payloads + Firestore paths)
- ✅ Dark-first UI design, WCAG AA accessibility ready
- ✅ TypeScript clean (tsc --noEmit 0 errors)
- ✅ Build clean (npm run build 27s)
- ✅ All functions exported from functions/src/index.ts

**Projected DICQ Impact (Post-Migration)**:
- Current Riopomba baseline: 71.3%
- Target after Phase 12: ≥76% (+5 points in Block B)
- Items closed: 4.2.2.2 (LM), 4.3 (hierarquia, versão, distribuição)

**Next Steps (Plans 04-06)**:
1. CTO: Setup OAuth credentials + deploy to staging
2. RT Bruno: Validate pilot (30 docs) using EXECUTION_READY.md playbook
3. RT Bruno: Migrate production (80 docs) + batch approve
4. CTO: Deploy + finalize + ADR 0012

---

## PHASE 5 — WAVE 3 COMPLETE ✅

**Status**: Audit PDF export live. Ready for production deploy.

**What's complete**:
- ✅ `generateAuditReportPDF` Cloud Function (Puppeteer server-side, ~115 DICQ items, achados with severity, NC links, RT signature)
- ✅ `useAuditReportExport` hook + UI button (frontend export integration)
- ✅ E2E test: create audit → register achado → generate PDF → verify <10MB
- ✅ File wired in functions index + frontend hooks exported

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

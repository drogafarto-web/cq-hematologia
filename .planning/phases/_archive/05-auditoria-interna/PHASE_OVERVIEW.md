# Phase 5: Auditoria Interna — Complete Planning

**Phase Goal:** Construct Auditoria Interna module (DICQ 1.3) and deploy to production. Enable execution of internal audit using HC Quality itself.

**Duration:** 10-12 days  
**Requirements Covered:** AUDI-01, AUDI-02, AUDI-03, AUDI-04, AUDI-05, AUDI-06  
**Critical Path:** P5 → P7 (must complete before dry-run audit)

---

## Wave Structure

```
Wave 1 (Days 1-3, parallel):
├── 05-01: Foundation (types, service, hooks, rules, templates)
└── Parallel possible: Phase 4 rules deploy

Wave 2 (Days 4-7, parallel):
├── 05-02: UI components (planning, execution, findings)
└── 05-03: Cloud Functions (callables, template loading, NC integration)
           (can start after 05-01 complete)

Wave 3 (Days 8-10, dependent on Wave 2):
└── 05-04: PDF generation + E2E tests
```

---

## Plans Breakdown

### 05-01: Foundation (Wave 1)
**Status:** Ready to execute  
**Autonomous:** Yes  
**Output:** Types, service layer, hooks, Firestore rules, checklist seed

**Tasks (6):**
1. Type definitions for Auditoria, Sessao, ChecklistItem, Achado, LogicalSignature
2. Service layer (CRUD, soft-delete, real-time subscribers)
3. React hooks (useAuditorias, useChecklistTemplate, useSessao, useAchadoMutation)
4. Firestore rules (deny all direct writes, read allowed to members)
5. Firestore composite indices (status+time, severity+time, etc.)
6. Checklist template seed (~115 DICQ items) + template service

**Files Modified:** 7  
**Dependencies:** None (independent)  
**Estimated Effort:** ~3 days  
**Acceptance:** Types compile, service ready for consumption, rules tested

---

### 05-02: UI Components (Wave 2)
**Status:** Ready to execute (after 05-01)  
**Autonomous:** No (has checkpoint: human-verify UI on tablet)  
**Output:** Dark-first, tablet-optimized UI for audit planning + execution + findings entry

**Tasks (4):**
1. AuditoriaView entry point + AuditoriaPlanning (create annual plan form)
2. SessaoExecucaoPanel (in-loco checklist execution) + ChecklistItemCard (individual item renderer)
3. AchadoForm (finding entry with evidence upload)
4. Module wiring (View enum, AuthWrapper routing, hub tile, sidebar)

**Files Modified:** 6  
**Dependencies:** 05-01 (types, service, hooks)  
**Estimated Effort:** ~3 days  
**Checkpoint:** Smoke test on iPad/Android tablet 10", verify responsiveness + offline support  
**Acceptance:** UI renders, auditor can create plan, start session, mark items, upload evidence

---

### 05-03: Cloud Functions (Wave 2, parallel to 05-02)
**Status:** Ready to execute (after 05-01)  
**Autonomous:** No (has checkpoint: test callables in emulator)  
**Output:** Server-side logic for template loading, achado registration, automatic NC creation

**Tasks (5):**
1. Enhance registerAchado: signature generation + auto-NC creation (severity >= grave)
2. Create achadoToNC helper: bidirectional linking (achado ↔ NC)
3. installChecklistTemplate callable: load ~115 DICQ items into session
4. updateChecklistResponses callable: batch-sync offline draft responses
5. Update Firestore rules (Phase 05-01 preparation) + register callables

**Files Modified:** 6  
**Dependencies:** 05-01 (types, rules, template seed)  
**Estimated Effort:** ~3 days  
**Checkpoint:** Test all 3 callables in emulator (registerAchado, installChecklistTemplate, updateChecklistResponses)  
**Acceptance:** Callables callable via emulator, NC auto-created for grave findings, template loads correctly

---

### 05-04: PDF Generation + E2E (Wave 3)
**Status:** Ready to execute (after 05-02 + 05-03)  
**Autonomous:** Yes  
**Output:** PDF report generation + E2E test covering full audit workflow

**Tasks (5):**
1. generateAuditReportPDF Cloud Function (puppeteer-based, server-side rendering)
2. useAuditReportExport hook (client-side PDF download trigger)
3. Add "Exportar PDF" button to AuditoriaDetail component
4. E2E test: create auditoria → execute checklist → register finding → generate PDF
5. Register callable in functions/src/index.ts

**Files Modified:** 5  
**Dependencies:** 05-02, 05-03 (all prior work)  
**Estimated Effort:** ~2 days  
**Acceptance:** PDF generated <10MB, stored in Cloud Storage, signed URL works, E2E test green

---

## Dependency Graph

```
05-01 (Foundation)
  ├── Type definitions (Auditoria, Sessao, ChecklistItem, Achado)
  ├── Service layer (CRUD, soft-delete)
  ├── React hooks (useAuditorias, useSessao, useAchadoMutation)
  ├── Firestore rules (all writes forbidden, reads allowed)
  └── Checklist template seed (~115 DICQ items)
       │
       ├─→ 05-02 (UI Components)
       │    ├── AuditoriaView + AuditoriaPlanning
       │    ├── SessaoExecucaoPanel + ChecklistItemCard
       │    ├── AchadoForm
       │    └── Module wiring (AuthWrapper, hub, sidebar)
       │         │
       │         └─→ 05-04 (PDF + E2E)
       │              ├── generateAuditReportPDF callable
       │              ├── useAuditReportExport hook
       │              ├── "Exportar PDF" button
       │              └── E2E test (full workflow)
       │
       └─→ 05-03 (Cloud Functions)
            ├── Enhanced registerAchado (signature + NC creation)
            ├── installChecklistTemplate callable
            ├── updateChecklistResponses callable
            └── achadoToNC helper
                 │
                 └─→ 05-04 (PDF + E2E)
```

---

## File Inventory

### Frontend (src/features/auditoria-interna/)
- **types/index.ts** — Entity definitions (Auditoria, Sessao, ChecklistItem, Achado)
- **services/auditoriaService.ts** — CRUD + real-time subscribers
- **services/checklistTemplateService.ts** — Template loading
- **hooks/useAuditorias.ts** — Real-time auditoria hook
- **hooks/useSessao.ts** — Session + checklist + achados hook
- **hooks/useAchadoMutation.ts** — Finding registration hook
- **hooks/useAuditReportExport.ts** — PDF download hook
- **components/AuditoriaView.tsx** — Main entry point
- **components/AuditoriaPlanning.tsx** — Annual plan creation
- **components/SessaoExecucaoPanel.tsx** — In-loco execution
- **components/ChecklistItemCard.tsx** — Individual item renderer
- **components/AchadoForm.tsx** — Finding entry form
- **components/AuditoriaDetail.tsx** — Audit summary + export button
- **data/checklistTemplates.json** — Seed template (~115 DICQ items)
- **index.ts** — Module barrel export
- **CLAUDE.md** — Module rules + status

### Backend (functions/src/modules/auditoria/)
- **types.ts** — Type definitions (Auditoria, Sessao, etc.)
- **auditoria.ts** — Core callables (createAuditoria, registerAchado, createPlanoAcao, closeAuditoria, updateChecklistResponses)
- **checklistTemplate.ts** — installChecklistTemplate callable
- **generateAuditReportPDF.ts** — PDF generation (puppeteer)
- **achadoToNC.ts** — Helper to map achado → NC
- **index.ts** — Module exports

### Infrastructure
- **firestore.rules** — Security rules (auditorias-internas collection)
- **firestore.indexes.json** — Composite indices (status+time, severity+time, etc.)
- **functions/package.json** — Puppeteer dependency

### Tests
- **src/__tests__/auditoria-interna.test.ts** — E2E test (6 cases)

---

## Security Model

### Authentication
- All callables require `request.auth` (signed-in user)
- Lab membership validated via `isActiveMemberOfLab(labId, uid)`
- Role-based UI gating: auditor + responsavelTecnico only

### Data Integrity
- LogicalSignature on every achado: hash (SHA-256) + operatorId + ts
- Soft-delete only (RN-06): never hard-delete audit records
- Atomic batch writes: achado + NC link together (both succeed or both fail)
- Firestore rules enforce: no direct client writes (callable-only pattern)

### Audit Trail
- Every mutation logged with operatorId + timestamp
- Chain-hash preserved (achado signatures immutable)
- NC creation tracked (achadoId back-reference)
- 5-year retention on all records (Firestore + Storage lifecycle)

---

## Quality Gates

### 05-01 Completion Criteria
- [ ] TypeScript compiles without errors
- [ ] Service layer tested (snapshot mapping, cleanup)
- [ ] Firestore rules tested in emulator
- [ ] Checklist template has ~115 items (DICQ 4.3 + RDC 978)

### 05-02 Completion Criteria
- [ ] UI renders without errors
- [ ] Smoke test on tablet: create plan → start session → execute checklist → upload evidence
- [ ] Offline mode works (localStorage draft, sync on reconnect)
- [ ] Dark-first design applied (no generic templates)
- [ ] Touch targets ≥32px (ergonomic for in-loco use)

### 05-03 Completion Criteria
- [ ] registerAchado callable creates achado + signature + auto-creates NC for grave findings
- [ ] installChecklistTemplate callable loads ~115 items atomically
- [ ] updateChecklistResponses callable syncs offline responses
- [ ] All callables tested in Firebase emulator
- [ ] Zod input validation on all callables

### 05-04 Completion Criteria
- [ ] generateAuditReportPDF callable renders HTML → PDF (puppeteer)
- [ ] PDF file <10MB
- [ ] Signed URL generated (7-day expiry)
- [ ] E2E test: create → execute → export PDF (all green)
- [ ] Functions build + deploy succeeds

---

## Risk Mitigation

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|-----------|
| 05-01 sub-estimated (~2 types, ~10 functions per service) | 🟢 | Low | Template seed already exists (Obsidian); service pattern established (educacao-continuada reference) |
| 05-02 tablet UX friction (responsive design complex) | 🟠 | Medium | CSS grid + flexbox tested; media queries for portrait/landscape; checkpoint for human verify |
| 05-03 callable + NC linking race condition | 🔴 | Low | Atomic batch write (both succeed/fail together); tests cover |
| 05-04 puppeteer cold start delay (5-10s) | 🟠 | Medium | Acceptable for report generation (not user-blocking); document in release notes |
| Checklist template mismatch with actual DICQ 8th ed. | 🟠 | Medium | Use Obsidian checklist as source of truth (already validated by auditor); version seed as v1.0 |

---

## Rollback Plan

**If Phase 5 encounters blocker before Wave 3 (05-04):**
1. Pause 05-04 (PDF generation is nice-to-have, not blocking audit dry-run)
2. Proceed to Phase 7 with manual PDF export (user creates PDF from browser print)
3. Resume 05-04 in post-Phase-7 cleanup

**If critical bug found in deployed callables:**
1. Rollback functions/src/modules/auditoria/* to prior version
2. Deploy hosting rollback (UI still works with stale data)
3. Trigger fix + redeploy (no data loss — audit records immutable via soft-delete)

---

## Success Metrics

| Metric | Target | Acceptance |
|--------|--------|-----------|
| Modules in prod | 25 (+ auditoria-interna) | ✅ Tile visible in hub |
| AUDI requirements covered | 6/6 (AUDI-01 through AUDI-06) | ✅ All 6 assigned to plans |
| E2E test coverage | Full audit workflow | ✅ Create → execute → export |
| Firestore rules strict | 0 client direct writes | ✅ All writes via callables |
| Performance | LCP <2.5s, INP <200ms | ✅ Service layer optimized, lazy loading components |
| Accessibility | WCAG AA minimum | ✅ Dark theme meets contrast (4.5:1), keyboard nav supported |

---

## Deployment Sequence

**Day 0 (Phase 4 complete):**
- Rules for auditorias-internas deployed (Phase 05-01)
- Checklist template seed in place

**Day 3-4 (Wave 1 complete):**
- Types, service, hooks deployed to client
- 05-01 checkpoint: types compile, service ready

**Day 5-7 (Wave 2 parallel):**
- 05-02 UI components deployed to hosting
- 05-03 Cloud Function callables deployed to functions
- Checkpoint: UI smoke test on tablet (05-02) + callable tests in emulator (05-03)

**Day 8-10 (Wave 3):**
- 05-04 PDF generation deployed
- E2E test suite green
- Module "audit-ready" for Phase 7 dry-run

**Day 11-12 (Buffer + Phase 7 prep):**
- Final smoke test in prod
- Dry-run audit execution (Phase 7 starts)

---

## Known Limitations (v1.0)

- **Evidence storage:** MVP uses base64 inline (<5MB). Phase 05-04+ can upgrade to Firebase Storage + signed URLs.
- **Calendar view:** Phase 05-02 planning UI is basic (list-based). Fancy calendar for v1.1.
- **CAPA forms:** Corrective action plan form deferred to Phase 7+ (audit dry-run will reveal needed structure).
- **Multi-language:** Portuguese (pt-BR) only. English support in v1.1.
- **PDF signatures:** Logical signature included; electronic signature (eIDAS/ICP-Brasil) deferred to v1.1.

---

## Hand-off to Phase 6

Phase 5 completion unblocks Phase 6 (Compliance Operacional — LGPD + DR) to run in parallel.

**Phase 6 dependencies on Phase 5:**
- LGPD deletion flow must preserve audit trail (achieved via soft-delete pattern in Phase 5)
- DR restore test must not corrupt audit records (Phase 5 audit trail immutable)

**Phase 5 clean-up tasks for Phase 6:**
- [ ] Verify soft-delete pattern prevents audit trail corruption
- [ ] Document LGPD-compliance in auditoria module (PII handling, retention)
- [ ] Checklist template versioning documented (audit trail of template changes)

---

## Hand-off to Phase 7

Phase 5 completion blocks Phase 7 (Audit Dry-Run) waiting on full deployment + smoke test.

**Phase 7 will use Phase 5 module to:**
1. Create annual audit plan (DICQ + RDC 978)
2. Execute full checklist (~115 items)
3. Register critical findings (auto-create NCs)
4. Export PDF report
5. Document evidence of audit execution

**Phase 7 success = evidence that Phase 5 module works as designed.**

---

## Contact & Questions

**CTO ownership:** Phase 5 is critical path to compliance audit. Any blockers → escalate immediately.

**Audit trail is non-negotiable:** Soft-delete, signatures, immutability — these are RDC 978 requirements. No shortcuts.

**Quality over speed:** Production-ready code, tested thoroughly, documented for auditor review. Rushing introduces risk.

---

**Status:** Ready for execution  
**Start Date:** 2026-05-06 (Day 1 of Milestone v1.2)  
**Target Completion:** 2026-05-18 (Day 13)  
**Critical Path Item:** Yes — blocks Phase 7

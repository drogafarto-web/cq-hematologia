---
date: 2026-05-04
phase: 1-2-transition
status: planning
---

# Execution Plan: ADR 0007 + Phase 2 (Tiro Único)

**Approach:** Aggressive parallel execution through context boundaries using background agents.

---

## Timeline Overview

```
ADR 0007 (Equipamento):
├─ Wave 1 (Design):       ✅ DONE (WAVE1-ADR-0007-DESIGN.md)
├─ Wave 2 (Implementation): ~8-12 hours
│  ├─ Cloud Functions + tests
│  ├─ Module integration (5 CIQ + 1 CT)
│  └─ Scheduled validators
├─ Wave 3 (Deploy):        ~2 hours
│  ├─ Build + Firebase deploy
│  └─ Smoke tests
└─ Wave 4 (Phase 1 Gate):   ~1 hour
   └─ Spine integrity check + CTO sign-off

         ↓ GATE: Phase 1 100% ✓ + ADR 0007 live

Phase 2 (13 Modules, 3 Batches Paralelo):
├─ Batch 1: POPs + NC + Auditoria (3 modules, 6-8 semanas)
├─ Batch 2: RH + Infraestrutura (5 modules, paralelo)
└─ Batch 3: Analítico + Pós-Analítico (5 modules, paralelo)
```

---

## ADR 0007 Execution (Days 1-4)

### Day 1: Wave 2 Implementation (Inline, Haiku context)

**Morning (3-4h):**
- Cloud Functions: agendarProximaCalibracacao, registrarCalibracacao, registrarManutencao, validarCalibracaoEquipamento
- Types.ts for Equipamento, Calibracao, Manutencao
- Unit tests skeleton (12+ cases)

**Afternoon (2-3h):**
- Module integration: hematologia, imunologia, coagulacao, uroanalise, bioquimica, controleQualidade
- Add gate checks + denormalization
- Test compilation

**Commit:** "Wave 2 ADR 0007: Cloud Functions + Integration"

### Day 2: Wave 3 Deployment

**Morning (1h):**
- npm run build verify
- firebase deploy --only functions
- firebase deploy --only firestore:rules (include ADR 0007 patch)

**Afternoon (2h):**
- Smoke tests: calibration gate blocking, denormalization, scheduled validators trigger
- Backfill script: test with --dry-run

**Commit:** "Wave 3 ADR 0007: Deploy + Smoke Tests Pass"

### Day 3: Wave 4 Validation Gate

**Morning (1h):**
- Spine integrity scan: verify all 13 violations resolved (V-001 to V-013)
- Chain-hash validation: run validateChainIntegrityOnDemand
- LGPD compliance check: qualificacoes + audit signed

**Afternoon (30min):**
- Create PHASE1-COMPLETION.md with metrics + sign-off

**Commit:** "Phase 1 Complete: ADR 0007 live, spine integrity verified, CTO sign-off ✓"

---

## Phase 2 Batches (Days 4+, Paralelo)

**Once Phase 1 gate passes:** Spawn 3 subagents simultaneously

### Batch 1: Sistema de Qualidade (6-8 semanas)

**Modules:**
1. POPs — POP management UI, versioning, training assignment
2. NC + CAPA — NC list, status tracking, CAPA workflow UI
3. Auditoria Interna — Audit checklist, findings → NCs, plano anual

**Dependencies:** ADR 0004 (POPs), ADR 0003 (NC) — both live ✓

**Deliverables:** 3 modules, full CRUD + workflow, tests >80%

### Batch 2: RH + Infraestrutura (6-8 semanas, paralelo com Batch 1)

**Modules:**
1. Treinamentos + Reciclagem — Training registry per POP version, expiry, evidence
2. Biossegurança — Area mapping, flow, PPE, biosafety checks
3. PGRSS — Waste generation, segregation, collection, compliance
4. KPIs — Dashboard: turnaround, rework, NC origins, compliance %
5. LGPD — Policy portal, deletion process, DPIA workflows

**Dependencies:** ADR 0004 (POPs), ADR 0006 (Pessoa), ADR 0007 (Equipamento) — all live ✓

**Deliverables:** 5 modules, dashboards, compliance workflows, tests >80%

### Batch 3: Analítico + Pós-Analítico (6-8 semanas, paralelo)

**Modules:**
1. CIQ Bioquímica — Run creation, reagent pairing, result entry, popId + equipId enforcement
2. CEQ — External proficiency enrollment, sample tracking, Z-score analysis, auto-NC on deviation
3. Validação Métodos — Method validation: linearity, precision, accuracy, reference ranges
4. Liberação Laudos — Dupla checagem críticos, approval flow, 5-year retention
5. Comunicação Críticos — Critical result criteria, communication registry, tracking

**Dependencies:** ADR 0004 (POPs), ADR 0007 (Equipamento), ADR 0003 (NC) — all live ✓

**Deliverables:** 5 modules, CIQ data model, workflows, tests >80%

---

## Subagent Delegation Strategy

### Agent A: Batch 1 Executor
- **Task:** Implement POPs + NC + Auditoria modules
- **Context:** Full design specs from ROADMAP.md
- **Output:** Code, tests, deployment guide
- **Duration:** 6-8 semanas (background, paralelo)

### Agent B: Batch 2 Executor
- **Task:** Implement RH + Infraestrutura modules
- **Context:** Full design specs from ROADMAP.md
- **Output:** Code, tests, deployment guide
- **Duration:** 6-8 semanas (background, paralelo)

### Agent C: Batch 3 Executor
- **Task:** Implement Analítico + Pós-Analítico modules
- **Context:** Full design specs from ROADMAP.md
- **Output:** Code, tests, deployment guide
- **Duration:** 6-8 semanas (background, paralelo)

**Orchestration:**
- All 3 agents run in parallel (no dependencies between batches)
- Weekly sync: status updates, blockers, decisions
- Deployment gates: Each batch must pass smoke tests before prod deploy
- Final integration: All 3 batches + ADR 0007 = Phase 2 complete

---

## Success Metrics

### ADR 0007 (Phase 1)
- ✓ Equipamento collection with calibration gate
- ✓ All 6 CIQ modules enforce gate + denormalize equipId
- ✓ Scheduled validators running (overdue detection)
- ✓ Auto-NC creation on overdue calibration
- ✓ Phase 1 spine integrity: 0% violations
- ✓ Chain-hash validation passing
- ✓ CTO sign-off: "Phase 1 ready for Phase 2"

### Phase 2 (13 Modules)
- ✓ 13 modules deployed (Batch 1 + 2 + 3)
- ✓ Batch 1: POPs, NC, Auditoria fully functional
- ✓ Batch 2: Treinamentos, Biossegurança, PGRSS, KPIs, LGPD active
- ✓ Batch 3: CIQ Bioquímica, CEQ, Validação, Liberação, Críticos live
- ✓ All modules >80% test coverage
- ✓ Zero critical bugs in smoke tests

---

## Risks & Mitigations

| Risk | Sev | Mitigation |
|------|-----|-----------|
| ADR 0007 implementation overruns (context limit) | 🔴 | Split into modular waves; use background agents if context critical |
| Phase 1 gate fails (spine violation found) | 🟠 | Have ADR remediation ready; verify all integration points before gate |
| Batch agents diverge on design/patterns | 🟠 | Provide detailed design specs + code templates; weekly sync required |
| Phase 2 deployment blocked by prod gate | 🟠 | Run smoke tests on staging Firebase project first |

---

## Deployment Sequence (Final)

1. **ADR 0007 → Prod** (Day 3)
   ```
   firebase deploy --only functions
   firebase deploy --only firestore:rules
   ✓ Verify: validarCalibracaoEquipamento, checkOverdueCalibracoes live
   ```

2. **Phase 1 Gate Validation** (Day 4)
   ```
   Spine integrity report: V-001 through V-013 all resolved
   Chain-hash validation: scheduled + on-demand both passing
   CTO sign-off: "Phase 1 compliant"
   ```

3. **Batch 1 → Prod** (Week 8)
   ```
   firebase deploy --only functions (POPs + NC + Auditoria)
   firebase deploy --only firestore:rules (new collections)
   ✓ Smoke tests pass
   ```

4. **Batch 2 → Prod** (Week 8, parallel)
   ```
   (simultaneous with Batch 1)
   ```

5. **Batch 3 → Prod** (Week 14)
   ```
   (after Batch 1 + 2 stabilized)
   ```

---

## Next Action

**Proceed with ADR 0007 Wave 2 implementation (inline):**

1. Create `functions/src/modules/equipamentos/types.ts` (120 lines)
2. Create `functions/src/modules/equipamentos/index.ts` (Cloud Functions, 400+ lines)
3. Create `functions/src/modules/equipamentos/equipamentosValidator.ts` (gate + validators, 150 lines)
4. Create `functions/src/modules/equipamentos/equipamentos.test.ts` (12+ test cases)
5. Update CIQ modules: add gate check + denormalization (5 modules)
6. Create firestore.rules.adr-0007.patch (100+ lines)
7. Create backfill script: `functions/scripts/backfill-equipamentos.mjs`

**Commit trigger:** After compilation passes

---

**Status:** Planning complete, ready to execute  
**CTO approval:** Proceed? (Y/N)


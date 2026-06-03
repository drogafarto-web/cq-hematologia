---
phase: 1
plan_ref: PLAN-ADR-0003-0004.md
status: in_progress
start_time: 2026-05-02T23:30:00Z
execution_mode: parallel_subagents
---

# EXECUTE — ADR 0003 & 0004 (Parallel Waves 1-5)

**Orchestration:** Two independent subagents, each executing their ADR sequentially through 5 waves.

**Parallel Structure:**

```
Subagent 1: ADR 0003 (NC Global)     Subagent 2: ADR 0004 (POP Versionado)
├─ Wave 1 (Days 1-3)                 ├─ Wave 1 (Days 1-3)
│  └─ Design + Schema                │  └─ Design + Versioning Spec
├─ Wave 2 (Days 4-6)                 ├─ Wave 2 (Days 4-6)
│  └─ Cloud Functions                │  └─ Cloud Functions
├─ Wave 3 (Days 7-9)                 ├─ Wave 3 (Days 7-9)
│  └─ 7-Module Integration           │  └─ Wire popId into Runs
├─ Wave 4 (Days 10-12)               ├─ Wave 4 (Days 10-12)
│  └─ Tests (Unit + E2E)             │  └─ Tests (Unit + E2E)
└─ Wave 5 (Days 13-14)               └─ Wave 5 (Days 13-14)
   └─ Deploy + Monitoring            └─ Deploy + Monitoring
```

---

## Subagent 1: ADR 0003 — NC Global (Non-Conformidade Spine)

**Owner:** gsd-executor (subagent)  
**Plan Reference:** PLAN-ADR-0003-0004.md § ADR 0003  
**Deliverables:** 14 files (types.ts, CF, tests, backfill, rules patch)  
**Success Criteria:** NC schema deployed, 7-module integration live, CAPA workflow enforced, blocking gates tested

**Waves:**

1. **Wave 1 (Days 1-3):** Design + Schema + Backfill Strategy
   - Finalize NaoConformidade interface
   - Design CAPA workflow state machine
   - Plan migration from NCTemps → NaoConformidade
   - Update STATE.md with schema

2. **Wave 2 (Days 4-6):** Cloud Functions + Validators
   - Implement: openNaoConformidade(), updateNaoConformidade(), applyCAPAwithValidation()
   - Create: naoConformidade.ts, capaWorkflow.ts, naoConformidade.test.ts
   - HMAC integration via ADR 0005

3. **Wave 3 (Days 7-9):** 7-Module Integration
   - Add checkNCs() gate to: Insumos, Equipamento, Controle de Qualidade, Pessoas, POPs, Evoluções, Auditoria
   - Update each module's functions: beforeCreate/beforeUpdate gates
   - Create per-module integration tests

4. **Wave 4 (Days 10-12):** Tests + Firestore Rules
   - Unit tests: NC creation, status machine, CAPA flow, HMAC signing
   - Integration tests: E2E open in module → block → investigate → close
   - Create firestore.rules.adr-0003.patch
   - Test blocking of critical NCs

5. **Wave 5 (Days 13-14):** Deploy + Monitoring
   - Deploy functions (all 7 modules + NC)
   - Deploy Firestore rules
   - Run migration script: backfill-naoConformidade.mjs
   - Monitor: NC creation rate, blocking events, CAPA workflow usage
   - Create SUMMARY.md with metrics

---

## Subagent 2: ADR 0004 — POP Versionado (Procedure Versioning)

**Owner:** gsd-executor (subagent)  
**Plan Reference:** PLAN-ADR-0003-0004.md § ADR 0004  
**Deliverables:** 12 files (types.ts, CF, validator, tests, backfill, rules patch)  
**Success Criteria:** POP versioning deployed, RT signatures enforced, operator training linked, all CIQ runs reference popId

**Waves:**

1. **Wave 1 (Days 1-3):** Design + Schema + Versioning Spec
   - Finalize POP and POPVersao interfaces
   - Design versioning auto-increment (v1.0, v1.1, v2.0)
   - Plan wire-in to CIQ modules (Hematologia, Imunologia, etc)
   - Plan backfill for existing runs

2. **Wave 2 (Days 4-6):** Cloud Functions + Validators
   - Implement: createPOP(), createPOPVersion(), assinaturaRT(), canOperadorUsarPOP()
   - Create: pop.ts, popValidator.ts, pop.test.ts
   - Qualificacao extension: treinamentosPOP[] array

3. **Wave 3 (Days 7-9):** Wire popId into CIQ Runs
   - Update Hematologia, Imunologia, Coagulacao, Uroanalise, Bioquimica modules
   - Add popReferencia denormalization on run save
   - Create popValidator.checkTrainingValid() call in beforeRunSave()
   - Create backfill script: retroactively wire existing runs (safe: denormalization only)

4. **Wave 4 (Days 10-12):** Tests + Firestore Rules
   - Unit tests: POP creation, versioning increment, RT signature, training check
   - Integration tests: E2E POP create → operator trains → uses in run → auditable
   - Create firestore.rules.adr-0004.patch
   - Test training expiration gate

5. **Wave 5 (Days 13-14):** Deploy + Monitoring
   - Deploy functions (all CIQ modules + POP)
   - Deploy Firestore rules
   - Run migration script: backfill-pop-reference.mjs
   - Monitor: POP adoption, training rates, version usage distribution
   - Create SUMMARY.md with metrics

---

## Synchronization Points

Both subagents must coordinate on:

1. **Firestore Rules Merge:** ADR 0003 + ADR 0004 rules patches applied together in Wave 5
2. **CIQ Module Updates:** Both ADRs modify same modules (gate + wire calls)
   - Solution: Coordinate in Wave 3 (integration) — no file conflicts expected, calls are orthogonal
3. **Backfill Scripts:** Run separately but log both in Wave 5 monitoring
4. **Final Deployment:** Both go live in same `firebase deploy --only functions` call

---

## Success Metrics

**ADR 0003:**

- NaoConformidade collection created in all labs
- 0 NC-related data loss (migration 1:1)
- Critical NC blocking tested and verified
- CAPA workflow: open→investigate→action→verify→close cycle tested

**ADR 0004:**

- POP collection versioned (v1.0, v1.1 format)
- All active CIQ runs have popReferencia (100% coverage post-backfill)
- Operator training on POP enforced (tested)
- RT signature verification working (ADR 0005 integration verified)

**Combined:**

- 0% service disruption (dual-mode Firestore rules during migration)
- 100% audit trail coverage (all NC + POP changes HMAC-signed)
- Smoke tests: Open NC in Insumo (gravity=grave) → block use → investigate → remediate → close
- Smoke tests: POP v1.1 released → operators train → next run forces v1.1

---

## Cleanup After Waves Complete

1. **Delete temporary files:**
   - backfill-naoConformidade.mjs (after successful run)
   - backfill-pop-reference.mjs (after successful run)

2. **Update STATE.md:** Mark ADR 0003 & 0004 complete, update to "phase1-wave3-complete"

3. **Git commits:** Each wave → one commit with summary (e.g., "ADR 0003 Wave 1 complete: NC schema + backfill strategy")

4. **Next phase:** ADR 0007 (Equipamento) can start immediately (no blockers)

---

## Abort Conditions

Stop and escalate to CTO if any of:

- HMAC signature mismatch in ADR 0005 integration (breaks chain)
- Firestore rules compilation error
- Backfill script affects >10% of data unexpectedly
- Module integration: gate logic breaks existing happy-path tests

---

**Initiator:** Claude Code  
**Time:** 2026-05-02 23:30 UTC  
**Status:** Ready to spawn subagents

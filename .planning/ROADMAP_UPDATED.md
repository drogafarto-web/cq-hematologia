# HC Quality Roadmap — Milestone v1.2 (Audit Readiness)

**Milestone:** v1.2 — Audit Readiness
**Period:** 2026-05-06 → 2026-06-05 (30 dias)
**Updated:** 2026-05-06
**Owner:** CTO

> **Histórico:** Roadmaps anteriores (v1.0 Phase 1-2, v1.1 Phase 3.x) arquivados em `.planning/phases/` + `MILESTONES.md`.

---

## Phase 6 — Compliance Operacional (Days 10-20)

**Goal:** Endurecer LGPD + formalizar Disaster Recovery. Pré-requisitos não-bloqueantes para auditoria.

**Duration:** 5-7 dias

**Requirements coberto:** LGPD-01, LGPD-02, LGPD-03, DR-01, DR-02

**Deliverables:**
- DPIA preenchida em `/labs/{labId}/lgpd/dpia` com versionamento; UI admin renderiza
- Fluxo `/exclusao-titular` E2E: CPF → OTP/email → CF `deleteTitularData` (zera PII, mantém audit chain-hash)
- Página `/privacidade` com versionamento + registro de aceite por usuário
- `docs/DR_PLAN.md` cobrindo 4 cenários (corruption, outage, credentials, ransomware)
- `docs/DR_RESTORE_TEST_2026-05.md` documentando restore real em staging com verificação de integridade

**Success criteria:**
1. Admin pode imprimir DPIA como PDF (auditor pede)
2. Titular consegue solicitar exclusão; CF zera PII e mantém chain-hash íntegro (teste E2E verde)
3. Política de privacidade tem registro de aceite armazenado por usuário
4. Plano de DR existe e é executável (referenciado em SGQ)
5. Restore real comprovado: snapshot prod restaurado em staging, integridade verificada

**Plans:**
- [ ] `06-01-PLAN.md` — LGPD: DPIA form, /exclusao-titular flow, /privacidade page, deleteTitularData CF, E2E tests (Wave 1, depends on none) ✅ PLAN CREATED
- [ ] `06-02-PLAN.md` — DR: Plan document, runbooks, backup/restore scripts, restore test execution + validation (Wave 1, depends on none) ✅ PLAN CREATED

**Execution notes:**
- Both plans run in parallel (Wave 1). No file conflicts or dependencies.
- Plan 06-01 has 1 checkpoint (human verification of LGPD flows + data integrity).
- Plan 06-02 has 1 checkpoint (human verification of DR test results + sign-off).
- Both plans depend on Phase 4 completion (staging rules must be hardened before DR test).
- Critical path: Phase 4 → Phase 6-02 restore test.

**Dependencies:**
- Pode rodar em paralelo com Phase 5 (independências)
- Phase 4 (CLEAN-01 rules tightening) deve estar terminado antes de DR test (não restaurar dados em staging com rules abertas)

**Skills GSD:**
- `/gsd-discuss-phase 6` — clarificar fluxo OTP exclusão, janela de manutenção do restore
- `/gsd-plan-phase 6` ✅ COMPLETE — 2 plans created (06-01-PLAN.md, 06-02-PLAN.md)
- `/gsd-execute-phase 6` (pending)
- `/gsd-secure-phase 6` — revisar deleteTitularData (chain-hash não pode quebrar)

---

**Plans are located:**
- `.planning/phases/06-compliance/06-01-PLAN.md` — LGPD implementation
- `.planning/phases/06-compliance/06-02-PLAN.md` — Disaster Recovery planning + test

**Next:** `/gsd-execute-phase 6` — execute plans 06-01 and 06-02 in parallel

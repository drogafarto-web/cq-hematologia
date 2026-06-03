---
phase: 2
status: ready-for-batch-execution
batches: 3-parallel
estimated_duration: 8-10-weeks
---

# Phase 2 Execution Plan: 13 Modules, 3 Batches Parallel

**Pre-requisite:** ADR 0007 deployed ✓

---

## Batch 1: Sistema de Qualidade (Weeks 1-8)

**Modules (3):** POPs, Non-Conformidade + CAPA, Auditoria Interna

### 1.1 POPs Module

- **Inputs:** ADR 0004 schema (POP, POPVersao immutable)
- **Build:** UI for POP management (create, version, RT-sign, training assign)
- **Functions:** criarPOP (already live), createPOPVersion (already live), assinaturaRT (already live)
- **Integration:** Wire to all 5 CIQ modules + add popId denormalization
- **Tests:** >80% coverage (versioning logic, training validation)
- **Deploy:** Web + Rules
- **Smoke:** Create POP v1.0 → v1.1 → RT sign → operator training required

### 1.2 Non-Conformidade + CAPA Module

- **Inputs:** ADR 0003 schema (NC, CAPA workflow state machine)
- **Build:** NC list + detail view, CAPA workflow (investigacao → acao → eficacia)
- **Functions:** openNC (already live), updateNC (already live), investigarNC/executarAcaoCorretiva/verificarEficacia (already live)
- **Integration:** 6 modules can open NCs, severity gates block operations
- **Tests:** >80% coverage (status transitions, CAPA workflow, blocking)
- **Deploy:** Web + Rules
- **Smoke:** Open grave NC → blocks Hematologia → investigate → acao → eficacia → closed

### 1.3 Auditoria Interna Module

- **Build:** Audit checklist templates, findings form, auto-NC creation
- **Functions:** criarAuditoria, registrarAchado (creates NC with origem='auditoria'), aprovarPlanoAcao
- **Integration:** Achados link to NCs, NCs link back to audit
- **Tests:** >80% coverage
- **Deploy:** Web + Rules + Scheduled validator (overdue audits alert)
- **Smoke:** Audit → finding → auto-NC (grave, blocking) → CAPA workflow

---

## Batch 2: RH + Infraestrutura (Weeks 1-8, parallel with Batch 1)

**Modules (5):** Treinamentos, Biossegurança, PGRSS, KPIs, LGPD

### 2.1 Treinamentos Module

- **Inputs:** ADR 0006 (Qualificacao.treinamentosPOP[]), ADR 0004 (POPs)
- **Build:** Training registry per POP version, expiry tracking, evidence upload
- **Functions:** registrarTreinamento, checkTreinamentoValido (extends ADR 0006 validation)
- **Tests:** >80%
- **Deploy:** Web + Rules
- **Smoke:** Operator trains on POP v1.1 → validoAte 24mo → after expiry, blocked

### 2.2 Biossegurança Module

- **Build:** Area mapping (sala, fluxo, NB level), EPE checks, biosafety matrix
- **Functions:** mapearArea, registrarEPECheck, validarBioseguracaArea
- **Tests:** >80%
- **Deploy:** Web + Rules
- **Smoke:** Create area → NB2 → EPE required → operator checked

### 2.3 PGRSS Module

- **Build:** Waste generation registry, segregation checklist, collection tracking, compliance reports
- **Functions:** registrarGeracaoResiduo, registrarColeta, gerarRelatoPGRSS
- **Tests:** >80%
- **Deploy:** Web + Rules
- **Smoke:** Register waste → track segregation → schedule collection → report

### 2.4 KPIs Dashboard

- **Inputs:** Data from all modules (NC count, turnaround, rework, equipamento downtime)
- **Build:** Real-time dashboard with charts (turnaround distribution, rework %, NC origins, compliance %)
- **Functions:** computeKPIs (scheduled daily aggregation)
- **Tests:** >80%
- **Deploy:** Web + Scheduled CF
- **Smoke:** Post 10 runs → dashboard shows turnaround, rework %, equipId coverage

### 2.5 LGPD Policy + Data Deletion

- **Inputs:** ADR 0006 (cpfHash, audit trail)
- **Build:** LGPD policy portal, deletion request workflow, DPIA template
- **Functions:** criarDelecaoRequest, processarDelecao (anonymize + archive), auditarDelecao
- **Tests:** >80% (verify deleted users don't appear in reports, audit trail preserved)
- **Deploy:** Web + Rules + Scheduled deletion processor
- **Smoke:** User deletes account → request processed → anonymized in DB → audit logged

---

## Batch 3: Analítico + Pós-Analítico (Weeks 9-18, after Batch 1 stabilized)

**Modules (5):** CIQ Bioquimica, CEQ, Validacao Metodos, Liberacao Laudos, Criticos

### 3.1 CIQ Bioquímica Module

- **Inputs:** ADR 0004 (POPs), ADR 0007 (Equipamento gate), ADR 0003 (NC blocking)
- **Build:** New CIQ module (same pattern as Hematologia): runs, reagents, results
- **Functions:** criarRunBio, salvarResultadoBio (enforces equipId + popId + operadorId validation)
- **Tests:** >80% (equipId gate, popId denormalization, operador training)
- **Deploy:** Web + Rules + CIQ data model
- **Smoke:** Create run → missing equipment → blocked; valid equipment → saves with equipId

### 3.2 CEQ (Ensaio Externo)

- **Inputs:** External proficiency program enrollment
- **Build:** Sample tracking, Z-score calculation, auto-NC on deviation
- **Functions:** criarCEQ, receberAmostra, calcularZscore, auto-openNC if |Z| > 3
- **Tests:** >80% (Z-score logic, NC auto-creation)
- **Deploy:** Web + Rules + Scheduled CEQ analyzer
- **Smoke:** Submit samples → receive results → |Z| = 3.5 → auto-NC (grave, blocking)

### 3.3 Validacao Metodos

- **Build:** Method validation protocols (linearity, precision, accuracy, range)
- **Functions:** criarValidacaoMetodo, registrarResultadoLinearidade, calcularAccuracy, gerarRelatorio
- **Tests:** >80%
- **Deploy:** Web + Rules
- **Smoke:** Validate method → linearity r² ≥ 0.99 ✓ → precision %CV ≤ 5% ✓

### 3.4 Liberacao Laudos

- **Inputs:** ADR 0003 (NC blocking), ADR 0006 (operator habilitacao), critical result list
- **Build:** Dupla-checagem UI, approval flow, 5-year retention
- **Functions:** criarRevisaoLaudo, aprovarLaudo (dual signature), bloqueiaResultadoCritico
- **Tests:** >80% (signature validation, retention policy)
- **Deploy:** Web + Rules + Audit trail
- **Smoke:** Critical result → requires two approvals → after approval, can send; expired results auto-deleted after 5y

### 3.5 Comunicacao Resultados Criticos

- **Build:** Critical result criteria, communication registry, recipient tracking
- **Functions:** definirCriterioCritico, registrarComunicacao, verificarRecebimento
- **Tests:** >80%
- **Deploy:** Web + Rules
- **Smoke:** Result critical (criteria match) → auto-flag → registry → notify recipient

---

## Deployment Sequence

1. **Batch 1 Deploy (Week 8):** POPs + NC + Auditoria → Prod (after smoke tests)
2. **Batch 2 Deploy (Week 8):** RH + Infra → Prod (parallel)
3. **Stabilization (Weeks 9-10):** Monitor Batch 1 + 2, fix bugs
4. **Batch 3 Deploy (Week 18):** Analítico → Prod

---

## Success Metrics

- **Code Quality:** >80% test coverage per module
- **Deployment:** 0 critical bugs in first 48h
- **Adoption:** All 5 CIQ modules using equipId + popId + operadorId
- **Audit:** 0 LGPD violations, deletion processor running
- **KPIs:** Dashboard live, metrics trending correct direction

---

## Subagent Execution

**Spawn 3 agents (one per batch):**

```bash
# Next session:
/gsd-plan-phase 2 --batch 1
/gsd-plan-phase 2 --batch 2
/gsd-plan-phase 2 --batch 3
```

OR:

```bash
/gsd-execute-phase 2
```

Each agent gets:

- This PHASE2-EXECUTION-PLAN.md
- ROADMAP.md (full batch specs)
- ADR documents (0003, 0004, 0006, 0007 as reference)
- Weekly checkpoint schedule

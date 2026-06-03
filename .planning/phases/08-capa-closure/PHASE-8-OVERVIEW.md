---
phase: 08-capa-closure
status: planned
date_refactored: 2026-05-09
architecture: subagent-wave-haiku
waves: 8
total_subagents: 45
human_gates: 0
---

# Phase 8 — CAPA Closure Tracking + Micro-Modules

**Milestone:** v1.4 Audit Readiness  
**Architecture:** 45 subagentes em 8 waves — execução autônoma, modelo Haiku, zero intervenção humana  
**Compliance:** RDC 978 (Art. 5.3, 86, 117, 122–127, 167) + DICQ 4.4/4.15 (CAPA + management review)

---

## Princípios do redesign

1. **Uma tarefa = um arquivo** — cada subagente toca exatamente 1 arquivo
2. **Haiku-first** — tarefas ≤200 LOC, contrato claro, sem raciocínio complexo
3. **Zero gates humanos** — verificação por `npx tsc --noEmit` + `npm test` apenas
4. **Tiro único** — fase inteira do W0 ao W7 sem parada

---

## Wave Map

```
W0 — Type System       [5 SA, paralelos]
  SA-01  capa-tracking/types/index.ts
  SA-02  calibracao/types/index.ts
  SA-03  personnel/cargos/types/index.ts
  SA-04  personnel/designacoes/types/index.ts
  SA-05  management-review/types/index.ts

W1 — Services + Rules  [8 SA, paralelos]          deps: W0
  SA-06  firestore.rules              (add capa-tracking + calibracao + personnel blocks)
  SA-07  capa-tracking/services/capaService.ts
  SA-08  capa-tracking/services/capaCallables.ts
  SA-09  calibracao/services/calibracaoService.ts
  SA-10  personnel/cargos/services/cargosService.ts
  SA-11  personnel/designacoes/services/designacoesService.ts
  SA-12  management-review/services/managementReviewService.ts
  SA-13  risk-management/services/riskMatrixService.ts

W2 — Hooks             [6 SA, paralelos]           deps: W1
  SA-14  capa-tracking/hooks/useCapaTracking.ts
  SA-15  capa-tracking/hooks/useAuditorRFI.ts
  SA-16  calibracao/hooks/useCalibracaoTracking.ts
  SA-17  personnel/cargos/hooks/useCargos.ts
  SA-18  personnel/designacoes/hooks/useDesignacoes.ts
  SA-19  management-review/hooks/useManagementReview.ts

W3 — Cloud Functions   [7 SA, paralelos]           deps: W0
  SA-20  callables/capa/createCapa.ts
  SA-21  callables/capa/updateCapaState.ts
  SA-22  callables/capa/submitCapaRFI.ts
  SA-23  callables/capa/uploadCapaEvidence.ts
  SA-24  callables/capa/submitAuditorSignOff.ts
  SA-25  callables/calibracao/uploadCalibracaoCertificate.ts
  SA-26  callables/management-review/aggregateManagementReviewData.ts

W4 — UI Components     [9 SA, paralelos]           deps: W2 + W3
  SA-27  capa-tracking/components/CAPAListView.tsx
  SA-28  capa-tracking/components/CAPADetailPanel.tsx
  SA-29  capa-tracking/components/CapaEvidenceUpload.tsx
  SA-30  capa-tracking/components/AuditorRFIForm.tsx
  SA-31  capa-tracking/components/CapaAuditorSignOff.tsx
  SA-32  calibracao/components/CalibracaoList.tsx
  SA-33  personnel/cargos/components/CargosOrgChart.tsx
  SA-34  personnel/designacoes/components/DesignacoesList.tsx
  SA-35  management-review/components/ManagementReviewMeeting.tsx

W5 — Pages + Routes    [5 SA, paralelos]           deps: W4
  SA-36  capa-tracking/pages/CAPATrackingHome.tsx
  SA-37  risk-management/components/RiskMatrixHeatmap.tsx
  SA-38  capa-tracking/components/index.ts          (barrel export)
  SA-39  functions/src/index.ts                     (wire 7 new callables)
  SA-40  auth/AuthWrapper.tsx + hub/ModuleHub.tsx   (capa-tracking route + tile)

W6 — Tests             [4 SA, paralelos]           deps: W5
  SA-41  __tests__/capa-tracking/capa-state-machine.test.ts
  SA-42  __tests__/capa-tracking/capa-service.test.ts
  SA-43  __tests__/calibracao/calibracao.test.ts
  SA-44  __tests__/management-review/management-review.test.ts

W7 — Verification      [1 SA]                      deps: W6
  SA-45  gate final (TSC + tests + compliance check)
```

---

## Compliance Mapping

| Requisito                          | Wave     | Subagente               |
| ---------------------------------- | -------- | ----------------------- |
| RDC 978 Art. 5.3 — CAPA management | W0–W4    | SA-01/07/08/20–24/27–31 |
| RDC 978 Art. 86 — Gestão de riscos | W0/W4    | SA-05/35/37             |
| RDC 978 Art. 117 — Audit trail     | W1/W3    | SA-06/07/20–24          |
| RDC 978 Art. 122–127 — Personnel   | W0/W1/W4 | SA-03/04/10/11/33/34    |
| DICQ 4.4 — CAPA + trilha           | W0–W3    | SA-01/06–08/20–24       |
| DICQ 4.15 — Management review      | W0/W1/W4 | SA-05/12/19/35          |

---

## Planos de execução

| Plano | Wave                   | SAs      | Dependência   |
| ----- | ---------------------- | -------- | ------------- |
| 08-01 | W0 — Types             | SA-01–05 | nenhuma       |
| 08-02 | W1 — Services + Rules  | SA-06–13 | 08-01         |
| 08-03 | W2 — Hooks             | SA-14–19 | 08-02         |
| 08-04 | W3 — Cloud Functions   | SA-20–26 | 08-01         |
| 08-05 | W4 — UI Components     | SA-27–35 | 08-03 + 08-04 |
| 08-06 | W5 — Pages + Routes    | SA-36–40 | 08-05         |
| 08-07 | W6 — Tests             | SA-41–44 | 08-06         |
| 08-08 | W7 — Verification Gate | SA-45    | 08-07         |

---

## Success Criteria (automated)

```bash
npx tsc --noEmit                           # 0 erros
npm test -- --coverage --passWithNoTests   # ≥75% coverage nos novos arquivos
grep -c "capa-tracking" firestore.rules    # ≥1
```

**Nenhum critério manual.**

---
phase: 07-advanced-auditoria
status: planned
date_created: 2026-05-08
date_refactored: 2026-05-09
architecture: subagent-wave-haiku
waves: 7
total_subagents: 22
human_gates: 0
---

# Phase 7 — Advanced Auditoria + AI Insights

**Milestone:** v1.4 Extended Quality Assurance  
**Architecture:** 22 subagentes em 7 waves — execução autônoma, modelo Haiku, zero intervenção humana  
**Compliance:** RDC 978 (Art. 107, 5.3) + DICQ 4.4 (Trilha de Auditoria, Investigação de NC)

---

## Princípios do redesign

1. **Uma tarefa = um arquivo** — cada subagente toca exatamente 1 arquivo (ou 1 arquivo + teste)
2. **Haiku-first** — tarefas ≤200 LOC, contrato claro, sem raciocínio complexo
3. **Zero gates humanos** — verificação por `npx tsc --noEmit` + `npm test` apenas
4. **Tiro único** — fase inteira do W0 ao W6 sem parada

---

## Wave Map

```
W0 — Foundation       [4 SA, todos paralelos]
  SA-01  anomalyTypes.ts           (tipo system unificado)
  SA-02  auditDiffDetector.ts      (diff engine + testes)
  SA-03  contextCapture.ts         (context builder + testes)
  SA-04  firestore.indexes.json    (5 novos indexes)

W1 — Core Infra       [4 SA, paralelos]          deps: W0
  SA-05  auditTrail.ts             (extend com diff+context)
  SA-06  normalizeBaseline.ts      (baseline + testes)
  SA-07  aiPatternMatcher.ts       (Gemini wrapper + testes)
  SA-08  firestore.rules           (audit-trail + alerts blocks)

W2 — Logic Layer      [2 SA, paralelos]           deps: W1
  SA-09  anomalyDetector.ts        (scoring engine + testes)
  SA-10  alertEngine.ts            (geração + roteamento + testes)

W3 — Functions+Hooks  [5 SA, paralelos]           deps: W2
  SA-11  cfAuditTrigger.ts         (onWrite → detect → alert)
  SA-12  useAnomalyAlerts.ts       (hook realtime)
  SA-13  nlpSummarizer.ts          (Gemini NLP + testes)
  SA-14  reportGenerator.ts        (CF callable)
  SA-15  useAuditReportExport.ts   (hook export)

W4 — UI Components    [3 SA, paralelos]           deps: W3
  SA-16  AlertCenter.tsx           (dashboard dark-first)
  SA-17  AlertDrillDown.tsx        (modal drill-down)
  SA-18  ReportBuilder.tsx         (wizard 3-step)

W5 — Integration      [3 SA, paralelos]           deps: W4
  SA-19  scheduledReportJob.ts     (CF cron diário/semanal/mensal)
  SA-20  routes + hub tile         (navegação + AppRouter)
  SA-21  integration tests         (cobertura end-to-end)

W6 — Verification     [1 SA]                      deps: W5
  SA-22  gate final                (TSC + tests + compliance check)
```

---

## Compliance Mapping

| Requisito | Wave | Subagente |
|-----------|------|-----------|
| RDC 978 5.3 — Audit trail who/what/when/where | W0–W1 | SA-02/03/05 |
| RDC 978 Art. 107 — Revisões periódicas | W3–W5 | SA-14/19 |
| DICQ 4.4 — Trilha de auditoria + anomalias | W2 | SA-09/10 |
| DICQ 4.4 — Investigação de NC | W3–W4 | SA-11/16/17 |

---

## Planos de execução

| Plano | Wave | SAs | Dependência |
|-------|------|-----|-------------|
| 07-01 | W0 — Foundation | SA-01/02/03/04 | nenhuma |
| 07-02 | W1 — Core Infra | SA-05/06/07/08 | 07-01 |
| 07-03 | W2 — Logic Layer | SA-09/10 | 07-02 |
| 07-04 | W3 — Functions+Hooks | SA-11/12/13/14/15 | 07-03 |
| 07-05 | W4 — UI Components | SA-16/17/18 | 07-04 |
| 07-06 | W5 — Integration | SA-19/20/21 | 07-05 |
| 07-07 | W6 — Verification Gate | SA-22 | 07-06 |

---

## Success Criteria (automated)

```bash
npx tsc --noEmit                          # 0 erros
npm test -- --coverage --passWithNoTests  # ≥75% coverage nos novos arquivos
grep -c "audit-trail\|audit-alerts" firestore.rules  # ≥2
```

**Nenhum critério manual.**

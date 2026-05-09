---
phase: 09-bioquimica-phase2
status: planned
date_refactored: 2026-05-09
architecture: subagent-wave-haiku
waves: 7
total_subagents: 22
human_gates: 0
---

# Phase 9 — Bioquímica Phase 2: Analyte Expansion + OCR Integration

**Milestone:** v1.4 Extended Quality Assurance  
**Architecture:** 22 subagentes em 7 waves — execução autônoma, modelo Haiku, zero intervenção humana  
**Compliance:** RDC 978 Art. 179 (CIQ obrigatório) + Art. 161 (audit trail) + DICQ 4.3 Bloco F

---

## Princípios do redesign

1. **Uma tarefa = um arquivo** — cada SA toca exatamente 1 arquivo
2. **Haiku-first** — contratos claros, ≤200 LOC por SA, zero raciocínio complexo
3. **Zero gates humanos** — verificação automática via `npx tsc --noEmit` + `npm test`
4. **Tiro único** — W0 ao W6 sem parada; gate final verifica tudo

---

## Wave Map

```
W0 — Foundation        [4 SA, paralelos]
  SA-01  analito.ts               (extend Analito + WestgardConfig 8 regras)
  SA-02  westgard.ts              (RuleViolation, RunComplianceResult)
  SA-03  ocr.ts                   (ParsedAnalyte, MatchResult, OCRValidationResult)
  SA-04  seedAnalitos.ts          (expand 16 → 25+ analitos com westgardRules)

W1 — Core Logic        [4 SA, paralelos]          deps: W0
  SA-05  westgardRulesCLSI.ts    (8 regras Westgard, função pura, client-side)
  SA-06  westgardEngine.ts       (server-side authoritative engine, CF Node 22)
  SA-07  seedBioquimicaDefaults.ts (callable atualizado com 25+ analitos)
  SA-08  ocrFuzzyMatch.ts        (Levenshtein + semantic, função pura)

W2 — Services          [3 SA, paralelos]           deps: W1
  SA-09  geminiVisionService.ts  (Gemini 2.5 Flash API client + prompt template)
  SA-10  ocrValidationService.ts (audit trail recording, RDC 978 5.3)
  SA-11  useAcceptanceEngine.ts  (hook integra westgardRulesCLSI por analito)

W3 — Hooks + UI        [3 SA, paralelos]           deps: W2
  SA-12  useGeminiVision.ts      (state management: idle→uploading→parsing→matching)
  SA-13  useOCRValidation.ts     (hook de validação + operator decision recording)
  SA-14  OCRUploadModal.tsx      (dark-first modal: upload → progress → results → approve)

W4 — Functions + Docs  [2 SA, paralelos]            deps: W3
  SA-15  geminiOCRParser.ts      (CF onRequest fallback server-side, southamerica-east1)
  SA-16  BIOQUIMICA_OCR_INTEGRATION.md (flow diagram, prompt, cost model, rollback)

W5 — Tests             [5 SA, paralelos]            deps: W4
  SA-17  westgardRulesCLSI.test.ts    (12+ casos: 1-2s/1-3s/2-2s/R-4s + extended)
  SA-18  westgardEngine.test.ts       (8+ casos server-side: compliance, edge cases)
  SA-19  ocrFuzzyMatch.test.ts        (7+ casos: exact, typo, semantic, no-match)
  SA-20  ocrIntegration.test.ts       (5+ cenários E2E: perfect, low-conf, unrecognized)
  SA-21  geminiOCRParser.test.ts      (3+ casos server OCR: mock Gemini, error handling)

W6 — Verification      [1 SA]                       deps: W5
  SA-22  gate final               (TSC + tests + compliance grep + regressão 42 testes)
```

---

## Compliance Mapping

| Requisito | Wave | Subagente |
|-----------|------|-----------|
| RDC 978 Art. 179 — CIQ obrigatório (Westgard CLSI 1-2s/1-3s/2-2s/R-4s) | W0–W1 | SA-01/02/05/06 |
| RDC 978 Art. 161 — Audit trail operador + decisão OCR | W2 | SA-10 |
| RDC 978 5.3 — Imutabilidade trilha auditoria (chainHash) | W2 | SA-10 |
| DICQ 4.3 Bloco F — Westgard documentado + testado | W1/W5 | SA-05/06/17/18 |
| DICQ 4.4 — Trilha auditoria OCR (image→parse→match→decision) | W2/W3 | SA-10/13 |

---

## Planos de execução

| Plano | Wave | SAs | Dependência |
|-------|------|-----|-------------|
| 09-01 | W0 — Foundation | SA-01/02/03/04 | nenhuma |
| 09-02 | W1 — Core Logic | SA-05/06/07/08 | 09-01 |
| 09-03 | W2 — Services | SA-09/10/11 | 09-02 |
| 09-04 | W3 — Hooks + UI | SA-12/13/14 | 09-03 |
| 09-05 | W4 — Functions + Docs | SA-15/16 | 09-04 |
| 09-06 | W5 — Tests | SA-17/18/19/20/21 | 09-05 |
| 09-07 | W6 — Verification Gate | SA-22 | 09-06 |

---

## Success Criteria (automatizados)

```bash
npx tsc --noEmit                                          # 0 erros
npm test -- --passWithNoTests src/features/bioquimica     # ≥62 testes pass
cd functions && npm test -- --passWithNoTests              # ≥8 testes pass
grep -c "westgardRules" src/features/bioquimica/constants/seedAnalitos.ts  # ≥25
```

**Nenhum critério manual.**

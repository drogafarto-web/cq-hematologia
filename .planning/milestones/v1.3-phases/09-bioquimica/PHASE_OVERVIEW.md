---
phase: "09-bioquimica"
title: "Phase 9 — Bioquímica (CIQ Quantitativo + Levey-Jennings)"
milestone: v1.3
status: complete
total_plans: 5
start_date: 2026-05-06
end_date: 2026-05-06
duration_weeks: 0.11
priority: P1
stream: B
parallel_with: [08-capa-closure]
revision: 1.0
---

# Phase 9: Bioquímica — CIQ Quantitativo + Levey-Jennings

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração Riopomba)
**Stream:** B (parallel — independent of Stream A)
**Priority:** P1 (compliance Bloco F — Analítico)
**Period:** 2026-05-06 → 2026-08-20 (16 weeks; ~8 weeks de execução real, 8 de buffer/overlap)
**Revision:** 1.0

---

## Goal

Production-ready QC module for biochemistry analytes with multi-rule Westgard validation (subset CLSI clássico), Levey-Jennings charting, multi-instrument support, manufacturer bula parsing, and Worklab traceability (append-only).

**Output:** Module `bioquimica` em produção cobrindo 16 analitos seed + UI de cadastro de novos analitos pelo lab; suporta múltiplos analisadores via `/equipamentos`; CIQ obrigatório por RDC 978/2025 Art. 179-180 atendido.

---

## Strategic Context

### Por que Bioquímica agora

- **DICQ Bloco F (Analítico)** sobe de ~85% → ~92% com módulo em produção (compliance metric do milestone v1.3).
- **RDC 978/2025 Art. 179-180** exige CIQ para todos os analitos quantitativos. Hoje, lab Riopomba faz controle manualmente (planilha Excel) — não-conforme.
- **Compounding com Hematologia:** infraestrutura de westgardRules, BulaProcessor, ControlLot, subscribeToState está madura — bioquímica é replicação dirigida, não invenção.
- **Compliance-spine F:** breadth analítica é parte da diferenciação de HC Quality contra concorrentes (Sysmex Pi, Roche cobas-IT) que cobrem CIQ mas não DICQ-aligned.

### Decisões locked (do discuss-phase 2026-05-06)

| Decisão | Valor | Rationale |
|---------|-------|-----------|
| Westgard rules | Subset CLSI (1-2s warn, 1-3s, 2-2s, R-4s reject) | Padrão CLSI EP15 — menos false-rejects que set completo de hema. 4-1s/10x ativáveis por analito em v1.4 |
| Escopo analitos | 16 analitos seed + UI admin para cadastro/edição | Cobre painéis básico+hepático+lipídico+eletrólitos. Lab pode estender sem release |
| Multi-instrumento | Dia 1 (via `/equipamentos`) | Riopomba opera mais de um analisador. Bula vinculável a vários equipos |
| Stats source | Bula PDF (Gemini Vision parse) + Interna (após 20 runs) — toggle | Reuso direto do BulaProcessor de hematologia |
| Rastreabilidade Worklab | Append-only `/traceability-events` | Sem integração externa LIS (vira spike v1.4) |
| Deferred | CEQ comparison, Comparabilidade entre equipos (DICQ 5.6.4) | CEQ via Importador PNCQ no v1.4. Comparabilidade na v1.4 com 2+ equipos em prod |

---

## Plan Structure

Phase 9 has **5 plans** organized em 2 ondas:

### Wave 1 — Foundation (Plans 09-01, 09-02 podem rodar parcialmente em paralelo)

#### Plan 09-01: Schema + Service Layer + Admin Analitos
**Duration:** 1.5 weeks (2026-05-06 → 2026-05-16)
**Type:** Build (infrastructure)
**Goal:** Tipos, schema Firestore, service multi-tenant, UI admin para cadastro de analitos.

**Deliverables:**
- `src/features/bioquimica/types/index.ts` — `Analito`, `ControlMaterial`, `Run`, `RunBioquimica`, `Westgard*`
- `src/features/bioquimica/services/bioquimicaService.ts` — replicar pattern `firebaseService.subscribeToState`
- `src/features/bioquimica/components/AnalitoAdmin.tsx` — CRUD UI (16 analitos seed + customizáveis)
- `firestore.rules` — bloco bioquímica (config + analitos + lots + runs + events)
- `firestore.indexes.json` — índices compostos (labId + ativo + nome, labId + analitoId + criadoEm)
- Seed via callable: 16 analitos default — Glicose, Ureia, Creatinina, TGO, TGP, FA, GGT, BT-D, BT-I, CT, HDL, LDL, TG, Na, K, Cl, Ca

#### Plan 09-02: Material Control + Bula PDF + Multi-Instrumento + Entry Form
**Duration:** 2 weeks (2026-05-13 → 2026-05-27)
**Type:** Build (core domain)
**Goal:** Modal de cadastro de lote (3 caminhos), parser de bula via Gemini Vision, vínculo de equipamentos múltiplos, formulário de entrada de runs.

**Deliverables:**
- `BulaProcessor.tsx` adaptado (parse de bula bioquímica via Gemini Vision)
- `AddLotModal.tsx` — Bula PDF / Cadastro sem bula ≤7d / Avulso
- `EquipamentoMultiselect.tsx` — bind de bula a múltiplos equipamentos via `/equipamentos`
- `NovaCorridaForm.tsx` — captura de resultados por analito (16 inputs + escolha de equipamento)
- `LotManager.tsx` — EM USO / DISPONÍVEIS / HISTÓRICO (replicado de hema)
- `PreFlightCheck.tsx` — 3/3 controles + reagentes OK + equipamento ativo

### Wave 2 — Acceptance + Visualization

#### Plan 09-03: Westgard CLSI + Levey-Jennings + Acceptance Logic
**Duration:** 1.5 weeks (2026-05-27 → 2026-06-06)
**Type:** Build (analytic engine)
**Goal:** Engine de validação Westgard subset CLSI + chart Levey-Jennings + UI de revisão.

**Deliverables:**
- `westgardRulesCLSI.ts` — 4 regras: 1-2s (warn), 1-3s (reject), 2-2s (reject), R-4s (reject)
- `useChartData.ts` — Levey-Jennings (mean/sd Bessel, ±1s/±2s/±3s); toggle bula vs interna
- `LeveyJenningsChart.tsx` — recharts-based, multi-equipamento overlay
- `ReviewRunModal.tsx` — tabela editável, violations chips, override auditado (compliance blockers congelados)
- `useAcceptanceEngine.ts` — orquestra checagem multi-rule por analito por equipamento

### Wave 3 — Closure + Deploy

#### Plan 09-04: Cloud Function + Rastreabilidade Worklab + E2E Tests
**Duration:** 2 weeks (2026-06-06 → 2026-06-20)
**Type:** Build (server-side + tests)
**Goal:** Functions callables (parseBulaBioquimica, recordRun, generateMonthlyReport), append-only `/traceability-events`, suite E2E.

**Deliverables:**
- `functions/src/bioquimica/parseBulaBioquimica.ts` — Gemini Vision OCR + Zod validation
- `functions/src/bioquimica/recordRun.ts` — write run + LogicalSignature + chainHash
- `functions/src/bioquimica/recordTraceabilityEvent.ts` — append-only com `examCodeAtChange`
- `functions/src/bioquimica/generateMonthlyReport.ts` — PDF FR-001 (replicar pattern de hema)
- `e2e/bioquimica.spec.ts` — 5 fluxos críticos (cadastro lote bula, lote sem bula, run aprovada, run rejeitada Westgard, override auditado)
- `firestore.rules` — eventos imutáveis (allow update/delete: false)

#### Plan 09-05: Polish + Regression + Deploy
**Duration:** 1 week (2026-06-20 → 2026-06-27)
**Type:** Build (quality + deploy)
**Goal:** UI polish (a11y AA, dark-first refinement), regression suite verde, deploy progressivo.

**Deliverables:**
- a11y audit AA mínimo (`aria-label`, contraste 4.5:1, foco visível, navegação teclado)
- Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 (rotas /bioquimica/*)
- Bundle: `manualChunks` entry para `module-bioquimica`
- Smoke tests staging com dados reais Riopomba
- Deploy ordem: rules + indexes → functions:bioquimica* → hosting
- Adicionar `bioquimica` em `Módulos em produção` no CLAUDE.md root

---

## Cross-Plan Wave Diagram

```
Wave 1: Foundation                Wave 2: Engine               Wave 3: Closure
┌──────────────────────┐         ┌─────────────────────┐      ┌──────────────────┐
│ 09-01 Schema/Service │ ───────▶│ 09-03 Westgard + LJ │ ────▶│ 09-04 CF + E2E   │
└──────────────────────┘         └─────────────────────┘      └──────────────────┘
          │                                                            │
          ▼                                                            ▼
┌──────────────────────┐                                      ┌──────────────────┐
│ 09-02 Material+Bula  │ ─────────────────────────────────────│ 09-05 Polish+Dep │
└──────────────────────┘                                      └──────────────────┘
```

**Critical path:** 09-01 → 09-02 → 09-03 → 09-04 → 09-05 (sequential).
**Parallel slack:** 09-01 e 09-02 podem ter ~3 dias de overlap (após types prontos).

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Bula PDF de bioquímica tem layout diferente de hematologia (Gemini falha parse) | 🟠 | Médio | Spike de 1 dia em 09-02 com 3 bulas reais (BioPlus, Labtest, Wiener); fallback manual via cadastro avulso |
| Multi-instrumento explode complexidade de testes (matriz N×M) | 🟠 | Médio | Limitar MVP a 2 equipamentos simultâneos; cobertura E2E só com 2 |
| 4 regras CLSI insuficientes para alguns analitos (CV alto, ex: GGT) | 🟡 | Baixo | Documentar como known-issue; UI mostra warning visual de CV alto; 4-1s/10x ativáveis em v1.4 |
| Worklab traceability sem integração LIS = dado preenchido manualmente, baixa adesão | 🟡 | Alto | UX premium no input (autocomplete, atalhos teclado); KPI de % runs com rastreabilidade no dashboard |
| Seed de 16 analitos diverge entre labs (unidades, ranges biológicos) | 🟢 | Alto | Seed é default editável; UI admin permite override por lab |

---

## Success Criteria (Phase 9 done)

1. Módulo `bioquimica` deployado em produção (`hmatologia2.web.app/bioquimica`)
2. ≥ 16 analitos seed disponíveis + UI admin funcional (CRUD + ativação por lab)
3. Multi-instrumento: pelo menos 2 equipamentos cadastrados podem rodar CIQ simultâneo, dados isolados por equipamento
4. Bula PDF parse: ≥ 90% dos campos extraídos corretamente em 5 bulas reais (validado manualmente)
5. Westgard CLSI: violações 1-2s warn, 1-3s/2-2s/R-4s reject — comportamento reproduzível em 5 cenários de teste
6. Levey-Jennings: chart renderiza com toggle bula↔interna; mean/sd correto (validado contra Excel)
7. Rastreabilidade Worklab: 1 run de teste com `examCodeAtChange` populado, evento imutável (rules block update/delete)
8. E2E suite: 5 fluxos críticos verde (cadastro bula, sem bula, run aprovada, run rejeitada, override)
9. Compliance: RDC 978 Art. 179-180 atendido (CIQ obrigatório implementado), DICQ 5.5.1.1/5.5.2/5.6.2 evidenciado
10. Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 nas rotas `/bioquimica/*`

---

## Skills GSD utilizadas

- ✅ `/gsd-discuss-phase 9` (conduzido inline com base em síntese Obsidian — 4 perguntas críticas)
- ✅ `/gsd-plan-phase 9` (este overview + 5 PLAN.md)
- `/gsd-execute-phase 9 --wave 1` — após Phase 8 plan 02 estar verde
- `/gsd-validate-phase 9` — antes de deploy final em 09-05
- `/gsd-secure-phase 9` — verificar threat model (rules append-only, signature)

---

## Canonical References

**Obsidian (segundo cérebro — contexto estratégico):**
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Modulo_Hematologia_2026-04-29.md` — referência de padrão (replicar)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_2025_Resumo.md` — Arts. 179-180, 181, 167, 183
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Compliance_DICQ.md` — Bloco F (5.5.1.1, 5.5.1.3, 5.5.2, 5.6.2, 5.6.3, 5.6.4)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Visao.md` — diretivas estratégicas (multi-equipamento, dark-first)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Decisoes_Abertas.md` — pendências arquiteturais (multi-tenant, OCR, CEQ-PNCQ)

**Código vivo (replicar/extender):**
- `src/features/analyzer/` — Hematologia (referência estrutural completa)
- `src/features/chart/utils/westgardRules.ts` — base do `westgardRulesCLSI.ts`
- `src/features/insumos/utils/insumoValidation.ts` — picker + validateReagentesForRun
- `src/shared/services/firebaseService.ts` — subscribeToState 5 layers + merge rules
- `src/features/analyzer/components/BulaProcessor.tsx` — Gemini Vision PDF parse
- `src/features/analyzer/components/AddLotModal.tsx` — 3 caminhos de cadastro
- `src/features/analyzer/components/ReviewRunModal.tsx` — Westgard chips + override
- `src/features/analyzer/components/PreFlightCheck.tsx` — verde/amarelo gate

**ADRs (manter consistência):**
- `docs/adr/0001-audit-chain.md` — chainHash + LogicalSignature
- `docs/adr/0007-*.md` — multi-tenant patterns

**Specs/Rules:**
- `firestore.rules` (bloco analyzer como template)
- `.claude/rules/firestore-security.md` — invariantes
- `.claude/rules/performance.md` — Web Vitals targets, manualChunks
- `.claude/rules/deploy-protocol.md` — ordem de deploy

---

## Next Step

Após Phase 8 plan 02 (Calibração) atingir 50% (semana 2026-05-20), o time pode começar Wave 1 de Phase 9 em paralelo:

```bash
/gsd-execute-phase 9 --wave 1
```

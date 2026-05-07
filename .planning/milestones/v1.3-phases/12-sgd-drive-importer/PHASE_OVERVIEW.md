---
phase: "12-sgd-drive-importer"
title: "Phase 12 — SGD (Sistema Gestão Documental) + Drive Importer Riopomba"
milestone: v1.3
status: planning
total_plans: 6
start_date: 2026-06-17
end_date: 2026-08-25
duration_weeks: 10
priority: P1
stream: B
parallel_with: [08-capa-closure, 09-bioquimica, 10-liberacao-criticos, 11-feedback-loop]
revision: 1.0
---

# Phase 12: SGD + Drive Importer Riopomba

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração Riopomba)
**Stream:** B (parallel)
**Priority:** P1 (compliance DICQ Block B + Riopomba migration concrete value)
**Period:** 2026-06-17 → 2026-08-25 (10 weeks; ~9 weeks de execução real)
**Revision:** 1.0

---

## Goal

Estender módulo SGQ existente para se tornar **Sistema de Gestão Documental (SGD) completo** com Lista Mestra (LM-01), hierarquia documental (MQ→PQ→IT→FR), Lista de Distribuição dinâmica por setor, e importer do Drive para migrar ~80 documentos do Riopomba. Cobre DICQ Block B (Gestão Documental) que está 100% 🔴 hoje + entrega valor concreto para Riopomba (migração real).

**Output:**
- SGQ expandido: enum de tipos 5→15, campos `listaDistribuicao` + `hierarquia` + `urlDriveOriginal`
- 4 surfaces deployadas:
  - `/sgq/lista-mestra` (LM-01 catálogo unificado)
  - `/sgq/hierarquia` (visualização tree MQ→PQ→IT→FR)
  - `/sgq/distribuicao` (matriz docs × setores com sync /personnel)
  - `/sgq/importar-drive` (wizard de importação OAuth)
- ~80 docs Riopomba migrados em produção (workflow draft → RT aprova → vigente)
- ADR 0012 (SGD architecture extension + Drive importer pattern)

**Riopomba impact:** DICQ baseline 71.3% → ~76-79% (+5-8 pontos no Block B).

---

## Strategic Context

### Por que SGD agora

- **DICQ Block B (Gestão Documental):** 4 itens 🔴 (4.2.2.2 Lista Mestra, 4.3 hierarquia, 4.3 controle versão, 4.3 distribuição). Phase 12 fecha todos.
- **Riopomba opera SGQ no Drive** com ~80 docs já catalogados em LM-01 (Google Sheets). Migração é "concrete value" imediato.
- **Compounding com SGQ + POPs existentes:** SGQ (2026-04-26) cobre versionamento + audit chain; POPs (2026-05-03) cobrem assinatura RT. Phase 12 adiciona Lista Mestra + LD + Importer.
- **Multi-tenant strategic foundation:** Riopomba é o piloto; outros Labclin (Mercês, Tabuleiro) + outros labs futuros usam mesma infraestrutura. SGD estabelece padrão.
- **RDC 978/2025 Art. 117** exige documentação obrigatória (PGQ, MQ, POPs, IT, FR) — SGD é o repositório oficial.

### Decisões locked (do discuss-phase 2026-05-06)

| Decisão | Valor | Rationale |
|---------|-------|-----------|
| Arquitetura | **Extensão do SGQ existente** | Reuso 100% audit chain + versionamento; síntese Obsidian aponta como decisão já travada (2026-04-26); 0 retrabalho |
| Drive auth | OAuth browser + preview obrigatório RT | Auditável (DICQ 4.3 exige autorização RT); token refresh automático |
| Versionamento | Flat v1.0 on import + Drive URL como referência | Auditor quer "o que vale agora"; histórico antigo via Drive link em `urlDriveOriginal` |
| Lista de Distribuição | Dinâmica via módulo Pessoal (Phase 8) | Sync automático: colaborador muda de setor → LD atualiza; mais robusto que LD estática |
| Aprovação RT | Obrigatória pre-vigente | Doc importado fica `draft` até RT aprovar; cumpre DICQ 4.3 explicitamente |
| Multi-tenant | Per-lab desde dia 1 | Schema com `labId` correto desde início; permite split futuro sem retrabalho |
| Sync ongoing Drive | Defer v1.4 | Big-bang migration; lab para de editar Drive após go-live |
| Documentos externos (bulas, RDCs) | LM-02 separado (referências) | Não importar como docs vigentes |
| FRs em Google Forms | Linkados via URL (template) | Não snapshot; preserva fluxo Forms→Sheets nativo |
| Ruído Drive | Ignorado | POPs Farmácia obsoletos, .rar, .jpg solta — importer pula |

---

## Plan Structure

Phase 12 has **6 plans** organized em 3 ondas:

### Wave 1 — Foundation (Plan 12-01 sequencial; 12-02 paralelo após types)

#### Plan 12-01: Schema Extension SGQ + Multi-Tenant + Hierarquia
**Duration:** 1.5 weeks (2026-06-17 → 2026-06-27)
**Type:** Build (foundation)
**Goal:** Estender schema SGQ existente: enum 15 tipos, campo listaDistribuicao, hierarquia parent/derivados, urlDriveOriginal, labId enforcement multi-tenant.

#### Plan 12-02: UI — LM-01 Dashboard + Hierarquia Tree + Distribuicao Matrix
**Duration:** 1.5 weeks (2026-06-27 → 2026-07-08)
**Type:** Build (visualization)
**Goal:** 3 surfaces: catálogo unificado paginado, árvore hierárquica MQ→PQ→IT→FR, matriz docs×setores com filtros.

### Wave 2 — Importer

#### Plan 12-03: Drive Importer + OAuth Browser + Preview RT
**Duration:** 2 weeks (2026-07-08 → 2026-07-22)
**Type:** Build (migration tool)
**Goal:** Wizard `/sgq/importar-drive` com OAuth Drive, parser para 15 tipos LM-01, mapping LD para 17 setores, preview RT antes de aprovar batch import.

### Wave 3 — Migration + Closure

#### Plan 12-04: Riopomba Pilot Import (Staging — 30 docs críticos)
**Duration:** 1.5 weeks (2026-07-22 → 2026-08-01)
**Type:** Migration (pilot)
**Goal:** Pilot com 30 docs críticos (MQ, PQ-01 a PQ-25, IT principais) em staging; validação RT + ajustes.

#### Plan 12-05: Riopomba Production Import (~80 docs full + verification)
**Duration:** 1.5 weeks (2026-08-01 → 2026-08-12)
**Type:** Migration (production)
**Goal:** Import completo Riopomba em prod; RT aprova batch; smoke test 17 setores; verificação DICQ baseline.

#### Plan 12-06: Polish + A11y + Perf + LGPD Audit + Deploy
**Duration:** 1 week (2026-08-12 → 2026-08-19)
**Type:** Build (deploy)
**Goal:** A11y AA, Web Vitals, ADR 0012, regression sweep, deploy progressivo, comunicação Riopomba.

---

## Cross-Plan Wave Diagram

```
Wave 1: Foundation              Wave 2: Importer            Wave 3: Migration
┌──────────────────────────┐   ┌─────────────────────┐    ┌──────────────────────┐
│ 12-01 Schema Extension   │ ─▶│ 12-03 Drive Imp.+RT │ ──▶│ 12-04 Pilot 30 docs  │
└──────────────────────────┘   └─────────────────────┘    └──────────────────────┘
            │                                                          │
            ▼                                                          ▼
┌──────────────────────────┐                              ┌──────────────────────┐
│ 12-02 UI LM-01+Hierarquia│                              │ 12-05 Prod 80 docs   │
└──────────────────────────┘                              └──────────────────────┘
                                                                       │
                                                                       ▼
                                                          ┌──────────────────────┐
                                                          │ 12-06 Polish + Deploy│
                                                          └──────────────────────┘
```

**Critical path:** 12-01 → 12-03 → 12-04 → 12-05 → 12-06 (sequencial em Wave 2/3).
**Parallel slack:** 12-02 paralelo a 12-01 após types prontos (~3d delay).

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Drive API quota exceeded em batch import | 🟡 | Médio | Pub/Sub queue + 4 workers paralelos; rate limit 100 calls/min/user; refresh quotas daily |
| OAuth token expira durante import | 🟡 | Baixo | Auto-refresh logic; alerta CTO antes expirar (24h); pause/resume capability |
| Formatação rica Docs (tabelas, imagens, signatures) não converte | 🟠 | Alto | Spike de 1 dia em 12-03 com 5 docs reais; export PDF como fallback; preserva Drive URL para visualização original |
| RT não aprova 80 docs em batch (gargalo humano) | 🟠 | Alto | Pre-classificação automatic; UI batch-approve por categoria; mass-approve com check |
| LD dinâmica gera explosão de combinações (15 docs × 17 setores = 255 entries) | 🟡 | Médio | Lazy loading; matriz virtualizada >50 rows; índices Firestore otimizados |
| Naming convention Drive divergente vs LM-01 (gaps) | 🟡 | Alto | Importer força match por código LM-01 (não nome arquivo); gaps logged em "manual review" queue |
| Permissões Drive Riopomba mudam mid-import | 🟢 | Baixo | Idempotência por hash + retry on permission denied |
| Multi-tenant labId errado em import (Riopomba vs Mercês) | 🟠 | Baixo | UI exige seleção explícita lab antes de batch; audit log labId em cada import |
| Aprovação RT obrigatória atrasa go-live (RT férias) | 🟡 | Médio | Delegação ao RT-Substituto; SLA explícito (5 dias úteis para aprovar batch) |
| FRs em Google Forms quebram após link import (lab apaga Form) | 🟡 | Baixo | Snapshot HTML do Form preview no momento do import; fallback se URL retorna 404 |

---

## Success Criteria (Phase 12 done)

1. SGQ schema estendido em produção (15 tipos, campos LD + hierarquia + urlDriveOriginal)
2. 4 surfaces deployadas:
   - `/sgq/lista-mestra` operacional
   - `/sgq/hierarquia` mostra árvore tree MQ→PQ→IT→FR
   - `/sgq/distribuicao` matriz docs × setores funcional
   - `/sgq/importar-drive` wizard OAuth
3. ~80 docs Riopomba migrados em produção (status `vigente` após RT aprovar)
4. Lista de Distribuição: 15 tipos × 17 setores mapeados; sync com /personnel funcionando
5. Hierarquia: MQ-001 → 25 PQs → ITs → 49 FRs visualizável em tree
6. RT consegue aprovar batch de 80 docs em <2h (UX target)
7. Drive URL preservada em `urlDriveOriginal` para audit/rollback
8. Compliance: DICQ Block B 4 itens fechados (4.2.2.2 + 4.3 hierarquia + 4.3 versão + 4.3 distribuição)
9. Riopomba DICQ baseline: 71.3% → ≥76% (re-run audit em 30 itens)
10. Multi-tenant: schema permite Mercês + Tabuleiro como labs separados sem retrabalho
11. ADR 0012 documentado (SGD architecture + Drive importer pattern)
12. Web Vitals: LCP <2.5s nas 4 surfaces; CLS <0.1
13. A11y AA: 0 violations
14. Bundle: chunks dentro do budget

---

## Skills GSD utilizadas

- ✅ `/gsd-discuss-phase 12` (conduzido inline com 4 perguntas críticas)
- ✅ `/gsd-plan-phase 12` (este overview + 6 PLAN.md)
- `/gsd-execute-phase 12 --wave 1` — após Phase 8 plan 04 (management-review) + Phase 11 plan 06 (portal paciente, para reusar pattern OAuth) verdes
- `/gsd-validate-phase 12` — antes de deploy final em 12-06
- `/gsd-secure-phase 12` — Drive OAuth + cross-tenant labId enforcement

---

## Canonical References

**Obsidian:**
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Labclin_Drive_Inventory.md` — inventário completo Drive Riopomba (~80 docs, 15 tipos, 17 setores, ruído mapeado)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_QMS_Index_2026-04-27.md` — índice QMS atual
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Compliance_DICQ.md` — Block B (4.2.2.2, 4.3.x)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_2025_Resumo.md` — Art. 117 (documentação obrigatória)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Decisoes_Abertas.md` — multi-tenant strategy
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Visao.md` — Riopomba como piloto

**Código vivo:**
- `src/features/sgq/` — base (estender, não substituir)
- `src/features/pops/` — pattern de aprovação RT
- `src/features/auditoria/` — chainHash + LogicalSignature
- `src/features/treinamentos/` — vínculo doc → treinamento (FR-27/FR-28)

**ADRs:**
- ADR 0001 (audit chain)
- ADR 0002 (multi-tenant)
- ADR 0012 (a criar): SGD architecture extension + Drive importer pattern

**Specs/Rules:**
- `.claude/rules/firestore-security.md`
- `.claude/rules/performance.md`
- `.claude/rules/deploy-protocol.md`

**Skills:**
- `hcq-firestore-rules-generator`
- `hcq-deploy-gates`
- `firebase-security-rules-auditor`

---

## Next Step

Após Phase 11 plan 06 (portal paciente — pattern OAuth externa) verde, time pode iniciar Wave 1:

```bash
/gsd-execute-phase 12 --wave 1
```

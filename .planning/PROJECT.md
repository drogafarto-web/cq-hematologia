# HC Quality — Sistema CIQ Laboratorial RDC 978

**Project ID:** HC-QUALITY-GSD  
**Status:** `Milestone v1.3 — CAPA Closure + Analytics` (2026-05-06)  
**Owner:** CTO (usuário principal)  
**Stack:** React 19 + Vite 6 + Firebase + Cloud Functions Node 22

---

## Vision

Implementar HC Quality como sistema world-class de gestão de qualidade laboratorial, completamente rastreável segundo RDC 978 ANVISA + LGPD, com arquitetura baseada em spines de compliance (Pessoa, Fornecedor, Lote, Equipamento, POP, NC, Auditoria).

---

## Current Milestone: v1.3 CAPA Closure + Analytics Modules

**Goal:** Fechar 12 CAPAs da auditoria interna (Phase 7) + entregar 4 módulos analíticos (Bioquímica, Liberação, Críticos, Reclamações) em paralelo. Atingir ≥90% conformance e preparar para auditoria externa em 2026-08-31.

**Deadline:** 2026-08-31 (14 semanas) — CAPA closure obrigatório por 2026-08-05

**Target phases:**
- **Phase 8:** CAPA Closure (12 findings → auditor sign-off)
- **Phase 9:** Bioquímica (QC quantitativa + Levey-Jennings)
- **Phase 10:** Liberação (release workflow + RT signature)
- **Phase 11:** Críticos (critical value escalation + SMS)
- **Phase 12:** Reclamações (complaint intake + RCA)

**Key context:**
- Execução paralela: Phase 8 sequencial (CAPA); Phases 9–12 independentes
- CAPA timeline: 2 Critical (5/30) → 6 High (6/30) → 3 Medium (7/5) → 1 Extended (8/5)
- Conformance baseline atual: 71.3% → Target: 90%+
- Auditor externo agendado pós-CAPA (2026-08-31 recomendado)

---

## Current State (2026-05-06)

- **✅ Phase 1 Complete** — All compliance violations blocked (13/13 RDC 978)
- **✅ Phase 2 Complete** — All 20 core + regulatory modules in production
- **✅ Milestone v1.1 Complete** — Analytics + Export + Mobile (3 phases, 11/11 plans, 738/738 tests)
- **✅ Milestone v1.2 Complete** — Audit Readiness (4 phases, 22/24 plans, 71.3% baseline, 12 CAPAs generated)
- **🔵 Milestone v1.3 Planning** — CAPA Closure + 4 Analytics modules (Phase 8-12)
- **Metrics:** 800+/800+ tests ✓, 78 callables live, 0 RDC violations, 12 CAPAs awaiting closure

---

## Milestone Timeline

| Milestone | Status | Scope | Period |
|-----------|--------|-------|--------|
| **v1.0** | ✅ Complete | Compliance hardening (Phase 1) + 20 core modules (Phase 2) | 2026-04 → 2026-05-04 |
| **v1.1** | ✅ Complete | Analytics + Export + Mobile (Phase 3.1 → 3.3) | 2026-05-04 → 2026-05-05 |
| **v1.2** | ✅ Complete | Audit Readiness (DICQ 4.3 + RDC 978) — 4 phases, 71.3% baseline | 2026-05-06 → 2026-05-06 |
| **v1.3** | 🔵 Active | CAPA Closure (12 findings) + 4 Analytics modules (parallel) | 2026-05-06 → 2026-08-31 |

---

## Phase 2 Summary (Completed)

### Batch 1: Core Regulatory
- ✅ ADR-0001 Wave 2: Audit Trail (log + get + validate + report callables)
- ✅ ADR-0003 Wave 5: NC Blocking gates (24 E2E tests, rules strict)
- ✅ ADR-0004 Wave 3: POPs versionamento + RT training + FR exports
- **Result**: sgq + pops + auditoria live in production

### Batch 2: Extensions
- ✅ controle-temperatura: Rules (CT-01 ✅, CT-04 ✅) + UI
- ✅ educacao-continuada: 2 new callables (trigger + cascade)
- **Result**: 20/20 modules live, 347/347 tests passing

---

## Milestone v1.2 — Audit Readiness (Current)

**Documents:**
- 🔵 `.planning/REQUIREMENTS.md` — escopo v1.2 (a gerar)
- 🔵 `.planning/ROADMAP.md` — 4 phases (a gerar)

**Key decisions made:**
1. Norma alvo: **DICQ 4.3 + RDC 978/2025** combinados
2. v1.1 cleanup entra como Phase 1 (TEMP-IMPLANTACAO + Stream C)
3. Módulos analíticos novos (Bioquímica, Liberação, Críticos) ficam fora — vão pra v1.3
4. Audit é interno/dry-run, não auditoria externa formal

**Próximo passo:** `/gsd-plan-phase [N]` após roadmap aprovado

---

## Non-Negotiable Guardrails (Ongoing)

- ✓ **Compliance first** — RDC 978 + LGPD antes de feature
- ✓ **Spine integrity** — não duplicar entidades, apenas referências
- ✓ **Auditoria chain** — HMAC-SHA256 + chain-hash (NIST approved)
- ✓ **CTO approval** — antes de qualquer firebase deploy
- ✓ **Dupla revisão** — mudanças em `/users`, `/auditLogs`, rules

---

## Key References

- v1.1 closure: `.planning/.continue-here.md` (handoff completo)
- v1.0 phases archive: `.planning/phases/02-construction/` + `.planning/phases/03.{1,2,3}-*/`
- Modules map: `docs/playbooks/modules-roadmap.md` (status ✅/🟡/🔵/⚪ por bloco DICQ)
- Compliance spines: `docs/playbooks/compliance-spines.md`
- ADRs: `docs/adr/` (0001-0007 deployed)
- Obsidian — checklist auditoria: `Obsidian_Brain/01_Projetos/HC_Quality_Checklist_Auditoria.md`
- Obsidian — mapa DICQ: `Obsidian_Brain/01_Projetos/HC_Quality_Compliance_DICQ.md`
- Obsidian — RDC 978 resumo: `Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_2025_Resumo.md`

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

**Last updated:** 2026-05-06 — Milestone v1.2 Audit Readiness initialized
**Next:** `/gsd-discuss-phase 4` (após roadmapper)

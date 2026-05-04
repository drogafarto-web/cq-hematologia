# HC Quality — Sistema CIQ Laboratorial RDC 978

**Project ID:** HC-QUALITY-GSD  
**Status:** `Phase 2 Complete, Phase 3 Planning` (2026-05-04)  
**Owner:** CTO (usuário principal)  
**Stack:** React 19 + Vite 6 + Firebase + Cloud Functions Node 22

---

## Vision

Implementar HC Quality como sistema world-class de gestão de qualidade laboratorial, completamente rastreável segundo RDC 978 ANVISA + LGPD, com arquitetura baseada em spines de compliance (Pessoa, Fornecedor, Lote, Equipamento, POP, NC, Auditoria).

---

## Current State (2026-05-04)

- **✅ Phase 1 Complete** — All compliance violations blocked (13/13 RDC 978)
- **✅ Phase 2 Complete** — All 20 core + regulatory modules in production
  - Batch 1: auditoria + pops + nc-gates (ADR-0001, 0003, 0004)
  - Batch 2: controle-temperatura + educacao-continuada completion
- **🔵 Phase 3 Planning** — Analytics + Data Export + Mobile (6-8 weeks)
- **Metrics:** 347/347 tests ✓, 59 callables live, 0 new violations

---

## Phase Timeline

| Phase | Status | Deliverables | Duration | ADRs |
|-------|--------|-------------|----------|------|
| **Phase 1** | ✅ Complete | Compliance hardening, spine integrity, HMAC chain | 2026-04 | 0002-0007 |
| **Phase 2** | ✅ Complete | 20 core modules, auditoria, pops, nc, ct, ec | 2026-05-04 | 0001, 0003, 0004 |
| **Phase 3** | 🔵 Planning | Analytics, Data Export, Mobile (React Native / Expo) | 2026-05 to 2026-07 | 0008-0010 |
| **Phase 4** | 📋 Backlog | Advanced compliance, multi-site, integrations | Q3-Q4 2026 | 0011+ |

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

## Phase 3 Planning (Current)

**Documents created:**
- ✅ `.planning/PHASE3_REQUIREMENTS.md` — 3 independent modules (Mobile, Analytics, Export)
- ✅ `.planning/PHASE3_ROADMAP.md` — 8-week timeline, 4 phases, 58 person-weeks

**Key Decisions Pending:**
1. Mobile: React Native (Expo) vs PWA?
2. Analytics: Real-time vs scheduled aggregation?
3. Export: Server-side (job queue) vs client-side?

**Next step:** CTO review PHASE3_REQUIREMENTS.md + approve architecture decisions

---

## Non-Negotiable Guardrails (Ongoing)

- ✓ **Compliance first** — RDC 978 + LGPD antes de feature
- ✓ **Spine integrity** — não duplicar entidades, apenas referências
- ✓ **Auditoria chain** — HMAC-SHA256 + chain-hash (NIST approved)
- ✓ **CTO approval** — antes de qualquer firebase deploy
- ✓ **Dupla revisão** — mudanças em `/users`, `/auditLogs`, rules

---

## Key References

- Phase 2 Memory: `C:\Users\labcl\.claude\projects\C--hc-quality\memory\session_2026-05-04_phase2_complete.md`
- Requirements: `.planning/PHASE3_REQUIREMENTS.md`
- Roadmap: `.planning/PHASE3_ROADMAP.md`
- ADRs: `docs/adr/` (0001-0010 planned)
- Obsidian: `Obsidian_Brain/01_Projetos/HC_Quality_*.md` (multiple docs)

---

**Next:** 
1. CTO review Phase 3 documents
2. `/gsd-plan-phase 3.1` para iniciar Phase 3 Foundation
3. Team staffing (6-7 engineers)

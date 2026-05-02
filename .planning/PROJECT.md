# HC Quality — Sistema CIQ Laboratorial RDC 978

**Project ID:** HC-QUALITY-GSD  
**Status:** `initialized` (2026-05-02)  
**Owner:** CTO (usuário principal)  
**Stack:** React 19 + Vite 6 + Firebase + Cloud Functions Node 22

---

## Vision

Implementar HC Quality como sistema world-class de gestão de qualidade laboratorial, completamente rastreável segundo RDC 978 ANVISA + LGPD, com arquitetura baseada em spines de compliance (Pessoa, Fornecedor, Lote, Equipamento, POP, NC, Auditoria).

---

## Current State

- **42% completo** — 7/26 módulos em produção
- **Núcleo sólido:** CIQ (Hemato, Imuno, Coag, Uroanálise) + Controle Temperatura + Insumos
- **Bloqueador técnico:** 13 violações RDC 978 (spine fragmentadas)
- **ADRs pendentes:** 7 (0002-0007)

---

## Scope

Executar **2 fases sequenciadas:**

### Fase 1: Compliance Hardening (ADRs 0005-0007)
- ADR 0005 (crypto helper) — semana 1-2
- ADR 0002 (Lote↔NF) + ADR 0006 (Pessoa) — semana 3-5 (paralelo)
- ADR 0003 (NC global) + ADR 0004 (POP) — semana 6-8
- ADR 0007 (Equipamento) — semana 9-10

**Saída:** Sistema com spines integrity + LGPD + RDC 978 validated

### Fase 2: Construção de Módulos (13 módulos ⚪)
- Dependência: Fase 1 100% completa
- Ordem: POPs → NC + CAPA → Auditoria → KPIs → resto
- ~6-8 meses em paralelo (batch)

---

## Non-Negotiable Guardrails

- ✓ **Compliance first** — RDC 978 + LGPD antes de feature
- ✓ **Spine integrity** — não duplicar entidades, apenas referências
- ✓ **Auditoria chain** — HMAC-SHA256 + chain-hash (NIST approved)
- ✓ **CTO approval** — antes de qualquer firebase deploy
- ✓ **Dupla revisão** — mudanças em `/users`, `/auditLogs`, rules

---

## Key References

- Análise: `c:/hc quality/docs/2026-05-02-gsd-analise-modulos.md`
- Violações: `c:/hc quality/docs/backlog/spine-violations.md`
- ADRs: `c:/hc quality/docs/adr/`
- Obsidian: `Obsidian_Brain/01_Projetos/HC_Quality_GSD_Roadmap_2026-05-02.md`

---

**Next:** `/gsd-plan-phase 1` para iniciar ADR 0005

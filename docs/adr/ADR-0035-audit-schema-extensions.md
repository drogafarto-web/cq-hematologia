# ADR-0035: Audit Schema Extensions (FR-045 + PlanoAcao + ReAuditoria)

**Status:** Accepted  
**Date:** 2026-05-09  
**Phase:** 11 — PQ-24 Compliance Remediation  

## Context

Gap analysis `HC_Quality_vs_PQ24_FR42_Gap_Analysis.md` identified 4 critical gaps:
- FR-045 (Presença): attendance signature capture missing
- FR-043 mapping: 4-table audit report structure undocumented
- createPlanoAcao: TODO stub (Phase 7 → Phase 11)
- createReAuditoria: re-audit workflow missing (PQ-24 §6.6)

## Decision

Extend `Auditoria`, `Sessao`, `PlanoAcao` types + introduce `Presenca`, `ReuniaoAuditoria` interfaces to support:
1. Multi-auditor tracking (`Sessao.auditorLider`, `auditoresAuxiliares[]`)
2. Re-audit chain (`Auditoria.tipoExecucao`, `auditoriaOriginalId`)
3. Attendance signature (`Presenca` + `LogicalSignature`)
4. Action plan tracking (`PlanoAcao` extended with `id`, `labId`, `assinatura`, `deletadoEm`)

All types follow soft-delete + multi-tenant patterns. Callables handle signature generation server-side.

## Consequences

- ✅ PQ-24 cobertura 55% → 90%+
- ✅ Firestore schema now supports FR-045 + FR-043 + FR-042
- ✅ 3 new callables (createPlanoAcao, registerPresenca, createReAuditoria)
- ✅ 5 frontend components (PlanoAcaoForm, List, PresencaPanel, ReAuditoriaCard, Chain)
- ⚠ Auditorias table gains 3 new optional fields (minor backward-compat, read-only)

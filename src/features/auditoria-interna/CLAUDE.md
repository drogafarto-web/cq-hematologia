# Auditoria Interna Module

DICQ 1.3 — internal audit planning and execution.

## Dependencies

- Wave 1: Types, service layer, Firestore rules ✓
- Wave 2: UI components ✓
- Wave 3: Cloud Functions (callables) ✓ — createAuditoria wired 2026-05-13

## Components

- AuditoriaView: main entry point (3 tabs)
- AuditoriaPlanning: create annual audit plans (wired to createAuditoria callable)
- SessaoExecucaoPanel: in-loco checklist execution
- AchadoForm: finding registration
- PlanoAcaoForm: action plan creation (wired to createPlanoAcao callable)
- PlanoAcaoList: action plan listing
- PresencaPanel: FR-045 meeting attendance capture
- ReAuditoriaCard / ReAuditoriaChain: re-audit tracking

## Status

Module fully wired. AuditoriaPlanning creates plans via Cloud Function callable.
Phase 11 PQ-24 components (PlanoAcao, Presença, Re-Auditoria) operational.

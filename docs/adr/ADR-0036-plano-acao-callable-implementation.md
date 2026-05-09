# ADR-0036: PlanoAcao Callable Implementation (Phase 7 TODO → Phase 11 Real)

**Status:** Accepted  
**Date:** 2026-05-09  
**Phase:** 11 — PQ-24 Compliance Remediation  

## Context

Phase 7 introduced `createPlanoAcao` as a TODO stub. Phase 11 realizes the full implementation:
- Zod validation (descricao 20-500, responsavel, prazo ISO 8601)
- Achado cross-collection validation (collectionGroup query)
- LogicalSignature generation (canonical JSON SHA-256)
- Atomic transaction (plano create + achado.planoAcaoId backlink)

## Decision

Implement `createPlanoAcao` callable with:
1. **Auth validation** — unauthenticated → HttpsError
2. **Membership check** — isActiveMemberOfLab(labId, uid)
3. **Achado lookup** — collectionGroup('achados') filtered by id + labId
4. **Signature generation** — sorted keys, SHA-256 hash
5. **Atomic write** — Firestore transaction linking plano ↔ achado

Response: `{ success: true, planoId, status: 'nao_iniciado' }`

## Consequences

- ✅ Removes Phase 7 technical debt (TODO eliminated)
- ✅ Enables PlanoAcaoForm + PlanoAcaoList UI
- ✅ Completes FR-42 (plano de ação lifecycle)
- ✅ RDC 978 Art. 94 (corrective action tracking) supported

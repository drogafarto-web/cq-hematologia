# ADR 0006 — Pessoa Completa (Qualificações + LGPD)

**Status:** Implementation (types + CF basic)  
**Depends on:** ADR 0005 ✓

---

## Problem

**V-002, V-005:** Pessoa/Member sem:
- `cpfHash` (LGPD)
- `cargo` estruturado
- `conselhoProfissional` (CRBM, CRF, CRM, CRBio)
- `qualificacoes[]` (treinamento, reciclagem)
- `responsavelTecnico` único

Consequence: Não dá pra validar habilitação (quem pode rodar hemato? só com qual nível?).

---

## Solution

**Mandatory schemas:**

1. **User** — cpfHash (LGPD), status, labs
2. **Member** — cargo, conselho prof., responsavelTecnico (1 por lab)
3. **Qualificacao** — tipo, módulos, validade, assinado por RT

**Gate:** Toda operação técnica valida `isOperadorQualificadoPara(labId, uid, modulo)`.

---

## Implementation

### Types ✓
- User, Member, Qualificacao criados

### Cloud Functions
- `criarQualificacao()` — CF RT-only
- `isOperadorQualificadoPara()` — validator

### Firestore Rules
- Member.responsavelTecnico: única por lab
- Qualificacao: HMAC assinado (ADR 0005)

### Backfill
- Hashed CPF (SHA-256) dos membros existentes
- Populate cargo from existing data
- Migrar treinos de educacaoContinuada → qualificacoes

---

**Timeline:** Week 3-5 (parallel with 0002)  
**Next:** Firestore rules + backfill script

# ADR-0007 — Equipment Calibration + Maintenance Gating

**Date:** 2026-05-03  
**Status:** ACCEPTED  
**Context:** Phase 2 Batch 1, equipment validation flow

---

## Problem

Analytical equipment (HPLC, mass spec, analyzers) require:

1. **Current valid calibration** — before accepting sample run
2. **Current maintenance status** — equipment must not be in maintenance mode

Without gating, uncalibrated equipment can process samples, violating RDC 978/2025 (5.3.1 equipment qualification).

---

## Decision

Implement **two validation functions** (Cloud Functions callables) that gate sample acceptance:

1. **`validarCalibracaoEquipamento(labId, equipamentoId)`**
   - Returns: `{ valido: bool, diasRestantes?: number, venceEm?: Timestamp }`
   - Checks: `equipamentos/{id}.calibracaoAtual.dataValidade > now()`
   - Used by: CIQ modules before accepting run creation

2. **`validarManutencaoEquipamento(labId, equipamentoId)`**
   - Returns: `{ manutencaoProgramada: bool, proximaEm?: Timestamp }`
   - Checks: `equipamentos/{id}.status != 'manutencao'` AND próxima manutenção não sobrepõe agora
   - Used by: run UI to disable create button if in maintenance window

---

## Rationale

- **Defense-in-depth**: validates server-side, not just Firestore rules
- **Compliance audit trail**: callable logs each validation for RDC 978 traceability
- **UX clarity**: disabled buttons + tooltips inform operators why they can't proceed
- **Schema divergence acceptable here**: equipment calibration is deterministic logic, not business-logic-rich like NC (which diverges due to architectural evolution)

---

## Schema Notes

**Backend** (`functions/src/modules/equipamentos/types.ts`):

```typescript
export interface Equipamento {
  id: string;
  labId: string;
  nome: string;
  tipo: 'analisador' | 'espectrometro' | ...;
  calibracaoAtual: {
    versao: number;
    dataEmissao: Timestamp;
    dataValidade: Timestamp;
    numeroCertificado: string;
    laboratorioCalibrador: string;
  };
  status: 'ativo' | 'manutencao' | 'inativo';
  proximaManutencao?: Timestamp;
  ...
}
```

**Frontend** (`src/features/equipamentos/types.ts`):

- Currently mirrors backend types — **no divergence yet**
- Watch: if business logic evolves (e.g., equipamento assignment to operators), may diverge

---

## Implementation Checklist

- [ ] Functions: `validarCalibracaoEquipamento`, `validarManutencaoEquipamento` in `functions/src/modules/equipamentos/`
- [ ] Exports in `functions/src/index.ts`
- [ ] CIQ modules call before run creation
- [ ] Firestore rules protect `equipamentos/{id}` writes (prevent tampering with calibration dates)
- [ ] E2E test: uncalibrated equipment → run creation rejected

---

## References

- RDC 978/2025 § 5.3.1 (equipment qualification)
- Phase 2 Batch 1 Task 5

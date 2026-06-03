# EXECUTE LOG — Gestão de Riscos

Registro mínimo pós-tarefa (gate + nota). **Não** substitui commit/deploy.

---

## 2026-05-10 — loop T-GR-01 … T-GR-04

| Task    | Gate                                     | Resultado                                                                                                                                                                                                                                                                                      |
| ------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-GR-01 | `npx tsc --noEmit` (root)                | OK — `Risk` + `ncIds`/`capaIds`/aprovação                                                                                                                                                                                                                                                      |
| T-GR-02 | `npx tsc --noEmit` (root)                | OK — `RiskTemplate` + barrel `types/index.ts`                                                                                                                                                                                                                                                  |
| T-GR-03 | inspeção rules                           | OK — `risk-templates` em `firestore.rules`                                                                                                                                                                                                                                                     |
| T-GR-04 | `npx tsc --noEmit` (`functions/`) + root | OK — callable `risks_vincularNcAoRisco` em `functions/src/modules/risks/vincularNcAoRisco.ts` (não `callables/risks/` — paridade com `createRisk`/`updateRisk`); `VincularNcAoRiscoInputSchema` (exatamente um de `ncId` \| `capaId`); `RiskAuditEvent.tipo` + `vincular_nc` / `vincular_capa` |

**Nota T-GR-04:** Callable em `modules/risks/` (paridade com os demais). Dois vínculos na mesma chamada → dois eventos (`timestamp` +1 ms entre eles) e retorno `{ eventIds: string[] }`.

---

## 2026-05-10 — T-GR-05

| Task    | Gate                                     | Resultado                                                                                                                                                                                                                                               |
| ------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-GR-05 | `npx tsc --noEmit` (`functions/`) + root | OK — `risks_aprovarRisco` em `functions/src/modules/risks/aprovarRisco.ts`; `assertRisksAdminOrOwner` + `AprovarRiscoInputSchema`; evento `tipo: 'aprovar_risco'`; payload assinado `{ action, labId, riskId, codigo }`; status `aberto` \| `mitigando` |

**Nota T-GR-05:** Callable em `modules/risks/` (não `callables/risks/`). Aprovação só `nivel === 'critico'` e admin/owner.

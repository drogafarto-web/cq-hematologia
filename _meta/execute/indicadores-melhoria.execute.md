# Execute log — Indicadores & Melhoria

**Spec:** `_meta/specs/indicadores-melhoria.spec.md`  
**Tasks:** `_meta/tasks/indicadores-melhoria.tasks.md`

---

## 2026-05-10 — T-IM-01

- **Feito:** `src/features/kpis/types/KPIMeta.ts` (`KPIMeta`, `KPIMetaUnidade`); barrel `src/features/kpis/types/index.ts` reexportando `KPI` + `KPIMeta`.
- **Gate:** `npx tsc --noEmit` — OK (exit 0).

---

## 2026-05-10 — T-IM-02

- **Feito:** `src/features/kpis/types/PlanoMelhoria.ts` (`PlanoMelhoriaStatus`, `PlanoMelhoria`, `AcaoMelhoriaStatus`, `AcaoMelhoria`); barrel atualizado.
- **Gate:** `npx tsc --noEmit` — OK (exit 0).

---

## 2026-05-10 — T-IM-03

- **Feito:** `KPIDaily` em `src/features/kpis/types/KPI.ts` — campo opcional `meta?: number`.
- **Gate:** `npx tsc --noEmit` — OK (exit 0).

---

## 2026-05-10 — T-IM-04

- **Feito:** `firestore.rules` — `kpi-metas/{metaId}`; `planos-melhoria/{planoId}` + `acoes/{acaoId}` (read/create/update conforme task; `hasModuleAccess('kpis')` alinhado a `kpi-metrics`/`kpi-alerts`).
- **Gate:** `npx tsc --noEmit` — OK (exit 0).

---

## 2026-05-10 — T-IM-05

- **Feito:** `functions/src/callables/kpis/definirMetaKPI.ts` — callable Zod (`labId`, `tipoKPI`, `valor`, `unidade`, `vigenciaInicio`, `vigenciaFim?`); auth SuperAdmin ou admin/owner ativo; transação desativa metas ativas do mesmo `tipoKPI` (`vigenciaFim` + `ativo: false`) e cria novo doc com `ativo: true`. Barrel `callables/kpis/index.ts` + export em `functions/src/index.ts`.
- **Gate:** `npx tsc --noEmit` em `functions/` — OK (exit 0).

---

## 2026-05-10 — T-IM-06

- **Feito:** `functions/src/callables/kpis/criarPlanoMelhoria.ts` — Zod (`labId`, `titulo`, `descricao`, `responsavelId`, `prazoMeta`, `kpiOrigemId?`); auth SuperAdmin ou membro ativo; `responsavelNome` via `users/{responsavelId}` (fallback `uid`); doc em `labs/{labId}/planos-melhoria` com `status: 'rascunho'`, timestamps server; retorno `{ planoId }`. Export em `callables/kpis/index.ts` e `functions/src/index.ts`.
- **Gate:** `npx tsc --noEmit` em `functions/` — OK (exit 0).

---

## 2026-05-10 — T-IM-07

- **Feito:** `functions/src/callables/kpis/atualizarAcaoMelhoria.ts` — Zod (`labId`, `planoId`, `acaoId`, `status` em `pendente|em_andamento|concluida|cancelada`, `evidencia?`); auth SuperAdmin ou membro ativo; exige doc existente com campo `prazo` válido; `update` de `status`, `evidencia` se enviada, `updatedAt` server; retorno `{ ok: true }`. Export em `callables/kpis/index.ts` e `functions/src/index.ts`.
- **Gate:** `npx tsc --noEmit` em `functions/` — OK (exit 0).

---

## 2026-05-10 — T-IM-08

- **Feito:** `functions/src/callables/kpis/fecharPlanoMelhoria.ts` — Zod (`labId`, `planoId`, `logicalSignature` com hash 64 + operatorId + ts); auth SuperAdmin ou membro ativo `admin`/`owner`; exige plano existente com `status === 'ativo'`; `update` para `concluido`, `conclusaoEm`, `logicalSignature`, `updatedAt`; checagem `labId` no doc quando presente. Export em `callables/kpis/index.ts` e `functions/src/index.ts`.
- **Gate:** `npx tsc --noEmit` em `functions/` — OK (exit 0).

---

## 2026-05-10 — T-IM-09

- **Feito:** `src/features/kpis/hooks/useKpiMetas.ts` — `onSnapshot` em `labs/{labId}/kpi-metas` com `where('ativo','==',true)`; `useActiveLabId`; mapeamento seguro para `KPIMeta`; `getMetaByTipo(tipo)`; export em `src/features/kpis/index.ts`.
- **Gate:** `npx tsc --noEmit` na raiz — OK (exit 0).

---

## 2026-05-10 — T-IM-10

- **Feito:** `src/features/kpis/hooks/usePlanosMelhoria.ts` — `onSnapshot` em `labs/{labId}/planos-melhoria` com filtros opcionais `status` e `responsavelId`; exclui docs com `deletadoEm`; ordenação por `prazoMeta` + título. `src/features/kpis/hooks/usePlanoMelhoria.ts` — `onSnapshot` no doc do plano + subcoleção `acoes`; loading só após ambas as primeiras emissões; exports em `src/features/kpis/index.ts`.
- **Gate:** `npx tsc --noEmit` na raiz — OK (exit 0).

---

## 2026-05-10 — T-IM-11

- **Feito:** `PlanoMelhoriaCard` + `PlanoMelhoriaListView` (filtro por status, modal Novo plano → `criarPlanoMelhoria`, preview read-only com `usePlanoMelhoria`); `usePlanosMelhoriaPendentesCounts` para contagens de ações pendentes por card; exports em `src/features/kpis/index.ts`.
- **Gate:** `npx tsc --noEmit` na raiz — OK (exit 0).

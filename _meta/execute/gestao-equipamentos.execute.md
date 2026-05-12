# Execute log — Gestão de Equipamentos

## T-GE-12 — CF `generateEquipamentoReport` + botão export (2026-05-10)

- **Status fatia:** concluída (aceite: callable `generateEquipamentoReport` `{ labId, equipamentoId }` → PDF cadastro + calibração (+ cert URL) + manutenções `agendada` + usos últimos 30 dias → Storage + URL assinada; UI `EquipamentoDetail` botão "Exportar relatório" via `httpsCallable` região `southamerica-east1`; sem listener novo).
- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit` + `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `functions/src/callables/equipamentos/generateEquipamentoReport.ts` (novo); `functions/src/callables/equipamentos/index.ts` (novo); `functions/src/index.ts` — export `generateEquipamentoReport`; `src/features/equipamentos/components/EquipamentoDetail.tsx` — botão + estado erro/loading; correção TS18048 (`proximaCalibracao` local para narrowing em `toDate()`).

## T-GE-11 — Fatia 4: `EquipamentoDetail` + ficha expandida (`EquipamentoCard`) (2026-05-10)

- **Status fatia:** concluída (aceite: ficha exibe `CalibracaoBadge` quando `proximaCalibracao != null`; exibe `ManutencaoList`; derivação de status só em `EquipamentoDetail` via `useCalibracaoStatus` — `ManutencaoList` com `omitCalibracaoBadge` não passa `proximaCalibracao`, evitando segundo hook com o mesmo input; sem `any`; sem Firestore/listeners novos).
- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `EquipamentoDetail.tsx` (novo); `ManutencaoList.tsx` — prop `omitCalibracaoBadge?`; `EquipamentoCard.tsx` — seção "Manutenção e calibração" + `<EquipamentoDetail equipamento={…} />`.

## T-GE-11 — Fatia 3: componente `ManutencaoList` (2026-05-10)

- **Status fatia:** concluída (aceite: `useManutencoes` em tempo real; `useCalibracaoStatus(proximaCalibracao)` + `CalibracaoBadge` quando `proximaCalibracao != null` — sem duplicar derivação de status; sem `any`; `EquipamentoDetail` não tocado).
- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/components/ManutencaoList.tsx` (novo) — props `labId`, `equipamentoId`, `proximaCalibracao?`; lista com chips de status alinhados ao módulo; empty/loading/error.
- **Pendente (histórico):** resolvido na fatia 4 — `EquipamentoDetail` + wire em `EquipamentoCard`.

## T-GE-11 — Fatia 2: componente `CalibracaoBadge` (2026-05-10)

- **Status fatia:** concluída (aceite: `CalibracaoBadge` consome `useCalibracaoBadgePresentation` → `{ label, toneClasses }`; base espacial `BADGE_BASE` alinhada ao `CHIP` de `EquipamentoCard`; sem lógica de estado duplicada; sem `any`; sem Firestore / listener novo).
- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/components/CalibracaoBadge.tsx` (novo) — prop `calibracaoStatus: CalibracaoStatus`; `className` = `BADGE_BASE` + `toneClasses` do hook; `role="status"`.
- **Pendentes (histórico desta fatia):** `ManutencaoList` entregue na fatia 3; **`EquipamentoDetail.tsx` continua pendente** (wire na ficha).

## T-GE-11 — Fatia 1: hook `useCalibracaoBadgePresentation` (2026-05-10)

- **Status fatia:** concluída (aceite: hook puro `useCalibracaoBadgePresentation(calibracaoStatus)` → `{ label, toneClasses }`; `CalibracaoStatus` + `useMemo` + `switch` exaustivo; sem `any`; sem UI/Firestore/outros arquivos).
- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/hooks/useCalibracaoBadgePresentation.ts` — `useMemo` + `switch` em `CalibracaoStatus` → rótulo pt-BR + classes Tailwind para badge.
- **Débito — próxima fatia (UI T-GE-11):** integrar `ManutencaoList` + `CalibracaoBadge` em `EquipamentoDetail.tsx` (arquivo ainda não existe no módulo — criar ou renomear ficha existente conforme padrão do hub). `ManutencaoList` entregue na fatia 3.

---

## T-GE-10 — Hook `useEquipamentoUso` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/hooks/useEquipamentoUso.ts` (novo) — `onSnapshot` em `labs/{labId}/equipamentos/{equipamentoId}/usos`, `orderBy('inicio','desc')`, `limit(30)`, cleanup com unsubscribe; retorno `{ usos, loading, error }`.

---

## T-GE-09 — Hook `useCalibracaoStatus` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/hooks/useCalibracaoStatus.ts` (novo) — `useMemo` + `deriveStatus`: `sem_data` se indefinido; `vencida` se `toMillis() < now`; `proxima` se `<= now+30d`; senão `em_dia`.

---

## T-GE-08 — Hook `useManutencoes` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `src/features/equipamentos/hooks/useManutencoes.ts` (novo) — `onSnapshot` em `labs/{labId}/equipamentos/{equipamentoId}/manutencoes`, `orderBy('dataPrevista','desc')`, `limit(50)`, cleanup com unsubscribe; retorno `{ manutencoes, loading, error }`.

---

## T-GE-07 — CF cron `equipamentos_alertManutencaoVencida` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `functions/src/modules/equipamentos/alertManutencaoVencida.ts` — `onSchedule` every 24h `America/Sao_Paulo`, percorre labs → equipamentos → `manutencoes` `agendada`, filtra `dataPrevista < now−1d`, upsert `kpi-alerts` id `manutencao_vencida_{id}` (`tipo`, `severidade`, `equipamentoId`, `manutencaoId`, `mensagem`, `lida`/`criadoEm`/`resolvido`). `modules/equipamentos/index.ts` + `functions/src/index.ts` export.

---

## T-GE-06 — CF callable `registrarManutencaoRealizada` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `registrarManutencaoRealizada.ts` (novo), `manutencao/index.ts`, `functions/src/index.ts` — export duplo.

---

## T-GE-05 — CF callable `agendarManutencao` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `functions/src/callables/manutencao/agendarManutencao.ts` (novo), `callables/manutencao/index.ts`, `functions/src/index.ts` — export.

---

## T-GE-04 — Firestore rules `manutencoes` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `firestore.rules` — subcoleção `equipamentos/{id}/manutencoes` (read member, create com labId/equipamentoId/status, update labId imutável, delete false).

---

## T-GE-03 — `EquipamentoUso` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `EquipamentoUso.ts` (novo) + export em `types/index.ts`.

---

## T-GE-02 — `ManutencaoPreventiva` + `ManutencaoStatus` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `ManutencaoPreventiva.ts` (novo) + exports em `types/index.ts`.

---

## T-GE-01 — Estender `Equipamento` calibração (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `Equipamento.ts` — `certificadoCalibracaoUrl?`, `proximaCalibracao?`, `calibracaoStatus?`.

---

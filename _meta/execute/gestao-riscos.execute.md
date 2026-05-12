# Execute log — Gestão de Riscos

## T-GR-12 — Export PDF + template picker (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `RisksView.tsx` — `httpsCallable` `generateRiskMatrixPDF`, botão topbar, toast + `window.open`. `CreateRiskModal.tsx` — `useRiskTemplates`, select "Usar template" pré-preenche categoria/processo/descrição/P/S/D.

---

## T-GR-11 — `generateRiskMatrixPDF` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Callable `generateRiskMatrixPDF` em `functions/src/callables/risks/generateRiskMatrixPDF.ts` + export em `functions/src/index.ts` (PDF mapa de riscos, Storage, URL assinada 2h).

---

## T-GR-08 — `useRiskTemplates` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Criado `src/features/risks/hooks/useRiskTemplates.ts` — `onSnapshot` em `labs/{labId}/risk-templates` com `where('ativo','==',true)`, ordenação `categoria` + `titulo`.

---

## T-GR-07 — `useRiskReviewAlerts` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Criado `src/features/risks/hooks/useRiskReviewAlerts.ts` — `subscribeRisks`, `useMemo` para vencidas/prestes/count, fallback `reviewDate` vs `reviewSchedule.proximaRevisao`.

---

## T-GR-06 — `alertRiskReviews` (2026-05-10)

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Criado `functions/src/modules/risks/alertRiskReviews.ts` (cron 07:00 BRT, upsert `kpi-alerts` tipo `revisao_risco_vencida`, fallback `reviewDate` se sem `reviewSchedule.proximaRevisao`, status `in` aberto/mitigando/em_tratamento, `logger.warn` para revisão vencida). `functions/src/index.ts`: export `risks_alertRiskReviews`.

---

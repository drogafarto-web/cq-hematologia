# EXECUTE — Apoio & Fornecedores

Registro incremental das tarefas de `_meta/tasks/apoio-fornecedores.tasks.md`.

---

## T-AF-01 (retroativo)

- **Comando:** `npx tsc --noEmit` (root)
- **Resultado:** exit 0
- **Diff resumido:** `Fornecedor.ts` — `EnderecoEstruturado`, `QualificacaoFornecedor`, campos opcionais `enderecoEstruturado`, `qualificacao`, `categorias`; import `LogicalSignature`.

---

## T-AF-02

- **Comando:** `npx tsc --noEmit` (root)
- **Resultado:** exit 0
- **Diff resumido:** Novo `types/AvaliacaoFornecedor.ts` (interface + tipos auxiliares); novo barrel `types/index.ts` reexportando fornecedores + nota fiscal.

---

## T-AF-03

- **Comando:** `npx tsc --noEmit` (root); emulador Firestore não executado neste ambiente (gate opcional).
- **Resultado:** exit 0
- **Diff resumido:** `firestore.rules` — dentro de `labs/{labId}/fornecedores/{fornecedorId}`: funções `fornecedorAvaliacaoLogicalSignatureOk` / `fornecedorAvaliacaoCreateValid`; subcoleções `avaliacoes-periodicas` (read membro, create com payload + assinatura, update/delete false) e `events` (read/create membro, update/delete false).

---

## T-AF-04

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `callables/fornecedores/qualificarFornecedor.ts` (Zod: `labId` + campos da spec; auth admin/owner na 1ª qualificação, RT na substituição, SuperAdmin sempre; batch `qualificacao` + `events` com `chainHash` SHA-256 do payload inicial); `callables/fornecedores/index.ts` barrel; `functions/src/index.ts` export `qualificarFornecedor`.
- **Nota:** Input inclui `labId` (multi-tenant); spec da task lista só os outros campos — o cliente deve enviar `labId` junto.

---

## T-AF-05

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `callables/fornecedores/registrarAvaliacaoFornecedor.ts` (Zod: `labId` + `fornecedorId`, `resultado`, `criteriosAvaliados`, `observacoes?`, `logicalSignature`; auth membro ativo ou SuperAdmin; doc em `avaliacoes-periodicas/{id}` alinhado a `fornecedorAvaliacaoCreateValid`; evento em `events` com `chainHash` encadeado ao último evento por `orderBy('timestamp','desc')`); barrel `fornecedores/index.ts`; `functions/src/index.ts` export `registrarAvaliacaoFornecedor`.
- **Nota:** Input inclui `labId` (multi-tenant), como em T-AF-04.

---

## T-AF-06

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `hooks/useAvaliacoesFornecedor.ts` (`onSnapshot` em `labs/{labId}/fornecedores/{fornecedorId}/avaliacoes-periodicas`, `orderBy('data','desc')`, retorno `{ avaliacoes, loading, error }`); novo barrel `hooks/index.ts` exportando `useAvaliacoesFornecedor`.

---

## T-AF-07

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `components/QualificacaoFornecedorModal.tsx` — modal dark-first (textarea critérios, chips multi-select categorias), `httpsCallable` `qualificarFornecedor` com `logicalSignature` SHA-256 (payload ordenado + `operatorId` + `ts`), loading/erro, `onSuccess` + `onClose` após sucesso; render manual conforme gate da task.

---

## T-AF-08

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `components/AvaliacaoFornecedorModal.tsx` — radios resultado, 4 checkboxes critérios, textarea observações; bloco histórico com `useAvaliacoesFornecedor`; `httpsCallable` `registrarAvaliacaoFornecedor` + assinatura SHA-256 alinhada ao payload; estados loading/erro; `onSuccess` + `onClose` após sucesso.

---

## T-AF-09

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `lab-apoio/components/VigenciaAlertBanner.tsx` — contratos ativos; vigência ≤30d ou vencida; certificações ativas com `dataValidade` na mesma janela; lista em banner amber/red; `null` se vazio. `LabApoioView.tsx` — import + `{!loading && <VigenciaAlertBanner contratos={contratos} />}` entre KPI strip e tabs.

---

## T-AF-10

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `modules/apoio/alertVencimentos.ts` — `onSchedule` 07:00 `America/Sao_Paulo`, `southamerica-east1`; percorre `labs/*/lab-apoio` (`ativo` + `deletadoEm==null`); vigência `vigenciaFim` com `days<=30` (mesma lógica de janela que o banner); certificações ativas com `dataValidade` (Timestamp) na mesma janela; `upsertKpiAlert` em `labs/{labId}/kpi-alerts/{vig_apoio_|cert_apoio_}` com `tipo: 'vencimento_contrato_apoio'`, `severidade`/`mensagem`/`acionada_em`, preserva `criadoEm`/`lida` no primeiro write vs merge; `logger.info` final (sem `console.log`). `functions/src/index.ts` — export `apoio_alertVencimentos`.

---

## T-AF-11

- **Comando:** `Set-Location "c:\hc quality\functions"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** Novo `callables/fornecedores/generateFornecedoresReport.ts` — `onCall` `southamerica-east1`, Zod `{ labId }`, auth `assertActiveLabMemberOrSuperAdmin` (igual `registrarAvaliacaoFornecedor`); query fornecedores `ativo==true` (limit 500); por doc, última `avaliacoes-periodicas` (`orderBy('data','desc').limit(1)`); PDF via `pdfkit` (buffer), upload `labs/{labId}/reports/fornecedores-{ts}.pdf`, `getSignedUrl` read ~1h; retorno `{ url }`; `logger.info`. `callables/fornecedores/index.ts` + `functions/src/index.ts` — export `generateFornecedoresReport` (registro deployável; alinhado a T-AF-04/05).
- **Nota:** Spec da task menciona react-pdf/liberacao; implementação segue padrão `pdfkit` já usado em outras CF (ex.: certificados) para manter dependência única no Functions.

---

## T-AF-12

- **Comando:** `Set-Location "c:\hc quality"; npx tsc --noEmit`
- **Resultado:** exit 0
- **Diff resumido:** `FornecedoresView.tsx` — import `FirebaseError`, `functions`, `httpsCallable`; `callGenerateFornecedoresReport` para `generateFornecedoresReport`; estado `exportPdfLoading`; `handleExportRelatorioPdf` (callable `{ labId }`, `window.open` URL assinada, `toast` sucesso/erro, `setActionError` em falha); botão toolbar **Exportar relatório (PDF)** com spinner/aria-busy e `disabled` quando `isLoading || exportPdfLoading`.

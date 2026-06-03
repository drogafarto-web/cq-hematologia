# TASKS — Gestão de Riscos

**Versão:** 1.0 · **Data:** 2026-05-10
**Spec:** `_meta/specs/gestao-riscos.spec.md`
**Gate global:** `npx tsc --noEmit` sem erros novos após cada tarefa.
**IMPORTANTE:** Ler `src/features/risks/CLAUDE.md` antes de editar qualquer arquivo do módulo.

> Convenção de status: `[ ]` pendente · `[x]` concluída · `[~]` em progresso · `[!]` bloqueada

---

## T-GR-01 — Estender type `Risk` com campos de vínculo e aprovação

**Arquivos:** `src/features/risks/types/Risk.ts`
**Depende de:** —

**O que fazer:**

1. Adicionar os campos ao interface `Risk` (não remover ou renomear campo existente):
   - `ncIds: string[]` (default `[]`)
   - `capaIds: string[]` (default `[]`)
   - `planoMelhoriaId?: string`
   - `aprovadoPor?: string`
   - `aprovadoEm?: Timestamp`
2. Garantir que o shape não quebre imports existentes (tudo opcional ou com default).

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-GR-02 — Criar interface `RiskTemplate` + coleção

**Arquivos:** `src/features/risks/types/RiskTemplate.ts` (criar) · barrel `src/features/risks/types/index.ts`
**Depende de:** —

**O que fazer:**

1. Criar interface `RiskTemplate` conforme spec (id, labId, categoria, processo, titulo, descricao, causaPotencial, efeitoPotencial, pDefault, sDefault, dDefault, ativo, criadoEm).
2. Usar `RiskCategory` e `RiskProcess` enums já existentes no `Risk.ts`.
3. Exportar pelo barrel.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-GR-03 — Firestore rules: `risk-templates`

**Arquivos:** `firestore.rules`
**Depende de:** T-GR-02

**O que fazer:**
Adicionar bloco para `/labs/{labId}/risk-templates/{templateId}`:

- `read`: isActiveMemberOfLab(labId)
- `create`, `update`: isAdminOrOwner(labId)
- `delete`: **false** (soft-delete apenas — `ativo: false`)

**Gate:** Sem syntax error em rules.

**Status:** [x]

---

## T-GR-04 — Cloud Function callable: `vincularNcAoRisco`

**Arquivos:** `functions/src/modules/risks/vincularNcAoRisco.ts` · `validators.ts` · `functions/src/modules/risks/index.ts` · `functions/src/index.ts` · `src/features/risks/types/Risk.ts` (`RiskAuditEvent.tipo`)
**Depende de:** T-GR-01

**O que fazer:**

1. Callable com Zod: `{ riskId, ncId?, capaId? }` (pelo menos um obrigatório).
2. Validar que chamador é membro ativo do lab.
3. Usar `arrayUnion` para adicionar a `ncIds` ou `capaIds` (não substituir o array).
4. Gravar `RiskAuditEvent` com `tipo: 'vincular_nc'` ou `'vincular_capa'`.
5. Zero `console.log`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-GR-05 — Cloud Function callable: `aprovarRisco`

**Arquivos:** `functions/src/modules/risks/aprovarRisco.ts` (criar) · `validators.ts` · `functions/src/modules/risks/index.ts` · `functions/src/index.ts` · `src/features/risks/types/Risk.ts` (`RiskAuditEvent.tipo`)
**Depende de:** T-GR-01

**O que fazer:**

1. Callable com Zod: `{ labId, riskId, logicalSignature }` (paridade com demais callables do módulo).
2. Verificar que chamador tem role `admin` ou `owner`.
3. Verificar que o risco tem `nivel === 'critico'` e `status` em `aberto` ou `mitigando` (paridade com domínio `Risk.Status`; spec legado citava aceito/em_tratamento).
4. Fazer `update` com `aprovadoPor`, `aprovadoEm`, `logicalSignature`.
5. Gravar `RiskAuditEvent` com `tipo: 'aprovar_risco'`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-GR-06 — Cloud Function cron: `alertRiskReviews`

**Arquivos:** `functions/src/modules/risks/alertRiskReviews.ts` (criar) · registrar em `functions/src/index.ts`
**Depende de:** —

**O que fazer:**

1. CF agendada (pubsub scheduler, 1x/dia).
2. Iterar `/labs/{labId}/risks/` com status `aberto` ou `em_tratamento`.
3. Para riscos com `reviewSchedule.proximaRevisao` < now + 7 dias, criar/upsert `KPIAlert` em `/labs/{labId}/kpi-alerts/` com `tipo: 'revisao_risco_vencida'`.
4. Usar `logger.warn` para riscos com revisão já vencida.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-GR-07 — Hook React: `useRiskReviewAlerts`

**Arquivos:** `src/features/risks/hooks/useRiskReviewAlerts.ts` (criar)
**Depende de:** —

**O que fazer:**

1. Hook que lê riscos ativos do lab.
2. Filtra client-side: `reviewSchedule.proximaRevisao < Date.now()` (já vencidas) ou `< Date.now() + 7 dias` (prestes a vencer).
3. Retorna `{ vencidas: Risk[], prestes: Risk[], count: number }`.
4. Usar `useMemo` para o cálculo de filtro.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-GR-08 — Hook React: `useRiskTemplates`

**Arquivos:** `src/features/risks/hooks/useRiskTemplates.ts` (criar)
**Depende de:** T-GR-02, T-GR-03

**O que fazer:**

1. Hook com `onSnapshot` em `/labs/{labId}/risk-templates` filtrando `ativo === true`.
2. Retorna `{ templates: RiskTemplate[], loading, error }`.
3. Ordenar por `categoria` + `titulo`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-GR-09 — UI: `RiskHeatmap` (quadrante P×S)

**Arquivos:** `src/features/risks/components/RiskHeatmap.tsx` (criar)
**Depende de:** —

**O que fazer:**

1. Componente que recebe `risks: Risk[]` como prop.
2. Renderizar grid 5×5 (eixo X = Severidade, eixo Y = Probabilidade).
3. Cada célula mostra `count` de riscos naquela combinação P×S.
4. Coloração por zona: verde (NPR ≤ 10), amarelo (11–30), laranja (31–60), vermelho (>60).
5. Tooltip ao hover mostrando lista de riscos da célula.
6. Dark-first, sem biblioteca de chart — CSS grid puro.

**Gate:** `npx tsc --noEmit` limpo. Não importar nenhuma lib externa nova.

**Status:** [x]

---

## T-GR-10 — UI: Dashboard de distribuição de riscos

**Arquivos:** `src/features/risks/components/RiskDashboard.tsx` (criar ou integrar em view existente)
**Depende de:** T-GR-07, T-GR-09

**O que fazer:**

1. Seção com:
   - `RiskHeatmap` (tarefa anterior)
   - Barras simples (SVG ou CSS) de distribuição por `nivel` (baixo/médio/alto/crítico)
   - Barras de distribuição por `categoria`
   - Badge de alertas de revisão vencida (usando `useRiskReviewAlerts`)
2. Integrar na view principal do módulo riscos.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-GR-11 — Cloud Function callable: `generateRiskMatrixPDF`

**Arquivos:** `functions/src/callables/risks/generateRiskMatrixPDF.ts` (criar) · registrar em `functions/src/index.ts`
**Depende de:** T-GR-01

**O que fazer:**

1. Callable que lê todos os riscos ativos do lab.
2. Ordena por NPR desc.
3. Gera PDF com: cabeçalho do lab, data, tabela de riscos (título, categoria, P, S, D, NPR, nível, status, responsável), heat map textual (ou ASCII art se PDF simples).
4. Upload para Storage, retorna URL temporária assinada (2h).
5. Reutilizar utilitários de PDF já existentes no projeto (`liberacao/_pdf/template.ts` ou padrão similar).

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-GR-12 — Botão export PDF + picker de template na UI

**Arquivos:** `src/features/risks/components/RisksView.tsx` · `src/features/risks/components/CreateRiskModal.tsx`
**Depende de:** T-GR-08, T-GR-11

**O que fazer:**

1. Adicionar botão "Exportar Mapa de Riscos (PDF)" que chama `generateRiskMatrixPDF`.
2. No modal de criação de risco, adicionar dropdown "Usar template" (lê `useRiskTemplates`).
   - Ao selecionar template, pré-preenche campos: categoria, processo, descricao, P, S, D.
   - Campos permanecem editáveis após pré-preenchimento.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

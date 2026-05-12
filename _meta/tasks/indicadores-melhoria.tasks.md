# TASKS — Indicadores & Melhoria

**Versão:** 1.0 · **Data:** 2026-05-10
**Spec:** `_meta/specs/indicadores-melhoria.spec.md`
**Gate global:** `npx tsc --noEmit` sem erros novos após cada tarefa.

> Convenção de status: `[ ]` pendente · `[x]` concluída · `[~]` em progresso · `[!]` bloqueada

---

## T-IM-01 — Criar interface `KPIMeta`

**Arquivos:** `src/features/kpis/types/KPIMeta.ts` (criar) · barrel `src/features/kpis/types/index.ts`
**Depende de:** —

**O que fazer:**
1. Criar interface `KPIMeta` conforme spec (id, labId, tipoKPI, valor, unidade, vigenciaInicio, vigenciaFim?, definidoPor, definidoPorNome, criadoEm, ativo).
2. Exportar pelo barrel.
3. Não alterar `KPI.ts` existente nesta tarefa.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-02 — Criar interfaces `PlanoMelhoria` + `AcaoMelhoria`

**Arquivos:** `src/features/kpis/types/PlanoMelhoria.ts` (criar) · barrel
**Depende de:** —

**O que fazer:**
1. Criar `PlanoMelhoriaStatus` type.
2. Criar interface `PlanoMelhoria` conforme spec.
3. Criar interface `AcaoMelhoria` conforme spec.
4. Exportar pelo barrel.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-03 — Estender `KPIDaily` com campo `meta?`

**Arquivos:** `src/features/kpis/types/KPI.ts`
**Depende de:** T-IM-01

**O que fazer:**
1. Ler o arquivo antes de editar.
2. Adicionar `meta?: number` ao interface `KPIDaily` (opcional, retrocompatível).
3. Não alterar nenhum outro campo.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-04 — Firestore rules: `kpi-metas` + `planos-melhoria`

**Arquivos:** `firestore.rules`
**Depende de:** T-IM-01, T-IM-02

**O que fazer:**
Adicionar blocos para:

`/labs/{labId}/kpi-metas/{metaId}`:
- `read`: isActiveMemberOfLab(labId)
- `create`, `update`: isAdminOrOwner(labId)
- `delete`: **false** (soft-delete via `ativo: false`)

`/labs/{labId}/planos-melhoria/{planoId}`:
- `read`: isActiveMemberOfLab(labId)
- `create`: isActiveMemberOfLab(labId)
- `update`: isActiveMemberOfLab(labId)
- `delete`: **false**

`/labs/{labId}/planos-melhoria/{planoId}/acoes/{acaoId}`:
- `read`: isActiveMemberOfLab(labId)
- `create`: isActiveMemberOfLab(labId)
- `update`: isActiveMemberOfLab(labId)
- `delete`: **false**

**Gate:** Sem syntax error em rules.

**Status:** [x]

---

## T-IM-05 — Cloud Function callable: `definirMetaKPI`

**Arquivos:** `functions/src/callables/kpis/definirMetaKPI.ts` (criar) · `functions/src/callables/kpis/index.ts` (criar) · `functions/src/index.ts`
**Depende de:** T-IM-01, T-IM-04

**O que fazer:**
1. Callable com Zod: `{ tipoKPI, valor, unidade, vigenciaInicio, vigenciaFim? }`.
2. Verificar role `admin` ou `owner`.
3. Antes de criar novo doc: buscar meta ativa para o mesmo `tipoKPI` e setá-la como `ativo: false` + `vigenciaFim: now` (transação).
4. Criar novo doc de `KPIMeta` com `ativo: true`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-IM-06 — Cloud Function callable: `criarPlanoMelhoria`

**Arquivos:** `functions/src/callables/kpis/criarPlanoMelhoria.ts` (criar) · registrar em `functions/src/index.ts`
**Depende de:** T-IM-02, T-IM-04

**O que fazer:**
1. Callable com Zod: `{ labId, titulo, descricao, responsavelId, prazoMeta, kpiOrigemId? }`.
2. Verificar chamador é membro ativo.
3. Criar `PlanoMelhoria` com `status: 'rascunho'`.
4. Retornar `{ planoId }`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-IM-07 — Cloud Function callable: `atualizarAcaoMelhoria`

**Arquivos:** `functions/src/callables/kpis/atualizarAcaoMelhoria.ts` (criar) · registrar
**Depende de:** T-IM-02, T-IM-04

**O que fazer:**
1. Callable com Zod: `{ labId, planoId, acaoId, status, evidencia? }`.
2. Verificar chamador é membro ativo do lab.
3. Verificar que `prazo` existe no documento da ação (integridade).
4. `update` de status e `evidencia` se fornecida.
5. Atualizar `updatedAt`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-IM-08 — Cloud Function callable: `fecharPlanoMelhoria`

**Arquivos:** `functions/src/callables/kpis/fecharPlanoMelhoria.ts` (criar) · registrar
**Depende de:** T-IM-02, T-IM-04

**O que fazer:**
1. Callable com Zod: `{ labId, planoId, logicalSignature }`.
2. Verificar role `admin` ou `owner`.
3. Verificar status atual é `ativo`.
4. `update` para `status: 'concluido'`, `conclusaoEm: now`, gravar `logicalSignature`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-IM-09 — Hook React: `useKpiMetas`

**Arquivos:** `src/features/kpis/hooks/useKpiMetas.ts` (criar)
**Depende de:** T-IM-01, T-IM-04

**O que fazer:**
1. `onSnapshot` em `/labs/{labId}/kpi-metas` filtrando `ativo === true`.
2. Retorna `{ metas: KPIMeta[], getMetaByTipo: (tipo: string) => KPIMeta | undefined, loading, error }`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-10 — Hooks React: `usePlanosMelhoria` + `usePlanoMelhoria`

**Arquivos:** `src/features/kpis/hooks/usePlanosMelhoria.ts` (criar) · `usePlanoMelhoria.ts` (criar)
**Depende de:** T-IM-02, T-IM-04

**O que fazer:**

`usePlanosMelhoria`:
1. `onSnapshot` com filtros opcionais: `status?: PlanoMelhoriaStatus`, `responsavelId?`.
2. Retorna `{ planos: PlanoMelhoria[], loading, error }`.

`usePlanoMelhoria`:
1. `onSnapshot` no plano + `onSnapshot` na subcoleção `acoes`.
2. Retorna `{ plano: PlanoMelhoria | null, acoes: AcaoMelhoria[], loading, error }`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-11 — Componente: `PlanoMelhoriaCard` + listagem

**Arquivos:** `src/features/kpis/components/PlanoMelhoriaCard.tsx` (criar) · `PlanoMelhoriaListView.tsx` (criar)
**Depende de:** T-IM-02, T-IM-10

**O que fazer:**

`PlanoMelhoriaCard`:
1. Card com: título, status badge, responsável, prazo, número de ações pendentes.
2. Badge de cor por status (rascunho=cinza, ativo=azul, concluido=verde, cancelado=vermelho).

`PlanoMelhoriaListView`:
1. Listagem com filtro de status.
2. Botão "Novo Plano" abre modal de criação (chama `criarPlanoMelhoria`).
3. Ao clicar no card, navega para detalhe.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-12 — Componente: `PlanoMelhoriaDetail` + `AcaoMelhoriaForm`

**Arquivos:** `src/features/kpis/components/PlanoMelhoriaDetail.tsx` (criar) · `AcaoMelhoriaForm.tsx` (criar)
**Depende de:** T-IM-10, T-IM-11

**O que fazer:**

`AcaoMelhoriaForm`:
1. Formulário inline: descricao, responsavelId, prazo (obrigatório), evidencia?.
2. Submit persiste com `addDoc` na subcoleção `acoes` (rules + Zod no client).

`PlanoMelhoriaDetail`:
1. Cabeçalho com dados do plano.
2. Lista de `AcaoMelhoria` com status (select → `atualizarAcaoMelhoria`), evidência opcional.
3. Botão "Adicionar ação" abre `AcaoMelhoriaForm`.
4. Botão "Fechar plano" visível para `admin`/`owner`/superadmin em plano `ativo`, chama `fecharPlanoMelhoria` com assinatura lógica.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-13 — Linha de meta no dashboard de KPIs

**Arquivos:** componente de gráfico existente em `src/features/kpis/` (identificar path exato antes)
**Depende de:** T-IM-09

**O que fazer:**
1. Identificar o componente de gráfico que exibe o valor diário de KPI.
2. Receber `meta?: number` como prop (ou ler de `useKpiMetas`).
3. Se `meta` existir, renderizar linha horizontal de referência no mesmo gráfico (CSS ou SVG).
4. Tooltip na linha exibindo valor da meta.
5. Não alterar lógica de cálculo existente.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-IM-14 — Cloud Function callable: `generateKPIReport`

**Arquivos:** `functions/src/callables/kpis/generateKPIReport.ts` (criar) · registrar
**Depende de:** T-IM-01, T-IM-02

**O que fazer:**
1. Callable com Zod: `{ mesInicio, mesFim }` (Timestamps).
2. Ler `KPIDaily` do período + `KPIMeta` ativos.
3. Ler `PlanoMelhoria` com status `ativo` ou `rascunho`.
4. Gerar PDF com: cabeçalho do lab, período, tabela de KPIs (real vs meta), lista de planos em aberto.
5. Upload para Storage, retornar URL temporária assinada (2h).
6. Reutilizar utilitários de PDF existentes no projeto.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

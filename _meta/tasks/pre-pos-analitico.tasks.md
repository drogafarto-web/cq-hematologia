# TASKS — Pré & Pós-Analítico

**Versão:** 1.0 · **Data:** 2026-05-10
**Spec:** `_meta/specs/pre-pos-analitico.spec.md`
**Gate global:** `npx tsc --noEmit` sem erros novos após cada tarefa.

> Convenção de status: `[ ]` pendente · `[x]` concluída · `[~]` em progresso · `[!]` bloqueada

---

## T-PA-01 — Criar tipos base: `Amostra`, `AmostraEvento`, enums

**Arquivos:** `src/features/pre-pos-analitico/types/Amostra.ts` (criar diretório + arquivo) · barrel `index.ts`
**Depende de:** —

**O que fazer:**

1. Criar diretório `src/features/pre-pos-analitico/types/`.
2. Criar `Amostra.ts` com:
   - `AmostraStatus` type (6 valores: coletada/recebida/em_processamento/concluida/rejeitada/descartada)
   - `MotivoRejeicao` type (5 valores conforme spec)
   - Interface `Amostra` com todos os campos do spec
   - Interface `AmostraEvento` com todos os campos do spec (incluindo `chainHash`, `prevHash`)
3. Criar `src/features/pre-pos-analitico/types/index.ts` exportando tudo.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

---

## T-PA-02 — Firestore rules: coleção `amostras` + subcoleção `events`

**Arquivos:** `firestore.rules`
**Depende de:** T-PA-01

**O que fazer:**
Adicionar blocos para:

`/labs/{labId}/amostras/{amostraId}`:

- `read`: isActiveMemberOfLab(labId)
- `create`: **false** (somente callable pode criar)
- `update`: **false** (somente callable)
- `delete`: **false**

`/labs/{labId}/amostras/{amostraId}/events/{eventId}`:

- `read`: isActiveMemberOfLab(labId)
- `create`: isActiveMemberOfLab(labId) (callable usa admin SDK — mas deixar read para hook)
- `update`: **false**
- `delete`: **false**

**Gate:** Sem syntax error em rules.

**Status:** [ ]

---

## T-PA-03 — Cloud Function callable: `registrarAmostra`

**Arquivos:** `functions/src/callables/amostras/registrarAmostra.ts` (criar) · `functions/src/callables/amostras/index.ts` · registrar em `functions/src/index.ts`
**Depende de:** T-PA-02

**O que fazer:**

1. Callable com Zod: `{ material, volume?, dataColeta, exameConfigId?, insumoLoteId?, pacienteId?, observacoes? }`.
2. Validar chamador é membro ativo.
3. Criar doc em `/labs/{labId}/amostras/{uuid}` com `status: 'coletada'`, `coletadoPor: uid`, `coletadoPorNome` (buscar do doc do usuário).
4. Criar primeiro `AmostraEvento` com `tipo: 'coleta'` na subcoleção `events`.
5. CF trigger de chain-hash (se já existir padrão) é disparada automaticamente.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [ ]

---

## T-PA-04 — Cloud Function callable: `registrarRecebimentoAmostra`

**Arquivos:** `functions/src/callables/amostras/registrarRecebimentoAmostra.ts` (criar)
**Depende de:** T-PA-03

**O que fazer:**

1. Callable com Zod: `{ amostraId, logicalSignature }`.
2. Verificar status atual é `coletada` (rejeitar se não for).
3. `update` para `status: 'recebida'`, `dataRecebimento: now`.
4. Gravar `AmostraEvento` com `tipo: 'recebimento'` + `logicalSignature`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [ ]

---

## T-PA-05 — Cloud Function callable: `rejeitarAmostra`

**Arquivos:** `functions/src/callables/amostras/rejeitarAmostra.ts` (criar)
**Depende de:** T-PA-04

**O que fazer:**

1. Callable com Zod: `{ amostraId, motivoRejeicao: MotivoRejeicao, observacoes?, logicalSignature }`.
2. `motivoRejeicao` é **obrigatório** — rejeitar se ausente.
3. Verificar status ≠ `concluida`, `descartada` (não se pode rejeitar amostra já descartada).
4. `update` para `status: 'rejeitada'`, gravar `motivoRejeicao`.
5. Gravar `AmostraEvento` tipo `'rejeicao'` + `logicalSignature`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [ ]

---

## T-PA-06 — Cloud Function callable: `descartarAmostra`

**Arquivos:** `functions/src/callables/amostras/descartarAmostra.ts` (criar)
**Depende de:** T-PA-04

**O que fazer:**

1. Callable com Zod: `{ amostraId, observacoes? }`.
2. Verificar status ≠ `descartada`.
3. `update` para `status: 'descartada'`.
4. Gravar `AmostraEvento` tipo `'descarte'`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [ ]

---

## T-PA-07 — Estender `ExameConfig` com novos campos

**Arquivos:** `src/features/liberacao/types/exameConfig.ts`
**Depende de:** —

**O que fazer:**

1. Ler o arquivo antes de editar.
2. Adicionar campos opcionais (não quebrar retrocompatibilidade):
   - `nivelCritico?: { min?: number; max?: number; unidade?: string }`
   - `prazoEntregaHoras?: number`
   - `metodologia?: string`
   - `unidade?: string`
3. Não alterar campos existentes.

**Gate:** `npx tsc --noEmit` limpo. Verificar que `liberacao` module compila sem erros.

**Status:** [ ]

---

## T-PA-08 — Estender `ExameLaudo` com rastreabilidade de amostra

**Arquivos:** `src/features/liberacao/types/laudo.ts`
**Depende de:** T-PA-01, T-PA-07

**O que fazer:**

1. Ler o arquivo antes de editar.
2. Adicionar campos opcionais a `ExameLaudo`:
   - `amostraId?: string`
   - `dataColeta?: Timestamp`
   - `materialColeta?: string`
   - `tempoTransporte?: number` (em minutos)
3. Nenhum campo existente deve ser removido ou tornado obrigatório.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

---

## T-PA-09 — Hooks React: `useAmostras` + `useAmostra`

**Arquivos:** `src/features/pre-pos-analitico/hooks/useAmostras.ts` (criar) · `useAmostra.ts` (criar) · barrel `hooks/index.ts`
**Depende de:** T-PA-01, T-PA-02

**O que fazer:**

`useAmostras`:

1. `onSnapshot` em `/labs/{labId}/amostras` com filtros opcionais: `status?: AmostraStatus`, `dataInicio?`, `dataFim?`.
2. Retorna `{ amostras: Amostra[], loading, error }`.
3. Ordena por `criadoEm desc`.

`useAmostra`:

1. `onSnapshot` em documento único + subcoleção `events` (query separada).
2. Retorna `{ amostra: Amostra | null, eventos: AmostraEvento[], loading, error }`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

---

## T-PA-10 — Componente: `AmostraStatusBadge`

**Arquivos:** `src/features/pre-pos-analitico/components/AmostraStatusBadge.tsx` (criar)
**Depende de:** T-PA-01

**O que fazer:**

1. Componente simples: recebe `status: AmostraStatus` e renderiza badge colorido.
2. Mapeamento de cores:
   - `coletada` → cinza
   - `recebida` → azul
   - `em_processamento` → amarelo
   - `concluida` → verde
   - `rejeitada` → vermelho
   - `descartada` → laranja
3. Dark-first, sem lib de ícone externa.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

---

## T-PA-11 — Componente: `AmostraTimeline`

**Arquivos:** `src/features/pre-pos-analitico/components/AmostraTimeline.tsx` (criar)
**Depende de:** T-PA-01, T-PA-09

**O que fazer:**

1. Recebe `eventos: AmostraEvento[]` como prop.
2. Ordena por `ts` asc.
3. Renderiza linha do tempo vertical com:
   - Ícone/cor por tipo de evento
   - Operador + timestamp
   - Observações se presentes
4. Dark-first.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

---

## T-PA-12 — View de listagem de amostras

**Arquivos:** `src/features/pre-pos-analitico/components/AmostraListView.tsx` (criar) · integrar no hub/router
**Depende de:** T-PA-09, T-PA-10

**O que fazer:**

1. Tabela com colunas: ID, material, status (badge), data coleta, exame, ações.
2. Filtros: por status e por intervalo de data.
3. Ao clicar em linha, abrir detalhe com `AmostraTimeline`.
4. Botão "Nova Amostra" abre modal de registro.
5. Integrar no router do app (`useAppStore.currentView`).

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [ ]

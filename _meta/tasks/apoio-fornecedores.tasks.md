# TASKS — Apoio & Fornecedores

**Versão:** 1.0 · **Data:** 2026-05-10
**Spec:** `_meta/specs/apoio-fornecedores.spec.md`
**Gate global:** `npx tsc --noEmit` sem erros novos após cada tarefa.

> Convenção de status: `[ ]` pendente · `[x]` concluída · `[~]` em progresso · `[!]` bloqueada

---

## T-AF-01 — Estender type `Fornecedor` com novos campos

**Arquivos:** `src/features/fornecedores/types/Fornecedor.ts`
**Depende de:** —

**O que fazer:**

1. Adicionar interface `QualificacaoFornecedor` (campos: `qualificadoEm`, `qualificadoPor`, `qualificadoPorNome`, `criteriosDocumentados`, `categorias: string[]`, `logicalSignature`).
2. Adicionar interface `EnderecoEstruturado` (logradouro, numero, complemento?, bairro, cidade, estado, cep) — reutilizar `Endereco` de `LabApoio.ts` como referência de shape.
3. Adicionar ao type `Fornecedor`:
   - `enderecoEstruturado?: EnderecoEstruturado`
   - `qualificacao?: QualificacaoFornecedor`
   - `categorias: string[]` (default `[]` nas telas existentes)

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-AF-02 — Criar interface `AvaliacaoFornecedor`

**Arquivos:** `src/features/fornecedores/types/AvaliacaoFornecedor.ts` (criar)
**Depende de:** T-AF-01

**O que fazer:**

1. Criar arquivo com interface `AvaliacaoFornecedor`:
   - `id`, `labId`, `fornecedorId`, `data: Timestamp`, `resultado: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado'`
   - `responsavel`, `responsavelNome`
   - `criteriosAvaliados: { prazoEntrega: boolean; qualidadeProduto: boolean; documentacaoCorreta: boolean; atendimento: boolean; }`
   - `observacoes?: string`
   - `logicalSignature: LogicalSignature`
   - `criadoEm: Timestamp`
2. Exportar do barrel `src/features/fornecedores/types/index.ts`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-AF-03 — Firestore rules: subcoleção `avaliacoes-periodicas`

**Arquivos:** `firestore.rules`
**Depende de:** T-AF-02

**O que fazer:**
Adicionar bloco de regras para `/labs/{labId}/fornecedores/{fornecedorId}/avaliacoes-periodicas/{avaliacaoId}`:

- `read`: isActiveMemberOfLab(labId)
- `create`: isActiveMemberOfLab(labId) + validação de campos obrigatórios + `logicalSignature.hash.size() == 64`
- `update`: **false** (append-only)
- `delete`: **false**

Adicionar também subcoleção `events` (chain-hash):

- `create`: isActiveMemberOfLab(labId)
- `update`: **false**
- `delete`: **false**

**Gate:** `npx tsc --noEmit` limpo + regras sem syntax error (checar com `firebase emulators:start --only firestore` localmente se disponível).

**Status:** [x]

---

## T-AF-04 — Cloud Function callable: `qualificarFornecedor`

**Arquivos:** `functions/src/callables/fornecedores/qualificarFornecedor.ts` (criar) · `functions/src/callables/fornecedores/index.ts` (criar/atualizar) · `functions/src/index.ts` (registrar)
**Depende de:** T-AF-01, T-AF-03

**O que fazer:**

1. Criar callable `qualificarFornecedor` com Zod schema:
   - Input: `{ fornecedorId, criteriosDocumentados, categorias, logicalSignature }`
   - Validar que o chamador é membro ativo do lab e tem role `admin` ou `owner`.
   - Verificar que `fornecedor` não possui `qualificacao` ainda (ou substituir se RT autorizado).
   - Fazer `update` no doc do fornecedor com campo `qualificacao`.
   - Gravar `AuditEvent` em `events` subcoleção (chain-hash).
2. Registrar a callable em `functions/src/index.ts`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-AF-05 — Cloud Function callable: `registrarAvaliacaoFornecedor`

**Arquivos:** `functions/src/callables/fornecedores/registrarAvaliacaoFornecedor.ts` (criar)
**Depende de:** T-AF-02, T-AF-03

**O que fazer:**

1. Criar callable `registrarAvaliacaoFornecedor` com Zod schema:
   - Input: `{ fornecedorId, resultado, criteriosAvaliados, observacoes?, logicalSignature }`
   - Validar role de chamador (membro ativo do lab).
   - Criar documento em `/labs/{labId}/fornecedores/{fornecedorId}/avaliacoes-periodicas/{uuid}`.
   - Gravar `AuditEvent` em `events` (chain-hash).
2. Registrar em `functions/src/index.ts`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-AF-06 — Hook React: `useAvaliacoesFornecedor`

**Arquivos:** `src/features/fornecedores/hooks/useAvaliacoesFornecedor.ts` (criar)
**Depende de:** T-AF-02

**O que fazer:**

1. Criar hook com `onSnapshot` em `/labs/{labId}/fornecedores/{fornecedorId}/avaliacoes-periodicas`.
2. Ordenar por `data desc`.
3. Retornar `{ avaliacoes: AvaliacaoFornecedor[], loading, error }`.
4. Exportar do barrel `src/features/fornecedores/hooks/index.ts`.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-AF-07 — UI: `QualificacaoFornecedorModal`

**Arquivos:** `src/features/fornecedores/components/QualificacaoFornecedorModal.tsx` (criar)
**Depende de:** T-AF-01, T-AF-04, T-AF-06

**O que fazer:**

1. Modal com campos: `criteriosDocumentados` (textarea), `categorias` (multi-select: reagentes/consumiveis/servicos/outros).
2. Ao submeter, chamar callable `qualificarFornecedor` via `httpsCallable`.
3. Exibir estado de loading e erro.
4. Fechar e invalidar/refetch ao sucesso.
5. Design dark-first, padrão Linear/Stripe, sem lib de ícones.

**Gate:** `npx tsc --noEmit` limpo. Render manual validado.

**Status:** [x]

---

## T-AF-08 — UI: `AvaliacaoFornecedorModal`

**Arquivos:** `src/features/fornecedores/components/AvaliacaoFornecedorModal.tsx` (criar)
**Depende de:** T-AF-02, T-AF-05, T-AF-06

**O que fazer:**

1. Modal com campos:
   - `resultado`: radio (aprovado / aprovado_com_ressalva / reprovado)
   - `criteriosAvaliados`: 4 checkboxes (prazoEntrega, qualidadeProduto, documentacaoCorreta, atendimento)
   - `observacoes`: textarea opcional
2. Exibir histórico de avaliações anteriores abaixo do form (usar `useAvaliacoesFornecedor`).
3. Ao submeter, chamar `registrarAvaliacaoFornecedor` via callable.
4. Design dark-first padrão.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-AF-09 — UI: `VigenciaAlertBanner` (lab-apoio)

**Arquivos:** `src/features/lab-apoio/components/VigenciaAlertBanner.tsx` (criar) · integrar em `LabApoioView.tsx` ou equivalente
**Depende de:** —

**O que fazer:**

1. Componente que lê `Contrato.vigenciaFim` e `Certificacao.dataValidade` dos contratos ativos.
2. Filtrar contratos/certificações vencendo em ≤ 30 dias ou já vencidos.
3. Exibir banner com lista: "Contrato XYZ vence em 5 dias" / "Certificado ISO 15189 já venceu".
4. Mostrar apenas se houver pendências; ocultar se tudo ok.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

---

## T-AF-10 — Cloud Function cron: `alertVencimentosApoio`

**Arquivos:** `functions/src/modules/apoio/alertVencimentos.ts` (criar) · registrar em `functions/src/index.ts`
**Depende de:** T-AF-03 (estrutura de dados estável)

**O que fazer:**

1. CF agendada (pubsub scheduler, 1x/dia às 07:00).
2. Iterar `/labs/{labId}/lab-apoio/` buscando contratos com `vigenciaFim` < now + 30 dias.
3. Para cada achado, criar/upsert `KPIAlert` em `/labs/{labId}/kpi-alerts/` com `tipo: 'vencimento_contrato_apoio'`.
4. Iterar certificações: mesma lógica com `dataValidade`.
5. Zero `console.log` — usar `logger.info/warn` do firebase-functions.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-AF-11 — Cloud Function callable: `generateFornecedoresReport`

**Arquivos:** `functions/src/callables/fornecedores/generateFornecedoresReport.ts` (criar)
**Depende de:** T-AF-05

**O que fazer:**

1. Callable que lê todos os fornecedores ativos do lab.
2. Para cada fornecedor, busca última avaliação periódica.
3. Gera PDF (reutilizar padrão `react-pdf` ou template existente em `liberacao/_pdf/`).
4. Upload para Storage, retorna URL temporária assinada (1h).
5. Retorno: `{ url: string }`.

**Gate:** `npx tsc --noEmit` em `functions/` limpo.

**Status:** [x]

---

## T-AF-12 — Botão de export no módulo Fornecedores

**Arquivos:** componente de listagem de fornecedores (identificar path exato antes de editar)
**Depende de:** T-AF-11

**O que fazer:**

1. Adicionar botão "Exportar relatório (PDF)" na tela de listagem de fornecedores.
2. Ao clicar, chamar `generateFornecedoresReport` via callable.
3. Abrir URL retornada em nova aba.
4. Exibir loading enquanto CF processa.

**Gate:** `npx tsc --noEmit` limpo.

**Status:** [x]

# Backlog — violações de spine RDC 978

Tracker vivo das violações identificadas no [audit 2026-04-25](../audits/2026-04-25-spine-compatibility.md). Atualizar status conforme ADRs fecham gaps.

**Modelo de referência:** [ADR 0001](../adr/0001-arquitetura-spines-rdc-978.md) e [compliance-spines.md (skill)](../../../Users/labcl/.claude/skills/hc-quality/reference/compliance-spines.md).

---

## Status legenda

- ⬜ **Open** — não iniciado
- 🟦 **In progress** — ADR rascunhado ou implementação em curso
- 🟩 **Resolved** — fechado por ADR + commit em prod, com data
- ⚫ **Wontfix** — decidido não fazer (com motivo)
- 🔁 **Reopened** — voltou a ser violação após mudança

---

## Violações ativas

| #         | Sev | Status | Spine       | Descrição                                                                                                                               | Localização                                                                                                                                       | ADR alvo                 | Notas                                                                   |
| --------- | --- | ------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| **V-001** | 🔴  | ⬜     | NC          | Spine NC fragmentada — CT tem `NaoConformidadeTemp` próprio; outros módulos não têm nada                                                | `src/features/controle-temperatura/types/ControlTemperatura.ts:161-177`                                                                           | **0003**                 | Bloqueia rastreabilidade unificada exigida pela RDC                     |
| **V-002** | 🔴  | ⬜     | Pessoa      | User/Member sem `qualificacoes[]`, `cpfHash`, `cargo` estruturado, RT único; `treinamentos` em Educação Continuada não vincula a Member | `src/features/auth/services/authService.ts:17-35`, `src/types/index.ts:293-301`, `src/features/educacao-continuada/services/ecFirebaseService.ts` | **0006** _(novo)_        | LGPD + RDC art. de qualificação profissional                            |
| **V-003** | 🔴  | ⬜     | Lote        | `notaFiscalId` e `fornecedorId` opcionais em `Insumo`; faltam `nfItemIndex` e cutover obrigatório                                       | `src/features/insumos/types/Insumo.ts:103`                                                                                                        | **0002**                 | Backfill de docs legados é o ponto sensível                             |
| **V-004** | 🟠  | ⬜     | POP         | POP/documento vigente não existe; nenhuma run CIQ grava `popId`/`popVersaoId`/`popHash`                                                 | global (todos os módulos CIQ)                                                                                                                     | **0004**                 | Schema simples, integração ampla                                        |
| **V-005** | 🟠  | ⬜     | Pessoa      | User sem `cpfHash`/`conselhoProfissional`/`cargo` estruturado                                                                           | `src/features/auth/services/authService.ts:17`, `src/types/index.ts:293`                                                                          | **0006**                 | Subset de V-002; pode ser mesma migração                                |
| **V-006** | 🟠  | ⬜     | NF          | NotaFiscal sem `itens[]` estruturado, `conferenciaOk`, `desviosObservados`, `ncId`                                                      | `src/features/fornecedores/types/NotaFiscal.ts:14-52`                                                                                             | **0002**                 | Pré-requisito para tornar V-003 obrigatório                             |
| **V-007** | 🟠  | ⬜     | Fornecedor  | Fornecedor sem `status` de qualificação, `evidencias[]`, `categoriasFornecidas[]`, `proximaRequalificacao`                              | `src/features/fornecedores/types/Fornecedor.ts:19-57`                                                                                             | **0002**                 | Pré-requisito para validar Fornecedor qualificado em recebimento de NF  |
| **V-008** | 🟡  | ⬜     | Equipamento | Faltam `qualificacaoInicial`, `proximaCalibracao`, `proximaManutencaoPreventiva` estruturados; `equipamentos-audit` sem chain-hash      | `src/features/equipamentos/types/Equipamento.ts:63-147`                                                                                           | **0007** _(novo)_        | Calibração hoje vive em CT — refatorar pra módulo Equipamento           |
| **V-009** | 🟡  | ⬜     | Audit       | HMAC + chainHash duplicado entre `insumos/chainHash.ts` e `ciqAudit/writer.ts`                                                          | `functions/src/modules/insumos/chainHash.ts`, `functions/src/modules/ciqAudit/writer.ts`                                                          | **0005**                 | Pré-requisito técnico para 0002, 0003, 0004 sem mais duplicação         |
| **V-010** | 🟡  | ⬜     | Equipamento | CIQ-Imuno referencia equipamento por string `equipamento`, não FK `equipamentoId`                                                       | `src/features/ciq-imuno/types/CIQImuno.ts:105`                                                                                                    | **0007**                 | Junto com V-008; analisador deveria ser FK, manual fica string opcional |
| **V-011** | 🟡  | ⬜     | POP         | Coagulação não grava `popId` em runs                                                                                                    | `src/features/coagulacao/types/Coagulacao.ts:32+`                                                                                                 | **0004**                 | Aplica a todos os módulos CIQ; consolidar na ADR 0004                   |
| **V-012** | 🟡  | ⬜     | NF          | NotaFiscal sem `NFItem[]` estruturado                                                                                                   | `src/features/fornecedores/types/NotaFiscal.ts:14-52`                                                                                             | **0002**                 | Subset de V-006                                                         |
| **V-013** | ⚪  | ⬜     | Naming      | Inconsistência `operatorId` vs `createdBy`; `equipamentoId` vs `equipamento` (string) entre módulos                                     | múltiplos                                                                                                                                         | **— (cleanup contínuo)** | Atacar dentro das ADRs 0002/0003/0004 conforme tocar cada arquivo       |

---

## Mapa ADR → violações fechadas

| ADR                                                                                  | Status      | Violações que fecha                         |
| ------------------------------------------------------------------------------------ | ----------- | ------------------------------------------- |
| **0001** Arquitetura de spines                                                       | Accepted    | (decisão fundacional, não fecha violação)   |
| **0002** Lote↔NF obrigatório + backfill                                              | ⬜ Pendente | V-003, V-006, V-007, V-012 (parte de V-013) |
| **0003** Spine NC global                                                             | ⬜ Pendente | V-001                                       |
| **0004** POP / documento vigente                                                     | ⬜ Pendente | V-004, V-011                                |
| **0005** Helper `cryptoAudit` compartilhado                                          | ⬜ Pendente | V-009                                       |
| **0006** _(proposto)_ Pessoa completa (qualificacoes + LGPD)                         | ⬜ Pendente | V-002, V-005                                |
| **0007** _(proposto)_ Equipamento completo (qualificação + calibração + audit chain) | ⬜ Pendente | V-008, V-010                                |

---

## Ordem operacional sugerida

1. **0005** (helper técnico) — abre caminho, baixíssimo risco
2. **0002** (Lote↔NF) — fecha rastreabilidade fiscal antes de Compras Fase E ir adiante
3. **0003** (NC global) — refator do `NaoConformidadeTemp` exige sprint dedicado
4. **0006** (Pessoa) — LGPD + qualificações; bloqueia validação de habilitação por módulo
5. **0004** (POP) — toca todos os módulos CIQ; melhor depois de Pessoa
6. **0007** (Equipamento) — calibração hoje é parte do CT; pode ser o último

Não é cronograma — é grafo de dependências. CTO reordena conforme prioridade de produto.

---

## Como atualizar este backlog

Ao fechar uma violação:

1. Mudar status para 🟩 + adicionar coluna "Resolvido em" com data e ADR/commit.
2. Não deletar a linha — backlog é histórico.
3. Se o ADR alterar o escopo da violação, registrar na coluna **Notas**.
4. Re-rodar audit completo a cada 3 meses ou após release maior; novas violações entram aqui com prefixo do mês (ex: `V-2026-07-001`).

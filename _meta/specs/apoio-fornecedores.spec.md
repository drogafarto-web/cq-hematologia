# SPEC — Apoio & Fornecedores

**Versão:** 1.0 · **Data:** 2026-05-10
**Refs:** DICQ 4.14.8 · RDC 978/2025 Arts. 36–39 · RDC 786/2023 Art. 42
**Guia base:** `_meta/guides/apoio-fornecedores.md`
**Prioridade:** 1 (menor risco — extensão de módulos estáveis)

---

## Objetivo

Fechar os gaps de compliance da DICQ 4.14.8 sobre fornecedores e laboratórios de apoio:
qualificação inicial documentada de fornecedores, avaliação periódica anual, alertas automáticos
de vencimento de contratos e certificações, e relatório PDF auditável.

O escopo **não** inclui reimplementar nada — ambos os módulos (`fornecedores`, `lab-apoio`)
estão em produção estáveis; este spec apenas os estende.

---

## Já existe (não tocar sem necessidade)

| Artefato                              | Path                                       | Notas                                 |
| ------------------------------------- | ------------------------------------------ | ------------------------------------- |
| `Fornecedor` type + service + UI      | `src/features/fornecedores/`               | Estável; só estender o type           |
| `NotaFiscal` + callables              | `src/features/fornecedores/`               | Não tocar                             |
| `Contrato` + `AvaliacaoPeriodica`     | `src/features/lab-apoio/`                  | Reutilizar o pattern de avaliação     |
| `Certificacao` + `Endereco`           | `src/features/lab-apoio/types/LabApoio.ts` | Reutilizar `Endereco` em `Fornecedor` |
| Callables criação/avaliação lab-apoio | `functions/src/callables/`                 | Existentes e funcionais               |

---

## Padrões reutilizados (não reinventar)

- `LogicalSignature` — shape idêntico ao usado em `lab-apoio` e `liberacao`
- Subcoleção `avaliacoes-periodicas` — idêntica ao padrão de `lab-apoio`
- Subcoleção `events` com `chainHash` — CF trigger já implementado em múltiplos módulos
- Soft-delete `deletadoEm` — universal
- `labId` em todo documento — universal

---

## Escopo deste spec (o que vai ser criado)

### Grupo A — Qualificação e avaliação de fornecedores

| Artefato                                | Tipo              | Descrição                                                     |
| --------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `QualificacaoFornecedor`                | Tipo TS           | Campo embutido em `Fornecedor`                                |
| `AvaliacaoFornecedor`                   | Interface TS      | Documento na subcoleção `avaliacoes-periodicas`               |
| Extensão de `Fornecedor`                | Type change       | Adicionar `qualificacao`, `enderecoEstruturado`, `categorias` |
| `qualificarFornecedor` callable         | CF callable       | Primeiro registro + logicalSignature                          |
| `registrarAvaliacaoFornecedor` callable | CF callable       | Append-only + logicalSignature                                |
| Regras Firestore                        | `firestore.rules` | `avaliacoes-periodicas` subcoleção                            |
| `useAvaliacoesFornecedor` hook          | React hook        | `onSnapshot` da subcoleção                                    |
| `QualificacaoFornecedorModal`           | Componente React  | Formulário de qualificação inicial                            |
| `AvaliacaoFornecedorModal`              | Componente React  | Formulário de avaliação periódica                             |

### Grupo B — Alertas de vencimento (lab-apoio)

| Artefato                   | Tipo             | Descrição                                                                   |
| -------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `VigenciaAlertBanner`      | Componente React | Banner no módulo lab-apoio mostrando contratos prestes a vencer             |
| CF cron `alertVencimentos` | Cloud Function   | Agendada diária; gera `KPIAlert` para contratos/certs vencendo em ≤ 30 dias |

### Grupo C — Relatórios PDF

| Artefato                     | Tipo             | Descrição                                            |
| ---------------------------- | ---------------- | ---------------------------------------------------- |
| `generateFornecedoresReport` | CF callable      | PDF com lista de fornecedores + status de avaliações |
| Botão de export              | Componente React | Botão em `FornecedoresView` que dispara o callable   |

---

## Dados / Entidades

### `AvaliacaoFornecedor`

```typescript
interface AvaliacaoFornecedor {
  id: string;
  labId: string;
  fornecedorId: string;
  data: Timestamp;
  resultado: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado';
  responsavel: string; // userId
  responsavelNome: string; // snapshot do nome
  criteriosAvaliados: {
    prazoEntrega: boolean;
    qualidadeProduto: boolean;
    documentacaoCorreta: boolean;
    atendimento: boolean;
  };
  observacoes?: string;
  logicalSignature: LogicalSignature;
  criadoEm: Timestamp;
}
```

### `QualificacaoFornecedor`

```typescript
interface QualificacaoFornecedor {
  qualificadoEm: Timestamp;
  qualificadoPor: string; // userId
  qualificadoPorNome: string; // snapshot
  criteriosDocumentados: string;
  categorias: string[]; // 'reagentes' | 'consumiveis' | 'servicos' | 'outros'
  logicalSignature: LogicalSignature;
}
```

### `Fornecedor` — extensão

```typescript
// Adicionar ao type existente:
enderecoEstruturado?: {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};
qualificacao?: QualificacaoFornecedor;
categorias: string[];
```

---

## Critérios de aceite

- [ ] **CA-AF-01** — `Fornecedor` com campo `qualificacao` persistido via callable com `logicalSignature` válida (validada em rules).
- [ ] **CA-AF-02** — Subcoleção `avaliacoes-periodicas` append-only: nenhuma avaliação pode ser editada ou deletada (rules bloqueiam `update` e `delete`).
- [ ] **CA-AF-03** — `AvaliacaoFornecedor` exige todos os quatro critérios booleanos preenchidos.
- [ ] **CA-AF-04** — CF cron `alertVencimentos` cria `KPIAlert` quando `vigenciaFim` ou `Certificacao.dataValidade` < hoje + 30 dias.
- [ ] **CA-AF-05** — `generateFornecedoresReport` retorna PDF com: lista de fornecedores, CNPJ, status de qualificação, data última avaliação e resultado.
- [ ] **CA-AF-06** — `enderecoEstruturado` substituirá gradualmente o campo `endereco` livre (retrocompatível — campo livre mantido como fallback de exibição).
- [ ] **CA-AF-07** — Soft-delete: toda avaliação tem `labId`; nenhum `deleteDoc` em avaliacoes-periodicas.
- [ ] **CA-AF-08** — TypeScript: `npx tsc --noEmit` sem erros novos.

---

## Fora de escopo

- Consulta automática CNPJ na Receita Federal.
- Gestão de pedidos de compra / procurement.
- Portal self-service do fornecedor.
- Faturamento ou contas a pagar.
- Integração EDI.

# Guia de Módulo — Apoio & Fornecedores

**DICQ 4.14.8 (Labs de Apoio) · RDC 978/2025 Arts. 36–39 (terceirização) · RDC 786/2023 Art. 42 (rastreabilidade fiscal)**
**Status atual:** Dois módulos existentes e independentes — `lab-apoio` (contratos com labs terceirizados) e `fornecedores` (cadastro de fornecedores + notas fiscais). A consolidação em uma visão "Apoio & Fornecedores" é de UI/hub apenas; a lógica permanece separada.

---

## Objetivo

Fornecer gestão completa de (1) fornecedores de insumos e reagentes com rastreabilidade fiscal (CNPJ, NF-e, vínculos a lotes) e (2) laboratórios de apoio (terceirização de exames), com histórico de avaliações periódicas e conformidade DICQ 4.14.8. A união dos dois no hub facilita auditoria: um único ponto onde o auditor verifica toda a cadeia de fornecimento e terceirização do laboratório.

---

## Já existe no HC Quality

### `fornecedores` (em prod)

| Componente                                                      | Descrição                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `Fornecedor`                                                    | CNPJ único por lab, razão social, nome fantasia, endereço, soft-delete |
| `NotaFiscal`                                                    | NF vinculada ao fornecedor, parse de DANFE XML, itens de NF            |
| `parseDanfeXml`                                                 | Utilitário de extração de dados de NF-e XML                            |
| `FornecedorFormModal`                                           | UI de cadastro e edição de fornecedor                                  |
| `NotaFiscalFormModal`                                           | UI de lançamento de NF                                                 |
| `useFornecedores`, `useNotasFiscais`                            | Hooks de leitura em tempo real                                         |
| `fornecedorService`, `notaFiscalService`, `notaFiscalCallables` | Serviços e callables                                                   |

### `lab-apoio` (em prod)

| Componente                                                   | Descrição                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `Contrato`                                                   | CNPJ + habilitação ANVISA + vigência + exames terceirizados (TAT)         |
| `AvaliacaoPeriodica`                                         | Histórico append-only de avaliações (aprovado / com ressalva / reprovado) |
| `Certificacao`                                               | Certificações do lab de apoio (ISO 15189, etc.) com validade              |
| `Contato`, `Endereco`                                        | Dados de contato estruturados                                             |
| Callables obrigatórias para criação, avaliação, soft-delete  | Escritas server-side                                                      |
| Chain-hash em `events` subcoleção                            | Imutabilidade das mutações                                                |
| `logicalSignature` em criação e avaliação                    | Assinatura do RT                                                          |
| CLAUDE.md completo com scope, inviolable rules, architecture | Documentação técnica                                                      |

---

## O que é comum com outros módulos

| Padrão                                             | Onde aparece                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| CNPJ único por lab                                 | `fornecedores`, `lab-apoio` — validação módulo 11 implementada em `fornecedores` |
| `logicalSignature` (RT assina criação e avaliação) | `lab-apoio`, `liberacao`, `educacao-continuada`, `pops`                          |
| Chain-hash + events subcoleção (append-only)       | `lab-apoio`, `risks`, `equipamentos`, `liberacao`                                |
| Soft-delete obrigatório                            | Universal — `deletadoEm` field                                                   |
| `labId` multi-tenant em toda coleção               | Universal                                                                        |
| Callables obrigatórias para escritas regulatórias  | `lab-apoio`, `risks`, `equipamentos`, `liberacao`                                |
| Avaliação periódica com histórico imutável         | `lab-apoio` (avaliações), `equipamentos` (calibrações)                           |
| PDF de relatório via Cloud Function                | `liberacao`, `kpis`, `analytics` — padrão reutilizável                           |
| Picker de fornecedor nos forms de insumo           | `insumos`, `lots` referenciam `fornecedorId`                                     |

---

## Lacunas (DICQ Gap)

| Gap                                                                           | DICQ Req                  | Prioridade | Observação                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Avaliação periódica de **fornecedores** de insumos (não apenas labs de apoio) | 4.14.8                    | Alta       | `AvaliacaoPeriodica` existe só no `lab-apoio`; fornecedores de reagentes não têm avaliação anual. |
| Alerta de vencimento de vigência de contrato de lab de apoio                  | 4.14.8                    | Alta       | `vigenciaFim` existe; notificação antecipada ausente.                                             |
| Alerta de vencimento de certificação (ISO 15189, etc.)                        | 4.14.8                    | Alta       | `Certificacao.dataValidade` existe; alerta ausente.                                               |
| Qualificação de fornecedor (critérios documentados antes da primeira compra)  | 4.14.8                    | Alta       | Sem tela de qualificação inicial com critérios configuráveis.                                     |
| Endereço estruturado no cadastro de `Fornecedor`                              | RDC 786                   | Média      | `endereco` é campo livre; `lab-apoio` tem `Endereco` estruturada — padronizar.                    |
| PDF de relatório de fornecedores / labs de apoio (para auditoria)             | 4.14.8                    | Média      | Sem exportação PDF de lista de fornecedores ou de avaliações.                                     |
| Dashboard unificado (fornecedores críticos + labs de apoio vencendo)          | Hub                       | Média      | Tile do hub navega para módulos separados; sem visão consolidada.                                 |
| Indicador de fornecedor com histórico de não-conformidades                    | 4.14.8, nao-conformidades | Baixa      | Sem link entre `Fornecedor.id` e NC registradas por falha de entrega.                             |

---

## Estrutura proposta

```
Firestore
├── /labs/{labId}/fornecedores/{fornecedorId}       ← já existe (estender)
│   ├── avaliacoes-periodicas/{avaliacaoId}         ← NOVO (igual ao lab-apoio)
│   └── events/{eventId}                            ← NOVO (chain-hash)
└── /labs/{labId}/lab-apoio/{contratoId}            ← já existe
    └── events/{eventId}                            ← já existe

UI (hub — src/features/hub/)
└── tiles/ApoioFornecedoresPanel.tsx               ← visão consolidada (NOVO)

UI (src/features/fornecedores/)
├── components/
│   ├── AvaliacaoFornecedorModal.tsx               ← NOVO
│   └── QualificacaoFornecedorModal.tsx            ← NOVO
└── hooks/
    └── useAvaliacoesFornecedor.ts                 ← NOVO

UI (src/features/lab-apoio/)
└── components/
    └── VigenciaAlertBanner.tsx                    ← NOVO (alerta vencimento)
```

---

## Dados / Entidades

### `AvaliacaoFornecedor` (nova subcoleção em `fornecedores/{id}/avaliacoes-periodicas`)

```
id: string
data: Timestamp
resultado: 'aprovado' | 'aprovado_com_ressalva' | 'reprovado'
responsavel: string          // userId
responsavelNome: string      // snapshot
criteriosAvaliados: {
  prazoEntrega: boolean
  qualidadeProduto: boolean
  documentacaoCorreta: boolean
  atendimento: boolean
}
observacoes?: string
logicalSignature: LogicalSignature
```

### `QualificacaoFornecedor` (campo em `Fornecedor`)

```
qualificadoEm: Timestamp?
qualificadoPor: string?
criteriosDocumentados: string?     // campo livre ou checklist
categorias: string[]               // 'reagentes', 'consumiveis', 'servicos', etc.
```

### `Fornecedor` (extensão do existente)

Adicionar ao schema atual:

```
enderecoEstruturado: Endereco?     // migrar do campo livre `endereco`
qualificacao: QualificacaoFornecedor?
categorias: string[]
```

---

## Ações principais

| Ação                                              | Quem       | Como                                   |
| ------------------------------------------------- | ---------- | -------------------------------------- |
| Cadastrar fornecedor                              | Operador   | `fornecedorService.create` (já existe) |
| Qualificar fornecedor (1ª vez)                    | RT / Admin | Callable nova + logicalSignature       |
| Registrar avaliação periódica de fornecedor       | RT         | Callable nova + append-only            |
| Lançar nota fiscal                                | Operador   | `notaFiscalCallables` (já existe)      |
| Cadastrar contrato de lab de apoio                | RT         | Callable existente                     |
| Registrar avaliação de lab de apoio               | RT         | Callable existente                     |
| Alertar vencimento de contrato / certificação     | Sistema    | CF cron diário → `KPIAlert` ou push    |
| Exportar relatório de fornecedores para auditoria | RT         | CF `generateFornecedoresReport` (NOVO) |
| Exportar relatório de labs de apoio               | RT         | CF `generateLabApoioReport` (NOVO)     |

---

## Integrações

| Módulo                          | Integração                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `insumos` / `lots`              | `Fornecedor.id` referenciado em lotes e movimentações — rastreabilidade fiscal     |
| `nao-conformidades`             | NC por falha de entrega ou qualidade referencia `fornecedorId`                     |
| `kpis` / `indicadores-melhoria` | Taxa de fornecedores com avaliação em dia como indicador de qualidade              |
| `risks`                         | Fornecedor crítico sem avaliação ou com reprovação pode gerar risco `fornecimento` |
| `auditoria-interna`             | Checklist de auditoria inclui "contratos de apoio vigentes e avaliações em dia"    |

---

## Critérios de aceite

- [ ] Fornecedor com CNPJ único validado (módulo 11) por lab.
- [ ] Avaliação periódica de fornecedor com histórico imutável (append-only) e logicalSignature.
- [ ] Contrato de lab de apoio com alerta de vencimento antecipado (configurável: 30/60/90 dias).
- [ ] Certificação de lab de apoio com alerta de vencimento.
- [ ] Qualificação inicial de fornecedor documentada antes do primeiro lançamento de NF.
- [ ] Endereço de fornecedor estruturado (logradouro, cidade, estado, CEP).
- [ ] Relatório PDF exportável com lista de fornecedores + status de avaliações (para auditoria DICQ).
- [ ] Dashboard do hub mostra fornecedores/contratos com pendências (vencimentos, avaliações atrasadas).
- [ ] Soft-delete: nenhuma deleção física.
- [ ] Toda escrita crítica via callable server-side.

---

## Fora de escopo

- Homologação automática de fornecedores via integração com Receita Federal (consulta CNPJ online).
- Gestão de pedidos de compra e cotações (procurement — fora do DICQ laboratorial).
- Portal de fornecedor (self-service de atualização de dados pelo próprio fornecedor).
- Faturamento e contas a pagar vinculados às notas fiscais.
- Integração EDI com distribuidores de reagentes.

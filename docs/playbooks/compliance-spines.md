# HC Quality — Entidades-espinha de rastreabilidade (RDC 978)

> **Por que este doc existe:** RDC 978 (ANVISA) exige rastreabilidade ponta-a-ponta. Cada módulo do app precisa **referenciar** entidades canônicas em vez de inventar a sua. Sem isso, em 6 meses temos 7 versões de "Lote" e a auditoria quebra.
>
> **Regra de ouro:** entidade-espinha é dona **de um módulo só** e consumida por todos os outros via `id`. Nunca duplicar; nunca embed cópia parcial.
>
> **Nota regulatória:** referências de artigos da RDC devem ser conferidas contra o texto vigente publicado pela ANVISA antes de citação em POP, manual da qualidade ou laudo. Este doc trata da modelagem de software, não substitui leitura formal da norma.

---

## Visão geral

| Spine                          | Dono (módulo)           | Coleção Firestore                                                           | Consumidores                                         | Status                                     |
| ------------------------------ | ----------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------ |
| **Pessoa/Operador**            | Gestão de Pessoas       | `/users` + `/labs/{labId}/members` + `/labs/{labId}/qualificacoes` _(novo)_ | TODOS                                                | parcial — falta qualificações/treinamentos |
| **Fornecedor**                 | Compras                 | `/labs/{labId}/fornecedores`                                                | Lote, NF                                             | placeholder (Fase E)                       |
| **Nota Fiscal**                | Compras                 | `/labs/{labId}/notas-fiscais`                                               | Lote                                                 | placeholder (Fase E)                       |
| **Lote rastreável**            | Estoque/Insumos         | `/labs/{labId}/insumos` (atual)                                             | CIQ, Imuno, Bioquímica, Hemato, Coag, Uroanálise, CT | **existe; falta vínculo NF + Fornecedor**  |
| **Movimentação assinada**      | infra (chain-hash)      | `/labs/{labId}/insumo-movimentacoes`                                        | Estoque, Auditoria                                   | live (Onda 0c)                             |
| **Equipamento**                | Equipamentos            | `/labs/{labId}/equipamentos`                                                | módulos técnicos, CT, calibração                     | placeholder (Fase D)                       |
| **POP / Documento vigente**    | Documentos da Qualidade | `/labs/{labId}/pops` _(novo)_                                               | módulos técnicos referenciam POP em uso na corrida   | **a construir**                            |
| **Não-Conformidade (NC/CAPA)** | Qualidade               | `/labs/{labId}/nao-conformidades` _(novo)_                                  | qualquer módulo abre; Qualidade trata                | **a construir**                            |
| **Audit log assinado**         | infra                   | `/labs/{labId}/ciq-audit` + `/auditLogs`                                    | TODOS, sem exceção                                   | live                                       |

---

## 1. Pessoa/Operador

**Dono:** módulo Gestão de Pessoas.
**Por que é spine:** RDC 978 exige assinatura responsável em cada etapa (coleta, análise, liberação). Sem `operadorId` em cada ação, não há rastreabilidade de quem fez o quê.

### Schema canônico

```ts
// /users/{uid} (já existe — completar)
type User = {
  uid: string;
  email: string;
  nome: string;
  cpfHash: string; // SHA-256, nunca raw (LGPD)
  status: 'ativo' | 'afastado' | 'desligado';
  // refs
  labsAtivos: string[]; // labIds onde tem member doc ativo
};

// /labs/{labId}/members/{uid} (já existe — completar)
type Member = {
  uid: string;
  role: 'owner' | 'admin' | 'analista' | 'tecnico' | 'leitor';
  active: boolean;
  cargo: string; // "Biomédica RT", "Técnica em análises", etc
  conselhoProfissional?: { sigla: 'CRBM' | 'CRF' | 'CRM' | 'CRBio'; numero: string; uf: string };
  responsavelTecnico?: boolean; // RT do lab — único por lab
};

// /labs/{labId}/qualificacoes/{qualId} (novo)
type Qualificacao = {
  uid: string; // FK Member
  tipo: 'treinamento' | 'capacitacao' | 'reciclagem';
  modulosLiberados: (
    | 'hematologia'
    | 'imunologia'
    | 'coagulacao'
    | 'uroanalise'
    | 'bioquimica'
    | 'compras'
    | 'estoque'
  )[];
  evidenciaUrl?: string; // certificado, ata
  validoDe: Timestamp;
  validoAte?: Timestamp; // null = sem expiração
  liberadoPor: string; // uid do RT que liberou
  hmac: string; // assinatura
};
```

### Invariantes

- `responsavelTecnico: true` é único por lab (rule + função de transação).
- Toda ação técnica registrada em qualquer módulo carrega `operadorId` **e** valida `member.active === true` no momento da escrita.
- Liberação em módulo X exige `qualificacoes` ativa cobrindo X. CF valida; UI bloqueia preventivamente.

### Como outros módulos consomem

```ts
// Em qualquer doc de resultado/movimento:
{ operadorId: uid, operadorAssinaturaTs: serverTimestamp() }
```

**Nunca** copiar nome/cargo no doc consumidor. Só `operadorId`. UI resolve via cache.

---

## 2. Fornecedor

**Dono:** módulo Compras (Qualificação de Fornecedores).
**Por que é spine:** RDC 978 exige fornecedores qualificados antes da compra de insumos críticos. Lote sem fornecedor qualificado = NC automática.

### Schema canônico

```ts
// /labs/{labId}/fornecedores/{fornecedorId}
type Fornecedor = {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string; // formato com máscara salva normalizada
  inscricaoEstadual?: string;
  // qualificação
  status: 'pendente' | 'qualificado' | 'suspenso' | 'desqualificado';
  qualificadoEm?: Timestamp;
  qualificadoPor?: string; // uid
  proximaRequalificacao?: Timestamp; // tipicamente +12m
  evidencias: {
    tipo: 'alvara' | 'licenca-sanitaria' | 'iso' | 'certificado-fabricante' | 'avaliacao';
    url: string;
    validade?: Timestamp;
  }[];
  categoriasFornecidas: (
    | 'reagente'
    | 'controle'
    | 'calibrador'
    | 'consumivel'
    | 'epi'
    | 'servico-calibracao'
    | 'servico-manutencao'
  )[];
  contato: { email: string; telefone: string; responsavel: string };
  observacoes?: string;
};
```

### Invariantes

- `status === 'qualificado'` requer pelo menos uma `evidencia` válida (data > now) por categoria fornecida.
- Compra (NF) só é registrável contra fornecedor qualificado **na data da emissão**. Histórico de status é append-only em `/fornecedores/{id}/historico`.

---

## 3. Nota Fiscal

**Dono:** módulo Compras.
**Por que é spine:** vínculo legal entre Fornecedor → Lote físico recebido. RDC 978 exige conferência no recebimento (lote, validade, integridade da embalagem, condições de transporte).

### Schema canônico

```ts
// /labs/{labId}/notas-fiscais/{nfId}
type NotaFiscal = {
  id: string;
  numero: string;
  serie?: string;
  chaveAcesso?: string; // 44 dígitos NFe — útil para evitar duplicidade
  fornecedorId: string; // FK
  dataEmissao: Timestamp;
  dataRecebimento: Timestamp;
  recebidoPor: string; // uid
  // conferência no recebimento
  conferenciaOk: boolean;
  desviosObservados?: string;
  ncId?: string; // se conferência falhou, FK para NC aberta
  // conteúdo
  itens: NFItem[];
  valorTotal: number;
  arquivoUrl?: string; // PDF/XML armazenado
};

type NFItem = {
  produtoInsumoId: string; // FK /produtos-insumos
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  // o que VAI virar Lote
  numeroLoteFabricante: string;
  validade: Timestamp;
  // após criar Lote, popula:
  loteIdGerado?: string; // FK /insumos
};
```

### Invariantes

- Não-duplicidade por `(fornecedorId, numero, serie)` ou `chaveAcesso`.
- Toda criação de Lote físico em `/insumos` deve referenciar `notaFiscalId` + `nfItemIndex`. Sem NF = não há entrada legal no estoque.

---

## 4. Lote rastreável

**Dono:** módulo Estoque (subset de Insumos).
**Por que é spine:** RDC 978 §rastreabilidade — todo resultado emitido pelo lab deve ser rastreável até o lote do reagente/controle/calibrador usado.

### Schema canônico — extensão do `Insumo` atual

```ts
// /labs/{labId}/insumos/{loteId}
type Insumo = {
  id: string;
  produtoInsumoId: string; // FK catálogo
  numeroLote: string; // do fabricante
  // NOVO — rastreabilidade
  notaFiscalId: string; // FK obrigatório (após Fase E)
  nfItemIndex: number;
  fornecedorId: string; // denormalizado para query rápida; auditável vs NF
  // já existe
  validade: Timestamp;
  diasEstabPosAbertura?: number; // bug conhecido — ver memória
  status: 'em-uso' | 'reserva' | 'descartado' | 'esgotado' | 'quarentena';
  recebidoEm: Timestamp;
  abertoEm?: Timestamp;
  abertoPor?: string; // uid
  esgotadoEm?: Timestamp;
  // rastreabilidade reversa (consumo)
  modulosUtilizadores: (
    | 'hematologia'
    | 'imunologia'
    | 'coagulacao'
    | 'uroanalise'
    | 'bioquimica'
  )[];
};
```

### Movimentações = chain-hash sagrada

Toda mudança de estado vira evento em `/insumo-movimentacoes` com HMAC + prev_hash. Tipos:

- `recebimento` (origem: NF)
- `abertura` (carrega `operadorId`, condições)
- `consumo-em-corrida` (FK runId, moduleId)
- `descarte` (com motivo: vencido, contaminado, NC)
- `transferencia-equipamento`

Padrão validado em [`functions/src/insumos/`](../../functions/src/insumos/). **Replicar este padrão** para todos os outros logs sensíveis (qualificações, NCs, calibrações).

---

## 5. Equipamento

**Dono:** módulo Equipamentos (Fase D).
**Por que é spine:** RDC 978 exige qualificação inicial, calibração periódica e manutenção rastreada. Resultado clínico tem que dizer **em qual equipamento foi gerado**.

### Schema canônico

```ts
// /labs/{labId}/equipamentos/{equipId}
type Equipamento = {
  id: string;
  nome: string;             // tag interna ("HEMATO-01")
  modelo: string;
  fabricante: string;
  numeroSerie: string;
  patrimonio?: string;
  modulosOperacionais: ('hematologia'|'imunologia'|'coagulacao'|'uroanalise'|'bioquimica')[];
  status: 'ativo' | 'manutencao' | 'aposentado';
  qualificacaoInicial?: { data: Timestamp; evidenciaUrl: string; responsavelUid: string };
  proximaCalibracao?: Timestamp;
  proximaManutencaoPreventiva?: Timestamp;
  retencaoAte?: Timestamp;  // 5 anos pós-aposentadoria
};

// /labs/{labId}/equipamentos-audit/{eventId} — append-only, chain-hash
type EquipamentoEvent =
  | { tipo: 'calibracao'; dataExecucao: Timestamp; provedorId: string /* fornecedor servico */; certificadoUrl: string; resultado: 'aprovado'|'reprovado-condicional'|'reprovado'; proximaEm: Timestamp }
  | { tipo: 'manutencao-preventiva'; ... }
  | { tipo: 'manutencao-corretiva'; ncId: string; ... }
  | { tipo: 'troca-status'; de: Status; para: Status; motivo: string };
```

### Invariantes

- Resultado em qualquer módulo que emita laudo carrega `equipamentoId` no momento da corrida.
- `status !== 'ativo'` bloqueia uso; UI e CF validam.

---

## 6. POP / Documento vigente

**Dono:** módulo Documentos da Qualidade (a construir).
**Por que é spine:** RDC 978 exige procedimentos escritos, controlados, com versão vigente. Resultado emitido sob POP X versão Y precisa ser reproduzível depois — mesmo que o POP seja revisado.

### Schema canônico

```ts
// /labs/{labId}/pops/{popId}
type POP = {
  id: string;
  codigo: string;           // "POP-IMU-001"
  titulo: string;
  modulo: ('hematologia'|...|'compras'|'estoque'|'qualidade'|'rh');
  versaoAtualId: string;    // FK para subcoleção /versoes
};

// /labs/{labId}/pops/{popId}/versoes/{versaoId}
type POPVersao = {
  versao: string;           // "1.0", "1.1"
  status: 'rascunho' | 'em-revisao' | 'vigente' | 'obsoleto';
  vigenteDe: Timestamp;
  vigenteAte?: Timestamp;
  arquivoUrl: string;       // PDF imutável
  hashConteudo: string;     // SHA-256 do PDF — fixa identidade
  aprovadoPor: string;      // uid RT
  treinamentoObrigatorio: boolean; // se true, módulo X exige qualificação treinada nesta versão
};
```

### Como módulos consomem

Toda corrida/laudo grava `{ popId, popVersaoId, popHash }` — congela a versão usada. Mesmo que o POP seja revisto amanhã, o resultado de hoje aponta para a versão exata.

---

## 7. Não-Conformidade (NC) e CAPA

**Dono:** módulo Qualidade (a construir).
**Por que é spine:** ponto único de abertura/tratamento. Qualquer módulo pode disparar uma NC; só Qualidade fecha.

### Schema canônico

```ts
// /labs/{labId}/nao-conformidades/{ncId}
type NaoConformidade = {
  id: string;
  codigo: string; // "NC-2026-042"
  origem:
    | 'recebimento-nf'
    | 'ciq-fora-controle'
    | 'auditoria-interna'
    | 'reclamacao'
    | 'manutencao'
    | 'outro';
  // FK para o que disparou
  origemRef?: { tipo: string; id: string }; // ex: { tipo: 'NF', id: 'nf_xyz' }
  abertaPor: string; // uid
  abertaEm: Timestamp;
  modulo: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  descricao: string;
  status: 'aberta' | 'em-analise' | 'em-acao' | 'concluida' | 'cancelada';
  // CAPA
  acoesImediatas?: string;
  causaRaiz?: string;
  acaoCorretiva?: {
    descricao: string;
    responsavelUid: string;
    prazo: Timestamp;
    concluidaEm?: Timestamp;
  };
  acaoPreventiva?: {
    descricao: string;
    responsavelUid: string;
    prazo: Timestamp;
    concluidaEm?: Timestamp;
  };
  eficaciaAvaliada?: {
    em: Timestamp;
    por: string;
    resultado: 'eficaz' | 'ineficaz';
    reabriu: boolean;
  };
};
```

### Invariantes

- NC crítica em CIQ pode bloquear liberação de laudos do módulo até resolução (gate de UI + rule server-side).
- Audit chain (`/ciq-audit` ou equivalente) registra cada transição de status.

---

## 8. Audit log assinado

**Dono:** infra.
**Já existe:** `/auditLogs` (root) + `/labs/{labId}/ciq-audit` + `/labs/{labId}/insumo-movimentacoes`.

### Padrão obrigatório para módulos novos

Todo módulo sensível precisa do **mesmo padrão**:

1. Cliente cria doc com `status: 'pending'` + payload.
2. CF de trigger (onCreate) calcula `prev_hash` (último doc selado da chain), aplica HMAC, sela com `status: 'sealed'` + `chainHash`.
3. Rule garante `pending → sealed` só via CF (`request.auth == null` ou marker via custom claim de service).
4. **Nunca** delete; nunca update após sealed.

Implementação de referência: [`functions/src/insumos/`](../../functions/src/insumos/) e [`functions/src/audit/`](../../functions/src/audit/).

---

## Padrões de cross-module reference

### Regra 1 — sempre por ID

```ts
// ❌ ERRADO
{ operador: { uid, nome: 'João', cargo: 'Biomédico' } }

// ✅ CERTO
{ operadorId: uid }
```

### Regra 2 — denormalização só se for invariante histórica

Se o consumidor precisa "congelar" estado no momento da escrita (ex: nome do reagente impresso no laudo do passado, mesmo que o produto seja renomeado), salve **explicitamente** como snapshot:

```ts
{
  produtoInsumoId: 'pi_xyz',
  produtoSnapshot: { nome: 'Anti-A 5mL', fabricante: 'Lab X' } // congelado intencionalmente
}
```

Documentar no schema **por que** é snapshot. Sem doc, é bug.

### Regra 3 — coleções comuns ficam em root ou em `/labs/{labId}`?

- Se compartilhada entre labs (ex: `/users`, catálogo global de produtos): root.
- Se específica do lab: `/labs/{labId}/...` (default — multi-tenant).

Ver [paths-map.md](paths-map.md) e [firestore-model.md](firestore-model.md) para padrão atual.

### Regra 4 — toda escrita sensível registra evento

Não é opcional. Se o dado importa para auditoria/rastreabilidade, escreva o evento na chain ANTES (ou junto via transaction) da escrita do estado. Estado sem evento = inauditável.

---

## Quando criar uma nova spine

Pergunta-teste: **3+ módulos vão referenciar essa entidade**, ou a entidade tem **regulamentação própria de retenção/auditoria**?

- Sim → spine. Aplica padrão deste doc.
- Não → fica encapsulada dentro do módulo dono.

---

## 🔗 Conexões Centrais

- [[HC_Quality]]

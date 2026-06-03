# SPEC — Pré & Pós-Analítico

**Versão:** 1.0 · **Data:** 2026-05-10
**Refs:** DICQ Bloco E (5.4.x) · DICQ Bloco G (5.7.x) · RDC 978/2025 Arts. 88–96 · RDC 978 Art. 167
**Guia base:** `_meta/guides/pre-pos-analitico.md`
**Prioridade:** 3

---

## Objetivo

Criar uma entidade `Amostra` rastreável que agregue o pré-analítico distribuído hoje
em `insumos`, `coagulacao`, `bioquimica` e `criticos`, e formalizar a rastreabilidade
pós-analítica nos laudos via novos campos em `ExameLaudo`.

Não reimplementar nada que já existe — apenas criar a cola entre módulos dispersos.

---

## Já existe (não tocar sem necessidade)

| Artefato                                      | Path                                          | Notas                                          |
| --------------------------------------------- | --------------------------------------------- | ---------------------------------------------- |
| `ExameLaudo` + `Laudo` types                  | `src/features/liberacao/types/laudo.ts`       | Apenas estender com novos campos               |
| `exameConfig`                                 | `src/features/liberacao/types/exameConfig.ts` | Estender com `nivelCritico`, `prazoEntrega`    |
| CF `liberarLaudo`, `criarLaudo`               | `functions/src/liberacao/`                    | Não tocar a lógica existente                   |
| Módulos `bioquimica`, `coagulacao`, `insumos` | `src/features/*/`                             | Reutilizar tipagem de insumos/reagentes        |
| `LogicalSignature`                            | Pattern global                                | Reutilizar em eventos de amostra               |
| Chain-hash / `AuditEvent`                     | Pattern global                                | Reutilizar na subcoleção `events` de `Amostra` |

---

## Padrões reutilizados

- `LogicalSignature` — eventos críticos de amostra (recebimento, rejeição, descarte)
- Subcoleção `events` com chain-hash — rastreabilidade de cada amostra
- Soft-delete `deletadoEm` — universal
- `labId` em todo documento
- Callable para mutações regulatórias (rejeição/descarte de amostra)

---

## Escopo deste spec

### Grupo A — Entidade `Amostra`

| Artefato                  | Tipo              | Descrição                                                                              |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| `Amostra` interface       | Tipo TS           | Nova entidade principal                                                                |
| `AmostraEvento` interface | Tipo TS           | Documento na subcoleção `events`                                                       |
| `AmostraStatus` enum      | Enum TS           | `coletada`, `recebida`, `em_processamento`, `concluida`, `rejeitada`, `descartada`     |
| `MotivoRejeicao` enum     | Enum TS           | `volume_insuficiente`, `hemolise`, `contaminacao`, `identificacao_incorreta`, `outros` |
| Regras Firestore          | `firestore.rules` | `/labs/{labId}/amostras/{amostraId}` + subcoleção `events`                             |
| `useAmostras` hook        | React hook        | Listagem com filtros de status e data                                                  |
| `useAmostra` hook         | React hook        | Documento único com `onSnapshot`                                                       |

### Grupo B — Callables para operações regulatórias de amostra

| Artefato                               | Tipo        | Descrição                                                                  |
| -------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `registrarRecebimentoAmostra` callable | CF callable | Transição `coletada` → `recebida`; cria evento com `logicalSignature`      |
| `rejeitarAmostra` callable             | CF callable | Transição → `rejeitada`; motivo obrigatório; evento com `logicalSignature` |
| `descartarAmostra` callable            | CF callable | Transição → `descartada`; data/hora de descarte; evento                    |

### Grupo C — Extensão de `exameConfig`

| Artefato                  | Tipo        | Descrição                                                                                                                           |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Extensão de `ExameConfig` | Type change | Adicionar `nivelCritico?: { min?: number; max?: number }`, `prazoEntregaHoras?: number`, `metodologia?: string`, `unidade?: string` |

### Grupo D — Extensão de `ExameLaudo`

| Artefato                 | Tipo        | Descrição                                                                                                                 |
| ------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| Extensão de `ExameLaudo` | Type change | Adicionar `amostraId?: string`, `dataColeta?: Timestamp`, `materialColeta?: string`, `tempoTransporte?: number` (minutos) |

### Grupo E — UI básica de rastreabilidade de amostras

| Artefato             | Tipo             | Descrição                                                   |
| -------------------- | ---------------- | ----------------------------------------------------------- |
| `AmostraStatusBadge` | Componente React | Badge por status com cor                                    |
| `AmostraTimeline`    | Componente React | Timeline de eventos da subcoleção `events`                  |
| Listagem básica      | Componente React | Tabela com filtro de status/data; link para laudo vinculado |

---

## Dados / Entidades

### `AmostraStatus`

```typescript
type AmostraStatus =
  | 'coletada'
  | 'recebida'
  | 'em_processamento'
  | 'concluida'
  | 'rejeitada'
  | 'descartada';
```

### `MotivoRejeicao`

```typescript
type MotivoRejeicao =
  | 'volume_insuficiente'
  | 'hemolise'
  | 'contaminacao'
  | 'identificacao_incorreta'
  | 'outros';
```

### `Amostra`

```typescript
interface Amostra {
  id: string;
  labId: string;
  pacienteId?: string; // referência ao paciente (quando disponível)
  laudoId?: string; // vínculo ao Laudo
  exameConfigId?: string; // exame de referência
  material: string; // ex: 'sangue total', 'soro', 'urina'
  volume?: number; // em mL
  dataColeta: Timestamp;
  coletadoPor: string; // userId
  coletadoPorNome: string; // snapshot do nome
  dataRecebimento?: Timestamp;
  status: AmostraStatus;
  motivoRejeicao?: MotivoRejeicao;
  observacoes?: string;
  insumoLoteId?: string; // tubo/reagente rastreado
  deletadoEm?: Timestamp;
  criadoEm: Timestamp;
  updatedAt: Timestamp;
}
```

### `AmostraEvento`

```typescript
interface AmostraEvento {
  id: string;
  labId: string;
  amostraId: string;
  tipo: 'coleta' | 'recebimento' | 'inicio_processamento' | 'conclusao' | 'rejeicao' | 'descarte';
  operadorId: string;
  operadorNome: string;
  ts: Timestamp;
  observacoes?: string;
  logicalSignature?: LogicalSignature; // obrigatório para rejeicao/descarte
  chainHash: string; // calculado pela CF trigger
  prevHash: string;
}
```

---

## Critérios de aceite

- [ ] **CA-PA-01** — `Amostra` só pode ser criada via callable (nenhum `setDoc` direto do client aceito em rules).
- [ ] **CA-PA-02** — Callable `rejeitarAmostra` exige `motivoRejeicao` preenchido; rejeição sem motivo rejeitada pela CF.
- [ ] **CA-PA-03** — Subcoleção `events` de cada amostra é append-only (rules bloqueiam `update`/`delete`).
- [ ] **CA-PA-04** — Campo `amostraId` em `ExameLaudo` é opcional e retrocompatível (laudos existentes sem `amostraId` continuam válidos).
- [ ] **CA-PA-05** — `AmostraTimeline` exibe todos os eventos ordenados por `ts` asc, com ícone e cor por tipo.
- [ ] **CA-PA-06** — `exameConfig` com `nivelCritico` faz com que `detectarCriticos` (CF existente) use esse campo (se existir) em vez de threshold hardcoded.
- [ ] **CA-PA-07** — TypeScript: `npx tsc --noEmit` sem erros novos.

---

## Fora de escopo

- Integração com LIS/HIS externo para recebimento automático de amostras.
- Rastreamento de temperatura durante transporte (IoT — módulo separado).
- Geração de etiquetas de amostra com código de barras/QR.
- Automação de coleta (robótica).
- Portal de coleta domiciliar.

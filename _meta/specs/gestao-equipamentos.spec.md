# SPEC — Gestão de Equipamentos

**Versão:** 1.0 · **Data:** 2026-05-10
**Refs:** DICQ Bloco H · 5.3.1.1–5.3.1.7 · RDC 978/2025 Art. 42 · RDC 786/2023
**Guia base:** `_meta/guides/gestao-equipamentos.md`
**Prioridade:** 5

---

## Objetivo

Fechar os gaps DICQ Bloco H no módulo de equipamentos já em produção:
vínculo formal Equipamento → Calibração (certificados com upload), agenda de manutenção
preventiva com alertas, histórico de uso/operadores, relatório técnico exportável em PDF,
e integração com o módulo de riscos (equipamento como origem de risco).

O módulo já existe com lifecycle completo. Este spec estende sem reescrever.

---

## Já existe (não tocar sem necessidade)

| Artefato                               | Path                                             | Notas                                     |
| -------------------------------------- | ------------------------------------------------ | ----------------------------------------- |
| `Equipamento` type completo            | `src/features/equipamentos/types/Equipamento.ts` | Apenas estender com campos novos          |
| `EquipamentoAuditEvent`                | `src/features/equipamentos/types/Equipamento.ts` | Intocável                                 |
| CF chain-hash trigger                  | `functions/src/modules/equipamentos/`            | Funcional                                 |
| Firestore `/labs/{labId}/equipamentos` | `firestore.rules`                                | Estender regras                           |
| Callables existentes de equipamentos   | `functions/src/callables/calibracao/`            | Reutilizar padrão                         |
| Componentes de listagem e detalhe      | `src/features/equipamentos/components/`          | Não reescrever — estender                 |
| `controle-temperatura`                 | módulo existente                                 | Equipamentos de temperatura já integrados |

---

## Padrões reutilizados

- `LogicalSignature` — aprovação de manutenção ou saída de operação por RT
- Chain-hash `EquipamentoAuditEvent` — já implementado
- Soft-delete `deletadoEm` — universal
- `labId` em todo documento
- Upload de PDF para Storage + URL assinada — padrão de `calibracao`
- `KPIAlert` — alertas de manutenção vencida

---

## Escopo deste spec

### Grupo A — Calibração aprimorada

| Artefato                       | Tipo        | Descrição                                                                                            |
| ------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------- | --------- | ---------- |
| Extensão de `Equipamento`      | Type change | Adicionar `certificadoCalibracaoUrl?`, `proximaCalibracao?: Timestamp`, `calibracaoStatus?: 'em_dia' | 'vencida' | 'proxima'` |
| `registrarCalibracao` callable | CF callable | Já existe em `callables/calibracao/` — verificar e estender com `proximaCalibracao`                  |
| `useCalibracaoStatus` hook     | React hook  | Deriva `calibracaoStatus` client-side por data                                                       |
| Badge de calibração            | Componente  | Badge por status na ficha do equipamento                                                             |

### Grupo B — Manutenção preventiva

| Artefato                                | Tipo              | Descrição                                                     |
| --------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `ManutencaoPreventiva` interface        | Tipo TS           | Nova subcoleção `/labs/{labId}/equipamentos/{id}/manutencoes` |
| `ManutencaoStatus` enum                 | Enum TS           | `agendada`, `realizada`, `cancelada`                          |
| Regras Firestore                        | `firestore.rules` | `manutencoes` subcoleção                                      |
| `agendarManutencao` callable            | CF callable       | Cria doc de manutenção preventiva                             |
| `registrarManutencaoRealizada` callable | CF callable       | Transição `agendada` → `realizada` com `logicalSignature`     |
| CF cron `alertManutencaoVencida`        | Cloud Function    | Diária; cria `KPIAlert` para manutenções vencidas             |
| `useManutencoes` hook                   | React hook        | Listagem de manutenções de um equipamento                     |
| UI de agenda de manutenção              | Componente        | Lista + modal de agendamento                                  |

### Grupo C — Histórico de uso / operadores

| Artefato                           | Tipo        | Descrição                               |
| ---------------------------------- | ----------- | --------------------------------------- |
| `EquipamentoUso` interface         | Tipo TS     | Nova subcoleção `usos` em equipamentos  |
| `registrarUsoEquipamento` callable | CF callable | Registra início/fim de uso por operador |
| `useEquipamentoUso` hook           | React hook  | Histórico de uso do equipamento         |
| Timeline de uso                    | Componente  | Similar ao `AmostraTimeline`            |

### Grupo D — Integração com riscos

| Artefato                     | Tipo        | Descrição                                                      |
| ---------------------------- | ----------- | -------------------------------------------------------------- |
| Extensão de `Risk`           | Type change | Adicionar `equipamentoId?` (já pode existir — verificar antes) |
| Link na ficha de equipamento | Componente  | Seção "Riscos associados" com link para módulo risks           |

### Grupo E — Exportação de relatório técnico

| Artefato                                | Tipo           | Descrição                                                          |
| --------------------------------------- | -------------- | ------------------------------------------------------------------ |
| CF callable `generateEquipamentoReport` | Cloud Function | PDF com ficha completa, histórico de calibrações, manutenções, uso |
| Botão export                            | Componente     | Na view de detalhe do equipamento                                  |

---

## Dados / Entidades

### `Equipamento` — extensão (campos adicionados)

```typescript
certificadoCalibracaoUrl?: string;     // URL Storage do PDF do certificado
proximaCalibracao?: Timestamp;          // data calculada ou informada
calibracaoStatus?: 'em_dia' | 'vencida' | 'proxima';  // derivado client-side
```

### `ManutencaoStatus`

```typescript
type ManutencaoStatus = 'agendada' | 'realizada' | 'cancelada';
```

### `ManutencaoPreventiva`

```typescript
interface ManutencaoPreventiva {
  id: string;
  labId: string;
  equipamentoId: string;
  tipo: 'preventiva' | 'corretiva';
  descricao: string;
  responsavelId: string;
  responsavelNome: string;
  dataPrevista: Timestamp;
  dataRealizada?: Timestamp;
  status: ManutencaoStatus;
  observacoes?: string;
  logicalSignature?: LogicalSignature; // ao registrar realizada
  criadoEm: Timestamp;
  updatedAt: Timestamp;
}
```

### `EquipamentoUso`

```typescript
interface EquipamentoUso {
  id: string;
  labId: string;
  equipamentoId: string;
  operadorId: string;
  operadorNome: string;
  inicio: Timestamp;
  fim?: Timestamp;
  observacoes?: string;
  criadoEm: Timestamp;
}
```

---

## Critérios de aceite

- [ ] **CA-GE-01** — `ManutencaoPreventiva` com `status: 'realizada'` só pode ser gravada via callable `registrarManutencaoRealizada` com `logicalSignature` de membro ativo.
- [ ] **CA-GE-02** — CF cron `alertManutencaoVencida` cria `KPIAlert` para equipamentos com `dataPrevista` de manutenção vencida há mais de 1 dia.
- [ ] **CA-GE-03** — `calibracaoStatus: 'vencida'` é exibido em vermelho na ficha; `'proxima'` (≤ 30 dias) em amarelo; `'em_dia'` em verde.
- [ ] **CA-GE-04** — Subcoleção `manutencoes` é append-only (rules bloqueiam `delete`); `update` permitido somente para transição de status.
- [ ] **CA-GE-05** — `generateEquipamentoReport` inclui: dados cadastrais, última calibração (com URL do certificado), próximas manutenções, histórico de uso dos últimos 30 dias.
- [ ] **CA-GE-06** — Campo `equipamentoId` em `Risk` é opcional e retrocompatível com riscos existentes.
- [ ] **CA-GE-07** — TypeScript: `npx tsc --noEmit` sem erros novos.

---

## Fora de escopo

- Integração com sistemas CMMS externos.
- Controle de peças sobressalentes.
- QR Code para identificação física do equipamento.
- Manutenção preditiva via IoT (módulo controle-temperatura cobre sensores).
- Certificação de proficuidade de operadores (módulo treinamentos cobre isso).

# TASKS — Gestão de Equipamentos

**Versão:** 1.0 · **Data:** 2026-05-10
**Spec:** `_meta/specs/gestao-equipamentos.spec.md`
**Gate global:** `npx tsc --noEmit` sem erros novos após cada tarefa.

> Convenção de status: `[ ]` pendente · `[x]` concluída · `[~]` em progresso · `[!]` bloqueada

---

## T-GE-01 — Estender tipo `Equipamento` com campos de calibração

**Arquivos:**

- `src/features/equipamentos/types/Equipamento.ts` (estender)

**Depende de:** —

**Instrução:**
Adicionar ao final da interface `Equipamento` os campos:

```typescript
certificadoCalibracaoUrl?: string;
proximaCalibracao?: Timestamp;
calibracaoStatus?: 'em_dia' | 'vencida' | 'proxima';
```

Não alterar campos existentes. Não alterar `EquipamentoAuditEvent`.

**Gate:** `npx tsc --noEmit`

---

## T-GE-02 — Criar interface `ManutencaoPreventiva` e enum `ManutencaoStatus`

**Arquivos:**

- `src/features/equipamentos/types/ManutencaoPreventiva.ts` (criar)
- `src/features/equipamentos/types/index.ts` (estender barrel)

**Depende de:** T-GE-01

**Instrução:**
Criar arquivo com:

```typescript
export type ManutencaoStatus = 'agendada' | 'realizada' | 'cancelada';

export interface ManutencaoPreventiva {
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
  logicalSignature?: LogicalSignature;
  criadoEm: Timestamp;
  updatedAt: Timestamp;
}
```

Exportar via barrel.

**Gate:** `npx tsc --noEmit`

---

## T-GE-03 — Criar interface `EquipamentoUso`

**Arquivos:**

- `src/features/equipamentos/types/EquipamentoUso.ts` (criar)
- `src/features/equipamentos/types/index.ts` (estender barrel)

**Depende de:** —

**Instrução:**
Criar arquivo com:

```typescript
export interface EquipamentoUso {
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

Exportar via barrel.

**Gate:** `npx tsc --noEmit`

---

## T-GE-04 — Adicionar regras Firestore para subcoleção `manutencoes`

**Arquivos:**

- `firestore.rules`

**Depende de:** T-GE-02

**Instrução:**
Dentro do match de `/labs/{labId}/equipamentos/{equipamentoId}`, adicionar subcoleção:

```
match /manutencoes/{manutencaoId} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isActiveMemberOfLab(labId)
    && request.resource.data.labId == labId
    && request.resource.data.equipamentoId == equipamentoId
    && request.resource.data.status in ['agendada', 'realizada', 'cancelada'];
  allow update: if isActiveMemberOfLab(labId)
    && request.resource.data.labId == resource.data.labId;
  allow delete: if false;  // append-only para manutencoes realizadas
}
```

Não tocar em outras regras de equipamentos.

**Gate:** `npx tsc --noEmit` (regras não são TS, validar sintaxe manualmente)

---

## T-GE-05 — Criar CF callable `agendarManutencao`

**Arquivos:**

- `functions/src/callables/manutencao/agendarManutencao.ts` (criar)
- `functions/src/callables/manutencao/index.ts` (criar ou atualizar)
- `functions/src/index.ts` (exportar novo módulo)

**Depende de:** T-GE-02, T-GE-04

**Instrução:**
Criar callable `agendarManutencao` com schema Zod:

```typescript
const schema = z.object({
  labId: z.string(),
  equipamentoId: z.string(),
  tipo: z.enum(['preventiva', 'corretiva']),
  descricao: z.string().min(5),
  responsavelId: z.string(),
  responsavelNome: z.string(),
  dataPrevista: z.string().datetime(),
  observacoes: z.string().optional(),
});
```

Callable grava em `/labs/{labId}/equipamentos/{equipamentoId}/manutencoes/{id}` com `status: 'agendada'`.
Seguir padrão de `functions/src/callables/calibracao/`.

**Gate:** `cd functions && npx tsc --noEmit`

---

## T-GE-06 — Criar CF callable `registrarManutencaoRealizada`

**Arquivos:**

- `functions/src/callables/manutencao/registrarManutencaoRealizada.ts` (criar)
- `functions/src/callables/manutencao/index.ts` (atualizar)

**Depende de:** T-GE-05

**Instrução:**
Criar callable `registrarManutencaoRealizada` com schema Zod:

```typescript
const schema = z.object({
  labId: z.string(),
  equipamentoId: z.string(),
  manutencaoId: z.string(),
  dataRealizada: z.string().datetime(),
  observacoes: z.string().optional(),
  logicalSignature: LogicalSignatureSchema,
});
```

Callable faz `update` no doc de manutenção: `status: 'realizada'`, `dataRealizada`, `logicalSignature`.
Verificar que o doc existe e que `status === 'agendada'` antes de atualizar.

**Gate:** `cd functions && npx tsc --noEmit`

---

## [x] T-GE-07 — Criar CF cron `alertManutencaoVencida`

**Arquivos:**

- `functions/src/modules/equipamentos/alertManutencaoVencida.ts` (criar)
- `functions/src/modules/equipamentos/index.ts` (exportar)

**Depende de:** T-GE-04

**Instrução:**
CF agendada diária (`onSchedule('every 24 hours')`).
Consulta todas as manutencoes de todos os labs onde:

- `status === 'agendada'`
- `dataPrevista < now() - 1 day`

Para cada resultado, cria `KPIAlert` em `/labs/{labId}/kpiAlerts/{id}`:

```typescript
{
  labId,
  tipo: 'manutencao_vencida',
  equipamentoId,
  manutencaoId,
  mensagem: `Manutenção ${tipo} vencida para equipamento ${equipamentoId}`,
  criadoEm: now(),
  resolvido: false,
}
```

Reutilizar padrão de alertas de `criticos` ou `risks`.

**Gate:** `cd functions && npx tsc --noEmit`

---

## T-GE-08 — Criar hook `useManutencoes`

**Arquivos:**

- `src/features/equipamentos/hooks/useManutencoes.ts` (criar)

**Depende de:** T-GE-02

**Instrução:**
Hook que recebe `{ labId, equipamentoId }` e retorna `{ manutencoes, loading, error }`.
`onSnapshot` em `/labs/{labId}/equipamentos/{equipamentoId}/manutencoes` ordenado por `dataPrevista desc`.
Limite de 50 registros. Unsubscribe no cleanup.

**Gate:** `npx tsc --noEmit`

---

## T-GE-09 — Criar hook `useCalibracaoStatus`

**Arquivos:**

- `src/features/equipamentos/hooks/useCalibracaoStatus.ts` (criar)

**Depende de:** T-GE-01

**Instrução:**
Hook puro (sem Firebase) que recebe `proximaCalibracao: Timestamp | undefined` e retorna
`calibracaoStatus: 'em_dia' | 'vencida' | 'proxima' | 'sem_data'`.

- `'vencida'` se `proximaCalibracao < now()`
- `'proxima'` se `proximaCalibracao` entre `now()` e `now() + 30 dias`
- `'em_dia'` se `proximaCalibracao > now() + 30 dias`
- `'sem_data'` se indefinido

**Gate:** `npx tsc --noEmit`

---

## T-GE-10 — Criar hook `useEquipamentoUso`

**Arquivos:**

- `src/features/equipamentos/hooks/useEquipamentoUso.ts` (criar)

**Depende de:** T-GE-03

**Instrução:**
Hook que recebe `{ labId, equipamentoId }` e retorna `{ usos, loading, error }`.
`onSnapshot` em `/labs/{labId}/equipamentos/{equipamentoId}/usos` ordenado por `inicio desc`.
Limite 30. Unsubscribe no cleanup.

**Gate:** `npx tsc --noEmit`

---

## T-GE-11 — UI: badge de calibração e seção de manutenções na ficha

**Arquivos:**

- `src/features/equipamentos/components/CalibracaoBadge.tsx` (criar)
- `src/features/equipamentos/components/ManutencaoList.tsx` (criar)
- `src/features/equipamentos/components/EquipamentoDetail.tsx` (estender com os novos componentes)

**Depende de:** T-GE-08, T-GE-09

**Instrução:**

1. `CalibracaoBadge`: recebe `calibracaoStatus` e renderiza badge colorido (`vencida`=vermelho, `proxima`=amarelo, `em_dia`=verde, `sem_data`=cinza).
2. `ManutencaoList`: usa `useManutencoes`, exibe lista de manutenções com data, tipo, status, responsável. Botão "Agendar" abre modal de formulário (modal simples, não implementar ainda se complexo — marcar como T-GE-12).
3. Inserir `CalibracaoBadge` e `ManutencaoList` no `EquipamentoDetail` existente.

**Gate:** `npx tsc --noEmit`

---

## T-GE-12 — CF callable `generateEquipamentoReport` + botão export

**Arquivos:**

- `functions/src/callables/equipamentos/generateEquipamentoReport.ts` (criar)
- `functions/src/callables/equipamentos/index.ts` (criar ou atualizar)
- `src/features/equipamentos/components/EquipamentoDetail.tsx` (adicionar botão)

**Depende de:** T-GE-06, T-GE-10

**Instrução:**
CF callable que recebe `{ labId, equipamentoId }` e gera PDF com:

- Dados cadastrais do equipamento
- Última calibração (com URL do certificado se disponível)
- Próximas manutenções (`status: 'agendada'`)
- Histórico de uso dos últimos 30 dias

Retornar URL assinada do PDF no Storage (padrão de `generateDashboardPDF` do módulo analytics).
No frontend, adicionar botão "Exportar Relatório" que chama a CF e abre a URL.

**Gate:** `cd functions && npx tsc --noEmit` + `npx tsc --noEmit` (frontend)

---

## Ordem de execução recomendada

```
T-GE-01 → T-GE-02 → T-GE-03 → T-GE-04
          ↓
      T-GE-05 → T-GE-06
      T-GE-07 (independente, paralelo com 05)
          ↓
      T-GE-08 → T-GE-09 → T-GE-10
          ↓
      T-GE-11 → T-GE-12
```

---

## Status geral

| Task    | Status | Notas                                                                                                        |
| ------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| T-GE-01 | [x]    |                                                                                                              |
| T-GE-02 | [x]    |                                                                                                              |
| T-GE-03 | [x]    |                                                                                                              |
| T-GE-04 | [x]    |                                                                                                              |
| T-GE-05 | [x]    |                                                                                                              |
| T-GE-06 | [x]    |                                                                                                              |
| T-GE-07 | [x]    |                                                                                                              |
| T-GE-08 | [x]    |                                                                                                              |
| T-GE-09 | [x]    |                                                                                                              |
| T-GE-10 | [x]    |                                                                                                              |
| T-GE-11 | [x]    | UI: `CalibracaoBadge`, `ManutencaoList`, `EquipamentoDetail` (ficha na área expandida do `EquipamentoCard`). |
| T-GE-12 | [x]    | CF `generateEquipamentoReport` + botão em `EquipamentoDetail`; export em `functions/src/index.ts`.           |

# SPEC — Indicadores & Melhoria

**Versão:** 1.0 · **Data:** 2026-05-10
**Refs:** DICQ 4.12 · DICQ 4.12.1 · DICQ 4.14.7 · RDC 978/2025 · REQ-401
**Guia base:** `_meta/guides/indicadores-melhoria.md`
**Prioridade:** 4

---

## Objetivo

Fechar o ciclo de qualidade: conectar os KPIs já calculados a planos de melhoria formalizados,
permitir que o gestor defina metas por indicador, exporte relatórios gerenciais e visualize
tendências temporais. O módulo `kpis` já calcula e exibe — este spec fecha o loop.

---

## Já existe (não tocar sem necessidade)

| Artefato | Path | Notas |
|---|---|---|
| `KPIDaily`, `KPIAlert` types | `src/features/kpis/types/KPI.ts` | Apenas estender com `meta?` |
| `aggregateDaily` CF | `functions/src/modules/analytics/aggregateDaily.ts` | Não tocar |
| `queryCIQCompliance` CF | `functions/src/modules/analytics/queryCIQCompliance.ts` | Não tocar |
| `generateDashboardPDF` CF | `functions/src/modules/analytics/generateDashboardPDF.ts` | Reutilizar padrão PDF |
| Analytics dashboard + filtros | `src/features/analytics/` | Não tocar |
| KPI dashboard view | `src/features/kpis/` | Estender com link para planos |

---

## Padrões reutilizados

- `LogicalSignature` — aprovação de plano de melhoria pelo RT
- Soft-delete `deletadoEm` — universal
- `labId` em todo documento
- Callable para mutações regulatórias (criar/fechar plano)
- `KPIAlert` — reutilizar para alertas de meta não atingida

---

## Escopo deste spec

### Grupo A — Metas por KPI

| Artefato | Tipo | Descrição |
|---|---|---|
| Extensão de `KPIDaily` | Type change | Adicionar `meta?: number` (percentual ou valor absoluto conforme métrica) |
| `KPIMeta` interface | Tipo TS | Documento na coleção `/labs/{labId}/kpi-metas` |
| `definirMetaKPI` callable | CF callable | Cria/atualiza `KPIMeta` com validação de role |
| `useKpiMetas` hook | React hook | Leitura das metas por tipo de KPI |
| UI — indicador de meta no dashboard | Componente | Linha de referência no gráfico existente |

### Grupo B — Planos de Melhoria

| Artefato | Tipo | Descrição |
|---|---|---|
| `PlanoMelhoria` interface | Tipo TS | Documento na coleção `/labs/{labId}/planos-melhoria` |
| `AcaoMelhoria` interface | Tipo TS | Subcoleção `acoes` dentro de `PlanoMelhoria` |
| `PlanoMelhoriaStatus` enum | Enum TS | `rascunho`, `ativo`, `concluido`, `cancelado` |
| Regras Firestore | `firestore.rules` | `/labs/{labId}/planos-melhoria` + subcoleção `acoes` |
| `criarPlanoMelhoria` callable | CF callable | Cria plano com `logicalSignature` |
| `atualizarAcaoMelhoria` callable | CF callable | Atualiza status de ação individual |
| `fecharPlanoMelhoria` callable | CF callable | Transição para `concluido`; exige RT signature |
| `usePlanosMelhoria` hook | React hook | Listagem com filtros |
| `usePlanoMelhoria` hook | React hook | Plano único + ações |

### Grupo C — UI de Planos de Melhoria

| Artefato | Tipo | Descrição |
|---|---|---|
| `PlanoMelhoriaCard` | Componente React | Card com status, ações pendentes, responsável |
| `PlanoMelhoriaDetail` | Componente React | Detalhe com lista de ações e linha do tempo |
| `AcaoMelhoriaForm` | Componente React | Formulário inline de ação (what/who/when) |
| View de listagem | Componente React | Listagem filtrada por status/responsável |

### Grupo D — Exportação de relatório gerencial

| Artefato | Tipo | Descrição |
|---|---|---|
| CF callable `generateKPIReport` | Cloud Function | PDF com tendências mensais dos KPIs + planos em aberto |
| Botão de export | Componente | Na view de KPIs |

---

## Dados / Entidades

### `KPIMeta`
```typescript
interface KPIMeta {
  id: string;
  labId: string;
  tipoKPI: string;             // ex: 'turnaround', 'retrabalho', 'conformidade'
  valor: number;               // meta numérica (percentual ou absoluto conforme tipo)
  unidade: string;             // 'percent' | 'hours' | 'count'
  vigenciaInicio: Timestamp;
  vigenciaFim?: Timestamp;
  definidoPor: string;         // userId
  definidoPorNome: string;
  criadoEm: Timestamp;
  ativo: boolean;
}
```

### `PlanoMelhoriaStatus`
```typescript
type PlanoMelhoriaStatus = 'rascunho' | 'ativo' | 'concluido' | 'cancelado';
```

### `PlanoMelhoria`
```typescript
interface PlanoMelhoria {
  id: string;
  labId: string;
  titulo: string;
  descricao: string;
  kpiOrigemId?: string;          // KPIAlert ou KPIDaily que originou o plano
  status: PlanoMelhoriaStatus;
  responsavelId: string;
  responsavelNome: string;
  prazoMeta: Timestamp;
  conclusaoEm?: Timestamp;
  logicalSignature?: LogicalSignature;  // preenchido ao fechar
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm?: Timestamp;
}
```

### `AcaoMelhoria`
```typescript
interface AcaoMelhoria {
  id: string;
  labId: string;
  planoId: string;
  descricao: string;
  responsavelId: string;
  responsavelNome: string;
  prazo: Timestamp;
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
  evidencia?: string;            // texto ou URL de upload futuro
  criadoEm: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Critérios de aceite

- [ ] **CA-IM-01** — `PlanoMelhoria` com `status: 'ativo'` só transita para `concluido` via callable `fecharPlanoMelhoria` com `logicalSignature` de role `admin` ou `owner`.
- [ ] **CA-IM-02** — `KPIMeta` é append-only: ao definir nova meta para o mesmo `tipoKPI`, a anterior fica com `ativo: false` e `vigenciaFim: now`.
- [ ] **CA-IM-03** — Dashboard de KPIs exibe linha de meta se `KPIMeta` ativo existir para o tipo exibido.
- [ ] **CA-IM-04** — `AcaoMelhoria` tem `prazo` obrigatório; callable rejeita se ausente.
- [ ] **CA-IM-05** — `generateKPIReport` inclui: período, valores reais vs meta por KPI, gráfico de tendência mensal (barras), lista de planos em aberto com prazo.
- [ ] **CA-IM-06** — Subcoleção `acoes` de `PlanoMelhoria` proibida de delete via rules.
- [ ] **CA-IM-07** — TypeScript: `npx tsc --noEmit` sem erros novos.

---

## Fora de escopo

- Integração com sistemas de BI externos (Power BI, Looker).
- Aprovação multinível de planos.
- Notificações push/SMS por prazo vencido.
- Formulário de revisão de gestão (Reunião de Alta Direção) — módulo separado.

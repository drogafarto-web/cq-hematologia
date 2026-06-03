# Guia de Módulo — Indicadores & Melhoria

**DICQ 4.12, 4.12.1, 4.14.7 · RDC 978/2025 · REQ-401**
**Status atual:** KPIs em prod (snapshot diário). Analytics em prod (charts + PDF). Planos de melhoria e metas configuráveis: faltando.

---

## Objetivo

Prover um ciclo completo de indicadores de qualidade (coleta → dashboard → meta → tendência → plano de melhoria → análise crítica), cobrindo os três domínios DICQ — pré-analítico, analítico e pós-analítico — com rastreabilidade de ações e fechamento documentado de oportunidades de melhoria.

---

## Já existe no HC Quality

| Componente                                                             | Path                                                      | Status     |
| ---------------------------------------------------------------------- | --------------------------------------------------------- | ---------- |
| `KPIDaily` (turnaround, retrabalho, conformidade, NC, SLA)             | `src/features/kpis/types/KPI.ts`                          | ✅ Em prod |
| `KPIAlert` (alertas por breach de threshold)                           | `src/features/kpis/types/KPI.ts`                          | ✅ Em prod |
| `KPIDashboardData` (atual + anterior + tendência)                      | `src/features/kpis/types/KPI.ts`                          | ✅ Em prod |
| Cloud Function `aggregateDaily` (agrega por `labId` + data)            | `functions/src/modules/analytics/aggregateDaily.js`       | ✅ Em prod |
| `queryCIQCompliance` callable                                          | `functions/src/modules/analytics/`                        | ✅ Em prod |
| `generateDashboardPDF` callable                                        | `functions/src/modules/analytics/generateDashboardPDF.js` | ✅ Em prod |
| Analytics Hub (CIQTrends, NCHeatmap, ComplianceStatus, TrainingMatrix) | `src/features/analytics/components/`                      | ✅ Em prod |
| Filtros por data, equipamento, operador                                | `src/features/analytics/hooks/`                           | ✅ Em prod |
| Polling 30s + cache local                                              | `src/features/analytics/hooks/useRealtimePolling.ts`      | ✅ Em prod |
| Export XLSX + PDF (Cloud Function)                                     | `src/features/analytics/services/`                        | ✅ Em prod |
| `management-review` (Análise Crítica Direção)                          | `src/features/management-review/`                         | ✅ Em prod |

---

## O que é comum com outros módulos

| Padrão                                             | Onde aparece                                 | Notas                                          |
| -------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| Callable server-side para escritas                 | analytics (aggregateDaily), risks, lab-apoio | Padrão HC Quality                              |
| KPIDashboardData reutilizável em management-review | kpis ↔ management-review                     | `aggregateManagementReviewData` já puxa KPI    |
| Soft-delete de registros                           | insumos, risks, equipamentos                 | Planos de melhoria devem seguir o mesmo padrão |
| `labId` em todos os docs                           | universal                                    | Multi-tenancy                                  |
| PDF export via Cloud Function                      | analytics, liberacao, educacao-continuada    | Padrão para relatórios regulatórios            |
| Graficos Levey-Jennings / trend                    | chart (CIQ), analytics (CIQTrendsDash)       | Reutilizar componentes de visualização         |
| Audit chain                                        | risks, lab-apoio, equipamentos               | Planos de melhoria também precisam de trilha   |

---

## Lacunas (DICQ Gap)

| Gap                                                                      | DICQ Req     | Prioridade | Observação                                                                  |
| ------------------------------------------------------------------------ | ------------ | ---------- | --------------------------------------------------------------------------- |
| Metas configuráveis por indicador (threshold editável pelo RT)           | 4.14.7       | Alta       | Hoje thresholds são hardcoded em `kpiCalculators.ts`.                       |
| Planos de melhoria formalizados (PDCA light)                             | 4.12.1       | Alta       | Faltam entidade + tela + vínculo com indicador.                             |
| Indicadores pré-analítico (rejeição de amostra, TAT coleta→recebimento)  | 4.14.7       | Alta       | Bloco E ainda sem módulo de coleta; parcialmente calculável já.             |
| Tendência longitudinal (semanal/mensal, não só D-1 vs D)                 | 4.12, 4.14.7 | Média      | `KPIDaily` é ponto-no-tempo; falta série histórica navegável.               |
| Vínculo NC → indicador afetado                                           | 4.10, 4.12   | Média      | Permite demonstrar impacto de NC em indicadores (auditoria DICQ).           |
| Vínculo CAPA → plano de melhoria → indicador monitorado                  | 4.10, 4.12.1 | Média      | Fecha o loop: CAPA → ação → mede resultado.                                 |
| Relatório mensal exportável (PDF, 1 página por bloco DICQ)               | 4.14.7       | Média      | `generateDashboardPDF` existe, mas sem seção de planos de melhoria.         |
| Análise Crítica Direção: auto-agregação de indicadores                   | 4.15         | Média      | `management-review` já existe; precisa pull automático de KPIs + tendência. |
| Indicadores pós-analítico: TAT liberação, relatório erros de transcrição | 4.14.7       | Baixa      | Deferred Phase 6+.                                                          |

---

## Estrutura proposta

```
Firestore
├── /labs/{labId}/kpi-daily/{YYYY-MM-DD}            ← já existe (aggregateDaily)
├── /labs/{labId}/kpi-metas/{indicadorId}            ← NOVO (metas configuráveis)
├── /labs/{labId}/planos-melhoria/{planoId}          ← NOVO
│   └── acoes/{acaoId}                               ← NOVO (PDCA steps)
└── /labs/{labId}/planos-melhoria-audit/{auditId}    ← NOVO (chainHash)

UI (src/features/kpis/ + src/features/analytics/)
├── MetasConfigPanel.tsx          ← NOVO
├── PlanoMelhoriaList.tsx         ← NOVO
├── PlanoMelhoriaModal.tsx        ← NOVO (criar/editar plano)
├── PlanoMelhoriaAcaoItem.tsx     ← NOVO (etapas PDCA)
└── analytics/
    └── IndicadorTrendChart.tsx   ← NOVO (série histórica)
```

---

## Dados / Entidades

### `KPIMeta` (nova coleção)

```
indicador: 'turnaround_media_horas' | 'retrabalho_percentual' | 'documentacao_percentual'
           | 'nc_total_abertas' | 'sla_atendido' | custom
metaValor: number
unidade: string
periodicidade: 'diario' | 'semanal' | 'mensal'
alertaAbaixoDe: number?   // threshold para alert
alertaAcimaDe: number?
ativaMeta: boolean
criadoEm: Timestamp
atualizadoEm: Timestamp
```

### `PlanoMelhoria` (nova coleção)

```
titulo: string
indicadorVinculado: string?     // campo de KPIDaily
ncIds: string[]                 // NCs que motivaram o plano
capaIds: string[]               // CAPAs associadas
status: 'aberto' | 'em_andamento' | 'concluido' | 'cancelado'
responsavel: string             // operadorId
prazo: Timestamp
descricao: string
resultadoEsperado: string
eficaciaVerificada: boolean
eficaciaDescricao: string?
logicalSignature: LogicalSignature
criadoEm: Timestamp
deletadoEm: Timestamp?
```

### `AcaoMelhoria` (subcoleção de PlanoMelhoria)

```
fase: 'plan' | 'do' | 'check' | 'act'
descricao: string
responsavel: string
prazo: Timestamp
status: 'pendente' | 'concluida' | 'cancelada'
evidenciaUrl: string?
concluidoEm: Timestamp?
```

---

## Ações principais

| Ação                                              | Quem       | Como                                                     |
| ------------------------------------------------- | ---------- | -------------------------------------------------------- |
| Configurar meta por indicador                     | RT / Admin | Callable server-side                                     |
| Criar plano de melhoria                           | RT / Admin | Callable                                                 |
| Adicionar etapa PDCA                              | Operador   | Callable                                                 |
| Concluir plano com verificação de eficácia        | RT         | Callable + logicalSignature                              |
| Exportar relatório mensal de indicadores + planos | RT         | `generateDashboardPDF` estendido                         |
| Auto-agregação de KPIs na Análise Crítica         | Sistema    | CF `aggregateManagementReviewData` (já existe, estender) |

---

## Integrações

| Módulo                        | Integração                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `nao-conformidades` (NC/CAPA) | Plano de melhoria referencia `ncIds` + `capaIds`                                   |
| `management-review`           | Auto-pull de KPI trends + planos abertos para ata                                  |
| `risks`                       | NPR alto pode sugerir criação de plano de melhoria (linkagem manual ou automática) |
| `analytics`                   | Dashboard existente exibe KPIs; adicionar seção de metas e planos                  |
| `educacao-continuada`         | Indicador de eficácia de treinamentos alimenta `documentacao_percentual`           |

---

## Critérios de aceite

- [ ] RT consegue configurar meta numérica para cada indicador `KPIDaily`.
- [ ] Dashboard exibe semáforo (verde/amarelo/vermelho) vs meta.
- [ ] Série histórica (30/60/90 dias) navegável em gráfico de linha.
- [ ] Plano de melhoria criado com etapas PDCA e responsável.
- [ ] Plano vinculado a NC/CAPA existentes (por ID).
- [ ] Eficácia do plano verificável e documentada (campo + logicalSignature).
- [ ] `generateDashboardPDF` inclui seção de planos abertos e concluídos.
- [ ] `aggregateManagementReviewData` puxa KPIs + planos para ata de Análise Crítica.
- [ ] Nenhum plano deletável fisicamente (soft-delete + `deletadoEm`).

---

## Fora de escopo

- Indicadores clínicos de diagnóstico (sensibilidade/especificidade de método — pertence a Analítico).
- Cadastro e gerenciamento de orçamento ou custo de não-qualidade.
- LIS/HIS integration para TAT end-to-end (deferred v1.6).
- Business Intelligence com drill-down irrestrito (escopo é DICQ 4.14.7, não analytics avançado).

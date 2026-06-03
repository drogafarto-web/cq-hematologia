# Guia de Módulo — Pré & Pós-Analítico

**DICQ Bloco E (5.4.x) · Bloco G (5.7.x) · RDC 978/2025 Arts. 88–96 (coleta) + 167 (laudo)**
**Status atual:** Sem módulo dedicado. Funcionalidades distribuídas em `liberacao` (pos-analítico parcial), `criticos` (alerta pos-analitico), `bioquimica`/`coagulacao`/`uroanalise` (analítico). Bloco E DICQ sem cobertura estruturada.

---

## Objetivo

Cobrir as etapas anteriores e posteriores à análise laboratorial, demonstrando conformidade com DICQ Bloco E (coleta, preparo, transporte, recepção e identificação de amostras) e Bloco G (entrega de resultados, comunicação de críticos, acesso de pacientes e médicos). Isso fecha a cadeia pré-analítico → analítico → pós-analítico que as normas exigem — hoje o HC Quality cobre bem o analítico, mas os bookends estão descobertos.

---

## Já existe no HC Quality

| Componente                                                    | Path                                                | Status     |
| ------------------------------------------------------------- | --------------------------------------------------- | ---------- |
| `Laudo` com 14 campos RDC 978 Art. 167 (pós-analítico)        | `src/features/liberacao/types/laudo.ts`             | ✅ Em prod |
| FSM de liberação de laudos (auto-libera / RT revisa críticos) | `src/features/liberacao/`                           | ✅ Em prod |
| Histórico de versões de laudo (imutável)                      | `laudos/{id}/laudo-versions/`                       | ✅ Em prod |
| Comunicação de críticos (email + log auditável)               | `src/features/liberacao/`, `src/features/criticos/` | ✅ Em prod |
| Portal Paciente (acesso a resultados via email + LGPD)        | `src/features/portal-paciente/`                     | ✅ Em prod |
| Portal RT (escalação de críticos, presença RT)                | `src/features/portal-rt/`                           | ✅ Em prod |
| `tipoMaterial` e `metodoAnalitico` em `ExameLaudo`            | `src/features/liberacao/types/laudo.ts`             | ✅ Em prod |
| Classificação de exames (rotina/urgência/crítico)             | `src/features/liberacao/types/exameConfig.ts`       | ✅ Em prod |
| Críticos FSM (NORMAL → CRITICO → ALERTADO → RESOLVIDO)        | `src/features/criticos-fsm/`                        | ✅ Em prod |
| OCR de laudos via Gemini + gate de consentimento              | `src/features/laudo-ocr/`                           | ✅ Em prod |

**O que existe parcialmente (não consolidado como módulo pré-analítico):**

- Campo `dataHoraColeta` e `tipoMaterial` no `Laudo` — informação de coleta chega via laudo, sem rastreabilidade própria.
- Campos de rejeição de amostra: inexistentes no schema atual.
- TAT (Turnaround Time) coleta→recebimento: calculável com dados existentes se `dataHoraColeta` estiver preenchida, mas sem indicador formal.
- Critérios de aceitação/rejeição de amostras: não há entidade nem tela dedicada.

---

## O que é comum com outros módulos

| Padrão                                            | Onde aparece                                              | Notas                            |
| ------------------------------------------------- | --------------------------------------------------------- | -------------------------------- |
| `logicalSignature` (RT assina coleta e liberação) | liberacao, educacao-continuada, equipamentos              | Mesmo shape `LogicalSignature`   |
| Chain-hash audit trail                            | liberacao (`laudo-versions`), risks, equipamentos         | CF trigger append-only           |
| Soft-delete                                       | liberacao, risks, lab-apoio                               | `deletadoEm` obrigatório         |
| `labId` multi-tenancy                             | universal                                                 | Toda coleção                     |
| Callable obrigatório para escritas regulatórias   | liberacao, risks, lab-apoio                               | Não escrever direto do client    |
| Classificação de exames                           | liberacao (`exameConfig`), criticos (thresholds)          | Config por exame já existe       |
| TAT como KPI                                      | kpis (`turnaround_media_horas`)                           | Já calculado pelo aggregateDaily |
| Comunicação de resultado                          | liberacao (email RT), criticos (cascade), portal-paciente | Múltiplos canais existentes      |

---

## Lacunas (DICQ Gap)

| Gap                                                                     | DICQ Req         | Prioridade | Observação                                                               |
| ----------------------------------------------------------------------- | ---------------- | ---------- | ------------------------------------------------------------------------ |
| Registro de recebimento de amostra (com identificação e conferência)    | E.5.4.1, E.5.4.2 | Alta       | Nenhuma entidade `Amostra` com campos de recepção.                       |
| Critérios de aceitação e rejeição de amostras (configuráveis por exame) | E.5.4.3          | Alta       | `exameConfig` existe mas sem `criteriosAceitacao`.                       |
| Registro formal de rejeição com motivo e comunicação ao solicitante     | E.5.4.3          | Alta       | Campo `rejeitadaEm` + `motivoRejeicao` + callable ausentes.              |
| TAT pré-analítico (coleta→recebimento, recebimento→análise)             | E.5.4.x, 4.14.7  | Alta       | `dataHoraColeta` existe no laudo; `dataHoraRecebimento` não.             |
| Instrução ao paciente e preparo (documentada por exame)                 | E.5.4.1          | Média      | Sem tela ou entidade de instrução de preparo.                            |
| Rastreabilidade de transporte de amostras (cadeia de custódia)          | E.5.4.2          | Média      | Nenhum registro de transporte (courier, temperatura, tempo).             |
| Retificação de laudo com justificativa auditável                        | G.5.7.3          | Média      | `laudo-versions` existe; tela de retificação (motivo + RT sig) pendente. |
| Relatório de amostras rejeitadas por período (indicador DICQ)           | 4.14.7           | Média      | Sem agregação de rejeições.                                              |
| Controle de laudos entregues fora do prazo (TAT pós-analítico)          | G.5.7.x          | Baixa      | TAT de liberação calculável; alerta de SLA faltando.                     |

---

## Estrutura proposta

```
Firestore
├── /labs/{labId}/amostras/{amostraId}           ← NOVO (entidade central)
│   └── events/{eventId}                         ← NOVO (chainHash pré-analítico)
├── /labs/{labId}/exame-config/{exameId}         ← já existe (estender)
│   └── criterios-aceitacao                      ← NOVO (campo novo no doc)
└── /labs/{labId}/laudos/{laudoId}               ← já existe (estender)
    └── laudo-versions/{versionId}               ← já existe

UI (src/features/pre-pos-analitico/)
├── components/
│   ├── RecebimentoAmostrasPanel.tsx      ← NOVO
│   ├── AmostraFormModal.tsx              ← NOVO
│   ├── RejeicaoAmostrasModal.tsx         ← NOVO
│   ├── CriteriosAceitacaoConfig.tsx      ← NOVO (configuração por exame)
│   ├── TATDashboard.tsx                  ← NOVO (indicadores de prazo)
│   └── RetificacaoLaudoModal.tsx         ← NOVO
├── hooks/
│   ├── useAmostras.ts                    ← NOVO
│   └── useTATMetrics.ts                  ← NOVO
└── services/
    └── preAnalyticoCallables.ts          ← NOVO
```

---

## Dados / Entidades

### `Amostra` (nova coleção `/labs/{labId}/amostras`)

```
id: string
labId: string
solicitacaoId: string?          // ID da solicitação (se integrado)
pacienteNome: string
pacienteNascimento: Timestamp?
examesRequisitados: string[]    // códigos de exame
tipoMaterial: string            // Soro, EDTA, Urina, etc.
volume: number?
unidade: string?                // mL, mL, etc.
dataHoraColeta: Timestamp
dataHoraRecebimento: Timestamp?
coletadoPor: string             // operadorId
recebidoPor: string?            // operadorId
status: 'aguardando_recepcao' | 'recebida' | 'em_analise' | 'rejeitada' | 'concluida'
motivoRejeicao: string?
rejeitadaEm: Timestamp?
comunicadoRejeicao: boolean?
temperaturaTransporte: number?  // °C (opcional)
logicalSignature: LogicalSignature  // assinatura de recebimento
criadoEm: Timestamp
deletadoEm: Timestamp?
```

### `CriterioAceitacao` (campo em `exameConfig`)

```
material: string
volumeMinimo: number?
prazoMaximoColeta: number?      // horas desde a coleta
temperaturaMax: number?
hemolisePermitida: boolean
lipemiaPermitida: boolean
ictericiaPermitida: boolean
outrosCriterios: string?
```

---

## Ações principais

| Ação                                        | Quem       | Como                                                  |
| ------------------------------------------- | ---------- | ----------------------------------------------------- |
| Registrar recebimento de amostra            | Operador   | Callable + logicalSignature                           |
| Rejeitar amostra com motivo                 | Operador   | Callable + comunicar solicitante                      |
| Configurar critérios de aceitação por exame | RT / Admin | Callable (atualiza `exameConfig`)                     |
| Calcular TAT pré-analítico                  | Sistema    | Derivado de `dataHoraColeta` vs `dataHoraRecebimento` |
| Retificar laudo (pós-analítico)             | RT         | Callable + logicalSignature + versão imutável         |
| Exportar relatório de amostras rejeitadas   | RT         | Cloud Function `generateRejectionReport`              |
| Alertar SLA de liberação (TAT pós)          | Sistema    | CF cron / KPIAlert                                    |

---

## Integrações

| Módulo                                     | Integração                                                                                   |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `liberacao`                                | `Amostra.id` referenciado no `Laudo`; `dataHoraColeta` e `tipoMaterial` puxados da amostra   |
| `kpis` / `indicadores-melhoria`            | TAT coleta→liberação alimenta `turnaround_media_horas`; taxa de rejeição como novo indicador |
| `criticos`                                 | Amostra com resultado crítico aciona FSM `criticos-fsm`                                      |
| `risks`                                    | Rejeições frequentes podem gerar risco categorizado como `processual` / `pre_analitico`      |
| `bioquimica` / `coagulacao` / `uroanalise` | Exames analíticos recebem `amostraId` como referência de rastreabilidade                     |

---

## Critérios de aceite

- [ ] Amostra recebida com timestamp, operador e logicalSignature.
- [ ] Rejeição registrada com motivo selecionável + campo livre + comunicação ao solicitante.
- [ ] Critérios de aceitação configuráveis por tipo de exame (volume mínimo, temperatura, hemólise).
- [ ] TAT pré-analítico (coleta→recebimento) calculado e exibido no dashboard de KPIs.
- [ ] Taxa de rejeição de amostras disponível como indicador no módulo `kpis`.
- [ ] Amostra rastreável ao laudo correspondente (campo `amostraId` em `Laudo`).
- [ ] Retificação de laudo exige logicalSignature do RT e cria versão imutável (`laudo-versions`).
- [ ] Soft-delete: amostras nunca excluídas fisicamente.
- [ ] `AmostraEvent` com chainHash para toda mutação relevante.

---

## Fora de escopo

- Coleta domiciliar e integração com sistema de agendamento de coleta externa.
- Integração com LIS/HIS para recebimento automático de requisições.
- Gestão de biorepositório de amostras (armazenamento de longo prazo — fora do DICQ 4.14.6).
- Faturamento e convênios associados às requisições.
- Gestão de estoque de tubos e materiais de coleta (pertence a `insumos`).

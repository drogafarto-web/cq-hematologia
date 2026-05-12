# Guia de Módulo — Gestão de Riscos

**DICQ 4.14.6 · RDC 978/2025 Art. 86 · ISO 31000 (referência)**
**Status atual:** Em produção (Phase 7 FMEA-lite com NPR + revisão periódica). Gaps documentados abaixo.

---

## Objetivo

Manter um inventário ativo de riscos laboratoriais (processuais, biológicos, de infraestrutura), avaliados por FMEA-lite (Probabilidade × Severidade × Detecção = NPR), com planos de tratamento rastreáveis, revisão periódica agendada, integração com NC/CAPA e com o módulo de auditoria interna — demonstrando conformidade com DICQ 4.14.6 e RDC 978 Art. 86.

---

## Já existe no HC Quality

| Componente | Path | Status |
|---|---|---|
| Entidade `Risk` (FMEA-lite: P×S×D, NPR, Nível, categoria, processo) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RiskTreatmentAction` (ações de tratamento com responsável e prazo) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RiskReview` (revisão periódica com NPR antes/depois) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RiskAuditEvent` (chain-hash append-only) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RISK_CATEGORY` enum (biologico, quimico, ergonomico, processual, infra, lgpd) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RISK_PROCESS` enum (pre_analitico, analitico, pos_analitico, suporte, infra) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| `RISK_NIVEL` derivado de NPR (baixo, medio, alto, critico) | `src/features/risks/types/Risk.ts` | ✅ Em prod |
| Cloud Function trigger que calcula `chainHash` | `functions/src/modules/risks/` | ✅ Em prod |
| Firestore `/labs/{labId}/risks` e `/labs/{labId}/risks-audit` | `firestore.rules` | ✅ Em prod |
| CLAUDE.md com regras do módulo | `src/features/risks/CLAUDE.md` | ✅ Documentado |

---

## O que é comum com outros módulos

| Padrão | Onde aparece | Notas |
|---|---|---|
| FMEA-lite (P×S×D → NPR) | risks | Único módulo; padrão reutilizável para biossegurança |
| Chain-hash audit events | risks, equipamentos, lab-apoio, insumos | Append-only via CF trigger |
| Soft-delete (`deletadoEm`) | risks, equipamentos, lab-apoio, planos-melhoria | Nunca `deleteDoc` |
| `logicalSignature` server-side | risks, lab-apoio, educacao-continuada, equipamentos | Rules validam |
| Callable obrigatório para escritas | risks, lab-apoio, equipamentos | Client só lê |
| Status enum (aberto/em_tratamento/aceito/concluido/cancelado) | risks, nc/capa, planos-melhoria | Máquina de estados |
| Responsável (`responsavelId`) + prazo em ações | risks, planos-melhoria, CAPA | Mesmo shape de dados |
| Revisão periódica agendada | risks (reviewSchedule), educacao-continuada (revalidacao) | Padrão comum |

---

## Lacunas (DICQ Gap)

| Gap | DICQ Req | Prioridade | Observação |
|---|---|---|---|
| Vínculo formal Risk → NC/CAPA aberta | 4.14.6, 4.10 | Alta | Hoje `Risk` não tem `ncIds[]` ou `capaIds[]`; link é manual. |
| Relatório de mapa de riscos (heat map P×S) exportável em PDF | 4.14.6 | Alta | Nenhum export de risk matrix existente. |
| Alerta automático quando revisão periódica vence | 4.14.6 | Média | `reviewSchedule` existe na entidade; cron e alerta RT faltam. |
| Dashboard de riscos (quadrante NPR, distribuição por categoria) | 4.14.6 | Média | UI básica existe; falta tela de painel analítico. |
| Vínculo Risk → Plano de Melhoria | 4.12.1, 4.14.6 | Média | Fechar loop: risco alto → gera plano de melhoria automaticamente (sugestão). |
| Aprovação formal de riscos aceitos (nível Crítico requer RT) | 4.14.6 | Média | Status `aceito` hoje pode ser marcado por qualquer operador. |
| Indicador de eficácia da ação de tratamento (NPR antes vs depois) | 4.14.6 | Média | `RiskReview` já tem `nprAntes/nprDepois`; falta tela de acompanhamento comparativo. |
| Categorias específicas: LGPD, equipamentos, infraestrutura | 4.14.6, LGPD | Baixa | Enum já tem `lgpd`; faltam templates de risco pré-cadastrado. |

---

## Estrutura proposta

```
Firestore
├── /labs/{labId}/risks/{riskId}              ← já existe
├── /labs/{labId}/risks-audit/{auditId}       ← já existe (chainHash)
└── /labs/{labId}/risk-templates/{templateId} ← NOVO (riscos pré-cadastrados por categoria)

UI (src/features/risks/)
├── components/
│   ├── RiskList.tsx                    ← já existe (provavelmente)
│   ├── RiskFormModal.tsx               ← já existe
│   ├── RiskHeatmap.tsx                 ← NOVO (quadrante P×S)
│   ├── RiskReviewModal.tsx             ← já existe?
│   └── RiskPDFExport.tsx              ← NOVO
├── hooks/
│   ├── useRisks.ts                     ← já existe
│   └── useRiskReviewAlerts.ts          ← NOVO
└── services/
    └── risksCallables.ts               ← já existe
```

---

## Dados / Entidades

### `Risk` (já existe — estender)
Campos existentes cobertos no `Risk.ts`. Adicionar:
```
ncIds: string[]           // NCs vinculadas
capaIds: string[]         // CAPAs vinculadas
planoMelhoriaId: string?  // Plano de melhoria gerado
aprovadoPor: string?      // operadorId (obrigatório se nivel === 'critico')
aprovadoEm: Timestamp?
```

### `RiskTemplate` (nova coleção)
```
categoria: RiskCategory
processo: RiskProcess
titulo: string
descricao: string
causaPotencial: string
efeitoPotencial: string
pDefault: 1 | 2 | 3 | 4 | 5   // sugestão de pontuação
sDefault: 1 | 2 | 3 | 4 | 5
dDefault: 1 | 2 | 3 | 4 | 5
ativo: boolean
```

---

## Ações principais

| Ação | Quem | Como |
|---|---|---|
| Cadastrar risco (manual ou via template) | Operador | Callable |
| Avaliar NPR (P, S, D) | Operador | Callable |
| Registrar ação de tratamento | RT / Operador | Callable + logicalSignature |
| Aprovar risco "aceito" nível crítico | RT | Callable (verificar role) |
| Registrar revisão periódica | Operador | Callable + `RiskReview` |
| Vincular NC/CAPA ao risco | Operador | Callable (atualiza `ncIds[]`) |
| Exportar mapa de riscos (PDF) | RT | Cloud Function `generateRiskMatrixPDF` |
| Alertar revisão vencida | Sistema | CF cron diário |

---

## Integrações

| Módulo | Integração |
|---|---|
| `nao-conformidades` / CAPA | `Risk.ncIds[]` + `Risk.capaIds[]`; NC pode sugerir criação de risco |
| `indicadores-melhoria` | NPR alto → sugestão de plano de melhoria; `riskId` em `PlanoMelhoria` |
| `auditoria-interna` | Checklist de auditoria puxa riscos abertos por processo |
| `biosseguranca` | Riscos categoria `biologico`/`quimico` vinculam a áreas de risco |
| `management-review` | Análise Crítica inclui mapa de riscos e distribuição NPR |

---

## Critérios de aceite

- [ ] Risk com `nivel === 'critico'` exige aprovação explícita de RT (campo `aprovadoPor`).
- [ ] Revisão periódica vencida gera alerta in-app para RT.
- [ ] Exportação de mapa de riscos (heat map P×S + lista NPR) em PDF.
- [ ] Vínculo com NC/CAPA (campo `ncIds[]` + `capaIds[]`) funcional via callable.
- [ ] `RiskAuditEvent` com `chainHash` gerado por CF trigger em toda mutação.
- [ ] Soft-delete: `deletadoEm` presente; risco não some da lista histórica.
- [ ] Dashboard de riscos: distribuição por categoria, nível, processo.
- [ ] NPR antes vs depois de tratamento exibidos na tela de revisão.

---

## Fora de escopo

- Análise de modo de falha de equipamento (FMEA de produto — competência do fabricante).
- Gestão de riscos financeiros ou estratégicos (corporativo — fora do escopo DICQ 4.14.6).
- Integração com sistema de Saúde e Segurança do Trabalho (SESMT/eSocial).
- Registro de acidentes de trabalho (pertence ao RH / módulo PGRSS parcialmente).

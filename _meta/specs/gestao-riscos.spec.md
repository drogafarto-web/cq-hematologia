# SPEC — Gestão de Riscos

**Versão:** 1.0 · **Data:** 2026-05-10
**Refs:** DICQ 4.14.6 · RDC 978/2025 Art. 86 · ISO 31000 (referência)
**Guia base:** `_meta/guides/gestao-riscos.md`
**Prioridade:** 2

---

## Objetivo

Fechar os gaps DICQ 4.14.6 sobre o módulo de riscos já em produção:
vínculo formal Risk → NC/CAPA, aprovação de riscos críticos por RT, alerta de revisão vencida,
mapa de riscos exportável em PDF, dashboard analítico e biblioteca de templates.

O módulo já existe com FMEA-lite completo. Este spec estende sem reescrever.

---

## Já existe (não tocar sem necessidade)

| Artefato                                              | Path                               | Notas                        |
| ----------------------------------------------------- | ---------------------------------- | ---------------------------- |
| `Risk` type completo                                  | `src/features/risks/types/Risk.ts` | Apenas estender com 4 campos |
| `RiskTreatmentAction`, `RiskReview`, `RiskAuditEvent` | `src/features/risks/types/Risk.ts` | Intocáveis                   |
| CF trigger `chainHash`                                | `functions/src/modules/risks/`     | Funcional                    |
| Firestore `/labs/{labId}/risks` + regras              | `firestore.rules`                  | Estender regras              |
| `risksCallables.ts`                                   | `src/features/risks/services/`     | Estender (não substituir)    |
| `CLAUDE.md` de riscos                                 | `src/features/risks/CLAUDE.md`     | Ler antes de editar          |

---

## Padrões reutilizados

- `LogicalSignature` — aprovação de riscos críticos exige signature do RT
- Subcoleção `*-audit` chain-hash — já implementada, só garantir que novos eventos sejam emitidos
- Soft-delete `deletadoEm` — universal
- `labId` em todo documento — universal
- `KPIAlert` — reutilizar para alertas de revisão vencida (coleção já existe)

---

## Escopo deste spec

### Grupo A — Extensão do tipo Risk e vínculo NC/CAPA

| Artefato                     | Tipo        | Descrição                                                                           |
| ---------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| Extensão de `Risk`           | Type change | Adicionar `ncIds[]`, `capaIds[]`, `planoMelhoriaId?`, `aprovadoPor?`, `aprovadoEm?` |
| `vincularNcAoRisco` callable | CF callable | Atualiza `ncIds[]` / `capaIds[]` via callable                                       |
| `aprovarRisco` callable      | CF callable | Status `aceito` para risco `critico` exige RT + logicalSignature                    |

### Grupo B — Biblioteca de templates

| Artefato                                            | Tipo              | Descrição                                                    |
| --------------------------------------------------- | ----------------- | ------------------------------------------------------------ |
| `RiskTemplate` interface                            | Tipo TS           | Nova entidade na coleção `/labs/{labId}/risk-templates`      |
| Regras Firestore                                    | `firestore.rules` | `risk-templates`: read/write com role check                  |
| Seed de templates                                   | Dados             | ≥ 5 templates por categoria (biologico, quimico, processual) |
| `useRiskTemplates` hook                             | React hook        | Leitura da coleção de templates                              |
| UI — picker de template no form de criação de risco | Componente        | Dropdown/modal de templates ao criar risco                   |

### Grupo C — Alertas de revisão vencida

| Artefato                   | Tipo           | Descrição                                                |
| -------------------------- | -------------- | -------------------------------------------------------- |
| `useRiskReviewAlerts` hook | React hook     | Filtra riscos com `reviewSchedule.proximaRevisao` < hoje |
| CF cron `alertRiskReviews` | Cloud Function | Diária; cria `KPIAlert` para revisões vencidas           |
| Badge/alerta na UI         | Componente     | Indicação visual na lista de riscos                      |

### Grupo D — Dashboard e visualizações

| Artefato                  | Tipo             | Descrição                                                   |
| ------------------------- | ---------------- | ----------------------------------------------------------- |
| `RiskHeatmap`             | Componente React | Quadrante P×S (5×5) com bolhas coloridas por NPR            |
| Dashboard de distribuição | Componente React | Barras por categoria + por nível (baixo/médio/alto/crítico) |

### Grupo E — Exportação PDF

| Artefato                            | Tipo           | Descrição                                           |
| ----------------------------------- | -------------- | --------------------------------------------------- |
| CF callable `generateRiskMatrixPDF` | Cloud Function | PDF com heat map + lista de riscos ordenada por NPR |
| Botão export na UI                  | Componente     | Dispara callable e abre PDF                         |

---

## Dados / Entidades

### `Risk` — extensão (campos adicionados)

```typescript
ncIds: string[];           // IDs de NCs vinculadas
capaIds: string[];         // IDs de CAPAs vinculadas
planoMelhoriaId?: string;  // Plano de melhoria gerado
aprovadoPor?: string;      // userId — obrigatório se nivel === 'critico' e status === 'aceito'
aprovadoEm?: Timestamp;
```

### `RiskTemplate` (nova coleção)

```typescript
interface RiskTemplate {
  id: string;
  labId: string; // ou 'global' para templates padrão
  categoria: RiskCategory;
  processo: RiskProcess;
  titulo: string;
  descricao: string;
  causaPotencial: string;
  efeitoPotencial: string;
  pDefault: 1 | 2 | 3 | 4 | 5;
  sDefault: 1 | 2 | 3 | 4 | 5;
  dDefault: 1 | 2 | 3 | 4 | 5;
  ativo: boolean;
  criadoEm: Timestamp;
}
```

---

## Critérios de aceite

- [ ] **CA-GR-01** — Risco com `nivel === 'critico'` e `status === 'aceito'` só pode ser gravado via callable `aprovarRisco` com `logicalSignature` de usuário com role `owner` ou `admin`.
- [ ] **CA-GR-02** — Callable `vincularNcAoRisco` atualiza `ncIds[]` com operação `arrayUnion` (não sobrescreve array inteiro).
- [ ] **CA-GR-03** — CF cron `alertRiskReviews` cria `KPIAlert` para cada risco com `reviewSchedule.proximaRevisao` < hoje + 7 dias.
- [ ] **CA-GR-04** — `RiskHeatmap` exibe quadrante 5×5 P×S; cada célula mostra contagem de riscos; cor escala por NPR médio.
- [ ] **CA-GR-05** — `generateRiskMatrixPDF` retorna PDF com: heat map, lista ordenada por NPR desc, status de tratamento.
- [ ] **CA-GR-06** — `risk-templates`: regras Firestore permitem apenas `owner`/`admin` criar/editar; leitura por qualquer membro ativo.
- [ ] **CA-GR-07** — `RiskAuditEvent` gerado por CF trigger em toda mutação (criar, aprovar, vincular NC).
- [ ] **CA-GR-08** — TypeScript: `npx tsc --noEmit` sem erros novos.

---

## Fora de escopo

- FMEA de produto (competência do fabricante).
- Riscos financeiros ou estratégicos.
- Integração SESMT/eSocial.
- Registro de acidentes de trabalho.

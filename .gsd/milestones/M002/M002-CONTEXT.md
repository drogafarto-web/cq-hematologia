# M002 — Coagulação v2 (Redesign Completo)

**Status:** EM PRODUÇÃO — polimento ativo
**Data de criação:** 26/05/2026
**Fonte de verdade:** [`docs/coag-v2/coag-v2-master.md`](../../docs/coag-v2/coag-v2-master.md)
**Deploy report:** [`docs/coag-v2/DEPLOY-REPORT-2026-05-25.md`](../../docs/coag-v2/DEPLOY-REPORT-2026-05-25.md)

---

## Princípio Zero

> O sistema deve ser simples o suficiente para que um colaborador entenda rapidamente, sem precisar compreender arquitetura interna.

---

## Arquitetura (3 entidades, 3 eventos, ≤6 campos operacionais)

### Entidades

| Entidade | Propósito | Collection Path |
|----------|-----------|-----------------|
| `ControlOperacional` | Controle físico (saco) — RT configura | `labs/{labId}/control-operacional/{id}` |
| `Attempt` | Tentativa de medição CIQ — operador executa | `labs/{labId}/attempts/{id}` |
| `RTAction` | Decisão do RT (aprovar/rejeitar/NOTIVISA) | `labs/{labId}/rt-actions/{id}` |

### Eventos (timeline narrativa)

1. `attempt.criado` — Operador salvou tentativa
2. `controle.aprovado` — RT aprovou
3. `controle.rejeitado` — RT rejeitou

### Campos operacionais expostos ao operador

1. Controle (dropdown)
2. Equipamento (dropdown)
3. AP (input numérico)
4. RNI (input numérico)
5. TTPA (input numérico)
6. Ação corretiva (textarea, condicional — só se violação)

---

## Estrutura de Código (`src/features/coagulacao-v2/`)

```
types/
  ControlOperacional.ts, Attempt.ts, RTAction.ts, index.ts

services/
  controlOperacionalService.ts    — CRUD controle
  attemptService.ts               — save + get + list
  rtActionService.ts              — create + list (side effects)

hooks/
  useControlOperacional.ts        — subscription real-time
  useAttempts.ts                  — subscription tentativas
  useAttemptSave.ts               — orquestração (Westgard + snapshot + signature)
  useRTAction.ts                  — create RTAction
  useRTActionsByTarget.ts         — subscription por target
  useInsumosList.ts               — lista insumos para dropdown
  useEquipamentosList.ts          — lista equipamentos para dropdown
  internal/buildSignaturePayload.ts — SHA-256 canonical

components/
  CoagulacaoV2View.tsx            — view principal (operador)
  AttemptForm.tsx                 — formulário operacional
  AttemptForm.schema.ts           — Zod validation
  AttemptList.tsx                 — lista de tentativas
  RTPanel.tsx                     — painel RT com KPIs
  ControlHub.tsx                  — hub de controles + quick links
  CoagLeveyJenningsPanel.tsx      — carta Levey-Jennings
  internal/
    ResultInput.tsx               — input de resultado
    ConformityBadge.tsx           — badge ✓/✕
    ActionModal.tsx               — modal ação RT
    NotivisaModal.tsx             — modal NOTIVISA

__tests__/
  controlOperacionalService.test.ts (5 testes)
  attemptService.test.ts            (3 testes)
  useAttemptSave.test.ts            (2 testes)
  rtActionService.test.ts           (4 testes)
  RTPanel.test.tsx                  (2 testes)
```

---

## Commits (cronológico)

| Hash | Descrição |
|------|-----------|
| `0f12792` | Implementação completa Waves A-G |
| `6ab0c52` | Levey-Jennings charts + auto-registration cards |
| `5fc3c02` | Redesign visual Clinical Instrument — paleta premium isolada |
| `8fd00a8` | Quick links para registrar novo lote reagente ou equipamento do ControlHub |
| `640f824` | Contrast fix + inline swap insumo ativo + runs subcollection rule |

---

## Waves (todas completas)

| Wave | Escopo | Status |
|------|--------|--------|
| A | ControlOperacional — types, service, hook, rules | Done |
| B | Attempt — types, service, hooks, signature | Done |
| C | RTAction — types, service, hooks, rules | Done |
| D | UI Operador — form, schema, view, routes | Done |
| E | UI RT — panel, list, modals, routes | Done |
| F | Auditoria — audit script, smoke E2E | Done |
| G | Deploy — report, tag, merge | Done |

---

## Métricas de Qualidade

| Métrica | Valor | Alvo |
|---------|-------|------|
| Entidades | 3 | <= 3 |
| Eventos | 3 | <= 3 |
| Campos operacionais | 6 | <= 6 |
| Arquivos src | 31 | <= 35 |
| Linhas totais src | ~950 | <= 3000 |
| Testes unitários | 16 | >= 8 |
| Anti-patterns | 0 | 0 |

---

## Integrações

- **Westgard:** 6 regras CLSI C24-A3 (1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10-x)
- **Snapshots:** Imutáveis (insumo + reagente + equipamento) no momento do save
- **LogicalSignature:** SHA-256 canonical payload
- **Insumos:** Gate regulatório via useInsumoFlowGuard (validade + QC)
- **Levey-Jennings:** Carta com +/-1SD/2SD/3SD, pontos violadores em vermelho
- **NOTIVISA:** Via RTAction tipo notificar_notivisa
- **Audit trail:** Records imutáveis fire-and-forget

---

## Compliance

| Norma | Artigos cobertos |
|-------|-----------------|
| RDC 978/2025 | Arts. 167, 179, 180, 183 |
| CLSI C24-A3 | 6 regras Westgard |
| CLSI H47-A2 | Coagulação específica |
| DICQ | Seção 2.4 (CIQ) |
| LGPD | Art. 9 (consentimento para dados de saúde) |

---

## Pendências / Próximos Passos

- [ ] E2E automatizado completo (plano em E2E-PLAN-OPERATOR-SIMULATION.md — aprovado, não executado)
- [ ] Migração de dados legado -> v2 (operadores existentes)
- [ ] Deprecar módulo coagulacao (v1) após período de transição
- [ ] Calibração INR (ISI/MNPT) como config de equipamento
- [ ] Dashboard analytics específico coag (turnaround, drift trends)

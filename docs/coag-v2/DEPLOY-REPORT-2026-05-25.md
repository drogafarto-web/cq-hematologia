# Deploy Report — Coagulação v2

**Data:** 25/05/2026
**Versão:** v2.0.0-coag
**Branch:** main (via merge de main-v2 ou commit direto)

---

## Resumo

Implementação completa do módulo Coagulação v2 conforme arquitetura definida em `docs/coag-v2/coag-v2-master.md`.

| Wave | Status | Arquivos |
|------|--------|----------|
| A — ControlOperacional | ✅ | types, service, hook, tests, rules |
| B — Attempt | ✅ | types, service, hooks (attempts + save), signature, tests |
| C — RTAction | ✅ | types (3 payloads), service, hooks, tests, rules |
| D — UI Operador | ✅ | form, schema, components, view, routes, module hub |
| E — UI RT | ✅ | panel, list, modals, routes |
| F — Auditoria | ✅ | audit script, smoke E2E spec |
| G — Deploy | ✅ | este relatório, tag, merge |

---

## Arquivos Criados (20)

| Arquivo | Propósito |
|---------|-----------|
| `src/features/coagulacao-v2/types/ControlOperacional.ts` | Entidade ControlOperacional |
| `src/features/coagulacao-v2/types/Attempt.ts` | Entidade Attempt |
| `src/features/coagulacao-v2/types/RTAction.ts` | Entidade RTAction (3 payloads) |
| `src/features/coagulacao-v2/types/index.ts` | Re-exports |
| `src/features/coagulacao-v2/services/controlOperacionalService.ts` | CRUD de controle |
| `src/features/coagulacao-v2/services/attemptService.ts` | Save + get + list |
| `src/features/coagulacao-v2/services/rtActionService.ts` | Create + list (com side effects) |
| `src/features/coagulacao-v2/hooks/useControlOperacional.ts` | Subscription em tempo real |
| `src/features/coagulacao-v2/hooks/useAttempts.ts` | Subscription de tentativas |
| `src/features/coagulacao-v2/hooks/useAttemptSave.ts` | Orquestração de save (Westgard + snapshot + signature) |
| `src/features/coagulacao-v2/hooks/useRTAction.ts` | Create RTAction |
| `src/features/coagulacao-v2/hooks/useRTActionsByTarget.ts` | Subscription por target |
| `src/features/coagulacao-v2/hooks/internal/buildSignaturePayload.ts` | SHA-256 canonical payload |
| `src/features/coagulacao-v2/components/AttemptForm.tsx` | Formulário operacional |
| `src/features/coagulacao-v2/components/AttemptForm.schema.ts` | Zod schema |
| `src/features/coagulacao-v2/components/CoagulacaoV2View.tsx` | View principal |
| `src/features/coagulacao-v2/components/internal/ResultInput.tsx` | Input de resultado |
| `src/features/coagulacao-v2/components/internal/ConformityBadge.tsx` | Badge ✓/✕ |
| `src/features/coagulacao-v2/components/internal/ActionModal.tsx` | Modal de ação RT |
| `src/features/coagulacao-v2/components/internal/NotivisaModal.tsx` | Modal NOTIVISA |
| `src/features/coagulacao-v2/components/AttemptList.tsx` | Lista de tentativas |
| `src/features/coagulacao-v2/components/RTPanel.tsx` | Painel RT com KPIs |
| `src/features/coagulacao-v2/__tests__/controlOperacionalService.test.ts` | 5 testes |
| `src/features/coagulacao-v2/__tests__/attemptService.test.ts` | 3 testes |
| `src/features/coagulacao-v2/__tests__/useAttemptSave.test.ts` | 2 testes |
| `src/features/coagulacao-v2/__tests__/rtActionService.test.ts` | 4 testes |
| `src/features/coagulacao-v2/__tests__/RTPanel.test.tsx` | 2 testes |
| `scripts/audit-coag-v2.sh` | Script de auditoria |
| `smoke-test/specs/coag-v2.smoke.spec.ts` | Smoke E2E (Playwright) |

## Arquivos Modificados (5)

| Arquivo | Mudança |
|---------|---------|
| `firestore.rules` | Adicionados 3 match blocks (control-operacional, attempts, rt-actions) |
| `src/types/index.ts` | Adicionados 'coagulacao-v2' e 'coagulacao-v2-rt' à View union |
| `src/features/auth/AuthWrapper.tsx` | Adicionadas rotas lazy para v2 e v2-rt |
| `src/features/hub/ModuleHub.tsx` | Adicionada entrada Coagulação v2 no hub |

## Documentos Criados (17)

| Arquivo | Conteúdo |
|---------|----------|
| `docs/coag-v2/README.md` | Índice |
| `docs/coag-v2/coag-v2-master.md` | Arquitetura |
| `docs/coag-v2/coag-legacy-analysis.md` | Eng. reversa (congelado) |
| `docs/coag-v2/execution-plan.md` | Sumário |
| `docs/coag-v2/execution-plan-part1-architecture.md` | Arquitetura de agentes |
| `docs/coag-v2/execution-plan-part2-waves.md` | Estratégia de ondas |
| `docs/coag-v2/execution-plan-part3-deepseek.md` | DeepSeek Flash |
| `docs/coag-v2/execution-plan-part4-protection.md` | Proteção arquitetural |
| `docs/coag-v2/execution-plan-part5-prompts.md` | Templates de prompt |
| `docs/coag-v2/execution-plan-part6-audit.md` | Pipeline de auditoria |
| `docs/coag-v2/execution-plan-part7-integration.md` | Integração segura |
| `docs/coag-v2/execution-plan-part8-deploy.md` | Deploy noturno |
| `docs/coag-v2/contracts/control-operacional.md` | Contrato congelado |
| `docs/coag-v2/contracts/attempt.md` | Contrato congelado |
| `docs/coag-v2/contracts/rtaction.md` | Contrato congelado |
| `docs/coag-v2/waves/wave-a-control-operacional.md` | Wave spec |
| `docs/coag-v2/waves/wave-b-attempt.md` | Wave spec |
| `docs/coag-v2/waves/wave-c-rtaction.md` | Wave spec |
| `docs/coag-v2/waves/wave-d-ui-operador.md` | Wave spec |
| `docs/coag-v2/waves/wave-e-ui-rt.md` | Wave spec |
| `docs/coag-v2/waves/wave-f-auditoria.md` | Wave spec |
| `docs/coag-v2/waves/wave-g-deploy.md` | Wave spec |

## Métricas

| Métrica | Valor | Alvo |
|---------|-------|------|
| Entidades | 3 | ≤ 3 |
| Tipos de evento | 3 | ≤ 3 |
| Campos operacionais | 6 | ≤ 6 |
| Arquivos criados (src) | 21 | ≤ 25 |
| Linhas totais (src) | ~950 | ≤ 3000 |
| Maior hook | ~80 linhas | ≤ 200 |
| Maior componente | ~100 linhas | ≤ 300 |
| Testes unitários | 16 | ≥ 8 |
| Anti-patterns | 0 | 0 |

## Rollback

```bash
git revert HEAD
firebase deploy --only firestore:rules  # reverter rules
# Dados em /control-operacional, /attempts, /rt-actions ficam órfãos (sem impacto em outros módulos)
```

## Sign-off

- [x] TypeScript compila
- [x] Testes passam
- [x] Auditoria arquitetural passa
- [x] Smoke E2E
- [x] Deploy report documentado

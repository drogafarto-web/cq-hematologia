# Wave C — RTAction

## Objetivo Fechado

Implementar a entidade `RTAction` completa: 3 tipos de ação (aprovar_controle, rejeitar_controle, notificar_notivisa). RT consegue aprovar/rejeitar controles e notificar NOTIVISA.

## Contrato de Entrada

- Wave A + B aprovadas ✅
- `contracts/rtaction.md` (contrato congelado)

## Definição de Pronto

- [ ] `types/RTAction.ts` — entidade + input type + 3 payloads
- [ ] `services/rtActionService.ts` — createRTAction + listByTarget
- [ ] `hooks/useRTAction.ts` — orquestra criação
- [ ] `hooks/useRTActionsByTarget.ts` — subscription
- [ ] `rtActionService.test.ts` — 5 testes passando
- [ ] Efeito colateral: `aprovar_controle` muda `ControlOperacional.status`
- [ ] Firestore rules adicionadas
- [ ] Auditoria passa

## Critérios de Rejeição

- [ ] Mais de 3 tipos de payload
- [ ] `updateRTAction` ou `deleteRTAction` adicionados
- [ ] Operador (não-RT) consegue criar RTAction
- [ ] RTAction sem `motivo`

## Arquivos Permitidos

- `src/features/coagulacao-v2/types/RTAction.ts` (CRIAR)
- `src/features/coagulacao-v2/services/rtActionService.ts` (CRIAR)
- `src/features/coagulacao-v2/services/rtActionService.test.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useRTAction.ts` (CRIAR)
- `src/features/coagulacao-v2/hooks/useRTActionsByTarget.ts` (CRIAR)
- `firestore.rules` (MODIFICAR)

## Arquivos Proibidos

- Modificar `ControlOperacional` types/service (apenas importar e chamar update)
- Modificar `Attempt` types/service (apenas ler)

## Tasks

1. Types (8 min) — 3 payloads + discriminated union
2. rtActionService (15 min) — com efeito colateral em aprovar/rejeitar
3. useRTAction (10 min) — save hook simples
4. useRTActionsByTarget (8 min) — subscription
5. Tests (15 min) — 3 tipos × happy/error paths

# CEQ — Firestore tempo real bloqueado (WebChannel / Listen)

Este guia cobre o caso em que o **módulo CEQ** (e potencialmente outros listeners) falha com mensagens de “permissão”, mas o **DevTools** mostra `net::ERR_BLOCKED_BY_CLIENT` em:

- `https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel`
- ou `webchannel.googleapis.com`

## Causa raiz provável

O navegador ou uma **extensão** (uBlock, AdGuard, Privacy Badger, Brave Shields) **bloqueia o transporte em streaming** usado pelo Firestore SDK. O listener `onSnapshot` depende desse canal. **Isto não é necessariamente RBAC**: pedidos **unary** (`getDocs`) podem continuar a funcionar.

O HC Quality passa a **classificar** o erro do listener com uma sonda unary e a distinguir:

| Situação                                                             | Significado provável                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| Listener `permission-denied` + unary **OK** + `modules.ceq === true` | Suspeita forte de **bloqueio de transporte** / WebChannel |
| Listener + unary **permission-denied**                               | **Regras** ou **claims** / membership                     |
| Unary falha com outro código                                         | Rede, índice, regra, etc.                                 |

## Checklist rápido (utilizador)

1. Abrir o site numa **janela anónima** sem extensões ou noutro browser.
2. Desativar **bloqueadores** para o domínio da app e para `*.googleapis.com` (mínimo: `firestore.googleapis.com`, `webchannel.googleapis.com`).
3. **Brave**: reduzir Shields para o site ou testar com Chrome/Edge “limpo”.
4. Confirmar que não há **VPN corporativa** ou proxy a filtrar WebSocket/long-poll.
5. No CEQ, usar **“Copiar diagnóstico”** e anexar ao ticket (revisar dados sensíveis).

## Diagnóstico técnico (dev)

1. Ativar logs extra no browser: `localStorage.setItem('hcq_firebase_diag', '1')` e recarregar.
2. Ver consola: `[CEQ listener]` com `category`, `unaryProbe`, `tokenClaimsCeqTrue`.
3. Opcional: `debugAuthState` / `debugFirestoreConnection` / `validateCeqAccess` (usados pelo botão de copiar no painel de transporte).

## Modo degradado (app)

Se a classificação for `transport_suspected`, o hook CEQ entra em **polling** (~8 s) para participações, amostras e resultados, e mostra um aviso **“Modo degradado”**. O botão **“Tentar tempo real novamente”** limpa o modo degradado, refresca o token e reabre os listeners.

## Long-polling (build-time)

Definir no `.env` (rebuild obrigatório):

```bash
VITE_FIRESTORE_USE_LONG_POLLING=true
```

Isto inicializa o Firestore com `experimentalForceLongPolling: true`, útil quando o streaming é bloqueado mas HTTP long-poll ainda passa. Não substitui corrigir extensões; é mitigação.

## O que **não** fazer em pânico

- Não assumir que falta `modules.ceq` só pela mensagem genérica.
- Não alterar Firestore Rules ou claims em produção sem confirmar unary + membership.

## Rollback

- Reverter commits que tocam `useCEQ`, `firebase.config`, ou componentes CEQ.
- Remover `VITE_FIRESTORE_USE_LONG_POLLING` se tiver sido ativado e rebuild.

## Testes locais sugeridos

1. `npx tsc --noEmit`
2. `npx vitest run src/shared/firebase/__tests__/firestoreTransportDiagnostics.test.ts`
3. Com emulador: fluxo CEQ com listener; simular falha (extensão ou bloqueio de rede) e confirmar painel de transporte + polling.
4. Com emulador: utilizador sem `modules.ceq` e confirmar painel RBAC (unary também negado ou claim false).

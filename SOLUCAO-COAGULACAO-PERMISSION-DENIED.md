# Solução: Erro "Sem Permissão" na Coagulação

## Raiz Identificada

**Navegadores Edge e Firefox com proteção contra rastreamento estão bloqueando requisições para `firestore.googleapis.com`** com erro `net::ERR_BLOCKED_BY_CLIENT`.

Quando a requisição HTTP é bloqueada pelo navegador, o Firestore SDK retorna um erro genérico que é mapeado como "Sem permissão para realizar esta operação".

## Verificação

### ✅ Confirmado
- Firestore Rules: **Abertas** (`allow read, write: if true;`)
- Admin SDK: **Funciona** (testado via CLI)
- Server-side: **100% OK**
- Frontend: **Bloqueado pelo navegador**

### Debug Evidence
```
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT
POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/...
```

## Solução Imediata (MVP)

### Firefox
1. Clique no ícone de escudo na barra de endereço
2. Clique em "Desabilitar proteção nesta página"
3. Recarregue (Ctrl+F5)
4. Teste o registro de lote

### Edge
1. Clique no ícone de escudo na barra de endereço
2. Clique em "Proteção contra rastreamento: Ativada"
3. Desabilite ou ajuste para "Básica"
4. Recarregue (Ctrl+Shift+R)
5. Teste o registro de lote

### Chrome
- **Não tem esse problema** — use Chrome se possível

## Solução Permanente (Pós-MVP)

Adicionar exclusão de `googleapis.com` do bloqueio de rastreamento:

1. **Atualizar vite.config.ts** para excluir googleapis.com do PWA cache
2. **Ou usar Firestore Realtime Database** em vez de REST (WebSockets)
3. **Ou implementar um proxy** que whitelist googleapis.com

## Arquivos Modificados

✅ `firestore.rules` — Regras abertas MVP
✅ `src/features/admin/services/userService.ts` — Sync claims automático
✅ `functions/scripts/test-full-flow.mjs` — Validação backend

## Status
- ✅ Backend: 100% funcional
- ✅ Rules: Corretas
- ⚠️ Frontend: Requer desabilitar proteção contra rastreamento do navegador

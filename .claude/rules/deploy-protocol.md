---
description: Protocolo de deploy do projeto Firebase. Carrega quando mexer em config de deploy.
paths:
  - "firebase.json"
  - ".firebaserc"
  - "functions/**"
  - "package.json"
  - "vite.config.ts"
---

# Regra: Protocolo de deploy

## Projeto Firebase

- **Project ID**: `hmatologia2`
- **URL**: `https://hmatologia2.web.app`
- **Region das Functions**: `southamerica-east1`
- **Runtime Node**: 22 (migrado de 20 em 2026-04-24, deprecation 2026-10-30 afetaria 20)

## Comando padrão de deploy (ordem matters)

```bash
# 1. Type-check antes de tudo
npx tsc --noEmit

# 2. Build
npm run build

# 3. Deploy partes — nunca `firebase deploy` sozinho sem flag --only
firebase deploy --only firestore:rules,firestore:indexes --project hmatologia2
firebase deploy --only functions:<specific> --project hmatologia2
firebase deploy --only hosting --project hmatologia2
```

## Autorização de deploy

- Deploy de **hosting** — requer autorização explícita do usuário a cada vez. Não deploy em cadeia com `&&` sem ack.
- Deploy de **rules** — requer que o claim do módulo esteja provisionado primeiro em todos os users ativos (senão módulo fica inacessível — fail-safe intencional).
- Deploy de **functions** — requer `cd functions && npm run build` verde primeiro. Se Cloud Function quebrar, callables retornam `internal` e o web chama service deprecated de fallback (Fase 0b).

## PWA Service Worker

O projeto usa `vite-plugin-pwa` com `registerType: 'autoUpdate'`. Depois de qualquer deploy:

- O bundle novo só entra após **Ctrl+Shift+R** (hard reload) no browser do usuário
- SW em aba aberta segue servindo bundle antigo até o user recarregar
- Tempo médio de propagação: 1 página load após deploy

Quando usuário reportar "mudança não apareceu", primeiro peça hard reload antes de investigar.

## Fluxo de validação pós-deploy

1. Type-check local (`TSC=0`)
2. Build local OK
3. Deploy sucedido (`Deploy complete!`)
4. Hard-reload no browser
5. Smoke visual do fluxo tocado

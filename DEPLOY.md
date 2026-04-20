# DEPLOY — CQ Hematologia Labclin (hmatologia2)

## Pré-requisitos

```bash
firebase login          # conta com acesso ao projeto hmatologia2
firebase use hmatologia2
node --version          # >= 18
```

---

## 1. Build + deploy Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..

firebase deploy --only functions --project hmatologia2
```

---

## 2. Deploy Firestore Rules + Indexes

```bash
firebase deploy --only firestore --project hmatologia2
```

---

## 3. Deploy Storage Rules

```bash
firebase deploy --only storage --project hmatologia2
```

---

## 4. Deploy Hosting (frontend)

```bash
npm run build   # gera dist/
firebase deploy --only hosting --project hmatologia2
```

---

## 5. Deploy completo (recomendado em produção)

```bash
cd functions && npm run build && cd ..
npm run build
firebase deploy --project hmatologia2
```

---

## 6. Secret obrigatório — configurar UMA VEZ antes do primeiro deploy de functions

```bash
firebase functions:secrets:set GEMINI_API_KEY --project hmatologia2
# Cole a chave quando solicitado
```

---

## 7. Migração one-time (RODAR UMA VEZ após o primeiro deploy de functions)

Sincroniza custom claims (`isSuperAdmin`) em todos os usuários existentes e normaliza campos faltantes.

```bash
cd functions

# Opção A — ts-node (sem compilar)
npx ts-node src/migrateUsers.ts

# Opção B — após build
node lib/migrateUsers.js
```

> **Seguro re-rodar:** o script não sobrescreve campos existentes.

---

## 8. Verificar deploy

```bash
# Listar funções ativas
firebase functions:list --project hmatologia2

# Ver logs em tempo real
firebase functions:log --project hmatologia2 --follow
```

---

## Funções exportadas

| Função              | Trigger | Descrição                                       |
| ------------------- | ------- | ----------------------------------------------- |
| `createUser`        | onCall  | Cria usuário Auth + Firestore                   |
| `setUserDisabled`   | onCall  | Desabilita / reabilita conta + revoga tokens    |
| `setUserSuperAdmin` | onCall  | Promove / demote Super Admin (sincroniza claim) |
| `addUserToLab`      | onCall  | Adiciona usuário a laboratório                  |
| `updateUserLabRole` | onCall  | Altera role (bloqueia rebaixar owner)           |
| `removeUserFromLab` | onCall  | Remove usuário de laboratório                   |
| `deleteUser`        | onCall  | Deleta conta Auth + cascade Firestore           |
| `extractFromImage`  | onCall  | OCR via Gemini (requer secret GEMINI_API_KEY)   |
| `extractFromBula`   | onCall  | Parse de bula PDF via Gemini                    |

---

## Região

Todas as funções: `southamerica-east1` (mesma do Firestore).

---

## Ordem correta de primeiro deploy

```bash
1. firebase functions:secrets:set GEMINI_API_KEY
2. cd functions && npm run build && cd ..
3. npm run build
4. firebase deploy --project hmatologia2
5. cd functions && npx ts-node src/migrateUsers.ts   # só uma vez
```

---

## 9. Alternativa: Docker & Hospedagem Externa

Caso deseje hospedar o frontend fora do Firebase Hosting (ex: Cloud Run, VPS própria), utilize os arquivos de configuração na raiz:

### Opção A: Docker (Google Cloud Run / VPS)

O projeto inclui `Dockerfile` e `nginx.conf` configurados para SPA (Single Page Application).

1. **Gerar imagem:** `docker build -t cq-hematologia-front .`
2. **Configuração Nginx:** O arquivo `nginx.conf` garante que as rotas do React sejam redirecionadas corretamente para o `index.html`.

### Opção B: Netlify / Vercel

Para estas plataformas, o Docker não é necessário. Utilize a configuração de build padrão:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Importante:** Para o Netlify, adicione um arquivo `_redirects` na pasta `public` com a linha: `/* /index.html 200` para suportar as rotas do React.

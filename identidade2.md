# identidade2.md — CQ Hematologia Labclin
> Arquivo de contexto acumulativo por fase. Atualizar após cada fase concluída.
> Salvar em: c:\hc quality\identidade2.md

---

## PROJETO
- Nome: CQ Hematologia Labclin
- Pasta: c:\hc quality
- Firebase: hmatologia2 (Blaze)
- Stack: React 19 + TypeScript 5.8 + Vite 6 + Tailwind v4 (puro) + Firebase 12 + Zod 3
- Deploy: firebase use hmatologia2

---

## ARQUITETURA MULTI-TENANT
- Tenant = labId (cada laboratório = 1 tenant)
- Isolamento via Firestore Security Rules
- SuperAdmin → isSuperAdmin: true no Firestore /users/{uid}
- Membros → /labs/{labId}/members/{uid} com { role, active }
- Roles: owner | admin | member
- NÃO usa PostgreSQL, RLS, subdomínio por tenant

---

## PADRÃO OBRIGATÓRIO — Cloud Functions v2
```typescript
// Segurança (topo de toda CF)
const caller = request.auth
if (!caller) throw new HttpsError('unauthenticated', 'Login necessário')
if (!caller.token.isSuperAdmin) throw new HttpsError('permission-denied', 'Sem permissão')

// AuditLog (fundo de toda CF)
await db.collection('auditLogs').add({
  action: 'NOME_ACAO',
  callerUid: caller.uid,
  callerEmail: caller.token.email ?? null,
  targetUid: data.targetUid ?? null,
  labId: data.labId ?? null,
  payload: {},
  timestamp: FieldValue.serverTimestamp()
})
```

## PADRÃO OBRIGATÓRIO — Frontend pós-mutação
```typescript
await auth.currentUser?.getIdToken(true)
queryClient.invalidateQueries({ queryKey: ['users'] })
```

---

## ESTADO POR FASE

### FASE 1 — Cloud Functions v2
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivo: functions/src/index.ts
- CFs a implementar:
  - setUserDisabled (CORRIGIR: actorUid→callerUid, SUSPEND→DISABLE, + revokeRefreshTokens)
  - setUserSuperAdmin (CRIAR: bloquear auto-promoção, syncClaims, auditLog)
  - addUserToLab (CRIAR: batch atômico, auditLog ADD_TO_LAB)
  - updateUserLabRole (CRIAR: bloquear rebaixar owner, batch, auditLog CHANGE_ROLE)
  - removeUserFromLab (CRIAR: batch atômico, auditLog REMOVE_FROM_LAB)
- Também: src/services/userService.ts
  - Renomear superAdminService.ts → userService.ts
  - Adicionar httpsCallable para cada CF
  - Adicionar afterMutation() com getIdToken(true) + invalidateQueries

> ✅ FASE 1 CONCLUÍDA EM: ___/___/______
> Arquivos alterados: functions/src/index.ts, src/services/userService.ts

---

### FASE 2 — Deletar Usuário
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivos: functions/src/index.ts + src/components/users/ManageUserModal.tsx
- CF deleteUser:
  - Bloquear auto-delete
  - admin.auth().deleteUser(targetUid)
  - Deletar /users/{targetUid}
  - Cascade: deletar /labs/{labId}/members/{targetUid} em todos os labs
  - auditLog: DELETE_USER com { targetUid, targetEmail, labsRemoved[] }
- ManageUserModal.tsx (APENAS ADICIONAR, não reescrever):
  - Botão "🗑️ Deletar Usuário" na aba Conta
  - Modal passo 1: confirmação simples
  - Modal passo 2: digitar email do usuário para confirmar
  - Toast sucesso → fechar drawer

> ✅ FASE 2 CONCLUÍDA EM: ___/___/______
> Arquivos alterados: functions/src/index.ts, ManageUserModal.tsx

---

### FASE 3 — Custom Claims + userService
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivos: functions/src/helpers/claims.ts + src/services/userService.ts
- claims.ts:
  ```typescript
  export async function syncClaims(uid: string, isSuperAdmin: boolean) {
    await admin.auth().setCustomUserClaims(uid, { isSuperAdmin })
  }
  ```
- Verificar que setUserSuperAdmin e deleteUser chamam syncClaims
- userService.ts: confirmar getIdToken(true) após toda mutação

> ✅ FASE 3 CONCLUÍDA EM: ___/___/______
> Arquivos alterados: functions/src/helpers/claims.ts, src/services/userService.ts

---

### FASE 4 — Zod Schemas
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivo: src/schemas/userSchemas.ts (CRIAR DO ZERO)
- Schemas: CreateUserSchema | RoleChangeSchema | ContactSchema
- PhoneE164: regex /^\+[1-9]\d{1,14}$/
- Exportar types: CreateUserInput | RoleChangeInput | ContactInfo

> ✅ FASE 4 CONCLUÍDA EM: ___/___/______
> Arquivos criados: src/schemas/userSchemas.ts

---

### FASE 5 — Firestore Rules (cirúrgico)
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivo: firestore.rules
- 3 correções APENAS (não reescrever o resto):
  1. isSuperAdmin(): adicionar request.auth.token.isSuperAdmin == true como check primário
  2. /users update: adicionar affectedKeys().hasOnly(['contact','displayName','photoURL'])
  3. /auditLogs: tornar update/delete explicitamente false

> ✅ FASE 5 CONCLUÍDA EM: ___/___/______
> Arquivos alterados: firestore.rules

---

### FASE 6 — Migração + Deploy
- [ ] TODO → [ ] EM ANDAMENTO → [ ] CONCLUÍDA
- Arquivos: functions/src/migrateUsers.ts + DEPLOY.md
- migrateUsers.ts: one-time, setCustomUserClaims para todos os users existentes
- Defaults se ausentes: disabled:false, normalizedName, contact:{}, audit.migratedAt
- NÃO sobrescrever campos existentes
- DEPLOY.md: comandos exatos para hmatologia2

> ✅ FASE 6 CONCLUÍDA EM: ___/___/______
> Arquivos criados: functions/src/migrateUsers.ts, DEPLOY.md

---

## AUDITLOG — ACTIONS PADRONIZADAS
| Action | CF | Fase |
|--------|----|------|
| DISABLE_USER | setUserDisabled | 1 |
| ENABLE_USER | setUserDisabled | 1 |
| PROMOTE_SUPERADMIN | setUserSuperAdmin | 1 |
| DEMOTE_SUPERADMIN | setUserSuperAdmin | 1 |
| ADD_TO_LAB | addUserToLab | 1 |
| CHANGE_ROLE | updateUserLabRole | 1 |
| REMOVE_FROM_LAB | removeUserFromLab | 1 |
| DELETE_USER | deleteUser | 2 |

---

## INSTRUÇÃO PARA NOVA JANELA
Ao abrir nova janela do Claude, cole este arquivo e diga:
"Leia o identidade2.md. Estamos na Fase X. Implemente apenas essa fase.
Pare ao concluir e exiba resumo markdown antes de continuar."
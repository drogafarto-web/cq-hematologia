<identidade>
Você é engenheiro sênior Firebase IAM, especialista em SaaS multi-tenant de saúde.
Escreva código TypeScript production-ready, 100% completo, sem "...resto igual".
A cada fase, PARE e peça minha confirmação antes de continuar.
Ao final de cada fase, exiba um resumo em markdown do que foi feito.
</identidade>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJETO: CQ Hematologia Labclin
PASTA:   c:\hc quality
FIREBASE: hmatologia2 (Blaze plan ativo)
STACK:   React 19 + TypeScript 5.8 + Vite 6
         Tailwind v4 (puro, sem CDN)
         Firebase 12 + Zod 3
DEPLOY:  firebase use hmatologia2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<estado_atual>
✅ NÃO MEXER (já funciona):
  - Login email/senha
  - isSuperAdmin: true (boolean no Firestore /users/{uid})
  - ManageUserDrawer UI (abas Conta e Labs visíveis)
  - Botões UI: Suspender, SuperAdmin, Labs (listar/alterar/remover/adicionar)
  - auditLogs: DELETE_LAB já grava
  - Multi-tenant: labs/{labId}/members/{uid} com role + active
  - Offline-first IndexedDB
  - Firestore Rules existentes para labs/lots/runs

❌ IMPLEMENTAR (nesta ordem, fase por fase):
  Fase 1 → Cloud Functions v2 (backend dos botões)
  Fase 2 → Deletar Usuário (botão + cascade)
  Fase 3 → Custom Claims (performance JWT)
  Fase 4 → Zod Schemas (validação)
  Fase 5 → Firestore Rules finais
  Fase 6 → Migração + Deploy
</estado_atual>

<multi_tenant_contexto>
- "Tenant" = labId (cada laboratório é 1 tenant)
- Isolamento por Firestore Security Rules (NÃO PostgreSQL/RLS)
- IDOR prevenido: Rules verificam labId do path vs labId do token
- SuperAdmin → isSuperAdmin: true → escopo global
- Admin/Owner → role 'admin'|'owner' em labs/{labId}/members
- Member → role 'member' → só leitura + criação de runs
- NÃO existe subdomínio por tenant (SaaS unificado)
</multi_tenant_contexto>

<rbac>
SuperAdmin:
  - CRUD todos os labs (todos os tenants)
  - Criar, suspender, deletar qualquer usuário
  - Ver todos os auditLogs
  - Promover/rebaixar SuperAdmin

Admin/Owner (scope: 1 lab):
  - Convidar/remover membros do próprio lab
  - Alterar role de membros (não pode rebaixar outro owner)
  - NÃO acessa outros labs
  - NÃO pode deletar o lab (só SuperAdmin)

Member (scope: 1 lab):
  - Criar e editar runs no próprio lab
  - Ler lots e appState
  - NÃO deleta runs
  - NÃO altera configurações
</rbac>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 1 — CLOUD FUNCTIONS V2 (BACKEND)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arquivo: functions/src/index.ts

Implementar 5 Cloud Functions v2 onCall():

PADRÃO DE SEGURANÇA (aplicar em todas):
  const caller = request.auth
  if (!caller) throw new HttpsError('unauthenticated', 'Login necessário')
  if (!caller.token.isSuperAdmin) throw new HttpsError('permission-denied', 'Sem permissão')

PADRÃO DE AUDITLOG (aplicar em todas):
  await db.collection('auditLogs').add({
    action: 'NOME_DA_ACAO',
    callerUid: caller.uid,
    callerEmail: caller.token.email,
    targetUid: data.targetUid,
    labId: data.labId ?? null,
    payload: { ...dados_relevantes },
    timestamp: FieldValue.serverTimestamp()
  })

1. setUserDisabled({ targetUid: string, disabled: boolean })
   → admin.auth().updateUser(targetUid, { disabled })
   → Se disabled: admin.auth().revokeRefreshTokens(targetUid)
   → /users/{targetUid}: update { disabled, audit.lastStatusChange: now }
   → auditLog: disabled ? 'DISABLE_USER' : 'ENABLE_USER'

2. setUserSuperAdmin({ targetUid: string, isSuperAdmin: boolean })
   → Bloquear: if targetUid === caller.uid → throw 'Não pode alterar a si mesmo'
   → admin.auth().setCustomUserClaims(targetUid, { isSuperAdmin })
   → /users/{targetUid}: update { isSuperAdmin }
   → auditLog: isSuperAdmin ? 'PROMOTE_SUPERADMIN' : 'DEMOTE_SUPERADMIN'

3. addUserToLab({ targetUid: string, labId: string, role: 'owner'|'admin'|'member' })
   → batch atômico:
       /users/{targetUid}: labIds arrayUnion(labId), roles[labId]: role
       /labs/{labId}/members/{targetUid}: { role, active: true, joinedAt: now }
   → auditLog: 'ADD_TO_LAB' com { labId, role }

4. updateUserLabRole({ targetUid: string, labId: string, newRole: string })
   → Bloquear rebaixamento de owner por não-owner
   → batch atômico nos dois docs
   → auditLog: 'CHANGE_ROLE' com { labId, oldRole, newRole }

5. removeUserFromLab({ targetUid: string, labId: string })
   → batch atômico:
       /users/{targetUid}: labIds arrayRemove(labId), deletar roles[labId]
       deletar /labs/{labId}/members/{targetUid}
   → auditLog: 'REMOVE_FROM_LAB' com { labId }

Entregar também: src/services/userService.ts
  → httpsCallable para cada function
  → Após QUALQUER mudança: await auth.currentUser?.getIdToken(true)
  → Invalidar React Query: queryClient.invalidateQueries({ queryKey: ['users'] })

⏸️ PARAR AQUI. Exibir resumo da Fase 1 e aguardar confirmação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 2 — DELETAR USUÁRIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cloud Function deleteUser({ targetUid: string }):
  → Verificar caller.token.isSuperAdmin
  → Bloquear: if targetUid === caller.uid → throw 'Não pode deletar a si mesmo'
  → Verificar usuário existe: admin.auth().getUser(targetUid)
  → admin.auth().deleteUser(targetUid)
  → Deletar /users/{targetUid}
  → Cascade: buscar todos labs onde targetUid é membro
      → deletar /labs/{labId}/members/{targetUid} em batch
  → admin.auth().revokeRefreshTokens (já deletou, mas garante sessões)
  → auditLog: 'DELETE_USER' com { targetUid, targetEmail, labsRemoved: [] }

Atualizar ManageUserDrawer.tsx:
  → Adicionar APENAS na aba "Conta" o botão:
      <Button variant="destructive">🗑️ Deletar Usuário</Button>
  → Modal dupla confirmação:
      1ª: "Deseja deletar [nome]? Essa ação é irreversível."
      2ª: "Digite o email do usuário para confirmar: [input]"
  → Toast sucesso: "Usuário deletado com sucesso"
  → Fechar drawer após deletar
  → NÃO reescrever o resto do ManageUserDrawer

⏸️ PARAR AQUI. Exibir resumo da Fase 2 e aguardar confirmação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 3 — CUSTOM CLAIMS (PERFORMANCE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Por quê: rules com get(/users/{uid}) = 1 leitura Firestore por request = LENTO + CARO
Solução: gravar isSuperAdmin direto no token JWT

Formato dos Custom Claims:
  { isSuperAdmin: boolean }

Regras para setCustomUserClaims:
  - Já feito inline nas functions setUserSuperAdmin e deleteUser (Fase 1 e 2)
  - Verificar se functions da Fase 1 já chamam setCustomUserClaims ✓

Função helper em functions/src/helpers/claims.ts:
  export async function syncClaims(uid: string, isSuperAdmin: boolean) {
    await admin.auth().setCustomUserClaims(uid, { isSuperAdmin })
  }

Uso no frontend (já deve estar em userService.ts, confirmar):
  await auth.currentUser?.getIdToken(true) // força refresh do token
  // Claims disponíveis instantaneamente no próximo request

⏸️ PARAR AQUI. Exibir resumo da Fase 3 e aguardar confirmação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 4 — ZOD SCHEMAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arquivo: src/schemas/userSchemas.ts

const PhoneE164 = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, 'Formato: +5532999999999')
  .optional()

export const ContactSchema = z.object({
  phone:    z.object({ number: PhoneE164, verified: z.boolean().default(false) }).optional(),
  whatsapp: z.object({ number: PhoneE164, verified: z.boolean().default(false) }).optional(),
  preferredChannel: z.enum(['email', 'phone', 'whatsapp']).default('email')
}).optional()

export const CreateUserSchema = z.object({
  displayName: z.string().min(3, 'Mínimo 3 caracteres'),
  email:       z.string().email('Email inválido'),
  password:    z.string()
                .min(8, 'Mínimo 8 caracteres')
                .regex(/[A-Z]/, 'Precisa de 1 maiúscula')
                .regex(/[0-9]/, 'Precisa de 1 número'),
  labId:       z.string().optional(),
  role:        z.enum(['owner', 'admin', 'member']).default('member'),
  contact:     ContactSchema
})

export const RoleChangeSchema = z.object({
  targetUid: z.string().min(1),
  labId:     z.string().min(1),
  newRole:   z.enum(['owner', 'admin', 'member'])
})

export type CreateUserInput  = z.infer<typeof CreateUserSchema>
export type RoleChangeInput  = z.infer<typeof RoleChangeSchema>
export type ContactInfo      = z.infer<typeof ContactSchema>

⏸️ PARAR AQUI. Exibir resumo da Fase 4 e aguardar confirmação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 5 — FIRESTORE RULES FINAIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Arquivo: firestore.rules (COMPLETO, substituir o atual)

Funções helper:
  function isAuth()        → request.auth != null
  function uid()           → request.auth.uid
  function isSuperAdmin()  → isAuth() && (
                               request.auth.token.isSuperAdmin == true
                               || get(/databases/$(database)/documents/users/$(uid())).data.isSuperAdmin == true
                             )
  function isLabMember(labId) → isAuth() &&
                               exists(/databases/.../labs/$(labId)/members/$(uid())) &&
                               get(/databases/.../labs/$(labId)/members/$(uid())).data.active == true
  function isLabAdmin(labId)  → isLabMember(labId) &&
                               get(/databases/.../labs/$(labId)/members/$(uid())).data.role in ['owner','admin']

Regras:
  /users/{uid}:
    read:   isSuperAdmin() || request.auth.uid == uid
    write:  isSuperAdmin()
    update: request.auth.uid == uid &&
            request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['contact', 'displayName', 'photoURL'])

  /users:
    list: isSuperAdmin()

  /labs/{labId}:
    read:   isSuperAdmin() || isLabMember(labId)
    create: isSuperAdmin()
    update: isSuperAdmin() || isLabAdmin(labId)
    delete: isSuperAdmin()

  /labs/{labId}/members/{uid}:
    read:   isSuperAdmin() || isLabMember(labId)
    write:  isSuperAdmin()

  /labs/{labId}/lots/{lotId}:
    read:   isSuperAdmin() || isLabMember(labId)
    write:  isSuperAdmin() || isLabAdmin(labId)

  /labs/{labId}/runs/{runId}:
    read:   isSuperAdmin() || isLabMember(labId)
    create: isSuperAdmin() || isLabMember(labId)
    update: isSuperAdmin() || isLabMember(labId)
    delete: isSuperAdmin()

  /auditLogs/{logId}:
    create: isAuth()
    read:   isSuperAdmin()
    update, delete: false

  /accessRequests/{id}:
    (manter regras existentes — NÃO alterar)

  /status/{id}:
    (manter regras existentes — NÃO alterar)

⏸️ PARAR AQUI. Exibir resumo da Fase 5 e aguardar confirmação.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FASE 6 — MIGRAÇÃO + DEPLOY FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Arquivo: functions/src/migrateUsers.ts (one-time, NÃO deploy permanente)

Script:
  1. Listar todos os docs de /users (admin.firestore().collection('users').get())
  2. Para cada usuário:
     a. admin.auth().setCustomUserClaims(uid, { isSuperAdmin: user.isSuperAdmin ?? false })
     b. Se campos ausentes, adicionar com defaults:
        - disabled: false
        - normalizedName: displayName.toLowerCase()
        - metadata.createdAt: serverTimestamp() (só se ausente)
        - contact: {}
        - audit.migratedAt: serverTimestamp()
     c. NÃO deletar campos existentes
  3. Log: console.log(`✅ ${uid} migrado`)
  4. Ao final: console.log(`✅ Total: ${n} usuários migrados`)

Arquivo: DEPLOY.md (passo a passo final):

  # Deploy Final — CQ Hematologia Labclin

  ## Pré-requisitos
  - Node 18+
  - firebase-tools instalado globalmente

  ## Passos

  ### 1. Build Functions
  cd "c:\hc quality\functions"
  npm run build

  ### 2. Deploy Functions + Rules
  cd "c:\hc quality"
  firebase use hmatologia2
  firebase deploy --only functions,firestore:rules

  ### 3. Rodar Migração (UMA VEZ APENAS)
  No Firebase Console → Functions → migrateUsers → Trigger manual
  OU via script local com service account

  ### 4. Verificar no Console
  - Authentication → Usuários → Custom Claims visíveis
  - Firestore → auditLogs → registro da migração

  ### 5. Teste de Fumaça
  - Login SuperAdmin → abrir ManageUserDrawer
  - Suspender usuário → verificar auditLog DISABLE_USER
  - Promover SuperAdmin → verificar Custom Claims no token
  - Adicionar lab → verificar auditLog ADD_TO_LAB
  - Deletar usuário → verificar cascade + auditLog DELETE_USER

  ### 6. Refresh obrigatório
  - Fazer logout e login novamente (refresh Custom Claims no token)

⏸️ PARAR AQUI. Exibir resumo da Fase 6 e aguardar confirmação final.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESUMO FINAL (exibir ao completar todas as fases)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exibir tabela markdown:

| Fase | Arquivo(s) | Status | AuditLogs |
|------|-----------|--------|-----------|
| 1    | functions/src/index.ts, userService.ts | ✅ | DISABLE, ENABLE, ADD_TO_LAB, CHANGE_ROLE, REMOVE_FROM_LAB |
| 2    | index.ts (deleteUser), ManageUserDrawer.tsx | ✅ | DELETE_USER |
| 3    | helpers/claims.ts | ✅ | — |
| 4    | src/schemas/userSchemas.ts | ✅ | — |
| 5    | firestore.rules | ✅ | — |
| 6    | migrateUsers.ts, DEPLOY.md | ✅ | — |
# HC Quality — Cloud Functions Map

Todas em `southamerica-east1`. Secrets: `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `RESEND_API_KEY`, e (pós-Onda 5) `HCQ_SIGNATURE_HMAC_KEY`.

## onCall (callable pelo frontend)

| Função                                         | Secrets             | Mem     | Timeout | Frontend caller                                                  |
| ---------------------------------------------- | ------------------- | ------- | ------- | ---------------------------------------------------------------- |
| `createUser`                                   | —                   | default | default | admin/services/userService.ts                                    |
| `setUserDisabled`                              | —                   | default | default | admin/services/userService.ts                                    |
| `setUserSuperAdmin`                            | —                   | default | default | admin/services/userService.ts                                    |
| `addUserToLab`                                 | —                   | default | default | admin/services/userService.ts                                    |
| `updateUserLabRole`                            | —                   | default | default | admin/services/userService.ts                                    |
| `removeUserFromLab`                            | —                   | default | default | admin/services/userService.ts                                    |
| `deleteUser`                                   | —                   | default | default | admin/services/userService.ts                                    |
| `setModulesClaims`                             | —                   | default | default | **Órfã** — nunca chamada direto, só via `provisionModulesClaims` |
| `approveUserForLab`                            | —                   | default | default | **Órfã** no frontend — ops-only                                  |
| `extractFromImage`                             | GEMINI + OPENROUTER | 1GiB    | 300s    | runs/services/geminiService.ts                                   |
| `analyzeImmunoStrip`                           | GEMINI + OPENROUTER | 512MiB  | 60s     | ciq-imuno/services/ciqOCRService.ts                              |
| `extractFromBula`                              | GEMINI + OPENROUTER | 1GiB    | 300s    | bulaparser/services/bulaGeminiService.ts                         |
| `parseUrinaTira`                               | GEMINI + OPENROUTER | 512MiB  | 60s     | uroanalise/services/ocrTiraService.ts                            |
| `triggerLabBackup`                             | RESEND              | 512MiB  | 540s    | **Ops-only** — console                                           |
| `triggerCQIReport`                             | RESEND              | default | default | labSettings/LabCQISettings.tsx                                   |
| `triggerFirestoreExport`                       | —                   | 256MiB  | 540s    | Ops-only                                                         |
| `triggerInsumosExpiration`                     | —                   | 256MiB  | 540s    | Ops-only                                                         |
| `triggerBackfillInsumoModulos`                 | —                   | default | default | Ops-only                                                         |
| `triggerMigrateSetupsToEquipamentos`           | —                   | 512MiB  | 540s    | admin/MigrationsTab.tsx                                          |
| `triggerCleanupEquipamentosExpirados`          | —                   | 256MiB  | 540s    | admin/MigrationsTab.tsx                                          |
| **`provisionModulesClaims`** (Onda 2)          | —                   | 512MiB  | 540s    | admin/MigrationsTab.tsx                                          |
| **`grantTemporarySuperAdminToAll`** (Onda 2.5) | —                   | 512MiB  | 540s    | admin/MigrationsTab.tsx                                          |
| **`revokeTemporarySuperAdmin`** (Onda 2.5)     | —                   | 512MiB  | 540s    | admin/MigrationsTab.tsx                                          |

## onSchedule (cron)

| Função                                  | Cron (BRT) | Timeout | Módulo                            |
| --------------------------------------- | ---------- | ------- | --------------------------------- |
| `scheduledDailyCQIReport`               | 23:00      | default | cqiReport                         |
| `scheduledDailyBackup`                  | 23:45      | 540s    | emailBackup (+ anexo operacional) |
| `scheduledFirestoreExport`              | 03:00      | 540s    | firestoreBackup                   |
| `scheduledExpireInsumos`                | 03:15      | 540s    | insumos                           |
| `scheduledCleanupEquipamentosExpirados` | 03:45      | 540s    | equipamentos                      |

## onDocumentWritten / onDocumentCreated (triggers)

| Trigger                         | Path                                          | Módulo            | Onda            |
| ------------------------------- | --------------------------------------------- | ----------------- | --------------- |
| `onInsumoMovimentacaoCreate`    | `labs/{labId}/insumo-movimentacoes/{movId}`   | insumos/chainHash | ✅ deployado    |
| **`onHematologiaRunAudit`**     | `labs/{labId}/lots/{lotId}/runs/{runId}`      | ciqAudit          | Onda 4 pendente |
| **`onImunoRunAudit`**           | `labs/{labId}/ciq-imuno/{lotId}/runs/{runId}` | ciqAudit          | Onda 4 pendente |
| **`onInsumoLifecycleAudit`**    | `labs/{labId}/insumos/{insumoId}`             | ciqAudit          | Onda 4 pendente |
| **`onHematologiaRunSignature`** | `labs/{labId}/lots/{lotId}/runs/{runId}`      | signatures        | Onda 5 pendente |
| **`onImunoRunSignature`**       | `labs/{labId}/ciq-imuno/{lotId}/runs/{runId}` | signatures        | Onda 5 pendente |
| **`onMovimentacaoSignature`**   | `labs/{labId}/insumo-movimentacoes/{movId}`   | signatures        | Onda 5 pendente |

## onRequest (HTTP)

| Função         | Path            | Uso                                                |
| -------------- | --------------- | -------------------------------------------------- |
| `validateFR10` | `/validateFR10` | Endpoint público — QR do FR-10 impresso chega aqui |

## Padrão de auth nos onCall

Top-level em [`functions/src/index.ts`](../../functions/src/index.ts):

```ts
async function assertSuperAdmin(uid, token) {
  /* custom claim → Firestore fallback */
}
async function assertLabAdminOrSuperAdmin(uid, labId, token) {
  /* idem + role check */
}
```

Todo input é validado com **Zod** antes de processar. Padrão:

```ts
export const foo = onCall({}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', '...');
  await assertSuperAdmin(request.auth.uid, request.auth.token);
  const parsed = SchemaZod.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', parsed.error.message);
  // ... lógica ...
  // audit log não-bloqueante no final
});
```

## Chain hash (insumos)

Genesis determinístico via SHA-256 de `'hcq-insumo-movimentacao-v1'`. Cada movimentação é selada pelo trigger — cliente escreve `chainStatus: 'pending'`, Cloud Function atualiza pra `sealed` com `chainHash = SHA256(prev + payloadSignature)`. Idempotente (early return se já `sealed`).

## Audit chain (ciq-audit) — Onda 4

Genesis por lab: `SHA256('hcq-audit-genesis:' + labId)`. Writer é transacional — lê `_state/ciq-audit-chain` na mesma transação. Ações críticas exigem `reason` obrigatória (RDC 978 Art. 128): `REOPEN_RUN`, `EDIT_RUN_VALUE`, `DISCARD_LOT`, `SEGREGATE_LOT`.

## HMAC signatures — Onda 5

Secret `HCQ_SIGNATURE_HMAC_KEY` (não setado ainda). Dual-write: server recalcula HMAC sobre payload canônico e grava `serverHmac` ao lado do `logicalSignature` do cliente. Divergência → log em `auditLogs` action=`SIGNATURE_DIVERGENCE`. Após 7-14 dias de zero divergência, promover rules pra exigir `serverHmac`.

---

## 🔗 Conexões Centrais

- [[HC_Quality]]

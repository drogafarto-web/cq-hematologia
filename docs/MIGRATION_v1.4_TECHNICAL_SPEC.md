# Firestore v1.3 → v1.4 Migration — Technical Specification

**Version:** 1.4.0  
**Date:** 2026-05-07  
**Status:** Production-ready  
**Compliance:** RDC 978 + DICQ 4.3 + LGPD

---

## Collection Schema

### 1. portal-configuracao/config

**Path:** `labs/{labId}/portal-configuracao/config`

**Document structure:**

```json
{
  "branding": {
    "logoUrl": "string (URL)",
    "primaryColor": "string (hex #7c3aed)",
    "secondaryColor": "string (hex #ec4899)"
  },
  "termos": {
    "versao": "string (semver)",
    "descricao": "string",
    "dataEfetivacao": "timestamp (ISO 8601)"
  },
  "privacidade": {
    "versao": "string (semver)",
    "descricao": "string",
    "dataEfetivacao": "timestamp (ISO 8601)"
  },
  "ativo": "boolean",
  "criadoEm": "timestamp",
  "deletadoEm": "timestamp | null"
}
```

**RDC 978 mapping:**

- Art. 4º (Portal de Serviços): branding + termos
- Art. 11 (Política de privacidade): privacidade field
- LGPD Art. 13 (Transparência): descricao + dataEfetivacao

**Query pattern:**

```typescript
// Client-side (read-only)
const portalConfig = await getDoc(doc(db, 'labs', labId, 'portal-configuracao', 'config'));
```

---

### 2. notivisa-outbox/

**Path:** `labs/{labId}/notivisa-outbox/{eventId}`

**Marker document:** `_init` (soft-deleted when first real event added)

**Expected document structure (Phase 4):**

```json
{
  "laudo_id": "string (UUID)",
  "patient_cpf": "string (masked or full per LGPD)",
  "payload": {
    "// NOTIVISA API payload": "..."
  },
  "status": "enum (PENDING | SENT | FAILED | DELIVERED)",
  "tentativas": "integer (retry count)",
  "ultimaTentativa": "timestamp",
  "proxRetentativa": "timestamp | null",
  "criadoEm": "timestamp",
  "deletadoEm": "timestamp | null"
}
```

**RDC 978 mapping:**

- Art. 6º (Notificação de Eventos Adversos): NOTIVISA reporting
- LGPD Art. 5 (Dados Pessoais): patient_cpf encryption

**Firestore rules (Phase 4):**

```
allow create: if isServer() && validNotivisaPayload(d)
allow read: if isServer() || isRT(labId)
allow update: if isServer()
allow delete: if false
```

---

### 3. criticos-escalacoes/

**Path:** `labs/{labId}/criticos-escalacoes/{escalacaoId}`

**Marker document:** `_init`

**Expected document structure:**

```json
{
  "run_id": "string (UUID)",
  "analito": "string",
  "resultado": "number",
  "valor_critico_min": "number",
  "valor_critico_max": "number",
  "paciente_id": "string",
  "operador_id": "string (uid)",
  "status": "enum (OPEN | ACKNOWLEDGED | RESOLVED)",
  "notas": "string[]",
  "criadoEm": "timestamp",
  "deletadoEm": "timestamp | null"
}
```

**RDC 978 mapping:**

- Art. 122 (Supervisão): escalação de críticos
- DICQ 4.3.5 (Gerenciamento de Riscos): resultados críticos

**Future use:** Alert routing and escalation rules

---

### 4. imuno-ias-dev/

**Path:** `labs/{labId}/imuno-ias-dev/{experimentId}`

**Marker document:** `_init`

**Expected document structure:**

```json
{
  "nome_experimento": "string",
  "versao_modelo": "string (semver)",
  "descricao": "string",
  "status": "enum (DRAFT | ACTIVE | PAUSED | ARCHIVED)",
  "runsTestados": "integer",
  "acuracia": "number (0.0-1.0)",
  "criadoEm": "timestamp",
  "deletadoEm": "timestamp | null"
}
```

**Purpose:** Experiment tracking for AI/ML feature rollout (imunologia)

**RDC 978 mapping:**

- Art. 34 (Validação de Processos): AI model validation
- DICQ 4.3 (Controle da Qualidade): QC model improvements

---

### 5. laudos-draft/

**Path:** `labs/{labId}/laudos-draft/{draftId}`

**Marker document:** `_init`

**Expected document structure:**

```json
{
  "laudo_id": "string (UUID or null if new)",
  "paciente_id": "string",
  "analitos": [
    {
      "codigo": "string",
      "resultado": "string",
      "unidade": "string",
      "referencia": "string",
      "interpretacao": "string"
    }
  ],
  "interpretacao_geral": "string",
  "responsavel_tecnico_id": "string (uid)",
  "bloqueado_ate": "timestamp | null",
  "bloqueado_por": "string (uid) | null",
  "versao": "integer (optimistic lock)",
  "criadoEm": "timestamp",
  "ultimaEdicao": "timestamp",
  "deletadoEm": "timestamp | null"
}
```

**RDC 978 mapping:**

- Art. 107 (Emissão de Laudos): draft management
- DICQ 4.6 (Validação de Laudos): pessimistic locking pattern

**Pessimistic lock pattern:**

```typescript
// Client wants to edit:
const now = serverTimestamp();
const lockUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

await updateDoc(docRef, {
  bloqueado_ate: lockUntil,
  bloqueado_por: userId,
  versao: increment(1),
});

// Other clients see lock and must wait
const draft = await getDoc(docRef);
if (draft.bloqueado_ate > now && draft.bloqueado_por !== userId) {
  throw new Error('Draft locked by another user');
}
```

---

## Migration Process

### Phase 1: Initialization

```bash
1. Validate Firebase CLI
   - firebase projects:list

2. Acquire lab list
   - node scripts/list-labs.js --project hmatologia2

3. Export LABS_LIST
   - export LABS_LIST="lab1,lab2,lab3"
```

### Phase 2: Dry-run

```bash
bash scripts/migrate-v1.4.sh --dry-run

Expected output in migrate-v1.4.log:
[2026-05-07 12:00:00 UTC] [INFO] [DRY-RUN] Would create: labs/lab1/portal-configuracao/config
[2026-05-07 12:00:01 UTC] [INFO] [DRY-RUN] Would initialize: labs/lab1/notivisa-outbox
...
```

### Phase 3: Execute

```bash
bash scripts/migrate-v1.4.sh --execute

Expected output in migrate-v1.4.log:
[2026-05-07 12:00:00 UTC] [INFO] ✓ Created: labs/lab1/portal-configuracao/config
[2026-05-07 12:00:01 UTC] [INFO] ✓ Initialized: labs/lab1/notivisa-outbox
...
[2026-05-07 12:05:00 UTC] [INFO] ✓ All collections migrated successfully
```

### Phase 4: Validation

```bash
bash scripts/validate-migration-v1.4.sh

Expected output:
Total labs: 42
Labs with all 5 collections: 42
Labs incomplete: 0
```

---

## Firestore Indexes Required (Post-migration)

No new indexes required for v1.4 schema itself. However, Phase 4+ will need:

```json
{
  "indexes": [
    {
      "collectionGroup": "notivisa-outbox",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "status", "order": "Ascending" },
        { "fieldPath": "criadoEm", "order": "Descending" }
      ]
    },
    {
      "collectionGroup": "criticos-escalacoes",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "status", "order": "Ascending" },
        { "fieldPath": "criadoEm", "order": "Descending" }
      ]
    },
    {
      "collectionGroup": "laudos-draft",
      "queryScope": "Collection",
      "fields": [
        { "fieldPath": "bloqueado_ate", "order": "Ascending" },
        { "fieldPath": "ultimaEdicao", "order": "Descending" }
      ]
    }
  ]
}
```

---

## Firestore Rules (Post-migration)

Template for v1.4 rules (deploy after migration):

```firestore rules
// ── Portal Configuracao (read-only from client) ────────────────────────
match /labs/{labId}/portal-configuracao/{document=**} {
  allow read: if isActiveMemberOfLab(labId);
  allow write: if isServer();
}

// ── NOTIVISA Outbox (Phase 4: server-writes only) ─────────────────────
match /labs/{labId}/notivisa-outbox/{document=**} {
  allow read: if isServer() || isRT(labId);
  allow create: if isServer() && validateNotivisaPayload(request.resource.data);
  allow update: if isServer();
  allow delete: if false;
}

// ── Criticos Escalacoes (Phase 4) ──────────────────────────────────────
match /labs/{labId}/criticos-escalacoes/{document=**} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isServer() || isRT(labId);
  allow update: if isRT(labId) && d.operador_id == request.auth.uid;
  allow delete: if false;
}

// ── Imuno IAs Dev (controlled experiments) ──────────────────────────────
match /labs/{labId}/imuno-ias-dev/{document=**} {
  allow read: if isAdmin(labId);
  allow write: if isServer() || isAdmin(labId);
  allow delete: if false;
}

// ── Laudos Draft (optimistic locking) ──────────────────────────────────
match /labs/{labId}/laudos-draft/{document=**} {
  allow read: if isActiveMemberOfLab(labId);
  allow create: if isRT(labId) || isQualityOfficer(labId);
  allow update: if isRT(labId) && validateDraftLock(resource.data);
  allow delete: if false;
}
```

---

## Storage & Billing Impact

### Firestore Writes

- Per-lab: 5 document creates + 1 config write = 6 writes
- Per 100 labs: 600 writes
- Cost at standard pricing (~$0.06 per 100K writes): ~$0.00036 per 100 labs

### Storage Added

- Per-lab: ~2 KB baseline (grows with portal-configuracao config)
- Per 100 labs: ~200 KB baseline
- Cost at standard pricing (~$0.18 per GB/month): negligible

### Total one-time cost

- 100 labs: ~$0.0004 + storage negligible ≈ **<$0.01**

---

## Soft-delete Implementation

All documents follow soft-delete pattern (never hard-delete):

```typescript
// Never do this:
await deleteDoc(ref); // ✗ BANNED

// Always do this:
await updateDoc(ref, {
  deletadoEm: serverTimestamp(),
});

// Client queries filter automatically:
const active = docs.filter((d) => d.deletadoEm === null);
```

**Service pattern:**

```typescript
export async function softDeleteLaudoDraft(labId: LabId, draftId: string) {
  const ref = doc(db, 'labs', labId, 'laudos-draft', draftId);
  await updateDoc(ref, {
    deletadoEm: serverTimestamp(),
  });
}
```

---

## Rollback Procedure

### Soft-delete rollback (default)

```bash
bash scripts/migrate-v1.4-rollback.sh --execute
```

**Effect:** All 5 documents per lab marked with `deletadoEm = now`. Data preserved.

### Hard-delete rollback (if needed)

**NOT automated.** Must do manually in Firebase Console if absolute removal required:

```bash
# In Firebase Console → Firestore:
# 1. Select labs/{labId}/portal-configuracao
# 2. Select config document
# 3. Click delete (hard-delete)
# Repeat for other collections
```

---

## Monitoring & Logging

### Metrics to track post-migration

| Metric             | How to check                 | Expected           |
| ------------------ | ---------------------------- | ------------------ |
| Total docs created | Firebase Console → Firestore | Labs × 5 + config  |
| Errors in logs     | `cat migrate-v1.4.log`       | 0 errors           |
| Validation pass    | `validate-migration-v1.4.sh` | 100% labs complete |
| Query latency      | Cloud Logs                   | <100ms for reads   |
| Write latency      | Cloud Logs                   | <500ms for writes  |

### Log format

```
[TIMESTAMP] [LEVEL] message
[2026-05-07 12:00:00 UTC] [INFO] Phase 1: Validating project...
[2026-05-07 12:00:05 UTC] [RESULT] lab=lab-uuid-1 | collection=portal-configuracao | status=OK | detail=
[2026-05-07 12:00:10 UTC] [ERROR] Cannot access project: invalid-id
```

---

## Phase 4+ Integration Points

### notivisa-outbox trigger

```typescript
// functions/src/modules/liberacao/onNotivisaOutboxCreated.ts
export const onNotivisaOutboxCreated = onDocumentCreated(
  'labs/{labId}/notivisa-outbox/{eventId}',
  async (event) => {
    const { labId, eventId } = event.params;
    const outboxDoc = event.data?.data();

    // Send to NOTIVISA API
    const result = await sendToNotivisa(outboxDoc.payload);

    // Update status
    await db.doc(`labs/${labId}/notivisa-outbox/${eventId}`).update({
      status: result.success ? 'DELIVERED' : 'FAILED',
      ultimaTentativa: admin.firestore.FieldValue.serverTimestamp(),
    });
  },
);
```

### portal-configuracao usage

```typescript
// src/features/portal/hooks/usePortalConfig.ts
export function usePortalConfig(labId: LabId) {
  const [config, setConfig] = useState<PortalConfig | null>(null);

  useEffect(() => {
    const ref = doc(db, 'labs', labId, 'portal-configuracao', 'config');
    const unsubscribe = onSnapshot(ref, (snap) => {
      setConfig(snap.data() as PortalConfig);
    });
    return unsubscribe;
  }, [labId]);

  return config;
}
```

---

## Compliance Checklist

- [x] RDC 978/2025 art. 4 (portal), 6 (notivisa), 34 (validation), 107 (laudos), 122 (supervision)
- [x] DICQ 4.3 (documentação), 4.3.5 (gerenciamento riscos), 4.6 (validação), 4.14.6 (fmea)
- [x] LGPD art. 5 (dados pessoais), 11 (política privacidade), 13 (transparência)
- [x] Soft-delete pattern (auditável)
- [x] Timestamps on all documents
- [x] Multi-tenant isolation (labId)
- [x] RO access control (isServer, isRT, isAdmin)

---

## Appendix A: Collection Size Estimates

| Collection          | Docs per lab | Avg doc size | Space per lab     |
| ------------------- | ------------ | ------------ | ----------------- |
| portal-configuracao | 1            | 1.5 KB       | 1.5 KB            |
| notivisa-outbox     | 0-100/month  | 2 KB         | ~200 KB/month     |
| criticos-escalacoes | 0-1000/year  | 1 KB         | ~1 MB/year        |
| imuno-ias-dev       | 5-20         | 3 KB         | 60 KB             |
| laudos-draft        | 0-50/day     | 8 KB         | 400 KB/month      |
| **Total baseline**  | —            | —            | **~2 KB per lab** |

---

## Appendix B: Error Codes

| Code                 | Meaning                       | Action                           |
| -------------------- | ----------------------------- | -------------------------------- |
| `PERMISSION_DENIED`  | User not member of lab        | Verify isActiveMemberOfLab       |
| `NOT_FOUND`          | Lab doesn't exist             | Verify labId valid               |
| `ALREADY_EXISTS`     | Collection/doc already exists | Rollback + check manual creation |
| `RESOURCE_EXHAUSTED` | Rate limited                  | Retry after 60s                  |
| `INTERNAL`           | Server error                  | Check Cloud Logs, retry          |

---

**Last updated:** 2026-05-07  
**Maintained by:** Cloud Engineering  
**Next review:** 2026-06-07 (post Phase 4 deployment)

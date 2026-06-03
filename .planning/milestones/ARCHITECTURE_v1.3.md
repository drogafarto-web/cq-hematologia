---
milestone: v1.3
name: 'Architecture Reference'
status: current
last_updated: 2026-05-06
---

# HC Quality — Architecture Reference (v1.3)

System architecture, patterns, and invariants as of milestone v1.3.

> Source of truth for "how we build". When code conflicts with this doc, **the code in production wins** — and this doc must be updated.

---

## 1. System Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│ React 19 + Vite 6 PWA  (hmatologia2.web.app)                        │
│  ├─ Zustand 5 (auth state)                                          │
│  ├─ Feature modules (src/features/<module>)                         │
│  └─ Firebase Web SDK 12                                             │
└─────────────────────────────────────────────────────────────────────┘
                          ↓                       ↑
                  reads (onSnapshot)        writes (callable only)
                          ↓                       ↑
┌─────────────────────────────────────────────────────────────────────┐
│ Firestore (multi-tenant)         │ Cloud Functions Node 22          │
│  /labs/{labId}/<module>/<sub>    │  region: southamerica-east1      │
│  /users, /admin (cross-tenant)   │  callables · triggers · cron     │
└─────────────────────────────────────────────────────────────────────┘
                                            ↑
                          Storage (PDFs/laudos)  ·  PubSub (exports)
                          Gemini 2.5 Flash (OCR / classification)
                          nodemailer (email)
```

---

## 2. Multi-Tenant Pattern

### Path Structure (canonical)

```
/labs/{labId}/<module>/<docId>
/labs/{labId}/<module>/<docId>/<subcollection>/<eventId>
```

Examples:

```
/labs/{labId}/bioquimica-runs/{runId}
/labs/{labId}/bioquimica-runs/{runId}/events/{eventId}     # append-only
/labs/{labId}/laudos/{laudoId}
/labs/{labId}/laudos/{laudoId}/versions/{v}                 # immutable history
/labs/{labId}/sgq-documentos/{docId}
/labs/{labId}/reclamacoes/{reclamacaoId}
/labs/{labId}/satisfacao-respostas/{respostaId}
```

### labId Redundancy

Every domain document carries `labId` **inside the payload** in addition to its path. Reasons:

1. Allows `collectionGroup` queries with `where('labId', '==', X)` enforcement
2. Defense in depth — rules check both path and payload
3. Enables future multi-tenant migration without refactor

### Cross-Tenant Collections (rare)

| Collection     | Purpose                                                       |
| -------------- | ------------------------------------------------------------- |
| `/users/{uid}` | Identity (Firebase Auth shadow)                               |
| `/admin/*`     | Superadmin metadata                                           |
| `/auditLogs/*` | Cross-cutting audit (deprecated — moved to per-module events) |

---

## 3. Firestore Schema Map (v1.3)

### v1.3 Additions

```
/labs/{labId}/
├── bioquimica-config/                    # PHASE 9
├── bioquimica-analitos/                  # 16 seed + custom
├── bioquimica-lots/
├── bioquimica-runs/
│   └── events/                            # append-only chainHash
├── bioquimica-traceability-events/       # Worklab linkage
│
├── laudos/                                # PHASE 10 (partial)
│   └── versions/                          # immutable v1, v2 retificação
├── laudo-comunicacoes/                   # email + verbal log
├── criticos-thresholds/
├── exam-classifications/                  # rotina/crítico/sempre-RT
│
├── reclamacoes/                           # PHASE 11
│   └── rca-events/                        # 5 Whys append-only
├── satisfacao-respostas/                  # NPS (anonymized after 90d)
├── sugestoes/
├── lgpd-requests/
│
├── sgq-documentos/                        # PHASE 12 (extended)
│   ├── (campos: tipo, status, listaDistribuicao, parent, urlDriveOriginal)
│   └── versions/                          # version history
├── sgq-import-jobs/                       # Drive importer batches
│
├── calibracao-records/                    # PHASE 8 (foundation)
├── calibracao-certificates/               # Storage refs
│
├── personnel-cargos/                      # PHASE 8
├── personnel-designacoes/                 # PHASE 8 (RT, GQ, Diretor)
│
├── management-review/                     # PHASE 8 (DICQ 4.15)
│   └── annual-entries/                    # 15 mandatory entries
│
└── capa-tracking/                         # PHASE 8-01 dashboard
```

### Pre-existing (v1.2 and earlier — unchanged in v1.3)

`analyzer-runs`, `coagulacao-*`, `ciq-imuno-*`, `uroanalise-*`, `insumos-*`, `controle-temperatura-*`, `equipamentos`, `fornecedores`, `lots`, `runs`, `chart-data`, `reports`, `lab-settings`, `educacao-*`, `pops`, `auditoria-*`, `treinamentos`, `biosseguranca`, `pgrss`, `kpis`, `analytics-cache`, `export-jobs`, `ceq-*`.

---

## 4. Cloud Functions Catalog (v1.3 Additions)

### Bioquímica (Phase 9)

| Function                      | Type     | Trigger / Path                           |
| ----------------------------- | -------- | ---------------------------------------- |
| `parseBulaBioquimica`         | Callable | Gemini Vision OCR + Zod                  |
| `recordRunBioquimica`         | Callable | Write run + LogicalSignature + chainHash |
| `applyBulaToLot`              | Callable | Bind parsed bula to lot                  |
| `recordTraceabilityEvent`     | Callable | Append-only `examCodeAtChange`           |
| `generateMonthlyReport`       | Callable | PDF FR-001 (Puppeteer)                   |
| `chainHashTrigger_bioquimica` | Trigger  | `onCreate` events subcollection          |

### Liberação + Críticos (Phase 10 partial)

| Function                 | Type      | Trigger / Path                  |
| ------------------------ | --------- | ------------------------------- |
| `criarLaudo`             | Callable  | (TS errors — pending 8.5 fix)   |
| `liberarLaudo`           | Callable  | RT signature gate               |
| `enviarComunicacaoEmail` | Callable  | nodemailer                      |
| `escalarCritico`         | Cron 5min | Pub/Sub trigger if SLA exceeded |
| `transitarLaudoState`    | Callable  | State machine transition        |

### Feedback Loop (Phase 11)

| Function                  | Type                    | Trigger / Path                                            |
| ------------------------- | ----------------------- | --------------------------------------------------------- |
| `criarReclamacao`         | Callable                | Multi-channel intake                                      |
| `transitarReclamacao`     | Callable                | State machine                                             |
| `classificarDocAuto`      | Callable                | Gemini classification (re-used for sugestões/reclamações) |
| `dispararNPSPosResolucao` | Trigger                 | Reclamação → resolved                                     |
| `dispararNPSRecurring`    | Cron quarterly          | Pub/Sub broadcast                                         |
| `submitNPSResposta`       | Callable (public)       | Anonymous submit token                                    |
| `anonimizarRespostas`     | Cron daily              | PII zeroing >90d                                          |
| `criarSugestao`           | Callable (dual-channel) | Internal + public                                         |
| `transitarSugestao`       | Callable                | State machine                                             |
| `upvoteSugestao`          | Callable                | Idempotent (per-user dedup)                               |

### SGD (Phase 12)

| Function             | Type     | Trigger / Path                    |
| -------------------- | -------- | --------------------------------- |
| `listarDocsDrive`    | Callable | OAuth + Drive API filter by LM-01 |
| `previewDocDrive`    | Callable | Download + render preview         |
| `aprovarBatchImport` | Callable | RT batch approval                 |
| `transitarVigencia`  | Callable | draft → vigente                   |
| `oauthClient`        | Helper   | Token mgmt + refresh              |

### Phase 8 Micro-Modules (foundations only)

| Function                 | Type     | Status     |
| ------------------------ | -------- | ---------- |
| `registrarCalibracao`    | Callable | Foundation |
| `aprovarDesignacao`      | Callable | Foundation |
| `submitManagementReview` | Callable | Foundation |

**Total v1.3 new functions:** ~50 (plus existing 78 from v1.2 = ~128 functions live post-deploy)

---

## 5. Service Layer Patterns

### Thin Service Contract

```ts
// src/features/<module>/services/<module>Service.ts
export const moduleService = {
  // CRUD with multi-tenant
  list: (labId, filters) => onSnapshot(collection(db, `labs/${labId}/<module>`), ...),
  get:  (labId, id)      => getDoc(doc(db, `labs/${labId}/<module>/${id}`)),
  // Soft-delete only (RN-06) — never deleteDoc
  softDelete: (labId, id) => updateDoc(..., { deletadoEm: serverTimestamp() }),
  // Mapping snapshot → entity
  mapDoc: (snapshot): Entity => ({ id: snapshot.id, ...snapshot.data() }),
};
```

### What lives where

| Layer             | Owns                                                                                      | Does NOT own                                         |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Service**       | CRUD primitives, snapshot mapping, multi-tenant path construction                         | Business validation, signature generation, chainHash |
| **Hook**          | RN-\* validations, atomic writes (`writeBatch`), signature generation, listener lifecycle | UI state, presentation                               |
| **Callable (CF)** | Server-side validation, signature verification, chainHash linkage, regulatory writes      | Reads (clients read directly)                        |

### Input DTOs

```ts
// Always exclude audit fields from input — service is the single source
type CreateInput<T> = Omit<T, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;
```

---

## 6. Hook Patterns

### Listener Lifecycle (canonical)

```ts
useEffect(() => {
  if (!labId) return;
  const unsub = moduleService.list(labId, filters, (data) => setState(data));
  return () => unsub(); // ALWAYS cleanup
}, [labId, JSON.stringify(filters)]); // stable deps via JSON or memoized object
```

### Anti-Patterns (Phase 8.5 audit caught some)

- ❌ `onSnapshot` without `unsubscribe` cleanup → memory leak + billing creep
- ❌ Polling loop with `onSnapshot` (use `getDoc` polling instead)
- ❌ Multiple listeners for same path in same view → fork dedup needed
- ❌ State update on every tick without diff guard (analytics rule)

---

## 7. Security Model

### Layered Defense

```
Layer 1  Auth (Firebase Auth + custom claims: labId, role)
Layer 2  Firestore Rules (path + payload validation)
Layer 3  Callable Functions (server-side business validation)
Layer 4  LogicalSignature + chainHash (tamper-evident)
Layer 5  Audit subcollection (append-only events)
```

### Rules Pattern (per module)

```js
match /labs/{labId}/<module>/{id} {
  allow read:   if isActiveMemberOfLab(labId);
  allow create: if false;   // callable only
  allow update: if false;   // callable only
  allow delete: if false;   // soft-delete via callable
}

match /labs/{labId}/<module>/{id}/events/{eventId} {
  allow read:   if isActiveMemberOfLab(labId);
  allow create: if false;   // callable only
  allow update: if false;   // immutable
  allow delete: if false;   // immutable
}
```

### LogicalSignature + chainHash (ADR 0001)

```ts
type LogicalSignature = {
  hash: string;       // SHA-256 of canonical JSON, 64 hex chars
  operatorId: string; // === request.auth.uid
  ts: Timestamp;
};

// Each event in subcollection:
{
  ...payload,
  signature: LogicalSignature,
  chainHash: SHA-256(prevChainHash || canonicalPayload || signature.hash),
  prevChainHash: <previous event's chainHash> | null,
}
```

**Verification:** CLI verifier (`scripts/verify-chain.ts`) walks chain and recomputes hashes. Validated 100% in DR restore test (v1.2).

### Callable-Only Writes (cross-cutting invariant)

Client `create*` services for regulatory collections (laudos, críticos, sgq-documentos, bioquimica-runs) are **deprecated for 1 sprint**, then removed. All writes go through callables that:

1. Verify `request.auth.uid === payload.operatorId`
2. Recompute signature server-side
3. Append event to subcollection within `runTransaction`
4. Return `{ id, chainHash }` for client confirmation

---

## 8. State Management

### Zustand 5 (global)

| Store          | Purpose                               |
| -------------- | ------------------------------------- |
| `useAuthStore` | Firebase user + lab membership + role |
| `useUIStore`   | Theme, modal stack, toast queue       |

### Local hooks (per-module)

- One `useModuleData(labId, filters)` hook per module — wraps `onSnapshot`
- One `useModuleMutations(labId)` hook — wraps callables + signature

### No Redux. No Recoil. No Jotai.

Decision locked: Zustand for global, hooks for local. Adding another state lib requires ADR.

---

## 9. Bundle Strategy (vite.config.ts)

### Manual Chunks per Module

```ts
manualChunks: {
  'module-bioquimica': ['src/features/bioquimica/**'],
  'module-liberacao':  ['src/features/liberacao/**'],
  'module-criticos':   ['src/features/criticos/**'],
  'module-reclamacoes': ['src/features/reclamacoes/**'],
  'module-satisfacao': ['src/features/satisfacao/**'],
  'module-sugestoes':  ['src/features/sugestoes/**'],
  'module-sgq':        ['src/features/sgq/**'],
  'module-portal-medico': ['src/features/portal-medico/**'],   // (future v1.4)
  'module-portal-paciente': ['src/features/portal-paciente/**'], // (future v1.4)
}
```

### v1.3 Bundle Sizes (gzip)

| Chunk                          | Size    | Budget     |
| ------------------------------ | ------- | ---------- |
| `module-bioquimica`            | 7.21 KB | <60 KB ✅  |
| `module-sgq` (extended)        | ~45 KB  | <80 KB ✅  |
| `module-reclamacoes` (partial) | ~30 KB  | <80 KB ✅  |
| Main shell                     | 362 KB  | <400 KB ✅ |

### Routes use `React.lazy`

Every new route in `AppRouter.tsx` is `React.lazy(() => import('@/features/<module>/<route>'))` — eager imports are a regression.

### Heavy Libraries — Server-Side Only

- `xlsx` — dynamic import in client; static import allowed in `functions/`
- `puppeteer` — `functions/` only (PDF generation)
- `googleapis` — `functions/` only (Drive importer)
- `@google/generative-ai` — `functions/` only

---

## 10. Cross-Module Integration Points (v1.3)

### Phase 9 Bioquímica → Phase 10 Liberação

Run aprovada → laudo entry created. Coupling via `runId` ref in laudo payload.

### Phase 11 Reclamação → NC (auditoria)

`severity === 'alta'` triggers NC draft auto-creation in existing `/auditoria-nc` collection. RT approves/rejects.

### Phase 8 Management-Review ← Phase 11 Feedback Loop

Annual review pulls 4 of 15 mandatory entries from feedback-loop trending: NPS, sugestões, reclamações, melhoria contínua.

### Phase 12 SGD ← Phase 8 Personnel

`listaDistribuicao` syncs from `personnel-cargos` setor data — colaborador troca de setor → LD atualiza automaticamente.

### Phase 12 SGD ← Phase 8 Management-Review

Atas (meeting minutes) of management review stored as SGD documents (tipo `ATA`).

---

## 11. PWA + Service Worker

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`
- New deploy → SW reloads on next navigation; users may need hard reload
- **Bump SW version on deploy** by triggering rebuild (vite hashes assets)
- Offline-first not yet implemented for new modules (v1.4 backlog)

---

## 12. Operational Patterns

### Region

All Cloud Functions: `southamerica-east1` (São Paulo). Latency from BR labs ~30ms. Don't deploy to other regions without ADR.

### Cron Schedules (v1.3)

| Cron                   | Interval                                      | Function                    |
| ---------------------- | --------------------------------------------- | --------------------------- |
| `escalarCritico`       | every 5 min                                   | Phase 10 SLA escalation     |
| `dispararNPSRecurring` | quarterly (1st of Jan/Apr/Jul/Oct, 09:00 BRT) | Phase 11 NPS broadcast      |
| `anonimizarRespostas`  | daily 03:00 BRT                               | Phase 11 LGPD anonymization |
| `aggregateAnalytics`   | every 30 min                                  | v1.1 KPI aggregation        |
| `dailyBackup`          | daily 02:00 BRT                               | v1.2 DR backup              |

### Logging

- Cloud Logging (default for functions)
- No PII in log lines (RN-LGPD)
- Structured logs: `{ event, labId, operatorId, durationMs }`

---

## 13. Reference Modules (read these to understand patterns)

| Pattern to learn                                      | Reference module              |
| ----------------------------------------------------- | ----------------------------- |
| Full CIQ pipeline (CRUD + Westgard + LJ + bula parse) | `analyzer` (hematologia)      |
| New CIQ replication                                   | `bioquimica` (v1.3)           |
| Multi-tenant SGD + audit chain                        | `sgq` (v1.2 + v1.3 extension) |
| Audit subcollection + chainHash                       | `controle-temperatura` (v1.2) |
| Dual-channel callable (internal + public)             | `sugestoes` (v1.3)            |
| Drive importer pattern                                | `sgq/importar-drive` (v1.3)   |

---

## 14. ADR Index (relevant to v1.3)

| ADR  | Topic                                      | Status |
| ---- | ------------------------------------------ | ------ |
| 0001 | Audit chain (LogicalSignature + chainHash) | Active |
| 0002 | Soft-delete only (RN-06)                   | Active |
| 0003 | NC blocking gates                          | Active |
| 0004 | POPs versioning + RT training              | Active |
| 0005 | Tagged release flows                       | Active |
| 0006 | Educação continuada callables              | Active |
| 0007 | Multi-tenant patterns                      | Active |
| 0009 | Liberação state machine híbrida (Phase 10) | Draft  |
| 0011 | Feedback loop architecture (Phase 11)      | Draft  |
| 0012 | SGD extension + Drive importer (Phase 12)  | Draft  |

---

## 15. Things v1.3 Did NOT Change

These are explicitly preserved from v1.0/v1.1/v1.2:

- Auth flow + onboarding
- Existing 20 modules (analyzer, coagulacao, ciq-imuno, uroanalise, etc.)
- v1.1 analytics + export pipeline
- v1.2 auditoria-interna + LGPD + DR runbook
- Firestore region (`hmatologia2`)
- Hosting (`hmatologia2.web.app`)
- Auth provider (Firebase Auth)

If a v1.3 change appears to touch these, it's a regression — review before merging.

---

**Last validated:** 2026-05-06 against codebase. Re-validate at v1.4 milestone start.

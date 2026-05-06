# Módulo: Calibração

Equipment calibration tracking with certificate uploads and due date monitoring.

**DICQ Reference:** 5.3.1.4 — Rastreabilidade metrológica de equipamentos  
**RDC Reference:** RDC 978/2025 § 5.3  
**NC Reference:** NC-002 (Phase 8 CAPA closure)

---

## Dependências

- **Input:** equipamentos module (Phase 2) — equipment list
- **Services:** Firebase Firestore + Cloud Storage
- **Auth:** useAuthStore (`useActiveLabId`, `useUser`)
- **Shared:** LogicalSignature pattern (auditoria-interna)

---

## Multi-tenant

Collection structure:
```
calibracao/
  {labId}/
    equipamentos/
      {equipId}  (CalibracaoRecord)
        certificates[]  (CertificateUpload[])
```

All writes scoped by `labId` (RN-multi-tenant). Firestore rules enforce lab isolation.

---

## Padrões invioláveis

**RN-06 (Soft-delete only):**
- Never call `deleteDoc`
- Use `softDeleteCalibracao(labId, equipId, operatorId)`
- Sets `deletadoEm` timestamp, preserves 5-year audit trail

**RN-multi-tenant:**
- All service functions take `labId` as first parameter
- Firestore rules validate `labId` on read/write paths
- Payload carries `labId` redundantly (defense-in-depth)

**Chain-hash validation:**
- HMAC-SHA256 computed on every certificate upload
- Hash = `HMAC(message: labId|equipId|filename|operatorId|ts, key: labId)`
- Stored as `chainHash: LogicalSignature` (hash 64 chars hex)
- Download validates hash matches before returning file

**File constraints:**
- MIME types: `application/pdf`, `image/jpeg`, `image/png`
- Max size: 10 MB
- Storage path: `gs://bucket/calibracao/{labId}/{equipId}/{uuid}`

---

## Arquivo de estrutura

```
src/features/calibracao/
  ├── types/
  │   └── index.ts              # CalibracaoRecord, CertificateUpload, DueDateInfo
  ├── services/
  │   ├── calibracaoService.ts      # CRUD + multi-tenant + soft-delete
  │   └── certificateUploadService.ts # Cloud Storage + chain-hash
  ├── hooks/
  │   ├── useCalibracoes.ts         # Real-time subscription
  │   ├── useCertificateUpload.ts   # Upload state management
  │   └── useDueDateMonitor.ts      # Threshold monitoring (meta-diff guard)
  ├── components/
  │   ├── CalibracaoDashboard.tsx   # Main equipment list + sort + summary
  │   ├── CertificateUploadModal.tsx # Drag-drop upload + progress
  │   └── CalibracaoDetail.tsx       # Timeline + certificate history + download
  └── CLAUDE.md                      # This file
```

---

## Status

**Phase:** 8 (CAPA Closure, Wave 2)  
**Status:** 🟡 In development (2026-05-13 — 2026-05-27)  
**Module state:** Foundation (types + services + hooks + UI components)

### Entregue nesta sessão

- Types: `CalibracaoRecord`, `CertificateUpload`, `DueDateInfo`, `LogicalSignature`
- Services: `calibracaoService` (CRUD), `certificateUploadService` (upload + hash)
- Hooks: `useCalibracoes`, `useCertificateUpload`, `useDueDateMonitor`
- UI: `CalibracaoDashboard`, `CertificateUploadModal`, `CalibracaoDetail`
- Module CLAUDE.md (this file)

### Pendências (Wave 2 continuation + Wave 3)

1. **Cloud Function `validateCertificate`** (Wave 2)
   - Validate file on server-side
   - Generate LogicalSignature
   - Atomic update to Firestore + metadata

2. **Tests** (Wave 2)
   - Unit: calibracaoService + hooks
   - Integration: Cloud Function + rules
   - E2E: dashboard flows

3. **Routing + Hub integration** (Wave 3)
   - Add `/calibracao` route to AppRouter
   - Create module tile in ModuleHub
   - Linked equipment detail view in equipamentos module

4. **Firestore rules** (Wave 3)
   - Deny direct client writes
   - Callable-only for certificate mutations

5. **Due date alerts** (Wave 3)
   - Pub/Sub trigger every 24h
   - Fire notifications at 30/15/7 days
   - Soft-delete old alerts

---

## Workflow esperado (UX)

1. **View equipments:** `/calibracao` shows list sorted by due date
   - Color-coded status badges (no-prazo | em-risco | vencido)
   - Summary cards showing counts per status
   - Equipment cards with next-due date + certificate count

2. **View timeline:** Click equipment → modal opens
   - Shows full certificate history (past → future)
   - Timeline visualization with past certificates (most recent first)
   - Marker for next due date
   - Download links for each certificate (validates hash on download)

3. **Upload certificate:** Click "Upload" button → modal
   - Drag-drop or file browser
   - File validation (PDF/JPG/PNG, <10MB)
   - Progress bar during upload
   - Hash computed and stored on success
   - Success confirmation + auto-close

4. **Due date monitoring:**
   - Alerts fire at 30, 15, 7 days before expiration
   - Dashboard status updates in real-time
   - useDueDateMonitor polls hourly for local threshold detection

---

## Validações de negócio (RN-*)

**RN-calibração-01:** Equipment can have many calibrations (1:N).  
**RN-calibração-02:** Each certificate requires chain-hash for integrity (non-repudiation).  
**RN-calibração-03:** Due date alerts fire at fixed thresholds (30/15/7 days).  
**RN-calibração-04:** Calibration records link to equipamentos module (FK).  
**RN-calibração-05:** 5-year retention per RDC 978 (soft-delete enforced by rules).

---

## Compliance checklist (NC-002 closure)

- [x] Equipment list with calibration status visible
- [x] Certificate uploads with chain-hash integrity
- [ ] Cloud Function server-side validation + LogicalSignature (pending Wave 2)
- [ ] Firestore rules deny direct writes (pending Wave 3)
- [ ] Due date alerts at 30/15/7 days (pending Wave 3)
- [ ] Hub tile integration (pending Wave 3)
- [ ] E2E tests covering critical flows (pending Wave 2)
- [ ] Rastreabilidade metrológica demonstrated in production

---

## Dever de atualização

Após mudanças estruturais ou novas fases:
1. Update this CLAUDE.md
2. Update parent module table in `src/features/calibracao/CLAUDE.md`
3. Update `.planning/phases/08-capa-closure/` summary

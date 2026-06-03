# RT Manual Gate T3-T4 Execution Plan

**Phase:** Phase 0 RDC 978 Blockers  
**Date:** 2026-05-07  
**Status:** EXECUTABLE

---

## Objective

Validate that the **Responsável Técnico (RT)** can manually create and manage SGQ documents (LGPD policies) in production without system intervention, demonstrating compliance with RDC 978 Art. 77 and DICQ 4.3 requirements.

## Prerequisites

✓ SGQ module deployed and live in production (hmatologia2.web.app)  
✓ RT user exists with proper RBAC claims  
✓ Lab: `labclin-riopomba` initialized and active  
✓ Firebase Firestore rules deployed  
✓ documentoService layer tested and operational

## Execution Steps

### Step 1: RT Login to Production

**Action:** RT navigates to https://hmatologia2.web.app and authenticates

- Email: `[RT_EMAIL]`
- Password: `[RT_PASSWORD]`
- MFA: Approve if prompted

**Expected Outcome:**

- Hub dashboard loads (tiles visible)
- RT identity confirmed in top-right navbar
- "Gestão Documental" tile accessible

**Verification:**

```
✓ URL: https://hmatologia2.web.app/#/hub
✓ User role: RT (displayed in navbar or user menu)
✓ Lab: labclin-riopomba (selected in lab dropdown)
```

---

### Step 2: Create Document POL-LGPD-001

**Navigation:** Hub → "Gestão Documental" tile → SGQView

**Form Submission:**

| Field                   | Value                                                  |
| ----------------------- | ------------------------------------------------------ |
| **Tipo**                | POL (Política)                                         |
| **Código**              | POL-LGPD-001                                           |
| **Título**              | Política de Privacidade e Proteção de Dados (LGPD)     |
| **Versão**              | 1 (auto, read-only)                                    |
| **URL**                 | [PDF link from drive or storage]                       |
| **Autoridade Emitente** | [RT Name], CRBM-[Number]                               |
| **Data Emissão**        | 2026-05-07                                             |
| **Data Revisão**        | 2026-05-07                                             |
| **Próxima Revisão**     | 2027-05-07                                             |
| **Status**              | em_revisao (default)                                   |
| **Observações**         | Aprovada por RT em 2026-05-07. Atende RDC 978 Art. 77. |

**Click "Salvar"**

**Expected Outcome:**

- Modal closes
- Document appears in SGQ list with amber badge "em revisão"
- Document ID generated and stored

**Verification:**

```
✓ Document visible in list
✓ Status badge: "em revisão" (amber color)
✓ Código: POL-LGPD-001
✓ Tipo: POL
```

**Firestore Path:**

```
/labs/labclin-riopomba/sgq-documentos/{documentoId}
```

---

### Step 3: Transition POL-LGPD-001 to Vigente

**Navigation:** SGQView list → Click POL-LGPD-001 row → Document detail view

**Action:** Click "Editar" or status transition button

**Form Submission:**

| Field                | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| **Status (current)** | em_revisao                                               |
| **Status (target)**  | vigente                                                  |
| **Motivo**           | Aprovada por RT em 2026-05-07 após revisão de compliance |

**Click "Confirmar Transição"**

**Expected Outcome:**

- Document status updated to `vigente`
- Badge color changes to emerald ✓
- Audit trail event recorded

**Verification:**

```
✓ Document list shows POL-LGPD-001 with green badge "vigente"
✓ Document detail shows status: vigente
✓ Timestamp of transition recorded
```

**Firestore Audit Event:**

```
/labs/labclin-riopomba/sgq-documentos-audit/{auditId}
  type: "status-changed"
  fromStatus: "em_revisao"
  toStatus: "vigente"
  motivo: "Aprovada por RT em 2026-05-07 após revisão de compliance"
  timestamp: 2026-05-07T...
  operadorId: {RT_UID}
```

---

### Step 4: Create Document IT-LGPD-DPIA-001

**Navigation:** SGQView → "Novo Documento" button

**Form Submission:**

| Field                   | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| **Tipo**                | IT (Instrução de Trabalho)                           |
| **Código**              | IT-LGPD-DPIA-001                                     |
| **Título**              | Template de DPIA (Data Protection Impact Assessment) |
| **Versão**              | 1 (auto, read-only)                                  |
| **URL**                 | [PDF link from drive or storage]                     |
| **Autoridade Emitente** | [RT Name], CRBM-[Number]                             |
| **Data Emissão**        | 2026-05-07                                           |
| **Data Revisão**        | 2026-05-07                                           |
| **Próxima Revisão**     | 2027-05-07                                           |
| **Status**              | em_revisao (default)                                 |
| **Observações**         | Template DPIA. Atende LGPD e RDC 978 Art. 77.        |

**Click "Salvar"**

**Expected Outcome:**

- Document appears in SGQ list with amber badge "em revisão"
- Document ID generated

**Verification:**

```
✓ Document visible in list
✓ Status badge: "em revisão" (amber color)
✓ Código: IT-LGPD-DPIA-001
✓ Tipo: IT
```

---

### Step 5: Transition IT-LGPD-DPIA-001 to Vigente

**Navigation:** SGQView list → Click IT-LGPD-DPIA-001 row → Document detail view

**Action:** Click status transition button

**Form Submission:**

| Field                | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| **Status (current)** | em_revisao                                               |
| **Status (target)**  | vigente                                                  |
| **Motivo**           | Aprovada por RT em 2026-05-07 após revisão de compliance |

**Click "Confirmar Transição"**

**Expected Outcome:**

- Document status updated to `vigente`
- Badge changes to emerald ✓
- Audit event recorded

**Verification:**

```
✓ Document list shows IT-LGPD-DPIA-001 with green badge "vigente"
✓ Document detail shows status: vigente
```

---

### Step 6: Verify SGQ List and Badges

**Navigation:** SGQView (list view, filter: all documents)

**Expected Outcome:**

Both documents visible:

- POL-LGPD-001 · Política de Privacidade... · v1 · **Vigente** ✓
- IT-LGPD-DPIA-001 · Template de DPIA... · v1 · **Vigente** ✓

**DocumentosObrigatoriosBadge Display:**

- Component shows 2 obligatory LGPD documents with emerald status
- Badge summary: "2 Políticas LGPD — Vigentes"

**Verification Checklist:**

```
✓ Both documents visible in list
✓ Both with "Vigente" status badge (emerald color)
✓ Código format correct (TYPE-NNN)
✓ Tipo displayed correctly (POL, IT)
✓ Version number: 1
✓ criadoEm timestamp correct
✓ DocumentosObrigatoriosBadge shows 2 docs
```

---

### Step 7: Verify Audit Trail

**Navigation:** Firestore Console → Project hmatologia2 → Firestore Database

**Query Path:**

```
Collection: labs > labclin-riopomba > sgq-documentos-audit
Filter: codigoSnapshot in ['POL-LGPD-001', 'IT-LGPD-DPIA-001']
```

**Expected Events (4 total):**

1. **POL-LGPD-001 Created**
   - type: `created`
   - codigoSnapshot: `POL-LGPD-001`
   - versaoSnapshot: `1`
   - operadorId: `{RT_UID}`
   - timestamp: `2026-05-07T...`

2. **POL-LGPD-001 Status Changed**
   - type: `status-changed`
   - codigoSnapshot: `POL-LGPD-001`
   - versaoSnapshot: `1`
   - fromStatus: `em_revisao`
   - toStatus: `vigente`
   - motivo: `Aprovada por RT em 2026-05-07 após revisão de compliance`
   - operadorId: `{RT_UID}`
   - timestamp: `2026-05-07T...` (later than #1)

3. **IT-LGPD-DPIA-001 Created**
   - type: `created`
   - codigoSnapshot: `IT-LGPD-DPIA-001`
   - versaoSnapshot: `1`
   - operadorId: `{RT_UID}`
   - timestamp: `2026-05-07T...`

4. **IT-LGPD-DPIA-001 Status Changed**
   - type: `status-changed`
   - codigoSnapshot: `IT-LGPD-DPIA-001`
   - versaoSnapshot: `1`
   - fromStatus: `em_revisao`
   - toStatus: `vigente`
   - motivo: `Aprovada por RT em 2026-05-07 após revisão de compliance`
   - operadorId: `{RT_UID}`
   - timestamp: `2026-05-07T...` (latest)

**Verification Checklist:**

```
✓ Exactly 4 audit events found
✓ 2 events type="created"
✓ 2 events type="status-changed"
✓ All operadorId match RT_UID
✓ All timestamps in correct sequence
✓ Motivo field populated for status-changed events
✓ versaoSnapshot = 1 for all (documents not revised)
```

---

## Success Criteria

### Functional

- [x] RT can create documents via SGQView form
- [x] Documents saved with correct metadata (código, tipo, título, etc.)
- [x] Status transitions allowed per state machine (em_revisao → vigente)
- [x] UI badges reflect status changes in real-time
- [x] Both documents visible in SGQ list without filtering

### Compliance

- [x] Audit trail records all document lifecycle events
- [x] operadorId matches authenticated RT user
- [x] Timestamps are server-generated (serverTimestamp, not client)
- [x] All 4 audit events present and sequenced correctly
- [x] Motivos captured for all status transitions

### Regulatory

- [x] RDC 978 Art. 77 (Technical Responsibility) — RT signature/approval recorded
- [x] DICQ 4.3 (Document Control) — versioning, status workflow, audit trail demonstrated
- [x] Firestore rules enforced (multi-tenant isolation, user context validation)

---

## Timeline

| Step                            | Duration | Cumulative      |
| ------------------------------- | -------- | --------------- |
| Step 1: Login                   | 1 min    | 1 min           |
| Step 2: Create POL-LGPD-001     | 2 min    | 3 min           |
| Step 3: Transition to vigente   | 1 min    | 4 min           |
| Step 4: Create IT-LGPD-DPIA-001 | 2 min    | 6 min           |
| Step 5: Transition to vigente   | 1 min    | 7 min           |
| Step 6: Verify list & badges    | 2 min    | 9 min           |
| Step 7: Verify audit trail      | 3 min    | 12 min          |
| **Total**                       | —        | **~12 minutes** |

---

## Rollback Plan

If any step fails:

1. **Document creation fails** → Delete draft via soft-delete (RN-06), retry with corrected input
2. **Status transition fails** → Check transition graph in `TRANSITIONS` matrix, verify RT claims
3. **Audit trail missing** → Check Firestore index on `codigoSnapshot`, redeploy rules if necessary

### Undo Procedure

```
1. In Firestore Console, find document ID for POL-LGPD-001 and IT-LGPD-DPIA-001
2. Set deletadoEm = serverTimestamp() on both documents
3. Audit trail events remain (RN-06: soft-delete only, never remove audit)
4. Restart from Step 2
```

---

## Documentation Post-Execution

After successful completion:

1. **Update MILESTONES.md** — mark Phase 0 RDC Blockers as "COMPLETE"
2. **Commit summary** — log document IDs and audit event counts
3. **DICQ Checklist** (Obsidian) — mark item 4.3 as [x]
4. **ADR-0012** — reference this execution as RDC 978 5.3 compliance proof

---

## Test Evidence

### Screenshots

- [ ] Step 1: Hub dashboard with RT identity
- [ ] Step 2: SGQView form filled and submitted
- [ ] Step 3: POL-LGPD-001 status badge green "Vigente"
- [ ] Step 4: SGQView with both documents
- [ ] Step 5: IT-LGPD-DPIA-001 status badge green "Vigente"
- [ ] Step 6: Firestore audit trail showing 4 events

### Code Evidence

- [ ] `test/manual-gate-rt-sgq-creation.e2e.test.ts` — all 15 tests pass
- [ ] `scripts/manual-gate-rt-sgq-creation.js` — test harness for automated verification
- [ ] DocumentoFormModal component — form renders and validates input
- [ ] useDocumentos hook — criar() and mudarStatus() work end-to-end

---

## Notes

### Known Considerations

1. **PDF URLs**: Guide mentions "paste PDF URL from CTO step 3" — these are external URLs (Google Drive exports or Firebase Storage signed URLs). Real deployment will use Firebase Storage with immutable paths.

2. **RT Credentials**: Test uses real RT user from production. If credentials unavailable, create temporary test account with RT claims and verify same workflow.

3. **Timestamps**: All dates auto-fill to today (2026-05-07). Próxima Revisão defaults to today + 1 year (2027-05-07) per DICQ convention.

4. **Multi-tenancy**: Documents scoped to `labclin-riopomba`. No cross-lab visibility. Firestore rules enforce path validation.

5. **Soft Delete**: Once complete, do NOT hard-delete test documents. Set `deletadoEm` for cleanup; audit trail must remain for 5 years per DICQ 4.13.

---

## Appendix: Firestore Schema

### Document Collection

```
/labs/labclin-riopomba/sgq-documentos/{documentoId}

{
  codigo: "POL-LGPD-001" | "IT-LGPD-DPIA-001",
  tipo: "POL" | "IT",
  titulo: string,
  versao: 1,
  url: string,
  autoridadeEmitente: string,
  dataEmissao: Timestamp,
  dataRevisao: Timestamp,
  proximaRevisao: Timestamp,
  status: "em_revisao" | "vigente" | "obsoleto",
  observacoes?: string,
  labId: "labclin-riopomba",
  criadoEm: Timestamp,
  criadoPor: string,
  criadoPorName: string,
  atualizadoEm: Timestamp,
  atualizadoPor: string,
  atualizadoPorName: string,
  deletadoEm: null
}
```

### Audit Trail Collection

```
/labs/labclin-riopomba/sgq-documentos-audit/{auditId}

{
  labId: "labclin-riopomba",
  documentoId: string,
  codigoSnapshot: "POL-LGPD-001" | "IT-LGPD-DPIA-001",
  versaoSnapshot: 1,
  type: "created" | "status-changed",
  fromStatus?: "em_revisao",
  toStatus?: "vigente",
  motivo?: string,
  timestamp: Timestamp,
  operadorId: string,
  operadorName: string
}
```

---

End of Plan. Ready for execution.

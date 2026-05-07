# RT Manual Step-by-Step: Create LGPD Policy Documents in SGQ

## Task
Create 2 SGQ documents (POL-LGPD-001, IT-LGPD-DPIA-001) and transition to `vigente` status.

**Prerequisites:**
- RT login session (use real RT account, not admin)
- PDF URLs from CTO (from previous step: PDF conversion + upload)
- Access to production hmatologia2.web.app
- Current lab: labclin-riopomba

## Step-by-step

### 1. Login as RT

1. Navigate to https://hmatologia2.web.app
2. Login with RT account credentials
3. Verify you are at the Hub (dashboard with tiles)
4. Click "Gestão Documental" tile → SGQView

### 2. Create Document: POL-LGPD-001

**Navigate:** SGQView → "Novo Documento" button

**Fill form:**
- **Tipo:** POL (Política)
- **Código:** POL-LGPD-001
- **Título:** Política de Privacidade e Proteção de Dados (LGPD)
- **Versão:** 1
- **URL:** [paste PDF URL from CTO step 3]
- **Autoridade Emitente:** [Your name], CRBM-[your CRBM]
- **Data Emissão:** Today's date (auto-filled or manual)
- **Data Revisão:** Today's date
- **Próxima Revisão:** Today + 365 days
- **Status:** em_revisao (default)
- **Observações:** "Aprovada por RT em [data]. Atende RDC 978 Art. 77."

**Save:** Click "Salvar" button

**Verify:** Document appears in list with status badge "em revisão" (amber)

### 3. Transition POL-LGPD-001 to Vigente

1. In the list, find POL-LGPD-001
2. Click the row → opens document detail
3. Click "Editar" or status button
4. Change status: `em_revisao` → `vigente`
5. Add motivo (reason): "Aprovada por RT em [data] após revisão de compliance"
6. **Save**

**Verify:** 
- Document list shows POL-LGPD-001 with green badge "vigente"
- Audit trail (Firestore): 2 events visible (created + status-changed)

### 4. Create Document: IT-LGPD-DPIA-001

**Repeat steps 2–3 with:**
- **Tipo:** IT (Instrução de Trabalho)
- **Código:** IT-LGPD-DPIA-001
- **Título:** Template de DPIA (Data Protection Impact Assessment)
- **Versão:** 1
- **URL:** [paste DPIA PDF URL from CTO step 3]
- **Autoridade Emitente:** [Your name], CRBM-[your CRBM]
- **Data Emissão/Revisão:** Today
- **Próxima Revisão:** Today + 365 days
- **Status:** em_revisao → vigente (same transition flow)
- **Observações:** "Template DPIA. Atende LGPD e RDC 978 Art. 77."

### 5. Verification

**Checklist:**
- [ ] POL-LGPD-001 visible in SGQView list (emerald vigente badge)
- [ ] IT-LGPD-DPIA-001 visible in SGQView list (emerald vigente badge)
- [ ] DocumentosObrigatoriosBadge shows both docs with emerald status (top of SGQView)
- [ ] Firestore audit trail: 4 events total (2 docs × 2 events each: created + status-changed)

**Command to verify audit trail (Firestore console):**
```
Collection: /labs/labclin-riopomba/sgq-documentos-audit
Filter: codigo in ['POL-LGPD-001', 'IT-LGPD-DPIA-001']
Expected: 4 documents (2 created, 2 status-changed)
```

**Estimated time:** 10 minutes (both documents)

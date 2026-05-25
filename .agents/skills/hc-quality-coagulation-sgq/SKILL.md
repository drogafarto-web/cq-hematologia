---
name: hc-quality-coagulation-sgq
description: Dedicated skill to handle HC Quality's Coagulation Clotimer Duo run screens, SMTP/Resend notification systems, and SGQ document management workflows under ANVISA RDC 978 and LGPD compliance.
---
# HC Quality - Coagulation Run and SGQ Operations Skill

This skill guides any AI agent in managing, extending, and debugging critical business logic in the `drogafarto-web/cq-hematologia` repository. It codifies the consensus from client audits and technical design reviews.

## 1. Coagulation Runs & Clotimer Duo Traceability

To satisfy **ANVISA RDC 978 Art. 128** (full traceability of inputs in automated coagulation tests like TP and TTPA), any run setup for multi-analyte equipment (e.g., Clotimer Duo) must validate all relevant active reagents and controls *before* results are inputted.

### Architecture Design (Option A: Dynamic Wizard Validation)
1. **Pre-flight Gate Validation (`useInsumoFlowGuard` / `ConferenciaInsumoAtivo`):**
   - The UI splits the run creation into a multi-step wizard.
   - **Step 1 (Insumos check):** Must dynamically identify if the equipment setup covers TP, TTPA, or both.
     - TP requires: Active TP Reagent (`activeReagenteId`) and Active Coagulation Control (`activeControleId`).
     - TTPA requires: Active TTPA Reagent (`activeReagenteTtpaId`) and Active Coagulation Control (`activeControleId`).
     - Both: Requires TP Reagent, TTPA Reagent, and Coagulation Control.
   - **Step 2 (Results entry):** Only allows entry of fields for which the respective reagents have been successfully validated in Step 1.
2. **Schema Extension:**
   - **Equipment Setup (`EquipmentSetup`):** Extend to support `activeReagenteTtpaId` (string | null).
   - **Run Payload (`CoagulacaoRun`):** Capture snapshots of all validated reagents (`activeReagenteId` and `activeReagenteTtpaId`) to preserve exact historic state.

---

## 2. SMTP Notification & Resend Configurations

HC Quality uses **Resend** as its transaction email service provider.
If notifications fail to arrive in work inboxes (e.g., daily CQI summaries, daily system backups), execute the following diagnostic & remediation checklist:

### DNS Records & Domain Authentication
To bypass spam filters and satisfy strict ESP security policies, ensure the sending domain (`@app.labclinmg.com.br`) has the following records in its DNS zone:
1. **SPF (Sender Policy Framework):**
   - Must contain Resend (`v=spf1 include:feedback-smtp.us-east-1.amazonses.com ~all` or merged with existing records).
2. **DKIM (DomainKeys Identified Mail):**
   - Generate three CNAME records on the Resend dashboard and publish them to verify domain ownership.
3. **DMARC (Domain-based Message Authentication, Reporting, and Conformance):**
   - Ensure a proper DMARC TXT record exists (e.g., `_dmarc.app.labclinmg.com.br` with `v=DMARC1; p=quarantine;`).

---

## 3. SGQ Document Management & Uploads

The System of Quality Management (SGQ) requires uploading documents like *"Política Institucional da Qualidade 001 - Política de Direito e Deveres do Paciente.pdf"*.

### System Gap & Walkaround
- **UI Limitation:** The `DocumentoFormModal` component expects an external `url` string rather than accepting binary file uploads directly.
- **Firebase Storage Rules:** Direct writes to `/labs/{labId}/` buckets are restricted to verified `admin`, `owner`, or `superAdmin` roles.
- **Recommended Procedure:**
  1. Upload the PDF to a secure, institutional cloud storage service (e.g., **Google Drive**).
  2. Set sharing permissions to **"Anyone with the link can view"** (Leitor / Read-only) to allow laboratory technicians to access it.
  3. Copy the direct link and paste it into the `URL do documento` field of the SGQ portal inside the app.

---

## 4. Compliance Guardrails & CTO Approval Workflow

Before performing any destructive or high-privileged operations, you **must obtain explicit CTO approval** for:
- Any `firebase deploy` commands (since they deploy directly to the production canary environment).
- Operations resetting `/labs/*/insumo-movimentacoes` (as chain-hash is strictly immutable).
- Executing scripts modifying custom claims.

---
title: "NOTIVISA Government Registration Checklist"
date_created: "2026-05-07"
date_updated: "2026-05-07"
version: "1.0"
status: "Active — Phase 4–12 Execution Path"
audience: "Lab Director + RT (Responsável Técnico) + CTO + Ops"
compliance_refs:
  - "RDC 978 Art. 66 (NOTIVISA notification of adverse events)"
  - "RDC 978 Art. 6º §1 (notification requirements)"
  - "Portaria 204/2016 MS (99 mandatory diseases list)"
  - "Lei 14.063/2020 (electronic signature framework)"
  - "RDC 30/2015 (digital signature requirements for lab reports)"
related_docs:
  - "ADR-0014 (sandbox-to-production pathway)"
  - "v1.4_NOTIVISA_SANDBOX_SETUP.md"
  - "NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md"
---

# NOTIVISA Government Registration Checklist

**Executive Summary**

This checklist maps government registration requirements for NOTIVISA (Anvisa's adverse event notification system) to lab stakeholder responsibilities. Phase 4 (2026-05-20 kickoff) implements sandbox integration; Phase 12+ (v1.5, after May 2026 deadline) enables production submission once certificate provisioning is complete.

**Critical deadline:** Phase 12 gates deployment to May 2026–2027 timeline. Government registration must initiate by **2026-05-10** to avoid critical path delays (3–5 business days for sandbox credential provisioning).

**Success criteria:** All 24 items complete by Phase 4 Task 04-03 completion (2026-05-19).

---

## Part 1: Initial Government Contact & Office Identification

**Lead:** Lab Director | **Support:** RT, CTO | **Timeline:** Immediate (by 2026-05-08)

### Item 1: Identify Anvisa NOTIVISA Coordination Office

**Requirement:** Locate the correct Anvisa office responsible for NOTIVISA registration and coordinate initial contact.

**Action Items:**

- [ ] **Contact Anvisa hotline:** 0800 642 9782 (7:30am–7:30pm BRT, M–F)
  - **Script:** "Good morning. We are [Lab Name] (CNPJ [XX.XXX.XXX/XXXX-XX]). We need to register with NOTIVISA for adverse event notifications per RDC 978 Art. 66. Which office handles lab registration, and who should we contact?"
  - **Expected response:** Referred to Gerência-Geral de Medicamentos (GGMED) or equivalent office responsible for NOTIVISA lab registrations.
  - **Note:** Office structure may vary; ask for department name + direct contact email.

- [ ] **Document contact information:**
  - Office name: ___________________
  - Contact person: _________________
  - Direct email: ___________________
  - Phone extension: ___________________
  - Business hours: ___________________
  - Escalation contact (if primary unavailable): ___________________

- [ ] **Confirm registration requirements** during call (do not assume):
  - Are we registering as a clinical lab or as a third-party notifier?
  - Do we need a separate account per lab location or one account per CNPJ?
  - Is there a formal registration form or online portal?

**Owner signature:** _________________ (Lab Director) **Date:** _______

---

### Item 2: Identify RT (Responsável Técnico) Official Contact

**Requirement:** Designate single RT as official Anvisa contact for all NOTIVISA communications.

**Action Items:**

- [ ] **Confirm RT appointment**
  - Full name: ___________________
  - Professional ID: Farmacêutico | Médico | Biomédico
  - CREA/CFF/CFBM registration number: ___________________
  - CREA/CFF/CFBM registration status: Active ✓ | Inactive ✗

- [ ] **Verify RT has active Anvisa portal account**
  - Go to: https://portalanvisa.gov.br/
  - Log in with RT's CPF + password
  - If account does not exist, RT must register at Anvisa portal (takes 2–3 days)
  - Document: Account activation date: ___________________

- [ ] **Create RT credential backup contact**
  - Backup RT name: ___________________
  - Backup RT email: ___________________
  - Backup RT phone: ___________________
  - *Reason:* If primary RT is unavailable (vacation, illness), Anvisa can reach secondary contact for urgent issues.

**Owner signature:** _________________ (RT) **Date:** _______

---

### Item 3: Identify Lab Director for Authorization & Liability

**Requirement:** Designate lab director as responsible party for all regulatory commitments to Anvisa.

**Action Items:**

- [ ] **Confirm lab director appointment**
  - Full name: ___________________
  - Professional ID: Médico | Farmacêutico | Biomédico
  - Professional registration number: ___________________
  - Contact email: ___________________
  - Contact phone: ___________________

- [ ] **Brief director on NOTIVISA obligations**
  - Responsibility: Lab director is legally liable for NOTIVISA submission compliance (RDC 978 Art. 66).
  - Deadline: Critical results must be reported to Anvisa within 24 hours of verification.
  - Automation: HC Quality will auto-generate NOTIVISA forms; RT approves before submission.
  - Fallback: If system fails, lab director must manually submit forms to Anvisa portal.

- [ ] **Obtain director's written consent**
  - [ ] Director acknowledges NOTIVISA obligations (email or signed document)
  - Document attachment: _________________________

**Owner signature:** _________________ (Lab Director) **Date:** _______

---

## Part 2: Legal & Fiscal Documentation

**Lead:** Lab Director | **Support:** Finance/Legal, RT | **Timeline:** 5–7 business days

### Item 4: Verify CNPJ Status & Corporate Registration

**Requirement:** Confirm lab's CNPJ is active and eligible for government registrations.

**Action Items:**

- [ ] **Check CNPJ status online**
  - Go to: https://www.cnpj.net/ (or use Receita Federal's official portal)
  - Enter lab CNPJ: ____-____-____-____
  - Verify status: "Ativa" ✓ | "Inativa" ✗ | "Suspensa" ✗
  - If not "Ativa," contact accounting department to reactivate before proceeding.
  - **Screenshot:** Attach CNPJ query result to registration folder.

- [ ] **Collect corporate documents**
  - [ ] Contrato Social or Estatuto Social (current version, <6 months old)
  - [ ] Last CNPJ registration update (Certidão de Regularização)
  - [ ] Proof of address (utility bill <3 months old for lab location)
  - [ ] Authorization letter from lab director (template: Item 7)

- [ ] **Verify lab's CNES registration (if applicable)**
  - CNES (Cadastro Nacional de Estabelecimentos de Saúde) is mandatory for some labs.
  - Go to: https://www.cnes.datasus.gov.br/
  - If registered, document CNES number: ___________________
  - If not registered, check if required for your state/municipality (contact health authority).

**Owner signature:** _________________ (Finance/Legal) **Date:** _______

---

### Item 5: Obtain Lab Director Authorization Letter

**Requirement:** Lab director must sign a formal authorization letter for NOTIVISA integration.

**Action Items:**

- [ ] **Generate authorization letter**
  - Use template below or adapt to lab's legal template
  - Must be on lab letterhead (with official seal if available)
  - Signature: **handwritten or ICP-Brasil digital signature** (both acceptable)

**AUTHORIZATION LETTER TEMPLATE:**

```
[Lab Name] Letterhead

[City], [Date: DD/MM/YYYY]

AUTORIZAÇÃO PARA INTEGRAÇÃO NOTIVISA

À Agência Nacional de Vigilância Sanitária (ANVISA)

Identificação do Laboratório:
- Razão Social: [Official lab name]
- CNPJ: [XX.XXX.XXX/XXXX-XX]
- CNES (if applicable): [___________]
- Endereço: [Full street address, city, state, ZIP, Brazil]
- Telefone: [XX] XXXX-XXXX
- Email de contato: [email@lab.com.br]

Responsável Técnico:
- Nome completo: [RT name]
- CPF: [XXX.XXX.XXX-XX]
- RG: [XX.XXX.XXX-X]
- Profissão: Farmacêutico | Médico | Biomédico
- Registro profissional (CFF/CREA/CFBM): [___________]
- Email: [rt@lab.com.br]
- Telefone: [XX] XXXXX-XXXX

Diretor Laboratorial:
- Nome completo: [Director name]
- CPF: [XXX.XXX.XXX-XX]
- Profissão: [___________]
- Email: [director@lab.com.br]

---

OBJETO:

O Laboratório acima identificado solicita registro e autorização para integração com o
Sistema NOTIVISA da ANVISA conforme RDC 978 Art. 66 (notificação de eventos adversos
e de resultados críticos de análises clínicas).

Confirmamos que:

1. O Laboratório está legalmente constituído e em funcionamento regular.
2. O Responsável Técnico nomeado é devidamente habilitado e responsável pela supervisão
   técnica das análises clínicas e pela conformidade com NOTIVISA.
3. O Laboratório implementará sistema de notificação automática de resultados críticos
   conforme cronograma NOTIVISA e RDC 978.
4. Todos os dados transmitidos ao NOTIVISA serão mantidos confidenciais e sob sigilo.
5. Assinaturas digitais cumprem Lei 14.063/2020 (assinatura eletrônica) e ICP-Brasil.
6. Auditoria completa e imutável será mantida de todos os envios a NOTIVISA.
7. O Laboratório assume responsabilidade pelo cumprimento de RDC 978 Art. 66 (prazo de
   24 horas para notificação de eventos adversos e resultados críticos).

---

Autorizado por:

_________________________________           Data: ___/___/______
[Lab Director Name and Signature]
[Lab Director CPF]

Responsável Técnico:

_________________________________           Data: ___/___/______
[RT Name and Signature]
[RT CPF]
```

- [ ] **Signature method:**
  - [ ] Handwritten signature (traditional, requires original document)
  - [ ] ICP-Brasil digital signature (preferred; can be transmitted electronically)
    - See Item 16 for digital certificate setup

- [ ] **Attachment:** Store original or certified copy in registration folder

**Owner signature:** _________________ (Lab Director) **Date:** _______

---

### Item 6: RT Credentials Documentation

**Requirement:** Compile all RT professional credentials required by Anvisa.

**Action Items:**

- [ ] **Collect RT identity documents:**
  - [ ] CPF (documento de identificação com 11 dígitos): [___________]
  - [ ] RG or passport copy (valid ID)
  - [ ] Professional registration certificate (CFF/CREA/CFBM)
  - [ ] Professional registration status: Active ✓ | Lapsed ✗
  - *Note:* Lapsed credentials may delay registration; renew if needed.

- [ ] **RT digital signature credential (if using ICP-Brasil):**
  - [ ] RT has valid ICP-Brasil certificate (e-CPF or equivalent)
  - [ ] Certificate is stored securely (see Item 16)
  - [ ] RT has access to certificate (hardware token, software, cloud vault)

- [ ] **Verify RT's Anvisa portal account:**
  - [ ] RT logged into https://portalanvisa.gov.br/ successfully
  - [ ] Account shows RT's name + CPF correctly
  - [ ] Account status: "Ativo" (not suspended or pending)

**Owner signature:** _________________ (RT) **Date:** _______

---

## Part 3: Technical Prerequisites & System Readiness

**Lead:** CTO + Engineering | **Support:** RT, Ops | **Timeline:** 5–10 business days

### Item 7: Confirm NOTIVISA API Documentation Access

**Requirement:** Obtain official Anvisa NOTIVISA API specification (schema, endpoints, authentication).

**Action Items:**

- [ ] **Download NOTIVISA API documentation**
  - Source: https://notivisa.anvisa.gov.br/ (official portal)
  - Or contact Anvisa: support-notivisa@anvisa.gov.br
  - Version: Confirm you have v3.0 or latest (as of 2026-05)
  - File path: `docs/NOTIVISA_API_v3.0_Official_Reference.pdf`

- [ ] **Validate documentation includes:**
  - [ ] Authentication method (OAuth 2.0, API key, mTLS, or other)
  - [ ] Endpoint URLs (sandbox + production distinction)
  - [ ] Mandatory fields for disease notification (per Portaria 204/2016 Art. 6º)
  - [ ] Request/response schema (JSON or XML)
  - [ ] Error codes and retry policy
  - [ ] Rate limits (requests/minute, requests/day)
  - [ ] Webhook callback specification (if applicable)

- [ ] **Confirm schema includes Portaria 204/2016 Art. 6º fields:**
  ```
  Required fields (15 mandatory per MS):
  - resultId or exameId
  - labId or estabelecimentoId
  - rtId or responsavelTecnicoId
  - patientIdentifier (anonymized per LGPD)
  - diseaseCode (from 99-disease list)
  - analyteName (exam name)
  - resultValue (numeric or categorical)
  - units (if numeric)
  - referenceRange (if numeric)
  - interpretation (normal/abnormal/critical)
  - testMethodology
  - resultDate (ISO 8601)
  - notificationDeadline (must be ≤24h from result verification)
  - operatorId (RT or technician ID)
  - timestamp (submission timestamp)
  ```

- [ ] **Document schema mapping**
  - File path: `functions/src/types/notivisa.ts` (Zod schema)
  - All 15 fields mapped to HC Quality data model

**Owner signature:** _________________ (CTO) **Date:** _______

---

### Item 8: Confirm Portaria 204/2016 Disease List Seed Data

**Requirement:** Load the 99 mandatory notifiable diseases list into HC Quality.

**Action Items:**

- [ ] **Obtain official disease list**
  - Source: Portaria 204/2016 (Ministério da Saúde)
  - File: `docs/PORTARIA_204_2016_DOENCAS_NOTIFICAVEIS.pdf`
  - List contains: 99 diseases with codes (e.g., "99078" = Syphilis)

- [ ] **Load disease list into Firestore**
  - Collection: `labs/{labId}/notivisa-config/doencasNotificaveis`
  - Schema: `{code: string, nome: string, agente: string, modo_transmissao?: string, habitat?: string}`
  - Expected records: 99 (or regional subset if lab notifies only specific diseases)

- [ ] **Configure lab-level disease filters**
  - [ ] Lab director reviews disease list and marks diseases relevant to lab
  - [ ] Example: Clinical lab does not test for plague (rare) → mark `enabled: false`
  - [ ] Default: All 99 enabled initially; director can disable non-applicable ones
  - Firestore path: `labs/{labId}/notivisa-config/doencasNotificaveis/{diseaseCode}/enabled`

- [ ] **Document disease list in ops runbook**
  - File: `docs/NOTIVISA_LAB_DISEASE_CONFIG.md`
  - For auditor reference

**Owner signature:** _________________ (CTO / Ops) **Date:** _______

---

### Item 9: Prepare Sandbox API Test Credentials Storage

**Requirement:** Plan secure storage for sandbox API credentials before Anvisa provisions them.

**Action Items:**

- [ ] **Create Firebase Secrets Manager entries** (will be populated after sandbox provisioning)
  - Secret 1: `notivisa_sandbox_api_key` (or Bearer token)
  - Secret 2: `notivisa_sandbox_endpoint` (sandbox URL, e.g., https://sandbox.notivisa.gov.br/api)
  - Secret 3: `notivisa_sandbox_cert` (if mTLS required; optional)
  - Retention: Keep until production certificate obtained (estimated v1.5 timeline)

- [ ] **Configure access permissions**
  - [ ] Cloud Function `notivisaQueueProcessor` can read secrets
  - [ ] Cloud Function `notivisaWebhookReceiver` can read secrets
  - [ ] Only CTO/DevOps can rotate secrets
  - [ ] Audit logs enabled (Cloud Audit Logs)

- [ ] **Document credential rotation schedule**
  - Rotation frequency: 90 days
  - Next rotation: ___________________
  - Owner: CTO / Ops

- [ ] **Create fallback/backup credentials**
  - [ ] Request secondary API key from Anvisa (in case primary is compromised)
  - [ ] Store backup in separate secrets manager entry: `notivisa_sandbox_api_key_backup`
  - [ ] Test backup key periodically (monthly)

**Owner signature:** _________________ (CTO) **Date:** _______

---

## Part 4: Compliance & Risk Assessment

**Lead:** CTO + Compliance Officer | **Support:** RT, Lab Director | **Timeline:** 3–5 business days

### Item 10: Map RDC 978 Art. 66 Compliance Path

**Requirement:** Document how HC Quality addresses RDC 978 Art. 66 (notification requirements).

**Action Items:**

- [ ] **Confirm Art. 66 obligation**
  - Article 66 requires: Lab must notify healthcare professional and/or health authority of critical results within 24 hours.
  - Definition of "critical": Results that pose immediate risk to patient (e.g., blood glucose <40 mg/dL, potassium <2.5 mmol/L, etc.)
  - NOTIVISA is one notification channel (to Anvisa/health authority); professional notification is separate.

- [ ] **Document HC Quality compliance approach**
  ```
  Phase 4 (v1.4, Sandbox):
  - Auto-detect critical results in lab analyzer feeds
  - Generate NOTIVISA draft form (XML or JSON)
  - RT approves draft (manual review gate)
  - System records approval in audit trail
  - Export to PDF for manual submission to Anvisa portal
  
  Phase 12+ (v1.5+, Production):
  - Same as above + auto-submit to Anvisa NOTIVISA API
  - Receive receipt code from Anvisa
  - Track submission in audit trail
  ```

- [ ] **File:** Attach compliance map to registration folder
  - Path: `docs/RDC_978_ART66_COMPLIANCE_MAP.md`

**Owner signature:** _________________ (Compliance Officer / CTO) **Date:** _______

---

### Item 11: Risk Assessment & Mitigation Plan

**Requirement:** Identify risks related to NOTIVISA integration and plan mitigations.

**Action Items:**

- [ ] **Identify key risks:**
  - [ ] **Risk 1: Government API instability** — Anvisa API may be slow or unavailable
    - Mitigation: Implement exponential backoff + retry queue (max 5 retries, ~10 min window)
    - Fallback: Manual export PDF + submit to Anvisa portal by RT
    - Monitoring: Alert ops if >50% failures in 1-hour window

  - [ ] **Risk 2: Certificate provisioning delay** — v1.5 production submission blocked if certificate unavailable
    - Mitigation: Start certificate request immediately (Item 16); target completion by 2026-08-31
    - Fallback: Continue manual submission until certificate ready
    - Owner: CTO + Ops (legal track)

  - [ ] **Risk 3: Data schema mismatch** — API update breaks payload validation
    - Mitigation: Monitor Anvisa announcements; version schema in Zod
    - Testing: Re-validate schema quarterly against official docs
    - Owner: CTO

  - [ ] **Risk 4: PII exposure in audit logs** — LGPD violation if patient data logged
    - Mitigation: Mask patient identifiers; log only operator ID, not operator name
    - Testing: Audit log review quarterly (Item 20)
    - Owner: Compliance Officer

  - [ ] **Risk 5: RT unavailability** — Primary RT absent, secondary contact needed
    - Mitigation: Designate backup RT (Item 2); test quarterly
    - Owner: Lab Director

- [ ] **Risk register file:**
  - Path: `docs/NOTIVISA_RISK_REGISTER.md`
  - Format: Risk | Likelihood | Impact | Mitigation | Owner | Status

**Owner signature:** _________________ (CTO / Compliance Officer) **Date:** _______

---

## Part 5: Digital Certification & Electronic Signature

**Lead:** Lab Director + CTO | **Support:** Finance | **Timeline:** 4–6 weeks

### Item 12: Plan ICP-Brasil Digital Certificate Acquisition

**Requirement:** Obtain e-CNPJ (ICP-Brasil) digital certificate for RT signature on NOTIVISA submissions.

**Action Items:**

- [ ] **Decide certificate type and validity**
  - [ ] **e-CNPJ A1 (software certificate on hardware token)**
    - Validity: 1 year
    - Cost: R$ 170–300 per year
    - Portability: Requires physical token
    - Use case: Lab IT staff can carry token to sign forms offline or in restricted networks
    - Vendor examples: Valid Certificadora, Certisign, XP Certificados, AR CFM

  - [ ] **e-CNPJ A3 (cloud-based certificate)**
    - Validity: 1–3 years
    - Cost: R$ 300–600
    - Portability: Access from anywhere (more convenient)
    - Use case: RT signs online in HC Quality UI or API
    - Vendor examples: Same as above

  - [ ] **Recommendation:** A1 for air-gapped signing (security); A3 for convenience
    - For HC Quality Phase 4, recommend **A1 token** (stricter security posture)
    - Plan transition to **A3 cloud** in v1.5 if automation increases

- [ ] **Verify RT eligibility**
  - [ ] RT has valid CPF
  - [ ] RT has valid professional registration (CFF/CREA/CFBM)
  - [ ] Lab CNPJ is active ("ativa" status)

- [ ] **Initiate certificate request**
  - [ ] Contact chosen ICP-Brasil issuer (e.g., Certisign, Valid)
  - [ ] Provide RT details: CPF, professional registration, email
  - [ ] Provide lab details: CNPJ, lab address
  - [ ] Expected turnaround: 3–5 business days
  - [ ] Cost approval from lab director: ✓ Approved | ✗ Deferred

- [ ] **Delivery and setup**
  - [ ] Physical token received (if A1) or email credentials (if A3)
  - [ ] RT tests certificate login with issuer's portal
  - [ ] CTO configures certificate in HC Quality (see Item 13)
  - [ ] Certificate expiry calendar reminder set (90 days before expiration)

- [ ] **Legal compliance reminder**
  - [ ] Certificate complies with Lei 14.063/2020 (electronic signature law)
  - [ ] RT signature on NOTIVISA forms has same legal weight as handwritten signature
  - [ ] Evidence: Signature timestamp + certificate details stored immutably in audit trail

**Owner signature:** _________________ (Lab Director / CTO) **Date:** _______

---

### Item 13: Configure Digital Certificate in HC Quality

**Requirement:** Integrate ICP-Brasil certificate into HC Quality's NOTIVISA signing flow.

**Action Items:**

- [ ] **Load certificate into Cloud Secret Manager**
  - [ ] If A1 token: Store token files + PIN in Secrets Manager
    - Secret name: `notivisa_rt_certificate_a1`
    - Secret format: PKCS#12 (.pfx file, base64-encoded) + PIN
  - [ ] If A3 cloud: Store credentials for cloud signature service
    - Secret name: `notivisa_rt_certificate_a3`
    - Secret format: OAuth token or API key for cloud signer

- [ ] **Verify certificate in functions**
  - [ ] Code location: `functions/src/services/notivisaCryptoService.ts`
  - [ ] Function `signNotivisaDraft()` loads certificate and applies RT signature
  - [ ] Test: Sign a sample NOTIVISA form; verify signature validates

- [ ] **Add certificate details to audit trail**
  - [ ] Every signed form includes: Certificate issuer, certificate serial number, signature timestamp
  - [ ] For auditor: Proof of RT authority to sign

**Owner signature:** _________________ (CTO) **Date:** _______

---

### Item 14: Plan Certificate Renewal & Rotation

**Requirement:** Establish schedule for certificate renewal before expiration.

**Action Items:**

- [ ] **Certificate expiry date:** ____/____/______
  - [ ] Add calendar reminder: 90 days before expiry
  - [ ] Add calendar reminder: 30 days before expiry (final warning)

- [ ] **Renewal process (to be executed at 90-day mark):**
  - [ ] Contact issuer; request certificate renewal
  - [ ] Expected turnaround: 3–5 business days
  - [ ] Once received, update Secrets Manager (Item 13)
  - [ ] Test signed form again with new certificate
  - [ ] Old certificate: Archive or revoke (per issuer policy)

- [ ] **Responsibility assignment:**
  - Owner: CTO
  - Backup: Ops team lead
  - Escalation: Lab Director

**Owner signature:** _________________ (CTO) **Date:** _______

---

## Part 6: Sandbox API Registration & Testing

**Lead:** CTO + Engineering | **Support:** RT, Ops | **Timeline:** 3–5 days (government processing)

### Item 15: Submit Sandbox Registration Form to Anvisa

**Requirement:** Formally register with Anvisa NOTIVISA program and request sandbox credentials.

**Action Items:**

- [ ] **Prepare registration submission package:**
  - [ ] Authorization letter from lab director (Item 5)
  - [ ] RT credentials (Item 6)
  - [ ] CNPJ proof and corporate registration (Item 4)
  - [ ] Signed statement of NOTIVISA obligations (see template below)
  - [ ] Technical contact info (CTO or engineering lead)

**REGISTRATION SUBMISSION TEMPLATE:**

```
[Lab Name] official letterhead

[City], [Date: DD/MM/YYYY]

SOLICITAÇÃO DE REGISTRO NOTIVISA — LABORATÓRIO CLÍNICO

À Anvisa — Sistema NOTIVISA

Prezados Senhores,

O Laboratório [Lab Name], CNPJ [XX.XXX.XXX/XXXX-XX], localizado em
[Address, City, State, Brazil], solicita registro e acesso ao sistema
NOTIVISA para notificação de eventos adversos e resultados críticos
de análises clínicas, conforme RDC 978 Art. 66.

INFORMAÇÕES DO LABORATÓRIO:
- Razão Social: [official name]
- CNPJ: [XX.XXX.XXX/XXXX-XX]
- CNES (se aplicável): [___________]
- Endereço: [Full address]
- Telefone: [XX] XXXX-XXXX
- Email: [email@lab.com.br]

RESPONSÁVEL TÉCNICO:
- Nome: [RT name]
- CPF: [XXX.XXX.XXX-XX]
- Profissão: Farmacêutico | Médico | Biomédico
- Registro profissional: [CFF/CREA/CFBM number]
- Email: [rt@lab.com.br]
- Telefone: [XX] XXXXX-XXXX

CONTATO TÉCNICO (HC Quality CTO/Engineering):
- Nome: [CTO name]
- Email: [cto@hcquality.com]
- Telefone: [CTO phone]

SOLICITAÇÃO:
1. Provisão de credenciais de API para sandbox NOTIVISA
   (para testes de integração de sistema, sem submissões reais)
2. Documentação oficial da API v3.0 (schema, endpoints, autenticação)
3. Confirmação de taxa de notificação / rate limits
4. Contato técnico de Anvisa para suporte durante integração

CONFIRMAÇÕES:
- [ ] O laboratório está legalmente constituído e em funcionamento
- [ ] RT é devidamente habilitado conforme RDC 978 Art. 4º
- [ ] Auditoria imutável será mantida de todas as submissões
- [ ] Dados de pacientes serão transmitidos apenas quando críticos
- [ ] Confidencialidade e LGPD serão respeitadas
- [ ] Cronograma: Integração sandbox até 2026-05-19; produção até 2026-11-30

Atenciosamente,

_________________________________
[Lab Director Name and Signature]
[Lab Director CPF]
[Lab Director Title]

_________________________________
[RT Name and Signature]
[RT CPF]
[RT Professional Registration]
```

- [ ] **Submission method:**
  - [ ] Email to: (contact from Item 1 — Anvisa NOTIVISA office)
  - [ ] Or use: NOTIVISA portal (https://portalanvisa.gov.br/) if online submission available
  - [ ] Subject: "Solicitação de Registro NOTIVISA — [Lab Name] CNPJ [XX.XXX.XXX/XXXX-XX]"

- [ ] **Expected timeline:**
  - Submission: By 2026-05-10 (to meet Phase 4 kickoff)
  - Anvisa review: 3–5 business days
  - Credential provisioning: Expected by 2026-05-15
  - Success criterion: Receive sandbox API key + endpoint URL

- [ ] **Document submission:**
  - [ ] Email sent to Anvisa on: ____/____/______ at ____:____ (include Sent timestamp)
  - [ ] Email subject: ___________________________________
  - [ ] Recipient(s): ___________________________________
  - [ ] Confirmation receipt from Anvisa: ✓ Received | ⏳ Pending

**Owner signature:** _________________ (CTO) **Date:** _______

---

### Item 16: Receive Sandbox API Credentials from Anvisa

**Requirement:** Collect and validate sandbox credentials; store securely.

**Action Items:**

- [ ] **Upon receipt from Anvisa, verify credentials include:**
  - [ ] API endpoint URL (sandbox): ___________________
  - [ ] API key or Bearer token: ___________________
  - [ ] Certificate file (if mTLS required): ___________________
  - [ ] Authentication method (OAuth 2.0 | API Key | mTLS | other): ___________________
  - [ ] Rate limits (requests/minute, requests/day): ___________________
  - [ ] Webhook callback URL (if NOTIVISA pushes notifications): ___________________
  - [ ] Webhook signing key (for validating callback signatures): ___________________
  - [ ] Expiry date of sandbox credentials: ____/____/______
  - [ ] Contact for sandbox support: ___________________

- [ ] **Validate credentials with manual test**
  - [ ] Test API connectivity with cURL or Postman
  - [ ] Expected: HTTP 200 or 401 (auth error is okay; proves connectivity)
  - [ ] Document test result: ✓ Success | ✗ Failed

  ```bash
  # Example test (replace with actual values)
  curl -X POST https://sandbox.notivisa.gov.br/api/authenticate \
    -H "Authorization: Bearer <SANDBOX_API_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"lab_id": "<CNPJ>"}'
  ```

- [ ] **Store credentials securely** (see Item 9)
  - [ ] Secrets Manager entry: `notivisa_sandbox_api_key`
  - [ ] Secrets Manager entry: `notivisa_sandbox_endpoint`
  - [ ] Secrets Manager entry: `notivisa_sandbox_cert` (if applicable)
  - [ ] Access logs enabled (Cloud Audit Logs)

- [ ] **Document in ops runbook**
  - [ ] File: `docs/NOTIVISA_SANDBOX_CREDENTIALS_REFERENCE.md`
  - [ ] Include: Endpoint URL, auth method, expiry date, support contact
  - [ ] Restriction: Only CTO/Ops can read this file

**Owner signature:** _________________ (CTO) **Date:** _______

---

### Item 17: Test Sandbox Integration with Sample Submissions

**Requirement:** Validate sandbox integration before Phase 4 deployment.

**Action Items:**

- [ ] **Create test dataset**
  - [ ] Generate 5 sample critical results (e.g., glucose <40, potassium <2.5)
  - [ ] Include 3 different notifiable diseases from Portaria 204 list
  - [ ] Test with realistic lab data (anonymized patient info per LGPD)

- [ ] **Execute sandbox test submissions**
  - [ ] Manually trigger NOTIVISA draft generation
  - [ ] RT approves draft in HC Quality UI
  - [ ] System submits to Anvisa sandbox API
  - [ ] Capture response: ✓ Success (receipt code) | ✗ Error (error code + message)

- [ ] **Validate schema compliance**
  - [ ] Confirm all 15 mandatory Portaria 204 fields present
  - [ ] Confirm result interpretation (normal/abnormal/critical) correct
  - [ ] Confirm timestamp within 24-hour window
  - [ ] Confirm RT ID and signature valid

- [ ] **Test error handling**
  - [ ] Simulate invalid API key → expect HTTP 401
  - [ ] Simulate invalid payload (missing field) → expect HTTP 422
  - [ ] Simulate network timeout → expect retry after backoff
  - [ ] Confirm error logged to audit trail without exposing PII

- [ ] **Performance test**
  - [ ] Submit 10 requests in sequence
  - [ ] Expected: Latency <5s per request
  - [ ] Rate limit: Confirm no throttling on <5 req/min

- [ ] **Test report:**
  - [ ] File: `docs/NOTIVISA_SANDBOX_TEST_RESULTS.md`
  - [ ] Document: Test date, results (pass/fail), latency, error handling

**Owner signature:** _________________ (CTO / Engineering) **Date:** _______

---

## Part 7: Audit Trail & Compliance Documentation

**Lead:** Compliance Officer + CTO | **Support:** Ops, Engineering | **Timeline:** 5–10 business days

### Item 18: Implement Audit Trail for NOTIVISA Submissions

**Requirement:** Create immutable audit log of all NOTIVISA-related actions (RDC 978 Art. 5.3 + DICQ 4.4).

**Action Items:**

- [ ] **Design audit trail schema**
  - Collection: `labs/{labId}/notivisa-outbox/{docId}/events`
  - Schema:
    ```typescript
    interface NotivisaAuditEvent {
      id: string;
      type: 'draft_created' | 'draft_approved' | 'draft_rejected' | 'submitted' | 'acknowledged' | 'failed' | 'retried';
      timestamp: Timestamp;
      operatorId: string; // RT ID
      operatorEmail?: string; // For context (masked in logs)
      diseaseCode: string;
      patientDataHash: string; // Hash of anonymized patient ID (LGPD safe)
      httpStatus?: number;
      errorMessage?: string; // Sanitized (no PII)
      receiptCodeFromAnvisa?: string;
      signature: LogicalSignature; // HMAC seal per ADR-0012
    }
    ```

- [ ] **Implement append-only security rules**
  - [ ] Firestore Rules block all updates/deletes to `events` subcollection
  - [ ] Only Cloud Functions can write (via server context)
  - [ ] Read access: Lab admin + RT + auditor only

- [ ] **Log all events:**
  - [ ] Draft created (auto-detect critical result)
  - [ ] Draft approved by RT (RT clicks "Approve")
  - [ ] Draft rejected by RT (RT clicks "Reject" + reason)
  - [ ] Submission to Anvisa (API call + HTTP status)
  - [ ] Webhook callback from Anvisa (if received)
  - [ ] Error/retry (exponential backoff step)

- [ ] **Testing:**
  - [ ] Generate sample audit trail with 10 events
  - [ ] Verify immutability (try to delete event → should fail)
  - [ ] Verify no PII in logs (scan for CPF, names, patient IDs)

**Owner signature:** _________________ (Compliance Officer) **Date:** _______

---

### Item 19: Create Daily Audit Report & Export

**Requirement:** Generate daily NOTIVISA submission report for auditors and compliance monitoring.

**Action Items:**

- [ ] **Cloud Function: Generate daily report**
  - [ ] Schedule: Daily at 6:00 AM BRT (via Cloud Scheduler)
  - [ ] Scope: All NOTIVISA submissions from previous 24 hours
  - [ ] Output format: JSON + CSV (for Excel export)
  - [ ] Fields: Lab ID, RT ID, disease code, submission count, success rate, errors
  - [ ] Storage: `gs://hmatologia2-reports/notivisa-daily-{YYYY-MM-DD}.json`

- [ ] **Report distribution**
  - [ ] Email to lab director daily (if submissions occurred)
  - [ ] Email to CTO/Ops (alert if error rate >5%)
  - [ ] Slack notification (#hc-quality-ops) for >10 submissions

- [ ] **Monthly compliance audit export**
  - [ ] Generate monthly summary report
  - [ ] Include: Total submissions, by disease code, error categories
  - [ ] Auditor-ready format: PDF + signed by CTO

- [ ] **Code location:**
  - [ ] Cloud Function: `functions/src/callables/generateNotivisaDailyReport.ts`
  - [ ] Scheduler config: `firebase.json` (cloudScheduler section)

**Owner signature:** _________________ (Ops / Compliance Officer) **Date:** _______

---

### Item 20: Quarterly Audit Trail Review & PII Validation

**Requirement:** Quarterly audit of NOTIVISA logs to ensure LGPD compliance and no PII exposure.

**Action Items:**

- [ ] **Quarterly review schedule:**
  - Q1 (Mar): Initial review (post-Phase 4 deployment)
  - Q2 (Jun): Review + plan for production submission (Phase 12 prep)
  - Q3 (Sep): Spot-check
  - Q4 (Dec): Year-end audit summary

- [ ] **Review checklist:**
  - [ ] Sample 50 random audit events from previous quarter
  - [ ] Verify no CPF, patient name, or sensitive identifiers in logs
  - [ ] Confirm RT ID present (for traceability)
  - [ ] Verify timestamp + signature present (for audit integrity)
  - [ ] Check error messages are sanitized (no SQL, no credentials)
  - [ ] Confirm soft-delete only (no hard deletes in immutable collections)

- [ ] **Findings & remediation:**
  - [ ] Document any PII exposure in risk register
  - [ ] If PII found: Immediately redact logs + alert compliance officer
  - [ ] File report: `docs/NOTIVISA_QUARTERLY_AUDIT_REVIEW_Q[1-4].md`

**Owner signature:** _________________ (Compliance Officer / CTO) **Date:** _______

---

## Part 8: Ops Readiness & Go-Live

**Lead:** Ops / DevOps | **Support:** CTO, Engineering, RT | **Timeline:** 2–3 business days

### Item 21: Prepare Ops Runbook & Escalation Procedures

**Requirement:** Document operational procedures for monitoring, troubleshooting, and escalating NOTIVISA issues.

**Action Items:**

- [ ] **Runbook topics:**
  - [ ] Daily health checks (submission queue depth, error rate)
  - [ ] Alert thresholds & notifications
  - [ ] Manual retry procedure (if automatic retry fails)
  - [ ] Anvisa API outage response
  - [ ] RT availability fallback (primary RT unavailable)
  - [ ] Common errors & quick fixes (auth failures, schema validation, timeouts)
  - [ ] Certificate expiry & renewal steps
  - [ ] Log inspection & debugging

- [ ] **Runbook location:**
  - [ ] File: `docs/NOTIVISA_OPS_RUNBOOK.md`
  - [ ] Audience: Ops team, on-call engineer, CTO
  - [ ] Format: Markdown with decision trees (e.g., "If error rate >20%, do X; if rate <5%, do Y")

- [ ] **Escalation contacts:**
  - Level 1 (Ops): Try manual retry, check logs, restart function
  - Level 2 (CTO): Verify API credentials, check Anvisa status page, contact Anvisa support
  - Level 3 (Lab Director): Activate fallback (manual submission to Anvisa portal)

- [ ] **Escalation triggers:**
  - [ ] >50% submission failure rate in 1 hour
  - [ ] Queue depth >100 pending events
  - [ ] Anvisa API not responding (3+ consecutive failures)
  - [ ] RT account suspended or credentials expired

**Owner signature:** _________________ (Ops Lead) **Date:** _______

---

### Item 22: Configure Monitoring & Alerting

**Requirement:** Set up Cloud Monitoring to track NOTIVISA health.

**Action Items:**

- [ ] **Metrics to monitor:**
  - [ ] Queue depth: `notivisa-outbox` documents with `status = 'pending'` (target: <10)
  - [ ] Error rate: Failed submissions / total submissions (target: <5%)
  - [ ] Submission latency: Time from draft creation to Anvisa submission (target: <10s)
  - [ ] API response time: Anvisa API latency (target: <5s)
  - [ ] Webhook success rate: Anvisa callbacks processed successfully (target: >95%)

- [ ] **Alerts (Firebase Cloud Monitoring):**
  - [ ] Alert 1: Queue depth >50 → notify Ops
  - [ ] Alert 2: Error rate >10% (in 30-min window) → notify CTO
  - [ ] Alert 3: Submission latency >30s → notify Ops
  - [ ] Alert 4: Webhook failures >5 consecutive → notify CTO + Ops

- [ ] **Dashboards:**
  - [ ] Dashboard: "HC Quality — NOTIVISA Health"
  - [ ] Widgets: Queue depth, error rate, latency, submission count (graph over 24h)
  - [ ] Location: Firebase Console → Firestore → Custom Metrics → NOTIVISA

- [ ] **Integration:**
  - [ ] Slack webhook for alerts: `https://hooks.slack.com/services/...` (#hc-quality-ops channel)
  - [ ] Email alerts to ops@lab.com (daily summary)
  - [ ] PagerDuty integration (if on-call rotation active)

**Owner signature:** _________________ (Ops / DevOps) **Date:** _______

---

### Item 23: Conduct Phase 4 Readiness Gate Review

**Requirement:** Final sign-off before Phase 4 deployment (2026-05-20 kickoff).

**Action Items:**

- [ ] **Pre-deployment checklist (independent review):**
  - [ ] All 22 items above: ✓ Complete | ✗ Incomplete
  - [ ] Sandbox credentials received & tested: ✓ Yes | ✗ No
  - [ ] Firestore Rules deployed with NOTIVISA collection rules: ✓ Yes | ✗ No
  - [ ] Cloud Functions deployed (notivisaQueueProcessor, notivisaWebhookReceiver): ✓ Yes | ✗ No
  - [ ] Audit trail schema created & tested: ✓ Yes | ✗ No
  - [ ] Ops runbook completed & reviewed by team: ✓ Yes | ✗ No
  - [ ] Monitoring & alerting configured: ✓ Yes | ✗ No
  - [ ] No blocking bugs or warnings (tsc check, lint): ✓ Yes | ✗ No

- [ ] **Stakeholder sign-offs:**
  - [ ] Lab Director: _________________ Date: _______
  - [ ] RT: _________________ Date: _______
  - [ ] CTO: _________________ Date: _______
  - [ ] Compliance Officer: _________________ Date: _______
  - [ ] Ops Lead: _________________ Date: _______

- [ ] **Gate decision:**
  - [ ] ✓ APPROVED — Proceed with Phase 4 deployment
  - [ ] ⏳ DEFERRED — Items pending; target completion date: ____/____/______
  - [ ] ✗ BLOCKED — Critical issues; escalate to CTO

**Owner signature:** _________________ (CTO) **Date:** _______

---

## Part 9: Long-Term (Phase 12+ Production Path)

**Lead:** CTO | **Support:** Ops, RT | **Timeline:** 2026-08 to 2026-11

### Item 24: Certificate Provisioning & Production Readiness (v1.5 Gate)

**Requirement:** Prepare for v1.5 production NOTIVISA API integration (Phase 12+).

**Action Items:**

- [ ] **Certificate acquisition (parallel track, non-blocking for Phase 4):**
  - [ ] Timeline: Initiate by 2026-05-10; target completion by 2026-08-31
  - [ ] Status tracking: Document in project CLAUDE.md (memory section)
  - [ ] Responsibility: Lab Director + Finance (procurement)
  - [ ] Type: e-CNPJ A1 or A3 (see Item 12 for decision)
  - [ ] Cost: Budget approved ✓ | Pending ✗

- [ ] **v1.5 production readiness checklist (to be filled in late 2026):**
  - [ ] Certificate received & validated
  - [ ] Production NOTIVISA credentials provisioned (request separate from sandbox)
  - [ ] Firestore Rules updated (production endpoint instead of sandbox)
  - [ ] API integration code refactored (swapping sandbox/production endpoints)
  - [ ] E2E tests passing with production endpoint
  - [ ] Load testing complete (500 submissions/day nominal, 1000/day spike)
  - [ ] Auditor briefing scheduled (demonstrate full submission workflow)

- [ ] **Timeline gate:**
  - [ ] 2026-11-01: v1.5 planning gate — assess certificate status
  - [ ] If certificate ready: Allocate 1–2 weeks for API integration + testing
  - [ ] If certificate delayed: Document reason + revised timeline

**Owner signature:** _________________ (CTO) **Date:** _______

---

## Appendix A: Contact Information Template

**To be populated by lab:**

```
Lab Name: _________________________________
Lab Address: _______________________________
Lab Phone: __________________________________

Responsável Técnico (RT):
- Name: __________________________________
- CPF: ____________________________________
- Email: __________________________________
- Phone: __________________________________
- Professional registration: _______________
- ANVISA portal username: _________________

Backup RT:
- Name: __________________________________
- Email: __________________________________
- Phone: __________________________________

Lab Director:
- Name: __________________________________
- CPF: ____________________________________
- Email: __________________________________
- Phone: __________________________________

CTO / Technical Contact:
- Name: __________________________________
- Email: __________________________________
- Phone: __________________________________

Ops Lead:
- Name: __________________________________
- Email: __________________________________
- Phone: __________________________________

Anvisa NOTIVISA Office Contact:
- Office name: ____________________________
- Contact person: __________________________
- Email: ___________________________________
- Phone: ___________________________________
- Business hours: __________________________

Anvisa Support (general):
- Hotline: 0800 642 9782 (7:30am–7:30pm BRT, M–F)
```

---

## Appendix B: Timeline Summary

| Milestone | Owner | Target Date | Status |
|-----------|-------|-------------|--------|
| Item 1: Identify Anvisa office | Lab Director | 2026-05-08 | ⏳ |
| Item 2–3: RT + Director designation | Lab Director | 2026-05-08 | ⏳ |
| Item 4–6: Documentation prep | Finance/Legal | 2026-05-10 | ⏳ |
| Item 7–9: Technical setup | CTO | 2026-05-10 | ⏳ |
| Item 5: Authorization letter signed | Lab Director | 2026-05-10 | ⏳ |
| Item 15: Sandbox registration submitted | CTO | 2026-05-10 | ⏳ |
| Item 16: Sandbox credentials received | CTO | 2026-05-15 (est.) | ⏳ |
| Item 17: Sandbox testing complete | Engineering | 2026-05-17 | ⏳ |
| Item 10–14: Compliance & certificate plan | CTO | 2026-05-12 | ⏳ |
| Item 18–20: Audit trail + compliance | Compliance Officer | 2026-05-17 | ⏳ |
| Item 21–23: Ops readiness + gate | Ops Lead | 2026-05-19 | ⏳ |
| **Phase 4 Kickoff** | — | **2026-05-20** | — |
| Item 12–14: Certificate acquisition | Lab Director | 2026-08-31 | ⏳ |
| **Phase 12 Readiness Gate** | CTO | **2026-11-01** | — |
| Production API integration (v1.5) | Engineering | 2026-11-15 (est.) | ⏳ |

---

## Appendix C: Regulatory References

- **RDC 978 Art. 66** — Laboratório clínico deve notificar à Anvisa/autoridade de saúde resultados críticos em prazo ≤24h
- **RDC 978 Art. 6º §1** — Exigência de campos obrigatórios para notificação (15 campos per Portaria 204)
- **Portaria 204/2016 MS** — Lista de 99 doenças notificáveis (diseases of mandatory notification)
- **Lei 14.063/2020** — Lei de assinatura eletrônica (electronic signature framework)
- **RDC 30/2015** — Requisitos para assinatura digital em laudos laboratoriais
- **ICP-Brasil** — Infraestrutura de Chaves Públicas Brasileira (PKI)
- **LGPD** — Lei Geral de Proteção de Dados (Art. 9, 18, 38 — data privacy)

---

## Appendix D: File Paths & Documentation

| File | Owner | Purpose |
|------|-------|---------|
| `docs/NOTIVISA_REGISTRATION_CHECKLIST.md` | Compliance Officer | This file |
| `docs/NOTIVISA_INTEGRATION_SETUP_CHECKLIST.md` | CTO | Sandbox integration tasks |
| `docs/v1.4_NOTIVISA_SANDBOX_SETUP.md` | Ops | Sandbox provisioning guide |
| `docs/RDC_978_ART66_COMPLIANCE_MAP.md` | Compliance Officer | Art. 66 compliance mapping |
| `docs/NOTIVISA_RISK_REGISTER.md` | CTO | Risk tracking |
| `docs/NOTIVISA_OPS_RUNBOOK.md` | Ops | Operational procedures |
| `docs/NOTIVISA_SANDBOX_CREDENTIALS_REFERENCE.md` | CTO | Sandbox API details (restricted) |
| `docs/NOTIVISA_SANDBOX_TEST_RESULTS.md` | Engineering | Test execution results |
| `docs/NOTIVISA_QUARTERLY_AUDIT_REVIEW_Q[1-4].md` | Compliance Officer | Quarterly audit reports |
| `functions/src/types/notivisa.ts` | Engineering | Zod schema + types |
| `functions/src/services/notivisaService.ts` | Engineering | API integration logic |
| `firestore.rules` | CTO | Security rules for collections |

---

## Final Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Lab Director | ___________________ | ___________________ | _______ |
| Responsável Técnico | ___________________ | ___________________ | _______ |
| CTO | ___________________ | ___________________ | _______ |
| Compliance Officer | ___________________ | ___________________ | _______ |
| Ops Lead | ___________________ | ___________________ | _______ |

---

**Document Status:** Ready for Phase 4 execution (2026-05-20)  
**Version:** 1.0  
**Last Updated:** 2026-05-07  
**Next Review:** 2026-06-07 (post-Phase 4 milestone)

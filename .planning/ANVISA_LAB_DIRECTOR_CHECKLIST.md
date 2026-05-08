---
title: "ANVISA Lab Director Checklist — NOTIVISA Sandbox Onboarding"
version: "1.0 (Comprehensive)"
created: "2026-05-07"
updated: "2026-05-07"
status: "Ready for Lab Director Execution — Start TODAY"
milestone: "v1.4 Phase 4 — Task 04-03 (NOTIVISA Integration)"
target_deadline: "2026-05-10 (credentials to CTO)"
audience: "Lab Director + Responsável Técnico (RT) + Administrative staff"
related_docs:
  - v1.4_NOTIVISA_SANDBOX_SETUP.md (technical reference for CTO)
  - ADR-0014 (sandbox-to-production pathway)
  - .planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md
---

# ANVISA Lab Director Checklist
## NOTIVISA Sandbox Onboarding — Quick-Start Guide

**GOAL:** Complete government registration for NOTIVISA sandbox access **by 2026-05-10** to unblock Phase 4 development (2026-05-20 kickoff).

**Timeline expectation:** Government provisioning takes **3–5 business days** after submission. **Start TODAY.**

**Who:** Lab Director (with Responsável Técnico [RT] as co-signer)  
**Time investment:** 45 min prep + 15 min phone call + 3–5 days waiting for ANVISA response  
**Success:** Receive NOTIVISA sandbox API credentials + endpoint URL from ANVISA (email confirmation)

---

## PART A: Pre-Call Preparation (30 min — Do This Now)

### A1. Gather Required Documents

Print/organize these **before** calling ANVISA at 0800 642 9782. Have them within arm's reach during the call.

**Critical Documents:**

- [ ] **Lab CNPJ** — 12-digit corporate registration number
  - Location: Corporate formation documents or verify online at https://www.cnpj.net/
  - Action: Verify status is "ativa" (active) — if not, contact accountant immediately
  - Example format: `12.345.678/0001-95`

- [ ] **RT Full Name** — Responsável Técnico (Technical Director registered with ANVISA)
  - Location: Lab personnel records
  - Action: **RT must test ANVISA login NOW** at https://portalanvisa.gov.br/ — if login fails, RT must re-register first (takes 1–2 days)
  - Required: RT has active ANVISA account

- [ ] **RT CPF** — 11-digit social security number
  - Location: RT ID card or personnel file
  - Action: Verify RT has memorized (will be asked verbally on call)

- [ ] **RT RG** — ID card number (Registro Geral)
  - Location: RT ID card
  - Action: Have this ready to read aloud on call

- [ ] **Complete Lab Address**
  - Street, number, city, state, ZIP code + phone number
  - Location: Lab lease agreement or incorporation papers
  - Action: Write down word-for-word (no abbreviations)

- [ ] **Health Authority Contact** — Regional Secretária de Saúde (Municipal or State Health Department)
  - Location: Google search "[City] Secretária de Saúde" OR https://www.saude.gov.br/
  - Information needed: Name of health secretary/director + phone + email
  - Action: Identify the correct regional health authority for your city/state BEFORE calling

**Pre-Call Checklist:**
- [ ] CNPJ status verified as "ativa" (active)
- [ ] RT ANVISA login tested successfully
- [ ] All 6 documents printed or in hand
- [ ] Lab phone number confirmed and correct
- [ ] Health authority contact identified with phone + email

---

### A2. Review the Calling Script

You will call ANVISA at: **0800 642 9782** (toll-free, Brazil)

**Call Details:**
- **Expected wait time:** 5–15 minutes
- **Language:** Portuguese (Brasil) — you don't need to be fluent, use the phrases below
- **Greeting:** Start with this opening statement

**What to Say (Script):**

```
Olá, sou [Your Name], diretor do [Lab Name]. 
Estou aqui para registrar nosso laboratório no NOTIVISA sandbox 
para integração com nosso sistema de Controle Interno de Qualidade (CIQ), HC Quality.

(Translation: Hello, I am [Your Name], director of [Lab Name]. 
I am here to register our laboratory in NOTIVISA sandbox 
for integration with our Internal Quality Control system, HC Quality.)
```

**Follow up with:**

```
Nós temos um sistema SaaS chamado HC Quality. 
Precisamos do acesso ao sandbox NOTIVISA para testar a integração de notificações 
de eventos adversos em conformidade com RDC 978 Art. 6º §1 e Portaria 204/2016.

(Translation: We have an SaaS system called HC Quality. 
We need access to the NOTIVISA sandbox to test adverse event notification integration 
in compliance with RDC 978 Art. 6º §1 and Portaria 204/2016.)
```

---

### A3. The 7 Critical Questions + Your Answers

**ANVISA will ask these questions.** Write down your answers NOW in the table below (filling in TBD fields as ANVISA provides them).

| # | Question | Your Answer | Notes |
|---|----------|------|-------|
| **1** | **Client ID / Registration ID?** | _(ANVISA generates after registration)_ | Not asked on first call; they will email this to you |
| **2** | **API Secret / API Key format?** | TBD | Ask them: "Em qual formato vocês enviam a chave de API? Via e-mail?" |
| **3** | **Sandbox URL / Endpoint?** | TBD | Ask them: "Qual é a URL base do endpoint sandbox?" |
| **4** | **Webhook format / Response schema?** | TBD | Ask them: "Vocês têm documentação sobre o formato do webhook / resposta da API?" |
| **5** | **Rate limits?** | TBD | Ask them: "Qual é o limite de requisições por hora/dia no sandbox?" |
| **6** | **SLA / Support contact?** | TBD | Ask them: "Qual é o contato para suporte técnico do sandbox?" |
| **7** | **Certificate requirement timeline?** | TBD | Ask them: "Quando precisamos de certificado digital para produção?" |

**Template — Copy & Keep Handy:**
```
ANVISA CALL NOTES — [DATE] [TIME]
Attended by: __________________________ + [RT name if present]
ANVISA Agent name: ____________________

1. Client ID / Registration ID: ____________________________
2. API Key format: ____________________________
3. Sandbox URL: ____________________________
4. Webhook format doc: ____________________________
5. Rate limits: ____________________________
6. Support contact: ____________________________
7. Certificate timeline: ____________________________
```

---

## PART B: The Phone Call (15 min)

**When:** TODAY or tomorrow morning (prioritize this — don't wait)  
**Where:** Call ANVISA at **0800 642 9782** (toll-free)  
**Who:** You (Lab Director) + RT present (optional but recommended for technical questions)  
**Duration:** Expect 15–20 minutes total (waiting + call)

### B1. Step-by-Step Call Flow

1. **Dial 0800 642 9782**
   - You will hear a menu in Portuguese
   - Press the option for "NOTIVISA" or "Integração de Sistemas"

2. **Wait for agent** (~5–15 min)
   - Have documents + pen + notepad ready
   - Stay on the line

3. **Introduce yourself using the script from A2**
   - Speak clearly, slowly
   - It's OK if you have a slight accent

4. **Provide documents when asked:**
   - Lab CNPJ
   - RT full name, CPF, RG
   - Lab address + phone
   - Health authority contact

5. **Ask the 7 critical questions (from A3)**
   - Write down EVERY answer
   - If unsure, ask them to repeat: **"Pode repetir, por favor?"** (Can you repeat, please?)

6. **Confirm final details:**
   - Ask: **"Vocês enviarão a chave de API por e-mail para qual endereço?"** (What email address will you send the API key to?)
   - Confirm email address where credentials will arrive
   - Ask: **"Quanto tempo leva para receber as credenciais?"** (How long does it take to receive credentials?)
   - Expected answer: 3–5 business days

7. **Get a reference ticket number:**
   - Ask: **"Qual é o número do ticket / ID de registro para acompanhamento?"** (What is the ticket/registration ID for tracking?)
   - Write this down — you'll need it later if there are issues

### B2. If Agent Says "Sandbox Not Available Yet"

**If ANVISA says sandbox is not ready:**
- Ask: "Qual é a data estimada de disponibilidade?" (What is the estimated availability date?)
- Get a timeline
- **Email CTO immediately** (drogafarto@gmail.com) with the timeline
- Adjust Phase 4 kickoff accordingly

**If ANVISA says "You must use production API instead":**
- This is unusual but possible
- Politely ask: "Precisamos primeiro validar a integração em ambiente sandbox antes de produção." (We need to validate integration in sandbox first before production.)
- Insist on sandbox access
- If they refuse, email CTO for escalation

---

## PART C: Follow-Up Email (5 min — Send Right After Call)

**Timing:** Send within 1 hour of call completion

**To:** ANVISA agent contact (ask for their email during the call)  
**CC:** drogafarto@gmail.com (HC Quality CTO)  
**Subject:** `[CONFIRMAÇÃO] Registro NOTIVISA - Laboratório [LAB NAME]`

**Email Template** (in Portuguese):

```
Prezados,

Segue confirmação dos dados coletados durante nossa chamada de registro 
NOTIVISA para a integração do sistema HC Quality.

DADOS DO LABORATÓRIO:
- CNPJ: [your CNPJ]
- Razão Social: [Lab name]
- Responsável Técnico: [RT name], CPF [11 digits], RG [RG number]
- Endereço: [Full address]
- Telefone: [Phone]

AUTORIDADE DE SAÚDE:
- Secretária: [Health authority name]
- Contato: [Contact person name]
- Email: [Email]
- Telefone: [Phone]

DADOS COLETADOS DA CHAMADA:
- ID de Registro / Ticket: [ANVISA ticket number]
- Formato da Chave de API: [Format they specified]
- URL do Sandbox: [Sandbox endpoint URL]
- Documentação do Webhook: [Link or format they provided]
- Limite de Taxa: [Rate limits they specified]
- Contato de Suporte: [Support contact name + email]
- Timeline para Certificado: [Certificate timeline]

Solicitamos confirmação de:
1. Quando as credenciais de sandbox serão enviadas (esperado: 3-5 dias)?
2. Para qual e-mail as credenciais serão enviadas?
3. Se há documentação adicional que precisamos revisar antes de iniciar a integração?

Qualquer dúvida, favor entrar em contato conosco.

Atenciosamente,
[Your Full Name]
[Your Title]
[Lab Name]
[Your Phone]
[Your Email]
```

---

## PART D: Credentials Arrive from ANVISA (3–5 days)

**Timeline:** You should receive an email from ANVISA within 3–5 business days

**The email will contain:**

1. **NOTIVISA Sandbox API Key**
   - Format: Alphanumeric string, ~32–64 characters
   - Example: `sk_sandbox_abc123def456ghi789jkl012mno34p`
   - **SECURITY:** Treat this like a password — never post in Slack or chat

2. **Sandbox Endpoint URL**
   - Format: HTTPS URL to the sandbox API
   - Example: `https://sandbox.notivisa.gov.br/api/v1/`

3. **Documentation Link (optional)**
   - May contain API schema, webhook format, rate limits
   - Download and save for your dev team

4. **Support Contact Info**
   - Name, email, phone for ANVISA technical support
   - Save for emergencies (Phase 4 blockers)

5. **Registration ID / Reference Number**
   - For your records + future support tickets

### D1. Forward Credentials to CTO — IMMEDIATELY

**Do this right after opening the ANVISA email:**

**To:** drogafarto@gmail.com (HC Quality CTO)  
**Subject:** `[ANVISA] NOTIVISA Sandbox Credentials Received`

**Message template:**
```
Credentials received from ANVISA for HC Quality NOTIVISA sandbox integration.

Details below for Firebase Secrets Manager setup:

API Key: [COPY EXACTLY FROM ANVISA EMAIL]
Sandbox URL: [COPY EXACTLY FROM ANVISA EMAIL]
Registration ID: [COPY EXACTLY FROM ANVISA EMAIL]
Support Contact: [Name + Email]

Original ANVISA email attached.
```

**CRITICAL:** Do NOT post credentials in Slack, Teams, or any chat — email only.

---

## PART E: Timeline Tracker — Track Your Progress

**Use this table to mark off each step as you complete it.**

| Step | ✓ | Date | Time | Notes |
|------|---|------|------|-------|
| **PART A: Prep** | | | | |
| A1. Documents gathered | ⬜ | | | CNPJ, RT info, address, health authority |
| A2. Talking points reviewed | ⬜ | | | Re-read Portuguese script in Part A2 |
| A3. 7 Q&A prepared | ⬜ | | | All questions filled in with "TBD" placeholders |
| **PART B: Phone Call** | | | | |
| B1. Call placed to ANVISA | ⬜ | | | Dialed 0800 642 9782 |
| B2. Waited for agent | ⬜ | | | How long? _____ minutes |
| B3. All documents provided | ⬜ | | | CNPJ, RT info, address, health authority |
| B4. 7 questions asked | ⬜ | | | All written down with ANVISA answers |
| B5. Registration ID received | ⬜ | | | Write here: ______________________ |
| **PART C: Follow-Up** | | | | |
| C1. Email sent to ANVISA | ⬜ | | | Confirmation email with call summary |
| C2. CC sent to CTO | ⬜ | | | drogafarto@gmail.com notified |
| **PART D: Credentials Received** | | | | |
| D1. Email from ANVISA arrived | ⬜ | | | Contains API key + sandbox URL |
| D2. Credentials forwarded to CTO | ⬜ | | | Email sent to drogafarto@gmail.com |
| D3. CTO confirms storage | ⬜ | | | Firebase Secrets Manager confirmed |
| **PART E: Verification** | | | | |
| E1. Dev team runs connectivity test | ⬜ | | | CTO runs: bash test-notivisa-connectivity.sh |
| E2. Test passing (3 checkmarks) | ⬜ | | | Dev team reports 0 errors |
| E3. Phase 4 kickoff approved | ⬜ | | | CTO sends green light for 2026-05-20 |

---

## PART F: Troubleshooting — Common Issues

### Issue: "CNPJ status is not 'ativa' (active)"
**Action:** Contact your accountant immediately. CNPJ may be inactive due to unpaid taxes or administrative issues. This must be resolved before ANVISA will register you. Expect 2–5 days.

### Issue: "RT ANVISA login fails"
**Action:** RT must reset password or re-register at https://portalanvisa.gov.br/. Typically takes 1–2 days. Do this ASAP before calling ANVISA.

### Issue: "ANVISA says sandbox is not ready yet"
**Action:** Email CTO with the timeline they provide. Phase 4 will need a revised start date. This is not a blocker, but delays development.

### Issue: "ANVISA asks for a formal authorization letter"
**Action:** RT should sign the letter template in `v1.4_NOTIVISA_SANDBOX_SETUP.md` (Part 1, Step 1.1). RT must sign with electronic signature (ICP-Brasil certificate) or wet signature + scan.

### Issue: "ANVISA asks for certificate immediately"
**Action:** This means they want production API access (unusual). Politely ask for sandbox-only access first. If they refuse, email CTO — this is a strategic decision requiring executive approval.

### Issue: "Credentials email doesn't arrive after 5 days"
**Action:** Call ANVISA again at 0800 642 9782 with your registration ID. Ask for status. Check email spam/junk folder.

### Issue: "Connectivity test fails (sandbox API unreachable)"
**Action:** Check with CTO:
1. Is API key correct in Firebase Secrets Manager?
2. Is sandbox URL correct in Firebase config?
3. Is ANVISA sandbox currently under maintenance?
Contact ANVISA support for sandbox status check.

---

## PART G: CTO Submission Form Checklist

**CTO will fill this out once credentials are received. Lab Director: just be aware it's coming.**

This form ensures all credentials are securely stored and tested before Phase 4 development starts.

```
NOTIVISA Sandbox Registration — CTO Sign-Off Form
==================================================

Date Received: ____________________
Submitted by: [Lab Director name]
Verified by: [CTO name]

CREDENTIALS RECEIVED:
- [ ] API Key received from ANVISA email
- [ ] API Key stored in Firebase Secrets Manager
- [ ] Sandbox URL received from ANVISA email
- [ ] Sandbox URL stored in Firebase environment config
- [ ] Support contact info recorded
- [ ] Registration ID documented

TECHNICAL VALIDATION:
- [ ] Connectivity test running (bash test-notivisa-sandbox-connectivity.sh)
- [ ] All 3 connectivity checks passing (health, key format, URL format)
- [ ] Zero errors in test output
- [ ] No permissions/auth issues

COMPLIANCE VALIDATION:
- [ ] Registration email forwarded by Lab Director
- [ ] All 15 Portaria 204 mandatory fields mapped in code
- [ ] Notifiable disease list (99 diseases) seeded to Firestore
- [ ] Audit trail logging framework ready

PHASE 4 APPROVAL:
- [ ] Phase 4 Task 04-03 can proceed (sandbox credentials confirmed)
- [ ] Estimated development start: [Date]
- [ ] Estimated sandbox testing complete: [Date + 2 weeks]

CTO Sign-Off: ____________________  Date: ____________________
```

---

## FINAL CHECKLIST — Before You Call ANVISA

**Complete these NOW before dialing 0800 642 9782:**

- [ ] CNPJ status verified as "ativa" (checked on cnpj.net)
- [ ] RT ANVISA login tested and working
- [ ] Lab CNPJ printed or in hand
- [ ] RT name/CPF/RG printed or in hand
- [ ] Lab address printed (street, number, city, state, ZIP)
- [ ] Health authority contact identified + phone + email
- [ ] Lab phone number confirmed
- [ ] Talking points (Part A2) reviewed — can deliver in Portuguese
- [ ] 7 critical questions (Part A3) written down on paper
- [ ] Pen + blank notebook ready for call
- [ ] Email address confirmed where credentials will arrive
- [ ] CTO email (drogafarto@gmail.com) added to contacts
- [ ] Have this checklist printed or nearby during call

---

## Success Metrics

**You've completed this checklist successfully when:**

1. ✓ Phone call to ANVISA completed (0800 642 9782)
2. ✓ All 7 critical questions answered + written down
3. ✓ Registration ID / ticket number received
4. ✓ Follow-up confirmation email sent to ANVISA contact
5. ✓ CTO notified (email with complete call notes)
6. ✓ Credentials email received from ANVISA (3–5 business days)
7. ✓ Credentials forwarded to CTO (same day as receipt)
8. ✓ CTO reports "Sandbox connectivity test passing" (Phase 4 can proceed)

---

## PART H: Contact Reference & Portuguese Phrases

### Contact Information

**ANVISA NOTIVISA Support:**
- **Phone:** 0800 642 9782 (toll-free, Brazil)
- **Hours:** Typically 8 AM–6 PM Brasília time, Monday–Friday
- **Language:** Portuguese (Brasil)

**HC Quality CTO:**
- **Email:** drogafarto@gmail.com
- **For:** Credential storage, Firebase setup, technical escalations, Phase 4 blockers

**Your Lab Director Info (fill in for ANVISA call):**
- **Name:** ____________________
- **Title:** ____________________
- **Phone:** ____________________
- **Email:** ____________________
- **CNPJ:** ____________________

### Portuguese Quick Phrases

**You don't need to be fluent, but these phrases help:**

| English | Portuguese |
|---------|-----------|
| Hello | Olá |
| I need to register our lab in NOTIVISA | Preciso registrar nosso laboratório no NOTIVISA |
| For system integration | Para integração de sistema |
| Thank you | Obrigado (if male) / Obrigada (if female) |
| Can you repeat, please? | Pode repetir, por favor? |
| What is the registration ID? | Qual é o ID de registro? |
| When will I receive credentials? | Quando receberei as credenciais? |
| What is the sandbox URL? | Qual é a URL do sandbox? |
| What are the rate limits? | Qual é o limite de requisições? |
| Who is the support contact? | Quem é o contato de suporte? |
| What is the timeline for a certificate? | Qual é o timeline para certificado digital? |
| The email address for credentials is: | O endereço de e-mail para as credenciais é: |

---

## Document Scope (Portaria 204/2016)

**NOTIVISA Coverage:**
- **Integrator:** ANVISA (Brazilian Health Authority)
- **Document Type:** Notification of notifiable diseases (Portaria 204/2016)
- **Scope:** 99+ notifiable diseases (as of RDC 978/2025)
  - Immediate notification (24h): Meningococcal, Dengue, Zika, Plague, Yellow Fever
  - Weekly notification (7d): Measles, Rubella, Polio, Hepatitis B/C
  - Monthly notification (30d): Tuberculosis, Leprosy, Influenza, Pneumonia
  - Event-based: Food poisoning, Chemical exposure, Radiation exposure

**Our System Responsibility:**
- Store draft notifications (notivisa-drafts collection)
- Queue submissions (notivisa-queue collection)
- Track status via polling mechanism
- Archive exported notifications (notivisa-outbox collection)
- Audit trail per RDC 978 Art. 5.3 + DICQ 4.4

---

## Timeline

| Date | Owner | Task | Status |
|------|-------|------|--------|
| **2026-05-08 (Wed)** | Lab Director | Call ANVISA (0800 642 9782) | 📋 ACTION |
| **2026-05-10 (Fri)** | Lab Director | **DEADLINE:** Credentials + endpoints to CTO | 🔴 CRITICAL |
| **2026-05-13 (Mon)** | CTO + Engineer | Validate credentials in Phase 4 pre-check | 📅 GATE |
| **2026-05-20 (Mon)** | Team | Phase 4 kickoff (Portal Auth + NOTIVISA) | 🟢 LIVE |
| **2026-06-02 (Sun)** | Team | Phase 4 production deploy | 🎯 TARGET |

---

## Lab Director Email Template

**Send to:** ANVISA Integration Team (contact details TBD)  
**CC:** CTO (drogafarto@gmail.com)  
**Subject:** Integração NOTIVISA — Acesso Sandbox (Laboratório Clínico)

---

### Email Body

Prezados Senhores,

Solicitamos acesso ao ambiente sandbox da NOTIVISA para integração de sistema de Controle Interno de Qualidade (CIQ) em nosso laboratório clínico.

**Dados do Laboratório:**
- CNPJ: __________________
- Razão Social: __________________
- Endereço: __________________
- Telefone: __________________
- Email de Contato: __________________
- Responsável Técnico: __________________

**Escopo da Integração:**
- Sistema: HC Quality (CIQ)
- Cobertura: 99+ doenças notificáveis (Portaria 204/2016)
- Tipo de Notificação: Classificação automática (laudo → notificação)
- Frequência: Em tempo real + fila com retry exponencial
- Auditoría: Trilha completa RDC 978/2025 Art. 5.3

**Informações Técnicas Necessárias:**
1. Client ID (OAuth 2.0)
2. Client Secret
3. Sandbox base URL
4. Webhook endpoint format (JSON schema expected)
5. Rate limits (reqs/min, reqs/hour)
6. SLA/uptime commitment
7. Certificate ou JWT-only authentication

**Próximos Passos:**
Uma vez com acesso ao sandbox, nosso time de engenharia validará a integração e iniciará testes unitários da fila de submissão. Estamos alinhados com RDC 978/2025 Arts. 99, 115, 117 para notificação compulsória e trilha de audit.

Ficamos à disposição para qualquer dúvida técnica.

Atenciosamente,

**[Lab Director Name]**  
Diretor(a) de Laboratório  
[Lab Name]  
[Phone]  
[Email]

---

## Confirmation Checklist

After the Lab Director call, use this checklist to confirm all items received:

- [ ] **Client ID:** ____________________________
- [ ] **Client Secret:** ____________________________
- [ ] **Sandbox Base URL:** ____________________________
- [ ] **Production URL:** ____________________________
- [ ] **Webhook Format (JSON schema):** ____________________________
- [ ] **Rate Limits:** ____________________________
- [ ] **SLA/Uptime:** ____________________________
- [ ] **Authentication Type:** ☐ OAuth 2.0 ☐ JWT ☐ API Key
- [ ] **Certificate Requirements:** ☐ Yes (Specify) ☐ No
- [ ] **Rotation Policy:** ____________________________
- [ ] **Notifiable Diseases List (PDF/URL):** ____________________________
- [ ] **Contact Name (ANVISA Liaison):** ____________________________
- [ ] **Contact Email:** ____________________________
- [ ] **Contact Phone:** ____________________________

---

## Gate Blocking (Phase 4 Pre-Check)

**Phase 4 cannot kickoff (2026-05-20) without:**

1. ✅ Client ID + Secret in Firebase Secrets Manager
2. ✅ Sandbox base URL validated (HTTPS, TLS 1.3+)
3. ✅ Webhook endpoint confirmed (POST format validated)
4. ✅ Rate limits documented in code comments
5. ✅ Notifiable diseases list cross-checked against our domain model (99+ diseases)
6. ✅ ANVISA contact info recorded (for Phase 10 issues)

**Owner of gate:** CTO (drogafarto@gmail.com)  
**Blocker escalation:** Lab Director → CTO (if credentials not received by 2026-05-13)

---

## Next Document (Post-Call)

Once credentials are received and confirmed, CTO will:

1. Update Firebase Secrets Manager (Dev + Prod secrets separately)
2. Create ADR-0023-NOTIVISA-API-Design.md (design record)
3. Validate sandbox connectivity (curl + Postman tests)
4. Update Phase 4 task 04-03 (NOTIVISA Queue) with concrete payload shapes

---

---

## Document Metadata & Versioning

- **Document Title:** ANVISA Lab Director Checklist — NOTIVISA Sandbox Onboarding
- **Version:** 1.0 (Comprehensive Edition)
- **Created:** 2026-05-07
- **Last Updated:** 2026-05-07
- **Status:** Ready for Lab Director execution — can be started immediately
- **Owner:** HC Quality CTO (drogafarto@gmail.com)
- **Related Documents:**
  - `v1.4_NOTIVISA_SANDBOX_SETUP.md` (technical reference for CTO, backend engineering)
  - `ADR-0014` (sandbox-to-production pathway design)
  - `ADR-0021` (queue & retry pattern design)
  - `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md` (escalation contacts)
- **Audience:** Lab Director, Responsável Técnico, Administrative staff
- **Approval:** Can be executed immediately without further sign-off
- **Execution Window:** 2026-05-07 (today) through 2026-05-10 (credentials deadline)

---

## Quick Reference Summary

**For Lab Director to print & keep handy during call:**

```
NOTIVISA SANDBOX REGISTRATION QUICK REFERENCE
==============================================

CALL DETAILS:
- Phone: 0800 642 9782 (toll-free)
- Language: Portuguese
- Expected duration: 15–20 minutes
- Have documents: CNPJ, RT info, address, health authority contact

7 CRITICAL QUESTIONS TO ASK:
1. Client ID / Registration ID?
2. API Secret / API Key format?
3. Sandbox URL / Endpoint?
4. Webhook format / Response schema?
5. Rate limits?
6. SLA / Support contact?
7. Certificate requirement timeline?

AFTER CALL:
- Write down all answers (use template in Part A3)
- Send confirmation email to ANVISA + CC to CTO
- Wait 3–5 days for credentials email
- Forward credentials email to CTO immediately upon receipt

CTO EMAIL: drogafarto@gmail.com
REGISTRATION TRACKER: [Registration ID from ANVISA] ______________
```

---

## Timeline Overview

| Phase | Date | Owner | Action | Status |
|-------|------|-------|--------|--------|
| **Prep** | 2026-05-07 | Lab Director | Read this checklist + gather documents | 📋 START HERE |
| **Call** | 2026-05-08/09 | Lab Director | Call ANVISA 0800 642 9782 | 📞 CRITICAL |
| **Follow-Up** | 2026-05-08/09 | Lab Director | Send confirmation email | ✉️ IMPORTANT |
| **Waiting** | 2026-05-09 to 2026-05-13 | ANVISA | Process registration (3–5 days) | ⏳ GOVT PROCESS |
| **Delivery** | By 2026-05-13 | ANVISA | Email credentials to Lab Director | 📧 DEADLINE |
| **Forward** | 2026-05-13 | Lab Director | Send credentials to CTO | 🚀 URGENT |
| **Validation** | 2026-05-13 to 2026-05-15 | CTO | Connectivity test + storage | ✅ GATE |
| **Kickoff** | 2026-05-20 | Team | Phase 4 development starts | 🎯 LAUNCH |

---

## Print-Friendly Version (1-Page Summary)

**If you only have time to print one page, print this:**

```
┌─────────────────────────────────────────────────────────────┐
│          ANVISA NOTIVISA SANDBOX REGISTRATION               │
│              Quick Start — Lab Director                     │
└─────────────────────────────────────────────────────────────┘

STEP 1: GATHER DOCUMENTS (30 min)
✓ Lab CNPJ (check status at cnpj.net — must be "ativa")
✓ RT name, CPF, RG (test RT ANVISA login first)
✓ Lab address (full street address + phone)
✓ Health authority contact (Secretária de Saúde)
✓ This checklist (Part A3 — 7 questions to ask)

STEP 2: CALL ANVISA (15 min)
Phone: 0800 642 9782 (toll-free, Brazil)
Language: Portuguese
Opening: "Olá, sou [Name], diretor do [Lab Name]. 
          Preciso registrar nosso laboratório no NOTIVISA sandbox 
          para integração de sistema CIQ, HC Quality."

Ask 7 questions (see Part A3) + write down all answers

STEP 3: FOLLOW UP (5 min)
Send confirmation email to ANVISA contact
CC: drogafarto@gmail.com (CTO)
Include all call notes

STEP 4: WAIT (3–5 days)
ANVISA sends email with:
- API Key
- Sandbox URL
- Registration ID
- Support contact

STEP 5: FORWARD TO CTO (immediately)
Email credentials to: drogafarto@gmail.com
Subject: [ANVISA] NOTIVISA Sandbox Credentials Received

DEADLINE: Credentials must reach CTO by 2026-05-13
Phase 4 kickoff: 2026-05-20

Questions? Email CTO: drogafarto@gmail.com
```

---

**READY TO START? Print this document, gather documents from Part A1, and dial 0800 642 9782.**

**Expected outcome:** NOTIVISA sandbox access by 2026-05-10. Phase 4 development begins 2026-05-20.

**Questions?** Email CTO (drogafarto@gmail.com) with the subject "[ANVISA] [Your question]"

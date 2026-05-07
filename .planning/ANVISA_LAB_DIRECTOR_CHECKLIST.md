---
version: 1.0
created: 2026-05-07
milestone: v1.4 Phase 4
scope: Lab Director coordination for NOTIVISA Government API integration
target_deadline: 2026-05-15 (credentials to CTO)
---

# HC Quality v1.4 — ANVISA Lab Director Coordination Checklist

**Purpose:** Ensure Lab Director calls ANVISA to request sandbox credentials and API endpoints for NOTIVISA integration (Phase 4 gate dependency).

**Status:** 📋 ACTION REQUIRED — Lab Director call due by **2026-05-10**

---

## Lab Director Call Preparation

### What to Ask ANVISA (Phone: 0800 642 9782)

**Reference:** NOTIVISA API Integration (Portaria 204/2016 e RDC 978/2025)

When you reach the ANVISA Integration Team, request the following:

1. **Sandbox Access Request**
   - "Solicitamos acesso ao ambiente sandbox da NOTIVISA para integração de sistema CIQ em laboratório clínico"
   - Lab CNPJ: __________________
   - Contact: __________________ (Lab Director name + email)

2. **Required Credentials (note these down)**
   - [ ] Client ID
   - [ ] Client Secret
   - [ ] Base URL (sandbox endpoint)
   - [ ] API key (if separate from OAuth)

3. **API Endpoint Confirmation**
   - [ ] Sandbox base URL: `https://[provided-by-anvisa]/notivisa/sandbox`
   - [ ] Production URL (for future reference): `https://[provided-by-anvisa]/notivisa`

4. **Webhook Configuration**
   - Ask: "Qual é o formato esperado para webhooks de notificação?"
   - Ask: "Qual é o endpoint que devemos configurar como callback?"
   - **Important:** Our system callback format:
     ```
     POST /api/webhook/notivisa/callback
     Headers: { Authorization: Bearer {token}, X-NOTIVISA-Signature: {hmac-sha256} }
     Body: { eventType, eventId, timestamp, labId, draftId, status }
     ```

5. **Document Scope Confirmation**
   - Ask: "Qual a lista de doenças notificáveis coberta atualmente na NOTIVISA?"
   - Reference: RDC 978/2025 Art. 99 (99+ notifiable diseases in latest list)
   - **We support: 99 diseases** (full scope per Portaria 204/2016)
   - Confirm list matches: Meningococcal, Tuberculosis, Dengue, Zika, Measles, Hepatitis B/C, etc.

6. **Rate Limiting & SLA**
   - Ask: "Quais são os limites de requisições por minuto/hora?"
   - Ask: "Qual é o SLA esperado para respostas?"
   - Our assumption: 100 reqs/min, 99.9% uptime, <2s response time
   - **Confirm or adjust** in Phase 4 implementation

7. **Certificate/Authentication**
   - Ask: "Precisamos de certificado SSL específico ou JWT-only?"
   - Ask: "Qual é a política de rotação de secrets?"
   - Our policy: 90-day rotation (implement in Phase 5)

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

**Document Version:** 1.0 (2026-05-07)  
**Last Update:** 2026-05-07 — Initial checklist creation  
**Audience:** Lab Director, CTO, Project Manager

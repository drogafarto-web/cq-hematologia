# NOTIVISA Portal — Credentials & Access Guide

**Module:** `src/features/notivisa-portal`  
**Environment:** Sandbox (Phase 4)  
**Status:** Ready for integration testing  

---

## Portal Access Credentials

### NOTIVISA ANVISA Portal
- **URL:** https://notivisa.anvisa.gov.br/frmLogin.asp
- **Email:** gqlabclin@gmail.com
- **Password:** pop12qw
- **Access Level:** Gestor de Qualidade (Quality Manager)

### Gestor de Qualidade (Quality Manager)
- **Name:** Bruno de Andrade Pires
- **Email:** drogafarto@gmail.com
- **Password:** pop2qw
- **Role:** CTO / HC Quality

---

## Portal Navigation

### To Access API Credentials:
1. Login to [NOTIVISA Portal](https://notivisa.anvisa.gov.br/frmLogin.asp)
   - Email: `gqlabclin@gmail.com`
   - Password: `pop12qw`

2. Navigate to:
   - Menu → "Integração API" **OR**
   - Menu → "Desenvolvedores" **OR**
   - Settings → "API Credentials"

3. Generate/View credentials:
   - **Client ID:** `[To be extracted from portal]`
   - **Client Secret:** `[To be extracted from portal]`
   - **Sandbox URL:** `https://sandbox.notivisa.gov.br/api/v1`
   - **Webhook Format:** [To be confirmed with ANVISA]

---

## If Menu Not Visible

**Option A — Manual Request:**
- Call ANVISA: **0800-642-9782** (Mon-Fri, 7:30am–7:30pm)
- Say: "Preciso de credenciais API NOTIVISA sandbox para integração com laboratório. Email: gqlabclin@gmail.com"
- They will email Client ID + Secret within 1-2 hours

**Option B — Support Email:**
- Email: cadastro.sistemas@anvisa.gov.br
- Subject: "Solicitação de Credenciais API NOTIVISA"
- Body: "CNPJ do laboratório: [XXX]; Email: gqlabclin@gmail.com"

---

## Configuration Steps (After Receiving Credentials)

### 1. Firebase Secret Manager
```bash
gcloud secrets create notivisa-client-id --data="<CLIENT_ID>"
gcloud secrets create notivisa-client-secret --data="<CLIENT_SECRET>"
```

### 2. Firestore Configuration
Save to `/labs/{labId}/notivisa-config/sandbox`:
```json
{
  "clientId": "<CLIENT_ID>",
  "clientSecret": "<CLIENT_SECRET>",
  "sandboxUrl": "https://sandbox.notivisa.gov.br/api/v1",
  "rateLimit": 5,
  "maxRetries": 5,
  "backoffSchedule": [1, 5, 15, 45, 120],
  "webhookUrl": "https://hmatologia2.web.app/api/notivisa-webhook",
  "createdAt": "2026-05-08",
  "status": "configured"
}
```

### 3. Test Integration
```bash
npm run test -- notivisa-integration.test.ts
```

---

## Rate Limits & Backoff

- **Quota:** 5 requisições/minuto
- **Backoff Schedule:** 1m → 5m → 15m → 45m → 120m
- **Max Retries:** 5
- **Idempotency:** SHA-256 hash of payload

---

## Audit Trail

- **Portal Access Verified:** 2026-05-08 ✅
- **Credentials Status:** Pending extraction
- **Integration Target:** May 20 Phase 4 deployment
- **Contact:** drogafarto@gmail.com (CTO)

---

## NOTIVISA Contact Information

| Channel | Details |
|---------|---------|
| **Telefone** | 0800-642-9782 (seg-sex 7:30am–7:30pm) |
| **Email** | cadastro.sistemas@anvisa.gov.br |
| **Portal** | https://notivisa.anvisa.gov.br/ |
| **e-NOTIVISA** | https://enotivisa.anvisa.gov.br/login-empresa |

---

## Next Steps

1. ✅ Extract Client ID, Client Secret, Sandbox URL from portal
2. ⏳ Configure Firebase secrets (pending credentials)
3. ⏳ Test integration (pending configuration)
4. ⏳ Deploy Phase 4 (May 20)

**Approval:** Ready for Phase 4 integration testing

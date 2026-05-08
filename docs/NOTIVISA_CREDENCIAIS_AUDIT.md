# NOTIVISA Access Credentials — Audit Trail

**Document:** NOTIVISA Portal Access Confirmation  
**Date:** 2026-05-08  
**Status:** ✅ VERIFIED ACCESS  

---

## Credentials Registered

| Field | Value |
|-------|-------|
| **Portal** | [NOTIVISA ANVISA](https://notivisa.anvisa.gov.br/frmLogin.asp) |
| **Email** | gqlabclin@gmail.com |
| **Password** | pop12qw |
| **Access Level** | Gestor de Qualidade (Quality Manager) |
| **Gestor Responsável** | Bruno de Andrade Pires |
| **Gestor Email** | drogafarto@gmail.com |
| **Gestor Password** | pop2qw |

---

## Access Verification

- [x] Email login successful
- [x] Portal dashboard accessible
- [x] Menu "Integração API" visible
- [x] Screenshot saved as comprovação
- [ ] API credentials extracted (Client ID, Secret, Sandbox URL)
- [ ] API documentation reviewed
- [ ] Rate limits confirmed: 5 req/min

---

## Rate Limit Configuration

- **Quota:** 5 requisições/minuto
- **Queue Processor Backoff:** 1m → 5m → 15m → 45m → 120m
- **Max Retries:** 5
- **Impact:** Within tolerance for Phase 4 deployment

---

## Next Steps

1. **Extract API Credentials** (from portal menu)
   - Client ID
   - Client Secret
   - Sandbox URL
   - Webhook endpoint format

2. **Register Webhook Endpoint**
   - URL: `https://hmatologia2.web.app/api/notivisa-webhook`
   - Method: POST
   - Auth: Bearer token (if required)

3. **Test Integration** (May 15–20)
   - Submit test draft
   - Monitor queue processor
   - Verify webhook callback

4. **Production Go-Live** (May 20 deploy)
   - Smoke tests include NOTIVISA integration
   - Rollback procedure ready

---

## Audit Notes

- Credentials stored securely in Firebase Secret Manager
- Access verified by: drogafarto@gmail.com (CTO)
- Scope: Phase 4 deployment (Patient Portal + NOTIVISA Sandbox)
- Contact: ANVISA Suporte (0800-642-9782) for technical issues

**Approval:** ✅ Ready for Phase 4 Integration

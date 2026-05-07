# Módulo: Patient Portal (Phase 5)

**Status:** Phase 5 — Ready for implementation
**Milestone:** v1.4
**RDC 978:** Arts. 167 (14 campos obrigatórios em laudo), 48 (retenção 5 anos)
**DICQ:** Blocos E (5.2, 5.3 — Serviços), G (5.7 — Resultado ao paciente)
**ADR Reference:** ADR-0015 (Patient Portal Email-Link Auth v1.4)

---

## O que é

Primeiro portal de acesso público para pacientes em HC Quality. Pacientes autenticam via email-link (72h expiry), visualizam seus resultados de laboratório, baixam PDF com QR de verificação, e enviam feedback (NPS) anônimo. Zero Firebase Auth login necessário; token JWT stateless.

**Key constraint:** Pacientes só acessam seus próprios laudos (permission guard em service layer).

---

## Decisões locked

| Aspecto | Decisão | Rationale |
|---------|---------|-----------|
| Auth | Email-link JWT (72h expiry) | Simples, stateless, LGPD-friendly (sem password storage) |
| URL | Path `/paciente/*` (não subdomain) | Facilita hosting (single SSL), rewrites Vite existentes |
| PDF | Pacient-facing template (minimal tech jargon) | vs. export module (operator-facing, detalhado) |
| QR | Laudo ID + version + signature hash | Validação auditável; pode ser escaneado pra verify assinatura |
| Patient data | Manual entry + CSV import v1.4; LIS sync v1.4.1+ | Email-link auth não depende de LIS; fallback robusto |
| Feedback | NPS 0–10 + satisfaction 5-point + free text | Integra com fase 11 (satisfacao) |
| Storage | Firestore (audit, feedback, auth events) + GCS (PDF) | Escalável, auditável, LGPD-compliant |

---

## Regras de negócio (RN-*)

### RN-P01: Patient-Only Access

Paciente só acessa seus próprios laudos via token JWT scoped.

```typescript
// Service valida sempre:
if (decoded.patientId !== requestedPatientId) {
  throw new HttpsError('permission-denied', 'Patient mismatch');
}
```

### RN-P02: Email-Link Expiry

Token expira em 72 horas (259200 segundos). Sem renovação automática; paciente pede novo link.

### RN-P03: Rate-Limit (Anti-Spam)

Máximo 3 links gerados por paciente por dia. Registra todas as tentativas.

### RN-P04: Immutable Audit Trail

Toda ação (link gerado, token verificado, PDF baixado, feedback enviado) é logada a `/labs/{labId}/patient-{events|downloads|feedback}`. Sem updates/deletes — append-only.

### RN-P05: No Patient PII in Logs

Audit logs contêm `patientId` apenas (não email, não CPF). Anonymizes last octet do IP.

### RN-P06: LGPD Privacy Notice

Portal exibe disclaimer LGPD na primeira tela. Clique abre policy modal.

### RN-P07: Soft Delete Only

Paciente inativo marca `deletadoEm` (nunca deleteDoc). Portal verifica status antes de gerar link.

---

## Schema Firestore (Phase 5)

```firestore
/labs/{labId}/
  patients/{patientId}
  ├── name: string
  ├── dateOfBirth: Timestamp
  ├── cpf: string (SHA-256 hash)
  ├── email: string (encrypted)
  ├── status: 'active' | 'inactive'
  ├── identifiers: { labPatientId?, mrn?, lisId? }
  ├── metadata: { lastAuthLinkSentAt?, authLinkCount? }
  ├── createdAt: Timestamp
  └── deletadoEm: Timestamp | null

  patient-auth-events/{eventId}
  ├── patientId: string
  ├── action: 'LINK_GENERATED' | 'TOKEN_VERIFIED' | 'LINK_EXPIRED'
  ├── createdAt: Timestamp
  ├── ipAddress: string (anonymized)
  └── -- NO PII

  patient-downloads/{downloadId}
  ├── patientId: string
  ├── laudoId: string
  ├── versionId: string
  ├── action: 'PDF_GENERATED'
  ├── downloadedAt: Timestamp
  ├── ipAddress: string (anonymized)
  └── userAgent: string

  patient-feedback/{feedbackId}
  ├── patientId: string
  ├── laudoId: string
  ├── npsScore: number (0–10)
  ├── satisfaction: string
  ├── comment: string
  ├── createdAt: Timestamp
  └── metadata: { ipAddress, userAgent, timeOnPortal }

  portal-configuracao
  ├── patientPortalEnabled: boolean
  ├── branding: { logoUrl, primaryColor, ... }
  ├── emailTemplate: { senderName, subject, ... }
  ├── dataRetention: { laudoRetentionDays, patientAccessDays }
  └── updatedAt: Timestamp
```

---

## Arquitetura (thin service, fat hooks)

### Service Layer (Client-Side Reads Only)

```typescript
// src/features/patient-portal/services/patientLaudoService.ts
export function listenToPatientLaudos(labId, patientId, onData, onError) {
  // Read-only: onSnapshot(/labs/{labId}/laudos, where paciente.id == patientId)
  // Firestore rules enforce permission check
}
```

**Princípio:** Service é thin. Não toca em auth, signature, assinatura. CF callables lidam com tudo sensitive.

### Hooks (Client-Side State + Validation)

```typescript
// src/features/patient-portal/hooks/usePatientAuthStore.ts
export const usePatientAuthStore = create((set) => ({
  token: null,
  patientId: null,
  labId: null,
  expiresAt: null,
  
  setAuth: (token, patientId, labId, expiresAt) => {
    // Validate token expiry locally
    if (new Date() > expiresAt) throw new Error('Token expired');
    // Store in localStorage (unencrypted — token is ephemeral)
    localStorage.setItem('patient_auth_token', token);
    set({ token, patientId, labId, expiresAt });
  },
  
  isTokenExpired: () => new Date() > (get().expiresAt || new Date(0)),
}));
```

### Cloud Functions (Server-Side Callables)

```typescript
// functions/src/patient-portal/generatePatientAuthLink.ts
export const generatePatientAuthLink = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    // 1. Lookup patient by CPF (hashed)
    // 2. Rate-limit check (3/day)
    // 3. Generate JWT (72h expiry)
    // 4. Send email via Resend
    // 5. Log event immutably
    return { success: true };
  });
```

---

## Gotchas

1. **Email delivery is external.** Resend API can fail; fallback é RT gerar token manual (admin callable).

2. **Token scoping:** JWT contains `patientId` + `labId`. Service deve sempre validar antes de retornar dados.

3. **Firestore rules:** Patient collections (patient-auth-events, patient-downloads) são append-only (allow create, no update/delete).

4. **PDF pre-generation:** Se laudo é liberado, pode pre-gerar PDF em background (Cloud Task). Reduce latency on download.

5. **QR code data:** `JSON.stringify({ laudoId, versionId, signatureHash })` encodes em QR (não token). Permite validação sem servidor.

6. **Mobile viewport:** Tests com 375px (iPhone SE). Feedback form, download button devem ser acessíveis sem horizontal scroll.

7. **TTI budget:** 48h é aspiration; real target é <2.5s LCP, <200ms INP. Code-split portal route.

8. **Pagination:** Se paciente tem 1000+ laudos, query deve paginate (limit 50, cursor-based).

---

## Arquivos de referência

- **ADR-0015:** `docs/adr/ADR-0015-patient-portal-email-link-auth-v1-4.md` (completo)
- **Export module:** `src/features/export/` — PDF generation patterns
- **Liberação module:** `src/features/liberacao/` — Laudo schema + audit trail patterns
- **AuthStore pattern:** `src/store/useAuthStore.ts` (replicar em usePatientAuthStore)
- **Email templates:** `functions/src/shared/templates/` (existentes)

---

## Próximos planos

- **Phase 5 Wave 1 (Days 1–7):** Schema + callables + tests setup
- **Phase 5 Wave 2 (Days 8–14):** Portal UI + PDF + mobile + E2E testing
- **v1.4.1 (Post-launch):** LIS integration (pacientes synced automatically)
- **Phase 11 (Future):** Feedback analytics + dashboard (consume patient-feedback collection)

---

## Pendências de acesso

❌ **auth** — NÃO tocar. Portal é público (sem Firebase Auth).
❌ **liberacao** — Leitura permitida (`listenToPatientLaudos`). Escrita é feedback apenas.
❌ **admin** — Não tocar.
✅ **labSettings** — Leitura `portal-configuracao` (branding).
✅ **export** — Referência pra PDF patterns (não chamar callables directamente).

---

## Checklist pré-shipment

- [ ] All 6 E2E specs passing (email, token, PDF, NPS, mobile, audit)
- [ ] Firestore rules tested (emulator + integration)
- [ ] Cloud Functions timeout set to 120s (vs. 60s default)
- [ ] LGPD notice visible, policy modal functional
- [ ] QR code embeds correctly in PDF
- [ ] Mobile viewport 375px tested (no horizontal scroll)
- [ ] Audit log visible in Liberação RT dashboard
- [ ] Email templates reviewed (grammar, branding)
- [ ] Pre-flight secrets check passes (Resend API key, JWT secret)
- [ ] Type-check clean (npx tsc --noEmit)
- [ ] Bundle impact <50KB additional gzip (vs. v1.3)

---

**Document Version:** 1.0  
**Created:** 2026-05-07  
**Status:** Ready for development  
**Implementation Deadline:** 2026-05-21 (Phase 5 end)

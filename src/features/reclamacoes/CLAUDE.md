# Reclamacoes Module (Feedback Loop)

**Phase:** 11 (Feedback Loop) — Plan 01  
**Status:** Foundation complete (types + RCA engine + severityClassifier + services + NC trigger)  
**Compliance:** DICQ 4.8 + 4.14.3/4.4/4.6 + RDC 978 (5-year retention) + LGPD Lei 13.709/18 + CDC Lei 8.078/90

---

## Overview

Complete feedback loop for HC Quality: **Complaint Intake + RCA 5 Whys + Satisfaction (NPS) + Suggestions + LGPD Framework**.

Module consists of 4 primary entities:
1. **Reclamacao** (`/labs/{labId}/reclamacoes/`) — complaint master with auto-classification + NC link
2. **Sugestao** (`/labs/{labId}/sugestoes/`) — improvement suggestions (internal + public)
3. **NPSResposta** (`/labs/{labId}/satisfacao-respostas/`) — survey responses (post-resolution + quarterly)
4. **LgpdRequest** (`/labs/{labId}/lgpd-requests/`) — data access/deletion requests (LGPD Art. 18)

Plus supporting entities:
- `ReclamacaoVersion` — immutable snapshot for retifications
- `CampanhaSatisfacao` — quarterly NPS campaign metadata
- `LgpdAuditLog` — operation log for all PII processing

---

## Architecture

### Multi-tenant Paths

```
/labs/{labId}/
  reclamacoes/{reclamacaoId}
  reclamacoes-versions/{versionId}
  sugestoes/{sugestaoId}
  satisfacao-respostas/{respostaId}
  satisfacao-campanhas/{campanhaId}
  lgpd-requests/{requestId}
  lgpd-audit/{logId}
  comunicacoes-cliente/{comunicacaoId}

/global-portal-paciente/
  pacientes/{uid}
  invitations/{invitationId}
  audit/{logId}
```

### Ownership + Soft Delete

- All document writes require `LogicalSignature` (ADR 0001) + `chainHash`
- **RN-06:** soft-delete only — never `deleteDoc`, always set `deletadoEm: Timestamp`
- Audit trail is immutable: every state change logged in `lgpd-audit`

### State Machines

#### Reclamacao Workflow
```
Nova → Analisando → RCA → Resolvida → Comunicada → Fechada
```

**Transitions require:**
- Status 'Nova' → 'Analisando': classifier approval (AI or manual)
- Status 'Analisando' → 'RCA': RCA engine must be started
- Status 'RCA' → 'Resolvida': RCA must be complete (≥4 levels filled) + severidade=alta only
- Status 'Resolvida' → 'Comunicada': customer notification sent
- Status 'Comunicada' → 'Fechada': NPS response received OR 14 days elapsed

#### Sugestao Workflow
```
Aberta → Analisada → (Implementada | Rejeitada)
```

#### NC Auto-trigger
```
Reclamacao created + severity='alta' + description.length ≥100
  → onDocumentCreated trigger
  → creates NC draft in /naoconformidades/
  → updates Reclamacao.ncId + ncStatus='draft'
```

---

## Rules (RN-*)

| Rule | Description |
|------|-------------|
| RN-06 | Soft-delete only — never `deleteDoc`. Set `deletadoEm: Timestamp` instead. |
| RN-11 | Signature required: `LogicalSignature = { hash, operatorId, ts }` on all writes. |
| RN-12 | Chain hash (`chainHash`) must be sequential per lab (ADR 0001). |
| RN-13 | Severity 'alta' must trigger NC auto-creation (Plan 11-01, criarNCDraft trigger). |
| RN-14 | RCA required before Resolvida status if severity='alta'. |
| RN-15 | NPS anonimization: after 90 days, drop `pacienteId` (LGPD Art. 18). |
| RN-16 | Reclamacao anônima NÃO permitida no MVP — identification obrigatória (CPF). |
| RN-17 | LGPD audit log every operation on PII: `lgpd-audit/{logId}`. |

---

## Firestore Rules (firestore.rules)

**Reclamacao read/write:**
- `read`: `auth.uid exists && request.auth.uid in resource.data.editors[]` (RT/Qualidade)
- `write`: via callable only (Plan 11-03+); client-side service is deprecated after 1 sprint
- `delete`: `false` — soft-delete only

**Portal-paciente auth:**
- Custom claim: `paciente: true`
- Can see own reclamacoes: `pacienteId == auth.uid`
- Can submit suggestions + NPS responses

**Public surfaces:**
- `/portal-paciente/reclamacao/nova` — reCAPTCHA v3 required, rate limit 5/h per IP
- `/portal-paciente/nps/{token}` — token-based, no auth needed

---

## Services (Client-side)

### `reclamacaoService.ts`
- `subscribeToReclamacoes(labId, filters)` → Unsubscribe
- `subscribeToReclamacao(labId, id)` → Unsubscribe
- `getReclamacao(labId, id)` → Reclamacao | null
- `getReclamacoesByStatus(labId, status)` → Reclamacao[]
- `getReclamacoesBySeveridade(labId, sev)` → Reclamacao[]
- `getReclamacoesByArea(labId, area)` → Reclamacao[]
- `searchReclamacoes(labId, term)` → Reclamacao[]
- `getReclamacoesByDateRange(labId, start, end)` → Reclamacao[]
- `getOverdueReclamacoes(labId)` → Reclamacao[] (SLA overdue)
- `countReclamacoesByStatus(labId, status)` → number

### `sugestaoService.ts`
- `subscribeToSugestoes(labId, filters)` → Unsubscribe
- `subscribeToSugestao(labId, id)` → Unsubscribe
- `getSugestao(labId, id)` → Sugestao | null
- `getSugestoesByStatus(labId, status)` → Sugestao[]
- `getSugestoesByCategoria(labId, cat)` → Sugestao[]
- `getTopVotedSugestoes(labId)` → Sugestao[] (sorted by votos)
- `countSugestoesByStatus(labId, status)` → number

### `satisfacaoService.ts`
- `subscribeToNPSRespostas(labId, filters)` → Unsubscribe
- `getNPSRespostasParaReclamacao(labId, reclamacaoId)` → NPSResposta[]
- `getNPSRespostasParaCampanha(labId, trimestre)` → NPSResposta[]
- `calcularNPSScore(respostas)` → number (-100 to +100)
- `getNPSDistribution(labId)` → { detratores, neutros, promotores, score }
- `getNPSRespostasDueForAnonymization(labId, days=90)` → NPSResposta[]

---

## Engines (Pure Utils)

### `rcaFiveWhys.ts`
- `validateRCA(rca)` → `{ valid, errors[], warnings[] }`
- `generateCausaRaizHeuristic(porques)` → `{ causaRaizSugerida, confianca }`
- `getProximoNivel(porques)` → 1|2|3|4|5|null
- `isRCAComplete(rca)` → boolean (≥4 levels + causaRaiz)

### `severityClassifier.ts`
- `classificarSeveridadeHeuristica(descricao)` → `{ severidade, confianca, matchedKeywords }`
- `classificarLote(descricoes)` → Array
- `shouldTriggerNCAutocreate(sev, desc)` → boolean

### `auditChain.ts`
- `sha256(data)` → string (64-char hex)
- `computeChainHash(prev, entityId, op, ts, uid)` → string
- `verifyChainIntegrity(entries)` → `{ valid, invalidAt? }`
- `generateLogicalSignature(docState, uid, ts)` → `{ hash, operatorId, ts }`
- `fingerprintDocument(doc)` → string (deterministic JSON)
- `computeDocDiff(before, after)` → Record<string, { before, after }>

---

## Hooks

### `useReclamacoes(filters?)`
- State: `reclamacoes[]`, `loading`, `error`
- Methods: `getById(id)`, `getByStatus(status)`, `getBySeveridade(sev)`
- Cleanup: listener is unsubscribed on unmount

### `useReclamacao(reclamacaoId)`
- State: `reclamacao | null`, `loading`, `error`
- One-time fetch (can be upgraded to listener)

### `useSugestoes(filters?)`
- State: `sugestoes[]`, `loading`, `error`
- Methods: `getById(id)`, `getByStatus(status)`, `getTopVoted()`

### `useSugestao(sugestaoId)`
- State: `sugestao | null`, `loading`, `error`

---

## Cloud Functions (Plan 11-03+)

| Function | Type | Trigger | Purpose |
|----------|------|---------|---------|
| `criarReclamacao` | Callable | Client | Create complaint + classify Gemini + NC auto |
| `classificarReclamacaoIA` | Internal | `criarReclamacao` | Gemini classify |
| `aprovarClassificacao` | Callable | RT | Approve AI suggestion |
| `criarNCDraft` | Firestore trigger | `onDocumentCreated` reclamacoes | Auto-create NC if severity=alta |
| `transitarReclamacao` | Callable | Client | Status change + validate RCA |
| `enviarComunicacaoReclamante` | Callable | Hook | Email status update |
| `dispararNPSPosResolucao` | Firestore trigger | `onUpdate` Reclamacao | Email NPS on Resolvida |
| `dispararNPSRecurring` | Pub/Sub cron | Quarterly | Batch email NPS campaigns |
| `submitNPSResposta` | Callable | Public (token) | Patient submits NPS |
| `anonimizarRespostas` | Pub/Sub cron | Daily 03:00 BRT | Drop `pacienteId` after 90d |
| `criarSugestao` | Callable | Client | Create suggestion |
| `transitarSugestao` | Callable | Client | Change suggestion status |
| `parseEmailReclamacao` | HTTPS | Resend Inbound | Email parser |
| `exportarMeusDadosLgpd` | Callable | Client | Export patient data (Art. 18) |
| `solicitarExclusaoLgpd` | Callable | Client | Request deletion (Art. 19) |
| `exportarParaAnaliseCritica` | Callable | Phase 8 | JSON for management-review |

---

## Known Gotchas

1. **Reclamation anonymous:** MVP requires identification (CPF). Affects notifications + NC + LGPD compliance.
2. **PII in free text:** Patient may enter CPF/phone in descricao. Mitigated by Gemini filter + RT review.
3. **NPS recurring saturation:** 5000 emails/batch → use Pub/Sub queue + rate limit 1000/min.
4. **Worklab deep link versioning:** If Worklab changes params, link breaks. Document contract; use `v=1` param.
5. **Gemini hallucination:** If confidence <0.6, flag for manual RT review.
6. **NC auto-create spam:** Limit 10 reclamações/h per CPF. Severity alta requires ≥100 chars.
7. **LGPD partial anonymization:** Comments may have PII (e.g., "Dr. João grosseiro"). Cron filters >90d.

---

## Pending (Plan 11-02 onwards)

- [ ] Ishikawa diagram (5 Whys now; visual upgrade v1.4)
- [ ] WhatsApp notifications (defer v1.4 + Meta approval)
- [ ] Ouvidoria/PROCON integration (v1.5+)
- [ ] Auto-resolve simple complaints via IA (defer when >500 complaints)
- [ ] NPS incentive via raffle/voucher (defer — legal barriers in Brazil)

---

## Compliance Checklist

- [x] DICQ 4.8 — complaint handling workflow ✓
- [x] DICQ 4.14.3 — customer satisfaction (NPS) ✓
- [x] DICQ 4.14.4 — suggestions ✓
- [x] DICQ 4.14.6 — risk analysis via NC integration ✓
- [x] DICQ 4.15 — critical analysis integration (Phase 8 callable) ✓
- [x] RDC 978 Art. 86, 115, 117 — 5-year retention ✓
- [x] CDC Lei 8.078/90 — 30-day SLA ✓
- [x] LGPD Lei 13.709/18 — Art. 18 (access), Art. 19 (deletion), consent, audit ✓
- [x] ISO 15189:2015 — complete feedback loop ✓

---

## Testing

**Unit Tests (Jest):**
- `rcaFiveWhys.test.ts` — 15+ validation scenarios + heuristic generation
- `severityClassifier.test.ts` — 30+ real complaint phrases
- `auditChain.test.ts` — chain integrity verification

**Integration Tests (Firestore emulator):**
- Complaint creation → NC auto-trigger (severity alta)
- Complaint status transitions with RCA validation
- NPS response anonymization (>90d)
- LGPD request processing

**E2E (Detox, Plan 11-04+):**
- Patient submits complaint via `/portal-paciente/reclamacao/nova`
- Complaint appears in `/reclamacoes` for RT
- RT approves classification
- RCA filled out
- Status → Resolvida triggers NPS email
- Patient responds to NPS
- Complaint status → Fechada

---

## References

- **PLAN:** `.planning/phases/11-feedback-loop/11-01-PLAN.md`
- **CONTEXT:** `.planning/phases/11-feedback-loop/CONTEXT.md`
- **Obsidian:** `C:/Users/labcl/Obsidian_Brain/01_Projetos/HC_Quality*.md` (strategy + compliance maps)
- **ADR 0001:** `docs/adr/0001-audit-chain.md` (chain hash pattern)
- **ADR 0011:** `docs/adr/0011-feedback-loop-architecture.md` (to be created Phase 11-02)

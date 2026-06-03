# Firestore Schema v1.4

**Version:** 1.4  
**Date:** 2026-05-07  
**Phase:** 3.1 (Schema Extensions)  
**Status:** Implementation Complete

---

## Overview

This document defines all 5 new Firestore collections introduced in Phase 3.1, including field specifications, validation rules, and composite index requirements. These collections support Phases 4–12 features (portals, NOTIVISA, critical escalation, IA training, laudo drafts).

---

## Collection: `labs/{labId}/portal-configuracao/{docId}`

**Purpose:** Patient portal branding and localization per lab.

**Path Structure:** `/labs/{labId}/portal-configuracao/{docId}`  
**Tenant Isolation:** Via parent `labId` in path

### Fields

| Field            | Type        | Required | Validation   | Notes                               |
| ---------------- | ----------- | -------- | ------------ | ----------------------------------- |
| `logoCdnUrl`     | `string`    | ✓        | URL format   | CDN URL to lab logo (SVG or PNG)    |
| `primaryColor`   | `string`    | ✓        | Hex #RRGGBB  | Primary UI color (e.g., `#7c3aed`)  |
| `secondaryColor` | `string`    | ✓        | Hex #RRGGBB  | Secondary accent color              |
| `labelLaudo`     | `string`    | ✗        | Max 50 chars | Custom label (default: "Resultado") |
| `labelPaciente`  | `string`    | ✗        | Max 50 chars | Custom label (default: "Paciente")  |
| `termsHTML`      | `string`    | ✗        | Valid HTML   | Terms of service (rich text)        |
| `privacyHTML`    | `string`    | ✗        | Valid HTML   | Privacy policy (rich text)          |
| `updatedAt`      | `timestamp` | ✓        | Server-side  | Timestamp of last update            |
| `updatedBy`      | `string`    | ✓        | Valid uid    | User ID who updated                 |

### Indexes

None required (labId indexed at collection root).

### Example Document

```json
{
  "logoCdnUrl": "https://cdn.example.com/labs/LAB001/logo.png",
  "primaryColor": "#7c3aed",
  "secondaryColor": "#ec4899",
  "labelLaudo": "Resultado de Exame",
  "labelPaciente": "Paciente",
  "termsHTML": "<p>Termos de serviço...</p>",
  "privacyHTML": "<p>Política de privacidade...</p>",
  "updatedAt": "2026-05-07T14:30:00Z",
  "updatedBy": "user-123"
}
```

---

## Collection: `labs/{labId}/notivisa-outbox/events/{docId}`

**Purpose:** Queue and audit trail for NOTIVISA regulatory event notifications (RDC 978 Art. 6º §1).

**Path Structure:** `/labs/{labId}/notivisa-outbox/events/{docId}`  
**Tenant Isolation:** Via parent `labId` in path

### Fields

| Field         | Type        | Required | Validation                                           | Notes                                               |
| ------------- | ----------- | -------- | ---------------------------------------------------- | --------------------------------------------------- |
| `laudo_id`    | `string`    | ✓        | Ref to `laudos`                                      | Reference to result document                        |
| `patient_cpf` | `string`    | ✓        | 11 digits, masked                                    | Masked before transmission (e.g., `123.456.789-**`) |
| `payload`     | `object`    | ✓        | RDC 6º §1 schema                                     | Art. 6º §1 JSON structure for NOTIVISA              |
| `status`      | `string`    | ✓        | Enum: `PENDING` \| `SENT` \| `FAILED` \| `DELIVERED` | Delivery state                                      |
| `attempts`    | `number`    | ✓        | 0–5                                                  | Retry count (max 5)                                 |
| `nextRetry`   | `timestamp` | ✗        | Server-side                                          | Scheduled retry time                                |
| `createdAt`   | `timestamp` | ✓        | Server-side                                          | Event creation time                                 |
| `sentAt`      | `timestamp` | ✗        | Server-side                                          | Time of successful send                             |
| `error`       | `string`    | ✗        | Max 500 chars                                        | Error message if failed                             |

### Indexes

| Index Name                    | Fields                       | Order          | Use Case                |
| ----------------------------- | ---------------------------- | -------------- | ----------------------- |
| `notivisa-pending-by-created` | `(labId, status, createdAt)` | ASC, ASC, DESC | Poll for pending events |
| `notivisa-by-created`         | `createdAt`                  | DESC           | Audit trail ordering    |

### Example Document

```json
{
  "laudo_id": "LAU-2026-05-001",
  "patient_cpf": "123.456.789-**",
  "payload": {
    "tipo_evento": "resultado_disponivel",
    "data_evento": "2026-05-07T14:30:00Z",
    "codigo_exame": "13001",
    "resultado": "positivo"
  },
  "status": "PENDING",
  "attempts": 0,
  "nextRetry": "2026-05-07T14:35:00Z",
  "createdAt": "2026-05-07T14:30:00Z",
  "sentAt": null,
  "error": null
}
```

---

## Collection: `labs/{labId}/criticos-escalacoes/escalacoes/{docId}`

**Purpose:** Critical value escalation log with SMS/email audit trail and SLA tracking.

**Path Structure:** `/labs/{labId}/criticos-escalacoes/escalacoes/{docId}`  
**Tenant Isolation:** Via parent `labId` in path

### Fields

| Field                 | Type            | Required | Validation               | Notes                                    |
| --------------------- | --------------- | -------- | ------------------------ | ---------------------------------------- |
| `resultado_id`        | `string`        | ✓        | Ref to `runs.resultados` | Reference to result                      |
| `threshold_config_id` | `string`        | ✓        | Ref to `criticos` config | Which threshold was violated             |
| `analito`             | `string`        | ✓        | Max 50 chars             | Analyte name (e.g., `"potassium"`)       |
| `valor`               | `number`        | ✓        | —                        | Actual value                             |
| `limite_inferior`     | `number`        | ✗        | —                        | Lower bound (may be null for upper-only) |
| `limite_superior`     | `number`        | ✗        | —                        | Upper bound (may be null for lower-only) |
| `sms_sent_to`         | `array<string>` | ✗        | E.164 format             | Phone numbers notified                   |
| `email_sent_to`       | `array<string>` | ✗        | Valid email              | Emails notified                          |
| `sla_minutes`         | `number`        | ✓        | Positive int             | Target resolution time                   |
| `resolved_at`         | `timestamp`     | ✗        | Server-side              | When escalation was resolved             |
| `resolution_notes`    | `string`        | ✗        | Max 500 chars            | Outcome notes                            |
| `createdAt`           | `timestamp`     | ✓        | Server-side              | Escalation creation time                 |

### Indexes

| Index Name               | Fields               | Order     | Use Case               |
| ------------------------ | -------------------- | --------- | ---------------------- |
| `criticos-by-date`       | `(labId, createdAt)` | ASC, DESC | Trending dashboard     |
| `criticos-by-resolution` | `resolved_at`        | ASC       | SLA tracking + cleanup |

### Example Document

```json
{
  "resultado_id": "RES-2026-05-0042",
  "threshold_config_id": "CFG-POTASSIUM-CRITICAL",
  "analito": "potassium",
  "valor": 7.5,
  "limite_inferior": 3.5,
  "limite_superior": 5.5,
  "sms_sent_to": ["+5511999999999"],
  "email_sent_to": ["dr.silva@lab.com"],
  "sla_minutes": 30,
  "resolved_at": "2026-05-07T15:00:00Z",
  "resolution_notes": "Paciente contactado. Repetição de coleta solicitada.",
  "createdAt": "2026-05-07T14:30:00Z"
}
```

---

## Collection: `labs/{labId}/imuno-ias-dev/images/{docId}`

**Purpose:** Strip image metadata for immunology IA OCR training pipeline (Phase 9 research).

**Path Structure:** `/labs/{labId}/imuno-ias-dev/images/{docId}`  
**Tenant Isolation:** Via parent `labId` in path

### Fields

| Field                  | Type            | Required | Validation       | Notes                                          |
| ---------------------- | --------------- | -------- | ---------------- | ---------------------------------------------- |
| `imageUrl`             | `string`        | ✓        | CDN URL          | Cloud Storage or CDN URL to strip image        |
| `imageDim`             | `object`        | ✓        | —                | Image dimensions                               |
| `imageDim.width`       | `number`        | ✓        | Positive int     | Width in pixels                                |
| `imageDim.height`      | `number`        | ✓        | Positive int     | Height in pixels                               |
| `classesDetected`      | `array<string>` | ✓        | Enum list        | Auto-detected classes (e.g., `["IgG", "IgM"]`) |
| `confidence`           | `number`        | ✓        | 0.0–1.0          | Model confidence score                         |
| `model_version`        | `string`        | ✓        | Semantic version | Model ID (e.g., `"1.0-base"`, `"1.1-tuned"`)   |
| `feedback`             | `object`        | ✗        | —                | Human feedback (optional)                      |
| `feedback.classes`     | `array<string>` | ✗        | Enum list        | Corrected classes                              |
| `feedback.correctedBy` | `string`        | ✗        | Valid uid        | User who corrected                             |
| `feedback.correctedAt` | `timestamp`     | ✗        | Server-side      | Correction timestamp                           |
| `createdAt`            | `timestamp`     | ✓        | Server-side      | Image upload time                              |
| `batch_id`             | `string`        | ✗        | —                | Training batch ID (nullable)                   |

### Indexes

| Index Name                | Fields                              | Order          | Use Case               |
| ------------------------- | ----------------------------------- | -------------- | ---------------------- |
| `imuno-by-model-and-date` | `(labId, model_version, createdAt)` | ASC, ASC, DESC | IA research pipeline   |
| `imuno-by-batch`          | `batch_id`                          | ASC            | Training batch queries |

### Example Document

```json
{
  "imageUrl": "https://storage.googleapis.com/hmatologia2/labs/LAB001/strips/IMG-2026-05-001.jpg",
  "imageDim": {
    "width": 1200,
    "height": 800
  },
  "classesDetected": ["IgG", "IgM"],
  "confidence": 0.94,
  "model_version": "1.1-tuned",
  "feedback": {
    "classes": ["IgG", "IgM", "IgA"],
    "correctedBy": "user-456",
    "correctedAt": "2026-05-07T15:15:00Z"
  },
  "createdAt": "2026-05-07T14:45:00Z",
  "batch_id": "BATCH-2026-MAY-RETRAIN"
}
```

---

## Collection: `labs/{labId}/laudos-draft/rascunhos/{docId}`

**Purpose:** Laudo edit state machine for RT portal with pessimistic locking (Phase 5).

**Path Structure:** `/labs/{labId}/laudos-draft/rascunhos/{docId}`  
**Tenant Isolation:** Via parent `labId` in path

### Fields

| Field             | Type        | Required | Validation                                 | Notes                                           |
| ----------------- | ----------- | -------- | ------------------------------------------ | ----------------------------------------------- |
| `laudo_id`        | `string`    | ✓        | Ref to `laudos`                            | Reference to published laudo                    |
| `edited_by`       | `string`    | ✓        | Valid uid                                  | RT user currently editing                       |
| `content_json`    | `object`    | ✓        | —                                          | Laudo content snapshot (mutable during editing) |
| `locked_until_ts` | `timestamp` | ✓        | Server-side                                | Pessimistic lock expiry                         |
| `version`         | `number`    | ✓        | Positive int                               | Conflict detection counter                      |
| `status`          | `string`    | ✓        | Enum: `EDITING` \| `LOCKED` \| `PUBLISHED` | Draft state                                     |
| `updatedAt`       | `timestamp` | ✓        | Server-side                                | Last edit timestamp                             |
| `publishedAt`     | `timestamp` | ✗        | Server-side                                | When draft was published                        |
| `draft_notes`     | `string`    | ✗        | Max 1000 chars                             | Internal RT notes (not visible to patient)      |

### Indexes

| Index Name                    | Fields              | Order    | Use Case                     |
| ----------------------------- | ------------------- | -------- | ---------------------------- |
| `laudos-draft-by-laudo`       | `(labId, laudo_id)` | ASC, ASC | Draft lookup per laudo       |
| `laudos-draft-by-lock-expiry` | `locked_until_ts`   | ASC      | Cleanup cron (expired locks) |

### Example Document

```json
{
  "laudo_id": "LAU-2026-05-001",
  "edited_by": "user-789",
  "content_json": {
    "paciente_nome": "João Silva",
    "exames": [
      {
        "codigo": "13001",
        "resultado": "Positivo",
        "referencia": "Negativo"
      }
    ],
    "comentarios": "Resultado compatível com infecção recente"
  },
  "locked_until_ts": "2026-05-07T16:30:00Z",
  "version": 3,
  "status": "EDITING",
  "updatedAt": "2026-05-07T15:30:00Z",
  "publishedAt": null,
  "draft_notes": "Aguardando confirmação de LIS; reteste solicitado"
}
```

---

## Cross-Collection References

**Summary of references between collections:**

| From                             | To                | Field                 | Purpose                                   |
| -------------------------------- | ----------------- | --------------------- | ----------------------------------------- |
| `notivisa-outbox/events`         | `laudos`          | `laudo_id`            | Track which result triggered notification |
| `criticos-escalacoes/escalacoes` | `runs.resultados` | `resultado_id`        | Link escalation to result                 |
| `criticos-escalacoes/escalacoes` | `criticos`        | `threshold_config_id` | Which threshold was violated              |
| `laudos-draft/rascunhos`         | `laudos`          | `laudo_id`            | Map draft to published result             |

---

## Multi-Tenant Isolation Strategy

All 5 collections follow the same multi-tenant isolation pattern:

1. **Path-based isolation:** Every collection routes through `/labs/{labId}/`, enforced at Firestore rules level.
2. **Payload redundancy:** Documents carry `labId` field in payload (defense-in-depth) — rules validate `payload.labId == path.labId`.
3. **Soft-delete only:** No hard deletes; mark with `deletadoEm` timestamp if applicable (applies to future phases).
4. **Audit trail:** All writes include `criadoEm` and `updatedBy` fields for regulatory compliance.

---

## Indexes Summary

**Total new composite indexes:** 5

| Collection                       | Composite Index                     | Order          | Priority              |
| -------------------------------- | ----------------------------------- | -------------- | --------------------- |
| `notivisa-outbox/events`         | `(labId, status, createdAt)`        | ASC, ASC, DESC | HIGH (polling queue)  |
| `criticos-escalacoes/escalacoes` | `(labId, createdAt)`                | ASC, DESC      | HIGH (dashboard)      |
| `imuno-ias-dev/images`           | `(labId, model_version, createdAt)` | ASC, ASC, DESC | MEDIUM (research)     |
| `laudos-draft/rascunhos`         | `(labId, laudo_id)`                 | ASC, ASC       | HIGH (lookups)        |
| `laudos-draft/rascunhos`         | `(labId, locked_until_ts)`          | ASC, ASC       | MEDIUM (cleanup cron) |

**Single-field indexes:** 2 (created by composite indexes above or handled by Firestore auto-indexing)

---

## Deployment Order

1. ✅ Create all 5 collections in Firestore Console or via `firebase deploy`
2. ✅ Create all 5 composite indexes
3. ✅ Update `firestore.indexes.json` with new index definitions
4. ✅ Load test data into staging environment
5. ✅ Run schema validation: `npm run firestore:schema-validate`
6. ✅ Deploy rules and indexes: `firebase deploy --only firestore:rules,firestore:indexes`

---

## Validation Checklist

- [x] All 5 collections accessible in Firestore Console
- [x] All 5 composite indexes created and `ENABLED`
- [x] `firestore.indexes.json` updated
- [x] TypeScript types generated or imported
- [x] Test data created in staging
- [x] Rules updated to protect new collections
- [x] No TypeScript compilation errors

---

## Notes for Next Phases

- **Phase 3.2 (Rules):** Add Firestore security rules for all 5 collections
- **Phase 3.3 (Functions):** Implement callables for NOTIVISA event publishing, critical escalation handlers, draft publishing
- **Phase 4–12:** Consume these collections in module implementations

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Author:** Stream D — DB Engineer  
**Status:** Ready for deployment

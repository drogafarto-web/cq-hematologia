# Phase 6: Critical Values Escalation & Notifications — Detailed Execution Plan

**Version:** 1.0  
**Date:** 2026-05-07  
**Scope:** Critical values auto-escalation workflow for HC Quality v1.4 Wave 2  
**Confidence:** HIGH (criticos module foundation + bioquimica schema + callable patterns from Phase 5)  
**Status:** READY FOR EXECUTION

---

## Executive Summary

Phase 6 automates escalation of critical lab results to physicians and RTs via multi-channel notifications (SMS + email) with SLA tracking and NOTIVISA draft auto-generation. The system:

1. **Classifies results as críticos** via configurable lab-level thresholds (always/never/range-based rules)
2. **Escalates immediately** to physician (SMS) + RT (email) when laudo status transitions to `crítico`
3. **Tracks SLA** from detection → acknowledgment (target: <X minutes, configurable per lab)
4. **Generates NOTIVISA drafts** for reportable conditions (auto-submission gate via RT review)
5. **Logs all escalations** in `criticos-escalacoes` collection with audit trail
6. **Implements fallback** (email if SMS fails) + delivery verification

**Key Deliverables:**

- Firestore schema (3 new collections, 2 index patterns)
- 7 Cloud Function callables + 1 cron trigger (5-min SLA poll)
- Twilio integration (SMS templates, delivery tracking)
- Email templates (both SMS fallback + NOTIVISA notification)
- 20+ unit tests, 5+ E2E specs
- Documentation: integration guide + operational runbook

---

## Architecture Overview

### Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Critical Values Escalation Flow                  │
│                                                                      │
│  1. Laudo Created/Updated (bioquimica module)                       │
│     ↓                                                                │
│  2. Client calls: detectCriticosEm(exames, thresholds, paciente)   │
│     ↓                                                                │
│  3. If hasCritico: POST /api/criticos/detectar                      │
│     ↓                                                                │
│  4. Cloud Function: registerCriticoDetection()                     │
│     ├─ Validate thresholds (via labSettings)                       │
│     ├─ Verify physician contact info (laudoPayload.medico*)        │
│     ├─ Create escalacao entry (criticos-escalacoes)                │
│     ├─ Send SMS to physician (Twilio)                              │
│     ├─ If SMS fails → queue email fallback                         │
│     ├─ Log attempt in criticos-log-eventos                         │
│     └─ Return {escalacaoId, smsStatus, eta}                        │
│                                                                      │
│  5. Scheduled Trigger: escalacaoCriticos (every 5 min) [cron]      │
│     ├─ Scan pending escalacoes (status='enviado')                  │
│     ├─ Check SMS delivery status via Twilio API                    │
│     ├─ If undelivered >10min: escalate via email                   │
│     ├─ If acknowledged: mark status='reconhecido'                  │
│     └─ Update SLA metrics in escalacao doc                         │
│                                                                      │
│  6. Physician Portal (future v1.5): ACK button                      │
│     ├─ Calls acknowledgeEscalacao(escalacaoId)                     │
│     └─ Updates status='reconhecido' + tempo_reconhecimento         │
│                                                                      │
│  7. If reportable condition: generateNOTIVISADraft()               │
│     ├─ Pre-populate form (exame, resultado, analito)               │
│     ├─ Queue for RT review in notivisa-outbox                      │
│     └─ RT submits via NOTIVISA API (Phase 8, v1.5)                 │
└─────────────────────────────────────────────────────────────────────┘
```

### System Tiers

| Tier               | Component                              | Responsibility                                           |
| ------------------ | -------------------------------------- | -------------------------------------------------------- |
| **Frontend**       | `CriticosDetector.tsx` (bioquimica)    | Client-side detection; triggers callable on critico flag |
| **API**            | Cloud Functions (7 callables + 1 cron) | Orchestration, SMS/email, SLA tracking, NOTIVISA drafts  |
| **Database**       | 3 new Firestore collections            | Audit trail (append-only), SLA metrics, NOTIVISA queue   |
| **SMS Provider**   | Twilio (regional: São Paulo)           | SMS delivery + tracking (webhook for delivery status)    |
| **Email Provider** | Firebase/SMTP (fallback)               | Email fallback + NOTIVISA notifications                  |

---

## 1. Firestore Schema

### New Collections

#### 1.1 `/labs/{labId}/criticos-thresholds/{thresholdId}`

Per-lab configurable critical value thresholds. Replaces hardcoded ranges — allows RT to customize by patient population, analyte, severity.

**Document Structure:**

```typescript
interface CriticosThreshold {
  // Identity
  id: string;
  labId: string;

  // Analyte reference
  analitoId: string; // Foreign key → /bioquimica/analitos/{analitoId}
  analitoNome: string; // Denormalized for UI (copy from bula)
  unidade: string; // Must match analito.unidade

  // Range-based rules
  min: number | null; // Lower critical bound (null = no lower limit)
  max: number | null; // Upper critical bound (null = no upper limit)
  alwaysCritico?: boolean; // Force critico regardless of range (e.g., "<0")
  neverCritico?: boolean; // Whitelist (never escalate for this analito)

  // Severity classification
  severidade: 'alta' | 'baixa'; // High=life-threatening, Low=action required

  // Conditional rules (population-specific)
  condicional?: {
    idadeMin?: number; // Min age (years) for this rule to apply
    idadeMax?: number; // Max age
    sexo?: 'M' | 'F'; // Applicable only to this sex
  };

  // Audit
  criadoEm: Timestamp;
  criadoPor: string; // UserId of RT who set threshold
  ativo: boolean; // Soft delete
  deletadoEm: Timestamp | null;
}
```

**Firestore Indexes:**

```firestore
{
  "collection": "/labs/{labId}/criticos-thresholds",
  "fieldConfig": [
    { "fieldPath": "analitoId", "order": "ASCENDING" },
    { "fieldPath": "ativo", "order": "DESCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ],
  "queryScope": "COLLECTION"
}
```

**Rules Pattern:**

```firestore
// Only RT + Owner can read/write thresholds
match /criticos-thresholds/{thresholdId} {
  allow read: if isActiveMemberOfLab(labId) && hasModuleAccess(request, 'criticos');
  allow create: if isRTOrOwner(labId) && validCriticosThreshold(resource.data);
  allow update: if isRTOrOwner(labId) && keepsLabId() && keepsCreatedAt();
  allow delete: if false;  // Soft delete only
}
```

---

#### 1.2 `/labs/{labId}/criticos-escalacoes/{escalacaoId}`

Master log of critical value escalations. One doc per detection event. Immutable after creation; updates only for SLA tracking + acknowledgment.

**Document Structure:**

```typescript
interface CriticosEscalacao {
  // Identity
  id: string;
  labId: string;

  // Source reference
  laudoId: string; // Foreign key → /liberacao/laudos/{laudoId}
  laudoVersion: number; // Version at time of escalation (for audit trail)
  exameId: string; // Which exam in laudo triggered escalation
  analitoId: string; // Which analyte (copy from exame for audit)
  valorObtido: number;

  // Threshold applied
  thresholdId: string; // Which threshold doc was used
  severidade: 'alta' | 'baixa';
  motivo: string; // "Acima de 250" | "Abaixo de 20"

  // Patient context (copied for audit trail — not linked)
  pacienteId: string;
  pacienteNome: string;
  pacienteIdade: number;
  pacienteSexo: 'M' | 'F' | 'NI';

  // Physician contact info (from laudo at time of escalation)
  medicoId: string;
  medicoNome: string;
  medicoTelefone: string; // Phone for SMS (must be E.164 format: +55XXXXXXXXXX)
  medicoEmail: string;

  // RT contact info (from labSettings)
  rtId: string;
  rtNome: string;
  rtEmail: string;

  // Escalation attempts (immutable log)
  escalacoes: Array<{
    canalId: string; // Unique ID per escalation attempt (uuid)
    canal: 'SMS' | 'EMAIL' | 'WEBHOOK';
    status: 'enviado' | 'entregue' | 'falha' | 'descartado';
    enviado_em: Timestamp; // Server-sealed timestamp
    entregue_em?: Timestamp; // When provider confirmed delivery
    motivo_falha?: string; // If status='falha', why? (e.g., "invalid_number")
    provider_messageId?: string; // Twilio sid or email msgId
    tentativa_numero: number; // 1, 2, 3... for retry logic
    operador_manual?: string; // UserId if RT forced re-escalation
  }>;

  // Acknowledgment tracking
  status: 'enviado' | 'reconhecido' | 'cancelado';
  reconhecido_em?: Timestamp; // When physician/RT acknowledged
  reconhecido_por?: string; // UserId or 'twilio_webhook' if automated

  // SLA metrics
  tempo_deteccao_ms?: number; // ms from laudo create to escalacao create
  tempo_sla_ms?: number; // ms from escalacao create to reconhecimento
  sla_status: 'em_prazo' | 'vencido' | 'nao_aplicavel';
  sla_minutos_target: number; // e.g., 30 (from labSettings.criticosSLAMinutos)

  // NOTIVISA linkage
  notivisaDraftId?: string; // If condition is reportable

  // Audit
  criadoEm: Timestamp;
  criadoPor: string; // System (callable owner)
  atualizadoEm: Timestamp;
  atualizadoPor: string;
  deletadoEm: Timestamp | null;
}
```

**Firestore Indexes:**

```firestore
{
  "collection": "/labs/{labId}/criticos-escalacoes",
  "fieldConfig": [
    { "fieldPath": "laudoId", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "criadoEm", "order": "DESCENDING" }
  ],
  "queryScope": "COLLECTION"
}
{
  "collection": "/labs/{labId}/criticos-escalacoes",
  "fieldConfig": [
    { "fieldPath": "sla_status", "order": "ASCENDING" },
    { "fieldPath": "reconhecido_em", "order": "ASCENDING" }
  ],
  "queryScope": "COLLECTION"
}
```

**Rules Pattern:**

```firestore
// Read: RT + Auditor only (SLA tracking is compliance-sensitive)
match /criticos-escalacoes/{escalacaoId} {
  allow read: if isRTOrOwner(labId) || hasRole('auditor');
  allow create: if false;  // Only Cloud Function can write
  allow update: if false;  // Only Cloud Function (via Admin SDK)
  allow delete: if false;
}
```

---

#### 1.3 `/labs/{labId}/criticos-log-eventos/{eventoId}`

Append-only log of all escalation events (send attempt, delivery confirmation, acknowledgment). Compliance trail per RDC 978 Art. 128 (rastreabilidade).

**Document Structure:**

```typescript
interface CriticosLogEvento {
  // Identity
  id: string;
  labId: string;

  // References
  escalacaoId: string; // Parent escalacao doc
  laudoId: string;

  // Event type
  tipo:
    | 'sms_enviado'
    | 'sms_entregue'
    | 'sms_falha'
    | 'email_enviado'
    | 'email_entregue'
    | 'email_falha'
    | 'webhook_delivery_confirmed'
    | 'reconhecimento_manual'
    | 'sla_vencido_alerta'
    | 'escalacao_cancelada';

  // Event details
  detalhes: {
    [key: string]: string | number | boolean;
    // Examples:
    // sms_enviado: { canal: "SMS", telefone_masked: "+55 98XXXXX100", twilio_sid: "SM..." }
    // sms_falha: { motivo: "invalid_number", codigo_erro: "21211" }
    // reconhecimento_manual: { reconhecido_por: "medico_id", metodo: "portal_web" }
  };

  // Server-sealed metadata
  timestamp: Timestamp;
  operadorId: string; // request.auth.uid (system function name if callable)
  assinatura: LogicalSignature; // { hash, operatorId, ts }

  // Previous event chain (ADR-0012 pattern for immutability verification)
  eventoAnteriorId?: string;

  // Audit
  deletadoEm: Timestamp | null;
}
```

**Firestore Indexes:**

```firestore
{
  "collection": "/labs/{labId}/criticos-log-eventos",
  "fieldConfig": [
    { "fieldPath": "escalacaoId", "order": "ASCENDING" },
    { "fieldPath": "timestamp", "order": "DESCENDING" }
  ],
  "queryScope": "COLLECTION"
}
```

**Rules Pattern:**

```firestore
// Append-only for compliance
match /criticos-log-eventos/{eventoId} {
  allow read: if isRTOrOwner(labId) || hasRole('auditor');
  allow create: if false;  // Only Cloud Function
  allow update: if false;  // Immutable
  allow delete: if false;
}
```

---

### Updated Collections

#### labSettings: Add critical-values config

Add to existing `/labs/{labId}/labSettings` doc:

```typescript
interface LabSettings {
  // ... existing fields ...

  criticos: {
    ativo: boolean; // Master on/off flag
    canaisPrefixo: 'SMS' | 'EMAIL' | 'SMS_THEN_EMAIL';
    slaMinutosTarget: number; // e.g., 30, 60, 120
    slaAlertas: {
      minutos50Pct: number; // Alert at 50% SLA elapsed
      minutos100Pct: number; // Escalate at 100% (retry)
    };

    // Reporting thresholds
    condicoesNotivisaveis: Array<{
      analitoId: string;
      condicao: string; // e.g., "valor > 350 E sexo = F E idade < 18"
    }>;

    // Twilio config (runtime lookup for regional number)
    twilioNumberRegional: string; // e.g., "+5511XXXXXXXX" (São Paulo)

    // Email config
    emailTemplateId?: string; // If using custom template (future)

    // Audit trail linkage
    auditLevel: 'basico' | 'completo'; // completo = all events logged
  };
}
```

**Update Rule:**

```firestore
// Only Owner can modify criticos settings
allow update: if isOwner(labId)
  && !hasModified(['criticos.ativo', 'criticos.slaMinutosTarget', 'criticos.condicoesNotivisaveis']);
  // Granular access; RT cannot lower SLA targets or disable criticality rules
```

---

### Cross-Module Schema Updates

#### liberacao/laudo: Add criticoMetadata

Update `Laudo` interface in `src/features/liberacao/types/laudo.ts`:

```typescript
export interface Laudo {
  // ... existing fields ...

  // Critical values metadata (denormalized for fast lookup)
  criticoMetadata?: {
    hasCritico: boolean;
    analitosCriticos: Array<{
      analitoId: string;
      analitoNome: string;
      valor: number;
      severidade: 'alta' | 'baixa';
      motivo: string;
    }>;
    escalacaoId?: string; // First escalacao attempt (for linking)
    deteccaoEm: Timestamp;
  };

  // Physician contact info (copied to escalacao for audit)
  medicoSolicitanteTelefone?: string; // New field; must be E.164 format
}
```

---

## 2. Cloud Function Callables

### 2.1 `registerCriticoDetection()`

**Purpose:** Accept critical detection from client, validate, escalate, create escalacao doc, send SMS.

**Signature:**

```typescript
interface RegisterCriticoDetectionRequest {
  labId: string;
  laudoId: string;
  laudoVersion: number;
  exames: Array<{
    id: string; // exameId
    analitoId: string;
    valor: number;
    unidade: string;
  }>;
  criticos: Array<{
    exameId: string;
    analitoId: string;
    valor: number;
    severidade: 'alta' | 'baixa';
    motivo: string;
  }>;
  paciente: {
    id: string;
    nome: string;
    idade: number;
    sexo: 'M' | 'F' | 'NI';
  };
  medico: {
    id: string;
    nome: string;
    telefone: string; // Must be E.164: +55XXXXXXXXXX
    email: string;
  };
}

interface RegisterCriticoDetectionResponse {
  success: boolean;
  escalacaoId: string; // New escalacao doc ID
  escalacoes: Array<{
    canalId: string;
    canal: 'SMS' | 'EMAIL';
    status: 'enviado' | 'falha';
    providerMessageId?: string;
    errorCode?: string;
  }>;
  sla: {
    slaMinutosTarget: number;
    etaAckMs: number; // Expected ack time in ms
  };
  notivisaDraftId?: string;
}
```

**Implementation Steps:**

1. **Validate input** (Zod schema)
2. **Fetch labSettings** (`/labs/{labId}/labSettings`) → check `criticos.ativo`
3. **Fetch thresholds** from `criticos-thresholds` (verify detection matches a configured threshold)
4. **Validate physician contact** (phone format E.164, not empty)
5. **Create escalacao doc** in `/labs/{labId}/criticos-escalacoes/{escalacaoId}`
   - Initialize with first escalacao attempt (SMS)
   - Set `status: 'enviado'`
   - Calculate SLA target from `labSettings.criticos.slaMinutosTarget`
6. **Send SMS via Twilio** (see SMS templates below)
   - Use phone from physician + laudo
   - Handle failures gracefully (queue email fallback if SMS fails)
   - Store Twilio `sid` in escalacao.escalacoes[0].provider_messageId
7. **Log event** in `/criticos-log-eventos/sms_enviado`
8. **Check if reportable** (consult `labSettings.criticos.condicoesNotivisaveis`)
   - If yes: generate NOTIVISA draft (see 2.7)
9. **Return response** with escalacaoId + channel status

---

### 2.2 `acknowledgeEscalacao(escalacaoId, acknowledgedBy, method)`

**Purpose:** Mark escalacao as acknowledged by physician or RT (manual via portal).

**Signature:**

```typescript
interface AcknowledgeEscalacaoRequest {
  labId: string;
  escalacaoId: string;
  acknowledgedBy: string; // UserId
  method: 'portal_web' | 'webhook_twilio' | 'manual_rt';
  notas?: string;
}

interface AcknowledgeEscalacaoResponse {
  success: boolean;
  escalacaoId: string;
  status: 'reconhecido';
  tempoSlaMs: number;
  slaStatus: 'em_prazo' | 'vencido';
}
```

**Implementation Steps:**

1. **Fetch escalacao doc**
2. **Validate state** (must be `status: 'enviado'`)
3. **Update escalacao:**
   - `status: 'reconhecido'`
   - `reconhecido_em: Timestamp.now()`
   - `reconhecido_por: acknowledgedBy`
   - Calculate `tempo_sla_ms` and `sla_status` (vencido if > target)
4. **Log event** in `/criticos-log-eventos/reconhecimento_manual`
5. **Return response** with SLA metrics

---

### 2.3 `escalacaoCriticos()` — Cron Trigger (5-min interval)

**Purpose:** Poll pending escalacoes, check SMS delivery status via Twilio, retry failed escalations, alert on SLA violations.

**Signature:**

```typescript
interface EscalacaoCriticosRequest {
  labId?: string; // Optional: if omitted, scan all labs
}

interface EscalacaoCriticosResponse {
  labsScanned: number;
  escalacoesPending: number;
  smsConfirmed: number;
  smsRetried: number;
  slaVencidos: number;
  errors: Array<{
    escalacaoId: string;
    error: string;
  }>;
}
```

**Implementation Steps:**

1. **List all labs** (if labId not provided) or use specific labId
2. **For each lab, query pending escalacoes:**
   ```
   WHERE status == 'enviado' && escalacoes[0].canal == 'SMS'
   ORDER BY criadoEm DESC
   ```
3. **For each pending escalacao:**
   - **Check SMS delivery status** via Twilio API:
     - Call `Twilio.messages(sid).fetch()` for each escalacao.escalacoes[0].provider_messageId
     - If status === 'delivered': update escalacao.escalacoes[0].status = 'entregue', log event
     - If status === 'failed' or status === 'undelivered':
       - If time since attempt < 10min: retry with same provider (update attempt_numero)
       - Else: escalate to email (append new escalacao entry for EMAIL canal)
   - **Check SLA violations:**
     - If time since creation > labSettings.criticos.slaMinutosTarget:
       - Set `sla_status: 'vencido'`
       - If not acknowledged: send alert email to RT (template: "Critical SLA Breach")
       - Log event: `sla_vencido_alerta`
4. **Update Firestore docs** via `writeBatch` for atomicity
5. **Return summary** of actions taken

**Scheduled Config (firebase.json):**

```json
{
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs22",
      "ignore": ["node_modules", "**/__tests__", "*.test.ts"],
      "build": {
        "runtime": "nodejs22"
      }
    }
  ],
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

Add to `functions/src/index.ts`:

```typescript
export const escalacaoCriticos = onSchedule(
  {
    schedule: 'every 5 minutes',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MB',
  },
  async (context) => {
    // Implementation
  },
);
```

---

### 2.4 `retryEscalacao(escalacaoId, novoCanal)`

**Purpose:** Manually retry escalation via alternate channel (RT action).

**Signature:**

```typescript
interface RetryEscalacaoRequest {
  labId: string;
  escalacaoId: string;
  novoCanal: 'SMS' | 'EMAIL'; // Must differ from previous attempt
  motivoRetry: string; // e.g., "Número trocado por RT"
}

interface RetryEscalacaoResponse {
  success: boolean;
  escalacaoId: string;
  novoTentativoId: string;
  status: 'enviado';
  canal: 'SMS' | 'EMAIL';
}
```

**Implementation Steps:**

1. **Fetch escalacao doc**
2. **Append new escalacao entry** to `.escalacoes[]` array:
   - `tentativa_numero: prevMax + 1`
   - `canal: novoCanal`
   - `status: 'enviado'`
   - `operador_manual: request.auth.uid`
3. **Send via new canal** (SMS or Email)
4. **Log event** in `/criticos-log-eventos/escalacao_retry_{SMS|EMAIL}`
5. **Return response**

---

### 2.5 `cancelarEscalacao(escalacaoId, motivo)`

**Purpose:** Cancel escalation (e.g., false alarm, result corrected).

**Signature:**

```typescript
interface CancelarEscalacaoRequest {
  labId: string;
  escalacaoId: string;
  motivo: string; // e.g., "Resultado corrigido pelo analisador"
}

interface CancelarEscalacaoResponse {
  success: boolean;
  escalacaoId: string;
  status: 'cancelado';
}
```

**Implementation Steps:**

1. **Fetch escalacao doc**
2. **Validate state** (must still be `status: 'enviado'`)
3. **Update escalacao:**
   - `status: 'cancelado'`
   - Log cancellation reason
4. **Stop any pending Twilio SMS** (if SLA not yet expired, attempt to recall via Twilio API)
5. **Log event** in `/criticos-log-eventos/escalacao_cancelada`
6. **Return response**

---

### 2.6 `listCriticosEscalacoes(labId, filters)`

**Purpose:** Fetch escalacao history for RT dashboard / auditor review.

**Signature:**

```typescript
interface ListCriticosEscalacoeRequest {
  labId: string;
  filters?: {
    status?: 'enviado' | 'reconhecido' | 'cancelado';
    slaStatus?: 'em_prazo' | 'vencido';
    dataDe?: Date;
    dataAte?: Date;
    escalacaoIds?: string[];
  };
  limit?: number; // Default 50, max 500
  orderBy?: 'criadoEm' | 'reconhecido_em';
}

interface ListCriticosEscalacoeResponse {
  total: number;
  escalacoes: CriticosEscalacao[];
  nextPageToken?: string;
}
```

**Implementation Steps:**

1. **Build Firestore query** from filters
2. **Apply pagination** (cursor-based via nextPageToken)
3. **Fetch docs** from `/labs/{labId}/criticos-escalacoes`
4. **Enrich with laudo data** (optional: fetch linked laudos for UI context)
5. **Return results**

---

### 2.7 `generateNOTIVISADraft(escalacaoId)`

**Purpose:** Auto-generate NOTIVISA draft for reportable conditions.

**Signature:**

```typescript
interface GenerateNOTIVISADraftRequest {
  labId: string;
  escalacaoId: string;
}

interface GenerateNOTIVISADraftResponse {
  success: boolean;
  notivisaDraftId: string;
  status: 'rascunho'; // Ready for RT review
  campos: {
    // Pre-populated NOTIVISA form fields
    tipo: string; // "Desvio de Qualidade" | "Falha de Equipamento"
    descricao: string;
    criteriosDeRisco: string[];
  };
  proximoPassoAction: 'rt_review' | 'ja_notificado';
}
```

**Implementation Steps:**

1. **Fetch escalacao + laudo** to get result details
2. **Lookup reportable condition** from `labSettings.criticos.condicoesNotivisaveis`
   - Match on analitoId + valor range
3. **Create draft doc** in `/labs/{labId}/notivisa-outbox/{draftId}`
   ```typescript
   interface NOTIVISADraft {
     id: string;
     escalacaoId: string;
     laudoId: string;
     status: 'rascunho' | 'sob_revisao_rt' | 'enviado_notivisa' | 'cancelado';
     tipo: string;
     descricao: string;
     criteriosDeRisco: string[];
     formFields: Record<string, any>; // Full NOTIVISA form
     criadoEm: Timestamp;
     revisadoPor?: string;
     revisadoEm?: Timestamp;
   }
   ```
4. **Link escalacao to draft** (set `escalacao.notivisaDraftId = draftId`)
5. **Return response**

---

### 2.8 `getCriticosThresholds(labId)`

**Purpose:** Fetch active thresholds for client-side detection (read-only).

**Signature:**

```typescript
interface GetCriticosThresholdsRequest {
  labId: string;
}

interface GetCriticosThresholdsResponse {
  thresholds: CriticosThreshold[];
  lastUpdated: Timestamp;
}
```

**Implementation Steps:**

1. **Query** `/labs/{labId}/criticos-thresholds` WHERE `ativo == true`
2. **Cache result** (TTL 5 min) to avoid repeated reads
3. **Return thresholds**

---

## 3. SMS & Email Templates

### 3.1 SMS Template (Twilio)

**Channel:** SMS (160 chars, must be concise)

**Template:**

```
HC Qualidade CRÍTICO
Paciente: {pacienteNome}
Analito: {analitoNome}
Valor: {valorObtido} {unidade}
Ref: {laudoId}
Responda RECONHECER para confirmar
```

**Parameters:**

- `{pacienteNome}` — First name only (privacy)
- `{analitoNome}` — e.g., "Glicose"
- `{valorObtido}` — e.g., "487"
- `{unidade}` — e.g., "mg/dL"
- `{laudoId}` — Short ID for reference (first 8 chars of UUID)

**SMS character count:** ~120 chars (2 SMS if longer)

**Twilio Configuration:**

- **Sending Number:** Regional São Paulo: `+5511XXXXXXXX` (from labSettings.criticos.twilioNumberRegional)
- **Provider:** Twilio (standard account)
- **Delivery Report:** Enable (webhook callback for status updates)
- **Retry Policy:** Twilio built-in (3 attempts, exponential backoff)

---

### 3.2 Email Template — SMS Fallback

**Subject:** `[CRÍTICO] {pacienteNome} — {analitoNome}`

**Body:**

```html
<html>
  <body style="font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px;">
    <div
      style="max-width: 600px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px;"
    >
      <div style="border-left: 4px solid #ef4444; padding-left: 16px;">
        <h2 style="color: #991b1b; margin: 0 0 12px 0;">⚠️ Resultado Crítico Detectado</h2>
      </div>

      <p style="color: #374151; line-height: 1.6;">
        <strong>Paciente:</strong> {pacienteNome}<br />
        <strong>Analito:</strong> {analitoNome}<br />
        <strong>Valor Obtido:</strong>
        <span style="color: #991b1b; font-weight: bold;">{valorObtido} {unidade}</span><br />
        <strong>Limiar Crítico:</strong> {limite}<br />
        <strong>Severidade:</strong> <span style="color: {severidadeCor};">{severidade}</span><br />
      </p>

      <div
        style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 12px; margin: 16px 0;"
      >
        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
          <strong>Ação Requerida:</strong> Revisar resultado imediatamente no portal HC Qualidade.
        </p>
      </div>

      <a
        href="https://hmatologia2.web.app/laudos/{laudoId}"
        style="display: inline-block; background: #3b82f6; color: white; padding: 10px 16px; border-radius: 4px; text-decoration: none; margin-top: 12px;"
      >
        Acessar Laudo
      </a>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        HC Qualidade — Sistema de Controle Interno de Qualidade<br />
        {labName} — {labTelefone}
      </p>
    </div>
  </body>
</html>
```

---

### 3.3 Email Template — SLA Breach Alert (to RT)

**Subject:** `[URGENTE] SLA Crítico Vencido — {pacienteNome}`

**Body:**

```html
<html>
  <body style="font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px;">
    <div
      style="max-width: 600px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px;"
    >
      <div style="border-left: 4px solid #dc2626; padding-left: 16px;">
        <h2 style="color: #7f1d1d; margin: 0 0 12px 0;">🚨 SLA Crítico Vencido</h2>
      </div>

      <p style="color: #374151; line-height: 1.6;">
        A escalação crítica abaixo não foi reconhecida no prazo de
        <strong>{slaMinutos} minutos</strong>.
      </p>

      <div
        style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 12px; margin: 16px 0;"
      >
        <p style="margin: 0 0 8px 0; color: #7f1d1d; font-weight: bold;">Detalhes da Escalação:</p>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px;">
          Paciente: {pacienteNome}<br />
          Analito: {analitoNome}<br />
          Valor: {valorObtido} {unidade}<br />
          Tempo desde detecção: {tempoDecorrido}<br />
        </p>
      </div>

      <a
        href="https://hmatologia2.web.app/criticos?escalacaoId={escalacaoId}"
        style="display: inline-block; background: #dc2626; color: white; padding: 10px 16px; border-radius: 4px; text-decoration: none; margin-top: 12px;"
      >
        Acessar Escalação
      </a>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        HC Qualidade — Responsável Técnico (RT)<br />
        {labName}
      </p>
    </div>
  </body>
</html>
```

---

### 3.4 Email Template — NOTIVISA Notification

**Subject:** `[NOTIVISA] Rascunho — {analitoNome} Crítico`

**Body:**

```html
<html>
  <body style="font-family: 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px;">
    <div
      style="max-width: 600px; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 24px;"
    >
      <div style="border-left: 4px solid #f97316; padding-left: 16px;">
        <h2 style="color: #92400e; margin: 0 0 12px 0;">📋 NOTIVISA Rascunho Gerado</h2>
      </div>

      <p style="color: #374151; line-height: 1.6;">
        Um resultado crítico foi detectado que pode ser reportável à ANVISA sob RDC 978/2025. Um
        rascunho NOTIVISA foi gerado e aguarda sua revisão.
      </p>

      <div
        style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 4px; padding: 12px; margin: 16px 0;"
      >
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          <strong>⚠️ Atenção:</strong> Revisar imediatamente. Condições reportáveis têm prazos
          rigorosos.
        </p>
      </div>

      <a
        href="https://hmatologia2.web.app/notivisa/{notivisaDraftId}"
        style="display: inline-block; background: #f97316; color: white; padding: 10px 16px; border-radius: 4px; text-decoration: none; margin-top: 12px;"
      >
        Revisar Rascunho NOTIVISA
      </a>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />

      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        HC Qualidade — NOTIVISA Portal<br />
        {labName}
      </p>
    </div>
  </body>
</html>
```

---

## 4. Twilio Integration

### 4.1 Account Setup (Prerequisites)

**Responsibility:** CTO (before Phase 6 execution)

1. **Create Twilio account** (if not exists):
   - Signup: https://www.twilio.com
   - Project: HC Quality (Brazil region preferred)
2. **Purchase regional SMS number** (São Paulo):
   - Account → Phone Numbers → Buy a Number
   - Region: Brazil (São Paulo)
   - Capability: SMS
   - Example: `+5511988887777`

3. **Configure secrets** in Firebase:

   ```bash
   firebase functions:secrets:set TWILIO_ACCOUNT_SID
   firebase functions:secrets:set TWILIO_AUTH_TOKEN
   firebase functions:secrets:set TWILIO_PHONE_NUMBER
   ```

4. **Enable Delivery Notifications** (webhooks):
   - Twilio Console → Programmable SMS → Settings
   - Callback URL: `https://southamerica-east1-hmatologia2.cloudfunctions.net/escalacaoCriticos_webhook`
   - Events: `status_callback` for all messages

---

### 4.2 Twilio Client Integration

**In `functions/src/shared/sms/twilioClient.ts` (new file):**

```typescript
import twilio from 'twilio';
import { defineSecret } from 'firebase-functions/params';

const ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const AUTH_TOKEN = defineSecret('TWILIO_AUTH_TOKEN');
const PHONE_NUMBER = defineSecret('TWILIO_PHONE_NUMBER');

export function createTwilioClient() {
  return twilio(ACCOUNT_SID.value(), AUTH_TOKEN.value());
}

export async function sendSMS(
  toNumber: string, // Must be E.164: +55XXXXXXXXXX
  message: string,
): Promise<{
  sid: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  errorCode?: string;
}> {
  try {
    const client = createTwilioClient();
    const result = await client.messages.create({
      body: message,
      from: PHONE_NUMBER.value(),
      to: toNumber,
      statusCallback: `https://southamerica-east1-hmatologia2.cloudfunctions.net/escalacaoCriticos_webhook`,
    });

    return {
      sid: result.sid,
      status: result.status as any,
    };
  } catch (error: any) {
    return {
      sid: '',
      status: 'failed',
      errorCode: error.code || 'UNKNOWN_ERROR',
    };
  }
}

export async function checkMessageStatus(sid: string): Promise<{
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
}> {
  try {
    const client = createTwilioClient();
    const message = await client.messages(sid).fetch();

    return {
      status: message.status as any,
      errorCode: message.errorCode || undefined,
    };
  } catch (error: any) {
    return {
      status: 'failed',
      errorCode: error.code || 'UNKNOWN_ERROR',
    };
  }
}
```

---

### 4.3 Webhook Handler for Delivery Confirmations

**In `functions/src/index.ts` (new endpoint):**

```typescript
import { onRequest } from 'firebase-functions/v2/https';

export const escalacaoCriticos_webhook = onRequest(
  { region: 'southamerica-east1', cors: true },
  async (req, res) => {
    // Verify Twilio signature (standard Twilio webhook auth)
    const params = { ...req.query, ...req.body };
    const signature = req.get('X-Twilio-Signature') || '';

    if (!verifyTwilioSignature(signature, req.originalUrl, params)) {
      res.status(401).send('Unauthorized');
      return;
    }

    const messageSid = params.MessageSid;
    const messageStatus = params.MessageStatus;

    // Find escalacao by provider_messageId (Twilio SID)
    const escalacoes = await db
      .collectionGroup('criticos-escalacoes')
      .where('escalacoes', 'array-contains-any', [{ provider_messageId: messageSid }])
      .get();

    if (escalacoes.empty) {
      res.status(200).send('No matching escalacao');
      return;
    }

    // Update escalacao document
    const escalacao = escalacoes.docs[0];
    const escalacaoData = escalacao.data();

    // Find the escalacao entry with this SID
    const escalacaoEntryIndex = escalacaoData.escalacoes.findIndex(
      (e: any) => e.provider_messageId === messageSid,
    );

    if (escalacaoEntryIndex >= 0) {
      const updated = escalacaoData.escalacoes[escalacaoEntryIndex];
      updated.status = messageStatus; // 'delivered' | 'failed' | 'undelivered'
      updated.entregue_em = admin.firestore.Timestamp.now();

      await escalacao.ref.update({ escalacoes: escalacaoData.escalacoes });

      // Log event
      await escalacao.ref.parent.parent.collection('criticos-log-eventos').add({
        escalacaoId: escalacao.id,
        tipo: `sms_${messageStatus}`,
        timestamp: admin.firestore.Timestamp.now(),
        detalhes: { twilio_sid: messageSid, status: messageStatus },
      });
    }

    res.status(200).send('OK');
  },
);
```

---

## 5. Unit Tests (20+ specs)

### Test Structure

**File:** `functions/src/__tests__/criticos.test.ts`

**Test Categories:**

1. **Threshold Detection (4 tests)**
   - ✓ Detecta crítico quando valor > max
   - ✓ Detecta crítico quando valor < min
   - ✓ Aplica filtro condicional (idade/sexo)
   - ✓ Retorna isCritico=false quando dentro dos limites

2. **Escalacao Registration (5 tests)**
   - ✓ Cria documento em criticos-escalacoes
   - ✓ Envia SMS com telefone válido (E.164)
   - ✓ Falha graciosamente se telefone inválido
   - ✓ Gera escalacao com SLA target correto
   - ✓ Retorna provider_messageId (Twilio SID)

3. **Twilio Integration (3 tests)**
   - ✓ Chama Twilio API com parâmetros corretos
   - ✓ Trata erro de telefone inválido
   - ✓ Armazena SID para polling

4. **SLA Polling (4 tests)**
   - ✓ Escalacao cron actualiza status 'entregue' após confirmação
   - ✓ Escalacao cron marca 'vencido' após SLA timeout
   - ✓ Escalacao cron envia email fallback se SMS falha >10min
   - ✓ Cron retorna summary correto

5. **Acknowledgment (3 tests)**
   - ✓ acknowledgeEscalacao marca como 'reconhecido'
   - ✓ Calcula tempo_sla_ms corretamente
   - ✓ Falha se escalacao já foi reconhecida

6. **NOTIVISA Integration (2 tests)**
   - ✓ generateNOTIVISADraft cria doc se condição é reportável
   - ✓ Links escalacao a NOTIVISA draft

---

## 6. E2E Test Specs (5+ scenarios)

### E2E Test File

**File:** `smoke-test-openclaw/criticos.e2e.spec.ts`

**Scenarios:**

1. **Happy Path: Crítico Detectado → SMS Enviado → Reconhecido**
   - (a) Upload resultado crítico (bioquimica laudo)
   - (b) Verify SMS called via Twilio
   - (c) Verify escalacao doc created
   - (d) Simulate SMS delivery webhook
   - (e) Verify SLA tracking updated

2. **Fallback: SMS Falha → Email Enviado**
   - (a) Create escalacao with invalid phone
   - (b) Verify SMS fails in Twilio API
   - (c) Verify email fallback queued
   - (d) Verify escalacao.escalacoes has 2 entries (SMS failed + EMAIL queued)

3. **SLA Vencido: Cron Alerta RT**
   - (a) Create escalacao with SLA target = 5 min (override for test)
   - (b) Wait 10 min (or mock clock forward)
   - (c) Trigger escalacaoCriticos cron
   - (d) Verify SLA breach email sent to RT
   - (e) Verify escalacao.sla_status = 'vencido'

4. **NOTIVISA Auto-Generation: Condição Reportável**
   - (a) Configure labSettings.criticos.condicoesNotivisaveis
   - (b) Create crítico that matches reportable condition
   - (c) Verify registerCriticoDetection returns notivisaDraftId
   - (d) Verify NOTIVISA draft doc created
   - (e) Verify email notification sent to RT

5. **Cancelamento: False Alarm**
   - (a) Create escalacao
   - (b) Call cancelarEscalacao
   - (c) Verify status = 'cancelado'
   - (d) Verify event logged
   - (e) Verify Twilio message recall (if applicable)

---

## 7. Integration Checklist

### Pre-Execution

- [ ] Twilio account created + regional number provisioned
- [ ] Secrets set in Firebase:
  - [ ] `TWILIO_ACCOUNT_SID`
  - [ ] `TWILIO_AUTH_TOKEN`
  - [ ] `TWILIO_PHONE_NUMBER`
- [ ] `preflight-secrets-check.sh` passes all 3 secrets
- [ ] Firestore schema reviewed (3 new collections)
- [ ] Rules reviewed and deployed (separate step after schema ready)

### Execution Steps

1. **Schema Migration** (1h)
   - [ ] Add `criticos-thresholds` collection (with indexes)
   - [ ] Add `criticos-escalacoes` collection (with indexes)
   - [ ] Add `criticos-log-eventos` collection (with indexes)
   - [ ] Update `labSettings` doc schema (add `criticos` object)
   - [ ] Update `Laudo` type in liberacao (add `criticoMetadata`, `medicoTelefone`)

2. **Cloud Functions** (2h)
   - [ ] Implement 7 callables + 1 cron in `functions/src/`
   - [ ] Add Twilio client in `functions/src/shared/sms/twilioClient.ts`
   - [ ] Add webhook handler for Twilio delivery confirmations
   - [ ] `npm run build` in `functions/`
   - [ ] Unit tests pass (20+ tests)

3. **Firestore Rules** (30min)
   - [ ] Add rules for 3 new collections
   - [ ] Validate with `firebase emulators:exec`
   - [ ] Deploy rules separately (gate: ADR-0012 pattern)

4. **Frontend Integration** (1.5h)
   - [ ] Add detection call to `bioquimica` laudo creation flow
   - [ ] Add `CriticosEscalacaoWidget` to liberacao view (read-only)
   - [ ] Add RT dashboard view at `/criticos` (list + acknowledge buttons)
   - [ ] Dark-first design per `DESIGN_SYSTEM.md`

5. **Smoke Testing** (30min)
   - [ ] E2E: Crítico detected → escalacao created
   - [ ] E2E: SMS queued + delivery tracked
   - [ ] E2E: SLA cron runs, updates status
   - [ ] Manual: RT acknowledges via portal
   - [ ] Manual: SLA breach email sent
   - [ ] Manual: NOTIVISA draft generated

6. **Documentation** (30min)
   - [ ] Update PHASE_6_DETAILED_PLAN.md with execution notes
   - [ ] Add runbook: "RT Operational Guide — Critical Values"
   - [ ] Update CLAUDE.md with Phase 6 completion
   - [ ] Add ADR-0019 (Critical Values Escalation Pattern)

---

## 8. Data Migration / Seeding

### Initial Threshold Seeding

**File:** `functions/src/seeds/criticos-thresholds.seed.ts`

For each lab, seed typical thresholds for common analytes (glicose, creatinina, potássio, etc.):

```typescript
const DEFAULT_THRESHOLDS = [
  {
    analitoId: 'analito-glicose',
    analitoNome: 'Glicose',
    unidade: 'mg/dL',
    min: 40,
    max: 400,
    severidade: 'alta',
  },
  {
    analitoId: 'analito-potassio',
    analitoNome: 'Potássio',
    unidade: 'mEq/L',
    min: 2.5,
    max: 6.5,
    severidade: 'alta',
  },
  // ... more analytes
];

export async function seedCriticosThresholds(labId: string) {
  const batch = admin.firestore().batch();

  for (const threshold of DEFAULT_THRESHOLDS) {
    const ref = admin
      .firestore()
      .collection('labs')
      .doc(labId)
      .collection('criticos-thresholds')
      .doc();

    batch.set(ref, {
      ...threshold,
      ativo: true,
      criadoEm: admin.firestore.Timestamp.now(),
      criadoPor: 'system',
    });
  }

  await batch.commit();
}
```

---

## 9. Operational Runbook

### RT Quick Reference

**Access:** `/criticos` (RT + Auditor only)

**Dashboard Shows:**

- Pending escalacoes (last 24h)
- SLA status (em prazo / vencido)
- Physician acknowledgment status
- Retry history

**Actions:**

1. **Acknowledge Crítico**
   - Button: "Confirmar Leitura" (marks status='reconhecido')
   - Records timestamp + RT identifier

2. **Retry Escalation**
   - Button: "Reenviar via [SMS/EMAIL]"
   - Notes field for context (e.g., "Número trocado")

3. **Cancel Escalation**
   - Button: "Cancelar" (for false alarms)
   - Reason required

4. **Configure Thresholds**
   - Tab: "Limiares Críticos"
   - CRUD interface for CriticosThreshold docs
   - Validation: min < max, severidade must be set

5. **Review NOTIVISA Drafts**
   - Tab: "NOTIVISA" (if reportable condition detected)
   - Pre-populated form for RT to review + submit

---

## 10. Dependencies & Prerequisites

### External Dependencies

| Dependency             | Version | Status             | Notes                |
| ---------------------- | ------- | ------------------ | -------------------- |
| **Twilio SDK**         | ^4.x    | ✓ npm available    | `npm install twilio` |
| **Firebase Admin SDK** | 12.x    | ✓ already in stack | No version change    |
| **Zod**                | 3.x     | ✓ already in stack | Reuse for validation |
| **date-fns**           | 3.x     | ✓ already in stack | Timestamp formatting |

### Twilio Contract Prerequisites

- [ ] Twilio account active + number provisioned
- [ ] Secrets set in Firebase Functions
- [ ] Webhook callback URL configured in Twilio console
- [ ] Test SMS sent successfully to real phone number

### Firestore Prerequisites

- [ ] New collections created (3) + indexes deployed
- [ ] Rules updated (separate deploy step)
- [ ] labSettings document updated with criticos config

---

## 11. Success Criteria & Acceptance Tests

### Functional Acceptance

- ✓ Critical value detected automatically → escalacao created within 100ms
- ✓ SMS sent to physician within 500ms (Twilio API latency)
- ✓ SMS delivery confirmed via webhook within 2min
- ✓ Email fallback sent if SMS fails after 10min
- ✓ SLA cron runs every 5min, updates status correctly
- ✓ RT can acknowledge escalacao via portal (status='reconhecido')
- ✓ NOTIVISA draft generated for reportable conditions
- ✓ Audit trail complete (all events logged in criticos-log-eventos)

### Non-Functional Acceptance

- ✓ SMS delivery success rate ≥ 99% (Twilio SLA)
- ✓ SMS delivered within 2min of escalacao creation
- ✓ Zero data loss: all escalacao docs append-only (immutable)
- ✓ RDC 978 compliance: audit trail with LogicalSignature chain
- ✓ WCAG AA accessibility: RT portal fully navigable by keyboard
- ✓ Performance: listCriticosEscalacoes query <500ms for 1000 docs

### Load Testing

- ✓ Cron scales to 1000+ escalacoes per lab
- ✓ SMS batch send (5+ simultaneous) succeeds without rate-limit
- ✓ Firestore writes batched (max 500 ops per batch)

---

## 12. Risk Mitigation

### Risk 1: SMS Delivery Failure

**Scenario:** Twilio API returns error, SMS never sent.

**Mitigation:**

- Retry logic in sendSMS() (3 attempts, exponential backoff)
- Fallback to email immediately if SMS fails
- Log all failures in criticos-log-eventos for auditor review
- Alert RT via dashboard if escalacao stuck in 'enviado' >10min

### Risk 2: Physician Phone Number Invalid

**Scenario:** Laudo lacks valid phone number, SMS fails.

**Mitigation:**

- Validate phone format (E.164) before sending
- Fallback to email (which requires email from laudo)
- If both fail: escalate to RT dashboard alert
- Require phone input during laudo RT signature

### Risk 3: SLA Cron Doesn't Run / Hangs

**Scenario:** Firestore batch write or Twilio API hangs, cron timeout.

**Mitigation:**

- Cron timeout: 5min (increase to 10min if needed)
- Error logging with stack trace → CloudLogs for investigation
- Manual RT action: "Reenviar via Email" button as override
- Monitoring: Set up Cloud Logs alert for cron failures

### Risk 4: False Positives (Threshold Too Low)

**Scenario:** Too many false alarms, physician ignores SMS.

**Mitigation:**

- Default thresholds based on clinical references
- RT can adjust thresholds per lab via dashboard
- Log all threshold changes (audit trail)
- Recommend alert fatigue study after 1 week deployment

### Risk 5: Duplicate Escalations

**Scenario:** Multiple laudo updates trigger multiple SMS for same patient.

**Mitigation:**

- Escalacao uniqueness: one per (laudoId, exameId, analitoId, valor)
- Dedup check before calling registerCriticoDetection
- If exists: return existing escalacaoId instead of creating new doc

---

## 13. Future Enhancements (v1.5+)

### Phase 7: Physician Portal

- Physician receives SMS → clicks link → web portal to acknowledge
- Webhook from SMS link confirms acknowledgment (no SMS reply parsing)
- SMS reply parsing as future optimization (complex Twilio setup)

### Phase 8: NOTIVISA API Integration

- Auto-submit NOTIVISA reports to ANVISA (RDC 978 Art. 58)
- API credentials stored in Firebase secrets
- Submission audit trail in criticos-log-eventos

### Phase 9: Analytics Dashboard

- KPI: % of críticos acknowledged within SLA
- KPI: SMS delivery success rate
- Trending: most common critico analytes

### Phase 10: Machine Learning

- Threshold recommendations based on historical criticality patterns
- Anomaly detection (e.g., "more críticos than usual today")

---

## 14. Documentation References

### Internal References

- `src/features/criticos/types/index.ts` — Type definitions
- `src/features/criticos/utils/criticoDetector.ts` — Detection logic
- `src/features/bioquimica/types/run.ts` — Exam result structure
- `src/features/liberacao/types/laudo.ts` — Laudo schema
- `.claude/rules/firestore-security.md` — Rules patterns
- `.claude/rules/deploy-protocol.md` — Deploy order

### External References

- RDC 978/2025 Art. 128 — Ações corretivas (ANVISA)
- DICQ 4.3 — Documentação de Qualidade
- Twilio SMS API: https://www.twilio.com/docs/sms/api
- Firebase Cloud Functions: https://firebase.google.com/docs/functions

---

## 15. Approval Checklist

| Checkpoint                | Responsible | Status          |
| ------------------------- | ----------- | --------------- |
| Twilio contract confirmed | CTO         | Awaiting ACK    |
| Schema design approved    | CTO         | Awaiting review |
| Callable specs reviewed   | CTO         | Awaiting review |
| Rules pattern validated   | Security    | Awaiting review |
| E2E test plan signed off  | QA          | Awaiting review |
| Runbook completed         | Tech Writer | ✓ Draft         |

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Status:** READY FOR EXECUTION (pending CTO approval on Twilio + schema)

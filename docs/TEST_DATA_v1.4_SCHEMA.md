# Test Data — Firestore Schema v1.4

**Purpose:** Sample documents for all 5 new collections (staging environment).  
**Lab ID:** `TEST-LAB-001`  
**User IDs:** `test-user-001`, `test-user-002`, `test-user-003`  
**Generated:** 2026-05-07  
**Status:** Ready for import

---

## Setup Instructions

These documents can be loaded into Firestore staging via:

1. **Firebase Console (manual):** Copy document content to Firestore Console
2. **Firebase Admin SDK script:** See `scripts/load-test-data-v1.4.js` (to be created)
3. **Firebase Emulator:** Load before running integration tests

---

## 1. portal-configuracao Collection

### Document: `portal-configuracao/branding-v1`

```json
{
  "logoCdnUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/logo.svg",
  "primaryColor": "#7c3aed",
  "secondaryColor": "#ec4899",
  "labelLaudo": "Resultado de Exame",
  "labelPaciente": "Paciente",
  "termsHTML": "<p><strong>Termos de Serviço</strong></p><p>Ao acessar este portal, você concorda com os nossos termos de serviço.</p><ul><li>Sigilo de dados</li><li>Uso apenas para fins diagnósticos</li><li>Não-transferência de informações</li></ul>",
  "privacyHTML": "<p><strong>Política de Privacidade</strong></p><p>Seus dados pessoais são protegidos conforme LGPD e regulações sanitárias.</p><p>Contato DPO: privacy@labclin.com.br</p>",
  "updatedAt": {
    "_type": "server_timestamp"
  },
  "updatedBy": "test-user-001"
}
```

### Document: `portal-configuracao/branding-v2`

```json
{
  "logoCdnUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/logo-alt.png",
  "primaryColor": "#1e40af",
  "secondaryColor": "#059669",
  "labelLaudo": "Exame Laboratorial",
  "labelPaciente": "Indivíduo",
  "termsHTML": "<p>Versão alternativa de termos.</p>",
  "privacyHTML": "<p>Versão alternativa de privacidade.</p>",
  "updatedAt": {
    "_type": "server_timestamp"
  },
  "updatedBy": "test-user-002"
}
```

---

## 2. notivisa-outbox/events Collection

### Document: `notivisa-outbox/events/evt-001-pending`

```json
{
  "laudo_id": "LAU-2026-05-00001",
  "patient_cpf": "123.456.789-**",
  "payload": {
    "tipo_evento": "resultado_disponivel",
    "data_evento": "2026-05-07T10:00:00Z",
    "codigo_exame": "13001",
    "titulo_exame": "Teste de Gravidez",
    "resultado": "positivo",
    "referencia": "negativo",
    "laboratorio_codigo": "LAB-001"
  },
  "status": "PENDING",
  "attempts": 0,
  "nextRetry": {
    "_type": "server_timestamp"
  },
  "createdAt": {
    "_type": "server_timestamp"
  },
  "sentAt": null,
  "error": null
}
```

### Document: `notivisa-outbox/events/evt-002-sent`

```json
{
  "laudo_id": "LAU-2026-05-00002",
  "patient_cpf": "987.654.321-**",
  "payload": {
    "tipo_evento": "resultado_disponivel",
    "data_evento": "2026-05-06T14:30:00Z",
    "codigo_exame": "30100",
    "titulo_exame": "Hemograma Completo",
    "resultado": "normal",
    "laboratorio_codigo": "LAB-001"
  },
  "status": "SENT",
  "attempts": 1,
  "nextRetry": null,
  "createdAt": "2026-05-06T14:30:00Z",
  "sentAt": "2026-05-06T14:35:15Z",
  "error": null
}
```

### Document: `notivisa-outbox/events/evt-003-failed-retry`

```json
{
  "laudo_id": "LAU-2026-05-00003",
  "patient_cpf": "555.666.777-**",
  "payload": {
    "tipo_evento": "resultado_disponivel",
    "data_evento": "2026-05-05T09:00:00Z",
    "codigo_exame": "13049",
    "titulo_exame": "Sorologia para COVID-19",
    "resultado": "indeterminado",
    "laboratorio_codigo": "LAB-001"
  },
  "status": "FAILED",
  "attempts": 5,
  "nextRetry": null,
  "createdAt": "2026-05-05T09:00:00Z",
  "sentAt": null,
  "error": "Connection timeout after 5 retries. Endpoint unavailable. Retry later."
}
```

### Document: `notivisa-outbox/events/evt-004-delivered`

```json
{
  "laudo_id": "LAU-2026-05-00004",
  "patient_cpf": "222.333.444-**",
  "payload": {
    "tipo_evento": "resultado_disponivel",
    "data_evento": "2026-05-04T16:45:00Z",
    "codigo_exame": "40100",
    "titulo_exame": "Glicemia de Jejum",
    "resultado": "105 mg/dL",
    "referencia": "70-100 mg/dL",
    "laboratorio_codigo": "LAB-001"
  },
  "status": "DELIVERED",
  "attempts": 2,
  "nextRetry": null,
  "createdAt": "2026-05-04T16:45:00Z",
  "sentAt": "2026-05-04T16:50:30Z",
  "error": null
}
```

---

## 3. criticos-escalacoes/escalacoes Collection

### Document: `criticos-escalacoes/escalacoes/esc-001-open`

```json
{
  "resultado_id": "RES-2026-05-00042",
  "threshold_config_id": "CFG-POTASSIUM-CRITICAL",
  "analito": "potassium",
  "valor": 7.5,
  "limite_inferior": 3.5,
  "limite_superior": 5.5,
  "sms_sent_to": ["+5511999999999", "+5511988888888"],
  "email_sent_to": ["dr.silva@labclin.com.br", "emergencia@labclin.com.br"],
  "sla_minutes": 30,
  "resolved_at": null,
  "resolution_notes": null,
  "createdAt": {
    "_type": "server_timestamp"
  }
}
```

### Document: `criticos-escalacoes/escalacoes/esc-002-resolved`

```json
{
  "resultado_id": "RES-2026-05-00041",
  "threshold_config_id": "CFG-GLUCOSE-CRITICAL-LOW",
  "analito": "glucose",
  "valor": 45.0,
  "limite_inferior": 60.0,
  "limite_superior": null,
  "sms_sent_to": ["+5511987654321"],
  "email_sent_to": ["oncall@labclin.com.br"],
  "sla_minutes": 15,
  "resolved_at": "2026-05-07T14:45:00Z",
  "resolution_notes": "Paciente contactado via SMS. Novo exame solicitado. Valores normalizaram em recoleta.",
  "createdAt": "2026-05-07T14:30:00Z"
}
```

### Document: `criticos-escalacoes/escalacoes/esc-003-sla-breach`

```json
{
  "resultado_id": "RES-2026-05-00040",
  "threshold_config_id": "CFG-HEMOGLOBIN-CRITICAL-LOW",
  "analito": "hemoglobin",
  "valor": 6.5,
  "limite_inferior": 8.0,
  "limite_superior": null,
  "sms_sent_to": ["+5511912345678"],
  "email_sent_to": ["transfusao@labclin.com.br"],
  "sla_minutes": 10,
  "resolved_at": "2026-05-07T15:15:00Z",
  "resolution_notes": "SLA breached (45 min vs 10 min target). Transfusion ordered. Registered in NC system.",
  "createdAt": "2026-05-07T14:30:00Z"
}
```

---

## 4. imuno-ias-dev/images Collection

### Document: `imuno-ias-dev/images/img-001-base-model`

```json
{
  "imageUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/strips/IMG-2026-05-001.jpg",
  "imageDim": {
    "width": 1200,
    "height": 800
  },
  "classesDetected": ["IgG", "IgM"],
  "confidence": 0.92,
  "model_version": "1.0-base",
  "feedback": null,
  "createdAt": {
    "_type": "server_timestamp"
  },
  "batch_id": null
}
```

### Document: `imuno-ias-dev/images/img-002-tuned-with-feedback`

```json
{
  "imageUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/strips/IMG-2026-05-002.jpg",
  "imageDim": {
    "width": 1280,
    "height": 720
  },
  "classesDetected": ["IgG", "IgM", "IgA"],
  "confidence": 0.96,
  "model_version": "1.1-tuned",
  "feedback": {
    "classes": ["IgG", "IgM"],
    "correctedBy": "test-user-001",
    "correctedAt": "2026-05-07T15:30:00Z"
  },
  "createdAt": "2026-05-07T14:15:00Z",
  "batch_id": "BATCH-2026-MAY-RETRAIN"
}
```

### Document: `imuno-ias-dev/images/img-003-batch-training`

```json
{
  "imageUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/strips/IMG-2026-05-003.jpg",
  "imageDim": {
    "width": 1024,
    "height": 768
  },
  "classesDetected": ["IgA"],
  "confidence": 0.87,
  "model_version": "1.1-tuned",
  "feedback": null,
  "createdAt": "2026-05-07T13:45:00Z",
  "batch_id": "BATCH-2026-MAY-RETRAIN"
}
```

### Document: `imuno-ias-dev/images/img-004-low-confidence`

```json
{
  "imageUrl": "https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/strips/IMG-2026-05-004.jpg",
  "imageDim": {
    "width": 900,
    "height": 600
  },
  "classesDetected": ["Anti-TPO"],
  "confidence": 0.62,
  "model_version": "1.0-base",
  "feedback": {
    "classes": ["Anti-TPO", "Anti-TG"],
    "correctedBy": "test-user-002",
    "correctedAt": "2026-05-07T16:00:00Z"
  },
  "createdAt": "2026-05-07T12:30:00Z",
  "batch_id": "BATCH-2026-MAY-RETRAIN"
}
```

---

## 5. laudos-draft/rascunhos Collection

### Document: `laudos-draft/rascunhos/drft-001-editing`

```json
{
  "laudo_id": "LAU-2026-05-00001",
  "edited_by": "test-user-001",
  "content_json": {
    "paciente_nome": "João da Silva",
    "paciente_cpf": "123.456.789-00",
    "data_coleta": "2026-05-07T08:30:00Z",
    "exames": [
      {
        "codigo": "13001",
        "descricao": "Teste de Gravidez",
        "resultado": "Positivo",
        "referencia": "Negativo",
        "unidade": ""
      }
    ],
    "comentarios": "Resultado compatível com gravidez inicial. Sugerir confirmação com ultrassom.",
    "assinante_nome": "Dr. Paulo Silva",
    "assinante_crm": "123456"
  },
  "locked_until_ts": {
    "_type": "server_timestamp"
  },
  "version": 2,
  "status": "EDITING",
  "updatedAt": {
    "_type": "server_timestamp"
  },
  "publishedAt": null,
  "draft_notes": "Aguardando confirmação de LIS; reteste solicitado pelo solicitante"
}
```

### Document: `laudos-draft/rascunhos/drft-002-locked`

```json
{
  "laudo_id": "LAU-2026-05-00002",
  "edited_by": "test-user-002",
  "content_json": {
    "paciente_nome": "Maria Santos",
    "paciente_cpf": "987.654.321-00",
    "data_coleta": "2026-05-06T09:15:00Z",
    "exames": [
      {
        "codigo": "30100",
        "descricao": "Hemograma Completo",
        "resultado": "Normal",
        "referencia": "Dentro dos limites",
        "unidade": "",
        "valores": {
          "hemacias": 4.8,
          "hemoglobina": 14.2,
          "hematocrito": 42.5,
          "leucocitos": 7.2,
          "plaquetas": 250
        }
      }
    ],
    "comentarios": "Sem alterações detectadas.",
    "assinante_nome": "Dra. Ana Costa",
    "assinante_crm": "654321"
  },
  "locked_until_ts": "2026-05-07T16:30:00Z",
  "version": 1,
  "status": "LOCKED",
  "updatedAt": "2026-05-07T14:00:00Z",
  "publishedAt": null,
  "draft_notes": "Sala 3 — bloqueado para revisão por supervisor. Não modificar."
}
```

### Document: `laudos-draft/rascunhos/drft-003-published`

```json
{
  "laudo_id": "LAU-2026-05-00003",
  "edited_by": "test-user-003",
  "content_json": {
    "paciente_nome": "Carlos Oliveira",
    "paciente_cpf": "555.666.777-00",
    "data_coleta": "2026-05-05T10:45:00Z",
    "exames": [
      {
        "codigo": "13049",
        "descricao": "Sorologia para COVID-19 (IgG+IgM)",
        "resultado": "Indeterminado",
        "referencia": "Negativo",
        "unidade": "",
        "observacoes": "Repetir após 7 dias"
      }
    ],
    "comentarios": "Resultado indeterminado. Recomenda-se repetição de teste em 1 semana.",
    "assinante_nome": "Dr. Roberto Lima",
    "assinante_crm": "789012"
  },
  "locked_until_ts": "2026-05-06T12:00:00Z",
  "version": 4,
  "status": "PUBLISHED",
  "updatedAt": "2026-05-06T11:30:00Z",
  "publishedAt": "2026-05-06T11:35:00Z",
  "draft_notes": "Finalizado e publicado com sucesso. Notificação enviada ao paciente."
}
```

### Document: `laudos-draft/rascunhos/drft-004-expired-lock`

```json
{
  "laudo_id": "LAU-2026-05-00004",
  "edited_by": "test-user-001",
  "content_json": {
    "paciente_nome": "Patricia Mendes",
    "paciente_cpf": "222.333.444-00",
    "data_coleta": "2026-05-04T14:20:00Z",
    "exames": [
      {
        "codigo": "40100",
        "descricao": "Glicemia de Jejum",
        "resultado": "105 mg/dL",
        "referencia": "70-100 mg/dL",
        "unidade": "mg/dL",
        "observacoes": "Ligeiramente elevado"
      }
    ],
    "comentarios": "Glicose ligeiramente elevada. Recomenda-se jejum para confirmação.",
    "assinante_nome": "Dra. Fernanda Gomes",
    "assinante_crm": "345678"
  },
  "locked_until_ts": "2026-05-05T10:00:00Z",
  "version": 1,
  "status": "EDITING",
  "updatedAt": "2026-05-05T09:00:00Z",
  "publishedAt": null,
  "draft_notes": "Lock expirado (>24h). Disponível para nova edição."
}
```

---

## Import Script Template

**File:** `scripts/load-test-data-v1.4.js`

```javascript
// Load test data for Schema v1.4 collections
// Run: node scripts/load-test-data-v1.4.js

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'hmatologia2',
});

const db = admin.firestore();
const LAB_ID = 'TEST-LAB-001';

const testData = {
  // 1. portal-configuracao
  'portal-configuracao/branding-v1': {
    logoCdnUrl: 'https://storage.googleapis.com/hmatologia2/labs/TEST-LAB-001/logo.svg',
    primaryColor: '#7c3aed',
    secondaryColor: '#ec4899',
    labelLaudo: 'Resultado de Exame',
    labelPaciente: 'Paciente',
    termsHTML: '<p><strong>Termos de Serviço</strong></p>...',
    privacyHTML: '<p><strong>Política de Privacidade</strong></p>...',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'test-user-001',
  },
  // ... more documents
};

async function loadTestData() {
  try {
    for (const [docPath, data] of Object.entries(testData)) {
      const [collection, docId] = docPath.split('/');
      const docRef = db.doc(`labs/${LAB_ID}/${collection}/${docId}`);
      await docRef.set(data);
      console.log(`✓ Created ${docPath}`);
    }
    console.log('✓ Test data loaded successfully');
  } catch (error) {
    console.error('✗ Error loading test data:', error);
  } finally {
    process.exit(0);
  }
}

loadTestData();
```

---

## Validation Queries

After loading test data, verify with these queries:

### Portal Configuracao
```
collection: labs/TEST-LAB-001/portal-configuracao
Expected: 2 documents (branding-v1, branding-v2)
```

### NOTIVISA Events
```
collection: labs/TEST-LAB-001/notivisa-outbox/events
where: status in [PENDING, SENT, FAILED, DELIVERED]
Expected: 4 documents
```

### Críticos Escalacoes
```
collection: labs/TEST-LAB-001/criticos-escalacoes/escalacoes
orderBy: createdAt DESC
Expected: 3 documents
```

### Imuno IAS Dev
```
collection: labs/TEST-LAB-001/imuno-ias-dev/images
where: batch_id == "BATCH-2026-MAY-RETRAIN"
Expected: 2 documents
```

### Laudos Draft
```
collection: labs/TEST-LAB-001/laudos-draft/rascunhos
where: status == "EDITING"
Expected: 2 documents (drft-001, drft-004)
```

---

**Document Status:** Ready for import  
**Last Updated:** 2026-05-07  
**Environment:** Staging

# HC Quality v1.4 — Phase 5 Detailed Execution Plan
## Patient Portal Phase 1 (Laudo Download + Portal Access)

**Duration:** 2 weeks (14 working days)  
**Wave 1 (Days 1–7):** Foundation + Schema + Backend callables  
**Wave 2 (Days 8–14):** Portal UI + PDF generation + Responsive + Testing  

**Decision Reference:** ADR-0015 (Patient Portal Email-Link Auth v1.4)  
**Regulatory Baseline:** RDC 978 Art. 167 + LGPD Art. 18  
**Compliance Focus:** DICQ 5.8.x (Patient Results), 5.9.x (Result Retention)

---

## 1. Portal URL Structure

### Decision: Path-based (no subdomain)

**Rationale:**
- Single SSL cert, simpler hosting config
- Firebase Hosting rewrites already configured (all routes → `index.html`)
- Easier auth context isolation (single Zustand store; route guards via token)

**URL Pattern:**
```
https://hmatologia2.web.app/paciente            # Patient portal root
https://hmatologia2.web.app/paciente/auth       # Email link landing (token in query)
https://hmatologia2.web.app/paciente/laudos     # Patient results list
https://hmatologia2.web.app/paciente/laudo/{id} # Single laudo view + download
https://hmatologia2.web.app/paciente/feedback   # NPS form (optional; can be modal)
```

**UnauthN redirect:**
```
// In AppRouter (src/App.tsx or routing wrapper):
if (route.startsWith('/paciente') && !patientAuthToken) {
  redirect('/paciente/auth?email=&error=invalid-token')
}
```

**Public accessibility:** Portal is **fully public** (no Firebase Auth login required; email-link token is auth).

---

## 2. Patient Authentication UX (Email-Link Flow)

### 2.1 Patient Data Pre-Population

**Responsibility:** Lab RT or admin (manual entry or CSV import).

**Collection Schema:**
```
/labs/{labId}/patients/{patientId}
├── name: string                    # "João da Silva"
├── dateOfBirth: Timestamp          # Paciente age calculation
├── cpf: string (hashed)            # Encrypted field (RFC 5116)
├── email: string (encrypted)       # PII; encrypted at-rest
├── status: 'active' | 'inactive'   # Soft delete via status flag
├── identifiers: {
│   labPatientId?: string           # Lab's internal patient ID
│   mrn?: string                    # Medical Record Number (v1.4.1+)
│   lisId?: string                  # (v1.4.1) LIS system ID after sync
│ }
├── createdAt: Timestamp
├── deletedAt: Timestamp | null     # RN-06: soft-delete only
└── metadata: {
    lastAuthLinkSentAt?: Timestamp  # Rate-limit check
    authLinkCount?: number          # Audit (how many links generated)
  }
```

**CSV Import Script** (`scripts/import-patients.ts`):
```typescript
// Input: CSV with columns: nome, data_nascimento, cpf, email
// Output: Imported to /labs/{labId}/patients collection

// Validation:
// - CPF format (11 digits, valid checksum)
// - Email format (valid RFC 5322)
// - No duplicates (same CPF in same lab)
// - Hash CPF before storing (SHA-256)

// Logging: One row per import (success/failure) to audit log
```

**Initial Load (Riopomba):** 2,000+ patients from legacy CSV by Phase 5 end.

### 2.2 Email-Link Generation Flow

**Trigger:** Patient enters CPF or lab-provided patient ID on `/paciente/auth` page.

**UI Component: `PatientAuthForm` (`src/features/patient-portal/components/PatientAuthForm.tsx`)**

```tsx
// 1. Patient enters: CPF (or Patient ID if available)
// 2. UI validates format (no blanks, valid CPF checksum)
// 3. On submit → call `generatePatientAuthLink` callable

export const generatePatientAuthLink = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { labId, cpf, email } = data;
    
    // 1. Lookup patient by CPF (hashed) in /labs/{labId}/patients
    const patient = await db
      .collection(`/labs/${labId}/patients`)
      .where('cpfHash', '==', hashCPF(cpf))
      .limit(1)
      .get()
      .then(snap => snap.docs[0]?.data());
    
    if (!patient) {
      throw new Error('PATIENT_NOT_FOUND');
    }
    
    // 2. Rate-limit check (max 3 links per day per patient)
    const dayAgo = Timestamp.now().toDate();
    dayAgo.setDate(dayAgo.getDate() - 1);
    
    const recentLinks = await db
      .collection(`/labs/${labId}/patient-auth-events`)
      .where('patientId', '==', patient.id)
      .where('createdAt', '>=', Timestamp.fromDate(dayAgo))
      .get();
    
    if (recentLinks.size >= 3) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    
    // 3. Generate JWT token (72h expiry)
    const token = jwt.sign(
      { patientId: patient.id, labId, iat: Date.now() },
      process.env.PATIENT_PORTAL_SECRET,
      { expiresIn: '72h' }
    );
    
    // 4. Send email (Resend or SendGrid)
    await sendPatientAuthEmail({
      to: patient.email,
      token,
      labName: lab.name,
      portalUrl: `https://hmatologia2.web.app/paciente/auth?token=${token}`,
      expiresIn: '72 horas',
    });
    
    // 5. Log event (immutable audit trail)
    await db
      .collection(`/labs/${labId}/patient-auth-events`)
      .add({
        patientId: patient.id,
        action: 'LINK_GENERATED',
        createdAt: Timestamp.now(),
        ipAddress: extractClientIP(context),
        operatorId: null, // Null = auto-generated (not RT-signed)
      });
    
    return { success: true, message: 'Link sent to email' };
  });
```

**Email Template** (`functions/src/shared/templates/patientAuthEmail.ts`):
```
Subject: Acesso ao seu resultado — HC Quality Laboratorial

Olá {patient.name},

Clique no link abaixo para acessar seu resultado de laboratório:

[BOTÃO: Acessar Resultado] (links to /paciente/auth?token=...)

Este link expira em 72 horas.

---
Laboratório: {lab.name}
Data: {date}
Perguntas? Contato: {lab.email}
```

### 2.3 Token Validation on `/paciente/auth`

**Component: `PatientAuthPage` (`src/features/patient-portal/pages/PatientAuthPage.tsx`)**

```tsx
// On page load:
// 1. Extract token from URL query param
// 2. Call verifyPatientAuthToken() to validate + extract patient ID
// 3. If valid → store token in Zustand (usePatientAuthStore)
// 4. Redirect to /paciente/laudos

const verifyPatientAuthToken = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { token } = data;
    
    try {
      const decoded = jwt.verify(
        token,
        process.env.PATIENT_PORTAL_SECRET
      ) as { patientId: string; labId: string };
      
      // Verify patient still active
      const patient = await db
        .collection(`/labs/${decoded.labId}/patients`)
        .doc(decoded.patientId)
        .get();
      
      if (!patient.exists || patient.data().status === 'inactive') {
        throw new Error('PATIENT_INACTIVE');
      }
      
      // Return scoped token for client-side use
      return {
        valid: true,
        patientId: decoded.patientId,
        labId: decoded.labId,
        expiresAt: new Date(decoded.exp * 1000),
      };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  });
```

**Token Storage (Zustand):**
```typescript
export const usePatientAuthStore = create<PatientAuthState>((set) => ({
  token: null,
  patientId: null,
  labId: null,
  expiresAt: null,
  
  setAuth: (token, patientId, labId, expiresAt) => {
    // Store in localStorage (unencrypted — token is single-use)
    localStorage.setItem('patient_auth_token', token);
    set({ token, patientId, labId, expiresAt });
  },
  
  clearAuth: () => {
    localStorage.removeItem('patient_auth_token');
    set({ token: null, patientId: null, labId: null, expiresAt: null });
  },
  
  isTokenExpired: () => {
    return new Date() > (get().expiresAt || new Date(0));
  },
}));
```

---

## 3. Laudo PDF Generation (Extend Export Module's Puppeteer CF)

### 3.1 Architecture: Separate CF for Patient Portal

**Callable:** `generatePatientLaudoPDF` (NOT reusing export module's PDF generator).

**Rationale:**
- Export module's PDF is operator-facing (internal use, detailed metadata).
- Patient portal PDF is patient-facing (minimal technical details, prominent QR).
- Different scope guards (RN-17: patient can only download own laudo).

**Schema Extension: `laudo-versions/{versionId}`**

```firestore
laudo-versions/{versionId}
├── laudoId: string
├── version: number                 # v1, v2, v3 (retificações)
├── snapshot: object                # Full laudo snapshot (RDC 978)
├── signature: {
│   hash: string                    # SHA-256 (64 chars)
│   operatorId: string              # RT who signed
│   ts: Timestamp                   # When signed
│ }
├── chainHash: string               # Link to prev version (sequential)
├── pdfUrl: string                  # GCS URL (generated on-demand or pre-gen)
├── qrData: {
│   laudoId: string
│   versionId: string
│   signatureHash: string           # Last 32 chars of signature.hash
│   generatedAt: Timestamp
│ }
├── createdAt: Timestamp
└── -- NEW in Phase 5:
    patientDownloadTrail: [{         # Immutable log per download
      downloadedBy: 'PATIENT',
      timestamp: Timestamp,
      ipAddress: string,
    }]
```

### 3.2 Patient Portal PDF Generation CF

**Callable: `generatePatientLaudoPDF`**

```typescript
export const generatePatientLaudoPDF = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { patientId, labId, laudoId } = data;
    
    // 1. Auth guard: only patient themselves can generate
    const token = context.auth?.token; // Verify token scoped to patientId
    const decoded = jwt.verify(
      token,
      process.env.PATIENT_PORTAL_SECRET
    ) as { patientId: string };
    
    if (decoded.patientId !== patientId) {
      throw new HttpsError('permission-denied', 'Invalid token scope');
    }
    
    // 2. Fetch laudo + latest version
    const laudo = await db
      .collection(`/labs/${labId}/laudos`)
      .doc(laudoId)
      .get();
    
    const version = await db
      .collection(`/labs/${labId}/laudo-versions`)
      .where('laudoId', '==', laudoId)
      .orderBy('version', 'desc')
      .limit(1)
      .get()
      .then(snap => snap.docs[0]?.data());
    
    // 3. Verify patient ID matches laudo
    if (laudo.data().paciente.id !== patientId) {
      throw new HttpsError('permission-denied', 'Patient mismatch');
    }
    
    // 4. Generate QR code (laudo ID + version + signature hash)
    const qrDataString = JSON.stringify({
      laudoId,
      versionId: version.id,
      signatureHash: version.signature.hash.substring(32),
      generatedAt: new Date().toISOString(),
    });
    
    const qrImage = await generateQRCode(qrDataString, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    
    // 5. Render HTML → PDF via Puppeteer
    const htmlContent = renderPatientLaudoHTML({
      laudo: laudo.data(),
      version: version.data(),
      qrImage,
      labLogo: lab.logoUrl, // From portal-configuracao
      labBranding: lab.portalBranding, // Colors, fonts, etc.
    });
    
    const pdfBuffer = await generatePDFViaPuppeteer(htmlContent, {
      format: 'A4',
      margin: { top: '1cm', bottom: '1cm', left: '1.5cm', right: '1.5cm' },
      printBackground: true,
    });
    
    // 6. Upload to GCS
    const gcsPath = `patient-laudos/${labId}/${laudoId}/v${version.version}.pdf`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(gcsPath);
    
    await file.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'public, max-age=3600',
      },
    });
    
    // 7. Generate signed URL (1h expiry for download)
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 3600 * 1000, // 1 hour
    });
    
    // 8. Log download event (immutable)
    await db
      .collection(`/labs/${labId}/patient-downloads`)
      .add({
        patientId,
        laudoId,
        versionId: version.id,
        downloadedAt: Timestamp.now(),
        ipAddress: extractClientIP(context),
        userAgent: context.headers['user-agent'],
        action: 'PDF_GENERATED',
      });
    
    return {
      success: true,
      downloadUrl,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      filename: `Resultado_${laudoId}_v${version.version}.pdf`,
    };
  });
```

### 3.3 Patient Portal HTML Template

**File: `functions/src/shared/templates/patientLaudoHTML.ts`**

```typescript
export function renderPatientLaudoHTML(props: {
  laudo: LaudoData;
  version: LaudoVersionData;
  qrImage: Buffer; // Base64-encoded PNG
  labLogo: string; // URL
  labBranding: LabBrandingConfig;
}): string {
  const { laudo, version, qrImage, labLogo, labBranding } = props;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Resultado de Laboratório — ${laudo.labName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1a1a1a;
          line-height: 1.5;
        }
        .page { page-break-after: always; padding: 0; }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 0;
          border-bottom: 2px solid #${labBranding.primaryColor || 'e5e7eb'};
          margin-bottom: 20px;
        }
        .logo { max-width: 120px; height: auto; }
        .lab-info h1 { font-size: 18px; font-weight: 600; color: #1a1a1a; }
        .lab-info p { font-size: 12px; color: #666; margin-top: 4px; }
        .patient-section {
          background: #f9fafb;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 13px;
        }
        .patient-section h2 { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 8px; }
        .patient-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .patient-label { font-weight: 500; color: #666; }
        .patient-value { color: #1a1a1a; }
        .exams-section { margin-top: 20px; }
        .exam-header {
          font-size: 13px;
          font-weight: 600;
          color: #1a1a1a;
          padding-bottom: 8px;
          border-bottom: 1px solid #d1d5db;
          margin-bottom: 12px;
        }
        .exam-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .exam-name { font-weight: 500; }
        .exam-result { text-align: right; }
        .exam-result.critical { color: #dc2626; font-weight: 600; }
        .reference { font-size: 11px; color: #666; margin-top: 4px; }
        .qr-section {
          position: absolute;
          top: 20px;
          right: 20px;
          text-align: center;
        }
        .qr-section img { width: 100px; height: 100px; }
        .qr-text { font-size: 10px; color: #666; margin-top: 4px; }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #d1d5db;
          font-size: 11px;
          color: #666;
        }
        .signature-section {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
        }
        .signature-block {
          width: 45%;
          text-align: center;
          border-top: 1px solid #000;
          padding-top: 20px;
        }
        .signature-block p { margin-top: 4px; font-size: 11px; }
        .disclaimer {
          background: #fef3c7;
          border-left: 3px solid #f59e0b;
          padding: 12px;
          margin-top: 20px;
          font-size: 11px;
          line-height: 1.4;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <!-- QR Code (absolute positioned top-right) -->
        <div class="qr-section">
          <img src="data:image/png;base64,${qrImage.toString('base64')}" alt="QR Code" />
          <div class="qr-text">Validar assinatura</div>
        </div>
        
        <!-- Header: Logo + Lab Info -->
        <div class="header">
          <img src="${labLogo}" alt="Logo" class="logo" />
          <div class="lab-info">
            <h1>${laudo.labName}</h1>
            <p>CNES: ${laudo.cnes}</p>
            <p>${laudo.labEndereco}</p>
            <p>Tel: ${laudo.labTelefone}</p>
          </div>
        </div>
        
        <!-- Patient Info Section (RDC 978 Art. 167 § 3) -->
        <div class="patient-section">
          <h2>Informações do Paciente</h2>
          <div class="patient-row">
            <span class="patient-label">Nome:</span>
            <span class="patient-value">${laudo.paciente.nome}</span>
          </div>
          <div class="patient-row">
            <span class="patient-label">CPF:</span>
            <span class="patient-value">${formatCPF(laudo.paciente.cpf || 'N/A')}</span>
          </div>
          <div class="patient-row">
            <span class="patient-label">Data de Nascimento:</span>
            <span class="patient-value">${formatDate(laudo.pacienteIdade.dataNascimento)}</span>
          </div>
          <div class="patient-row">
            <span class="patient-label">Data de Coleta:</span>
            <span class="patient-value">${formatDateTime(laudo.coletaEm)}</span>
          </div>
        </div>
        
        <!-- Exams Section -->
        <div class="exams-section">
          ${laudo.exames.map(exam => \`
            <div class="exam-header">\${exam.nome}</div>
            <div class="exam-row">
              <span class="exam-name">\${exam.nome}</span>
              <span class="exam-result \${exam.isCritical ? 'critical' : ''}">\${exam.resultados[0]?.value} \${exam.resultados[0]?.unidade}</span>
            </div>
            <div class="reference">
              Valor de Referência: \${exam.valoresReferencia.descricao}
            </div>
          \`).join('')}
        </div>
        
        <!-- Signature & Verification -->
        <div class="signature-section">
          <div class="signature-block">
            <p>Profissional</p>
            <p>${laudo.profissionalAssinaName}</p>
            <p>${laudo.profissionalAssinaRegistro}</p>
          </div>
          <div class="signature-block">
            <p>RT (Responsável Técnico)</p>
            <p>${laudo.rtNome}</p>
            <p>${laudo.rtRegistro}</p>
          </div>
        </div>
        
        <!-- Data de Emissão & LGPD Disclaimer -->
        <div class="footer">
          <p><strong>Data de Emissão:</strong> ${formatDateTime(laudo.emissaoEm)}</p>
          <p><strong>Versão do Resultado:</strong> ${version.version}</p>
          <p><strong>Hash de Verificação:</strong> ${version.signature.hash.substring(0, 32)}...</p>
        </div>
        
        <div class="disclaimer">
          <strong>Aviso de Privacidade (LGPD):</strong> Este documento contém informações médicas confidenciais. Acesso não autorizado é proibido. Para mais informações sobre privacidade, visite ${labLogo}/politica-privacidade.
        </div>
      </div>
    </body>
    </html>
  `;
}
```

---

## 4. Portal Branding Per Lab

### 4.1 Schema Extension: `portal-configuracao` (from Phase 3)

Existing collection from Phase 3 (`labSettings` module), extended for v1.4:

```firestore
/labs/{labId}/portal-configuracao
├── -- Phase 3 fields:
├── enabled: boolean
├── labName: string
├── -- NEW in Phase 5 (Patient Portal):
├── patientPortalEnabled: boolean         # Toggle patient portal on/off
├── branding: {
│   logoUrl: string                      # Lab logo (upload to GCS)
│   primaryColor: string                 # Hex color (e.g., '#1e40af')
│   secondaryColor?: string              # Secondary accent
│   fontFamily?: string                  # CSS font-family
│   headerText?: string                  # Custom header copy
│   footerText?: string                  # Custom footer (e.g., "Acreditado ISO 15189")
│   privacyPolicyUrl?: string            # Link to lab's privacy policy
│   supportEmail?: string                # Patient support contact
│ }
├── emailTemplate: {
│   senderName?: string                  # "Laboratório XYZ" (email from name)
│   subject?: string                     # Custom email subject
│   headerMessage?: string               # Message before link
│ }
├── dataRetention: {
│   laudoRetentionDays: number          # How long before laudo deleted (RDC 978 Art. 48)
│   patientAccessDays: number           # How long patient can download (default 365)
│ }
└── createdAt: Timestamp
    updatedAt: Timestamp
```

### 4.2 Branding Components

**Hook: `useLabPortalBranding` (`src/features/patient-portal/hooks/useLabPortalBranding.ts`)**

```typescript
export function useLabPortalBranding() {
  const [branding, setBranding] = useState<LabBrandingConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Extract labId from laudo or URL
    const unsub = onSnapshot(
      doc(
        db,
        `/labs/${labId}/portal-configuracao`
      ),
      (snap) => {
        if (snap.exists()) {
          setBranding(snap.data() as LabBrandingConfig);
        }
        setLoading(false);
      }
    );

    return () => unsub();
  }, [labId]);

  return { branding, loading };
}
```

**Portal Header Component:**

```tsx
export function PatientPortalHeader() {
  const { branding } = useLabPortalBranding();

  return (
    <header
      style={{
        backgroundColor: branding?.primaryColor || '#1e40af',
        padding: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {branding?.logoUrl && (
          <img src={branding.logoUrl} alt="Logo" style={{ maxHeight: '40px' }} />
        )}
        <h1 style={{ color: 'white', margin: 0 }}>
          {branding?.headerText || 'Seus Resultados de Laboratório'}
        </h1>
      </div>
    </header>
  );
}
```

---

## 5. NPS/Feedback Form Integration

### 5.1 Schema: Patient Feedback Collection

```firestore
/labs/{labId}/patient-feedback/{feedbackId}
├── patientId: string
├── laudoId: string
├── npsScore: number                 # 0–10
├── satisfaction: 'very_satisfied' | 'satisfied' | 'neutral' | 'dissatisfied' | 'very_dissatisfied'
├── comment?: string                 # Free text (max 500 chars)
├── aspects: {
│   resultClarity: 1..5              # Was the result clear?
│   downloadSpeed: 1..5              # Download experience
│   uiUsability: 1..5                # Portal ease-of-use
│ }
├── createdAt: Timestamp
└── metadata: {
    ipAddress: string
    userAgent: string
    timeOnPortal: number             # Milliseconds spent
  }
```

### 5.2 NPS Form Component

**File: `src/features/patient-portal/components/FeedbackForm.tsx`**

```tsx
import { useState } from 'react';
import { functions } from '@/shared/services/firebase';
import { httpsCallable } from 'firebase/functions';

export function FeedbackForm({ laudoId, patientId, labId }: Props) {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = httpsCallable(
    functions,
    'submitPatientFeedback'
  );

  const handleSubmit = async () => {
    try {
      await submitFeedback({
        patientId,
        laudoId,
        labId,
        npsScore,
        satisfaction,
        comment,
        timeOnPortal: Date.now() - sessionStart, // Track time
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Feedback submit failed:', error);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-lg bg-emerald-50 p-4 text-center">
        <p className="text-sm font-medium text-emerald-900">
          Obrigado pelo seu feedback!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold">Avalie sua experiência</h3>

      {/* NPS Score (0–10) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Qual a chance de você recomendar nossos serviços? (0–10)
        </label>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => setNpsScore(i)}
              className={`w-10 h-10 rounded border font-medium transition ${
                npsScore === i
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Satisfaction (5-point scale) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Como você se sentiu com a clareza do resultado?
        </label>
        <div className="space-y-2">
          {['very_satisfied', 'satisfied', 'neutral', 'dissatisfied', 'very_dissatisfied'].map((option) => (
            <label key={option} className="flex items-center">
              <input
                type="radio"
                value={option}
                checked={satisfaction === option}
                onChange={() => setSatisfaction(option)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">{translateSatisfaction(option)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Optional Comment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Comentário (opcional)
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder="Conte-nos o que você acha..."
          maxLength={500}
          className="w-full rounded border border-gray-300 p-3 text-sm resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          rows={4}
        />
        <p className="text-xs text-gray-500 mt-1">{comment.length}/500</p>
      </div>

      <button
        onClick={handleSubmit}
        disabled={npsScore === null || satisfaction === null}
        className="w-full rounded bg-blue-600 py-2 font-medium text-white disabled:bg-gray-300"
      >
        Enviar Feedback
      </button>
    </div>
  );
}
```

**Callable: `submitPatientFeedback`**

```typescript
export const submitPatientFeedback = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    const { patientId, laudoId, labId, npsScore, satisfaction, comment, timeOnPortal } = data;

    // Auth guard (same token check)
    const token = context.auth?.token;
    const decoded = jwt.verify(token, process.env.PATIENT_PORTAL_SECRET);
    if (decoded.patientId !== patientId) {
      throw new HttpsError('permission-denied', 'Token mismatch');
    }

    // Validate inputs
    if (typeof npsScore !== 'number' || npsScore < 0 || npsScore > 10) {
      throw new HttpsError('invalid-argument', 'Invalid NPS score');
    }

    // Write feedback (immutable)
    const feedbackRef = await db
      .collection(`/labs/${labId}/patient-feedback`)
      .add({
        patientId,
        laudoId,
        npsScore,
        satisfaction: satisfaction || null,
        comment: comment || '',
        aspects: {
          resultClarity: null,
          downloadSpeed: null,
          uiUsability: null,
        },
        createdAt: Timestamp.now(),
        metadata: {
          ipAddress: extractClientIP(context),
          userAgent: context.headers['user-agent'],
          timeOnPortal,
        },
      });

    return {
      success: true,
      feedbackId: feedbackRef.id,
    };
  });
```

---

## 6. LGPD Disclaimers + Privacy Widget

### 6.1 Privacy Policy Widget

**Component: `src/features/patient-portal/components/LGPDNotice.tsx`**

```tsx
import { useState } from 'react';

export function LGPDNotice({ labId }: { labId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { branding } = useLabPortalBranding();

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-900">
            Aviso de Privacidade — Lei Geral de Proteção de Dados (LGPD)
          </p>
          <p className="text-sm text-yellow-800 mt-2">
            Seus dados são protegidos sob a Lei nº 13.709/2018. Para saber como utilizamos suas informações, leia nossa{' '}
            <button
              onClick={() => setIsOpen(true)}
              className="font-semibold underline hover:text-yellow-900"
            >
              política de privacidade
            </button>
            .
          </p>
        </div>
      </div>

      {isOpen && (
        <PrivacyPolicyModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          policyUrl={branding?.privacyPolicyUrl || '/privacy'}
        />
      )}
    </div>
  );
}
```

### 6.2 Privacy Policy Modal

**Component: `src/features/patient-portal/components/PrivacyPolicyModal.tsx`**

```tsx
export function PrivacyPolicyModal({ isOpen, onClose, policyUrl }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-lg bg-white p-6">
        <h2 className="text-xl font-semibold mb-4">Política de Privacidade</h2>
        
        <div className="prose prose-sm max-w-none">
          <h3>1. Coleta de Dados</h3>
          <p>
            Coletamos dados pessoais (nome, CPF, email, data de nascimento) para
            permitir acesso aos seus resultados de laboratório conforme Lei 13.709/2018.
          </p>

          <h3>2. Uso de Dados</h3>
          <p>
            Seus dados são utilizados exclusivamente para:
            - Autenticar acesso ao seu resultado
            - Gerar auditoria de acesso
            - Melhorar nossa plataforma (feedback anônimo)
          </p>

          <h3>3. Retenção</h3>
          <p>
            Conforme RDC 978 Art. 48, resultados são retidos por 5 anos. Após esse
            período, são destruídos de forma segura.
          </p>

          <h3>4. Seus Direitos</h3>
          <p>
            Você tem o direito de:
            - Acessar seus dados pessoais
            - Solicitar correção ou exclusão
            - Revogar consentimento a qualquer hora
          </p>

          <h3>5. Contato</h3>
          <p>
            Para exercer seus direitos ou reportar preocupações de privacidade,
            entre em contato: {supportEmail}
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded bg-blue-600 py-2 font-medium text-white"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
```

---

## 7. Audit Logging (Zero Untracked Downloads)

### 7.1 Audit Trail Collection

All patient portal actions are logged **immutably** to:

```firestore
/labs/{labId}/patient-downloads  # Immutable log of all downloads
├── {eventId}
├── patientId: string
├── laudoId: string
├── versionId: string
├── action: 'PDF_GENERATED' | 'PDF_VIEWED' | 'FEEDBACK_SUBMITTED'
├── downloadedAt: Timestamp
├── ipAddress: string (anonymized: last octet nulled)
├── userAgent: string
└── -- NO patientEmail, NO patientCPF (only ID)

/labs/{labId}/patient-auth-events  # Immutable log of link generation
├── {eventId}
├── patientId: string
├── action: 'LINK_GENERATED' | 'LINK_EXPIRED' | 'TOKEN_VERIFIED'
├── createdAt: Timestamp
├── ipAddress: string (anonymized)
└── -- NO patient PII

/labs/{labId}/patient-portal-sessions  # Session tracking (optional, for TTI)
├── {sessionId}
├── patientId: string
├── startedAt: Timestamp
├── endedAt?: Timestamp
├── pageViewCount: number
└── timeSpent: number (ms)
```

### 7.2 Audit Log Reporting (RT Dashboard)

**Hook: `usePatientDownloadAudit` (`src/features/liberacao/hooks/usePatientDownloadAudit.ts`)**

```typescript
export function usePatientDownloadAudit(labId: string) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only RT (isAdminOrOwner) can view audit logs
    const unsub = onSnapshot(
      query(
        collection(db, `/labs/${labId}/patient-downloads`),
        orderBy('downloadedAt', 'desc'),
        limit(100)
      ),
      (snap) => {
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as AuditLog[];
        setLogs(data);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [labId]);

  return { logs, loading };
}
```

**UI Component in Liberação Module Dashboard:**

```tsx
export function AuditDownloadsPanel() {
  const { labId } = useAuthStore();
  const { logs, loading } = usePatientDownloadAudit(labId);

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Auditoria: Downloads de Laudos</h3>
      
      <table className="w-full text-sm">
        <thead className="border-b border-gray-300">
          <tr>
            <th className="text-left py-2">Data</th>
            <th className="text-left py-2">Paciente ID</th>
            <th className="text-left py-2">Laudo ID</th>
            <th className="text-left py-2">Ação</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-gray-100">
              <td className="py-2">{formatDateTime(log.downloadedAt)}</td>
              <td className="py-2">{log.patientId.substring(0, 8)}...</td>
              <td className="py-2">{log.laudoId}</td>
              <td className="py-2">
                <Badge variant={log.action === 'PDF_GENERATED' ? 'success' : 'default'}>
                  {log.action}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 8. Portal Responsive Design (Mobile/Tablet, 48h TTI Target)

### 8.1 Responsive Layout Strategy

**Mobile-first Tailwind approach:**

```tsx
// All components use:
// - sm: 640px (tablet)
// - md: 768px (tablet+)
// - lg: 1024px (desktop)

export function PatientLaudoView() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Left column: Laudo info */}
      <section className="col-span-1 sm:col-span-1 lg:col-span-2">
        {/* Main content */}
      </section>

      {/* Right sidebar: Actions (on mobile: stacked below) */}
      <aside className="col-span-1 sm:col-span-2 lg:col-span-1">
        {/* Download, feedback, etc. */}
      </aside>
    </div>
  );
}
```

### 8.2 Performance Targets: TTI <2.5s, INP <200ms

**Optimization Checklist:**

| Metric | Target | Technique |
|--------|--------|-----------|
| **LCP** | <2.5s | Lazy-load images, pre-render header, optimize fonts |
| **INP** | <200ms | Debounce feedback form, virtualize long lists |
| **CLS** | <0.1 | Skeleton loaders, fixed dimensions on images |
| **FID** | <100ms | Code-split routes, defer non-critical JS |

**Code Split Patient Portal:**

```typescript
// src/App.tsx
const PatientPortalApp = React.lazy(() => 
  import('./features/patient-portal/PatientPortalApp')
);

export function App() {
  return (
    <Routes>
      {/* Internal routes (eager load) */}
      <Route path="/hub" element={<HubPage />} />
      <Route path="/laudos" element={<LiberacaoPage />} />

      {/* Patient portal (lazy) */}
      <Route
        path="/paciente/*"
        element={
          <Suspense fallback={<PortalLoadingScreen />}>
            <PatientPortalApp />
          </Suspense>
        }
      />
    </Routes>
  );
}
```

**Image Optimization:**

```tsx
// Use Next-Gen formats (WebP fallback to JPG)
<picture>
  <source srcSet={logoWebP} type="image/webp" />
  <img src={logoJpg} alt="Logo" loading="lazy" width="120" height="40" />
</picture>
```

---

## 9. Component Architecture

### 9.1 Folder Structure

```
src/features/patient-portal/
├── components/
│   ├── PatientAuthForm.tsx           # CPF entry + link generation
│   ├── PatientAuthPage.tsx           # Email link landing (token validation)
│   ├── PatientLaudoCard.tsx          # Card showing laudo summary
│   ├── PatientLaudoList.tsx          # Grid/list of patient's laudos
│   ├── PatientLaudoView.tsx          # Full laudo detail + download btn
│   ├── FeedbackForm.tsx              # NPS + satisfaction survey
│   ├── LGPDNotice.tsx                # Privacy notice banner
│   ├── PrivacyPolicyModal.tsx        # Full policy page
│   ├── PatientPortalHeader.tsx       # Branded header
│   └── PortalLoadingScreen.tsx       # Skeleton while token validates
├── hooks/
│   ├── usePatientAuthStore.ts        # Zustand token storage
│   ├── usePatientLaudos.ts           # Query laudos for patient
│   ├── useLabPortalBranding.ts       # Fetch lab branding config
│   └── usePatientDownloadAudit.ts    # (RT-only) audit logs
├── pages/
│   ├── PatientAuthPage.tsx           # /paciente/auth
│   ├── PatientLaudosListPage.tsx     # /paciente/laudos
│   ├── PatientLaudoDetailPage.tsx    # /paciente/laudo/:id
│   └── PatientPortalLayout.tsx       # Main layout wrapper
├── services/
│   ├── patientAuthService.ts         # Token validation
│   ├── patientLaudoService.ts        # Laudo queries
│   └── patientDownloadService.ts     # PDF generation callables
├── types/
│   ├── index.ts                      # PatientAuthState, etc.
│   └── firestore.ts                  # TS bindings for patient collections
├── PatientPortalApp.tsx              # Root component (lazy-loaded)
└── CLAUDE.md                         # Module-specific rules
```

### 9.2 Key Services

**File: `src/features/patient-portal/services/patientLaudoService.ts`**

```typescript
import { db } from '@/shared/services/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';
import { Laudo } from '@/features/liberacao/types/laudo';

/**
 * Fetch all laudos for a specific patient.
 * Respects patient auth token scope (can only fetch own laudos).
 */
export function listenToPatientLaudos(
  labId: string,
  patientId: string,
  onData: (laudos: Laudo[]) => void,
  onError: (error: Error) => void
) {
  const unsubscribe = onSnapshot(
    query(
      collection(db, `/labs/${labId}/laudos`),
      where('paciente.id', '==', patientId),
      where('deletadoEm', '==', null),
      orderBy('emissaoEm', 'desc')
    ),
    (snap) => {
      const laudos = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Laudo[];
      onData(laudos);
    },
    (error) => onError(error as Error)
  );

  return unsubscribe;
}

/**
 * Get a single laudo by ID (with permission check).
 */
export async function getPatientLaudo(
  labId: string,
  patientId: string,
  laudoId: string
): Promise<Laudo | null> {
  const laudoSnap = await getDocs(
    query(
      collection(db, `/labs/${labId}/laudos`),
      where('id', '==', laudoId),
      where('paciente.id', '==', patientId),
      where('deletadoEm', '==', null)
    )
  );

  if (laudoSnap.empty) return null;
  
  const laudoDoc = laudoSnap.docs[0];
  return {
    id: laudoDoc.id,
    ...laudoDoc.data(),
  } as Laudo;
}
```

---

## 10. Cloud Functions Callables (Phase 5-Specific)

### 10.1 Summary of New Callables

| Callable | Scope | Trigger | Return |
|----------|-------|---------|--------|
| `generatePatientAuthLink` | Public | Patient enters CPF | `{success, message}` |
| `verifyPatientAuthToken` | Public | Token in URL | `{valid, patientId, labId, expiresAt}` |
| `generatePatientLaudoPDF` | Patient | Patient clicks download | `{downloadUrl, expiresAt, filename}` |
| `submitPatientFeedback` | Patient | Feedback form submit | `{success, feedbackId}` |

### 10.2 File Structure in Functions

```
functions/src/
├── index.ts                    # Main export (register all callables)
├── patient-portal/
│   ├── generatePatientAuthLink.ts
│   ├── verifyPatientAuthToken.ts
│   ├── generatePatientLaudoPDF.ts
│   └── submitPatientFeedback.ts
├── shared/
│   ├── templates/
│   │   ├── patientAuthEmail.ts
│   │   ├── patientLaudoHTML.ts
│   │   └── emailConfig.ts
│   ├── crypto/
│   │   ├── hashCPF.ts             # SHA-256 hashing with salt
│   │   ├── generateQRCode.ts       # QR generation
│   │   └── extractClientIP.ts
│   └── firestore/
│       └── validatePatientAccess.ts
└── v1.3/
    └── ...existing modules...
```

---

## 11. Firestore Security Rules (Phase 5 Additions)

### 11.1 New Rules for Patient Collections

```firestore
// /labs/{labId}/patients (patient list for RT management)
match /labs/{labId}/patients/{patientId} {
  // RT/Admin can read all patients
  allow read: if request.auth != null && isAdminOrOwner(labId);
  
  // RT/Admin can create/update/delete patients
  allow write: if request.auth != null && isAdminOrOwner(labId);
}

// /labs/{labId}/patient-auth-events (immutable audit log)
match /labs/{labId}/patient-auth-events/{eventId} {
  // Only append (create) — no updates/deletes
  allow create: if request.auth == null; // CF calls this, not user
  
  // RT/Admin can read audit log
  allow read: if request.auth != null && isAdminOrOwner(labId);
  
  // No updates/deletes
  allow update, delete: if false;
}

// /labs/{labId}/patient-downloads (immutable download audit)
match /labs/{labId}/patient-downloads/{downloadId} {
  // Only append (CF creates)
  allow create: if request.auth == null;
  
  // RT/Admin can read
  allow read: if request.auth != null && isAdminOrOwner(labId);
  
  // No updates/deletes
  allow update, delete: if false;
}

// /labs/{labId}/patient-feedback (patient feedback)
match /labs/{labId}/patient-feedback/{feedbackId} {
  // Only append
  allow create: if request.auth == null;
  
  // RT/Admin can read + aggregate
  allow read: if request.auth != null && isAdminOrOwner(labId);
  
  // No updates/deletes
  allow update, delete: if false;
}

// /labs/{labId}/portal-configuracao (branding config)
match /labs/{labId}/portal-configuracao {
  // Public can read (portal styling)
  allow read: if true;
  
  // Only RT/Admin can write
  allow write: if request.auth != null && isAdminOrOwner(labId);
}
```

---

## 12. E2E Test Specs (6 critical paths)

### 12.1 Test Plan File: `src/__tests__/e2e/patient-portal.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsRT, seedPatients, seedLaudo } from './fixtures';

const BASE_URL = 'https://localhost:3000'; // Or staging URL

test.describe('Patient Portal — E2E', () => {
  
  // ========== Spec 1: Email Link Generation & Expiry ==========
  test('Spec 1: Patient receives email link with 72h expiry', async ({ page }) => {
    // 1. Seed patient data
    const { patientCPF, patientEmail } = await seedPatients(1);
    
    // 2. Navigate to /paciente/auth
    await page.goto(`${BASE_URL}/paciente/auth`);
    
    // 3. Enter CPF
    await page.fill('[data-testid="patient-cpf-input"]', patientCPF);
    await page.click('[data-testid="generate-link-btn"]');
    
    // 4. Expect success message
    const successMsg = page.locator('[data-testid="success-message"]');
    await expect(successMsg).toContainText('Link enviado para email');
    
    // 5. Check email (mock email service)
    const emailContent = await getLatestEmail(patientEmail);
    expect(emailContent).toContain(`${BASE_URL}/paciente/auth?token=`);
    
    // 6. Verify link expiry (72h = 259200s)
    const tokenUrl = extractTokenFromEmail(emailContent);
    const decoded = decodeJWT(tokenUrl.split('token=')[1]);
    const expiryTime = decoded.exp * 1000;
    const nowTime = Date.now();
    const diffHours = (expiryTime - nowTime) / 3600000;
    expect(diffHours).toBeLessThanOrEqual(72);
    expect(diffHours).toBeGreaterThan(70);
  });

  // ========== Spec 2: Token Validation & Invalid Token ==========
  test('Spec 2: Invalid token redirects to error page', async ({ page }) => {
    // 1. Try accessing with malformed token
    await page.goto(`${BASE_URL}/paciente/auth?token=invalid-token-xyz`);
    
    // 2. Expect error state
    const errorBanner = page.locator('[data-testid="error-banner"]');
    await expect(errorBanner).toContainText('Token inválido ou expirado');
    
    // 3. Expect redirect option
    const retryBtn = page.locator('[data-testid="retry-button"]');
    await expect(retryBtn).toBeVisible();
  });

  // ========== Spec 3: PDF Download & Audit Log ==========
  test('Spec 3: Patient downloads PDF and audit log is created', async ({ page }) => {
    // 1. Setup: Generate valid token & seed laudo
    const { patientId, labId, token } = await setupPatientSession();
    const { laudoId } = await seedLaudo(labId, patientId);
    
    // 2. Navigate to /paciente/laudos with token
    await page.goto(
      `${BASE_URL}/paciente/auth?token=${token}`,
      { waitUntil: 'networkidle' }
    );
    
    // 3. Wait for redirect to /paciente/laudos
    await page.waitForURL('**/paciente/laudos');
    
    // 4. Verify laudo is visible
    const laudoCard = page.locator(`[data-testid="laudo-card-${laudoId}"]`);
    await expect(laudoCard).toBeVisible();
    
    // 5. Click download button
    await page.click(`[data-testid="download-btn-${laudoId}"]`);
    
    // 6. Wait for PDF download (Playwright captures downloads)
    const downloadPromise = page.waitForEvent('download');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/Resultado_.+\.pdf/);
    
    // 7. Verify audit log was created (check Firestore)
    await waitForAuditLog(labId, patientId, laudoId, 'PDF_GENERATED', 5000);
    const auditEntry = await getAuditLogEntry(labId, patientId, laudoId);
    expect(auditEntry).toBeDefined();
    expect(auditEntry.action).toBe('PDF_GENERATED');
  });

  // ========== Spec 4: NPS Form Submission ==========
  test('Spec 4: Patient submits NPS feedback and sees confirmation', async ({ page }) => {
    // 1. Setup authenticated session
    const { patientId, labId, token } = await setupPatientSession();
    const { laudoId } = await seedLaudo(labId, patientId);
    
    // 2. Navigate to /paciente/laudos
    await page.goto(`${BASE_URL}/paciente/auth?token=${token}`);
    await page.waitForURL('**/paciente/laudos');
    
    // 3. Open feedback form (click on a laudo first)
    await page.click(`[data-testid="laudo-card-${laudoId}"]`);
    await page.waitForURL(`**/paciente/laudo/${laudoId}`);
    
    // 4. Scroll to feedback section
    await page.locator('[data-testid="feedback-form"]').scrollIntoViewIfNeeded();
    
    // 5. Submit NPS (score 9)
    await page.click('[data-testid="nps-score-9"]');
    
    // 6. Select satisfaction
    await page.click('[data-testid="satisfaction-satisfied"]');
    
    // 7. Type comment
    await page.fill('[data-testid="feedback-comment"]', 'Resultado muito claro!');
    
    // 8. Submit
    await page.click('[data-testid="submit-feedback-btn"]');
    
    // 9. Expect confirmation message
    const confirmMsg = page.locator('[data-testid="feedback-success-msg"]');
    await expect(confirmMsg).toContainText('Obrigado pelo seu feedback');
    
    // 10. Verify Firestore write
    await waitForFeedbackEntry(labId, patientId, laudoId, 5000);
  });

  // ========== Spec 5: Mobile Responsiveness (375px width) ==========
  test('Spec 5: Portal UI is usable on mobile (375px)', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 1. Authenticate
    const { token } = await setupPatientSession();
    await page.goto(`${BASE_URL}/paciente/auth?token=${token}`);
    await page.waitForURL('**/paciente/laudos');
    
    // 2. Verify header is visible (not hidden)
    const header = page.locator('[data-testid="portal-header"]');
    await expect(header).toBeVisible();
    
    // 3. Verify laudo cards stack vertically
    const laudoCards = page.locator('[data-testid^="laudo-card-"]');
    const count = await laudoCards.count();
    expect(count).toBeGreaterThan(0);
    
    // 4. Download button is accessible (not cut off)
    const downloadBtn = laudoCards.first().locator('[data-testid$="download-btn"]');
    const boundingBox = await downloadBtn.boundingBox();
    expect(boundingBox?.x).toBeGreaterThanOrEqual(0);
    expect(boundingBox?.x! + boundingBox?.width!).toBeLessThanOrEqual(375);
    
    // 5. Feedback form scrolls (no horizontal scroll)
    await page.locator('[data-testid^="laudo-card-"]').first().click();
    const feedbackForm = page.locator('[data-testid="feedback-form"]');
    await feedbackForm.scrollIntoViewIfNeeded();
    const formBox = await feedbackForm.boundingBox();
    expect(formBox?.x).toBeGreaterThanOrEqual(0);
  });

  // ========== Spec 6: Audit Trail Visibility (RT Dashboard) ==========
  test('Spec 6: RT can view patient download audit log', async ({ page }) => {
    // 1. Login as RT
    await loginAsRT(page);
    
    // 2. Navigate to Liberação module audit section
    await page.goto(`${BASE_URL}/hub/liberacao`);
    await page.click('[data-testid="audit-downloads-tab"]');
    
    // 3. Seed a patient download (via separate API call)
    const { patientId, laudoId } = await simulatePatientDownload();
    
    // 4. Refresh audit log
    await page.click('[data-testid="refresh-audit-btn"]');
    
    // 5. Verify download entry appears
    const downloadRow = page.locator(
      `[data-testid="audit-row-${patientId}-${laudoId}"]`
    );
    await expect(downloadRow).toBeVisible();
    
    // 6. Verify columns: Date, Patient ID (masked), Laudo ID, Action
    const dateCol = downloadRow.locator('[data-testid="col-date"]');
    const patientCol = downloadRow.locator('[data-testid="col-patient"]');
    const actionCol = downloadRow.locator('[data-testid="col-action"]');
    
    await expect(dateCol).toContainText(/\d{2}\/\d{2}\/\d{4}/); // Date format
    expect(await patientCol.textContent()).toMatch(/[a-f0-9]{8}\.\.\./); // Masked ID
    await expect(actionCol).toContainText('PDF_GENERATED');
  });
});
```

### 12.2 Test Fixtures & Helpers

```typescript
// tests/fixtures.ts
export async function seedPatients(count: number) {
  const patients = [];
  for (let i = 0; i < count; i++) {
    const patientData = {
      name: `Paciente ${i}`,
      dateOfBirth: new Date(1990, 0, 1 + i),
      cpf: generateValidCPF(),
      email: `patient${i}@test.local`,
      status: 'active',
    };
    
    const docRef = await addDoc(
      collection(db, `/labs/test-lab-id/patients`),
      patientData
    );
    
    patients.push({ id: docRef.id, ...patientData });
  }
  return patients;
}

export async function seedLaudo(labId: string, patientId: string) {
  const laudoData = {
    labId,
    paciente: { id: patientId, nome: 'Test Patient', cpf: '12345678901' },
    cnes: '1234567',
    labName: 'Lab Test',
    status: 'LIBERADO',
    emissaoEm: serverTimestamp(),
    coletaEm: serverTimestamp(),
    exames: [
      {
        nome: 'Glicose',
        resultados: [{ value: 95, unidade: 'mg/dL' }],
        valoresReferencia: { min: 70, max: 100, descricao: '70–100 mg/dL' },
      },
    ],
  };
  
  const docRef = await addDoc(
    collection(db, `/labs/${labId}/laudos`),
    laudoData
  );
  
  return { id: docRef.id, ...laudoData };
}

export async function setupPatientSession() {
  const [patient] = await seedPatients(1);
  const token = generateTestToken(patient.id, 'test-lab-id');
  return { patientId: patient.id, labId: 'test-lab-id', token };
}

export function generateTestToken(patientId: string, labId: string): string {
  return jwt.sign(
    { patientId, labId, iat: Date.now() },
    process.env.PATIENT_PORTAL_SECRET || 'test-secret',
    { expiresIn: '72h' }
  );
}

export async function getAuditLogEntry(
  labId: string,
  patientId: string,
  laudoId: string
) {
  const snap = await getDocs(
    query(
      collection(db, `/labs/${labId}/patient-downloads`),
      where('patientId', '==', patientId),
      where('laudoId', '==', laudoId),
      orderBy('downloadedAt', 'desc'),
      limit(1)
    )
  );
  return snap.docs[0]?.data();
}
```

---

## 13. Deployment Checklist (Wave 2 → Production)

### 13.1 Pre-Deploy Verification

**Functions:**
```bash
# 1. Type-check functions
cd functions && npm run build

# 2. Run function tests
npm test -- patient-portal

# 3. Test callables locally (emulator)
firebase emulators:start --only functions,firestore

# 4. Verify secret status
bash scripts/preflight-secrets-check.sh
```

**Rules:**
```bash
# 1. Deploy rules (includes new patient-* collections)
firebase deploy --only firestore:rules

# 2. Test rules in emulator
firebase emulators:exec 'npm test -- rules'
```

**Web:**
```bash
# 1. Type-check React
npx tsc --noEmit

# 2. Build
npm run build

# 3. Verify Web Vitals locally
npm run build && npm run preview
# (Then Lighthouse audit)

# 4. Deploy
firebase deploy --only hosting
```

### 13.2 Post-Deploy Smoke Tests (Manual)

| Step | Action | Expected |
|------|--------|----------|
| 1 | Navigate to `/paciente` on staging | Portal auth page loads |
| 2 | Enter test patient CPF | "Link sent" message + email received |
| 3 | Click email link | Redirects to `/paciente/laudos` |
| 4 | Download PDF | File saves, audit log created |
| 5 | Submit NPS (score 8) | "Thanks for feedback" message |
| 6 | Login as RT | Audit log visible in Liberação module |
| 7 | Open mobile (375px) | UI is responsive, no horizontal scroll |

### 13.3 Monitoring (First 24h)

```bash
# Check Cloud Functions logs for errors
firebase functions:log --project hmatologia2

# Monitor patient downloads (query Firestore)
db.collection('labs/default/patient-downloads').orderBy('downloadedAt', 'desc').limit(10).get()

# Alert thresholds:
# - 5+ PATIENT_NOT_FOUND errors → investigate patient data seeding
# - 10+ RATE_LIMIT_EXCEEDED → may need to adjust (currently 3/day)
# - Any PERMISSION_DENIED → auth token issue
```

---

## 14. Rollback & Contingency Plan

### 14.1 If Email Service Fails

**Scenario:** Resend / SendGrid API down.

**Mitigation:**
1. Patient can still view `/paciente/laudos` (no email needed)
2. RT generates link manually (admin callable) + emails patient directly
3. Fallback: RT provides patient with test token via phone

**Implementation:**
```typescript
// Admin-only callable for RT to generate token manually
export const generatePatientAuthLinkAdmin = functions
  .region('southamerica-east1')
  .https.onCall(async (data, context) => {
    if (!isAdminOrOwner(context)) throw new HttpsError('permission-denied', '');
    
    const { patientId, labId, expiryHours = 72 } = data;
    
    const token = jwt.sign(
      { patientId, labId },
      process.env.PATIENT_PORTAL_SECRET,
      { expiresIn: `${expiryHours}h` }
    );
    
    // Return token (RT copies + pastes into email)
    return { token, portalUrl: `https://hmatologia2.web.app/paciente/auth?token=${token}` };
  });
```

### 14.2 If Patient Auth Token Verification Fails

**Scenario:** JWT library mismatch, secret rotation bug.

**Mitigation:**
1. Fallback: Patient re-enters CPF → re-triggers link generation
2. No data loss (email link is stateless)
3. Rate-limit is per-patient, not account-level

### 14.3 PDF Generation Timeout

**Scenario:** Puppeteer hangs or Laudo HTML is too complex (>30s).

**Mitigation:**
1. Set Cloud Function timeout to 120s (vs. 60s default)
2. Pre-generate PDFs during laudo release (background job)
3. If timeout on-demand → return cached PDF from GCS (if available)

---

## 15. Roadmap: v1.4.1 LIS Integration (Post-Launch)

**Timeline:** 2–3 weeks after v1.4 Phase 5 launch.

**Scope (not in Phase 5):**
1. LIS middleware (HL7 v2.4 or FHIR wrapper)
2. Patient sync batch job (`syncPatientsFromLIS` callable)
3. Self-service patient login (CPF + name verification against LIS)
4. Zero breaking changes to portal UX

**Reference:** ADR-0015 (Accepted, 2026-05-07)

---

## Summary

**Phase 5 delivers:**
- Portal URL structure: `/paciente/*` (path-based)
- Patient auth: Email-link (72h expiry), immutable audit trail
- PDF generation: Laudo + QR code (patient-facing template)
- Lab branding: Portal config per lab (logo, colors, policy URL)
- NPS feedback: 5-question form + DB persistence
- LGPD: Privacy notice + policy modal
- Audit logging: Zero untracked downloads (patient-downloads collection)
- Responsive: Mobile-first, <2.5s LCP target
- Tests: 6 E2E specs (email, token, PDF, NPS, mobile, audit)

**Resources:**
- 2 Cloud Function developers (1 FTE callables, 1 FTE PDF/email)
- 2 React developers (1 FTE portal UI, 1 FTE testing)
- 1 QA engineer (manual smoke tests + mobile)

**Timeline:** 14 working days (2 weeks) from Phase 5 kickoff.

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-07  
**Status:** Ready for implementation  
**Next Review:** Phase 5 mid-point (Day 7 check-in)

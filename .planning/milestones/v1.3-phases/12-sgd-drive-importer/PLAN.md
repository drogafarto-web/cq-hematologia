# Phase 12 Plan 01 — SGD Foundation + Drive Importer

**Deadline:** 2026-08-25
**Duration:** 1.5 weeks (Plan 01 of 3)
**Owner:** Claude (Haiku 4.5)

---

## Objective

Scaffold SGD (Système de Gestão de Documentos Externos) module with Drive importer wizard. Deliverables: components (SGDViewer, DriveImporterWizard), services (sgdService, driveImporterService), Cloud Function for Drive authorization + listing, TypeScript clean, unit tests 80%+.

---

## Architecture Decision

### Storage & Multi-Tenant Path

```
/labs/{labId}/sgd-externos/{id}
├── titulo: string
├── descricao: string
├── driveFileId: string
├── driveFileName: string
├── mimeType: string
├── driveFolderId: string
├── categoriaICQ?: string (Bloco A-J, classifier fills)
├── linksSugeridos?: LinkSuggestion[] (auto-generated)
├── linksConfirmados?: ModuleLink[] (user approves)
├── criadoEm: timestamp
├── criadoPor: userId
├── deletadoEm?: timestamp
├── aud (audit fields): { hash, operatorId, ts }
```

**Rationale**: Mirrors SGQ pattern (labs/{labId}/sgq-documentos). Soft-delete only (RN-06). Audit trail attached to payload.

### Drive Integration Strategy

**Lazy fetch** — store metadata only, generate signed URLs on demand:

```typescript
// sgdService.ts
async getSignedUrl(labId: string, driveFileId: string): Promise<string> {
  const drive = google.drive({ version: 'v3', auth: getServiceAccount() })
  const url = await drive.files.get({
    fileId: driveFileId,
    alt: 'media'
  })
  return url.request.url // client fetches directly
}
```

**Rationale**: Avoids 1GB replication; respects Drive quota; keeps Firestore lean.

### Cloud Function Callable Pattern

```typescript
// functions/src/sgd/sgd-drive-importer.ts
export const sgdDriveImporter = onCall(async (request) => {
  // 1. Validate user auth + labId
  // 2. List Drive files from folder
  // 3. Return metadata batch for UI preview
});
```

**Rationale**: Matches ADR-0006; secure Drive API key handling server-side; client just displays.

---

## Component Breakdown

### 1. SGDViewer.tsx

```typescript
interface SGDViewerProps {
  labId: string
  docId: string
  inline?: boolean // inline (modal) vs full-screen
  onClose?: () => void
}

export const SGDViewer: React.FC<SGDViewerProps> = ({
  labId,
  docId,
  inline = false,
  onClose
}) => {
  const { data: doc, loading } = useSGDDocumento(labId, docId)
  const { url: signedUrl, loading: urlLoading } = useSignedUrl(labId, doc?.driveFileId)

  return (
    <div className={cn(
      'bg-[#141417] text-white',
      inline ? 'rounded-lg border border-white/10' : 'fixed inset-0'
    )}>
      {/* Header: titulo, X button, download icon */}
      {/* iFrame or embed for PDF — TBD based on MIME type */}
      {/* Footer: metadata, audit trail collapse */}
    </div>
  )
}
```

**Features**:

- Iframe for PDF (mimeType check)
- Fallback for non-PDF (text preview)
- Metadata sidebar: created by/at, categoria, links
- Audit trail expandable below

**a11y**:

- `aria-label` on close button
- Keyboard: ESC to close (inline only)
- Focus trap in modal

### 2. DriveImporterWizard.tsx

**4-step flow**:

```typescript
type WizardStep = 'auth' | 'select' | 'preview' | 'confirm'

const DriveImporterWizard: React.FC<{ labId: string; onComplete: () => void }> = ({
  labId,
  onComplete
}) => {
  const [step, setStep] = useState<WizardStep>('auth')
  const [driveFolderId, setDriveFolderId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([])
  const [importJob, setImportJob] = useState<ImportJob | null>(null)

  return (
    <Modal>
      {step === 'auth' && <AuthStep onNext={(fId) => {
        setDriveFolderId(fId)
        setStep('select')
      }} />}
      {step === 'select' && <SelectStep
        labId={labId}
        driveFolderId={driveFolderId}
        onNext={(files) => {
          setSelectedFiles(files)
          setStep('preview')
        }}
      />}
      {step === 'preview' && <PreviewStep
        files={selectedFiles}
        onNext={() => setStep('confirm')}
        onPrev={() => setStep('select')}
      />}
      {step === 'confirm' && <ConfirmStep
        labId={labId}
        files={selectedFiles}
        onComplete={onComplete}
        setImportJob={setImportJob}
      />}
    </Modal>
  )
}
```

**Step 1 (Auth)**: "Select Drive folder to import from"

- OAuth redirect to Google (via Cloud Function)
- User selects folder from Drive picker
- Returns `driveFolderId`

**Step 2 (Select)**: "Choose documents"

- Calls `sgdDriveImporter` callable
- Shows paginated list of files in folder
- Checkboxes to select (batch size limit 50)
- File size + MIME type shown

**Step 3 (Preview)**: "Review before import"

- Table: filename, size, type
- Option to deselect individual files
- Consent checkbox: "I confirm these documents are suitable for lab records"

**Step 4 (Confirm)**: "Importing…"

- Progress bar (files uploaded)
- After batch import completes → show summary ("80 docs imported")
- Disable all inputs during import

### 3. sgdService.ts

```typescript
export const sgdService = {
  async createDocument(
    labId: string,
    input: Omit<SGDDocumento, 'id' | 'labId' | 'criadoEm' | 'aud'>,
  ): Promise<SGDDocumento> {
    const docRef = doc(collection(db, `labs/${labId}/sgd-externos`));
    const now = serverTimestamp();
    const payload = {
      ...input,
      labId,
      criadoEm: now,
      deletadoEm: null,
    };
    const hash = generateAuditHash(payload);
    const aud: LogicalSignature = {
      hash,
      operatorId: getCurrentUser().uid,
      ts: now,
    };
    await setDoc(docRef, { ...payload, aud });
    return getDoc(docRef) as Promise<SGDDocumento>;
  },

  async softDeleteDocument(labId: string, docId: string): Promise<void> {
    const ref = doc(db, `labs/${labId}/sgd-externos/${docId}`);
    const existing = await getDoc(ref);
    const now = serverTimestamp();
    const hash = generateAuditHash({ ...existing.data(), deletadoEm: now });
    await updateDoc(ref, {
      deletadoEm: now,
      aud: {
        operatorId: getCurrentUser().uid,
        hash,
        ts: now,
      },
    });
  },

  async listDocuments(
    labId: string,
    filters?: { categoria?: string; status?: 'vigente' | 'deletado' },
  ): Promise<SGDDocumento[]> {
    let q = query(collection(db, `labs/${labId}/sgd-externos`));
    if (filters?.status === 'vigente') {
      q = query(q, where('deletadoEm', '==', null));
    }
    if (filters?.categoria) {
      q = query(q, where('categoriaICQ', '==', filters.categoria));
    }
    return getDocs(q).then((snap) => snap.docs.map((doc) => doc.data() as SGDDocumento));
  },

  async getSignedUrl(labId: string, driveFileId: string): Promise<string> {
    // Calls Cloud Function to generate signed URL
    const callable = httpsCallable(getFunctions(), 'sgdGetSignedUrl');
    const result = await callable({ labId, driveFileId });
    return result.data.url;
  },
};
```

### 4. useSGDDocumentos.ts

```typescript
export const useSGDDocumentos = (labId: string) => {
  const [data, setData] = useState<SGDDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, `labs/${labId}/sgd-externos`),
      where('deletadoEm', '==', null),
      orderBy('criadoEm', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map(
            (doc) =>
              ({
                id: doc.id,
                ...doc.data(),
              }) as SGDDocumento,
          ),
        );
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [labId]);

  return { data, loading, error };
};
```

### 5. driveImporterService.ts

```typescript
export const driveImporterService = {
  async importBatch(
    labId: string,
    files: DriveFile[],
    consent: boolean,
  ): Promise<{ created: number; failed: number; jobId: string }> {
    // Calls Cloud Function to batch-import
    const callable = httpsCallable(getFunctions(), 'sgdDriveImporter');
    const result = await callable({
      labId,
      files: files.map((f) => ({
        driveFileId: f.id,
        driveFileName: f.name,
        mimeType: f.mimeType,
        driveFolderId: f.parents[0],
      })),
      consent,
      operatorEmail: getCurrentUser().email,
    });
    return result.data;
  },
};
```

---

## Cloud Function: sgd-drive-importer.ts

```typescript
import * as functions from 'firebase-functions';
import { google } from 'googleapis';
import { db } from '../shared/firebaseAdmin';

const drive = google.drive({ version: 'v3' });

export const sgdDriveImporter = functions.https.onCall(async (data, context) => {
  // 1. Auth check
  if (!context.auth?.uid) throw new Error('Unauthenticated');

  const { labId, files, consent, operatorEmail } = data;

  // 2. Validate lab membership via custom claim
  if (!context.auth.custom_claims?.labs.includes(labId)) {
    throw new Error('Unauthorized lab');
  }

  // 3. Batch write to Firestore
  const batch = db.batch();
  let created = 0;

  for (const file of files) {
    const docRef = db.collection(`labs/${labId}/sgd-externos`).doc();
    batch.set(docRef, {
      driveFileId: file.driveFileId,
      driveFileName: file.driveFileName,
      mimeType: file.mimeType,
      driveFolderId: file.driveFolderId,
      titulo: file.driveFileName,
      descricao: '',
      categoriaICQ: null,
      linksSugeridos: [],
      linksConfirmados: [],
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
      criadoPor: context.auth.uid,
      deletadoEm: null,
      aud: {
        operatorId: context.auth.uid,
        hash: computeHash({
          /* payload */
        }),
        ts: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
    created++;
  }

  await batch.commit();

  // 4. Log audit event
  await db.collection(`labs/${labId}/sgd-externos-audit`).add({
    event: 'batch_imported',
    filesCount: created,
    operatorId: context.auth.uid,
    operatorEmail,
    consent,
    ts: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { created, failed: 0, jobId: Math.random().toString(36) };
});
```

---

## Types (types/SGDDocumento.ts)

```typescript
export interface SGDDocumento {
  id: string;
  labId: string;
  titulo: string;
  descricao?: string;
  driveFileId: string;
  driveFileName: string;
  mimeType: string;
  driveFolderId: string;
  categoriaICQ?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
  linksSugeridos?: LinkSuggestion[];
  linksConfirmados?: ModuleLink[];
  criadoEm: Timestamp;
  criadoPor: string;
  deletadoEm?: Timestamp | null;
  aud: LogicalSignature;
}

export interface LinkSuggestion {
  targetModule: 'sgq' | 'pop' | 'treinamentos' | 'biosseguranca';
  targetId: string;
  targetNome: string;
  confidence: number; // 0-1 from Gemini classifier
}

export interface ModuleLink {
  targetModule: string;
  targetId: string;
  confirmedAt: Timestamp;
  confirmedBy: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  parents: string[];
}

export interface ImportJob {
  jobId: string;
  labId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  filesTotal: number;
  filesProcessed: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

---

## Unit Tests (tests/sgdService.test.ts)

```typescript
import { sgdService } from '../services/sgdService';

describe('sgdService', () => {
  it('creates document with audit signature', async () => {
    const input = {
      titulo: 'Test Doc',
      driveFileId: '123',
      driveFileName: 'test.pdf',
      mimeType: 'application/pdf',
      driveFolderId: 'f123',
    };
    const doc = await sgdService.createDocument('test-lab', input);
    expect(doc.aud.hash).toHaveLength(64);
    expect(doc.aud.operatorId).toBe(getCurrentUser().uid);
  });

  it('soft-deletes document', async () => {
    const doc = await sgdService.createDocument('test-lab', {
      /* ... */
    });
    await sgdService.softDeleteDocument('test-lab', doc.id);
    const fetched = await sgdService.getDocument('test-lab', doc.id);
    expect(fetched.deletadoEm).toBeDefined();
  });

  it('filters by categoria', async () => {
    // Create 3 docs with different categorias
    // List with filter
    // Assert only matching ones returned
  });
});
```

---

## Firestore Rules Addition (firestore.rules)

```
match /labs/{labId}/sgd-externos/{docId} {
  allow read: if request.auth.uid in resource.data.labId == labId
    && request.auth.customClaims.labs[labId] exists
  allow create: if request.auth.uid != null
    && request.resource.data.labId == labId
    && request.resource.data.aud.operatorId == request.auth.uid
    && request.resource.data.aud.hash.size() == 64
    && request.resource.data.aud.ts is timestamp
  allow update: if request.auth.uid != null
    && resource.data.labId == request.resource.data.labId
    && request.resource.data.aud.operatorId == request.auth.uid
}
```

---

## Verification Checklist (Plan 01)

- [ ] `src/features/sgd/` created with full structure
- [ ] SGDViewer renders with mocked data
- [ ] DriveImporterWizard all 4 steps navigate correctly
- [ ] sgdService.createDocument passes audit signature validation
- [ ] useSGDDocumentos listens to Firestore + unsubscribes on unmount
- [ ] Cloud Function sgd-drive-importer scaffolded + tests mock Google API
- [ ] TypeScript: `npx tsc --noEmit` clean (no errors in sgd/)
- [ ] Unit test coverage >= 80% for sgdService
- [ ] CLAUDE.md written (module-specific rules)
- [ ] Commit staged (not pushed)

---

## Known Unknowns / Blocking Questions

1. **Drive OAuth flow**: Does HC Quality already have Google API credentials configured in functions secret? (Need `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON`)
2. **Signed URL TTL**: How long should signed URLs live? (Proposed: 1 hour for lab access, 24h for auditor access)
3. **MIME type fallback**: How to handle non-PDF files (Excel, Word, images)? Proposed: inline preview for images, download-only for others.
4. **Batch size limit**: Should we cap at 50 files per import to avoid timeout? Or support resumable uploads?
5. **Folder permission scope**: Does the Drive folder belong to Riopomba or is it shared via service account?

---

## Post-Plan Gates

1. CTO reviews components + functions for design + compliance
2. Demo: import 5 test docs + view in SGDViewer
3. Gemini integration plan approved before Plan 12-02 starts
4. TypeScript validation must pass before merge

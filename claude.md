# 🚀 INIT — CQ Hematologia Labclin (Reimplementação Profissional)
## Para usar no Antigravity com Claude Sonnet + Opus

---

## 🎯 Contexto do Projeto

Você está construindo **CQ Hematologia Labclin** — um sistema web SaaS de Controle de Qualidade Interno para laboratórios clínicos de hematologia. O sistema roda em múltiplos laboratórios (multi-tenant), onde operadores fotografam a tela do equipamento hematológico (Yumizen H550), a IA extrai os resultados dos 21 analitos via OCR, o operador revisa/confirma, e o dado é salvo gerando gráficos de Levey-Jennings com alertas das Regras de Westgard.

**Projetos de referência bem-sucedidos com esta stack**: apps de gestão clínica SaaS com Firebase + Zustand + React Query já comprovados em produção.

---

## 🛠️ Stack Tecnológica

```json
{
  "frontend": "React 19 + TypeScript 5.8 + Vite 6",
  "styling": "Tailwind CSS (CDN)",
  "state": "Zustand 5 (global) + useState (local)",
  "validation": "Zod 3",
  "charts": "Recharts 3",
  "backend": "Firebase 12 (Auth + Firestore + Storage + Functions)",
  "ai": "@google/genai (Gemini 2.5 Flash — OCR de equipamentos)",
  "icons": "Componentes SVG customizados (sem lib externa)"
}
```

---

## 📁 Estrutura de Pastas (Feature-based — OBRIGATÓRIO)

```text
src/
├── main.tsx                        # Entry: <ErrorBoundary><AuthWrapper>
│
├── config/
│   ├── firebase.config.ts          # Lê do .env: VITE_FIREBASE_*
│   └── database.config.ts          # Enum DatabaseProvider + switch Firebase/LocalStorage
│
├── features/
│   │
│   ├── auth/                       # Tudo relacionado à autenticação e onboarding
│   │   ├── AuthWrapper.tsx         # Renderiza tela certa por authStatus
│   │   ├── LoginScreen.tsx
│   │   ├── FirstLabSetupScreen.tsx
│   │   ├── LabSelectorScreen.tsx
│   │   ├── PendingLabAccessScreen.tsx
│   │   ├── hooks/
│   │   │   └── useAuthFlow.ts      # ← TODA lógica da máquina de estados aqui
│   │   └── services/
│   │       └── authService.ts      # getOrCreateUserDocument, setActiveLab, signOut
│   │
│   ├── lots/                       # Gerenciamento de lotes de controle
│   │   ├── LotManager.tsx
│   │   ├── AddLotModal.tsx
│   │   ├── LotStatus.tsx
│   │   ├── LotReport.tsx
│   │   ├── hooks/
│   │   │   └── useLots.ts          # addLots, updateLot, deleteLot, selectLot
│   │   └── services/
│   │       └── csvParserService.ts # parseMultiLevelLotCsv()
│   │
│   ├── runs/                       # Corridas de controle (core do sistema)
│   │   ├── NewRunForm.tsx
│   │   ├── CameraModal.tsx
│   │   ├── ReviewRunModal.tsx
│   │   ├── ResultsHistory.tsx
│   │   ├── RunItem.tsx
│   │   ├── hooks/
│   │   │   └── useRuns.ts          # newRun, confirmRun, updateRun, deleteRun
│   │   └── services/
│   │       └── geminiService.ts    # extractDataFromImage() com validação Zod
│   │
│   ├── chart/                      # Gráfico de Levey-Jennings
│   │   ├── LeveyJenningsChart.tsx
│   │   ├── StatsSourceToggle.tsx
│   │   ├── AnalyteSelector.tsx
│   │   ├── hooks/
│   │   │   └── useChartData.ts     # cálculo de stats + regras Westgard
│   │   └── utils/
│   │       └── westgardRules.ts    # Regras 1-2s, 1-3s, 2-2s, R-4s, 4-1s, 10x
│   │
│   ├── bulaparser/                 # Importação de metas via PDF de bula
│   │   ├── BulaProcessor.tsx
│   │   └── services/
│   │       └── bulaGeminiService.ts # extractDataFromBulaPdf()
│   │
│   └── admin/                      # Painel Super Admin
│       ├── LabAdminScreen.tsx
│       ├── SuperAdminDashboard.tsx
│       ├── AccessRequestsTab.tsx
│       ├── LabManagementTab.tsx
│       ├── UserManagementModal.tsx
│       ├── LabAdminModal.tsx
│       └── services/
│           ├── labAdminService.ts   # addNewLab, updateLab, uploadLabLogo
│           └── superAdminService.ts # fetchUsers, approveAccess, denyAccess
│
├── shared/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── ConfirmationModal.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── FullScreenLoader.tsx
│   │   ├── Header.tsx
│   │   ├── Logo.tsx
│   │   └── IconComponents.tsx
│   │
│   ├── hooks/
│   │   └── useFirestoreSubscription.ts
│   │
│   └── services/
│       ├── firebase.ts
│       ├── databaseService.ts
│       ├── firebaseService.ts
│       └── localStorageService.ts
│
├── store/
│   ├── useAuthStore.ts
│   └── useAppStore.ts
│
└── types/
    └── index.ts
```

---

## 🗄️ Modelo de Dados Firestore

```text
REGRA CRÍTICA: NUNCA salvar lotes como array dentro de um documento.
Usar SEMPRE a arquitetura split: cada lote é um documento separado.

/users/{userId}
  - email: string
  - displayName: string
  - labIds: string[]
  - roles: { [labId]: 'owner' | 'admin' | 'member' }
  - isSuperAdmin: boolean
  - activeLabId: string | null

/labs/{labId}
  - name: string
  - logoUrl?: string
  /members/{userId}
    - active: boolean
    - role: 'owner' | 'admin' | 'member'
  /data/appState
    - activeLotId: string | null
    - selectedAnalyteId: string | null
    - lastUpdated: Timestamp
  /lots/{lotId}
    - (ControlLot completo sem o array runs interno grande)

/accessRequests/{reqId}
  - uid: string
  - email: string
  - labId: string
  - status: 'pending' | 'approved' | 'denied'
  - createdAt: Timestamp

/status/init
```

---

## 📐 Interfaces TypeScript (types/index.ts)

```typescript
export interface Analyte {
  id: string;
  name: string;
}

export interface AnalyteResult {
  id: string;
  runId: string;
  analyteId: string;
  value: number;
  confidence?: number;
  reasoning?: string;
  timestamp: Date;
  violations?: WestgardViolation[];
}

export type WestgardViolation =
  | '1-2s' | '1-3s' | '2-2s' | 'R-4s' | '4-1s' | '10x' | 'warning';

export type RunStatus = 'Aprovada' | 'Rejeitada' | 'Pendente';

export interface Run {
  id: string;
  sampleId?: string;
  timestamp: Date;
  imageUrl: string;
  status: RunStatus;
  results: AnalyteResult[];
  manualOverride?: boolean;
}

export interface PendingRun {
  file: File;
  base64: string;
  sampleId?: string;
  results: {
    [analyteId: string]: {
      value: number;
      confidence: number;
      reasoning: string;
    };
  };
}

export interface ManufacturerStats {
  [analyteId: string]: { mean: number; sd: number };
}

export interface InternalStats {
  [analyteId: string]: { mean: number; sd: number };
}

export interface ControlLot {
  id: string;
  lotNumber: string;
  controlName?: string;
  equipmentName: string;
  serialNumber: string;
  startDate: Date;
  expiryDate: Date;
  requiredAnalytes: string[];
  manufacturerStats: ManufacturerStats;
  runs: Run[];
  statistics: InternalStats | null;
}

export interface Lab {
  id: string;
  name: string;
  logoUrl?: string;
}

export type UserRole = 'owner' | 'admin' | 'member';

export interface AppProfile {
  user: import('firebase/auth').User;
  labs: Lab[];
  activeLab: Lab | null;
  role: UserRole | null;
  isSuperAdmin: boolean;
}

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
export type View = 'analyzer' | 'bulaparser' | 'labadmin';
export type StatsSource = 'manufacturer' | 'internal';

export interface StoredState {
  lots: ControlLot[];
  activeLotId: string | null;
  selectedAnalyteId: string | null;
}

export type Unsubscribe = () => void;

export interface DatabaseService {
  saveState(state: StoredState): Promise<void>;
  loadState(): Promise<StoredState | null>;
  subscribeToState(callback: (state: StoredState) => void): Unsubscribe;
  uploadFile(file: File, path: string): Promise<string>;
}
```

---

## 🏪 Zustand Stores

```typescript
// use selectors atômicos; evitar selecionar objetos novos a cada render
```

### `store/useAuthStore.ts`

```typescript
import { create } from 'zustand';
import { AppProfile, Lab, UserRole } from '../types';

interface AuthState {
  appProfile: AppProfile | null;
  isLoading: boolean;
  error: string | null;
  setProfile: (profile: AppProfile) => void;
  setActiveLab: (lab: Lab, role: UserRole) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  appProfile: null,
  isLoading: true,
  error: null,
  setProfile: (profile) => set({ appProfile: profile, isLoading: false, error: null }),
  setActiveLab: (lab, role) =>
    set((state) => ({
      appProfile: state.appProfile
        ? { ...state.appProfile, activeLab: lab, role }
        : null,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  reset: () => set({ appProfile: null, isLoading: false, error: null }),
}));

export const useUser = () => useAuthStore((s) => s.appProfile?.user ?? null);
export const useActiveLab = () => useAuthStore((s) => s.appProfile?.activeLab ?? null);
export const useIsSuperAdmin = () => useAuthStore((s) => s.appProfile?.isSuperAdmin ?? false);
export const useAvailableLabs = () => useAuthStore((s) => s.appProfile?.labs ?? []);
```

### `store/useAppStore.ts`

```typescript
import { create } from 'zustand';
import { ControlLot, SyncStatus, PendingRun, View, StatsSource } from '../types';

interface AppState {
  lots: ControlLot[];
  activeLotId: string | null;
  selectedAnalyteId: string | null;
  pendingRun: PendingRun | null;
  isLoading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
  currentView: View;
  chartStatsSource: StatsSource;
  setLots: (lots: ControlLot[]) => void;
  setActiveLotId: (id: string | null) => void;
  setSelectedAnalyteId: (id: string | null) => void;
  setPendingRun: (run: PendingRun | null) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setSyncStatus: (s: SyncStatus) => void;
  setCurrentView: (v: View) => void;
  setChartStatsSource: (s: StatsSource) => void;
}

export const useAppStore = create<AppState>((set) => ({
  lots: [],
  activeLotId: null,
  selectedAnalyteId: null,
  pendingRun: null,
  isLoading: false,
  error: null,
  syncStatus: 'saved',
  currentView: 'analyzer',
  chartStatsSource: 'manufacturer',
  setLots: (lots) => set({ lots }),
  setActiveLotId: (activeLotId) => set({ activeLotId }),
  setSelectedAnalyteId: (selectedAnalyteId) => set({ selectedAnalyteId }),
  setPendingRun: (pendingRun) => set({ pendingRun }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setCurrentView: (currentView) => set({ currentView }),
  setChartStatsSource: (chartStatsSource) => set({ chartStatsSource }),
}));

export const useActiveLot = () =>
  useAppStore((s) => s.lots.find((l) => l.id === s.activeLotId) ?? null);
```

---

## 🔐 Firestore Rules

Use regras RBAC baseadas no documento do usuário e na subcoleção `members`, sem email hardcoded; esse padrão evita inconsistência de permissão e é a abordagem mais segura para multi-tenant com Firestore. [web:30]

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isSuperAdmin() {
      let userDoc = get(/databases/$(database)/documents/users/$(request.auth.uid));
      return userDoc != null && userDoc.data.isSuperAdmin == true;
    }

    function isActiveMemberOfLab(labId) {
      let memberPath = /databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid);
      return exists(memberPath) && get(memberPath).data.active == true;
    }

    function getMemberRole(labId) {
      return get(/databases/$(database)/documents/labs/$(labId)/members/$(request.auth.uid)).data.role;
    }

    function isAdminOrOwner(labId) {
      let role = getMemberRole(labId);
      return role == 'admin' || role == 'owner';
    }

    match /users/{userId} {
      allow get: if isAuthenticated();
      allow list: if isSuperAdmin();
      allow create, update: if isSuperAdmin() || request.auth.uid == userId;
    }

    match /labs/{labId} {
      allow get: if isSuperAdmin() || isActiveMemberOfLab(labId);
      allow list, write: if isSuperAdmin();

      match /members/{uid} {
        allow get: if isSuperAdmin() || request.auth.uid == uid;
        allow list, write: if isSuperAdmin();
      }

      match /data/{dataPath} {
        allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
        allow create, update: if
          (isSuperAdmin() || isActiveMemberOfLab(labId)) &&
          (isAdminOrOwner(labId) || dataPath == 'appState');
        allow delete: if isSuperAdmin() || isAdminOrOwner(labId);
      }

      match /lots/{lotId} {
        allow read: if isSuperAdmin() || isActiveMemberOfLab(labId);
        allow write: if isSuperAdmin() || (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
      }
    }

    match /accessRequests/{reqId} {
      allow list, get, update, delete: if isSuperAdmin();
      allow create: if isAuthenticated() && request.resource.data.uid == request.auth.uid;
    }

    match /status/{docId} {
      allow get: if isAuthenticated();
      allow create: if isAuthenticated() && docId == 'init' &&
        !exists(/databases/$(database)/documents/status/init);
      allow update, delete: if isSuperAdmin();
    }
  }
}
```

---

## ✅ Validação Zod da IA

Validar a saída do Gemini no cliente antes de salvar é hoje uma prática importante para evitar quebrar o frontend e corromper dados persistidos. [web:35][web:37][web:43]

```typescript
import { z } from 'zod';

const AnalyteResultSchema = z.object({
  value: z.number().min(0),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const GeminiResponseSchema = z.object({
  sampleId: z.string().optional(),
  results: z.record(z.string(), AnalyteResultSchema),
});

export async function extractDataFromImage(base64: string, analytes: any[], mimeType: string) {
  // chamada Gemini structured output
  const raw = JSON.parse(response.text);
  const validated = GeminiResponseSchema.safeParse(raw);

  if (!validated.success) {
    throw new Error('IA retornou dados fora do formato esperado. Tente nova foto.');
  }

  return validated.data;
}
```

---

## 🚫 Regras obrigatórias

- Nunca salvar `lots[]` dentro de `appState`
- Nunca bloquear a UI com upload de imagem em série
- Nunca hardcodar email nas regras
- Nunca concentrar regra de negócio no `App.tsx`
- Nunca salvar retorno do Gemini sem `safeParse`
- Nunca depender de prop drilling para auth/global state
- Nunca deixar credenciais fora de `.env`

---

## 🏁 Ordem de implementação

1. `types/index.ts`
2. `constants.ts`
3. `config/firebase.config.ts`
4. `shared/services/firebase.ts`
5. `store/useAuthStore.ts`
6. `store/useAppStore.ts`
7. `features/auth/services/authService.ts`
8. `features/auth/hooks/useAuthFlow.ts`
9. `shared/services/databaseService.ts`
10. `features/lots/hooks/useLots.ts`
11. `features/runs/services/geminiService.ts`
12. `features/runs/hooks/useRuns.ts`
13. `features/chart/hooks/useChartData.ts`
14. `features/admin/*`
15. `App.tsx` curto, só composição

---

## Instrução final

Você é um desenvolvedor sênior React/TypeScript/Firebase especializado em aplicações SaaS de saúde. Implemente o projeto CQ Hematologia Labclin seguindo estritamente a arquitetura, a estrutura de pastas, os stores Zustand, a validação Zod e as regras Firestore acima. Comece pelo passo 1 da ordem de implementação. Não viole os anti-padrões listados. Se houver ambiguidade arquitetural, pergunte antes de decidir.
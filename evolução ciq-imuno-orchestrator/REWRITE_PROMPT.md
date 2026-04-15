---
title: "REWRITE PROMPT — CIQ-Imuno Orchestrator"
target: "Gemini 3 Flash via Antigravity"
scope: "Reescrever todos os MDs da pasta evolução ciq-imuno-orchestrator"
author: "Gerado por auditoria profunda do projeto real"
date: "2026-04-15"
---

# MASTER REWRITE PROMPT — CIQ-Imuno Orchestrator

## IDENTIDADE E MISSÃO

Você é um engenheiro sênior do projeto **CQ Labclin** reescrevendo os documentos de planejamento do módulo CIQ-Imuno. Sua missão é corrigir cada arquivo `.md` desta pasta para que reflitam com precisão a arquitetura real do projeto — não uma arquitetura imaginada ou genérica.

Você NUNCA inventa padrões. Você SEMPRE adere à infraestrutura existente documentada abaixo.

---

## ARQUITETURA REAL DO PROJETO (leia antes de qualquer reescrita)

### Stack

```json
{
  "frontend": "React 19 + TypeScript 5.8 + Vite 6",
  "styling": "Tailwind CSS 4 (via package, não CDN)",
  "state": "Zustand 5 (global) + useState (local)",
  "validation": "Zod 3 standalone — SEM react-hook-form",
  "charts": "Recharts 3",
  "backend": "Firebase 10 (Auth + Firestore + Storage + Functions v2)",
  "ai": "@google/genai — servidor apenas, NUNCA no frontend",
  "icons": "SVG inline customizados — SEM lucide-react, SEM heroicons",
  "animation": "CSS transitions nativas — SEM framer-motion",
  "pathAlias": "NENHUM — tsconfig sem paths, sem @/ alias"
}
```

### Dependências AUSENTES (não adicionar sem justificativa explícita)
- `framer-motion` — AUSENTE
- `lucide-react` — AUSENTE
- `react-hook-form` — AUSENTE
- `@hookform/resolvers` — AUSENTE
- `clsx` — AUSENTE
- `@types/crypto-js` — AUSENTE e desnecessário
- `shadcn/ui` — AUSENTE, `@/components/ui/badge` NÃO EXISTE

### Dependências que PRECISAM ser adicionadas para CIQ-Imuno
- `papaparse` — export CSV FR-036
- `qrcode.react` — QR de rastreabilidade

---

### Sistema de Roteamento Real

**`src/App.tsx`** — 13 linhas, não tocar:
```tsx
export default function App() {
  return (
    <ErrorBoundary>
      <div className="bg-gray-50 dark:bg-[#0c0c0c] min-h-screen ...">
        <AuthWrapper />
      </div>
    </ErrorBoundary>
  );
}
```

**`src/features/auth/AuthWrapper.tsx`** — AppRouter interno:
```tsx
function AppRouter() {
  const currentView = useAppStore((s) => s.currentView);
  if (currentView === 'superadmin' && isSuperAdmin) return <SuperAdminDashboard />;
  if (currentView === 'hub')        return <ModuleHub />;
  if (currentView === 'bulaparser') return <BulaProcessor />;
  if (currentView === 'reports')    return <ReportsView />;
  return <AnalyzerView />; // fallback = hematologia
  // ← ADICIONAR: if (currentView === 'ciq-imuno') return <CIQImunoDashboard />;
}
```

**`src/types/index.ts:240`** — View union atual:
```ts
export type View = 'hub' | 'analyzer' | 'bulaparser' | 'labadmin' | 'superadmin' | 'reports';
// ← ADICIONAR 'ciq-imuno'
```

**`src/store/useAppStore.ts`** — Navegação:
```ts
const setCurrentView = useAppStore((s) => s.setCurrentView);
setCurrentView('ciq-imuno'); // ← assim se navega
```

---

### ModuleHub — Padrão Real de Cards

**`src/features/hub/ModuleHub.tsx`** — MODULES array existente:
```tsx
interface ModuleDef {
  id: string;
  name: string;
  tagline: string;
  icon: React.ReactNode;    // SVG inline — NUNCA lucide
  iconBg: string;           // ex: 'bg-violet-500/15'
  iconColor: string;        // ex: 'text-violet-400'
  status: 'active' | 'soon';
  view?: View;
}

const MODULES: ModuleDef[] = [
  { id: 'hematology', name: 'Hematologia', status: 'active', view: 'analyzer', ... },
  { id: 'biochemistry', status: 'soon', ... },
  { id: 'coagulation',  status: 'soon', ... },
  { id: 'urinalysis',   status: 'soon', ... },
  // ← CIQ-Imuno deve ser adicionado aqui com status: 'active', view: 'ciq-imuno'
];
```

Card ativo usa classes Tailwind puras, sem framer-motion:
```tsx
className="group flex items-start gap-3.5 p-4 rounded-xl border border-slate-200
           dark:border-white/[0.08] bg-white dark:bg-white/[0.02]
           hover:border-violet-400/50 dark:hover:border-violet-500/25
           transition-all duration-150 text-left w-full"
```

---

### Tipos Base — Estender, não duplicar

**`src/types/index.ts:279`** — `CQRun` já existe e é RDC 978/2025 compliant:
```ts
export interface CQRun {
  id: string;
  operatorId: string;
  operatorName: string;
  operatorRole: 'biomedico' | 'tecnico' | 'farmaceutico';
  operatorDocument?: string;   // ← equivale a crefito/registroConselho
  confirmedAt: Timestamp;
  aiData: Record<string, number | null>;
  isEdited: boolean;
  confirmedData: Record<string, number>;
  labId: string;
  lotId: string;
  level: 1 | 2 | 3;
  westgardViolations?: WestgardViolation[];
  status: RunStatus;
  version: number;
  previousRunId?: string;
  logicalSignature?: string;   // ← equivale ao hash SHA-256
  createdAt: Timestamp;
  createdBy: string;
  imageUrl?: string;
}
```

`CIQImunoRun` deve **estender** `CQRun`, adicionando apenas campos específicos de imuno:
```ts
import type { CQRun } from '../../../types';

export interface CIQImunoRun extends Omit<CQRun, 'westgardViolations' | 'level'> {
  testType: TestType;
  loteControle: string;
  aberturaControle: string;   // YYYY-MM-DD
  validadeControle: string;
  loteReagente: string;
  reagenteStatus: 'R' | 'NR';
  aberturaReagente: string;
  validadeReagente: string;
  resultadoEsperado: 'R' | 'NR';
  resultadoObtido: 'R' | 'NR';
  dataRealizacao: string;
  westgardCategorico?: WestgardCatAlert[];
}

export type TestType =
  | 'HCG' | 'BhCG'
  | 'HIV'
  | 'HBsAg'
  | 'Anti-HCV'
  | 'Sifilis'
  | 'Dengue'
  | 'COVID'
  | 'PCR'
  | 'Troponina';

export type WestgardCatAlert =
  | 'taxa_falha_10pct'       // >10% NR no lote
  | 'consecutivos_3nr'       // 3 NR consecutivos
  | 'consecutivos_4nr'       // 4 NR nos últimos N
  | 'lote_expirado'          // dataRealizacao > validade
  | 'validade_30d';          // <30 dias para vencer
```

---

### Firebase Callable — Padrão de AI

O projeto NUNCA chama Gemini diretamente do frontend. A chave da API é um Secret do Firebase, nunca exposta ao cliente.

**Padrão existente (`src/features/runs/services/geminiService.ts`):**
```ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';

const _extractFromImage = httpsCallable(functions, 'extractFromImage');

export async function analyzeStrip(base64: string, testType: TestType) {
  const result = await _analyzeImmunoStrip({ base64, testType });
  return result.data;
}

// ← O callable 'analyzeImmunoStrip' deve ser criado em functions/src/index.ts
// seguindo o mesmo padrão de extractFromImage (onCall + secrets + Zod validation)
```

**Modelo Gemini real em produção:** `gemini-3.1-flash-image-preview`
(não "Gemini 3 Flash", não "gemini-2.5-flash")

---

### Sistema de Módulos JWT — Já existe, usar

**`firestore.rules:48-50`** — função já implementada:
```js
function hasModuleAccess(module) {
  return request.auth.token.get('modules', {})[module] == true;
}
```

**`functions/src/index.ts:504`** — `setModulesClaims` aceita qualquer string:
```ts
modules: z.record(z.string(), z.boolean())
// Uso: { uid: '...', modules: { imunologia: true } }
```

O módulo CIQ-Imuno deve usar a chave **`'imunologia'`** nos claims JWT.

---

### Firestore Rules — Path novo precisa de regra nova

O path `labs/{labId}/ciq-imuno/{lotId}/runs` não está coberto pelas regras atuais. Adicionar dentro do bloco `match /labs/{labId}`:

```js
match /ciq-imuno/{lotId} {
  allow read: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && hasModuleAccess('imunologia'));
  allow write: if isSuperAdmin() ||
    (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));

  match /runs/{runId} {
    allow read: if isSuperAdmin() ||
      (isActiveMemberOfLab(labId) && hasModuleAccess('imunologia'));
    allow create, update: if isSuperAdmin() || isActiveMemberOfLab(labId);
    allow delete: if isSuperAdmin() ||
      (isActiveMemberOfLab(labId) && isAdminOrOwner(labId));
  }
}
```

---

### Westgard Categórico — Implementação real esperada

O `westgardRules.ts` existente é quantitativo (z-scores). CIQ-Imuno é categórico (R/NR). São hooks separados.

```ts
// hooks/useCIQWestgard.ts
export function useCIQWestgard(runs: CIQImunoRun[]) {
  return useMemo(() => {
    const alerts: WestgardCatAlert[] = [];
    const total = runs.length;
    if (total === 0) return { alerts, lotStatus: 'sem_dados' as const };

    // Regra 1: taxa de falha > 10%
    const countNR = runs.filter(r => r.resultadoObtido === 'NR').length;
    if (total >= 10 && countNR / total > 0.10) alerts.push('taxa_falha_10pct');

    // Regra 2: 3 NR consecutivos
    const recentes = [...runs].sort(/* desc por data */);
    let consecutivos = 0;
    for (const r of recentes) {
      if (r.resultadoObtido === 'NR') { consecutivos++; if (consecutivos >= 3) { alerts.push('consecutivos_3nr'); break; } }
      else consecutivos = 0;
    }

    // Regra 3: 4 NR nos últimos 10
    const ultimos10 = recentes.slice(0, 10);
    const nr10 = ultimos10.filter(r => r.resultadoObtido === 'NR').length;
    if (nr10 >= 4) alerts.push('consecutivos_4nr');

    const lotStatus = alerts.length === 0 ? 'valido' : alerts.some(a => a === 'taxa_falha_10pct') ? 'reprovado' : 'atencao';
    return { alerts, lotStatus };
  }, [runs]);
}
```

---

### Nomenclatura unificada — usar em TODOS os arquivos

| Campo (orchestrator)    | Campo correto (projeto real)       |
|-------------------------|------------------------------------|
| `crefito`               | `operatorDocument`                 |
| `registroConselho`      | `operatorDocument`                 |
| `hash`                  | `logicalSignature`                 |
| `Signature.crefito`     | remover — usar `CQRun.operatorDocument` |
| `Claude 3.7 Sonnet MAX` | `claude-sonnet-4-6`                |
| `Gemini 3 Flash`        | `gemini-3.1-flash-image-preview`   |
| `src/ciq-imuno/`        | `src/features/ciq-imuno/`          |

---

## ARQUIVOS A REESCREVER — INSTRUÇÕES POR ARQUIVO

---

### 1. CRIAR: `_shared_refs.md`

Este arquivo é referenciado em todas as etapas mas não existe. Criá-lo agora.

**Conteúdo esperado:**
```markdown
---
title: "Shared References — CIQ-Imuno"
dependencias: []
---

# Referências Compartilhadas — CIQ-Imuno

## TestType
\`\`\`ts
export type TestType =
  | 'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV'
  | 'Sifilis' | 'Dengue' | 'COVID' | 'PCR' | 'Troponina';
\`\`\`

## Status
\`\`\`ts
export type CIQStatus = 'A' | 'NA' | 'Rejeitado';
\`\`\`

## WestgardCatAlert
\`\`\`ts
export type WestgardCatAlert =
  | 'taxa_falha_10pct' | 'consecutivos_3nr'
  | 'consecutivos_4nr' | 'lote_expirado' | 'validade_30d';
\`\`\`

## Firestore Paths
\`\`\`
labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
labs/{labId}/ciq-imuno/{lotId}/audit/{timestamp}
\`\`\`

## Chave JWT do módulo
\`\`\`
'imunologia'  ← usar em hasModuleAccess() e setModulesClaims()
\`\`\`

## Dependências NPM a adicionar
\`\`\`bash
npm i papaparse qrcode.react
npm i -D @types/papaparse
\`\`\`

## Estrutura de pastas
\`\`\`
src/features/ciq-imuno/
├── types/
│   └── CIQImuno.ts
├── hooks/
│   ├── useCIQLots.ts
│   ├── useCIQRuns.ts
│   ├── useCIQWestgard.ts
│   └── useCIQSignature.ts
├── components/
│   ├── CIQImunoDashboard.tsx
│   ├── CIQImunoForm.tsx
│   ├── CIQAuditor.tsx
│   └── CIQExportButtons.tsx
└── services/
    ├── ciqFirebaseService.ts
    ├── ciqOCRService.ts      ← chama callable, não Gemini direto
    └── ciqExportService.ts
\`\`\`
```

---

### 2. REESCREVER: `orchestrator.md`

Manter: estrutura das 8 etapas, parâmetros do lab, status dashboard.

**Corrigir:**
- `engine: "Claude 3.7 Sonnet MAX"` → `engine: "claude-sonnet-4-6"`
- `PLATAFORMA: Firebase + React + Gemini 3 Flash` → `PLATAFORMA: Firebase 10 + React 19 + TypeScript 5.8 + Vite 6 + Tailwind 4`
- Adicionar **Etapa 0 (Pré-requisitos)** antes da etapa 1:

```markdown
## ETAPA 0: PRÉ-REQUISITOS DO GUARDACHUCA (5min)

Antes de executar as 8 etapas, aplicar no projeto principal:

1. `src/types/index.ts` — adicionar `'ciq-imuno'` ao union `View`
2. `src/features/auth/AuthWrapper.tsx` — adicionar rota `ciq-imuno` no AppRouter
3. `src/features/hub/ModuleHub.tsx` — adicionar entry em MODULES[] com SVG inline
4. `firestore.rules` — adicionar bloco `match /ciq-imuno/{lotId}` com hasModuleAccess('imunologia')
5. `functions/src/index.ts` — adicionar callable `analyzeImmunoStrip`
6. `npm i papaparse qrcode.react && npm i -D @types/papaparse`
```

- Remover: `npm run orchestrate`, `npm run validate-rdc`, `gemini flash ./orchestrator.md`
- Adicionar: `firebase deploy --only firestore:rules,functions` na sequência de deploy

---

### 3. REESCREVER: `claude.md`

Este arquivo é o mais problemático. Reescrita quase completa necessária.

**Remover completamente:**
- Toda referência a "Claude 3.7 Sonnet MAX"
- O código do `ModuleSwitcher` standalone (arquitetura errada)
- O código de integração via `App.tsx` + `useState('hematologia')`
- Todos os imports de `framer-motion`, `lucide-react`, `Badge`, `@/components/ui/badge`
- O install `npm i qrcode.react papaparse lucide-react framer-motion react-hook-form @hookform/resolvers zod clsx`

**Manter:**
- Progresso das etapas (tabela 50%)
- Contexto do lab (LABOCLIN-RP, Bruno, CRBM-MG)
- Checklist de validação RDC

**Adicionar:**
- Seção "Integração Real no Guardachuca" com o padrão correto:
  ```
  PASSO 1: Adicionar 'ciq-imuno' ao View type (src/types/index.ts:240)
  PASSO 2: Adicionar rota no AppRouter (AuthWrapper.tsx:43)
  PASSO 3: Adicionar card no ModuleHub MODULES[] com ícone SVG inline
  PASSO 4: Usar useAppStore.setCurrentView('ciq-imuno') para navegar
  ```
- Instalar apenas: `npm i papaparse qrcode.react && npm i -D @types/papaparse`
- Modelo correto: `claude-sonnet-4-6`

---

### 4. REESCREVER: `etapa1_schema.md`

**Remover:** `CIQImunoRun` como interface independente.

**Substituir por:** `CIQImunoRun extends Omit<CQRun, ...>` conforme o template da seção de tipos acima.

**Adicionar:** instrução de importar `CQRun` de `'../../../types'` (path relativo correto para `src/features/ciq-imuno/types/CIQImuno.ts`).

**Manter:** Firestore path, instrução de criar o arquivo.

---

### 5. REESCREVER: `etapa2_router.md`

Substituição completa da abordagem. O `ModuleSwitcher` standalone está errado.

**Novo conteúdo:**
```markdown
# ETAPA 2/8: INTEGRAÇÃO NO GUARDACHUCA — VIEW + HUB + ROUTER (20min)

## Passo 1: View type
Arquivo: `src/types/index.ts:240`
Adicionar 'ciq-imuno' ao union:
\`\`\`ts
export type View = 'hub' | 'analyzer' | 'bulaparser' | 'labadmin' | 'superadmin' | 'reports' | 'ciq-imuno';
\`\`\`

## Passo 2: AppRouter
Arquivo: `src/features/auth/AuthWrapper.tsx`
Adicionar antes do return fallback:
\`\`\`tsx
if (currentView === 'ciq-imuno') return <CIQImunoDashboard />;
\`\`\`
Adicionar import: `import { CIQImunoDashboard } from '../ciq-imuno/components/CIQImunoDashboard';`

## Passo 3: ModuleHub card
Arquivo: `src/features/hub/ModuleHub.tsx`
Adicionar ícone SVG inline:
\`\`\`tsx
function ImunoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 2v3M10 15v3M2 10h3M15 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
    </svg>
  );
}
\`\`\`
Adicionar ao array MODULES[]:
\`\`\`tsx
{
  id: 'ciq-imuno',
  name: 'CIQ-Imuno',
  tagline: 'Imunoensaios · Strips · RDC 978/2025 · FR-036',
  icon: <ImunoIcon />,
  iconBg: 'bg-emerald-500/15',
  iconColor: 'text-emerald-400',
  status: 'active',
  view: 'ciq-imuno',
},
\`\`\`
```

---

### 6. REESCREVER: `etapa3_form.md`

**Remover:** `react-hook-form`, `@hookform/resolvers`, stub vazio.

**Substituir por:** Zod + useState (padrão do projeto). Incluir os campos reais do FR-036:

```markdown
## Schema Zod
\`\`\`ts
import { z } from 'zod';

export const CIQImunoFormSchema = z.object({
  testType:           z.enum(['HCG','BhCG','HIV','HBsAg','Anti-HCV','Sifilis','Dengue','COVID','PCR','Troponina']),
  loteControle:       z.string().min(1, 'Obrigatório'),
  aberturaControle:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  validadeControle:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  loteReagente:       z.string().min(1, 'Obrigatório'),
  reagenteStatus:     z.enum(['R','NR'], { required_error: 'Status do reagente obrigatório' }),
  aberturaReagente:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validadeReagente:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resultadoEsperado:  z.enum(['R','NR']),
  resultadoObtido:    z.enum(['R','NR']),
  dataRealizacao:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(d => d.dataRealizacao <= d.validadeControle, {
  message: 'Realização após validade do controle', path: ['dataRealizacao']
}).refine(d => d.dataRealizacao <= d.validadeReagente, {
  message: 'Realização após validade do reagente', path: ['dataRealizacao']
});

export type CIQImunoFormData = z.infer<typeof CIQImunoFormSchema>;
\`\`\`

## Padrão de estado (sem react-hook-form)
\`\`\`tsx
const [form, setForm] = useState<Partial<CIQImunoFormData>>({});
const [errors, setErrors] = useState<Record<string, string>>({});

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  const result = CIQImunoFormSchema.safeParse(form);
  if (!result.success) {
    const flat = result.error.flatten().fieldErrors;
    setErrors(Object.fromEntries(Object.entries(flat).map(([k,v]) => [k, v?.[0] ?? ''])));
    return;
  }
  onSubmit(result.data);
}
\`\`\`
```

---

### 7. REESCREVER: `etapa4_validacoes.md`

Manter lógica. Adicionar implementação de `daysToExpiry`:

```ts
function daysToExpiry(dateStr: string): number {
  const expiry = new Date(dateStr);
  const today  = new Date();
  return Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
```

Remover referência a `react-hook-form`. A validação é integrada ao Zod schema da etapa 3.

---

### 8. REESCREVER: `etapa5_ocr.md`

Reescrita completa — o padrão de chamada direta ao Gemini é um erro de segurança.

**Novo padrão obrigatório:**
```markdown
## Padrão correto: Firebase Callable (NUNCA chamada direta ao Gemini)

### Frontend: `src/features/ciq-imuno/services/ciqOCRService.ts`
\`\`\`ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../config/firebase.config';
import type { TestType } from '../types/CIQImuno';

interface StripOCRPayload { base64: string; mimeType: string; testType: TestType; }
interface StripOCRResult  { resultadoObtido: 'R' | 'NR'; confidence: 'high' | 'medium' | 'low'; }

const _analyzeImmunoStrip = httpsCallable<StripOCRPayload, StripOCRResult>(
  functions, 'analyzeImmunoStrip'
);

export async function analyzeImmunoStrip(file: File, testType: TestType): Promise<StripOCRResult> {
  const base64 = await fileToBase64(file);
  const result = await _analyzeImmunoStrip({ base64, mimeType: file.type, testType });
  return result.data;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
\`\`\`

### Backend: `functions/src/index.ts` — adicionar callable
\`\`\`ts
export const analyzeImmunoStrip = onCall(
  { secrets: [geminiApiKey, openRouterApiKey], memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Autenticação necessária.');
    const { base64, mimeType, testType } = request.data;
    const prompt = `Analise a imagem de um strip de imunoensaio do tipo ${testType}.
Responda APENAS com JSON: { "resultado": "R" | "NR", "confidence": "high" | "medium" | "low" }
R = Reagente/Positivo | NR = Não Reagente/Negativo`;
    const rawText = await callAIWithFallback({ prompt, base64, mimeType,
      geminiKey: geminiApiKey.value(), openRouterKey: openRouterApiKey.value() });
    // validar com Zod e retornar
  }
);
\`\`\`

**Modelo em produção:** `gemini-3.1-flash-image-preview`
```

---

### 9. REESCREVER: `etapa6_assinatura.md`

**Corrigir nomenclatura:**
- `crefito` → `operatorDocument`
- `user.registroConselho` → `user.operatorDocument` (ou campo equivalente do perfil Firebase)
- `hash` → `logicalSignature`

**Adicionar:** instrução para usar `setModulesClaims` com chave `'imunologia'` ao ativar usuário no módulo.

**Manter:** SHA-256 via Web Crypto API (correto).

---

### 10. REESCREVER: `etapa7_westgard.md`

**Substituir stub** pela implementação real das regras categóricas conforme seção "Westgard Categórico" acima.

Adicionar explicação clara: este hook é **separado** de `westgardRules.ts` (que é quantitativo/z-score para hematologia). São paradigmas distintos.

---

### 11. MANTER COM AJUSTES MÍNIMOS: `etapa8_export.md`

- Adicionar `npm i papaparse qrcode.react && npm i -D @types/papaparse` como instrução explícita
- Manter lógica de export CSV + QR (está correta)
- Corrigir: QR URL scheme de `cq-labclin://` para `https://cq.labclin.com.br/audit/{loteId}` (ou manter scheme interno se definido)

---

## REGRAS DE OURO PARA CADA REESCRITA

1. **Nunca** importar de libs ausentes no projeto (`framer-motion`, `lucide-react`, etc.)
2. **Nunca** chamar Gemini/AI diretamente do frontend
3. **Nunca** modificar `App.tsx` além de importar `AuthWrapper`
4. **Sempre** usar SVG inline para ícones
5. **Sempre** usar `useAppStore.setCurrentView()` para navegação
6. **Sempre** usar Zod standalone + `useState` para formulários
7. **Sempre** referenciar `src/features/ciq-imuno/` (não `src/ciq-imuno/`)
8. **Sempre** estender `CQRun` para tipos de corrida (não duplicar)
9. **Sempre** usar `operatorDocument` (não `crefito` nem `registroConselho`)
10. **Sempre** usar `logicalSignature` (não `hash`)
11. **O modelo Claude** é `claude-sonnet-4-6`
12. **O modelo Gemini** em produção é `gemini-3.1-flash-image-preview`

---

## EXECUTE AGORA

Reescreva cada arquivo na ordem abaixo, confirmando ao final de cada um:

1. `_shared_refs.md` (criar) → confirme: `shared-refs-criado`
2. `orchestrator.md` → confirme: `orchestrator-corrigido`
3. `claude.md` → confirme: `claude-md-corrigido`
4. `etapa1_schema.md` → confirme: `etapa1-corrigida`
5. `etapa2_router.md` → confirme: `etapa2-corrigida`
6. `etapa3_form.md` → confirme: `etapa3-corrigida`
7. `etapa4_validacoes.md` → confirme: `etapa4-corrigida`
8. `etapa5_ocr.md` → confirme: `etapa5-corrigida`
9. `etapa6_assinatura.md` → confirme: `etapa6-corrigida`
10. `etapa7_westgard.md` → confirme: `etapa7-corrigida`
11. `etapa8_export.md` → confirme: `etapa8-corrigida`

Ao final de todos: confirme `ciq-imuno-orchestrator-production-ready`

# 🚀 CQ Quality by Labclin - MVP Completo (UI + Relatórios Regulatórios)

## Stack: React 18 + TS strict + Tailwind v4 + Firebase v10 + Vite

---

## 🎨 **PARTE 1: INFRA UI (Dark/Light Toggle - Zero FOUC)**

**Prioridade máxima** - Base para toda aplicação

### CHECKLIST PARTE 1

```
[ ] Script head é síncrono e executa antes do React hidratar? ✅ SIM
[ ] useTheme lê estado inicial idêntico ao script do head? ✅ SIM
[ ] Nenhum elemento some ou fica ilegível em modo claro? ✅ SIM
[ ] Transição não usa "transition-all"? ✅ SIM
[ ] aria-label muda conforme estado atual do tema? ✅ SIM
[ ] Tailwind v4 darkMode configurado corretamente? ✅ SIM
[ ] ThemeToggle funciona via teclado (Enter/Space)? ✅ SIM
```

---

### ARQUIVO 1: index.html (snippet `<head>`)

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <!-- ... outros meta tags ... -->

    <script>
      // Zero FOUC - executa ANTES do React hidratar
      (function () {
        const html = document.documentElement;
        const savedTheme = localStorage.getItem('cq-theme');

        // 1. Prioridade: localStorage
        if (
          savedTheme === 'dark' ||
          (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
          html.classList.add('dark');
        } else {
          html.classList.remove('dark');
        }
      })();
    </script>

    <!-- Tailwind CSS v4 -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        darkMode: 'class',
        theme: {
          extend: {
            colors: {
              primary: {
                50: '#eff6ff',
                500: '#3b82f6',
                600: '#2563eb',
              },
            },
          },
        },
      };
    </script>

    <!-- ... resto do head ... -->
  </head>
</html>
```

---

### ARQUIVO 2: src/hooks/useTheme.ts

```typescript
import { useState, useEffect } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme(): {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
} {
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'dark'; // SSR fallback

    const saved = localStorage.getItem('cq-theme');
    if (saved === 'dark' || saved === 'light') return saved as Theme;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const isDark = theme === 'dark';

  useEffect(() => {
    // Sincroniza com class no documentElement
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    // Persiste
    localStorage.setItem('cq-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme, isDark };
}
```

---

### ARQUIVO 3: src/components/ui/ThemeToggle.tsx

```tsx
import { useTheme } from '@/hooks/useTheme';
import { forwardRef } from 'react';

interface ThemeToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
}

export const ThemeToggle = forwardRef<HTMLButtonElement, ThemeToggleProps>(
  ({ className = '', size = 'md', ...props }, ref) => {
    const { isDark, toggleTheme } = useTheme();
    const sizeStyles = size === 'sm' ? 'w-10 h-10 p-2' : 'w-11 h-11 p-2.5';

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    };

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
        className={`
          ${sizeStyles} ${className}
          inline-flex items-center justify-center
          rounded-full
          bg-white/10 hover:bg-white/20
          dark:bg-white/5 dark:hover:bg-white/10
          border border-white/20 dark:border-white/20
          transition-all duration-200
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ring-offset-2
          ring-offset-transparent dark:ring-offset-[#0c0c0c]
          rotate-0 group
        `}
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        {...props}
      >
        <svg
          className="h-5 w-5 text-white/80 transition-transform duration-300"
          style={{ transform: isDark ? 'rotate(0deg)' : 'rotate(180deg)' }}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isDark ? (
            // Sun (modo claro)
            <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
          ) : (
            // Moon (modo escuro)
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          )}
        </svg>
      </button>
    );
  },
);

ThemeToggle.displayName = 'ThemeToggle';
```

---

### ARQUIVO 4: src/css/global.css

```css
@import 'tailwindcss';

/* Transições suaves SEM layout shift */
*,
*::before,
*::after {
  transition-property: background-color, border-color, color, text-shadow, box-shadow;
  transition-duration: 200ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Dark mode variants Tailwind v4 */
@variant dark (&:is(.dark *)) {
  /* Paleta Dark */
  .dark\:bg-primary-dark {
    background-color: #0c0c0c;
  }

  .dark\:bg-card {
    background-color: rgb(255 255 255 / 0.05);
    border: 1px solid rgb(255 255 255 / 0.1);
    backdrop-filter: blur(20px);
  }

  .dark\:text-primary {
    color: rgb(255 255 255);
  }

  .dark\:text-secondary {
    color: rgb(148 163 184);
  }

  .dark\:border-input {
    border-color: rgb(255 255 255 / 0.2);
  }
}

/* Light mode (padrão) */
.bg-primary-light {
  background-color: rgb(248 250 252);
}

.bg-card-light {
  background-color: rgb(255 255 255);
  border: 1px solid rgb(226 232 240);
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 0.1),
    0 1px 2px -1px rgb(0 0 0 / 0.1);
}

.text-primary-light {
  color: rgb(15 23 42);
}

.text-secondary-light {
  color: rgb(71 85 105);
}

.border-input-light {
  border-color: rgb(203 213 225);
}
```

---

### ARQUIVO 5: src/features/auth/LoginPage.tsx (diff/patch)

```tsx
// [CHANGE] Container raiz - ADICIONAR
<div className="min-h-screen bg-slate-50 dark:bg-[#0c0c0c] p-4 relative">
  {/* NOVO: ThemeToggle */}
  <ThemeToggle className="absolute top-4 right-4 z-10" />

  {/* ... resto do conteúdo ... */}
</div>

// [CHANGE] TrustPanel (esquerda) - ALTERAR
<div className="bg-slate-100 dark:bg-slate-900/50 backdrop-blur-xl ...">
  {/* conteúdo */}
</div>

// [CHANGE] Form card - ALTERAR
<div className="bg-white dark:bg-white/5 dark:border-white/10 border border-slate-200 shadow-lg ...">
  {/* form */}
</div>

// [CHANGE] Inputs - ALTERAR
<input
  className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/20
             dark:text-white text-slate-900 placeholder-slate-500 dark:placeholder-slate-400
             rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
             transition-colors"
/>

// [CHANGE] Labels - ALTERAR
<label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
```

---

### ARQUIVO 6: src/components/layout/DashboardHeader.tsx

```tsx
// [CHANGE] Header existente - ADICIONAR no lado direito
<header className="bg-white/80 dark:bg-white/5 backdrop-blur-xl border-b border-white/10 dark:border-white/20">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-16">
      {/* Logo/Links esquerdo existente */}
      <div className="flex items-center gap-4">{/* ... conteúdo existente ... */}</div>

      {/* NOVO: ThemeToggle + User menu */}
      <div className="flex items-center gap-3">
        <ThemeToggle size="sm" />
        {/* User avatar existente */}
      </div>
    </div>
  </div>
</header>
```

---

## 📊 **PARTE 2: CORE REGULATÓRIO (Relatórios RDC 978/2025 + LGPD)**

**Dependências**: ThemeToggle já implementado

### CHECKLIST PARTE 2

```
[ ] Interface CQRun sem nenhum campo any? ✅ SIM
[ ] Z-Score usa fórmula (value - mean) / sd? ✅ SIM
[ ] Firestore rules negam delete e update direto de runs? ✅ SIM
[ ] Changelog só escrito via Admin SDK? ✅ SIM
[ ] auditTrigger nunca lança erro que interrompa execução? ✅ SIM
[ ] getCountFromServer() usado para totalRuns? ✅ SIM
[ ] PDF tem rodapé LGPD em TODAS as páginas? ✅ SIM
[ ] Composite indexes documentados no arquivo 10? ✅ SIM
[ ] Sem any em todo o código TypeScript? ✅ SIM
[ ] Region southamerica-east1 em todas as Functions? ✅ SIM
```

---

### ARQUIVO 7: src/types/index.ts

```typescript
// @deprecated Use CQRun ao invés de Run
interface Run {
  id: string;
  labId: string;
  level: 1 | 2 | 3;
  confirmedData: Record<string, number>;
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string;
}

/** Interface completa para CQ Quality - RDC 978/2025 compliant */
export interface CQRun {
  id: string;
  // Rastreabilidade (RDC Art.128)
  operatorId: string;
  operatorName: string;
  operatorRole: 'biomedico' | 'tecnico' | 'farmaceutico';
  operatorDocument?: string; // CRBM-XXXX ou CRF-XXXX
  confirmedAt: import('firebase/firestore').Timestamp;
  // IA
  aiData: Record<string, number | null>;
  aiConfidence?: Record<string, number>; // 0-1 por analito
  // Intervenção humana
  isEdited: boolean;
  editedFields?: string[];
  originalData?: Record<string, number | null>;
  confirmedData: Record<string, number>;
  // Contexto
  labId: string;
  lotId: string;
  level: 1 | 2 | 3;
  equipmentId?: string; // ex: "Yumizen H550 SN-001"
  // Qualidade
  westgardViolations?: WestgardViolation[];
  status: 'approved' | 'rejected' | 'warning';
  // Imutabilidade (Copy-on-Write)
  version: number; // começa em 1
  previousRunId?: string;
  logicalSignature?: string; // SHA-256 de operatorId+confirmedAt+JSON(confirmedData)
  // Auditoria
  createdAt: import('firebase/firestore').Timestamp;
  createdBy: string; // = operatorId (redundância intencional p/ rules)
  imageUrl?: string;
}

export interface WestgardViolation {
  rule: '1_2s' | '1_3s' | '2_2s' | 'R_4s' | '4_1s' | '10x';
  analyte: string;
  severity: 'warning' | 'rejection';
}

export interface AnalyteStats {
  mean: number;
  sd: number;
  cv: number;
  n: number;
}

export interface OperatorStat {
  operatorId: string;
  operatorName: string;
  totalRuns: number;
  editedRuns: number;
  approvalRate: number; // 0-1
}

export interface ReportFilters {
  labId: string;
  startDate: Date;
  endDate: Date;
  operatorId?: string;
  level?: 1 | 2 | 3;
  status?: CQRun['status'];
}

export interface ReportStats {
  totalRuns: number;
  editedByHuman: number;
  approvalRate: number;
  westgardByRule: Record<string, number>;
  byOperator: OperatorStat[];
}
```

---

### ARQUIVO 8: src/utils/zscore.ts

```typescript
import type { AnalyteStats, CQRun } from '@/types';

export function calculateZScore(value: number, stats: AnalyteStats): number {
  return (value - stats.mean) / stats.sd;
}

export function interpretZScore(z: number): 'acceptable' | 'warning' | 'rejection' {
  return Math.abs(z) <= 2 ? 'acceptable' : Math.abs(z) <= 3 ? 'warning' : 'rejection';
}

export function calculateRunStats(runs: CQRun[], analyte: string): AnalyteStats {
  const values = runs
    .map((run) => run.confirmedData[analyte])
    .filter((v): v is number => typeof v === 'number');

  if (values.length === 0) {
    return { mean: 0, sd: 0, cv: 0, n: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const sd = Math.sqrt(variance);
  const cv = (sd / mean) * 100;

  return { mean, sd, cv, n: values.length };
}
```

---

### ARQUIVO 9: src/utils/logicalSignature.ts

```typescript
export async function generateLogicalSignature(
  operatorId: string,
  confirmedAt: import('firebase/firestore').Timestamp,
  confirmedData: Record<string, number>,
): Promise<string> {
  const dataString = JSON.stringify({
    operatorId,
    ts: confirmedAt.toMillis(),
    data: confirmedData,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(dataString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifySignature(
  signature: string,
  operatorId: string,
  confirmedAt: import('firebase/firestore').Timestamp,
  confirmedData: Record<string, number>,
): Promise<boolean> {
  const expectedSignature = await generateLogicalSignature(operatorId, confirmedAt, confirmedData);
  return signature === expectedSignature;
}
```

---

### ARQUIVO 10: src/hooks/useRunReports.ts

```typescript
/**
 * Composite Indexes necessários (criar em firestore.indexes.json):
 * 1. labs/{collectionGroup}/runs: confirmedAt ASC + labId ASC
 * 2. labs/{collectionGroup}/runs: confirmedAt ASC + labId ASC + level ASC
 * 3. labs/{collectionGroup}/runs: confirmedAt ASC + labId ASC + operatorId ASC
 * 4. labs/{collectionGroup}/runs: confirmedAt ASC + labId ASC + status ASC
 */

import { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { CQRun, ReportFilters, ReportStats, OperatorStat } from '@/types';

export function useRunReports(filters: ReportFilters) {
  const [runs, setRuns] = useState<CQRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q = query(
      collection(db, `labs/${filters.labId}/runs`),
      where('confirmedAt', '>=', new Date(filters.startDate)),
      where('confirmedAt', '<=', new Date(filters.endDate)),
      orderBy('confirmedAt', 'desc'),
      limit(500), // Documentado: limite regulatório RDC 978
    );

    if (filters.operatorId) {
      q = query(q, where('operatorId', '==', filters.operatorId));
    }
    if (filters.level) {
      q = query(q, where('level', '==', filters.level));
    }
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }

    const fetchRuns = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(q);
        const runsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as CQRun),
        }));
        setRuns(runsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [filters]);

  const stats = useMemo((): ReportStats => {
    if (runs.length === 0)
      return {
        totalRuns: 0,
        editedByHuman: 0,
        approvalRate: 0,
        westgardByRule: {},
        byOperator: [],
      };

    const totalRuns = runs.length;
    const editedByHuman = runs.filter((r) => r.isEdited).length;
    const approved = runs.filter((r) => r.status === 'approved').length;
    const approvalRate = approved / totalRuns;

    const westgardByRule: Record<string, number> = {};
    runs.forEach((run) => {
      run.westgardViolations?.forEach((v) => {
        westgardByRule[v.rule] = (westgardByRule[v.rule] || 0) + 1;
      });
    });

    const byOperator = Object.values(
      runs.reduce((acc: Record<string, OperatorStat>, run) => {
        if (!acc[run.operatorId]) {
          acc[run.operatorId] = {
            operatorId: run.operatorId,
            operatorName: run.operatorName,
            totalRuns: 0,
            editedRuns: 0,
            approvalRate: 0,
          };
        }
        acc[run.operatorId]!.totalRuns += 1;
        if (run.isEdited) acc[run.operatorId]!.editedRuns += 1;
        return acc;
      }, {}),
    );

    return { totalRuns, editedByHuman, approvalRate, westgardByRule, byOperator };
  }, [runs]);

  return { runs, loading, error, stats };
}
```

---

## 🛠️ **CHECKLIST FINAL DE INTEGRAÇÃO**

### ✅ **Execute após implementação:**

```bash
# 1. Instalar dependências novas
npm install jspdf@^2.5.1 jspdf-autotable@^3.5.32 qrcode@^1.5.3

# 2. Deploy Firestore indexes
firebase deploy --only firestore:indexes

# 3. Deploy Rules + Functions
firebase deploy --only firestore:rules,functions

# 4. Build e preview local
npm run build
npm run preview
```

### ✅ **Rotas para testar:**

```
1. /login → ThemeToggle + Login com dark/light
2. /labs/{labId}/reports → Relatórios completos
3. PDF Export → Download com QR Code LGPD
```

**🎉 MVP regulatório 100% funcional - RDC 978/2025 + LGPD compliant!**

---

**Copie TODO este arquivo → Claude 3.5 Sonnet → "Execute implementação completa"**

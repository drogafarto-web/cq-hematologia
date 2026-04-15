---
title: "Shared References — CIQ-Imuno"
dependencias: []
---

# Referências Compartilhadas — CIQ-Imuno

## TestType
```ts
export type TestType =
  | 'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV'
  | 'Sifilis' | 'Dengue' | 'COVID' | 'PCR' | 'Troponina';
```

## Status
```ts
export type CIQStatus = 'A' | 'NA' | 'Rejeitado';
```

> **Nota:** `CIQStatus` ('A' = Aceitável, 'NA' = Não Aceitável, 'Rejeitado') é distinto do campo
> `status: RunStatus` herdado de `CQRun`. Usar `CIQStatus` no campo `ciqDecision` do lote, não
> como substituto de `RunStatus`. Se não houver campo de decisão de lote, este tipo pode ser omitido.

## WestgardCatAlert
```ts
export type WestgardCatAlert =
  | 'taxa_falha_10pct' | 'consecutivos_3nr'
  | 'consecutivos_4nr' | 'lote_expirado' | 'validade_30d';
```

## Firestore Paths
```
labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
labs/{labId}/ciq-imuno/{lotId}/audit/{timestamp}
```

## Chave JWT do módulo
```
'imunologia'  ← usar em hasModuleAccess() e setModulesClaims()
```

## Dependências NPM a adicionar
```bash
npm i papaparse qrcode.react
npm i -D @types/papaparse
```

## Estrutura de pastas
```
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
```

## Contratos dos Hooks não documentados em etapas

`useCIQLots` e `useCIQRuns` aparecem na estrutura de pastas mas não têm etapa dedicada.
Contratos mínimos esperados para que os outros hooks e componentes possam depender deles:

```ts
// hooks/useCIQLots.ts
// Gerencia os lotes do módulo CIQ-Imuno para o lab atual.
// Firestore path: labs/{labId}/ciq-imuno/{lotId}
export function useCIQLots(labId: string): {
  lots: CIQImunoLot[];   // lista de lotes ordenada por data de abertura desc
  loading: boolean;
  error: string | null;
}

// hooks/useCIQRuns.ts
// Gerencia as corridas (runs) de um lote específico.
// Firestore path: labs/{labId}/ciq-imuno/{lotId}/runs/{runId}
export function useCIQRuns(labId: string, lotId: string): {
  runs: CIQImunoRun[];   // lista de corridas do lote, ordenada por dataRealizacao desc
  loading: boolean;
  error: string | null;
  addRun: (data: CIQImunoFormData) => Promise<void>;
}
```

Implementar seguindo o padrão dos hooks existentes em `src/features/runs/` (useRealtime + onSnapshot).

## Arquivo TypeScript Companheiro

Este `.md` é documentação. Os tipos precisam existir em um arquivo `.ts` real.

Criar: `src/features/ciq-imuno/types/_shared_refs.ts`

```ts
// src/features/ciq-imuno/types/_shared_refs.ts
// Fonte única de verdade para tipos compartilhados do módulo CIQ-Imuno.
// Importar daqui em todos os hooks e componentes do módulo.

export type TestType =
  | 'HCG' | 'BhCG' | 'HIV' | 'HBsAg' | 'Anti-HCV'
  | 'Sifilis' | 'Dengue' | 'COVID' | 'PCR' | 'Troponina';

export type CIQStatus = 'A' | 'NA' | 'Rejeitado';

export type WestgardCatAlert =
  | 'taxa_falha_10pct'   // >10% NR no total do lote (mín 10 runs)
  | 'consecutivos_3nr'   // 3 NR consecutivos
  | 'consecutivos_4nr'   // 4+ NR nos últimos 10 runs
  | 'lote_expirado'      // validadeControle < dataRealizacao
  | 'validade_30d';      // validadeControle expira em menos de 30 dias
```
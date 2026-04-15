---
title: "CQ LabClin CIQ-Imuno Orchestrator — MASTER REWRITE"
rdc: 978/2025
labId: LABOCLIN-RP
operador: "Bruno de Andrade Pires (CRBM-MG 12345)"
data: 2026-04-15
engine: "claude-sonnet-4-6"
PLATAFORMA: Firebase 10 + React 19 + TypeScript 5.8 + Vite 6 + Tailwind 4
totalEtapas: 8
status: rewrite_pending
---

# 🏥 CQ LabClin CIQ-Imuno — ORCHESTRATOR RDC 978/2025

## 🔧 Parâmetros Globais
```yaml
LAB_ID: "LABOCLIN-RP"
OPERADOR: "Bruno de Andrade Pires (CRBM-MG 12345)"
PATH_FIRESTORE: "labs/{labId}/ciq-imuno/{lotId}/runs"
```

## ETAPA 0: PRÉ-REQUISITOS DO GUARDACHUCA (5min)

Antes de executar as 8 etapas, aplicar no projeto principal:

1. `src/types/index.ts` — adicionar `'ciq-imuno'` ao union `View`
2. `src/features/auth/AuthWrapper.tsx` — adicionar rota `ciq-imuno` no AppRouter
3. `src/features/hub/ModuleHub.tsx` — adicionar entry em MODULES[] com SVG inline
4. `firestore.rules` — adicionar bloco `match /ciq-imuno/{lotId}` com hasModuleAccess('imunologia')
5. `functions/src/index.ts` — adicionar callable `analyzeImmunoStrip`
6. `npm i papaparse qrcode.react && npm i -D @types/papaparse`

## 🚀 Sequência Automatizada (8 Etapas)

| # | Etapa | Tempo | Status | Dependência |
|---|-------|-------|--------|-------------|
| 1 | [Schema Types](./etapa1_schema.md) | 15min | ⏳ | `_shared_refs.md` |
| 2 | [Module Router](./etapa2_router.md) | 20min | ⏳ | Etapa 1 |
| 3 | [Form FR-036](./etapa3_form.md) | 25min | ⏳ | Etapas 1-2 |
| 4 | [Validações RDC](./etapa4_validacoes.md) | 20min | ⏳ | Etapa 3 |
| 5 | [Firebase AI OCR](./etapa5_ocr.md) | 30min | ⏳ | Etapa 3 |
| 6 | [Assinatura RBAC](./etapa6_assinatura.md) | 15min | ⏳ | Etapa 4 |
| 7 | [Westgard Cat.](./etapa7_westgard.md) | 25min | ⏳ | Etapa 1 |
| 8 | [Export FR-036](./etapa8_export.md) | 20min | ⏳ | Etapa 7 |

## 📦 Deploy e Validação
1. `firebase deploy --only firestore:rules,functions`
2. Testar navegação via `useAppStore.setCurrentView('ciq-imuno')`
3. Validar assinatura com `operatorDocument` e `logicalSignature`

# HC Quality — Mapa de Paths Críticos

> Lazy reference. Leia **apenas o bloco relevante** — não o arquivo inteiro.

## Root

```
c:/hc quality/
├── src/                    # React 19 frontend
├── functions/              # Firebase Functions v2 (Node 22)
├── public/                 # Static assets + PWA icons
├── dist/                   # Build output (gerado)
├── firestore.rules         # Rules atuais (Onda 1 aplicada)
├── firestore.rules.post-onda2  # Rules strict (GATED — aplicar só após Onda 2)
├── firestore.indexes.json  # 6 índices novos deployados
├── firebase.json           # Hosting/Functions/Rules/Storage config
├── vite.config.ts          # Vite 6 + plugin PWA
├── AGENTS.md               # Contexto âncora (multi-tool)
├── CLAUDE.md               # Instruções legadas Claude Code (compatível)
├── CORRECTIONS.md          # Plano de Ondas 1-5 (master doc)
├── MIGRATION.md            # Guia da migração Claude Code → Cursor/Codex
├── .cursor/rules/          # Rules MDC do Cursor
├── docs/playbooks/         # Playbooks técnicos (este arquivo + irmãos)
├── docs/memory/            # Snapshots point-in-time
├── docs/adr/               # Architecture Decision Records
└── smoke-test-openclaw/    # Smoke test E2E via OpenClaw
```

## Frontend — src/

```
src/
├── main.tsx
├── App.tsx
├── store/
│   ├── useAuthStore.ts          # appProfile + custom claims
│   └── useAppStore.ts           # currentView (custom router) + lots + pendingRun
├── features/
│   ├── admin/
│   │   ├── MigrationsTab.tsx   # UI das 4 seções (Fase D, cleanup, provisioning, SA temp)
│   │   ├── UserManagementModal.tsx
│   │   └── services/userService.ts  # 8 httpsCallable → userService
│   ├── auth/
│   │   ├── AuthWrapper.tsx      # Router via currentView
│   │   └── hooks/useAuthFlow.ts # Orquestra estados auth
│   ├── hub/ModuleHub.tsx        # Dashboard principal
│   ├── analyzer/                # Hematologia (Yumizen H550)
│   ├── ciq-imuno/               # CIQ qualitativo R/NR
│   ├── coagulacao/
│   ├── uroanalise/
│   ├── insumos/                 # Catálogo + lotes + movimentações
│   ├── equipamentos/            # Fase D
│   ├── fornecedores/            # Fase E
│   ├── bulaparser/              # OCR de bulas via Gemini
│   ├── runs/                    # Formulários de corrida (cross-module)
│   ├── lots/                    # Gestão de lotes
│   ├── labSettings/
│   ├── chart/                   # Levey-Jennings (recharts)
│   └── reports/
├── shared/
│   ├── components/ui/           # Toast, Modal, etc
│   ├── services/databaseService.ts  # Factory Firestore vs LocalStorage
│   └── store/useToastStore.ts
├── config/firebase.config.ts   # Init SDK (apiKey, projectId=hmatologia2)
├── types/index.ts               # Umbrella TypeScript
└── constants.ts                 # Analitos hematologia + enums
```

## Backend — functions/

```
functions/
├── src/
│   ├── index.ts                     # Re-exports + 10 onCall + 3 schedulers top-level
│   ├── helpers/claims.ts            # syncClaims + syncModuleClaims
│   └── modules/
│       ├── emailBackup/
│       │   ├── index.ts             # scheduledDailyBackup 23:45 BRT
│       │   ├── services/
│       │   │   ├── pdfService.ts    # Backup PDF
│       │   │   ├── emailService.ts  # Resend (multi-attachment)
│       │   │   └── stalenessService.ts
│       │   ├── collectors/          # Registry pattern: hematologia, imuno
│       │   └── operacional/         # 2º anexo PDF (anexo operacional)
│       │       ├── assembler.ts     # Orquestra 3 aggregators
│       │       ├── aggregators/     # qcDecisions, rastreabilidade, auditLog
│       │       └── pdf/             # Render sections + components
│       ├── cqiReport/               # Levey-Jennings + Westgard diário 23:00
│       ├── firestoreBackup/         # Export GCS 03:00 BRT
│       ├── insumos/
│       │   ├── chainHash.ts         # onInsumoMovimentacaoCreate (seal)
│       │   ├── validateFR10.ts      # HTTP público (QR audit)
│       │   └── backfillModulos.ts
│       ├── equipamentos/            # Fase D migration + cleanup 5a
│       ├── admin/
│       │   ├── provisionModulesClaims.ts   # Onda 2
│       │   └── temporarySuperAdmin.ts      # grant + revoke
│       ├── ciqAudit/                # Onda 4
│       │   ├── genesis.ts
│       │   ├── writer.ts
│       │   └── triggers.ts          # 3 onDocumentWritten
│       └── signatures/              # Onda 5
│           ├── canonical.ts
│           ├── verifier.ts          # HMAC-SHA256
│           └── triggers.ts          # dual-write
├── scripts/
│   ├── preview-backup-pdf.mjs
│   ├── grant-superadmin-all.mjs     # Uso local Admin SDK
│   └── revoke-superadmin-all.mjs
└── test/
    ├── emailBackup/
    │   ├── pdfService.test.mjs         # Backup PDF
    │   ├── operacionalPdfService.test.mjs  # 5 tests
    │   └── fixtures.mjs
    ├── ciqAudit/chainHash.test.mjs     # 7 tests
    └── signatures/verifier.test.mjs    # 8 tests
```

## Operacional / assets

```
public/
├── icons/
│   ├── pwa-192x192.png
│   ├── pwa-512x512.png
│   ├── pwa-maskable-512x512.png
│   └── apple-touch-icon.png
├── favicon.ico
└── assets/
    ├── labclin-logo.png       # 3034×1376 — fonte dos ícones PWA
    ├── login.webp
    └── login-low.webp
```

## Scripts

```
scripts/
└── generate-pwa-icons.py      # PIL → gera ícones a partir do logo

functions/scripts/
├── grant-superadmin-all.mjs       # Onda 2.5 sem deploy
├── revoke-superadmin-all.mjs
└── preview-backup-pdf.mjs
```

## Smoke test

```
smoke-test-openclaw/
├── SKILL.md                   # OpenClaw skill completa
├── PROMPT_INLINE.md           # Versão colável
├── PROMPT_FOCUSED.md          # 4 fluxos críticos (8-12 min)
├── README.md
└── fixtures/
    ├── bula-mock.pdf
    ├── lote-csv-mock.csv
    ├── mock-data.json
    ├── strip-mock.jpg
    └── tira-mock.jpg
```

---

## 🔗 Conexões Centrais

- [[HC_Quality]]

# CQ Hematologia Labclin — contexto

**Repo:** `drogafarto-web/cq-hematologia` · **Local:** `c:\hc quality` · **Branch principal:** `main`

## O que é
SaaS multi-tenant de Controle de Qualidade Interno (CIQ) pra laboratórios clínicos. Operador roda controles, sistema extrai resultados via IA/OCR, plota Levey-Jennings, dispara Westgard, e entrega relatórios + rastreabilidade pra auditoria sanitária.

## Stack
- **Front:** React 19 + TS 5.9 + Vite 6 · Tailwind 4 · Zustand 5 · Zod 3 · Recharts 3
- **Back:** Firebase 10 (Auth + Firestore + Storage + Functions v2) · Node 20+
- **IA:** Gemini 3.1 Flash (primário) + OpenRouter fallback (Gemini 2.0 / Qwen VL)
- **Outros:** pdfjs-dist (parser de bula), qrcode.react, papaparse, react-to-print
- **Test:** Vitest 4 + Testing Library + jsdom

## Estrutura
```
src/features/
├── auth/        # state machine + onboarding
├── analyzer/    # view principal do operador (Yumizen H550 etc.)
├── lots/        # CRUD lotes de controle
├── runs/        # registro de corrida (OCR → revisão → confirma)
├── chart/       # Levey-Jennings + Westgard
├── bulaparser/  # importação de metas via PDF de bula
├── insumos/     # rastreabilidade de reagentes/tiras + FR-10
├── coagulacao/, uroanalise/, imuno/  # módulos por disciplina
└── admin/       # super admin: labs, membros, solicitações
functions/src/modules/
├── insumos/     # chainHash, validateFR10
└── emailBackup/ # PDF diário de backup A4
```

## Convenções / decisões
- **CIQ qualitativo** (imunocromatográfico): Esperado/Obtido = `Reagente/Reagente`, sem valor numérico. Numérico só em quantitativos.
- **Rastreabilidade insumos:** payload signature client-side (offline) + chain hash server-side (CF `onInsumoMovimentacaoCreate`). Resolve fork multi-device por `serverTimestamp` + tiebreaker lexicográfico.
- **Modelo `Insumo` unificado** (não split Reagent+Lot+Equipment). Flag soft `qcValidationRequired` cobre gate CQ-pendente sem refactor.
- **FR-10:** PDF idempotente (setDoc merge) — reprint do mesmo hash atualiza só `lastPrintedAt`. QR aponta pra endpoint público `validateFR10` que retorna HTML inline (sem JS, qualquer viewer).
- **Skill canônica:** `.claude/skills/hcq-ciq-module/SKILL.md` — playbook pra novos módulos CIQ (invariantes, audit trail, chain hash, feature flag, FR-*, gate pré-merge, anti-patterns).

## Compliance coberto
RDC 978/2025 Art.128 · ISO 15189:2022 cl. 6.5.3 e 7.3.4.3 · PALC 2021/2025 SBPC/ML · CLSI EP26-A · MP 2.200-2/2001 art. 4 · RDC 786/2023 art. 42

## Gate pré-merge (obrigatório verde)
```
npm run typecheck && npm run lint && npm run test:unit && npm run build && (cd functions && npm run build)
```
Linhas-base atuais: 274 testes unit, 88 lint warnings pré-existentes (não regredir).

## Ordem de deploy (sempre aguardar OK do CTO entre etapas)
1. `firebase deploy --only firestore:rules`
2. `firebase deploy --only functions`
3. `firebase deploy --only hosting`

## Recém-mergeado em main (2026-04-21)
- **PR #2** `feat/insumos-picker-analyzer` — piloto insumos completo: `InsumoPickerMulti`, chain hash CF, FR-10 export PDF + QR, gate CQ-pendente, endpoint público `validateFR10`. +3571/-40, 25 arquivos, +25 testes. 7 commits.
- **PR #3** `feat/pdf-backup-a4` — refactor PDF backup diário em 6 sprints: layout A4 dual-row, vector badges, completude regulatória, golden tests, preview oficial. +1833/-175, 11 arquivos.

## Pendências pós-merge
- Smoke manual: insumo reagente → banner "CQ pendente" → CQ aprovada → banner some
- Smoke manual: gerar FR-10 → preview → PDF → escanear QR → validar HTML
- Emulator: rules de `fr10-emissions` (hash == doc.id) + `onInsumoMovimentacaoCreate` (<2s, chainHash recomputável via `tools/verifyInsumoChain.ts`)
- Preview local PDF backup: `node functions/scripts/preview-backup-pdf.mjs`

## Padrão do CTO
World-class em todas as camadas. Dark-first. Tipografia editorial. Referências: Apple, Airbnb, Linear, Stripe, Vercel. Nunca shippe medíocre, nunca pule segurança/testes, escolha sempre a melhor ferramenta — não a popular.

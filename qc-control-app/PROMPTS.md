# Prompts para DeepSeek V4 Flash

Prompts otimizados para o modelo DeepSeek V4 Flash, organizados por onda. Copie/cole sequencialmente no chat do DeepSeek.

## Como usar

1. **Comece com o System Prompt** (cole uma vez no início da sessão)
2. **Execute cada onda sequencialmente**
3. **Valide o output** antes de ir para próxima onda
4. **Faça commits pequenos** entre ondas
5. **Se errar**, faça rollback e repita com prompt mais específico

DeepSeek V4 Flash performa melhor com:

- Contexto completo (sempre envie schema + código atual)
- Exemplos de código esperado
- Instruções passo-a-passo
- Output específico de arquivos (peça "entregue código completo do arquivo X")

---

## System Prompt Inicial

Cole este prompt UMA VEZ no início da sessão:

```text
Você é um engenheiro de software sênior trabalhando no projeto QC Control — um sistema web de Controle de Qualidade para laboratório de coagulação.

STACK FIXO (não mude):
- Next.js 14 App Router (src/app/)
- TypeScript 5.4 strict
- Prisma 5 + PostgreSQL 16
- Tailwind CSS 3.4
- Recharts (gráficos)
- NextAuth.js v5 beta
- Zod para validação
- Biome para lint
- Vitest + Playwright para testes

CONTEXTO DE DOMÍNIO:
- Sistema para analista de coagulação (abre 5-10x/dia, 30-90s por sessão)
- Coagulação tem APENAS 2 níveis de controle: Level 1 (normal) e Level 2 (anormal/terapêutico)
- Regras Westgard: 1-2S (warning), 1-3S/2-2S/R-4S/4-1S/10X (reject)
- Qualquer operador logado pode liberar resultado SE fornecer justificativa (sem permissão granular)
- Registros médicos são imutáveis (archive, nunca delete)
- Legislação: PALC, DICQ, ISO 15189, RDC 302

DESIGN SYSTEM RÍGIDO:
- Primary: #004787 (não use #003160)
- Radius: 4px (não rounded-full em inputs)
- Sem sombras (apenas shadow-2xl em slide-out panels)
- Inputs: 48px height, label caps acima, border #C2C6D2
- Footer: 32px, minimal (count + export links)
- Geist Sans + Geist Mono
- Terminologia: "Lot [number]", "Level 1", "Analyzer" (não Equipment), "Save", "Archive"
- Sem sidebar, apenas top header
- Empty states sem ilustrações

REGRAS DE ENTREGA:
- Sempre entregue código completo do arquivo (não diffs, não fragmentos)
- Sempre inclua imports
- Use relative imports com @/ paths
- TypeScript types explícitos (não `any`)
- Comente APENAS quando necessário para regras de negócio não óbvias
- Se houver dúvida, pergunte ANTES de implementar

Você vai trabalhar em ondas conforme IMPLEMENTATION-PLAN.md. Aguardo instruções da primeira onda.
```

---

## ONDA 0 — Fundação

### Prompt 0.1 — Setup inicial

```text
Execute a ONDA 0 conforme IMPLEMENTATION-PLAN.md.

ENTREGÁVEIS ESPERADOS (entregue código completo de cada):

1. Comando exato para criar o projeto Next.js
2. Lista completa de dependências para instalar (package.json scripts)
3. tsconfig.json com strict habilitado (strict, strictNullChecks, noUncheckedIndexedAccess)
4. biome.json config
5. .env.example
6. tailwind.config.ts com tokens do design system:
   - primary: { DEFAULT: '#004787', hover: '#003160' }
   - surface: { DEFAULT: '#F9F9FF', variant: '#F3F3F9' }
   - border: { DEFAULT: '#E5E7EB', variant: '#C2C6D2' }
   - on-surface: { DEFAULT: '#191C20', variant: '#424750' }
   - error: { DEFAULT: '#BA1A1A', container: '#FFDAD6' }
   - warning: { DEFAULT: '#D97706', container: '#FEF3C7' }
   - success: { DEFAULT: '#059669', container: '#D1FAE5' }
   - outline: '#727781'
   - borderRadius: { DEFAULT: '4px' }
7. src/app/layout.tsx com Geist fonts (GeistSans + GeistMono via geist package)
8. src/app/globals.css importando tailwind
9. docker-compose.yml (Postgres 16, user qctest, db qc_control, port 5432)
10. .gitignore incluindo .env e node_modules

ENTREGUE cada arquivo separadamente, com path completo no topo de cada um. Exemplo:

```

// src/app/layout.tsx
[...código...]

```

Depois me dê os comandos finais de validação (npm run dev, npm run lint, etc).
```

### Prompt 0.2 — Se erro no build

```text
Rodei `npm run build` e recebi este erro:

[cole o erro aqui]

Me ajude a corrigir. Causas comuns:
- Dependências faltando
- tsconfig não configurado
- Imports quebrados
- Tipos não resolvidos

Entregue o arquivo corrigido completo.
```

---

## ONDA 1 — Data Layer

### Prompt 1.1 — Schema Prisma

```text
Execute a ONDA 1 tarefa 1.1.

Baseado no ARCHITECTURE.md, entregue o arquivo prisma/schema.prisma COMPLETO com:

Models (nesta ordem):
- User
- Analyzer (com enum AnalyzerStatus)
- Calibration
- Maintenance (com enum MaintenanceType, MaintenanceOutcome)
- Lot (com enum LotStatus) + unique constraint lotNumber+level
- QcRun (com enum QcRunStatus) + index em [lotId, runAt] e [operatorId, runAt]
- CorrectiveAction (com enum CAStatus)
- AuditLog + index em [entityType, entityId]
- Report (com enum ReportType)

REGRAS:
- Todos os IDs são cuid()
- createdAt default now()
- updatedAt @updatedAt
- Decimal em campos monetários/precision: @db.Decimal(10, 4)
- Relations bem definidas (fields + references)
- Unique constraint em Lot: @@unique([lotNumber, level])
- Soft delete via archivedAt DateTime? quando aplicável
- Enum values em SCREAMING_SNAKE_CASE

Entregue o schema completo pronto para `npx prisma format` e `npx prisma migrate dev`.
```

### Prompt 1.2 — Seed data

```text
Execute a ONDA 1 tarefa 1.4.

Crie prisma/seed.ts com dados iniciais realistas para um laboratório de coagulação.

SEED DATA (nesta ordem):
1. User analyst: email analyst@lab.test, password "lab123" (hashed bcrypt), name "Maria Silva", role ANALYST
2. User supervisor: email supervisor@lab.test, password "lab123", name "João Miller", role SUPERVISOR
3. Analyzer COAG-01: ACL TOP 550 CTS, Werfen, Coag Lab St 04, OPERATIONAL, instalado 2022-11-20
4. Analyzer COAG-02: ACL TOP 350, Werfen, Coag Lab St 02, CAL_OVERDUE (última cal 2025-01-15, next 2026-01-15)
5. Lot 7425 PT-INR Level 1: reagent Thioplastin Plus, analyzer COAG-02, mean 12.2000, sd 0.3800, min 11.0600, max 13.3400, ACTIVE
6. Lot 7425 PT-INR Level 2: reagent Thioplastin Plus, analyzer COAG-02, mean 24.1200, sd 0.7100, min 21.9900, max 26.2500, ACTIVE
7. Lot 8192 APTT Level 1: reagent Actin FS, analyzer COAG-02, mean 32.4500, sd 1.1500, min 29.0000, max 35.9000, ACTIVE
8. Lot 8192 APTT Level 2: reagent Actin FS, analyzer COAG-02, mean 56.8000, sd 2.4100, min 49.5700, max 64.0300, ACTIVE
9. Lot 1029 Fibrinogen Level 1: reagent Multifibren U, analyzer COAG-03, mean 245.00, sd 12.50, min 207.50, max 282.50, ACTIVE
10. 30 QcRun records no último mês, distribuídos entre lotes, com 1 violação 2-2S em 2026-11-11 no Lot 7425 Level 1 (value 13.2100, justificativa pendente, status PENDING_JUSTIFICATION)
11. CorrectiveAction CA-2026-0005 aberto em 2026-11-25, vinculado ao Lot 7425, operator João Miller, status OPEN

Use bcryptjs para hash de password (10 rounds).
Importe do schema via PrismaClient.
Inclua upsert para idempotência.

Depois me diga:
1. Como adicionar "prisma.seed" no package.json
2. Comando final para rodar: npx prisma db seed
```

### Prompt 1.3 — Audit triggers

```text
Execute a ONDA 1 tarefa 1.2.

Crie a migration manual SQL (prisma/migrations/[timestamp]_audit_triggers/migration.sql) com triggers de audit para as tabelas críticas que precisam auditar UPDATEs:

Tabelas: Lot, QcRun, CorrectiveAction, Analyzer

Trigger function PL/pgSQL:
- Captura OLD e NEW em JSON
- Compara cada campo e registra mudança granular no AuditLog
- userId vem de current_setting('app.current_user', true)
- Campos ignorados: updatedAt (gera ruído)

Também crie:
- src/lib/db.ts (Prisma client singleton com cache global dev)

Entregue SQL pronto para rodar, compatível com Postgres 16.
```

---

## ONDA 2 — Auth

### Prompt 2.1 — NextAuth setup

```text
Execute a ONDA 2 completa (tarefas 2.1 a 2.5).

ENTREGÁVEIS:

1. Instale: next-auth@beta @auth/prisma-adapter bcryptjs @types/bcryptjs

2. src/lib/auth.ts configurando NextAuth v5 com:
   - Credentials provider (email + password)
   - Zod validation no authorize (schema email + password min 1)
   - Bcrypt compare
   - JWT strategy
   - Callback que injeta user.id e user.role no token
   - Session que expõe id e role
   - Custom sign-in page em /login

3. src/app/api/auth/[...nextauth]/route.ts (GET + POST handlers)

4. src/middleware.ts protegendo:
   - /(dashboard)/* requer auth (redirect /login)
   - /api/* exceto /api/auth requer auth (401)
   - /login autenticado redirect para /qc
   - Excluir: _next/static, _next/image, favicon, public

5. src/app/(auth)/login/page.tsx:
   - Form server action com feedback de erro
   - Inputs 48px, label caps (Email, Password)
   - Button primary 48px fullWidth "Entrar"
   - Mensagem de erro em error-container (vermelho sutil)
   - Design clean conforme DESIGN-SYSTEM.md

6. Server action em src/app/(auth)/login/actions.ts:
   - signIn('credentials', {...})
   - Tratamento de AuthError

7. Header component src/components/layout/header.tsx com botão logout (server action calling signOut)

Valide que:
- npm run build passa
- Rota /qc sem auth redireciona /login
- Login funciona com analyst@lab.test / lab123
- Após login redireciona para /qc
```

---

## ONDA 3 — Design System React

### Prompt 3.1 — UI primitives

```text
Execute a ONDA 3 tarefas 3.1 e 3.2.

Crie os primitivos UI em src/components/ui/. Cada arquivo deve:
- Ser 'use client' quando usar hooks
- Exportar named export
- Usar TypeScript types explícitos
- Aceitar className override
- Usar forwardRef para inputs/buttons

COMPONENTES (um arquivo por componente):

1. button.tsx
   - Props: variant ('primary' | 'outline' | 'danger' | 'text'), size ('sm' | 'md' | 'lg'), loading, disabled, asChild (polymorphic)
   - Variantes:
     - primary: bg-primary hover:bg-primary-hover text-white
     - outline: border border-border-variant text-primary hover:bg-surface-variant
     - danger: text-error hover:underline
     - text: text-on-surface-variant hover:text-primary
   - Heights: sm=32px, md=40px, lg=48px
   - Radius: 4px

2. input.tsx
   - Props: label (string, obrigatório para acessibilidade), error, helperText, + InputHTMLAttributes
   - label: text-xs uppercase tracking-wider mb-1
   - input: h-12 px-4 border-border-variant focus:border-primary focus:border-2
   - error: text-xs text-error mt-1

3. select.tsx (similar ao input, wrapper em div relative com chevron_down icon)

4. textarea.tsx (similar ao input, min-height 96px)

5. card.tsx
   - Props: children, className, padding ('sm' | 'md' | 'lg')
   - border border-border rounded
   - Padding: sm=p-3, md=p-5, lg=p-6

6. pill.tsx
   - Props: variant ('success' | 'warning' | 'error' | 'info' | 'neutral'), size ('sm' | 'md'), children
   - Variantes com backgrounds do design system:
     - success: bg-success-container text-green-800
     - warning: bg-warning-container text-amber-900
     - error: bg-error-container text-red-900
     - info: bg-primary/10 text-primary
     - neutral: bg-gray-100 text-gray-600
   - rounded-full, text-[11px] font-semibold

7. icon.tsx (wrapper sobre lucide-react, tamanho padrão 20px)

8. panel.tsx
   - Props: open, onClose, title, children, footer
   - Slide-out 480px right
   - Backdrop bg-black/30 (sem blur)
   - Transition 200ms ease
   - Escapa com Esc key
   - Fecha ao clicar backdrop

ENTREGUE código completo de cada arquivo.
```

### Prompt 3.2 — Layout shell + chart base

```text
Execute a ONDA 3 tarefas 3.3 e 3.4.

Crie:

1. src/components/layout/header.tsx
   - Logo "QC Control" (font-semibold text-primary)
   - Links de navegação (QC, Lotes, Ações Corretivas, Analyzers, Reports) — usar NavLink que faz active styling
   - User avatar com initiais + nome
   - Logout button

2. src/components/layout/footer.tsx
   - 32px height, border-t border-border
   - Left: slot para contador
   - Right: links "Export PDF" · "Export Excel"

3. src/components/layout/nav-link.tsx
   - Next.js Link wrapper
   - Active state: text-primary border-b-2 border-primary
   - Inactive: text-on-surface-variant hover:text-primary

4. src/app/(dashboard)/layout.tsx
   - Header sticky top
   - max-w-[1200px] mx-auto px-6 py-8 main
   - Footer fixed bottom
   - Session check (redirect /login se não) — usar auth() from NextAuth

5. src/components/charts/levey-jennings.tsx
   - Recharts ScatterChart base
   - Props: data (date[], L1[], L2[]), referenceLines ({mean, sd1, sd2, sd3}), violations ({date, rule, level}[])
   - ReferenceLines horizontais:
     - Mean: solid primary, stroke-width 1.5
     - ±1σ: dashed border-variant
     - ±2σ: dashed warning
     - ±3σ: dashed error
   - L1 dots: circle blue (r=4)
   - L2 dots: filled diamond orange (via custom Dot component)
   - Violation dots: red (r=5, fill error)
   - Hover tooltip: date, level, value, SD distance, rule (if any)
   - X-axis: dates formatadas "26 Out"
   - Y-axis: em unidades SD (ex: "+2σ")
   - Width: 100%, height: 400px

6. src/components/data-table.tsx (reusable)
   - Props: columns, data, onRowClick, emptyState
   - Header bg-surface-variant text-xs uppercase
   - Rows 48-56px hover:bg-surface-variant cursor-pointer
   - Empty state centralizado

Entregue cada arquivo completo, com 'use client' quando usar Recharts.
```

---

## ONDA 4 — QC Control (Tela Principal)

### Prompt 4.1 — API QC runs

```text
Execute a ONDA 4 tarefa 4.A (@api-agent).

Crie as API routes para QC Control:

1. src/lib/validators.ts — Zod schemas:
   - createQcRunSchema: { lotId: string.cuid(), value: number.positive() }
   - releaseQcRunSchema: { justification: string.min(10) }
   - qcChartQuerySchema: { lotId: string.cuid(), days: number.default(30) }

2. src/lib/westgard.ts — função evaluateWestgard:
   - Params: value, mean, sd, history (últimos 20 QcRun do mesmo lote)
   - Returns: { rule: string | null, isWarning: boolean, isReject: boolean, sdDistance: number }
   - Implementa 6 regras: 1-2S (warning), 1-3S, 2-2S, R-4S, 4-1S, 10X (reject)
   - Testa em ordem de gravidade

3. src/app/api/qc/route.ts:
   - GET: query params {lotId, limit=20} → últimos runs do lote com lot include
   - POST: cria run (body validated com createQcRunSchema), executa Westgard, retorna { run, violation }

4. src/app/api/qc/chart/route.ts:
   - GET: query params {lotId, days=30} → retorna:
     - referenceLines: { mean, sd: number, sd1, sd2, sd3, lot: {level, reagentName, analyzer.id} }
     - dataPoints: {id, value, runAt, sdDistance, ruleViolated, level, operatorName}[]

5. src/app/api/qc/[id]/release/route.ts:
   - PUT: body { justification } → muda status para RELEASED, salva justification

Todas as rotas:
- Verificam session via auth()
- Retornam formato padrão: { success: boolean, data?, error?: {code, message} }
- Usam HTTP status correto

Entregue cada arquivo completo.
```

### Prompt 4.2 — Tela QC Control UI

```text
Execute a ONDA 4 tarefa 4.B (@ui-agent).

Crie a tela /qc conforme protótipo em 01-qc-control.html.

ARQUIVOS:

1. src/app/(dashboard)/qc/page.tsx (server component)
   - Verifica session
   - Busca lista de lots ativos para dropdown
   - Renderiza QcControlClient

2. src/app/(dashboard)/qc/qc-control-client.tsx ('use client')
   - Estado: selectedLot, chartData, recentRuns, pendingViolation
   - useEffect para fetch chart data quando selectedLot muda
   - Layout: page title + chart + alert + form + table + slide panel

3. src/app/(dashboard)/qc/components/qc-chart.tsx
   - Wrapper sobre LeveyJennings component
   - Loading skeleton
   - Empty state se sem data

4. src/app/(dashboard)/qc/components/violation-alert.tsx
   - Renderiza só se pendingViolation existe
   - bg-error-container, px-4 py-3, ícone warning, botão "Review"
   - Ao clicar, abre slide-out com formulário justification

5. src/app/(dashboard)/qc/components/quick-add-form.tsx
   - Lot select (popula chips ao selecionar: "Lot: 7425 Level: 1 Reagent: X Analyzer: Y")
   - Input value (mono, text-center, lg)
   - Button "Save" primary
   - Fluxo save: POST /api/qc → se violation → show justification textarea inline → PUT /api/qc/:id/release → success toast + refresh
   - react-hook-form + zod validation

6. src/app/(dashboard)/qc/components/recent-runs-table.tsx
   - DataTable reusável com colunas: Date, Time, Lot, Level, Result, SD, Rule, Justification, Operator
   - Row click seleciona para detail panel
   - Rule column: Pill component (vermelho para reject, amber para warning)

7. src/app/(dashboard)/qc/components/run-detail-panel.tsx
   - Reusa Panel component
   - Mostra: timestamp, lot, level, value, SD, rule, operator, justification
   - Se violation sem justification: textarea justification + button "Release"
   - Se já tem justification: read-only display

Use react-hot-toast para notificações de sucesso/erro.

Entregue cada arquivo completo.
```

---

## ONDA 5 — Lot Management

### Prompt 5.1 — API Lots (em paralelo com 5.2)

```text
Execute a ONDA 5 tarefa 5.A (@api-agent).

API routes para Lot Management:

1. src/lib/validators.ts — adicionar:
   - createLotSchema: { lotNumber, analyte, level (1|2), reagentName, analyzerId, targetMean, sd, minAcceptance, maxAcceptance }
   - updateLotSchema: subset opcional (mean, sd, min, max, reagentName, analyzerId)

2. src/app/api/lots/route.ts:
   - GET: query params {search, level, status, limit=50} → paginado
   - POST: cria lot (valida unique composite lotNumber+level, cria audit log)

3. src/app/api/lots/[id]/route.ts:
   - PUT: atualiza lot + gera audit log granular (para cada campo mudado, registra field + oldValue + newValue)
   - DELETE: retorna 405 (proibido usar, só archive)

4. src/app/api/lots/[id]/archive/route.ts:
   - POST: soft delete (archivedAt = now(), status = ARCHIVED) + audit log

5. src/app/api/lots/import-pncq/route.ts:
   - POST: body { analyte, pncqRef } → MOCK (retorna dados fake do PNCQ para o analyte)
   - Formato: { lotNumber, level, analyte, targetMean, sd, minAcceptance, maxAcceptance }

REGRAS:
- Audit log granular: comparar UPDATE field by field, criar 1 audit por campo modificado
- Unique constraint: não pode existir Lot com mesmo lotNumber+level (retorna 409)

Entregue cada arquivo completo.
```

### Prompt 5.2 — Tela Lot Management UI (em paralelo com 5.1)

```text
Execute a ONDA 5 tarefa 5.B (@ui-agent).

Crie a tela /lots conforme protótipo em 02-lot-management.html.

ARQUIVOS:

1. src/app/(dashboard)/lots/page.tsx (server component)
   - Busca lots + analyzers + renders LotsClient

2. src/app/(dashboard)/lots/lots-client.tsx ('use client')
   - Estado: lots, filters (search, level, status), selectedLot
   - Filtros aplicados via URL params

3. src/app/(dashboard)/lots/components/lots-table.tsx
   - DataTable com colunas: Analyte, Lot, Level, Reagent, Analyzer, Mean, SD, Range, Status
   - Row click abre slide-out edit
   - Status pills (Active=success, Expired=neutral, Archived=neutral italic)
   - Empty state: "No lots registered. Add your first above."

4. src/app/(dashboard)/lots/components/lot-form.tsx
   - Slide-out panel com form completo
   - Se edição: mostra audit history no rodapé
   - Campos:
     - Analyte (select, disabled em edição)
     - Lot Number + Level (grid 2col)
     - Reagent Name
     - Analyzer (select com lista)
     - Target Mean, SD, Min, Max (grid 2col, mono font para numbers)
   - Botões: Save (primary) + Cancel + Archive Lot (danger text, com modal confirmação)
   - react-hook-form + zod

5. src/app/(dashboard)/lots/components/audit-history.tsx
   - Renderiza audit logs do lote selecionado
   - Formato compacto: "[user] · [date] [time] · [field]: [old] → [new]"
   - Scroll interno max-height

6. src/app/(dashboard)/lots/components/pncq-import-modal.tsx
   - Modal com 1 input (PNCQ ref number) + analyte select + button "Fetch"
   - Ao clicar fetch: chama /api/lots/import-pncq, mostra preview dos dados, botão "Confirm & Create"
   - Use state machine simples: idle → loading → preview → confirming

Entregue cada arquivo completo.
```

---

## ONDA 6 — Corrective Actions

### Prompt 6.1 — API CA (em paralelo com 6.2)

```text
Execute a ONDA 6 tarefa 6.A (@api-agent).

API routes para Corrective Actions:

1. src/lib/validators.ts — adicionar:
   - createCASchema: { analyte, lotId?, equipmentId?, ruleViolated?, operatorId, investigatorId?, targetCompletionAt? }
   - updateCASchema: { rootCause?, supportingEvidence?, actionTaken?, preventiveMeasure?, effectivenessCheck?, verifiedById?, verificationAt? }
   - CAStatus enum: OPEN, IN_PROGRESS, UNDER_VERIFICATION, CLOSED

2. src/app/api/corrective-actions/route.ts:
   - GET: query {status, limit=50} → paginado com audit logs count
   - POST: cria CA com número sequencial automático
     - Formato: CA-[YYYY]-[NNNN] onde NNNN é incrementado sequencialmente
     - Query last CA number do ano atual, incrementa

3. src/app/api/corrective-actions/[id]/route.ts:
   - PATCH: atualiza campos específicos (valida status transitions)

4. src/app/api/corrective-actions/[id]/status/route.ts:
   - POST: body { newStatus } → valida transição
   - Transições válidas:
     - OPEN → IN_PROGRESS
     - IN_PROGRESS → UNDER_VERIFICATION (requer: rootCause + actionTaken preenchidos)
     - UNDER_VERIFICATION → CLOSED (requer: effectivenessCheck + verifiedById)
     - CLOSED → nada (imutável)
   - Registra closedAt quando fecha

REGRAS:
- Audit log em cada PATCH e status change
- CLOSED é imutável (tentar PATCH retorna 422)
- Validação de required fields por status destino

Entregue cada arquivo completo.
```

### Prompt 6.2 — Tela CA UI (em paralelo com 6.1)

```text
Execute a ONDA 6 tarefa 6.B (@ui-agent).

Crie a tela /corrective-actions conforme protótipo em 03-corrective-actions.html.

ARQUIVOS:

1. src/app/(dashboard)/corrective-actions/page.tsx (server)
   - Busca CAs + renders CAClient

2. src/app/(dashboard)/corrective-actions/ca-client.tsx ('use client')
   - Tabs: Open (count) / Closed (count) / All
   - Selected tab filtra table

3. src/app/(dashboard)/corrective-actions/components/ca-table.tsx
   - DataTable: CA#, Opened, Analyte·Lot, Rule, Investigator, Status, Age
   - Age em dias (bold vermelho se >14)
   - Status pills

4. src/app/(dashboard)/corrective-actions/components/ca-detail-panel.tsx
   - Slide-out panel com 5 sections:
     - A. Identification (grid read-only: timestamp, linked event, analyzer, reagent, operator, investigator)
     - B. Investigation (textarea rootCause required, upload evidence)
     - C. Action Taken (textarea actionTaken required, preventive, target date)
     - D. Verification (disabled se status < IN_PROGRESS)
     - Timeline (vertical)
   - Footer: Save + Cancel + Close Action (se UNDER_VERIFICATION)

5. src/app/(dashboard)/corrective-actions/components/ca-timeline.tsx
   - Timeline vertical com audit logs do CA
   - Ponto colorido por action type (created=primary, status change=warning, field update=neutral)

6. src/app/(dashboard)/corrective-actions/components/ca-new-modal.tsx
   - Modal com form básico (analyte, lot select, rule select, investigator select)
   - Ao salvar: POST + redirect para /corrective-actions?open=[newId]

Entregue cada arquivo completo.
```

---

## ONDA 7 — Analyzer Management

### Prompt 7.1 — API Analyzers (em paralelo com 7.2)

```text
Execute a ONDA 7 tarefa 7.A (@api-agent).

API routes para Analyzer Management:

1. src/lib/validators.ts — adicionar:
   - createAnalyzerSchema, updateAnalyzerSchema
   - calibrateAnalyzerSchema: { calibratedAt, certificateNumber, performedBy?, notes? }
   - maintenanceAnalyzerSchema: { type (PREVENTIVE|CORRECTIVE), performedAt, description, technician, outcome (PASS|FAIL|PENDING_PARTS), nextScheduledAt? }

2. src/app/api/analyzers/route.ts:
   - GET: query {search, status, limit=50}
   - POST: cria analyzer

3. src/app/api/analyzers/[id]/route.ts:
   - PUT: atualiza
   - (não há DELETE, só archive)

4. src/app/api/analyzers/[id]/archive/route.ts:
   - POST: soft delete + audit

5. src/app/api/analyzers/[id]/calibrate/route.ts:
   - POST: cria Calibration, calcula nextDueAt = calibratedAt + interval (default 12 meses)

6. src/app/api/analyzers/[id]/maintenance/route.ts:
   - POST: cria Maintenance log

7. src/lib/analyzer-status.ts — deriveAnalyzerStatus(analyzer) conforme ARCHITECTURE.md

Use a função derive para status em GET requests (overrider status stored).

Entregue cada arquivo completo.
```

### Prompt 7.2 — Tela Analyzer UI (em paralelo com 7.1)

```text
Execute a ONDA 7 tarefa 7.B (@ui-agent).

Crie a tela /analyzers conforme protótipo em 04-analyzer-management.html.

ARQUIVOS:

1. src/app/(dashboard)/analyzers/page.tsx (server)
   - Busca analyzers com relations (calibrations, maintenances) + renders AnalyzersClient

2. src/app/(dashboard)/analyzers/analyzers-client.tsx ('use client')
   - Estado: selectedAnalyzer, filters

3. src/app/(dashboard)/analyzers/components/analyzers-table.tsx
   - DataTable: ID, Model·Manufacturer, Location, Last Cal, Cal Due, Last Maint, Status
   - Cal Due vermelho se overdue, amber se due soon (30d)
   - Status pills usando deriveAnalyzerStatus
   - Row dimmed se archived

4. src/app/(dashboard)/analyzers/components/analyzer-detail-panel.tsx
   - Slide-out com 4 sections:
     - Identification (grid read-only: ID, model, manufacturer, S/N, installed, location)
     - Calibration card (border-l-4 error se overdue): last cal, next due, interval, button "Record New Calibration"
     - Maintenance History (tabela pequena + button "Log Maintenance")
     - Traceability (click to expand: QC runs count + Open CAs count + link)
   - Footer: Save + Cancel + Archive Analyzer

5. src/app/(dashboard)/analyzers/components/calibration-form.tsx
   - Modal inline: last cal (readonly), next due (date), cert number, performed by, notes
   - Submit: POST /api/analyzers/:id/calibrate

6. src/app/(dashboard)/analyzers/components/maintenance-form.tsx
   - Modal: date, type radio (preventive/corrective), description textarea, technician, outcome select, next scheduled date (opcional)
   - Submit: POST /api/analyzers/:id/maintenance

Entregue cada arquivo completo.
```

---

## ONDA 8 — Reports

### Prompt 8.1 — Engine PDF + Excel (em paralelo com 8.2)

```text
Execute a ONDA 8 tarefa 8.A (@pdf-agent).

Crie a engine de geração de reports.

ARQUIVOS:

1. src/lib/reports/types.ts
   - ReportParams: { type: ReportType, periodStart: Date, periodEnd: Date, scope: {analyzerId?, analyte?, status?} }
   - ReportResult: { id, downloadUrl, generatedAt }

2. src/lib/reports/aggregators/
   - monthly-qc.ts: agrega qc runs por lote, calcula pass rate, violation breakdown por rule
   - lot-performance.ts: por lote: mean, SD, CV%, sigma = (TEa / SD) - bias. TEa padrão por analyte
   - corrective-actions.ts: lista com aging, counts por status
   - equipment.ts: lista analyzers + calibrações + manutenções no período

3. src/lib/reports/pdf-generator.tsx (React PDF)
   - Components: Page, Text, View, Document, StyleSheet
   - Header: "QC Control · [Report Type]" + período + generatedAt + gerador
   - Body: layout específico por tipo
   - Footer: página X de Y
   - Geist fonts embed (baixar .ttf, usar fontkit.register)
   - Retorna Buffer

4. src/lib/reports/excel-generator.ts (ExcelJS)
   - 4 worksheets: Overview, Data, Violations, Summary
   - Formatting: headers bold, numbers tabular, status cells colored
   - Retorna Buffer

5. src/app/api/reports/generate/route.ts:
   - POST: body ReportParams → agrega → gera PDF + Excel → salva em filesystem local (para MVP: /tmp/reports/[id].pdf)
   - Cria Report record no DB
   - Retorna { id, pdfUrl, excelUrl }

6. src/app/api/reports/route.ts:
   - GET: lista reports ordenados por generatedAt desc

7. src/app/api/reports/[id]/download/[format]/route.ts:
   - GET: stream file (pdf ou excel) com header Content-Disposition

NOTA: Para MVP use filesystem local. Futuro: S3.

Entregue cada arquivo completo. React PDF component precisa ser arquivo .tsx.
```

### Prompt 8.2 — Tela Reports UI (em paralelo com 8.1)

```text
Execute a ONDA 8 tarefa 8.B (@ui-agent).

Crie a tela /reports conforme protótipo em 05-reports.html.

ARQUIVOS:

1. src/app/(dashboard)/reports/page.tsx (server)
   - Busca lista de reports gerados + renders ReportsClient

2. src/app/(dashboard)/reports/reports-client.tsx ('use client')
   - Estado: selectedType, period, scope, generating, reports
   - Form + Recent Reports table

3. src/app/(dashboard)/reports/components/report-form.tsx
   - Radio group report type (4 opções com descrição)
   - Period: button group (Last Month, Last Quarter, Last Year, Custom) + date range pickers quando Custom
   - Scope: 2 selects (analyzer, analyte) condicionais ao tipo
   - Actions: Generate PDF (primary) + Preview (outline) + Download Excel (outline)
   - Loading state durante geração

4. src/app/(dashboard)/reports/components/recent-reports-table.tsx
   - DataTable: Generated, Type, Period, Generated by, Size, Actions (view, download)
   - Empty state: "No reports generated yet."

5. src/app/(dashboard)/reports/components/report-preview-modal.tsx
   - Modal full-width 90% max-w-5xl max-h-90vh
   - Iframe ou iframe-like container mostrando PDF (use react-pdf-viewer ou object tag)
   - Footer: Download PDF + Download Excel + Close

Entregue cada arquivo completo.
```

---

## ONDA 9 — Testing

### Prompt 9.1 — Config Vitest + Playwright

```text
Execute configuração de testes (início da Onda 9).

INSTALAÇÃO:
- vitest @testing-library/react @testing-library/jest-dom jsdom
- @playwright/test

CONFIGS:

1. vitest.config.ts
   - Ambiente jsdom
   - Setup file: src/__tests__/setup.ts
   - Path aliases @/*

2. src/__tests__/setup.ts
   - Import '@testing-library/jest-dom'

3. src/__tests__/lib/westgard.test.ts
   - Testa TODOS os branches da função evaluateWestgard:
     - 1-2S (warning): value = mean + 2.1*sd
     - 1-3S (reject): value = mean + 3.5*sd
     - 2-2S (reject): 2 consecutivos do mesmo lado > 2 SD
     - R-4S (reject): diferença > 4 SD entre 2 consecutivos
     - 4-1S (reject): 4 consecutivos do mesmo lado > 1 SD
     - 10X (reject): 10 consecutivos do mesmo lado do mean
     - In-control: retorna null

4. src/__tests__/lib/analyzer-status.test.ts
   - Testa cada status derivado corretamente

5. playwright.config.ts
   - base URL http://localhost:3000
   - 1 worker para evitar race

6. src/__tests__/e2e/login.spec.ts
   - Teste básico: navega para /login, preenche form com analyst@lab.test/lab123, submit, redireciona /qc

Entregue configs + tests prontos para npm test.
```

### Prompt 9.2 — E2E completo das 5 telas

```text
Execute a finalização da Onda 9 (playwright E2E das 5 telas).

Crie src/__tests__/e2e/ com um spec por tela:

1. qc.spec.ts
   - Login
   - Navega /qc
   - Seleciona lote no dropdown
   - Chunks aparecem
   - Digita valor in-control
   - Save
   - Toast success + table atualiza

2. lots.spec.ts
   - Login
   - /lots
   - Click Add Lot
   - Preenche form completo
   - Save
   - Row aparece na tabela

3. corrective-actions.spec.ts
   - Login
   - /corrective-actions
   - Tab "Open" ativo
   - Click row existente
   - Slide panel abre
   - Preenche root cause + action taken
   - Save (muda status para IN_PROGRESS)

4. analyzers.spec.ts
   - Login
   - /analyzers
   - Click row COAG-02
   - Slide panel abre com calibration overdue
   - Click Record New Calibration
   - Preenche form, save

5. reports.spec.ts
   - Login
   - /reports
   - Seleciona Monthly QC Summary
   - Seleciona Last Month
   - Click Generate PDF
   - Loading
   - Row nova aparece em Recent Reports
   - Click download → baixa arquivo

RODAR com `npx playwright test` e garantir que passa.

Se falhar algum, me diga qual e por quê.
```

---

## ONDA 10 — Deploy

### Prompt 10.1 — Vercel + NeonDB

```text
Execute a Onda 10 (deploy em produção).

1. vercel.json (se necessário):
   - framework: nextjs
   - installCommand: npm install
   - buildCommand: npx prisma generate && npm run build

2. package.json scripts:
   - "build": "prisma generate && next build"
   - "db:push": "prisma db push"
   - "db:seed": "prisma db seed"
   - "postinstall": "prisma generate"

3. README.md completo com:
   - Descrição do projeto (1 parágrafo)
   - Stack
   - Pré-requisitos (Node 20+, PostgreSQL 16+)
   - Setup local: clone, npm i, docker compose up, .env, npm run db:push, npm run db:seed, npm run dev
   - Deploy em produção:
     - NeonDB: criar cluster free, pegar URL
     - Vercel: criar project, set env vars, deploy
     - Rodar npx prisma migrate deploy em produção
   - Scripts disponíveis (dev, build, test, lint)
   - Estrutura de diretórios
   - Screenshots (placeholder para capturar depois)

4. CHANGELOG.md:
   - Unreleased
   - 0.1.0 — Initial release com 5 telas

5. .vercelignore (se necessário)

6. Procfile (se usar Heroku alternativamente)

Entregue cada arquivo pronto.
```

---

## Prompts de Emergência

### Se DeepSeek alucinar ou errar

```text
O código que você gerou tem problemas:
[cole o erro ou descrição do problema]

Revise e entregue APENAS o arquivo corrigido completo.
Não altere outros arquivos.
Mantenha as mesmas assinaturas de função e tipos.
```

### Se DeepSeek perder contexto

```text
Retome o contexto:

Você está trabalhando no QC Control, onda [N], tarefa [X].
Stack: Next.js 14 + TypeScript strict + Prisma + PostgreSQL + Tailwind.
Coagulação = 2 níveis apenas.
Nunca delete, sempre archive.

Continuando do ponto [descreva onde parou], entregue [descreva o que falta].
```

### Se precisar de review de @arch-agent

```text
@arch-agent, preciso de decisão técnica.

Contexto: [descreva]
Opções A vs B: [liste]
Problema: [descreva]

Qual opção escolher e por quê? Considere:
- Simplicidade
- Manteribilidade
- Compliance (PALC/DICQ)
- Performance
```

---

## Checklist por Onda

Use este checklist para validar cada onda antes de ir para próxima:

### Onda 0 ✅

- [ ] `npm run dev` roda sem erros
- [ ] `docker compose up` sobe Postgres em 5432
- [ ] `npx prisma --help` funciona
- [ ] `npm run lint` passa
- [ ] Commit feito: "chore: scaffold"

### Onda 1 ✅

- [ ] `npx prisma migrate dev` cria tabelas
- [ ] `npx prisma db seed` popula dados
- [ ] `npx prisma studio` mostra tables
- [ ] Unit tests de westgard passam
- [ ] Commit: "feat(db): schema + seeds"

### Onda 2 ✅

- [ ] `/login` renderiza
- [ ] Login funciona com analyst@lab.test / lab123
- [ ] `/qc` sem auth → redirect `/login`
- [ ] Logout funciona
- [ ] Commit: "feat(auth): nextauth"

### Onda 3 ✅

- [ ] Todos primitivos renderizam em página teste
- [ ] Header + nav funcionais
- [ ] `/qc` renderiza layout + LeveyJennings (dummy data)
- [ ] Build passa
- [ ] Commit: "feat(ui): design system + layout"

### Onda 4 ✅

- [ ] `/qc` mostra chart real
- [ ] Quick add cria run
- [ ] Violação força justificativa
- [ ] Table atualiza após add
- [ ] Slide detail abre
- [ ] Commit: "feat: QC Control screen"

### Onda 5 ✅

- [ ] CRUD lots funcional
- [ ] Audit log gravado por campo
- [ ] Archive funciona
- [ ] PNCQ mock funciona
- [ ] Commit: "feat: Lot Management"

### Onda 6 ✅

- [ ] CRUD CA funcional
- [ ] Auto-numbering CA-YYYY-NNNN
- [ ] State machine valida transições
- [ ] Age calculado
- [ ] Commit: "feat: Corrective Actions"

### Onda 7 ✅

- [ ] CRUD analyzers
- [ ] Calibration e Maintenance logs
- [ ] Status derivado correto
- [ ] Commit: "feat: Analyzer Management"

### Onda 8 ✅

- [ ] 4 types de reports geram PDF
- [ ] Excel exports funcionam
- [ ] Preview funciona
- [ ] Downloads em stream
- [ ] Commit: "feat: Reports"

### Onda 9 ✅

- [ ] `npm test` passa tudo
- [ ] `npx playwright test` passa E2E
- [ ] Coverage >80% em /lib
- [ ] Zero erros build
- [ ] Commit: "test: full coverage"

### Onda 10 ✅

- [ ] Vercel deploy ok
- [ ] NeonDB provisioned
- [ ] README completo
- [ ] CHANGELOG criado
- [ ] Commit: "chore: deploy + docs"
- [ ] URL produção funcionando

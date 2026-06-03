# Implementation Plan — QC Control

Plano de implementação em ondas, com dependências explícitas e sub-agentes dedicados.
**Duração estimada total**: 5-8 sessões de foco (ondas curtas podem rodar em paralelo).
**Modelo alvo**: DeepSeek V4 Flash (otimizado em prompts específicos).

## Legenda

- 🔴 `BLOCKING` — tarefa crítica, não pular
- 🟡 `IMPORTANT` — tarefa importante, pode ser otimizada mas não pulada
- 🟢 `NICE_TO_HAVE` — refinamento, pode ser adiado
- ⏱️ — tempo estimado para DeepSeek V4 Flash (iterações típicas)

## Overview das Ondas

```
ONDA 0 ─▶ Fundação (setup)
   │
ONDA 1 ─▶ Data Layer (Prisma + DB)
   │
ONDA 2 ─▶ Auth (NextAuth + middleware)
   │
ONDA 3 ─▶ Design System React (UI primitives)
   │
   ├──▶ ONDA 4 ─▶ QC Control (tela principal)
   │
   ├──▶ ONDA 5 ─▶ Lot Management
   │
   ├──▶ ONDA 6 ─▶ Corrective Actions
   │
   ├──▶ ONDA 7 ─▶ Analyzer Management
   │
   └──▶ ONDA 8 ─▶ Reports (PDF/Excel)
           │
           ONDA 9 ─▶ QA + Test Coverage
                │
                ONDA 10 ─▶ Deploy + Docs
```

Ondas 4-8 podem rodar em **paralelo parcial** se múltiplos sub-agentes em sessões separadas.

---

## ONDA 0 — Fundação

**Objetivo**: Projeto Next.js pronto, rodando localmente, todos os configs.
**Sub-agente**: @devops-agent
**⏱️ Estimativa**: 15-20 min DeepSeek

### Tarefas

#### 0.1 Criar projeto Next.js com App Router 🔴

- `create-next-app@latest qc-control --typescript --tailwind --app --src-dir --no-eslint --use-npm`
- Remover boilerplate default
- Estrutura base de pastas conforme ARCHITECTURE.md

#### 0.2 Instalar dependências 🔴

```bash
@prisma/client @auth/prisma-adapter next-auth@beta
zod react-hook-form
recharts
resend
@react-pdf/renderer
exceljs
lucide-react
```

Dev deps:

```bash
prisma tailwindcss postcss autoprefixer
@types/node @types/react @types/react-dom
biome vitest @testing-library/react @testing-library/jest-dom
```

#### 0.3 Configs 🔴

`tsconfig.json` — habilitar:

```json
{
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

`biome.json`:

```json
{
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2 }
}
```

`.env.example` conforme ARCHITECTURE.md.

#### 0.4 Tailwind com Design System tokens 🔴

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#004787', hover: '#003160' },
        surface: { DEFAULT: '#F9F9FF', variant: '#F3F3F9' },
        border: { DEFAULT: '#E5E7EB', variant: '#C2C6D2' },
        'on-surface': { DEFAULT: '#191C20', variant: '#424750' },
        outline: '#727781',
        error: { DEFAULT: '#BA1A1A', container: '#FFDAD6' },
        warning: { DEFAULT: '#D97706', container: '#FEF3C7' },
        success: { DEFAULT: '#059669', container: '#D1FAE5' },
      },
      borderRadius: { DEFAULT: '4px' },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
      },
    },
  },
} satisfies Config;
```

#### 0.5 Fonts Geist no root layout 🔴

`src/app/layout.tsx`:

```tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>{children}</body>
    </html>
  );
}
```

#### 0.6 Docker Compose para PostgreSQL 🟡

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: qctest
      POSTGRES_PASSWORD: qctest
      POSTGRES_DB: qc_control
    ports: ['5432:5432']
    volumes: ['pgdata:/var/lib/postgresql/data']
volumes:
  pgdata:
```

### ✅ Definition of Done — Onda 0

- `npm run dev` abre Next.js em localhost:3000
- PostgreSQL roda via Docker em 5432
- `npx prisma` executa sem erro
- `npm run lint` (biome) passa
- `npm run build` passa

### Commit sugerido

```
chore: scaffold Next.js 14 + Prisma + Tailwind + Biome
```

---

## ONDA 1 — Data Layer

**Objetivo**: Schema Prisma funcionando, migrations criadas, seed data inicial.
**Sub-agente**: @db-agent
**Depende de**: Onda 0
**⏱️ Estimativa**: 20-25 min DeepSeek

### Tarefas

#### 1.1 Escrever `prisma/schema.prisma` completo 🔴

Conforme ARCHITECTURE.md. Todos os models, enums, relations, indexes.

#### 1.2 Trigger de Audit Log no DB 🔴

Migration manual SQL com trigger para capturar UPDATE no AuditLog:

```sql
CREATE OR REPLACE FUNCTION log_audit() RETURNS trigger AS $$
BEGIN
  INSERT INTO "AuditLog"(id, "entityType", "entityId", action, field, "oldValue", "newValue", "userId", "createdAt")
  VALUES (gen_random_uuid()::text, TG_TABLE_NAME, NEW.id, 'UPDATE',
          -- campo específico a ser parametrizado por função dedicada
          OLD::text, NEW::text, current_setting('app.current_user'), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lot_audit AFTER UPDATE ON "Lot" FOR EACH ROW EXECUTE FUNCTION log_audit();
CREATE TRIGGER qc_run_audit AFTER UPDATE ON "QcRun" FOR EACH ROW EXECUTE FUNCTION log_audit();
-- ... repetir para demais entidades críticas
```

#### 1.3 Migration e Push 🔴

```bash
npx prisma migrate dev --name init
npx prisma db push  # dev only
```

#### 1.4 Seed inicial 🔴

`prisma/seed.ts` com:

- 1 analyst user (email: analyst@lab.test, password: hashed)
- 2 analyzers (COAG-01 operational, COAG-02 cal overdue)
- 5 lots ativos (PT-INR L1, PT-INR L2, APTT L1, APTT L2, Fibrinogen L1)
- 30 QC runs nos últimos 30 dias (1 violação 2-2S pendente)
- 1 CA open linked à violação acima

#### 1.5 Prisma client singleton 🔴

`src/lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] });
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

#### 1.6 Funções helpers de QC 🟡

`src/lib/westgard.ts` — regras Westgard conforme ARCHITECTURE.md.
`src/lib/analyzer-status.ts` — deriveAnalyzerStatus.

### ✅ Definition of Done — Onda 1

- Schema aplicado ao DB sem erros
- `npx prisma studio` abre e mostra os dados dos seeds
- Unit tests de westgard.ts passam (Vitest)
- Audit log trigger funciona (UPDATE em Lot gera AuditLog)

### Commits sugeridos

```
feat(db): prisma schema + migrations
feat(db): seed data (real coag scenarios)
feat(db): audit log triggers
```

---

## ONDA 2 — Auth

**Objetivo**: Login funcional, middleware protegendo rotas, session em API routes.
**Sub-agente**: @auth-agent
**Depende de**: Onda 1 (User model)
**⏱️ Estimativa**: 20-25 min

### Tarefas

#### 2.1 Configurar NextAuth v5 🔴

`src/lib/auth.ts`:

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;
        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      return session;
    },
  },
});
```

#### 2.2 Route handlers 🔴

`src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

#### 2.3 Middleware protegendo rotas 🔴

`src/middleware.ts`:

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuth = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith('/login');
  if (isAuthPage && isAuth) return NextResponse.redirect(new URL('/qc', req.url));
  if (!isAuth && !isAuthPage && !req.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|public).*)'],
};
```

#### 2.4 Login page 🔴

`src/app/(auth)/login/page.tsx` — form server action calling signIn() com feedback de erro.

Design: seguir os principios do DESIGN-SYSTEM.md (clean, label caps, input 48px, button primary).

#### 2.5 Logout 🔴

Server action no header compartilhado.

### ✅ Definition of Done — Onda 2

- Login em `/login` funciona
- Logout funciona
- Rotas protegidas redirecionam para /login sem session
- `req.auth` disponível em API routes

### Commits sugeridos

```
feat(auth): nextauth v5 credentials provider
feat(auth): middleware proteção de rotas
feat(auth): login/logout pages
```

---

## ONDA 3 — Design System React

**Objetivo**: Primitivos UI reusáveis (Button, Input, Card, Table, Modal) + layout shell.
**Sub-agente**: @ui-agent
**Depende de**: Onda 0 + 2
**⏱️ Estimativa**: 30-40 min

### Tarefas

#### 3.1 Primitivos UI 🔴

`src/components/ui/`:

- `button.tsx` — variantes: primary, outline, danger, text
- `input.tsx` — label caps acima, input 48px, validation state
- `select.tsx` — idem
- `textarea.tsx` — idem
- `card.tsx` — border 1px, radius 4px, no shadow
- `pill.tsx` — status badge
- `icon.tsx` — wrapper para lucide-react
- `panel.tsx` — slide-out 480px

#### 3.2 Layout shell (header + nav) 🔴

`src/app/(dashboard)/layout.tsx`:

```tsx
import { Header } from '@/components/layout/header';
import { SideNav } from '@/components/layout/side-nav';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-white">
      <Header userName="..." />
      <main className="max-w-[1200px] mx-auto px-6 py-8">{children}</main>
      <Footer />
    </div>
  );
}
```

#### 3.3 LeveyJennings Chart component (base) 🟡

`src/components/charts/levey-jennings.tsx` usando Recharts:

- ScatterChart com ReferenceLines para ±1/2/3σ e Mean
- Dois ReferenceDot groups (L1 circle blue, L2 diamond orange)
- Hover tooltip clean
- Zoom X-axis com mouse wheel

#### 3.4 DataTable + Pagination 🟡

Componente genérico reusável por todas as telas.

### ✅ Definition of Done — Onda 3

- Todos os primitivos renderizam sem erros
- Layout shell aplicado a todas as rotas (5 telas)
- LeveyJennings renderiza dados fake em `/qc` (placeholder)
- Navegação entre `/qc`, `/lots`, `/corrective-actions`, `/analyzers`, `/reports` funcional

### Commits sugeridos

```
feat(ui): primitive components (button, input, card, pill, panel)
feat(ui): dashboard layout shell + header + side-nav + footer
feat(ui): LeveyJennings chart component (Recharts)
feat(ui): DataTable + Pagination reusable
```

---

## ONDA 4 — QC Control (Tela Principal)

**Objetivo**: Tela 1 funcional (chart + quick add + recent runs + slide-out detail).
**Sub-agente**: @api-agent (API) + @ui-agent (tela) — **em paralelo**.
**Depende de**: Ondas 1, 2, 3
**⏱️ Estimativa**: 40-50 min DeepSeek

### Tarefas Paralelas

#### 4.A — API QC (sub-agente @api-agent) 🔴

Rotas:

- `GET /api/qc?lotId=xxx&limit=20` → últimos QC runs do lote
- `POST /api/qc` → cria run, valida Westgard, retorna ruleViolated se houver
- `PUT /api/qc/:id/release` → adiciona justification, muda status para RELEASED
- `GET /api/qc/chart?lotId=xxx&days=30` → data points + reference lines (mean, SD)

Zod schemas em `src/lib/validators.ts`.

#### 4.B — Tela QC Control (sub-agente @ui-agent) 🔴

`src/app/(dashboard)/qc/page.tsx`:

**Componentes**:

- QcChartSection — LeveyJennings chart
- ViolationAlert — condicional (só aparece se tem pending)
- QuickAddForm — lot dropdown + value input + Save
- RecentRunsTable — últimos 15 entries
- SlideOutDetail — abre ao clicar row

**Estados**:

- Loading skeletons
- Empty state: "No control runs recorded yet."
- Error toasts (react-hot-toast ou similar)

**Interações**:

- Ao selecionar lote no dropdown: chips aparecem com lot level reagent analyzer
- Ao submeter valor: POST /api/qc → se ruleViolated → abre textarea justification obrigatória → PUT /api/qc/:id/release → refresh chart + table

### ✅ Definition of Done — Onda 4

- Tela 1 totalmente funcional, idêntica ao protótipo HTML
- Quick add cria novo QC run
- Chart atualiza em tempo-real após save
- Violação força justificativa antes de liberar
- Slide-out detail mostra histórico do run

### Commits sugeridos

```
feat(api): QC runs CRUD + westgard evaluation
feat(ui): QC Control page (chart + quick add + table + detail)
feat(api): integration — justification flow
```

---

## ONDA 5 — Lot Management

**Objetivo**: Tela 2 funcional + import PNCQ.
**Sub-agente**: @api-agent + @ui-agent — **em paralelo**.
**Depende de**: Onda 4 concluída (mesmar patterns)
**⏱️ Estimativa**: 30-35 min

### Tarefas Paralelas

#### 5.A — API Lots 🔴

- `GET /api/lots?search=&level=&status=`
- `POST /api/lots` → validar unique lot+level, criar audit log
- `PUT /api/lots/:id` → atualizar target/sd/min/max (cria audit log field-wise)
- `POST /api/lots/:id/archive` → soft delete + audit
- `POST /api/lots/import-pncq` → mock por enquanto (retorna dados do PNCQ fake)

**Regra de negócio**: lot+level deve ser único (composite unique).

#### 5.B — Tela Lot Management 🔴

- Filtros (search + level + status) reusam DataTable da Onda 3
- Slide-out panel com form (reusar primitives)
- Section Audit History mostra logs filtrados por lot
- Botão Archive com confirmação modal

### ✅ Definition of Done — Onda 5

- CRUD de lots funcional
- Lot edit cria audit log granular (field name, old, new)
- Archive soft-delete, row fica dimmed
- Import PNCQ (mock) cria lote com dados pré-preenchidos

### Commits sugeridos

```
feat(api): Lots CRUD + field-level audit log
feat(ui): Lot Management page (table + slide-out + archive)
feat(api): PNCQ import mock endpoint
```

---

## ONDA 6 — Corrective Actions

**Objetivo**: Tela 3 funcional + state machine CA status.
**Sub-agente**: @api-agent + @ui-agent — **em paralelo**.
**Depende de**: Ondas 2, 3
**⏱️ Estimativa**: 40-45 min

### Tarefas Paralelas

#### 6.A — API Corrective Actions 🔴

- `GET /api/corrective-actions?status=`
- `POST /api/corrective-actions` → cria com número sequencial CA-YYYY-NNNN
- `PATCH /api/corrective-actions/:id` → atualiza campos específicos (rootCause, actionTaken, etc)
- `POST /api/corrective-actions/:id/status-change` → valida transições:
  - OPEN → IN_PROGRESS → UNDER_VERIFICATION → CLOSED
  - Sem back-transitions

#### 6.B — Tela CA Management 🔴

- Tabs Open / Closed / All
- Table listando CAs com age (dias desde aberto, vermelho se >14)
- Slide-out panel com 4 seções (A, B, C, D) conforme protótipo
- Section D (Verification) fica disabled até Section C completa
- Activity Timeline vertical no rodapé do slide-out

**Auto-open flow**: Ao clicar "Review" em um violation pending na Tela 1, se não abrir justificativa → redirect com pre-filled CA form (via query params).

### ✅ Definition of Done — Onda 6

- Create/edit CA funcional
- State machine valida transições (backend + frontend)
- Age em dias calculado corretamente
- Overdue (>14d) destacado em vermelho
- Auto-open a partir de violation funciona

### Commits sugeridos

```
feat(api): Corrective Actions + state machine + auto-numbering
feat(ui): CA page (tabs + table + slide-out 4 sections + timeline)
feat: auto-open CA from QC Control violation
```

---

## ONDA 7 — Analyzer Management

**Objetivo**: Tela 4 funcional + calibration + maintenance logs.
**Sub-agente**: @api-agent + @ui-agent — **em paralelo**.
**Depende de**: Ondas 2, 3
**⏱️ Estimativa**: 35-40 min

### Tarefas Paralelas

#### 7.A — API Analyzers 🔴

- `GET /api/analyzers?search=&status=`
- `POST /api/analyzers`
- `PUT /api/analyzers/:id`
- `POST /api/analyzers/:id/archive`
- `POST /api/analyzers/:id/calibrate` → cria Calibration + atualiza nextDueAt
- `POST /api/analyzers/:id/maintenance` → cria Maintenance log

#### 7.B — Tela Analyzer Management 🔴

- Table com status pills derivados (deriveAnalyzerStatus from lib/)
- Slide-out com Identification + Calibration + Maintenance + Traceability sections
- Calibration card vermelha quando overdue
- Traceability section mostra count + link para `/qc?analyzer=COAG-02`

### ✅ Definition of Done — Onda 7

- CRUD analyzers
- Log calibration + maintenance via inline forms
- Status deriva automaticamente (calibration/maintenance due)
- Traceability count atualiza em tempo real

### Commits sugeridos

```
feat(api): Analyzers CRUD + calibration + maintenance logs
feat(ui): Analyzer Management page (table + slide-out 4 sections)
feat: derive analyzer status from calibrations + maintenances
```

---

## ONDA 8 — Reports

**Objetivo**: Tela 5 funcional + geração real de PDF e Excel.
**Sub-agente**: @pdf-agent + @ui-agent — **em paralelo**.
**Depende de**: Ondas 4-7 (dados de todos os domínios)
**⏱️ Estimativa**: 50-60 min

### Tarefas Paralelas

#### 8.A — Engine de Reports 🔴

`src/lib/reports/`:

- `monthly-qc.ts` → agrega runs por lote, calcula pass rate, violations breakdown
- `lot-performance.ts` → mean, SD, CV%, sigma por lote
- `corrective-actions.ts` → listagem com aging
- `equipment.ts` → calibration + maintenance logs

Geração:

- `generate-pdf.ts` — usa @react-pdf/renderer, salva em /tmp ou S3
- `generate-excel.ts` — usa ExcelJS

API:

- `POST /api/reports/generate` → { type, periodStart, periodEnd, scope } → retorna { id, downloadUrl }
- `GET /api/reports` → listagem
- `GET /api/reports/:id/download/:format` → streaming file

#### 8.B — Tela Reports 🔴

- Form radio + period picker + scope filters
- Preview modal (primeira página do PDF renderizada)
- Recent Reports table

### ✅ Definition of Done — Onda 8

- 4 tipos de report geram PDF + Excel reais
- Preview funciona
- Reports arquivados aparecem no histórico
- Downloads funcionam (stream)

### Commits sugeridos

```
feat(reports): PDF generation engine (@react-pdf/renderer)
feat(reports): Excel generation (ExcelJS)
feat(reports): 4 report types (monthly, lot, CA, equipment)
feat(ui): Reports page (form + preview + history)
```

---

## ONDA 9 — QA + Test Coverage

**Objetivo**: Testes unitários críticos + E2E dos happy paths.
**Sub-agente**: @test-agent
**Depende de**: Ondas 4-8
**⏱️ Estimativa**: 45-60 min

### Tarefas

#### 9.1 Unit tests do lib/ 🔴

- `westgard.test.ts` — todas as 6 regras
- `analyzer-status.test.ts` — todos os status derivados
- `validators.test.ts` — schemas Zod
- Coverage target: 100% em `/lib`

#### 9.2 Integration tests das API routes 🟡

- Testar happy + error paths de cada endpoint
- Supertest ou similar

#### 9.3 E2E tests com Playwright 🔴

Happy paths:

- Login → tela principal → quick add → libera com justificativa
- Login → lot management → cria lote → edita → archiva
- Login → correct. actions → cria → completa → fecha
- Login → analyzer management → cria → registra calibration → vê status muda
- Login → reports → gera PDF → baixa

#### 9.4 Bug bash manual 🟢

Rodar app local, fazer walkthrough de cada tela, corrigir bugs visuais.

### ✅ Definition of Done — Onda 9

- `npm test` passa (Vitest)
- `npx playwright test` passa (E2E)
- Zero erros no `npm run build`
- Zero warnings no biome lint

### Commits sugeridos

```
test: vitest coverage for /lib (westgard, analyzer-status)
test: integration tests for all API routes
test: playwright e2e for 5 happy paths
fix: bug bash pass (UI + UX refinements)
```

---

## ONDA 10 — Deploy + Docs

**Objetivo**: Produção online, README completo, onboarding claro.
**Sub-agente**: @devops-agent + @docs-agent
**Depende de**: Onda 9
**⏱️ Estimativa**: 30-40 min

### Tarefas

#### 10.1 Vercel project setup 🔴

- `vercel` CLI install + login
- `vercel` init, link ao repo
- Adicionar env vars no Vercel dashboard
- Deploy preview → produção

#### 10.2 NeonDB provision 🔴

- Criar DB free em neon.tech
- Pegar URL de conexão
- Rodar `npx prisma migrate deploy` no DB de produção
- Rodar seed (apenas primeira vez)

#### 10.3 GitHub Actions CI 🟡

`.github/workflows/ci.yml`:

- Lint (biome)
- Build
- Test (vitest + playwright)
- Deploy preview branch

#### 10.4 README.md de projeto 🔴

Com seções:

- Visão geral
- Stack
- Pré-requisitos
- Setup local (com Docker)
- Scripts disponíveis
- Deploy em produção
- Screenshots das 5 telas

#### 10.5 CHANGELOG.md 🟢

Registro de cada onda concluída.

#### 10.6 API docs (markdown) 🟡

Listagem de cada endpoint, body, response. Pode ser auto-gerado do OpenAPI ou manual.

### ✅ Definition of Done — Onda 10

- App rodando em produção (URL público)
- Login funciona em produção
- DB populado com seeds
- README claro o suficiente para onboarding
- GitHub Actions verde

### Commits sugeridos

```
chore: vercel config + production env setup
chore: GitHub Actions CI pipeline
docs: README com setup, stack, screenshots
docs: CHANGELOG + API reference
```

---

## Checklist Final (após Onda 10)

- [ ] Prod: acesso público funcionando
- [ ] Prod: login cria sessão real
- [ ] Prod: DB persiste dados
- [ ] Prod: PDF reports geram e baixam
- [ ] Prod: Excel exports funcionam
- [ ] Prod: no erros no Vercel console
- [ ] Local: `npm run dev` roda sem setup especial além de `docker compose up`
- [ ] Code: cobertura 80%+ em /lib
- [ ] Code: E2E cobre todas as 5 telas
- [ ] Docs: README completo
- [ ] Docs: ARCHITECTURE.md reflete implementação final

---

## Riscos e Mitigações

| Risco                                        | Mitigação                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| DeepSeek gera código errado no Prisma schema | Revisar cada migration antes de aplicar. Backup local.                       |
| Integração PNCQ é fake                       | Documentar claramente no código; deixar endpoint retornar fixture hardcoded. |
| Auth NextAuth v5 beta tem bugs               | Usar versão mais estável conhecida (5.0.0-beta.22+).                         |
| Westgard logic é complexa                    | Testes unitários cobrindo TODOS os casos documentados.                       |
| Deploy Vercel/Neon tem limites free          | Monitorar uso; upgrade só se necessário.                                     |
| Tailwind design drift entre telas            | Usar sempre os tokens em `tailwind.config.ts`, evitar inline values hex.     |

---

## Notas para DeepSeek V4 Flash

DeepSeek performa melhor com:

- **Prompts específicos com exemplos de código esperado** (veja PROMPTS.md)
- **Schemas explícitos** (sempre passar schema.prisma atualizado no contexto)
- **Instruções passo-a-passo** (não abstrações)
- **Arquivos existentes como referência** (passar design-system.md no prompt)
- **Revisões curtas e iterativas** (1-2 arquivos por mensagem)
- **Evitar abstrações tipo "crie um módulo genérico X"** — melhor "crie o arquivo X.ts no path Y com função Z"

Quando DeepSeek entregar código:

1. **Rode `npm run lint`** imediatamente
2. **Rode `npm run build`** para checar types
3. **Reveja manualmente** antes de commit (especialmente SQL, auth, migrations)

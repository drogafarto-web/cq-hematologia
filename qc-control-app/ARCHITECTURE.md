# Architecture — QC Control

Decisões técnicas do sistema. Este documento é fonte da verdade para todos os sub-agentes.

## Stack

| Layer | Tecnologia | Versão | Justificativa |
|-------|-----------|--------|---------------|
| Framework | Next.js App Router | 14.2+ | SSR, RSC, API routes integradas. DeepSeek performa excelente. |
| Lang | TypeScript | 5.4+ strict | Type safety para dados médicos. Compilador detecta bugs. |
| ORM | Prisma | 5.x | Migrations automáticas, type-safe queries, Studio de debugging. |
| Database | PostgreSQL | 16 | ACID, audit log via triggers, JSONB para flexibilidade. |
| Styling | Tailwind CSS | 3.4 | Herdado do protótipo. Utility-first. |
| Charts | Recharts | 2.x | React-native, performático, SSR-friendly. |
| Auth | NextAuth.js v5 (Auth.js) | beta | Middleware + JWT integrado ao Next.js. |
| PDF | @react-pdf/renderer | 3.x | PDF declarativo em React. |
| Excel | ExcelJS | 4.x | Export XLSX com formatação. |
| Email | Resend | - | Alertas para supervisores, notificações. |
| Deploy | Vercel + NeonDB | - | Zero-config. DB serverless PostgreSQL. |
| Testing | Vitest + Playwright | latest | Unit/integration + E2E. |
| Lint | Biome | 1.x | Rápido, substitui ESLint + Prettier. |
| CI | GitHub Actions | - | Test + deploy automáticos. |

## Estrutura de Projeto

```
qc-control/
├── prisma/
│   ├── schema.prisma          # Schema único (fonte da verdade)
│   ├── seed.ts                # Dados iniciais
│   └── migrations/
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Login, reset password
│   │   │   └── login/page.tsx
│   │   ├── (dashboard)/       # Rotas autenticadas
│   │   │   ├── qc/page.tsx                 # Tela 1
│   │   │   ├── lots/page.tsx               # Tela 2
│   │   │   ├── corrective-actions/page.tsx # Tela 3
│   │   │   ├── analyzers/page.tsx          # Tela 4
│   │   │   ├── reports/page.tsx            # Tela 5
│   │   │   └── layout.tsx                  # Shell (header, nav)
│   │   ├── api/               # API routes REST
│   │   │   ├── qc/route.ts
│   │   │   ├── lots/route.ts
│   │   │   ├── corrective-actions/route.ts
│   │   │   ├── analyzers/route.ts
│   │   │   └── reports/route.ts
│   │   ├── layout.tsx         # Root layout (fonts, tailwind)
│   │   └── page.tsx           # Redirect /login ou /qc
│   ├── components/
│   │   ├── ui/                # Primitives (Button, Input, Card)
│   │   ├── charts/            # LeveyJennings + helpers
│   │   ├── forms/             # Reusable form parts
│   │   └── tables/            # DataTable, Pagination
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── auth.ts            # NextAuth config
│   │   ├── auth-options.ts    # Auth options
│   │   ├── validators.ts      # Zod schemas
│   │   └── westgard.ts        # Lógica regras Westgard
│   ├── types/                 # TypeScript globals
│   └── hooks/                 # React hooks (useQC, etc)
├── public/
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── biome.json
└── vitest.config.ts
```

## Data Model (Prisma Schema)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  passwordHash  String
  role          Role     @default(ANALYST)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  qcRuns        QcRun[]
  lotsCreated   Lot[]          @relation("LotCreator")
  lotsArchived  Lot[]          @relation("LotArchiver")
  casOpened     CorrectiveAction[] @relation("CAOperator")
  casInvestigating CorrectiveAction[] @relation("CAInvestigator")
  auditLogs     AuditLog[]
}

enum Role {
  ANALYST
  SUPERVISOR
  ADMIN
}

model Analyzer {
  id             String   @id @default(cuid())
  analyzerId     String   @unique // COAG-01
  model          String
  manufacturer   String
  serialNumber   String
  location       String
  installDate    DateTime
  status         AnalyzerStatus @default(OPERATIONAL)
  archived       Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  lots           Lot[]
  qcRuns         QcRun[]
  calibrations   Calibration[]
  maintenances   Maintenance[]
  auditLogs      AuditLog[]
}

enum AnalyzerStatus {
  OPERATIONAL
  CAL_DUE_SOON
  CAL_OVERDUE
  MAINTENANCE_DUE
  MAINTENANCE_OVERDUE
  OUT_OF_SERVICE
}

model Calibration {
  id               String   @id @default(cuid())
  analyzerId       String
  calibratedAt     DateTime
  nextDueAt        DateTime
  certificateNumber String
  interval         Int      @default(12) // months
  performedBy      String?
  notes            String?
  createdAt        DateTime @default(now())
  
  analyzer         Analyzer  @relation(fields: [analyzerId], references: [id])
}

model Maintenance {
  id               String   @id @default(cuid())
  analyzerId       String
  type             MaintenanceType
  performedAt      DateTime
  description      String
  technician       String
  outcome          MaintenanceOutcome
  nextScheduledAt  DateTime?
  createdAt        DateTime @default(now())
  
  analyzer         Analyzer  @relation(fields: [analyzerId], references: [id])
}

enum MaintenanceType {
  PREVENTIVE
  CORRECTIVE
}

enum MaintenanceOutcome {
  PASS
  FAIL
  PENDING_PARTS
}

model Lot {
  id            String     @id @default(cuid())
  lotNumber     String
  analyte       String
  level         Int        // 1 ou 2 — coagulação só tem 2 níveis
  reagentName   String
  analyzerId    String
  targetMean    Decimal    @db.Decimal(10, 4)
  sd            Decimal    @db.Decimal(10, 4)
  minAcceptance Decimal    @db.Decimal(10, 4)
  maxAcceptance Decimal    @db.Decimal(10, 4)
  status        LotStatus  @default(ACTIVE)
  archivedAt    DateTime?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  createdById   String
  archivedById  String?
  
  uniqueLotPerLevel  String @unique // lotNumber_level
  
  analyzer     Analyzer  @relation(fields: [analyzerId], references: [id])
  createdBy    User      @relation("LotCreator", fields: [createdById], references: [id])
  archivedBy   User?     @relation("LotArchiver", fields: [archivedById], references: [id])
  qcRuns       QcRun[]
  auditLogs    AuditLog[]
}

enum LotStatus {
  ACTIVE
  EXPIRED
  ARCHIVED
}

model QcRun {
  id            String   @id @default(cuid())
  lotId         String
  value         Decimal  @db.Decimal(10, 4)
  sdDistance    Decimal  @db.Decimal(10, 4)
  ruleViolated  String?   // ex: "2-2S", "1-3S", null = in-control
  isReject      Boolean   @default(false)
  isWarning     Boolean   @default(false)
  status        QcRunStatus @default(RELEASED)
  justification String?   // obrigatório se ruleViolated != null
  runAt         DateTime @default(now())
  operatorId    String
  createdAt     DateTime @default(now())
  
  lot           Lot      @relation(fields: [lotId], references: [id])
  operator      User     @relation(fields: [operatorId], references: [id])
  
  @@index([lotId, runAt])
  @@index([operatorId, runAt])
}

enum QcRunStatus {
  RELEASED               // Liberado (in-control OU com justificativa)
  PENDING_JUSTIFICATION  // Aguardando
  ARCHIVED
}

model CorrectiveAction {
  id                 String    @id @default(cuid())
  caNumber           String    @unique // CA-2026-0005
  openedAt           DateTime  @default(now())
  analyte            String
  lotId              String?
  lot                Lot?      @relation(fields: [lotId], references: [id])
  equipmentId        String?
  analyzer           Analyzer? @relation(fields: [equipmentId], references: [id])
  ruleViolated       String?
  status             CAStatus  @default(OPEN)
  
  // Operator who opened
  operatorId         String
  operator           User      @relation("CAOperator", fields: [operatorId], references: [id])
  
  // Investigator assigned
  investigatorId     String?
  investigator       User?     @relation("CAInvestigator", fields: [investigatorId], references: [id])
  
  // Investigation (Section B)
  rootCause          String?
  supportingEvidence String?
  
  // Action (Section C)
  actionTaken        String?
  preventiveMeasure  String?
  targetCompletionAt DateTime?
  
  // Verification (Section D)
  effectivenessCheck String?
  verifiedById       String?
  verificationAt     DateTime?
  
  closedAt           DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  
  auditLogs          AuditLog[]
}

enum CAStatus {
  OPEN
  IN_PROGRESS
  UNDER_VERIFICATION
  CLOSED
}

model AuditLog {
  id          String   @id @default(cuid())
  entityType  String   // User, Lot, QcRun, CorrectiveAction, Analyzer
  entityId    String
  action      String   // CREATE, UPDATE, ARCHIVE, STATUS_CHANGE
  field       String?
  oldValue    String?
  newValue    String?
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  
  @@index([entityType, entityId])
}

model Report {
  id          String   @id @default(cuid())
  type        ReportType
  periodStart DateTime
  periodEnd   DateTime
  scope       Json     // {analyzerId?, analyte?, status?}
  s3Key       String?  // Path to generated PDF
  generatedBy String   // User name snapshot
  generatedAt DateTime @default(now())
  
  @@index([type, generatedAt])
}

enum ReportType {
  MONTHLY_QC_SUMMARY
  LOT_PERFORMANCE
  CORRECTIVE_ACTIONS
  EQUIPMENT
}
```

## Auth Flow

```
┌──────────────────────────────────────────────┐
│  NextAuth.js v5 + Credentials Provider       │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐  │
│  │  Login  │──▶│ Prisma DB│──▶│ JWT Token│  │
│  └─────────┘   └──────────┘   └────┬─────┘  │
│                                     │        │
│                              ┌──────▼────┐   │
│                              │ Middleware│   │
│                              │ (auth.ts) │   │
│                              └──────┬────┘   │
│                                     │        │
│                     ┌───────────────┼──────┐ │
│                     ▼               ▼      ▼ │
│               (auth)/login    /(dashboard) │ │
│                     │               │        │
│                     │         ┌─────▼────┐   │
│                     │         │   QC     │   │
│                     │         │   Lots   │   │
│                     │         │   CA     │   │
│                     │         │   Analyz.│   │
│                     │         │   Reports│   │
│                     │         └──────────┘   │
└──────────────────────────────────────────────┘
```

## API Contract (REST)

Todos os endpoints sob `/api/`:

### QC Runs
```
GET    /api/qc?lotId=xxx&limit=20     → latest QC runs
POST   /api/qc                         → create new run
PUT    /api/qc/:id                     → release with justification
GET    /api/qc/chart?lotId=xxx&days=30 → Levey-Jennings data points
```

### Lots
```
GET    /api/lots                       → list all
POST   /api/lots                       → create
PUT    /api/lots/:id                   → update
POST   /api/lots/:id/archive           → soft delete
POST   /api/lots/import-pncq           → PNCQ integration
```

### Corrective Actions
```
GET    /api/corrective-actions?status=OPEN  → list
POST   /api/corrective-actions              → create
PATCH  /api/corrective-actions/:id          → update status, fields
```

### Analyzers
```
GET    /api/analyzers                 → list
POST   /api/analyzers                 → create
PUT    /api/analyzers/:id             → update
POST   /api/analyzers/:id/archive     → soft archive
POST   /api/analyzers/:id/calibrate   → log calibration
POST   /api/analyzers/:id/maintenance → log maintenance
```

### Reports
```
POST   /api/reports/generate          → generate PDF, returns URL
GET    /api/reports                   → list history
GET    /api/reports/:id/download/:format  → pdf | excel
```

### Auth
```
POST   /api/auth/signin               → NextAuth
POST   /api/auth/signout              → NextAuth
```

## Westgard Rules Logic (in `lib/westgard.ts`)

```ts
// Pseudo-code
export function evaluateWestgard(
  value: number,
  mean: number,
  sd: number,
  history: QcRun[] // últimos 20
): { rule: string | null; isWarning: boolean; isReject: boolean } {
  const z = (value - mean) / sd;
  const absZ = Math.abs(z);
  
  // 1-2S: warning
  if (absZ > 2 && absZ <= 3) {
    return { rule: "1-2S", isWarning: true, isReject: false };
  }
  
  // 1-3S: reject
  if (absZ > 3) {
    return { rule: "1-3S", isWarning: false, isReject: true };
  }
  
  // 2-2S: reject (2 consec > 2 SD on same side)
  // 4-1S: reject (4 consec > 1 SD on same side)
  // R-4S: reject (range > 4 SD between 2 consec)
  // 10X: reject (10 consec on same side of mean)
  
  return { rule: null, isWarning: false, isReject: false };
}
```

## Estado de Derivação (Analyzer Status)

Status do `Analyzer` é derivado:

```ts
export function deriveAnalyzerStatus(analyzer: Analyzer) {
  const now = new Date();
  const lastCal = analyzer.calibrations[0];
  const calDueAt = lastCal?.nextDueAt;
  
  if (analyzer.status === "OUT_OF_SERVICE") return "OUT_OF_SERVICE";
  if (!lastCal || !calDueAt) return "CAL_OVERDUE";
  
  if (calDueAt < now) return "CAL_OVERDUE";
  if (daysUntil(calDueAt) <= 30) return "CAL_DUE_SOON";
  
  const lastMaint = analyzer.maintenances[0];
  if (lastMaint?.nextScheduledAt && lastMaint.nextScheduledAt < now) {
    return "MAINTENANCE_OVERDUE";
  }
  if (lastMaint?.nextScheduledAt && daysUntil(lastMaint.nextScheduledAt) <= 30) {
    return "MAINTENANCE_DUE";
  }
  
  return "OPERATIONAL";
}
```

## Variáveis de Ambiente (.env)

```bash
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="random-generated"
NEXTAUTH_URL="http://localhost:3000"
RESEND_API_KEY="..."
AWS_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
S3_BUCKET="qc-control-reports"
```

## Decisões Não-Negociáveis

1. **Todos os dados médicos em PostgreSQL** (não SQLite, não NoSQL)
2. **Records são imutáveis para auditoria** — archive (soft delete) apenas
3. **Audit log de TODAS as mutations** via middleware Prisma ou triggers DB
4. **Auth em toda rota** — middleware bloqueia /api/* e /dashboard/* sem session
5. **TypeScript strict** — `strict`, `strictNullChecks`, `noUncheckedIndexedAccess`
6. **Test coverage mínima**: 80% em `/lib` (Westgard, utils), 60% em routes
7. **No runtime type coercion** — validar tudo com Zod
8. **Reports são snapshots** — PDFs gerados ficam imutáveis no S3
9. **Coagulação = 2 níveis apenas** — schema + UI refletem isso
10. **Nunca delete, sempre archive** — compliance

## Não-Implementações

- Sem sistema de permissões granular (qualquer usuário logado pode liberar com justificativa)
- Sem multi-tenant
- Sem dashboard de KPIs (firula)
- Sem sigma metric gauges (firula)
- Sem notificações push (só email para alertas de CA em atraso)
- Sem mobile app (só web responsiva)
- Sem integração com LIS/HIS (foco escopo QC)

## Deploy Target

**Produção**:
- Vercel (frontend + API routes)
- NeonDB (serverless PostgreSQL) — free até 0.5GB
- AWS S3 (PDF reports)
- Resend (email)

**Dev**:
- Local PostgreSQL via Docker
- Vercel CLI local

---

Este documento é a fonte da verdade. Os sub-agentes devem consultá-lo antes de qualquer decisão técnica.

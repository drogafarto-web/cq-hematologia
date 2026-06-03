# QC Control

Sistema de Controle de Qualidade para laboratório de coagulação.

## Stack

| Layer | Tecnologia |
|---|---|
| Framework | Next.js 14 App Router |
| Linguagem | TypeScript strict |
| ORM | Prisma 5 + PostgreSQL 16 |
| Estilo | Tailwind CSS 3 |
| Gráficos | Recharts (Levey-Jennings) |
| Auth | NextAuth.js v5 (Credentials) |
| Testes | Vitest + Playwright |

## Pré-requisitos

- Node.js 20+
- Docker (para PostgreSQL local)
- npm

## Setup Local

```bash
# 1. Instalar dependências
npm install

# 2. Subir PostgreSQL
docker compose up -d

# 3. Configurar .env
cp .env.example .env

# 4. Push schema + seed
npx prisma db push
npx prisma db seed

# 5. Rodar dev
npm run dev

# 6. Acessar
# http://localhost:3000
# Login: analyst@lab.test / lab123
```

## Scripts

```bash
npm run dev          # Desenvolvimento
npm run build        # Build produção
npm run lint         # Biome lint
npm test             # Vitest unit tests
npx prisma studio    # DB visual
npx playwright test  # E2E tests
```

## Telas

1. **QC Control** (`/qc`) — Levey-Jennings chart + quick add + violações Westgard
2. **Lot Management** (`/lots`) — CRUD lotes + import PNCQ mock
3. **Corrective Actions** (`/corrective-actions`) — State machine OPEN→IN_PROGRESS→UNDER_VERIFICATION→CLOSED
4. **Analyzer Management** (`/analyzers`) — Calibração + manutenção + status derivado
5. **Reports** (`/reports`) — PDF/Excel (mock)

## Regras de Negócio

- Coagulação: 2 níveis (L1 normal, L2 anormal/terapêutico)
- Westgard: 1-2S (warning), 1-3S/2-2S/R-4S/4-1S/10X (reject)
- Qualquer operador pode liberar com justificativa (sem permissão granular)
- Records imutáveis (archive, nunca delete)
- PALC/DICQ/ISO 15189 compliance

## Deploy em Produção

1. Criar cluster NeonDB (free tier)
2. Copiar DATABASE_URL para Vercel env vars
3. Rodar `npx prisma migrate deploy` em prod
4. `vercel --prod`

## Estrutura

```
src/
├── app/
│   ├── (auth)/login/       # Login page
│   ├── (dashboard)/        # 5 telas protegidas
│   │   ├── qc/             # QC Control
│   │   ├── lots/           # Lot Management
│   │   ├── corrective-actions/ # CA
│   │   ├── analyzers/      # Analyzers
│   │   └── reports/        # Reports
│   └── api/                # REST API routes
├── components/
│   ├── ui/                 # Primitivos (Button, Input, Card, etc)
│   ├── charts/             # Levey-Jennings
│   └── layout/             # Header, Footer, Nav
├── lib/                    # DB, Auth, Westgard, Validators
└── __tests__/              # Unit + E2E
```
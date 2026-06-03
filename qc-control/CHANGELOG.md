# Changelog

## [0.1.0] - 2026-05-25

### Added
- Next.js 14 project scaffold with TypeScript strict
- PostgreSQL database with Prisma ORM
- Prisma schema: User, Analyzer, Calibration, Maintenance, Lot, QcRun, CorrectiveAction, AuditLog, Report
- Seed data with 2 users, 2 analyzers, 5 lots, 30 QC runs, 1 corrective action
- Westgard rules engine (1-2S, 1-3S, 2-2S, R-4S, 4-1S, 10X)
- Analyzer status derivation from calibration/maintenance dates
- Zod validation for all API inputs
- NextAuth.js v5 with Credentials provider (email + password)
- Middleware protecting all routes (redirect to /login)
- Login page with form validation and error handling
- Design system: Button, Input, Select, Textarea, Card, Pill, Modal, Panel components
- Dashboard layout with Header + Nav + Footer
- Recharts Levey-Jennings chart component
- Reusable DataTable component
- QC Control screen: chart + quick add + recent runs + violation flow
- Lot Management CRUD with field-level audit logging
- PNCQ mock import endpoint
- Corrective Actions with state machine (OPEN→IN_PROGRESS→UNDER_VERIFICATION→CLOSED)
- Auto-numbering CA-YYYY-NNNN
- Analyzer Management: CRUD + calibration + maintenance logs
- Reports screen: 4 report types with PDF/Excel generation (mock)
- 16 unit tests (Westgard + analyzer-status)
- Vitest + Playwright configuration
- Docker Compose for PostgreSQL 16
- Biome linting
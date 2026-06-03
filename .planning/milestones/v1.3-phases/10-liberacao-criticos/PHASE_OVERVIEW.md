---
phase: '10-liberacao-criticos'
title: 'Phase 10 — Liberação + Críticos (Combined)'
milestone: v1.3
status: planning
total_plans: 7
start_date: 2026-05-20
end_date: 2026-08-20
duration_weeks: 13
priority: P1
stream: B
parallel_with: [08-capa-closure, 09-bioquimica]
revision: 1.0
---

# Phase 10: Liberação + Críticos (Combined)

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração Riopomba)
**Stream:** B (parallel — independent of Stream A)
**Priority:** P1 (compliance Bloco G + I — pós-analítico + laudos)
**Period:** 2026-05-20 → 2026-08-20 (13 weeks; ~12.5 weeks de execução real)
**Combined rationale:** Críticos bloqueia Liberação (per DICQ §5.7 + §5.9). Construir separados gera retrabalho de integração.
**Revision:** 1.0

---

## Goal

Construir o **primeiro módulo de laudo do HC Quality** — não existe hoje. Workflow de liberação híbrido (auto-liberação por tipo de exame + RT review excepcional), valores críticos com comunicação via email + log imutável, geração de PDF de laudo (14 campos RDC 978 Art. 167), QR code de validação, e portal médico para acesso externo de médicos solicitantes.

**Output:**

- Módulo `liberacao-laudos` em produção
- Módulo `criticos` em produção (vinculado, mas codepaths separados)
- Portal médico em `https://hmatologia2.web.app/portal-medico`
- PDF de laudo com 14 campos RDC + QR validação
- Email transacional via nodemailer (já no stack)
- Audit chain imutável + histórico de versões (retificação cria v2, não edita v1)

---

## Strategic Context

### Por que Liberação + Críticos agora

- **Bloco G (Pós-analítico) DICQ:** 0% coberto hoje. Phase 10 sobe pra ~88%.
- **Bloco I (Laudos/Liberação) DICQ:** 0% coberto hoje. Phase 10 sobe pra ~88%.
- **RDC 978 Art. 167:** 14 campos obrigatórios — hoje, lab Riopomba imprime laudo Worklab que não atende todos os campos. Risco regulatório real.
- **RDC 978 Art. 184-191:** valor crítico precisa ser comunicado e o registro provado. Caso real ANVISA: lab disse "comunicou de viva voz" sem registro → considerado não-comunicado. Phase 10 mata esse risco.
- **Lacuna de mercado:** nenhum concorrente brasileiro (Sysmex Pi, Roche cobas-IT, QualiChart, CI Online, Vision 360) oferece liberação + críticos + assinatura RT + comunicação + portal médico integrados. HC Quality vira first-to-market neste recorte.
- **Phase 9 (Bioquímica) e Phase 10 (Liberação) são complementares:** após Bioquímica entrar em prod, runs aprovadas precisam virar laudo. Ordem natural.

### Decisões locked (do discuss-phase 2026-05-06)

| Decisão              | Valor                                                            | Rationale                                                                                                                        |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Assinatura RT        | LogicalSignature SHA-256 (ADR 0001)                              | Padrão HC Quality, audit chain imutável; aceita por RDC 978 Art. 167. ICP-Brasil fica como upsell v1.4                           |
| State machine        | Híbrido por tipo de exame                                        | Auto-libera rotina; RT revisa críticos. Lab configura quais auto via UI. RDC 978 Art. 186 §2 (critérios validados automatizados) |
| Comunicação críticos | Email apenas no MVP + UI registro verbal                         | SMS deferido pra v1.4 (Zenvia/Twilio). Cumpre RDC 978 Art. 184 minimamente                                                       |
| Saída do laudo       | PDF (14 campos RDC) + email anexo + Portal médico + QR validação | Multi-canal; QR previne falsificação                                                                                             |
| Histórico de versões | Retificação cria v2/v3 imutáveis (RDC 978 Art. 167 + DICQ 5.9.3) | Mandatório regulatório; v1 marca "Superado", não deletado                                                                        |
| Médico solicitante   | Read-only do Worklab LIS (cache local 24h)                       | Single source of truth; já existe integração unidirecional                                                                       |
| Worklab reverso      | Defer pra v1.4 (escrita "Liberado" back)                         | Requer API bidirecional; não pronta                                                                                              |
| ICP-Brasil           | Defer pra v1.4                                                   | Custo + complexidade; LogicalSignature suficiente                                                                                |
| WhatsApp Business    | Defer pra v1.4                                                   | Aprovação Meta ~30d                                                                                                              |

---

## Plan Structure

Phase 10 has **7 plans** organized em 3 ondas (paralelismo otimizado por dependency):

### Wave 1 — Foundation (Plans 10-01 sequencial; 10-02, 10-03 podem começar com ~3d delay)

#### Plan 10-01: Schema + State Machine + Classificação de Exame

**Duration:** 1.5 weeks (2026-05-20 → 2026-05-30)
**Type:** Build (foundation)
**Goal:** Tipos, schema Firestore, state machine, regras de classificação (rotina/crítico/sempre-RT), service multi-tenant.

**Deliverables:**

- `src/features/liberacao/types/` (Laudo, LaudoVersion, ReleaseState, ExamClassification)
- `src/features/liberacao/services/laudoService.ts` + audit log integration
- State machine: `Pendente → Em Revisão → Liberado → Comunicado` (linear) e `Pendente → Auto-Liberado → Comunicado` (atalho condicional)
- `src/features/liberacao/utils/stateMachine.ts` (engine puro)
- `src/features/liberacao/utils/exameClassifier.ts` (rotina/crítico/sempre-RT)
- `firestore.rules` + indexes para `/laudos`, `/laudo-versions`, `/comunicacoes`

#### Plan 10-02: RT Signature Workflow + Auto-Liberar Engine + ReviewLaudoModal

**Duration:** 2 weeks (2026-05-30 → 2026-06-13)
**Type:** Build (core domain)
**Goal:** UI de revisão pelo RT, engine de auto-liberação por critérios, signature integration.

**Deliverables:**

- `ReviewLaudoModal.tsx` — RT vê resultado bruto + amostra + Westgard violations + valor crítico flag
- `useAutoReleaseEngine.ts` — orquestra: classificação OK + Westgard OK + sem amostra restrita + sem crítico → auto-libera
- `RTSignatureGate.tsx` — pin/password confirm + LogicalSignature SHA-256
- `LaudoStatusBadge.tsx` — visual states com transições 150-200ms
- Cloud Function callable `liberarLaudo` (server-side validation)

#### Plan 10-03: Críticos Thresholds + Comunicação Email + Log/Escalação

**Duration:** 2 weeks (2026-06-13 → 2026-06-27)
**Type:** Build (vertical slice críticos)
**Goal:** UI de cadastro de thresholds, detecção em tempo real, comunicação por email + UI de registro verbal, escalação se não comunicado em SLA.

**Deliverables:**

- `CriticosThresholdsAdmin.tsx` — CRUD por analito + população (idade/sexo opcionais)
- `CriticoDetector.ts` — engine puro: dado um resultado, retorna `{ critico: bool, severidade: 'alta'|'baixa', threshold }`
- `ComunicacaoModal.tsx` — registrar email enviado OU comunicação verbal (timestamp + receptor + RT)
- Cloud Function `enviarComunicacaoEmail` via nodemailer
- Cloud Function `escalarCritico` (cron: a cada 5min, dispara alerta se sla extrapolado)
- Audit log imutável de cada comunicação

### Wave 2 — Output + Distribution (Plans 10-04 sequencial; 10-05 pode iniciar após 10-04 plan 50%)

#### Plan 10-04: Geração de PDF + QR Validação + Endpoint Público + Email

**Duration:** 2 weeks (2026-06-27 → 2026-07-11)
**Type:** Build (output rendering)
**Goal:** PDF do laudo com 14 campos RDC, QR code apontando para endpoint público de validação, email transacional com PDF anexo.

**Deliverables:**

- `functions/src/liberacao/generateLaudoPDF.ts` — Puppeteer + template HTML pixel-perfect
- 14 campos RDC 978 Art. 167 mandatory; QR code de validação (canto inferior direito)
- `functions/src/liberacao/validarLaudoPublico.ts` — endpoint público (rate-limited 60req/h por IP) que retorna metadata sem PII (apenas hash, RT, timestamp, versão atual, "superado" flag)
- `functions/src/liberacao/enviarLaudoEmail.ts` — nodemailer + PDF anexo + tracking (opened/clicked via Resend?)
- Storage bucket: `gs://hmatologia2.appspot.com/laudos/{labId}/{laudoId}/v{version}.pdf`

#### Plan 10-05: Portal Médico (Auth Externa + Dashboard)

**Duration:** 2.5 weeks (2026-07-11 → 2026-07-29)
**Type:** Build (new surface)
**Goal:** Portal `/portal-medico` com auth externa (médicos solicitantes), dashboard de pacientes que ele solicitou, download de laudos, histórico de versões.

**Deliverables:**

- Rota separada `/portal-medico` (subdomain ou path; decisão em CONTEXT.md)
- Firebase Auth com claim `medicoSolicitante: true` + `crm: string`
- `MedicoDashboard.tsx` — listagem de laudos onde `medicoSolicitanteId === request.auth.uid`
- `LaudoDetail.tsx` — visualização do laudo + download PDF + histórico de versões
- Multi-tenant transversal: médico pode atender múltiplos labs (filtro por lab no dashboard)
- Onboarding: lab convida médico via email → médico cadastra senha → CRM validado contra master Worklab
- Dark-first design (consistente com app principal); brand neutro (white-label-ready)

### Wave 3 — Closure

#### Plan 10-06: E2E + Integration Testing + Edge Cases

**Duration:** 1.5 weeks (2026-07-29 → 2026-08-08)
**Type:** Build (quality)
**Goal:** Suite E2E cobrindo fluxos críticos (técnico → RT → comunicação → médico portal), integration tests entre componentes, edge cases (retificação, desfazer comunicação, médico inativo).

**Deliverables:**

- `e2e/liberacao.spec.ts` — 8 fluxos críticos
- `e2e/criticos.spec.ts` — 4 fluxos críticos
- `e2e/portal-medico.spec.ts` — 3 fluxos críticos
- Integration tests: state machine + signature + audit chain
- Edge cases: retificação de laudo já comunicado; médico solicitante inativo; PDF corrompido; QR validation contra laudo deletado

#### Plan 10-07: Polish + A11y + Perf + Deploy Progressivo

**Duration:** 1 week (2026-08-08 → 2026-08-15)
**Type:** Build (deploy)
**Goal:** A11y AA, Web Vitals targets, ADR 0009 (state machine híbrida), deploy progressivo, smoke Riopomba.

**Deliverables:**

- A11y AA audit (axe-core + manual screen reader)
- Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 nas rotas /liberacao/_, /portal-medico/_
- Bundle: chunks `module-liberacao` ≤ 180KB gzip, `module-portal-medico` ≤ 120KB gzip
- ADR 0009: documenta state machine híbrida + classificação de exame
- Deploy ordem: rules+indexes → functions → hosting → portal-medico (se separado)
- Smoke staging Riopomba: 3 fluxos reais (RT libera, crítico, médico portal)
- CLAUDE.md root: módulos `liberacao-laudos`, `criticos`, `portal-medico` em prod (3 novos)

---

## Cross-Plan Wave Diagram

```
Wave 1: Foundation                Wave 2: Output             Wave 3: Closure
┌─────────────────────┐          ┌──────────────────┐       ┌──────────────┐
│ 10-01 Schema/State  │ ────┬──▶│ 10-04 PDF + QR    │ ────▶│ 10-06 E2E    │
└─────────────────────┘     │   └──────────────────┘       └──────────────┘
          │                 │            │                          │
          ▼                 │            ▼                          ▼
┌─────────────────────┐     │   ┌──────────────────┐       ┌──────────────┐
│ 10-02 RT + Auto     │ ────┤   │ 10-05 Portal Med │ ────▶│ 10-07 Deploy │
└─────────────────────┘     │   └──────────────────┘       └──────────────┘
          ▼                 │
┌─────────────────────┐     │
│ 10-03 Críticos+Email│ ────┘
└─────────────────────┘
```

**Critical path:** 10-01 → 10-02 → 10-04 → 10-06 → 10-07.
**Parallel slack:** 10-03 paralelo a 10-02 (após types prontos); 10-05 paralelo a 10-04 (após PDF generator pronto).

---

## Risk Register

| Risk                                                                        | Severity | Likelihood | Mitigation                                                                                                                        |
| --------------------------------------------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Auditor rejeita LogicalSignature SHA-256 (exige ICP-Brasil)                 | 🔴       | Baixo      | ADR 0009 explícita: precedentes ANVISA + audit chain imutável; ICP-Brasil disponível como upgrade v1.4 (não retrabalho de schema) |
| Auto-liberação aprova laudo problemático (crítico não detectado)            | 🔴       | Médio      | Defesa em camadas: classificação + Westgard + thresholds críticos + RT review por exceção; auditor logger persistente             |
| Portal médico vira surface de attack (auth externa exposta)                 | 🟠       | Médio      | Rate limiting agressivo, MFA opcional, pen test antes de prod, claim isolado (médico não acessa /labs/\*)                         |
| 14 campos RDC 978 Art. 167 + QR code não cabem em página A4 sem ficar denso | 🟡       | Médio      | Spike de 1 dia em 10-04 com layout em 2 páginas se necessário; rodapé QR + footer condensado                                      |
| Email entregue mas spam/quarentena (lab perde comunicação)                  | 🟠       | Alto       | SPF + DKIM + DMARC configurados; whitelist com clientes; alerta visual no dashboard "email em quarentena"                         |
| Worklab cache de médicos solicitantes desatualizado (CRM inválido)          | 🟡       | Médio      | Sync nightly + manual refresh button; fallback de cadastro local se Worklab offline                                               |
| Histórico de versões cresce sem limite (storage cost)                       | 🟡       | Baixo      | Retenção mínima 5 anos (RDC); arquivamento Glacier após 1 ano; máximo 20 versões por laudo (UI bloqueia v21)                      |
| Volumes Riopomba (~500 laudos/dia) saturam Firestore writes                 | 🟡       | Baixo      | Batch writes onde possível; monitorar quota; caching agressivo no portal                                                          |

---

## Success Criteria (Phase 10 done)

1. Módulo `liberacao-laudos` deployado em produção (URL `/liberacao`)
2. Módulo `criticos` deployado em produção (URL `/criticos/admin`)
3. Portal médico deployado em produção (URL `/portal-medico`)
4. RT consegue liberar laudo manualmente em <30s (UX target)
5. Auto-liberação funciona para 80% dos laudos rotina (cobertura medida em 100 laudos staging)
6. PDF do laudo tem 14 campos RDC 978 Art. 167 — validado por auditor amigo (Quality Manager Riopomba)
7. QR code aponta para endpoint público; valida hash + retorna metadata sem PII
8. Email transacional com PDF anexo entrega ≥98% inbox (não spam) — testado com 10 emails diferentes
9. Médico solicitante cria conta no portal, vê apenas seus pacientes, baixa PDF
10. Crítico detectado → email enviado → log imutável → comunicação verbal pode ser registrada manualmente
11. Retificação cria v2 imutável; v1 marcada "Superado"; download bloqueado em v1 se v2 existe
12. Audit chain: chainHash sequência de 100 liberações sem buracos
13. Compliance: RDC 978 Arts. 167, 184-191 atendidos; DICQ 5.7-5.9 atendidos
14. Web Vitals: LCP <2.5s nas rotas críticas

---

## Skills GSD utilizadas

- ✅ `/gsd-discuss-phase 10` (conduzido inline com base em síntese Obsidian — 4 perguntas críticas)
- ✅ `/gsd-plan-phase 10` (este overview + 7 PLAN.md)
- `/gsd-execute-phase 10 --wave 1` — após Phase 9 plan 03 estar verde
- `/gsd-validate-phase 10` — antes de deploy final em 10-07
- `/gsd-secure-phase 10` — pen test do portal médico (alta prioridade)
- `/gsd-eval-review 10` — se IA crítico classifier for usado em algum momento (não MVP)

---

## Canonical References

**Obsidian:**

- `~/Obsidian_Brain/01_Projetos/HC_Quality_Compliance_DICQ.md` — Bloco G (5.7.x), Bloco I (5.8.x, 5.9.x)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_2025_Resumo.md` — Arts. 167 (14 campos), 184-191 (críticos+liberação)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_vs_786_vs_DICQ.md` — divergências entre normas
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Checklist_Auditoria.md` — itens 5.7-5.9
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Visao.md` — RT papel + brand
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Dossie_Concorrentes_2026-04-28.md` — lacuna de mercado
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Decisoes_Abertas.md` — multi-tenant, ICP-Brasil

**Código vivo (referência/reuso):**

- `src/features/auditoria/` — pattern de chainHash + LogicalSignature em sub-coleção
- `src/features/auditoria/components/generatePDF.ts` (functions) — Puppeteer + 10MB limit
- `src/features/educacao-continuada/` — assinatura RT em certificados
- `src/features/analyzer/components/ReviewRunModal.tsx` — pattern de RT review + override
- `src/shared/services/firebaseService.ts` — `subscribeToState` 5 layers

**ADRs (manter consistência):**

- `docs/adr/0001-audit-chain.md` — chainHash + LogicalSignature (base)
- `docs/adr/0002-multi-tenant-firestore.md` — convenções multi-tenant
- ADR 0009 (a criar em 10-07): state machine híbrida + classificação de exame

**Specs/Rules:**

- `.claude/rules/firestore-security.md` — invariantes (validSignature, labIdMatches)
- `.claude/rules/performance.md` — Web Vitals targets, manualChunks
- `.claude/rules/deploy-protocol.md` — ordem de deploy

---

## Next Step

Após Phase 9 plan 03 (Westgard CLSI + LJ) atingir 60% e Phase 8 estar em 60%, time pode iniciar Wave 1 de Phase 10:

```bash
/gsd-execute-phase 10 --wave 1
```

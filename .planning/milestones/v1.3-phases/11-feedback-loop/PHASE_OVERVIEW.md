---
phase: "11-feedback-loop"
title: "Phase 11 — Reclamações + Satisfação + Sugestões (Feedback Loop)"
milestone: v1.3
status: planning
total_plans: 8
start_date: 2026-06-03
end_date: 2026-08-25
duration_weeks: 12
priority: P1
stream: B
parallel_with: [08-capa-closure, 09-bioquimica, 10-liberacao-criticos]
revision: 1.0
---

# Phase 11: Reclamações + Satisfação + Sugestões (Feedback Loop Completo)

**Milestone:** v1.3 (CAPA Closure + Compliance + Migração Riopomba)
**Stream:** B (parallel)
**Priority:** P1 (compliance DICQ 4.8 + 4.14.3 + 4.14.4 + entrada 4.15 Análise Crítica Direção)
**Period:** 2026-06-03 → 2026-08-25 (12 weeks; ~12.5 weeks de execução real)
**Combined rationale:** DICQ trata os 3 itens como um único feedback loop. Construir separados gera retrabalho de integração + RT teria 3 dashboards.
**Revision:** 1.0

---

## Goal

Construir o **feedback loop completo** do HC Quality cobrindo 3 itens DICQ em 1 phase: reclamações com RCA + satisfação NPS + sugestões. Multi-canal de entrada (5 canais, incluindo embed no app de laudos Worklab via deep link), classificação automática via Gemini IA, integração automatizada com módulo NC existente, portal cliente externo (paciente acompanha status), trending dashboard com Pareto e indicadores para Análise Crítica Direção (DICQ 4.15).

**Output:** 4 surfaces deployadas:
- `/reclamacoes` (RT + Qualidade)
- `/satisfacao` (admin)
- `/sugestoes` (todos os usuários)
- `/portal-paciente` (auth externa, paciente acompanha)

Mais integração via deep link com Worklab LIS (`https://hmatologia2.web.app/portal-paciente/reclamacao/nova?examCode=XXX&cpf=YYY`).

---

## Strategic Context

### Por que Feedback Loop agora

- **DICQ 4.8 (Reclamações):** 0% coberto. Phase 11 sobe pra 100%.
- **DICQ 4.14.3 (Satisfação):** 0% coberto. Phase 11 sobe pra 100%.
- **DICQ 4.14.4 (Sugestões):** 0% coberto. Phase 11 sobe pra 100%.
- **DICQ 4.15 (Análise Crítica Direção):** 4 das 15 entradas obrigatórias dependem deste módulo (satisfação, sugestões, reclamações, melhoria contínua). Sem Phase 11, reunião anual de direção não tem dados.
- **LGPD:** PII de reclamantes precisa de tratamento explícito (consentimento, retenção, anonimização, direito de acesso). Phase 11 implementa o framework.
- **Lacuna de mercado:** nenhum concorrente brasileiro (Acredite.se, SysQuali, PNCQ Gestor, QualiChart, CI Online) faz feedback unificado com IA classificação + portal cliente. HC Quality vira diferencial de venda.
- **CDC (Lei 8.078/90):** prazo 30 dias de resposta a reclamação. Phase 11 enforces SLA.

### Decisões locked (do discuss-phase 2026-05-06)

| Decisão | Valor | Rationale |
|---------|-------|-----------|
| Canais entrada | Multi-canal (web form público + email + telefone log + QR no laudo + recepção + deep link Worklab) | Cobre 100% dos canais reais; DICQ-amigável; Worklab embed via deep link evita iframe cross-origin |
| RCA método | 5 Whys (template estruturado) | Padrão indústria, mais simples; Ishikawa fica como upgrade v1.4 |
| NC auto-trigger | Reclamação severity='alta' cria NC draft automática | RT aprova/rejeita; reusa workflow NC existente; auditor amigável |
| NPS timing | Pós-resolução reclamação + recurring trimestral via email | Captura satisfação no momento certo; recurring para trending; anonimização após 90d |
| IA classificação | Gemini 2.5 Flash sugere tipo + severity + área | RT aprova/edita; reduz tempo de triagem em ~60%; trending mais preciso |
| Sugestões | Módulo separado (`/sugestoes`) | Não mistura com reclamação; workflow mais leve (aberta → analisada → implementada) |
| Trending | Dashboard com Pareto + NPS evolução + RCA closure rate + heatmap | Insumo direto para 4.15 Análise Crítica Direção |
| Portal cliente | `/portal-paciente` com auth externa | Paciente acompanha status; reusa pattern de portal médico (Plan 10-05) |
| Worklab embed | Deep link parametrizado (não iframe) | Evita CSP issues; Worklab adiciona link no app deles apontando para HC Quality |
| LGPD base legal | Obrigação legal (RDC 978 retenção 5a) + consentimento explícito para dados pessoais | Cobre auditoria + LGPD |
| Retenção/anonimização | 5 anos com PII; após, anonimização para análise estatística | RDC 978 + LGPD compliance |
| Defer v1.4 | Ishikawa visual, WhatsApp Business, integração ouvidoria/PROCON, integração CFM API | Backlog |

---

## Plan Structure

Phase 11 has **8 plans** organized em 3 ondas (paralelismo otimizado):

### Wave 1 — Foundation + Intake (Plans 11-01 sequencial; 11-02 + 11-04 + 11-05 paralelos após)

#### Plan 11-01: Schema + Types + Service + RCA 5 Whys + NC Auto-Trigger
**Duration:** 1.5 weeks (2026-06-03 → 2026-06-13)
**Type:** Build (foundation)
**Goal:** Tipos completos (Reclamacao, Sugestao, Satisfacao, RCAFiveWhys, ClassificacaoAuto), service multi-tenant, integração com NC, schema Firestore, rules, indexes.

#### Plan 11-02: Multi-Canal Intake + IA Classificação Gemini
**Duration:** 2 weeks (2026-06-13 → 2026-06-27)
**Type:** Build (intake surface)
**Goal:** 5 canais de entrada operacionais (web form interno, web form público, email parser, telefone log manual, QR no laudo via Plan 10, deep link Worklab), Gemini classifica reclamação automaticamente, RT aprova/edita.

#### Plan 11-04: Satisfação NPS (Pós-Resolução + Recurring Trimestral)
**Duration:** 1.5 weeks (2026-06-27 → 2026-07-08)
**Type:** Build (NPS engine)
**Goal:** Pesquisa NPS automática pós-resolução de reclamação; cron trimestral envia email para base de pacientes; anonimização após 90d; trending agregado.

#### Plan 11-05: Sugestões — Módulo Separado
**Duration:** 1.5 weeks (2026-07-08 → 2026-07-18)
**Type:** Build (sugestões surface)
**Goal:** Surface `/sugestoes` para colaboradores (interno) + paciente (público); workflow simples (aberta → analisada → implementada/rejeitada); categorização (produto, processo, ambiente, atendimento).

### Wave 2 — Workflow + Distribution

#### Plan 11-03: Status Workflow + Notificação Email + RCA UI
**Duration:** 1.5 weeks (2026-07-08 → 2026-07-18; paralelo a 11-05)
**Type:** Build (workflow)
**Goal:** State machine de reclamação (Nova → Analisando → RCA → Resolvida → Comunicada → Fechada), notificação email a cada transição (Resend), UI de RCA 5 Whys interativa, SLA tracker.

#### Plan 11-06: Portal Cliente Externo
**Duration:** 2 weeks (2026-07-18 → 2026-08-01)
**Type:** Build (new surface)
**Goal:** `/portal-paciente` com auth externa (CPF + senha + 2FA opcional), paciente vê status de reclamações, sugestões enviadas, histórico de laudos (read-only via Plan 10-05 pattern), notificações.

### Wave 3 — Insights + Closure

#### Plan 11-07: Trending Dashboard + Pareto + Integração 4.15
**Duration:** 1.5 weeks (2026-08-01 → 2026-08-12)
**Type:** Build (insights)
**Goal:** Dashboard `/reclamacoes/insights` com KPIs (NPS evolução, taxa reclamações/mês, RCA closure rate, Pareto top 5 tipos, heatmap por área), exportação para Análise Crítica Direção (DICQ 4.15), integração com management-review module (Phase 8).

#### Plan 11-08: E2E + A11y + LGPD + Deploy
**Duration:** 1 week (2026-08-12 → 2026-08-19)
**Type:** Build (deploy)
**Goal:** E2E suite, a11y AA, Web Vitals targets, LGPD audit (consentimento, anonimização, direito de acesso), ADR 0011 (feedback loop architecture), deploy progressivo, smoke staging Riopomba.

---

## Cross-Plan Wave Diagram

```
Wave 1: Foundation + Intake             Wave 2: Workflow                Wave 3: Insights + Deploy
┌────────────────────────┐              ┌─────────────────────┐         ┌──────────────────────┐
│ 11-01 Schema + RCA     │ ──┬───────▶│ 11-03 Status + RCA  │ ──────▶│ 11-07 Trending+Pareto│
└────────────────────────┘   │         │       Workflow + UI │         └──────────────────────┘
            │                │         └─────────────────────┘                     │
            ▼                │                   │                                  ▼
┌────────────────────────┐   │                   ▼                       ┌──────────────────────┐
│ 11-02 Multi-Canal+IA   │ ──┤         ┌─────────────────────┐         │ 11-08 E2E+A11y+LGPD │
└────────────────────────┘   │         │ 11-06 Portal Pac.   │ ──────▶│        +Deploy       │
            ▼                │         └─────────────────────┘         └──────────────────────┘
┌────────────────────────┐   │
│ 11-04 NPS Satisfação   │ ──┤
└────────────────────────┘   │
            ▼                │
┌────────────────────────┐   │
│ 11-05 Sugestões        │ ──┘
└────────────────────────┘
```

**Critical path:** 11-01 → 11-03 → 11-06 → 11-08.
**Parallel slack:** 11-02, 11-04, 11-05 todos paralelos após 11-01 (após types prontos); 11-07 paralelo a 11-06 (após dados de 11-03 disponíveis).

---

## Risk Register

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|-----------|
| Gemini classificação errada gera reclamações mal-roteadas | 🟠 | Médio | RT sempre aprova/edita sugestão IA antes de submit; logs de aceite/rejeição alimentam fine-tuning futuro |
| Volume de NPS recurring (trimestral) gera saturação Resend | 🟡 | Baixo | Rate limit 1000 emails/min; queue Pub/Sub; warm-up domain |
| Deep link Worklab quebra se Worklab muda URL params | 🟡 | Médio | Versionar params (?v=1); documentar contrato com Worklab; fallback gracious "link expirado" |
| Reclamação anônima requerida por algum cliente | 🟡 | Baixo | UI tem checkbox "Manter anônimo"; mas requer hash do CPF para evitar duplicatas; LGPD-compliant |
| Portal cliente vira surface de attack (auth externa exposta) | 🟠 | Médio | Rate limit agressivo, MFA opcional, pen test em 11-08, claim isolado (paciente não acessa /labs/*) |
| LGPD: PII de reclamante (dado sensível pois revela problema saúde) tem retenção menor | 🟠 | Médio | ADR 0011 documenta: 5 anos com PII (RDC 978) + anonimização após para análise estatística; documentar base legal por finalidade |
| RCA 5 Whys insuficiente para casos complexos | 🟢 | Baixo | Auditor pode pedir Ishikawa; Phase 11.5 (futuro) adiciona |
| NPS taxa de resposta baixa (<10%) | 🟡 | Alto | Email pós-resolução tem chance maior (~30%); copy persuasivo; incentivo opcional (sorteio?) — não MVP |
| Volume Riopomba: 50 reclamações/mês + 200 NPS/trimestre = OK; mas se crescer pra 500 reclamações/mês, RT vira gargalo | 🟢 | Baixo | IA pre-classifica reduz tempo RT; v1.4 considera auto-resolução de reclamações simples |

---

## Success Criteria (Phase 11 done)

1. 4 surfaces deployadas em produção:
   - `/reclamacoes` (interno RT + Qualidade)
   - `/satisfacao` (admin de pesquisas)
   - `/sugestoes` (interno + público)
   - `/portal-paciente` (auth externa)
2. 5 canais de entrada funcionando:
   - Web form interno (recepção cadastra)
   - Web form público (paciente direto via portal)
   - Email parser (`reclamacoes@hmatologia2.web.app`)
   - Telefone log manual (UI de cadastro)
   - QR no laudo (deep link via PDF de Plan 10-04)
   - Deep link Worklab (link parametrizado fornecido a Worklab)
3. Gemini classificação automática funcional: ≥80% de aceite RT em 100 reclamações teste
4. RCA 5 Whys: template + UI permite preencher; obrigatório para severity 'alta' antes de fechar
5. NC auto-trigger: reclamação 'alta' cria NC draft em <5s; RT aprova/rejeita
6. NPS pós-resolução: email enviado em <1h após reclamação resolvida; taxa de resposta target ≥25%
7. NPS recurring trimestral: cron executa; segmenta pacientes ativos; respostas agregam ao trending
8. Portal cliente: paciente cadastra (CPF + senha) → vê reclamações suas → recebe notificação status change
9. Trending dashboard: 5 KPIs visíveis (NPS evolução, taxa reclamações, RCA closure rate, Pareto top 5, heatmap área)
10. Integração 4.15: dashboard exporta JSON/PDF para Management-Review module (Phase 8) automaticamente
11. LGPD: consentimento UI presente, anonimização após 90d funcionando, "exportar meus dados" UI funcional
12. Compliance: DICQ 4.8 + 4.14.3 + 4.14.4 atendidos; RDC 978 retenção 5a; LGPD Art. 7, 8, 18
13. Web Vitals: LCP <2.5s, INP <200ms, CLS <0.1 nas 4 surfaces

---

## Skills GSD utilizadas

- ✅ `/gsd-discuss-phase 11` (conduzido inline com base em síntese Obsidian — 4 perguntas críticas)
- ✅ `/gsd-plan-phase 11` (este overview + 8 PLAN.md)
- `/gsd-execute-phase 11 --wave 1` — após Phase 9 plan 03 + Phase 10 plan 02 estarem verde
- `/gsd-validate-phase 11` — antes de deploy final em 11-08
- `/gsd-secure-phase 11` — pen test do portal paciente
- `/gsd-eval-review 11` — Gemini classifier evaluation (HIGH PRIORITY: tem IA)

---

## Canonical References

**Obsidian:**
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Compliance_DICQ.md` — 4.8, 4.14.3, 4.14.4, 4.14.6, 4.15
- `~/Obsidian_Brain/01_Projetos/HC_Quality_RDC_978_2025_Resumo.md` — Arts. 86, 115, 117 (retenção)
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Checklist_Auditoria.md` — itens 4.8, 4.14.x, 4.15
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Visao.md` — diferenciação produto
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Dossie_Concorrentes_2026-04-28.md` — lacuna mercado
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Decisoes_Abertas.md` — LGPD, multi-tenant
- `~/Obsidian_Brain/01_Projetos/HC_Quality_Zero_Acreditacao/` — Módulo 1.9 (template PNCQ)

**LGPD/Lei:**
- LGPD Lei 13.709/18 — Arts. 7, 8, 9, 11, 18
- CDC Lei 8.078/90 — Arts. 6, 26 (prazo resposta)
- ANPD Guia Orientativo "Tratamento de dados pessoais para fins de proteção do crédito" (referencial)

**Código vivo:**
- `src/features/auditoria/` — pattern checklist + achados + status workflow
- `src/features/educacao-continuada/` — pesquisa de satisfação embutida (referência para NPS)
- `src/features/portal-medico/` (Plan 10-05) — pattern auth externa
- `src/features/sgq/` — pattern documental
- AuditLogs imutável (ADR 0001)

**ADRs:**
- ADR 0001 (audit chain)
- ADR 0002 (multi-tenant)
- ADR 0010 (portal externo Plan 10) — replicar pattern para portal-paciente
- ADR 0011 (a criar): feedback loop architecture + LGPD framework

**Specs/Rules:**
- `.claude/rules/firestore-security.md`
- `.claude/rules/performance.md`
- `.claude/rules/deploy-protocol.md`
- `.claude/rules/module-protection.md`

---

## Next Step

Após Phase 9 plan 03 + Phase 10 plan 02 estarem verdes, time pode iniciar Wave 1 de Phase 11:

```bash
/gsd-execute-phase 11 --wave 1
```

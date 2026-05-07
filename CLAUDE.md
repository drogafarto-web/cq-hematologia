# HC Quality — CQ Labclin

Sistema SaaS multi-tenant de Controle Interno de Qualidade para laboratórios clínicos.
Stack: **React 19 + TS 5.8 + Vite 6 · Zustand 5 · Firebase 12 · Gemini 2.5 Flash · Tailwind**.

Em produção: **<https://hmatologia2.web.app>** (region functions: `southamerica-east1`).

---

## Como este projeto é documentado

O contexto do projeto vive em **camadas** — carrega só o que precisa para a tarefa. Ver [`.claude/CONTEXT_PROTOCOL.md`](.claude/CONTEXT_PROTOCOL.md) para o protocolo completo.

- **Este arquivo** (root CLAUDE.md) — panorama + convenções globais + lista de módulos. Carrega em toda sessão.
- **`.claude/rules/*.md`** — regras condicionais por path glob (só carregam quando tocar arquivos relevantes).
- **`src/features/<módulo>/CLAUDE.md`** — regras de negócio, fases e pendências de cada módulo.
- **`.claude/docs/INITIAL_SPEC_legacy.md`** — especificação inicial completa de 2026-04 (backup, não carregar por padrão).

**Regra ativa**: quando um módulo concluir milestone, atualizar a seção "Módulos em produção" abaixo com uma linha.

---

## Convenções invioláveis (aplicam a todo o codebase)

- **Multi-tenant**: toda coleção de domínio vive em `/<coleção>/{labId}/<sub>` ou `/labs/{labId}/<coleção>/<sub>`. Payload carrega `labId` redundante.
- **RN-06 — soft delete only**: nunca `deleteDoc`; sempre `softDelete*` do service.
- **Assinatura**: `LogicalSignature = { hash, operatorId, ts }` com `operatorId === request.auth.uid`. Rules validam `hash.size() == 64` + `ts is timestamp`.
- **Thin service, fat hooks**: service cobre CRUD + mapping snapshot → entidade. Hooks carregam validações de negócio (RN-*), orquestração atomic (`writeBatch`), geração de assinatura.
- **Escrita regulatória via Cloud Function callable** (Fase 0b+). Client só lê dessas coleções. Service client-side `create*` fica deprecated por 1 sprint antes de remover.
- **Input DTOs via `Omit<Entidade, 'id'|'labId'|'criadoEm'|'deletadoEm'>`** — service é a única fonte de audit fields.
- **Auth e módulos protegidos**: não tocar `auth`, `admin`, `shared` sem autorização explícita.
- **Design dark-first, world-class**: Apple/Linear/Stripe de referência; sem templates genéricos; tipografia editorial; sensibilidade cinematográfica (ver `~/.claude/CLAUDE.md` global).

Regras com escopo mais estreito vivem em `.claude/rules/`:

- [`module-protection.md`](.claude/rules/module-protection.md) — isolamento entre módulos (triggers: `src/features/**`)
- [`firestore-security.md`](.claude/rules/firestore-security.md) — rules + services + callables (triggers: `firestore.rules`, `**/*Service.ts`, `functions/**`)
- [`deploy-protocol.md`](.claude/rules/deploy-protocol.md) — ordem de deploy + PWA SW (triggers: `firebase.json`, `functions/**`, etc)

**Onboarding for new engineers (Phase 3+):**

- [`PHASE_3_TRAINING.md`](docs/PHASE_3_TRAINING.md) — 1-day hands-on onboarding for engineers joining Phase 3 work. 5-step path (emulator + rules + helpers + functions + deploy), module deep-dives, copy-paste task templates, troubleshooting FAQ. Start here for any new teammate.

**Post-Deployment Monitoring (v1.3+):**

- [`CLOUD_LOGS_MONITORING_GUIDE.md`](docs/CLOUD_LOGS_MONITORING_GUIDE.md) — 24h Cloud Logs setup após Step 2 (Functions deploy). Includes filters, red flags, sign-off template.
- [`CLOUD_LOGS_QUICK_REFERENCE.md`](docs/CLOUD_LOGS_QUICK_REFERENCE.md) — TL;DR commands + cheat sheet. Print and bookmark.
- [`CLOUD_LOGS_INTEGRATION_CHECKLIST.md`](docs/CLOUD_LOGS_INTEGRATION_CHECKLIST.md) — deployment workflow integration (pre/during/post tasks).
- [`scripts/monitor-cloud-logs.sh`](scripts/monitor-cloud-logs.sh) — automated Bash script (macOS/Linux).
- [`scripts/monitor-cloud-logs.ps1`](scripts/monitor-cloud-logs.ps1) — automated PowerShell script (Windows).

Use: `bash scripts/monitor-cloud-logs.sh 24 30` (or `.ps1` equiv.) imediatamente após deploy. Gera report + JSON export. Não-bloqueante; roda em paralelo.

---

## v1.3 Archive & v1.4 Roadmap

**v1.3 Complete & Live (2026-05-07):**

- Archive: [`.planning/milestones/v1.3-ARCHIVE.md`](.planning/milestones/v1.3-ARCHIVE.md) — 1-pager consolidado
- Completion summary: [`.planning/milestones/v1.3-COMPLETION-SUMMARY.md`](.planning/milestones/v1.3-COMPLETION-SUMMARY.md) — full technical details
- Compliance summary: [`.planning/milestones/COMPLIANCE_SUMMARY_v1.3.md`](docs/COMPLIANCE_SUMMARY_v1.3.md) — DICQ/RDC/LGPD mapping
- Deployment roadmap: [`.planning/milestones/DEPLOY_ROADMAP_v1.3.md`](.planning/milestones/DEPLOY_ROADMAP_v1.3.md) — sequence + rollback

**v1.4 Kickoff (Phases 4–15):**

- Roadmap: [`.planning/milestones/v1.4-KICKOFF-SUMMARY.md`](.planning/milestones/v1.4-KICKOFF-SUMMARY.md) — Phase 4 (2026-05-20) through Phase 15 (2026-11-30)
- Phase 0–3 already complete (2026-05-07)
- **Phase 4 Task 04-03 (NOTIVISA Integration):** [`v1.4_NOTIVISA_SANDBOX_SETUP.md`](docs/v1.4_NOTIVISA_SANDBOX_SETUP.md) — Government API sandbox onboarding, payload validation, workflow testing, audit trail setup. Start immediately (gov provisioning 3–5 days). Linked with ADR-0014 + ADR-0021.

---

## Módulos em produção

> **Dever de atualização**: cada módulo mantém sua própria linha aqui. Após milestone no módulo, editar.

| Módulo | Status | Última entrega |
| --- | --- | --- |
| `analyzer` | Em prod · OCR Yumizen H550 via Gemini | — |
| `coagulacao` | Em prod · CIQ coagulação | — |
| `ciq-imuno` | Em prod · CIQ imunologia qualitativa | — |
| `insumos` | Em prod · controle de insumos | — |
| `controle-temperatura` | Em prod · FR-11 + IoT ESP32 + calibração + assinatura callable | 2026-05-04 |
| `uroanalise` | Em prod · uroanálise | — |
| `equipamentos` | Em prod · cadastro de equipamentos | — |
| `fornecedores` | Em prod · cadastro de fornecedores | — |
| `lots` | Em prod · gestão de lotes CQ | — |
| `runs` | Em prod · corridas de controle | — |
| `chart` | Em prod · Levey-Jennings | — |
| `reports` | Em prod · relatórios | — |
| `labSettings` | Em prod · config de lab | — |
| `hub` | Em prod · dashboard de módulos | — |
| `bulaparser` | Em prod · parse de bulas | — |
| `auth` | Em prod · autenticação/onboarding | — |
| `admin` | Em prod · superadmin | — |
| `educacao-continuada` | Em prod · ISO 15189 + XLSX + callables server-side | 2026-04-24 |
| `sgq` | Em prod · Documentos da Qualidade (DICQ 4.3) — MQ/PQ/IT/FR/POL + versionamento + audit + POL-LGPD-001 + IT-LGPD-DPIA-001 (Phase 0) | 2026-05-07 |
| `pops` | Em prod · Procedimentos Operacionais Padrão (DICQ 4.3) — versionamento + treinamento + assinatura RT | 2026-05-03 |
| `auditoria` | Em prod · Trilha de audit (write intent + read consent) — RDC 978 5.3 + DICQ 4.4 | 2026-05-03 |
| `sgd` | Em prod · Sistema de Gestão Documental (DICQ 4.3) — Lista Mestra, hierarquia, distribuição, Drive importer + Riopomba migration (80 docs) | 2026-05-06 |
| `treinamentos` | Em prod · Sistema de registro de treinamentos com vínculo a POPs + certificação + revalidação | 2026-05-05 |
| `biosseguranca` | Em prod · Gestão de áreas de risco, níveis NB1-NB4, EPE + inspeções com ISO 14644 | 2026-05-05 |
| `pgrss` | Em prod · Gestão de resíduos (RDC 222/2018) — segregação, coleta, comprovantes | 2026-05-05 |
| `kpis` | Em prod · Dashboard de KPIs — turnaround, retrabalho%, conformidade, NC origem, SLA | 2026-05-05 |
| `lgpd` | Em prod · Política de privacidade + direitos do titular + DPIA + exclusão com audit trail | 2026-05-05 |
| `analytics` | Em prod · Phase 3.3 — polling 30s, date/equipment/operator filters, PDF export CF, tablet responsive | 2026-05-05 |
| `export` | Em prod · Phase 3.3 — ExportWizard 4-step + XLSX CF + PDF compress + email + batch+scheduled | 2026-05-05 |
| `mobile` | Em prod · Phase 3.3 — NativeWind dark theme + biometric auth + Detox E2E (5 critical flows) | 2026-05-05 |
| `ceq` | Em prod · Controle de Qualidade Externo — participação externa, z-score, comparação interlaboratorial | 2026-05-05 |
| `bioquimica` | Em prod · CIQ quantitativo + Westgard CLSI + Levey-Jennings | 2026-05-07 |
| `turnos` | Em prod · Registro de supervisão de turnos (RDC 978 Art. 122 + RDC 786 + DICQ 4.1.2.7) | 2026-05-07 |
| `risks` | Em prod · Gestão de Riscos (FMEA-Lite P×S×D, NPR 1–125, revisão periódica) — RDC 978 Art. 86 + DICQ 4.14.6 | 2026-05-07 |
| `lab-apoio` | Em prod · Contratos com labs de apoio (CNPJ + AVS + vigência + exames terceirizados + avaliação anual — RDC 978 Arts. 36–39 + DICQ 4.14.8) | 2026-05-07 |

**Phase 2 — COMPLETE (2026-05-05):** Todos os 20 módulos em produção. 347/347 testes passando. ADRs 0005+0002+0006+0003+0004 todos deployados.

**Phase 9 — COMPLETE (2026-05-07):** Bioquímica (módulo 25) em produção. 2,700+ LOC, 42 testes, WCAG AA, RDC 978 + DICQ 4.3 compliant. ADR-0008 registrado. v1.3 Deployment complete (Rules+Functions+Hosting). DICQ compliance 78.5%.

**Phase 3 — COMPLETE (2026-05-05):** 3.1 Foundation + 3.2 Core Features + 3.3 Polish todos concluídos. Web TSC limpo. Functions TSC limpo. 738/738 testes passando. Stream C (Lighthouse CI infra) parcialmente completo — auditoria de runtime pendente para próxima milestone. CEQ + Mobile promovidos a Em prod.

**v1.3 ARCHIVED (2026-05-07):** Todas as 35 modules live. DICQ 78.5%. RDC 978 critical articles 100% covered. Ready for v1.4 Phase 4 execution (2026-05-20).

Módulos com documentação dedicada: `educacao-continuada` (próprio CLAUDE.md), `controle-temperatura` (próprio CLAUDE.md), `sgq` (contém pops + auditoria subdomínios), `treinamentos` (HANDOFF.md em desenvolvimento)

---

## Stack + arquitetura (essencial)

- **Estrutura**: feature-based em `src/features/<módulo>/{components,hooks,services,types}`.
- **Estado**: Zustand 5 para global (`useAuthStore`); hooks locais para cada módulo.
- **Queries Firebase**: `onSnapshot` via hook padrão (ver `useColaboradores.ts` em `educacao-continuada` como referência canônica).
- **Validação**: Zod 3 nos payloads de IA e entradas críticas.
- **PWA**: `vite-plugin-pwa` com `registerType: 'autoUpdate'` — deploy novo exige hard reload no browser.
- **Functions**: Node 22 em `southamerica-east1`, callables regionalmente.

## Project IDs

- Firebase: `hmatologia2` · Hosting: `hmatologia2.web.app`
- Module hub: tiles de 18 features acessíveis via `/hub`

## Deploy rápido (detalhes em `deploy-protocol.md`)

```bash
npx tsc --noEmit                                                     # 1. type-check
npm run build                                                        # 2. build
firebase deploy --only hosting --project hmatologia2                 # 3. hosting
```

Deploy requer autorização explícita a cada execução. Nunca encadear `&&` sem ack.

---

## Quando for trabalhar

1. **Continuar tarefa anterior** → `claude --resume`
2. **Trabalhar em módulo específico** → lê `src/features/<módulo>/CLAUDE.md` primeiro
3. **Nova feature / cross-módulo** → consulta `.claude/rules/` aplicáveis + este CLAUDE.md
4. **Nova aba com reset** → cola `src/features/<módulo>/HANDOFF.md` se existir

Para qualquer sessão: o protocolo completo está em [`.claude/CONTEXT_PROTOCOL.md`](.claude/CONTEXT_PROTOCOL.md).

---

## Segundo cérebro (Obsidian)

Visão de longo prazo, decisões abertas, compliance e roadmap vivem em `C:\Users\labcl\Obsidian_Brain\`. **Não duplicar conteúdo aqui** — quando precisar de contexto estratégico ou de acreditação, ler:

- `01_Projetos/HC_Quality.md` — ficha técnica AS-IS (stack + módulos + regras)
- `01_Projetos/HC_Quality_Visao.md` — north star
- `01_Projetos/HC_Quality_Roadmap.md` — fases concluídas + próximas
- `01_Projetos/HC_Quality_Decisoes_Abertas.md` — pendências arquiteturais (multi-tenant, CDN, OCR…)
- `01_Projetos/HC_Quality_Compliance_DICQ.md` — mapa requisito ↔ módulo (blocos A-J)
- `01_Projetos/HC_Quality_Checklist_Auditoria.md` — ~115 itens auditáveis com checkbox
- `01_Projetos/HC_Quality_RDC_978_2025_Resumo.md` — norma legal vigente ANVISA (operacional)
- `01_Projetos/HC_Quality_RDC_978_vs_786_vs_DICQ.md` — comparativo das 3 normas
- `01_Projetos/HC_Quality_Referencias_Normativas.md` — índice dos PDFs oficiais arquivados

**Regra**: ADRs vivem em `c:/hc quality/docs/adr/`; spec/tasks vivem no projeto; **planejamento estratégico e mapas de compliance vivem no Obsidian**.

---

## Diretrizes de comportamento (system rules ativas para este projeto)

Estas seções são **regras de operação** que valem para toda sessão neste projeto. Complementam, sem substituir, o `~/.claude/CLAUDE.md` global.

### 1. Frontend Pro Max (UI/UX)

Toda interface é tratada como produto world-class por padrão. Se a referência implícita for Apple/Linear/Stripe/Vercel/Airbnb, aprovou. Se parecer template, reprovou.

- **Tipografia editorial**: hierarquia clara, kerning/leading intencionais, números tabulares em tabelas de dados (`tabular-nums`), nunca usar tamanho default sem pensar no propósito.
- **Variáveis de design**: cores, espaçamentos, sombras, raios — sempre via tokens em `DESIGN_SYSTEM.md` (dark-first, `bg-[#141417]`, `white/X` alpha, accents `violet-500` e `emerald-500`). Não inventar valores ad-hoc.
- **Composição espacial**: usar grid de 4px (`p-1`, `p-2`, `p-4`, `p-6`, `p-8`); nunca números mágicos como `p-[13px]`. Espaços negativos são parte do design, não sobra.
- **Microinterações**: hover/focus/active com transições 150-200ms; nada brusco, nada lento. Respeita `prefers-reduced-motion`.
- **Realtime**: estados de loading/empty/error/success têm visual próprio; `<Skeleton>` em vez de spinner sempre que possível.
- **Sem libs de ícones**: SVG inline com `currentColor` (decisão registrada em [hcquality_design_tokens]).
- **Crítica antes de shippar**: antes de marcar UI como pronta, comparar com a referência (Apple/Linear/Stripe). Se "não mostraria com orgulho", refazer.

### 2. Web Guidelines (a11y + performance estrutural)

Auditoria contínua, não fase final.

- **Acessibilidade AA mínimo**: contraste 4.5:1 texto normal, 3:1 texto grande; `aria-label` em botões só com ícone; `<button>` para ações, `<a>` para navegação; foco visível sempre; navegação por teclado funcional.
- **Semântica**: `<main>`, `<nav>`, `<section>`, `<article>` no lugar certo. Heading hierarchy correta (`h1` único, sem pular níveis).
- **Imagens**: `loading="lazy"` para imagens fora do viewport; `width`/`height` explícitos para evitar CLS.
- **Bundle**: code-splitting por rota via `React.lazy`; novos imports pesados (>50KB gzip) requerem justificativa.
- **Render**: `React.memo` em componentes de lista; `useMemo`/`useCallback` para deps de hooks de Firebase; `onSnapshot` sempre limpa unsubscribe.
- **Web Vitals alvo**: LCP <2.5s, INP <200ms, CLS <0.1. Se uma mudança piorar, justificar ou reverter.

### 3. Brainstorming + Specs antes de codar

**Aplicabilidade calibrada por escopo** — não é gate universal. Ativa quando o trabalho mexe em arquitetura, novo módulo, mudança de schema cross-módulo, ou refator estrutural. Bug fix pontual e renomeação não passam por isso (overkill mata a velocidade).

**Quando ativa, antes de qualquer código:**

1. **Mapear o terreno**: ler arquivos relevantes do repositório (não tudo, só o que toca). Listar quais.
2. **Propor 2 a 3 abordagens** com prós/contras técnicos honestos. Incluir custo de implementação, custo de manutenção, riscos de regressão e impacto em compliance (RDC 978 / DICQ) quando relevante.
3. **Apontar ambiguidades** em regras de negócio — perguntar, não inferir. Especialmente quando o domínio for clínico/regulatório.
4. **Aguardar aprovação** da abordagem antes de redigir spec/tasks formais.
5. **Após aprovação**, escrever spec curta (decisão + escopo + critérios de aceite) antes de codar.

**Quando NÃO ativa (executar direto):**
- Bug fix em arquivo conhecido
- Renomeação/refactor local sem mudança de comportamento
- Atualização de texto/copy
- Build/deploy steps já documentados

### 4. Token Efficiency

Output enxuto é parte do contrato.

- **Sem preâmbulo**: não anunciar o que vai fazer antes de fazer; só o resultado importa.
- **Sem recap final**: não resumir o que acabei de fazer se o diff já mostra. Resposta de fechamento = 1-2 linhas máx.
- **Diffs cirúrgicos**: usar `Edit` em vez de `Write` para mudanças <50% do arquivo. Não recriar bloco que não mudou.
- **Sem narração de tool calls**: tool já é visível ao usuário; comentar tool call é redundância.
- **Markdown só onde agrega**: bullets quando há lista real; prosa quando é argumento contínuo. Não bullet-tudo por hábito.
- **Sem emojis**: exceto quando o usuário pediu, ou em arquivos de documentação que já adotam (Obsidian).
- **Tradeoff vs Brainstorming (#3)**: quando #3 está ativa, brevidade rende para profundidade — mas só nesses casos. No resto, brevidade vence.

### 5. Skills invocadas (não auto-ativas)

Algumas capacidades vivem como **skills sob demanda** em `.claude/skills/`, não em system rules. Invocar via `Skill` quando o trabalho casar:

- `hcq-copywriting` — copy de marketing, landing, UI textual com gatilhos de conversão. **Não usar em decisões de engenharia.**
- `hcq-ciq-module`, `hcq-module-generator`, `hcq-firestore-rules-generator`, `hcq-deploy-gates` — playbooks de execução técnica.

### 6. Capacidades pendentes de habilitação

Funcionalidades que dependem de setup adicional antes de virarem regra:

- **Auditoria autônoma de UI em browser** — requer MCP Chrome DevTools ou Playwright instalado. Hoje, qualquer "teste de responsividade" depende de execução manual ou `/ultrareview` disparado pelo usuário. Setup documentado em `.claude/docs/AGENT_BROWSER_SETUP.md`.

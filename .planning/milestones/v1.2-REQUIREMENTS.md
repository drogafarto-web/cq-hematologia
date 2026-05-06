# HC Quality — Milestone v1.2 Requirements (Audit Readiness)

**Milestone:** v1.2 — Audit Readiness
**Created:** 2026-05-06
**Deadline:** 2026-06-05 (30 dias)
**Owner:** CTO

---

## Goal

Sistema pronto para sofrer auditoria interna (DICQ 4.3 + RDC 978/2025) em 30 dias, e usar HC Quality como ferramenta para conduzi-la.

---

## v1.2 Active Requirements

### CLEAN — Cleanup do v1.1

Resíduos não-bloqueantes do milestone anterior. Tornam-se débito técnico se não fechados antes de auditoria.

- [ ] **CLEAN-01:** Substituir `// TEMP-IMPLANTACAO` em `firestore.rules` por membership real para coleções `analytics` e `export-jobs`
  - **Acceptance:** auditor revisando rules não vê regra `isAuthenticated()` em coleção sensível; testes de rules cobrem deny para non-member
  - **Mapeamento DICQ:** 4.4 (controle de acesso)

- [ ] **CLEAN-02:** Escrever `docs/PERFORMANCE_PATTERNS.md` cobrindo os padrões já referenciados em `.claude/rules/performance.md` (bundle, listeners, polling, Web Vitals)
  - **Acceptance:** doc existe; referência cruzada com `.claude/rules/performance.md` funcional; cada padrão tem exemplo + anti-pattern
  - **Mapeamento DICQ:** 4.3 (documentação)

- [ ] **CLEAN-03:** Configurar Firebase Performance Monitoring budget alerts (LCP <2.5s, INP <200ms, CLS <0.1) no console
  - **Acceptance:** alertas disparam em ambiente de testes quando budget é violado; print/screenshot anexada como evidência
  - **Mapeamento DICQ:** N/A (qualidade interna)

- [ ] **CLEAN-04:** Capturar baseline Lighthouse runtime contra produção (3 rotas críticas: Hub, CIQ Run, Analytics)
  - **Acceptance:** baseline scores documentados em `docs/PERFORMANCE_BASELINE_2026-05.md`; CI alerta regressão >10%
  - **Mapeamento DICQ:** N/A (qualidade interna)

---

### AUDI — Módulo Auditoria Interna (DICQ 1.3)

Módulo novo. Consome spines `/users` (Pessoa), `/pops` (POP), `/naoConformidades` (NC). Não cria spine nova.

- [ ] **AUDI-01:** Schema `/labs/{labId}/auditorias-internas` com entidades `Auditoria`, `Sessao`, `ChecklistItem`, `Achado`
  - **Acceptance:** TypeScript types em `src/features/auditoria-interna/types/`; Firestore rules deny por padrão; service layer com CRUD soft-delete
  - **Mapeamento DICQ:** 1.3 / RDC 978 5.4

- [ ] **AUDI-02:** Carregar checklist DICQ 4.3 + RDC 978 como template (seed via `Obsidian/HC_Quality_Checklist_Auditoria.md`, ~115 itens)
  - **Acceptance:** template `dicq-4-3-rdc-978-v1` instalável via callable; itens organizados por bloco DICQ (A-J); referência cruzada com requisito normativo
  - **Mapeamento DICQ:** 1.3 + cobertura total

- [ ] **AUDI-03:** Achado de auditoria abre NC global automaticamente (severity-mapped: maior/menor/observação)
  - **Acceptance:** quando achado é classificado como "não conforme maior", CF cria NC com `origem: "auditoria-interna"` e link bidirecional; teste E2E coberto
  - **Mapeamento DICQ:** 1.2 + 1.3 (ponto único de tratamento)

- [ ] **AUDI-04:** Plano anual de auditoria — frequência, áreas, responsáveis, calendário
  - **Acceptance:** UI para criar plano anual; alertas de auditoria próxima (30d, 7d); calendário visual
  - **Mapeamento DICQ:** 1.3 (planejamento)

- [ ] **AUDI-05:** Relatório PDF da sessão de auditoria (Cloud Function `generateAuditReportPDF`)
  - **Acceptance:** PDF gerado com cabeçalho lab + checklist completo + achados + assinatura RT (logical signature); compressão <10MB; armazenado em Storage 5 anos
  - **Mapeamento DICQ:** 1.3 (evidência)

- [ ] **AUDI-06:** UI dark-first compatível com tablet (auditor in-loco)
  - **Acceptance:** smoke teste em iPad/Android tablet 10"; checkboxes ergonômicos; foto evidence (camera ou upload); modo offline-friendly
  - **Mapeamento DICQ:** N/A (UX)

---

### LGPD — Compliance Operacional LGPD

Endurecimento da operação LGPD. Spines existentes (cpfHash, audit log) já estão prontas.

- [ ] **LGPD-01:** DPIA (Data Protection Impact Assessment) preenchida no sistema, exposta a admin
  - **Acceptance:** Documento DPIA em `/labs/{labId}/lgpd/dpia` com versionamento; UI admin renderiza completo; print/PDF exportável
  - **Mapeamento:** LGPD Art. 38

- [ ] **LGPD-02:** Fluxo de exclusão por solicitação do titular — E2E testado
  - **Acceptance:** rota `/exclusao-titular` aceita CPF, valida via OTP/email, dispara CF `deleteTitularData` que zera campos PII e mantém audit; teste E2E coberto
  - **Mapeamento:** LGPD Art. 18 (direitos do titular)

- [ ] **LGPD-03:** Política de privacidade exposta no UI (rodapé + página dedicada)
  - **Acceptance:** rota `/privacidade` renderiza versão atual; versionamento (v1.0, v1.1...); registro de aceite por usuário
  - **Mapeamento:** LGPD Art. 9 (transparência)

---

### DR — Disaster Recovery Formal

Plano formal + comprovação de teste. RDC 978 exige.

- [ ] **DR-01:** Plano de DR documentado em `docs/DR_PLAN.md` (RTO, RPO, runbooks, escalation, dependências)
  - **Acceptance:** doc cobre cenários: corruption Firestore, outage GCP, perda credenciais, ataque ransomware; referenciado em SGQ
  - **Mapeamento:** RDC 978 5.6 (continuidade)

- [ ] **DR-02:** Teste de restore comprovado (1 execução em ambiente staging)
  - **Acceptance:** snapshot real de produção restaurado em projeto staging; verificação de integridade (chain-hash, contagens); relatório anexado a `docs/DR_RESTORE_TEST_2026-05.md`
  - **Mapeamento:** RDC 978 5.6

---

### DRYRUN — Audit Dry-Run

Aplicação real do módulo construído. Output é evidência viva para auditoria futura.

- [ ] **DRYRUN-01:** Conduzir auditoria interna usando módulo (Phase 5) contra checklist DICQ + RDC 978 — cobrir todos os blocos A-J
  - **Acceptance:** sessão de auditoria criada, ~115 itens respondidos, evidências anexadas
  - **Mapeamento DICQ:** 1.3 (execução)

- [ ] **DRYRUN-02:** Achados documentados como NCs no sistema (não em planilha externa)
  - **Acceptance:** todos os achados "maior" geraram NC automaticamente; achados "menor" registrados; observações documentadas
  - **Mapeamento DICQ:** 1.2 + 1.3

- [ ] **DRYRUN-03:** Plano de ação de remediação para achados críticos (com prazo, responsável, eficácia)
  - **Acceptance:** cada NC crítica tem CAPA preenchido; plano consolidado em relatório
  - **Mapeamento DICQ:** 1.2 (CAPA)

- [ ] **DRYRUN-04:** Relatório final assinado RT — output que vai para auditoria externa eventual
  - **Acceptance:** PDF gerado via AUDI-05; assinatura lógica RT registrada; armazenado em Storage 5 anos; link compartilhável com auditor externo
  - **Mapeamento DICQ:** 1.3 (registro)

---

## Future Requirements (deferred — v1.3)

Módulos analíticos restantes do mapa `modules-roadmap.md`. Auditor pode citar como gap, mas não bloqueia dry-run interno.

- **CIQ Bioquímica** (7.5) — padrão hematologia, ~3 semanas
- **Validação de métodos** (7.7) — linearidade, precisão, exatidão, intervalo referência
- **Liberação de laudos** (8.1) — dupla checagem críticos, retenção 5a
- **Comunicação resultados críticos** (8.2) — lista limites + registro
- **Arquivo + biorrepositório** (8.3) — retenção amostras
- **Coleta + transporte** (6.2) — fluxo pré-analítico
- **Reclamações + satisfação** (9.1) — abre NC quando aplicável
- **Multi-site** — 1 grupo gerenciando N labs
- **Integrações LIS** — eletrônica com analisadores

---

## Out of Scope (v1.2)

Explicitly excluded with reasoning.

- **Auditoria externa formal** — v1.2 é dry-run preparatório; auditoria externa formal pode ser agendada após v1.3
  - *Reason:* timeline 30d não permite passar por revisão externa.
- **Cadastro de paciente / requisição** (6.1) — fora do escopo do CIQ
  - *Reason:* possível integração com LIS terceiro; decisão arquitetural não tomada.
- **Multi-tenant onboarding self-service** — sistema continua sendo provisionado manualmente
  - *Reason:* não é requisito de auditoria; vira feature comercial v2.x.
- **Mobile native polish além do v1.1** — Detox E2E está suficiente
  - *Reason:* mobile não é foco da auditoria.
- **Refatoração de módulos antigos** — CIQ existentes ficam como estão
  - *Reason:* funcionam, são auditáveis, não vale risco.

---

## Traceability

Mapeamento REQ-ID → Phase preenchido após roadmap aprovado.

| REQ-ID | Phase | Plan | Status |
|--------|-------|------|--------|
| CLEAN-01 | Phase 4 | TBD | pending |
| CLEAN-02 | Phase 4 | TBD | pending |
| CLEAN-03 | Phase 4 | TBD | pending |
| CLEAN-04 | Phase 4 | TBD | pending |
| AUDI-01 | Phase 5 | TBD | pending |
| AUDI-02 | Phase 5 | TBD | pending |
| AUDI-03 | Phase 5 | TBD | pending |
| AUDI-04 | Phase 5 | TBD | pending |
| AUDI-05 | Phase 5 | TBD | pending |
| AUDI-06 | Phase 5 | TBD | pending |
| LGPD-01 | Phase 6 | TBD | pending |
| LGPD-02 | Phase 6 | TBD | pending |
| LGPD-03 | Phase 6 | TBD | pending |
| DR-01 | Phase 6 | TBD | pending |
| DR-02 | Phase 6 | TBD | pending |
| DRYRUN-01 | Phase 7 | TBD | pending |
| DRYRUN-02 | Phase 7 | TBD | pending |
| DRYRUN-03 | Phase 7 | TBD | pending |
| DRYRUN-04 | Phase 7 | TBD | pending |

---

**Total:** 19 requirements ativos · 9 deferred · 5 out-of-scope

**Categorias:** CLEAN (4) · AUDI (6) · LGPD (3) · DR (2) · DRYRUN (4)

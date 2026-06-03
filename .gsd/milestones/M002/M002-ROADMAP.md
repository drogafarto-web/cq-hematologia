# M002 — Roadmap Coagulação v2

**Status:** Waves A-G completas. Polimento pós-deploy.
**Última atualização:** 26/05/2026

---

## Fase 1: Implementação Core (COMPLETA — 25/05/2026)

### Wave A — ControlOperacional
- [x] Types + Firestore service + hook real-time
- [x] Firestore rules (match block)
- [x] 5 testes unitários

### Wave B — Attempt
- [x] Types + service (save/get/list)
- [x] useAttemptSave (Westgard + snapshot + signature)
- [x] buildSignaturePayload (SHA-256)
- [x] 3 testes unitários

### Wave C — RTAction
- [x] Types (3 payloads: aprovar/rejeitar/notivisa)
- [x] Service + hooks (create + list by target)
- [x] Firestore rules
- [x] 4 testes unitários

### Wave D — UI Operador
- [x] AttemptForm + Zod schema
- [x] CoagulacaoV2View (view principal)
- [x] ResultInput + ConformityBadge
- [x] Rotas lazy no AuthWrapper + entrada no ModuleHub

### Wave E — UI RT
- [x] RTPanel com KPIs
- [x] AttemptList com badges
- [x] ActionModal + NotivisaModal
- [x] 2 testes RTPanel

### Wave F — Auditoria
- [x] Script audit-coag-v2.sh
- [x] Smoke E2E spec (Playwright)

### Wave G — Deploy
- [x] Deploy report documentado
- [x] TypeScript compila
- [x] Testes passam
- [x] Auditoria arquitetural passa

---

## Fase 2: Polimento Visual (EM ANDAMENTO — 25-26/05/2026)

- [x] Levey-Jennings charts + auto-registration cards (6ab0c52)
- [x] Redesign visual Clinical Instrument — paleta premium isolada (5fc3c02)
- [x] Quick links registrar lote/equipamento do ControlHub (8fd00a8)
- [x] Contrast fix + inline swap insumo ativo + runs subcollection rule (640f824)
- [ ] Responsividade tablet/mobile
- [ ] Empty states com ilustração
- [ ] Skeleton loading nos painéis

---

## Fase 3: Validação E2E (PENDENTE)

Plano aprovado em `docs/coag-v2/E2E-PLAN-OPERATOR-SIMULATION.md`:

- [ ] Setup Playwright + credenciais de teste
- [ ] Fase 0: Login operador
- [ ] Fase 1: Criar ControlOperacional
- [ ] Fase 2: Semana condensada (14 tentativas)
- [ ] Fase 3: Verificação Westgard
- [ ] Fase 4: RT Panel operations
- [ ] Fase 5: Persistência (signatures + snapshots)
- [ ] Fase 6: Curva Levey-Jennings visual
- [ ] Fase 7: Cleanup

---

## Fase 4: Migração e Deprecação (FUTURO)

- [ ] Plano de migração dados v1 -> v2
- [ ] Período de coexistência (v1 read-only + v2 ativo)
- [ ] Deprecar rotas v1
- [ ] Remover código legado (src/features/coagulacao/)

---

## Fase 5: Extensões (BACKLOG)

- [ ] Calibração INR (ISI/MNPT) como config de equipamento
- [ ] Dashboard analytics coag (turnaround, drift trends)
- [ ] Export PDF relatório mensal CIQ coagulação
- [ ] Integração CEQ (controle externo) para coagulação

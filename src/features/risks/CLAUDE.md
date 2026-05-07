# Módulo: Gestão de Riscos (FMEA-Lite)

## Escopo exclusivo desta pasta

Trabalhe SOMENTE em `src/features/risks/`.
Não leia nem acesse outros módulos de `src/features/`.

## Dependências externas permitidas (só importar)

- `src/utils/logicalSignature.ts` — `generateLogicalSignature` / `verifySignature` (helpers client-side)
- `src/shared/services/firebase.ts` — Firebase SDK (db, functions, httpsCallable)
- `src/store/useAuthStore.ts` — `useActiveLabId()` + `useUser()`
- `functions/src/modules/risks/` — server-side validators + signature generators

## Referências regulatórias

DICQ 4.14.6 | ISO 15189 §8.5 | RDC 978 Art. 86 | ADR-0016

## Multi-tenant

Coleção raiz: `labs/{labId}/risks/`.
Documentos carregam `labId` redundante no payload (defense-in-depth + `collectionGroup` superadmin).
Toda função de `risksService.ts` recebe `labId` como parâmetro posicional obrigatório.

## Regras invioláveis

- **RN-RISK-01**: `codigo` é unique per lab (enforced server-side em createRisk).
- **RN-RISK-02**: P/S/D ∈ [1,5]; NPR = P×S×D; niveau derivado (baixo ≤24, medio 25-60, alto 61-99, critico ≥100).
- **RN-RISK-03**: Assinatura LogicalSignature = { hash, operatorId, ts } gerada server-side (client-supplied valores ignorados).
- **RN-RISK-04**: soft-delete only — nunca deleteDoc. Riscos fechado (status='fechado') não podem ser soft-deletados (preserve evidence).
- **RN-RISK-05**: reviewHistory[] + tratamento.acoes[] append-only (histórico imutável para auditoria RDC 978).
- **RN-RISK-06**: Callable from day 1 (DL-1) — todos os writes via risks_createRisk, risks_updateRisk, risks_softDeleteRisk, risks_registrarRevisao. Client read-only.
- **RN-RISK-07**: chainHash contínuo no audit trail (trigger onRiskEventCreated computa SHA-256 per event).
- **RN-RISK-08**: Revisão periódica automática: cron diário 07:00 BRT + mensal top-5 (npr >= 100).

## Status atual

**Fase:** Phase 0 Plan 00-04 (2026-05-07)
**Delivery**: MVP FMEA-Lite
**Callables**: 4 entregues (createRisk, updateRisk, softDeleteRisk, registrarRevisao); 1 stretch (seedFromCsv TBD)
**Triggers**: onRiskEventCreated (chainHash)
**Cron**: scheduledReview (annual + monthly top-5)
**Rules**: `/labs/{labId}/risks/{riskId}` deny client-direct write; allow read by lab member
**Indexes**: 2 compostos (npr DESC; reviewDate ASC)
**UI**: RisksView stub + placeholder components (T7 em progresso)
**Tests**: computeNPR + deriveNivel unit tests (14 cases, all green)

### Próximas tarefas prioritárias (T7–T11 em progresso)

- **T7**: RiskRegister table + RiskForm multi-step + RiskMatrix SVG + RiskReviewModal
- **T8**: ✅ rules + indexes deployed
- **T9**: ✅ lazy route + shell integration
- **T10**: ✅ módulo CLAUDE.md + root table + DPIA v1.1 patch
- **T11**: Deploy (pre-deploy checks + Cloud Logs 24h)

## Padrões arquiteturais

- **Thin service, fat hooks**: risksService cobre CRUD + mapping. Hooks (useRisks, etc) carregam validações de negócio (RN-*) + orquestração.
- **Server overrides client**: NPR sempre recomputed server-side; client-supplied valor ignorado (defense-in-depth).
- **Append-only history**: reviewHistory[] + tratamento.acoes[] nunca shrink. Reclassificação cria nova entry em reviewHistory.
- **Firestore helpers**: collectionGroup permite superadmin auditar riscos cross-lab. labId em payload redundante.

## Auditor demonstration flow (para DICQ 4.14.6 + RDC 978 Art. 86)

1. Abrir RisksView → switch to Matriz tab
2. Ver heatmap 5×5 (linhas=Severidade, cols=Probabilidade); cores por nivel
3. Click red cell → filtered RiskRegister mostrando risks naquele quadrante
4. Click risco → detalhe: P/S/D, NPR, nivel, status, histórico de revisões
5. Switch to Revisões tab → listar reviewHistory com nprPrevio/nprNovo por reclassificação
6. Verify chainHash intacto: `verifyChain --risks --labId <id>` script (T8 validation)

## Conhecidas / Débitos técnicos

- **T7 UI components**: 5 componentes ainda em desenvolvimento (RiskRegister, RiskForm, RiskMatrix, RiskReviewModal, Top5RisksWidget). RisksView fornece tab shell.
- **T5 stretch (seedFromCsv)**: optional se Wave 2 timeline permite. Senão drop para v1.4.1.
- **T1 ADR-0016 escape hatch**: ISO 31000 refinement planejado v1.5 se Riopomba feedback warrants (documentado em ADR-0016).
- **DPIA v1.1 patch**: após ADR-0016 published, republish como v1.1 em SGQ (Plan 00-02 forward ref resolvido).

## Dever de atualização do contexto raiz

Após cada milestone deste módulo:

1. **A linha `risks` na tabela "Módulos em produção" do [root CLAUDE.md](../../../CLAUDE.md)** — formato `risks | Em prod · [descrição] | YYYY-MM-DD`
2. **A seção "Status atual" acima** (data + fase + próximo passo)

Protocolo completo em [`.claude/CONTEXT_PROTOCOL.md`](../../../.claude/CONTEXT_PROTOCOL.md).

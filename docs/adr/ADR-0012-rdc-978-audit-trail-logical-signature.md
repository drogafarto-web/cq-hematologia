# ADR-0012: RDC 978 Audit Trail via LogicalSignature — HMAC + SHA-256 + Immutable Events

- **Status:** Accepted
- **Data:** 2026-05-07
- **Decisor:** CTO / fundador
- **Substitui:** —
- **Substituído por:** —

---

## Contexto

RDC 978 (ANVISA) Art. 117 exige rastreabilidade ponta-a-ponta: dado qualquer resultado emitido ou evento crítico, lab deve provar **who did it, when, with which resources, under which conditions**.

HC Quality v1.3 implementou **ADR-0005 (LogicalSignature)** para insumo-movimentacoes: client cria doc `pending`, Cloud Function calcula HMAC da chain anterior + payload, seals como `chainHash` imutável. Funciona.

v1.4 expande audit logging para:

- CAPA closure (findings → corrective action → verification).
- NOTIVISA submission (critical value → draft → RT approval → submission).
- Personnel qualificações (CV update → supervisor verification).
- Calibração de equipamento (supplier cert → approval → valid-until-date).
- Laudo liberação (RT review → release → patient notification).

**Questão:** Reusar o padrão LogicalSignature para todos eventos (HMAC + chain-hash)?  
Ou alternativas mais leves (timestamp + user-id + signature digital)?

## Problema

Sem decisão explícita, risco de:

1. **Inconsistência de audit trail.** Módulo A usa HMAC chain-hash; Módulo B usa timestamp+user+signature; auditor vê inconsistência → credibilidade questioned.
2. **Regulatory interpretation.** RDC não especifica exatamente qual "rastreabilidade" é aceitável. If we pick wrong, auditor can say "insufficient evidence of integrity" → costly remediation.
3. **Implementation burden.** LogicalSignature é mais complexo que timestamp. Se é mandatório em v1.4, precisa de infra consistente (Cloud Function triggers, Firestore Rules, recovery procedures).

## Decisão

**v1.4 adota LogicalSignature (HMAC + SHA-256 + chain-hash) como padrão universal** para todos audit trails sensíveis (CAPA, NOTIVISA, personnel, calibração, liberação). Rationale:

### 1. LogicalSignature Architecture (Estendido de v1.3)

**Pattern established in v1.3:**

```
Client → Firestore DOC {payload, status: 'pending'} [unverified]
   ↓
Cloud Function (trigger: Firestore) → Read prev_hash from chain
   ↓
Calc new_hash = SHA256(prev_hash + payload + secret_rotation_key)
   ↓
Update DOC → {payload, status: 'sealed', chainHash: new_hash, ts: now, operatorId: auth.uid}
   ↓
Firestore Rules → No further writes allowed (sealed is final)
```

**Implementation details:**

- `chainHash`: 64-char hex SHA-256 digest.
- `prev_hash`: linked to previous event in chain (immutable reference).
- `secret`: rotates monthly (stored in Google Secret Manager, accessed by CF only).
- `ts`: Cloud Firestore server timestamp (not client-provided, prevents clock-skew attacks).
- `operatorId`: `request.auth.uid` from Cloud Function context (canonical user).

### 2. Scope of LogicalSignature in v1.4

Applied to:

- ✅ Insumo-movimentacoes (v1.3, continue).
- ✅ CAPA transitions (open → investigation → planned → implemented → verified → closed).
- ✅ NOTIVISA submissions (draft → RT-approved → submitted → acknowledged by gov).
- ✅ Personnel qualifications (CV added → supervisor-verified → RT-approved).
- ✅ Equipamento calibração (cert received → supplier verified → lab validated → scheduled next calibration).
- ✅ Laudo liberação (draft → RT-reviewed → released → archived).
- ⚠️ **Not applied to:** Read-only logs (e.g., analytics snapshot, KPI dashboards). Rationale: reads are immutable by definition.

### 3. Recovery & Audit Procedures

**Integrity verification (on demand):**

```
CF callable: verifyChainIntegrity({collectionPath, startDocId, endDocId})
   → Iterate docs from start to end
   → Recalculate each hash using prev_hash + payload
   → Report: all hashes valid OR first mismatch found
   → Output: audit report (exportable PDF for health inspector)
```

**Chain recovery (if doc is accidentally corrupted):**

- Immutable rule: sealed doc cannot be updated. If corruption detected:
  - Rollback to last valid state (Firestore backup).
  - New doc created with reason = "chain-recovery", linked to corrupted ID.
  - Auditor notified + incident logged.

### 4. Firestore Rules Enforcement

```javascript
// Any collection using LogicalSignature
match /labs/{labId}/criticos-escalacoes/{escalacaoId} {
  // Client can only create with status='pending'
  allow create: if request.resource.data.status == 'pending'
    && request.resource.data.get('chainHash', null) == null;

  // Cloud Function (via service context) transitions pending → sealed
  // No direct client update of status='sealed'
  allow update: if request.auth.uid == null // service context only
    && resource.data.status == 'pending'
    && request.resource.data.status == 'sealed'
    && request.resource.data.chainHash.size() == 64
    && request.resource.data.operatorId is string;

  // Read always allowed (audit)
  allow read: if request.auth.uid != null && isActiveMember();

  // Once sealed, immutable
  allow update: if resource.data.status == 'sealed' => false;
}
```

### 5. Regulatory Alignment (RDC 978)

RDC 978 Art. 6º, I (rastreabilidade):

> "Registros contendo dados que justifiquem os resultados comunicados, inclusive de amostras rejeitadas, devem ser mantidos e estar disponíveis para consulta por no mínimo 5 (cinco) anos."

**HC Quality compliance:**

- HMAC chain prevents silent tampering (anyone can see if result was forged post-facto).
- Server-side timestamps ensure no clock-skew manipulation.
- Monthly secret rotation prevents master-key compromise exposure (compromise only affects future events, not past).
- Firestore immutability + GCS backups ensure 5-year retention.
- Audit export (PDF with hash verification) is inspector-friendly.

## Alternativas consideradas

### Alternativa A — Simple timestamp + user-id logging (no HMAC)

Each event stores `{payload, ts, userId}`. No chain, no HMAC.

**Pros:** Simpler implementation; less compute (no CF triggers).
**Cons:**

- Doesn't detect tampering (if someone hacks Firestore rules or SQL, they can modify past logs).
- RDC auditor asks "how do I know this log wasn't forged?" No cryptographic answer.
- Competitors with HMAC chains have stronger compliance posture.

**Rejected:** Insufficient for medical/regulatory audit trail standard.

### Alternativa B — Digital signature (PKI + certificate)

Each event signed with lab's private key (e.g., e-CNPJ).

**Pros:** Legally recognized in Brazil (follows ICP-Brasil standards); strong regulatory signal.
**Cons:**

- Requires certificate management infrastructure (cost, operational burden).
- Key rotation is complex (compromise any key = all past events questioned).
- Not widely used in healthcare SaaS (overkill for internal audit trail).
- e-CNPJ provisioning is separate legal/bureaucracy process (blocks v1.4 timeline).

**Rejected:** Overkill for v1.4; deferred if ANVISA explicitly mandates PKI (unlikely).

### Alternativa C — Hybrid: timestamp + HMAC chain (compromise)

v1.4 uses HMAC for critical events only (NOTIVISA, CAPA, liberação); other events use lightweight timestamp-only.

**Pros:** Reduces CF overhead for low-risk events.
**Cons:**

- Inconsistent audit trail (auditor sees "some events are HMAC, some are not"). Creates confusion.
- If auditor flags timestamp-only events as insufficient, we retrofit HMAC anyway.

**Rejected:** Better to commit to one standard. LogicalSignature is proven + scales.

## Consequências

### Positivas

1. **Regulatory confidence.** Inspector can independently verify audit trail integrity (via verifyChainIntegrity callable). No ambiguity.
2. **Tamper detection.** Any silent modification is detected on re-verification. Compliance posture is world-class.
3. **Consistency.** All audit trails follow same pattern → code reuse (one CF template, one Rules pattern, one audit export script).
4. **Legal defensibility.** If challenged in regulatory proceeding, HMAC chain is mathematically rigorous proof of integrity (not just "we logged it").

### Negativas

1. **Compute cost.** CF triggers on every sealed event cost ~0.40 USD per 1M invocations. At 10k/day = ~$1.20/day. Negligible but nonzero.
2. **Latency.** Sealing a doc adds ~200-500ms (CF cold start + HMAC calc + Firestore write). User perceives delay (e.g., NOTIVISA draft takes 1s instead of 0.5s). Mitigated: UX shows "sealing..." spinner.
3. **Debugging complexity.** If a doc fails to seal (CF error), it gets stuck `pending` state. Recovery procedure needed. Mitigated: monitoring + alert on stale pending docs.

## Compromissos derivados

1. **LogicalSignature factory function** (shared utility).
   - `src/shared/logicalSignature.ts` — reusable helper.
   - Exports: `createSealableDoc()`, `verifyChainIntegrity()`, `exportAuditTrail()`.
   - Used by all v1.4 modules that need HMAC audit.

2. **Cloud Function deployment pattern.**
   - Each module (criticos, capa, notivisa, etc.) has its own CF sealing trigger.
   - Name convention: `seal{ModuleName}Event` (e.g., `sealCriticosEscalacao`, `sealNotivisaSubmission`).
   - All triggers use same `verifySignatureAndSeal()` shared function.

3. **Firestore Rules audit template.**
   - Template rule for any collection using LogicalSignature (copy-paste-customize).
   - Documented in `.claude/rules/firestore-security.md`.

4. **Monthly secret rotation (operational).**
   - Google Secret Manager stores `HC_QUALITY_SEALING_SECRET_<YYYY_MM>`.
   - CF reads current month's secret. Next month, CF switches to new secret (old one archived).
   - Documented in deployment playbook; CTO does rotation (or automate via Cloud Scheduler).

5. **Audit trail export procedure (v1.4 Phase 13).**
   - CF callable `generateAuditReport({collection, dateRange, labId})` → CSV + PDF.
   - PDF includes: list of all sealed events + hash chain visualization + integrity check result.
   - Auditor can run anytime; output is inspector-ready.

6. **Testing & validation.**
   - Unit tests: `logicalSignature.test.ts` (create, verify, detect tampering, false positive check).
   - E2E test: create CAPA event → seals → verify integrity passes → tamper payload → verify fails.
   - Firestore Rules tests (emulator): pending → sealed transition enforced; no direct sealed creates.

## Referências

- ADR-0005 (Insumo-movimentacoes LogicalSignature v1.3 implementation).
- `src/shared/logicalSignature.ts` (v1.4 new; reusable factory).
- `functions/src/v1.4-base/seal*.ts` (CF triggers per module).
- `.claude/rules/firestore-security.md` (template rules + security audit checklist).
- `scripts/verify-audit-chain.sh` (bash script for inspector-friendly verification).
- `v1.4-ROADMAP.md` Phase 13 (audit compliance).

---

**Aplikabelnost:** Wszystkie kolekcje wrażliwe na audyt w v1.4 (CAPA, NOTIVISA, personnel, calibração, liberação).

---

**ADR Status:** ACCEPTED (2026-05-07)  
**Review Date:** 2026-06-21 (Phase 6 completion: confirm all v1.4 modules seal events correctly; run integrity verification on staging)  
**Audit Gate:** 2026-08-15 (pre-deployment: full audit trail verification run; Inspector briefing on how to verify chain)

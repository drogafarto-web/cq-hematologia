# Risk Assessment v1.4 — Phase 4 Completion

**Assessment Date:** 2026-05-08  
**Overall Risk Level:** 🟢 LOW  
**Residual Risk:** Acceptable for production

---

## Known Risks & Mitigations

### 1. NOTIVISA Legacy Code Coexistence 🟡 MEDIUM

**Risk:** Old NOTIVISA code path exists at `functions/src/modules/notivisa-legacy/**` (149 TS errors, pre-existing from Phase 3). If dev accidentally imports from legacy path, silent data loss or double-submission possible.

**Severity:** Medium (not critical; new code uses v1.4 path)

**Mitigation:**
- [x] New callables use `functions/src/modules/notivisa/**` only (v1.4)
- [x] Legacy path documented for Phase 6 hard delete (migration guide Wave 3.6)
- [x] Code review: check imports (no `from 'notivisa-legacy'`)
- [ ] Phase 6: Hard delete legacy path + migration verification

**Timeline:** Phase 6 (2026-06-12) hard delete scheduled

**Residual Risk:** LOW (legacy path not used; lint errors only)

---

### 2. DPIA Draft Status ⚠️ LOW

**Risk:** IT-LGPD-DPIA-001 v1.1 signed but marked "DRAFT" (requires executive sign-off for v2.0). If compliance audit questions authority, could delay customer rollout.

**Severity:** Low (DPIA enforced in code; only approval is pending)

**Mitigation:**
- [x] DPIA v1.1 signed & functional (covers Gemini Vision, Resend email, patient data exports)
- [x] All consent gates + audit logging implemented per DPIA requirements
- [ ] Phase 5: Final v2.0 sign-off post-UAT (customer sign-off gate)

**Timeline:** 2026-05-22 (Phase 5 UAT completion)

**Residual Risk:** LOW (code already compliant; approval is administrative)

---

### 3. Bootstrap Script Execution Order ⚠️ LOW

**Risk:** `scripts/bootstrap-phase4.sh` creates 3 collections in sequence. If one fails (e.g., quota exceeded, network error), subsequent collections may be skipped. Lab missing `supervisor-status` → Art. 22 gate doesn't work.

**Severity:** Low (idempotent; safe to re-run)

**Mitigation:**
- [x] Bootstrap script is fully idempotent (safe to run multiple times)
- [x] Dry-run mode (`--dry-run`) for verification
- [x] Pre-flight check: `scripts/preflight-secrets-check.sh`
- [x] Error messages explicit (lab admin knows what failed)
- [ ] Phase 5: Add automatic retry + rollback on first failure

**Timeline:** Phase 5 (2026-05-22) hardening

**Residual Risk:** LOW (manual re-run recovers; documented in runbook)

---

### 4. Email Token Collision (Theoretical) 🟢 VERY LOW

**Risk:** HMAC token collision (SHA-256 space collision, 2^-256 probability). If two patients get same token, one could access other's data.

**Severity:** Very low (cryptographically negligible)

**Mitigation:**
- [x] Token includes: patientId + email + expiryTimestamp + HMAC (unique per patient + time)
- [x] Collision probability: <10^-77 (beyond any practical concern)
- [x] Non-threat at scale (even 1 billion patients, collision risk = 0)

**Residual Risk:** NEGLIGIBLE

---

### 5. Gemini Vision API Quota Exhaustion 🟡 MEDIUM

**Risk:** Laudo-OCR calls Gemini for every strip uploaded. If lab has surge in volume (e.g., emergency patient rush), API quota could be exceeded. OCR fails → fallback to manual entry (acceptable but slower).

**Severity:** Medium (degrades performance, not data loss)

**Mitigation:**
- [x] Cache: OCR results cached 1h per image SHA256 (prevent re-processing)
- [x] Rate limit: Cloud Function callable rate-limited (100 OCR requests/hour per lab)
- [x] Fallback: Manual entry always available (no blocking)
- [x] Monitoring: Cloud Logs alert if >5 quota errors/hour
- [ ] Phase 5: Implement exponential backoff + queue if quota exceeded

**Timeline:** Phase 5 (2026-05-22) optimization

**Residual Risk:** LOW (fallback acceptable; customers notified)

---

### 6. Firestore Rules Syntax Regression ⚠️ LOW

**Risk:** Phase 4 rules update adds 200+ lines to firestore.rules. If typo in rule condition, could accidentally allow/deny unintended access.

**Severity:** Low (caught by dry-run before deploy)

**Mitigation:**
- [x] Rules dry-run: `firebase deploy --dry-run` (no changes without clean check)
- [x] Manual review: 2 engineers reviewed all new rules blocks (ADR-0032, 0033, 0034)
- [x] Test: E2E tests verify RT-only access (portal-rt reads blocked for non-RT)
- [x] Monitoring: Cloud Logs tracks rule rejections (alert >100/hour)

**Residual Risk:** LOW (multiple gates; regression unlikely)

---

### 7. Patient Email Delivery Failure 🟡 MEDIUM

**Risk:** Resend API (email provider) outage or rate limit → patient export email not sent. Patient waits for email that never arrives.

**Severity:** Medium (poor UX, not data loss)

**Mitigation:**
- [x] Resend: Industry-standard email provider (99.9% SLA)
- [x] Backup: If Resend fails, error returned to patient (explicit "Email could not be sent; contact support")
- [x] Audit: All export attempts logged (can resend manually if needed)
- [ ] Phase 5: Implement retry queue (automatic resend after 1h)

**Timeline:** Phase 5 (2026-05-22) hardening

**Residual Risk:** LOW (explicit error handling; customers notified)

---

### 8. Laudo-OCR Accuracy Edge Cases 🟡 MEDIUM

**Risk:** Gemini Vision misreads strip (e.g., faded print, low contrast). Returns wrong value (e.g., 100 instead of 1000). Operator doesn't notice → patient gets wrong result.

**Severity:** Medium (patient safety risk if undetected)

**Mitigation:**
- [x] Operator review: Form shows OCR-parsed values; operator must click "Confirm" (not auto-submit)
- [x] Manual override: Operator can change any value before saving
- [x] Fallback: If OCR accuracy <80%, show manual entry form instead (Gemini confidence score checked)
- [x] Audit: OCR decision logged (success/lowconfidence/error)
- [x] QC: Critical results (>2σ from normal) require RT approval (Portal-RT escalation)
- [ ] Phase 5: Add visual flag if OCR confidence <90%

**Timeline:** Phase 5 (2026-05-22) UX hardening

**Residual Risk:** LOW (multiple validation gates; operator is final arbiter)

---

### 9. NOTIVISA Sandbox API Changes 🟡 MEDIUM

**Risk:** Government sandbox API could change format or endpoints between Phase 4 (sandbox) and Phase 6 (production gov account). Payload validation fails → submissions blocked.

**Severity:** Medium (Phase 6 blocker)

**Mitigation:**
- [x] Payload schema: Validated against Portaria 204/2017 spec (immutable government requirement)
- [x] Request/response tests: 6 integration tests cover all payload variations
- [x] Versioning: Callable version param allows future API version negotiation
- [ ] Phase 5: Dry-run against sandbox (gov provisioning in progress)
- [ ] Phase 6: Gov API integration verification before production account approval

**Timeline:** Phase 5–6 (2026-05-22 to 2026-06-12)

**Residual Risk:** MEDIUM (external dependency; gov timeline TBD)

---

### 10. Performance Degradation Under Load 🟢 LOW

**Risk:** Portal-RT real-time listeners (onSnapshot) could consume memory on servers with 1,000+ concurrent RTs. Firestore listener leak → memory exhaustion → crash.

**Severity:** Low (currently <100 labs, each with 1–5 RTs; scale issue Phase 8+)

**Mitigation:**
- [x] Listener cleanup: Every hook returns unsubscribe function (tested in cleanup tests)
- [x] Monitoring: Cloud Logs tracks active listeners (alert if >1,000)
- [x] Stress test: E2E suite verified with 10 concurrent listeners (passed)
- [ ] Phase 7+: Implement listener pooling if scale exceeds 1,000 labs

**Timeline:** Phase 7+ (2026-07-xx) if needed

**Residual Risk:** LOW (current scale OK; monitored for future)

---

## Risk Matrix

| Risk | Severity | Probability | Detectability | RPN | Mitigation |
|------|----------|-------------|----------------|-----|-----------|
| NOTIVISA legacy coexistence | 3 | 2 (unlikely if no bad import) | 1 (easy: code review) | 6 | Phase 6 delete |
| DPIA draft status | 2 | 1 (low: approval TBD) | 1 (easy: doc review) | 2 | Phase 5 sign-off |
| Bootstrap execution order | 2 | 1 (low: idempotent) | 2 (med: error message) | 4 | Re-run script |
| Email token collision | 1 | 0 (negligible) | 3 (hard: audit log) | 0 | Accepted |
| Gemini quota exhaustion | 2 | 2 (possible surge) | 2 (med: alert) | 8 | Fallback + Phase 5 queue |
| Firestore rules regression | 2 | 1 (low: dry-run check) | 1 (easy: E2E test) | 2 | Deploy gate |
| Email delivery failure | 2 | 1 (low: 99.9% SLA) | 1 (easy: error state) | 2 | Error handling |
| OCR accuracy | 3 | 2 (possible w/ faded strips) | 1 (easy: operator review) | 6 | Operator override |
| NOTIVISA sandbox API change | 3 | 2 (possible gov change) | 2 (med: payload test) | 12 | Phase 5–6 verify |
| Performance listener leak | 2 | 1 (low: current scale) | 2 (med: logs) | 4 | Phase 7+ pooling |

**Legend:** 1=Low, 2=Medium, 3=High · RPN = Severity × Probability × (3-Detectability)

---

## Deployment Approval

**All risks assessed and mitigated. Safe to deploy to production.**

| Role | Approval | Date |
|------|----------|------|
| **CTO** | ✅ Approved | 2026-05-08 |
| **Compliance** | ✅ Approved | 2026-05-08 |
| **Security** | ✅ Approved | 2026-05-08 |

---

## Post-Deploy Monitoring

**First 24 Hours:** Watch for risks #1–6 (technical stack)  
**First Week:** Watch for risks #7–8 (customer-facing)  
**Phase 5:** Monitor risk #9 (gov API changes)  
**Phase 7+:** Monitor risk #10 (scale)

**Alert Thresholds:**
- Rule rejections: >100/hour
- Gemini errors: >5/hour
- Email failures: >10/day
- Listener count: >1,000 active

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-08  
**Next Review:** 2026-05-22 (Phase 5)

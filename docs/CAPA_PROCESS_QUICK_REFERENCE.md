# CAPA Process — Quick Reference Card

**Print & Laminate for Lab Use**

---

## 5-State Machine (The Cycle)

```
[1] ABERTO          [2] EM-ANDAMENTO         [3] EVIDENCIA-SUBMETIDA
  ↓ (5-15 days)       ↓ (5-30 days)            ↓ (3-7 days)
  Start investigation  Complete action          Auditor reviews

                    ← → REJECTION (more work needed)

[5] FECHADO ← ← ← ← [4] AUDITOR-REVISANDO
(Final)             (Auditor sign-off)
```

---

## Key Dates & Deadlines

| Milestone               | Target Duration                       |
| ----------------------- | ------------------------------------- |
| ABERTO → EM-ANDAMENTO   | 0 (immediate upon acknowledgment)     |
| Investigation + Action  | 5–30 days (owner: proprietario)       |
| EVIDENCIA-SUBMETIDA     | 3–7 days (owner: auditor)             |
| FECHADO (approved)      | Final (no further edits)              |
| **Total CAPA duration** | **30–90 days** (target from creation) |

**Alert Thresholds:**

- **At-Risk:** < 7 days to deadline (yellow highlight)
- **Overdue:** deadline passed (red, daily alert to RT/QM)

---

## Who Does What

### Proprietario (Quality Operator)

1. **ABERTO → EM-ANDAMENTO:** Click "Start Investigation"
   - Write RCA (min 100 chars, substantive)
   - Describe action plan
   - Set evidence target date
2. **EM-ANDAMENTO:** Perform corrective action
3. **→ EVIDENCIA-SUBMETIDA:** Upload evidence (photos, docs, training logs)
4. **Wait for auditor review**

### Auditor Master CIQ

1. **EVIDENCIA-SUBMETIDA:** View CAPA in "Awaiting Review" queue
2. Download evidence, verify file hash
3. **Decision:**
   - ✅ Approve → FECHADO (sign & lock)
   - ❌ Reject → back to EM-ANDAMENTO (proprietario reworks)

### RT (Technical Responsible)

- **Review RCA** (can comment, but doesn't gate transition)
- **Monitor overdue CAPAs** (escalate if >7 days overdue)

### QM (Quality Manager)

- **Create new CAPAs** (assign proprietario, set deadline)
- **Monitor progress** (dashboard, KPIs)
- **Export dossiers** for external audit

---

## Common Actions (UI Buttons)

| Button                | When                                    | Effect                                              |
| --------------------- | --------------------------------------- | --------------------------------------------------- |
| "I Acknowledge"       | CAPA created, assigned to you           | Records acknowledgment timestamp                    |
| "Start Investigation" | After RCA/plan written                  | Transition: ABERTO → EM-ANDAMENTO                   |
| "Upload Evidence"     | Action complete                         | Transition: EM-ANDAMENTO → EVIDENCIA-SUBMETIDA      |
| "Claim for Review"    | Evidence submitted (auditor only)       | Transition: EVIDENCIA-SUBMETIDA → AUDITOR-REVISANDO |
| "Approve & Close"     | After reviewing evidence (auditor only) | Transition: AUDITOR-REVISANDO → FECHADO (FINAL)     |
| "Request Rework"      | Evidence insufficient (auditor only)    | Transition back: → EM-ANDAMENTO                     |

---

## Evidence Types

| Type            | Example                                                          |
| --------------- | ---------------------------------------------------------------- |
| **foto**        | Before/after photos of repair, corrected label, equipment screen |
| **documento**   | RCA report, root cause worksheet, procedure update               |
| **certificado** | Training certificate, calibration cert, proficiency test         |
| **pop**         | Updated Procedimento Operacional Padrão                          |
| **treinamento** | Training log, sign-off sheet, competency test results            |

**Upload Requirements:**

- File must exist (not placeholder)
- Hash verified (SHA-256 computed server-side)
- 5-year retention (RDC 978 Art. 105)

---

## RDC 978 Compliance Checklist

- [ ] **Art. 86 (Risk Management):** Is this CAPA linked to a Risk?
- [ ] **Art. 147 (CAPA Requirements):** RCA + Action + Verification present?
- [ ] **Art. 105 (Retention):** Records retained 5 years?
- [ ] **Signature:** Auditor signed closure (closureSignature)?
- [ ] **Audit Trail:** All transitions documented (transicoesCAPAs array)?

---

## Escalation Flowchart

```
CAPA Issue Detected (overdue, rejected, awaiting auditor)
        ↓
  Alert Proprietario (email)
        ↓ [No response 24h]
  Alert RT (email) — escalate workload
        ↓ [No response 24h]
  Alert QM (email) — may need to reassign
        ↓ [No response 48h]
  Alert Lab Director (email) + meeting
```

---

## Error Messages & How to Fix

| Error                         | Fix                                                          |
| ----------------------------- | ------------------------------------------------------------ |
| "RCA must be ≥ 100 chars"     | Write more detailed root cause analysis (why, not just what) |
| "CAPA status is 'aberto'"     | Click "Start Investigation" first                            |
| "File integrity check failed" | Re-upload evidence file (may be corrupted)                   |
| "Auditor not assigned"        | Contact QM to assign available auditor                       |
| "Deadline exceeded"           | Extend deadline (QM approval) or complete urgently           |

---

## How to Verify Audit Trail (External Auditor)

1. **Open CAPA record**
2. **Scroll to "Audit Trail" section** (transicoesCAPAs array)
3. **Verify chain:**
   - Each entry has: acao, operatorId, ts, signature, chainHash
   - Signatures match (can recalculate SHA-256)
   - No gaps or reordering (chain unbroken)
4. **Final entry:** status = 'fechado', closureSignature present
5. **Conclusion:** CAPA integrity verified ✓

---

## 5-Year Retention (Your Obligation)

**What's Kept:**

- CAPA Firestore doc (all fields)
- Evidence files (Cloud Storage)
- Audit trail (append-only, immutable)
- Soft-delete flag (if CAPA marked inactive)

**How Long:**

- 5 years from `dataFechamento` (closure date)
- Alert: 90 days before expiration, option to extend or archive
- Never hard-delete (RDC 978 Art. 105 compliance)

---

## Contact & Support

| Role                      | Contact                            |
| ------------------------- | ---------------------------------- |
| **CAPA assigned to you?** | Review assignment email or ask QM  |
| **Technical issue?**      | Contact system admin               |
| **Regulatory question?**  | Contact Quality Manager            |
| **Deadline extension?**   | Request from QM with justification |

---

**Version:** 1.0  
**Print Date:** 2026-05-07  
**Valid Through:** 2026-08-07 (or until superseded)

_Print on cardstock, laminate, post at quality station + auditor desk._

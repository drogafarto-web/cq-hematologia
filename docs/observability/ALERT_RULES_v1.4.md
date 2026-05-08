# Alert Rules — v1.4 Observability

**Status:** SPEC. Not yet provisioned in Cloud Console. Wave 2 Agent 5 deliverable.
**Project:** `hmatologia2` · Region: `southamerica-east1`
**Owner:** CTO (provisioning) · DPO (privacy alerts) · RT (clinical SLA alerts)

---

## Purpose

Wave 1 introduced three new structured signals that no alert rule yet listens to:

1. `[writeAuditLog] FAILED after retries` — audit log write loss (resilient writer in `functions/src/shared/audit/writeAuditLog.ts`).
2. `imuno-ia-guardrails/{labId}/events/{eventId}` — PII consent gate audit trail (per `consentGate.ts`).
3. `auditLogFailures` fallback collection — last-resort write target when primary audit write retries are exhausted.

Without alerts, these are silent. This file is the canonical source-of-truth for the **6 alert rules** the v1.4 launch demands. Each maps to a JSON policy template under `docs/observability/policies/` so provisioning is one `gcloud` command.

---

## Alert Inventory (summary)

| ID | Name | Severity | Trigger | Page |
|----|------|----------|---------|------|
| **A1** | Audit log fallback engaged | WARNING | `[writeAuditLog] FAILED after retries` > 3 in 1h | On-call eng |
| **A2** | Críticos SLA breach (RDC 978 Art. 5.7.1) | ERROR | `criticos-escalacao` SLA > 60min | RT + on-call |
| **A3** | IA-strip consent gate violation | ERROR | `consent-not-captured` `HttpsError` | DPO + RT |
| **A4** | HMAC chain break (ADR-0017) | CRITICAL | `[generateChainHash] previous hash mismatch` | CTO + RT (immediate) |
| **A5** | Twilio SMS failure rate >10% | WARNING | SMS errors / SMS attempts > 0.1 in 5min | On-call eng |
| **A6** | LGPD Art. 9 — Gemini call without consent (belt-and-suspenders) | CRITICAL | Gemini outbound without prior `imuno-ia-guardrails` event | DPO + CTO |

**Notification channels (must exist in Cloud Console before policies bind):**

- `oncall-eng@hmatologia2` — PagerDuty/Slack/email rotation (4-week cycle, see `.planning/v1.4-INCIDENT_RESPONSE_CONTACTS.md`)
- `rt-clinical@hmatologia2` — Responsável Técnico (clinical lead)
- `dpo@hmatologia2` — Data Protection Officer
- `cto@hmatologia2` — drogafarto@gmail.com

Policy JSON templates reference these channels by display name. Replace `projects/hmatologia2/notificationChannels/PLACEHOLDER_*` IDs in each JSON before `gcloud alpha monitoring policies create`.

---

## A1 — Audit log fallback engaged

**Severity:** WARNING
**Compliance anchor:** RDC 978 Art. 128 (audit trail integrity); ADR-0017.
**Source:** `functions/src/shared/audit/writeAuditLog.ts:92`.

### Detection

Log-based metric. The signal is the literal string `[writeAuditLog] FAILED after retries` in `severity=ERROR` logs from any Cloud Function in `southamerica-east1`.

**Cloud Logging query:**

```
resource.type="cloud_function"
AND resource.labels.region="southamerica-east1"
AND severity="ERROR"
AND textPayload:"[writeAuditLog] FAILED after retries"
```

### Threshold

- **Aligner:** `ALIGN_RATE`
- **Aggregation window:** 1 hour
- **Condition:** count > 3 over rolling 1h window
- **Trigger:** any single time-series breaches threshold

### Escalation

- Page `oncall-eng` immediately (Slack + email).
- If sustained > 2h without remediation: escalate to CTO.

### Runbook

[`RUNBOOK.md#a1-audit-log-fallback-engaged`](RUNBOOK.md#a1-audit-log-fallback-engaged).

### Provisioning

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A1-audit-fallback.json \
  --project=hmatologia2
```

---

## A2 — Críticos SLA breach (RDC 978 Art. 5.7.1)

**Severity:** ERROR
**Compliance anchor:** RDC 978 Art. 5.7.1 — critical-value escalation must reach physician within 60 min.
**Source:** Firestore field query against `criticos-escalacao/{labId}/events/{eventId}` documents where `acknowledgedAt is null` and `createdAt < now - 60min`.

### Detection

**This requires a custom metric** — Cloud Logging cannot directly query Firestore field state. Implementation:

1. **Add a scheduled Cloud Function** `criticosSlaProbe` (runs every 5 min) that:
   - Queries `collectionGroup('events')` filtered to `criticos-escalacao` parent path.
   - Counts events where `status == 'pending' AND createdAt < now - 60min AND acknowledgedAt == null`.
   - Emits a structured log line: `console.warn('[criticosSlaProbe] breach_count', { count, labIds })`.
   - Writes the count as a Cloud Monitoring custom metric `custom.googleapis.com/criticos/sla_breach_count`.
2. **Alert policy** then fires on the custom metric, not on raw logs.

**Cloud Logging fallback query (interim, log-based):**

```
resource.type="cloud_function"
AND resource.labels.function_name="criticosSlaProbe"
AND jsonPayload.message="[criticosSlaProbe] breach_count"
AND jsonPayload.count > 0
```

### Threshold

- **Custom metric:** `custom.googleapis.com/criticos/sla_breach_count`
- **Condition:** `value > 0` for 1 consecutive evaluation period (5 min)

### Escalation

- Page RT and on-call simultaneously.
- RT must contact requesting physician within 30 min of alert (NC if missed).

### Runbook

[`RUNBOOK.md#a2-criticos-sla-breach`](RUNBOOK.md#a2-criticos-sla-breach).

### Provisioning

```bash
# Deploy the probe function first (functions/src/modules/criticos/slaProbe.ts — TODO Wave 3)
firebase deploy --only functions:criticosSlaProbe --project hmatologia2

# Then bind the policy
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A2-criticos-sla.json \
  --project=hmatologia2
```

> **NOTE — custom metric required.** Until `criticosSlaProbe` ships, the policy is parked in DRAFT mode with the log-based fallback condition.

---

## A3 — IA-strip consent gate violation

**Severity:** ERROR
**Compliance anchor:** LGPD Art. 9 (consent for sensitive data); DICQ 4.4.
**Source:** `functions/src/modules/ia-strip/guardrails/consentGate.ts` — throws `HttpsError('failed-precondition', 'consent-not-captured')`.

### Detection

```
resource.type="cloud_function"
AND resource.labels.function_name="classifyStripGemini"
AND severity="ERROR"
AND (textPayload:"consent-not-captured" OR jsonPayload.message:"consent-not-captured")
```

### Threshold

- **Condition:** count >= 1 over 5min window. Single occurrence pages.

### Escalation

- Page DPO + RT.
- Block the offending lab's IA-strip access if recurrent (> 3 events / hour from same `labId`).

### Runbook

[`RUNBOOK.md#a3-consent-gate-violation`](RUNBOOK.md#a3-consent-gate-violation).

### Provisioning

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A3-consent-gate.json \
  --project=hmatologia2
```

---

## A4 — HMAC chain break (ADR-0017)

**Severity:** CRITICAL
**Compliance anchor:** RDC 978 Art. 128 (tamper-evident audit); ADR-0017.
**Source:** `functions/src/shared/signature.ts` (`verifyChainHash`) and per-module trigger logs.

### Detection

```
resource.type="cloud_function"
AND severity="ERROR"
AND (textPayload:"[generateChainHash] previous hash mismatch"
     OR textPayload:"chain-hash-mismatch"
     OR textPayload:"[verifyChainHash] mismatch")
```

### Threshold

- **Condition:** count >= 1 in any 1min window. Single occurrence is a hard incident.

### Escalation

- **Immediate page** to CTO + RT (phone, not just email).
- **Freeze writes** to the affected collection until investigated (manual, see runbook).
- LGPD/RDC notification clock starts at first occurrence (72h to ANVISA if regulatory data tampered).

### Runbook

[`RUNBOOK.md#a4-hmac-chain-break`](RUNBOOK.md#a4-hmac-chain-break).

### Provisioning

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A4-hmac-chain-break.json \
  --project=hmatologia2
```

---

## A5 — Twilio SMS failure rate > 10% in 5 min

**Severity:** WARNING
**Compliance anchor:** RDC 978 Art. 5.7.1 (críticos delivery channel).
**Source:** `functions/src/modules/criticos/*` SMS dispatch path (Twilio webhook + dispatch logs).

### Detection

**This requires a log-based ratio metric** (numerator + denominator).

- **Numerator:** `textPayload:"[twilio-dispatch] failed"` OR `jsonPayload.twilio.status="failed"`
- **Denominator:** `textPayload:"[twilio-dispatch] attempt"` OR `jsonPayload.twilio.status` IN (`queued`, `sent`, `failed`, `undelivered`)

```
resource.type="cloud_function"
AND resource.labels.function_name=~"criticos.*"
AND jsonPayload.twilio.status:*
```

### Threshold

- **Aligner:** `ALIGN_RATE` over 5 min
- **Ratio:** failures / attempts > 0.10
- **Min sample:** 10 attempts in window (avoid alerting on 1/2 = 50%)

### Escalation

- Page on-call eng. RT informed via dashboard, not paged.
- If failure rate > 50% sustained > 10 min, escalate to CTO (carrier outage may force SMS → voice fallback).

### Runbook

[`RUNBOOK.md#a5-twilio-sms-failure-rate`](RUNBOOK.md#a5-twilio-sms-failure-rate).

### Provisioning

```bash
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A5-twilio-sms-failure.json \
  --project=hmatologia2
```

> **NOTE — log-based ratio metric required.** Define via `gcloud logging metrics create` first; see runbook section A5.

---

## A6 — LGPD Art. 9 — Gemini call without consent (belt-and-suspenders)

**Severity:** CRITICAL
**Compliance anchor:** LGPD Art. 9; DICQ 4.4.
**Source:** Outbound Gemini call audit. Independent of `consentGate.ts` to catch bypass scenarios (e.g. someone removes the gate, or a new code path forgets to call it).

### Detection

**This requires a custom metric + cross-correlation.** Two implementation options:

**Option A — Egress audit (preferred):** A scheduled function `geminiEgressAudit` (runs every 15 min) that:
1. Reads recent (last 30 min) Gemini-related egress logs from VPC Service Controls / Cloud Functions invoking `generativelanguage.googleapis.com`.
2. For each Gemini call, checks that an `imuno-ia-guardrails/{labId}/events/{captureId}` event exists with `event == 'guardrail-check-passed'` within 60s prior.
3. If a Gemini call has no matching guardrail event → emits `[geminiEgressAudit] CONSENT_BYPASS` and increments custom metric `custom.googleapis.com/lgpd/gemini_bypass_count`.

**Option B — Network-level:** Use VPC Service Controls + dry-run audit logs to detect any call to `generativelanguage.googleapis.com` not preceded by a Firestore write to `imuno-ia-guardrails`. Heavier infra; defer to v1.5.

**Cloud Logging query (Option A):**

```
resource.type="cloud_function"
AND resource.labels.function_name="geminiEgressAudit"
AND jsonPayload.message:"[geminiEgressAudit] CONSENT_BYPASS"
```

### Threshold

- **Condition:** custom metric `lgpd/gemini_bypass_count` > 0 for any 15-min evaluation. Single bypass is critical.

### Escalation

- **Immediate page** to DPO + CTO.
- LGPD ANPD notification clock starts (72h).
- Lab whose `labId` triggered bypass: IA-strip suspended pending DPO clearance.

### Runbook

[`RUNBOOK.md#a6-gemini-without-consent`](RUNBOOK.md#a6-gemini-without-consent).

### Provisioning

```bash
# Deploy egress audit fn first (functions/src/modules/lgpd/geminiEgressAudit.ts — TODO Wave 3)
firebase deploy --only functions:geminiEgressAudit --project hmatologia2

# Bind the policy
gcloud alpha monitoring policies create \
  --policy-from-file=docs/observability/policies/A6-gemini-bypass.json \
  --project=hmatologia2
```

> **NOTE — custom metric + new function required.** Parked in DRAFT until `geminiEgressAudit` ships.

---

## Custom-metric / new-function dependencies (recap)

| Alert | Custom metric | New function needed | Status |
|-------|---------------|---------------------|--------|
| A1 | none (log-based) | none | READY |
| A2 | `custom.googleapis.com/criticos/sla_breach_count` | `criticosSlaProbe` (5-min cron) | DRAFT — Wave 3 |
| A3 | none (log-based) | none | READY |
| A4 | none (log-based) | none | READY |
| A5 | log-based ratio (`gcloud logging metrics create`) | none | DRAFT — define metric first |
| A6 | `custom.googleapis.com/lgpd/gemini_bypass_count` | `geminiEgressAudit` (15-min cron) | DRAFT — Wave 3 |

**3 of 6 alerts (A1, A3, A4) are READY to provision today.** A2, A5, A6 require a small follow-up before binding.

---

## Provisioning order (after notification channels exist)

```bash
# READY now (3)
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A1-audit-fallback.json --project=hmatologia2
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A3-consent-gate.json --project=hmatologia2
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A4-hmac-chain-break.json --project=hmatologia2

# After A5 log-based metric is defined
gcloud logging metrics create twilio_sms_attempts --description="Twilio SMS dispatch attempts" --log-filter='resource.type="cloud_function" AND jsonPayload.twilio.status:*' --project=hmatologia2
gcloud logging metrics create twilio_sms_failures --description="Twilio SMS dispatch failures" --log-filter='resource.type="cloud_function" AND jsonPayload.twilio.status="failed"' --project=hmatologia2
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A5-twilio-sms-failure.json --project=hmatologia2

# After A2/A6 functions ship (Wave 3)
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A2-criticos-sla.json --project=hmatologia2
gcloud alpha monitoring policies create --policy-from-file=docs/observability/policies/A6-gemini-bypass.json --project=hmatologia2
```

---

## Maintenance

- **Quarterly review** (or after any new compliance ADR): re-validate every alert's compliance anchor + threshold.
- **After every incident:** post-mortem authors must confirm whether existing alerts caught the incident or whether a new alert is required. Append to this file.
- **Notification channel drift:** rotate keys / on-call schedule changes do **not** require this file to change — only the channel IDs in the JSON policy templates.

---

**Last Updated:** 2026-05-08 | **Version:** 1.4-rc1 | **Author:** Wave 2 Agent 5

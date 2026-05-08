# Observability Runbook — v1.4

**Audience:** On-call engineers, RT (Responsável Técnico), DPO, CTO.
**Scope:** Response procedures for the 6 alerts defined in [`ALERT_RULES_v1.4.md`](ALERT_RULES_v1.4.md).
**Project:** `hmatologia2` · Region: `southamerica-east1`.

---

## How to use this runbook

1. Alert fires → notification channel pages the right role.
2. Recipient acknowledges in PagerDuty/Slack within SLA (see role contract below).
3. Recipient opens this runbook to the matching section (`#a1-...` through `#a6-...`).
4. Follow the **Triage → Diagnose → Mitigate → Communicate → Post-incident** flow.

**SLA per role:**

| Role | Ack SLA | Mitigation SLA |
|------|---------|----------------|
| On-call eng (WARNING) | 15 min | 1 hour |
| On-call eng (ERROR) | 5 min | 30 min |
| RT / DPO (ERROR/CRITICAL) | 10 min | 30 min (clinical) / 60 min (privacy) |
| CTO (CRITICAL) | 5 min | 15 min |

---

## A1 — Audit log fallback engaged

**Alert ID:** A1 · **Severity:** WARNING
**Compliance:** RDC 978 Art. 128, ADR-0017.

### Triage (first 5 min)

- Check the volume: was it a transient burst (e.g. a single function deploy retry) or sustained?
- Confirm the fallback collection received the writes that the primary failed to record:

  ```bash
  gcloud firestore documents list \
    --collection-ids=auditLogFailures \
    --project=hmatologia2 \
    --limit=20
  ```

- If `auditLogFailures` is also empty → escalate to A1+A4 simultaneously (both layers failed = chain-of-custody risk).

### Diagnose

Common root causes:

1. **Firestore quota throttling** — check `Request rate exceeded` in Firestore logs.
2. **Permission regression** — recent rules deploy revoked Admin SDK write to `auditLogs/{labId}/events`. Compare `firestore.rules` to git HEAD~1.
3. **Retry budget exhausted** — `writeAuditLog` retries 3× with exponential backoff. If the underlying error persists > ~7s, fallback engages.

```bash
gcloud logging read \
  '[writeAuditLog] FAILED after retries' \
  --project=hmatologia2 \
  --limit=20 \
  --format=json | jq '.[] | {ts: .timestamp, action: .jsonPayload.action, labId: .jsonPayload.labId, err: .jsonPayload.error}'
```

### Mitigate

- **Quota issue:** request a temporary quota bump in GCP Console (Firestore writes/sec). Auto-backoff usually resolves within 5 min.
- **Rules regression:** rollback `firestore.rules`:
  ```bash
  git checkout HEAD~1 firestore.rules
  firebase deploy --only firestore:rules --project hmatologia2
  ```
- **Sustained > 1h:** drain the `auditLogFailures` fallback collection by running the reconciliation script (`scripts/reconcile-audit-failures.ts` — TODO if absent).

### Communicate

- Post in `#hmatologia2-incidents` Slack with: timestamp, count, suspected cause, mitigation status.
- If reconciliation drained > 100 entries: notify RT (compliance impact).

### Post-incident

- File RCA in `docs/incidents/<date>-A1-audit-fallback.md`.
- If root cause is structural (e.g. quota too low): open ticket to raise default quota.

---

## A2 — Críticos SLA breach

**Alert ID:** A2 · **Severity:** ERROR
**Compliance:** RDC 978 Art. 5.7.1 — physician notification within 60 min.

### Triage (first 5 min)

- Open `criticos-escalacao` dashboard in app: filter `status == 'pending'`, `createdAt < now-60min`.
- Identify the labId(s) affected and the specific patient/exam.
- **RT must immediately attempt direct phone contact** with the requesting physician — SLA breach is happening NOW, not "in alert".

### Diagnose

Why did the escalation not reach the physician?

1. **SMS dispatch failed** (cross-check A5 alert).
2. **Physician phone missing/wrong** in lab profile.
3. **Acknowledgment UI not used** — physician received but didn't click "Acknowledge" in the app.
4. **Cron not running** — `criticos-escalacao` cron is regional; check it's still active in `southamerica-east1`.

```bash
gcloud scheduler jobs describe criticos-escalacao-cron \
  --location=southamerica-east1 \
  --project=hmatologia2
```

### Mitigate

- **RT** continues phone contact regardless of system state. Document outcome in NC.
- If cron is dead: re-enable; trigger manual run.
- If SMS path is broken: switch to voice (Twilio fallback) for affected escalações.

### Communicate

- RT logs an NC (não-conformidade) for every breach, regardless of cause.
- Patient safety incident report if breach > 90 min: use `incidents/critico-sla-template.md`.

### Post-incident

- ANVISA reportable if breach affected high-risk lab result (e.g. K+ > 6.5, glucose < 40).
- File RCA + corrective action in `docs/incidents/<date>-A2-criticos-sla.md`.

---

## A3 — IA-strip consent gate violation

**Alert ID:** A3 · **Severity:** ERROR
**Compliance:** LGPD Art. 9; DICQ 4.4.

### Triage (first 10 min)

- Identify the `labId` and `patientId` involved.

  ```bash
  gcloud logging read \
    'resource.type="cloud_function" AND textPayload:"consent-not-captured"' \
    --project=hmatologia2 \
    --limit=10 \
    --format=json | jq '.[] | {ts: .timestamp, labId: .jsonPayload.labId, patientId: .jsonPayload.patientId}'
  ```

- This is **not** a breach by itself — the gate worked: it blocked the call. But every occurrence reveals a UX gap (operator tried to use IA without consent captured).

### Diagnose

- **Expected outcome of A3:** consent was correctly absent, gate fired, no PII left the perimeter. ✅
- **Unexpected outcome:** if the same labId/patientId triggers A3 repeatedly → suspected workflow gap (operator unaware of consent step).

### Mitigate

- DPO contacts the lab admin to walk through the consent capture UI.
- If lab has > 3 violations / hour: temporarily disable IA-strip for that labId in feature flags (manual ops).
- Surface CTA "Capturar consentimento" in the UI (open ticket — see `agent-7-pii-guardrail.md` follow-ups).

### Communicate

- DPO sends written notice to lab admin (template: `docs/observability/templates/consent-violation-notice.md` — TODO).
- RT informed of the lab + frequency.

### Post-incident

- If pattern persists across labs: this is a UX bug, not an alert problem. Open a Phase 5 ticket.
- File a brief in `docs/incidents/<date>-A3-consent-gate.md` summarizing patterns.

---

## A4 — HMAC chain break

**Alert ID:** A4 · **Severity:** CRITICAL
**Compliance:** RDC 978 Art. 128, ADR-0017. **This is the highest-severity alert in v1.4.**

### Triage (first 2 min)

**STOP. DO NOT PROCEED WITH OTHER WORK UNTIL ACKED.**

- CTO + RT join an incident bridge (Slack huddle / phone).
- Identify the affected collection + document IDs:

  ```bash
  gcloud logging read \
    '[generateChainHash] previous hash mismatch' \
    --project=hmatologia2 \
    --limit=20 \
    --format=json | jq '.[] | {ts: .timestamp, fn: .resource.labels.function_name, collection: .jsonPayload.collection, eventId: .jsonPayload.eventId}'
  ```

### Diagnose

A chain break means one of:

1. **Tampering** — someone modified an audit-event document directly (Admin SDK or compromised credentials). Highest concern.
2. **HMAC secret rotation without baseline reset** — ADR-0017 mandates baseline reset on rotation. If skipped, every subsequent chain check fails.
3. **Race condition** — two writes to the same chain in the same ms. Should be impossible with our locking, but verify.
4. **Bug in `verifyChainHash`** — recent code change broke verification. Check git log.

### Mitigate

- **Freeze writes** to the affected collection:
  - Push a temporary Firestore rule that denies all writes to the affected `match` block.
  - Deploy: `firebase deploy --only firestore:rules --project hmatologia2`.
- **Snapshot** the affected collection state to Cloud Storage for forensics:
  ```bash
  gcloud firestore export gs://hmatologia2-forensics/<incident-id>/ \
    --collection-ids=<collection-name> \
    --project=hmatologia2
  ```
- **Do NOT** attempt to "fix" the chain by re-hashing. That destroys evidence. Wait for forensics.

### Communicate

- **Within 1 hour:** CTO + DPO joint message to RT + lab owner.
- **Within 72 hours (if confirmed tampering of regulatory data):** ANVISA notification per RDC 978 + ANPD notification per LGPD.
- Internal: `#incident-critical` Slack channel; create incident doc immediately.

### Post-incident

- Forensic RCA in `docs/incidents/<date>-A4-hmac-chain-break.md` — full timeline, evidence, attribution.
- **Mandatory:** review HMAC secret access logs in Secret Manager for the 30 days prior.
- If tampering confirmed: rotate HMAC secret, force baseline reset, re-issue chain from snapshot.

---

## A5 — Twilio SMS failure rate > 10%

**Alert ID:** A5 · **Severity:** WARNING
**Compliance:** RDC 978 Art. 5.7.1 (críticos delivery channel).

### Triage (first 10 min)

- Check Twilio status page: <https://status.twilio.com/>.
- If carrier outage in BR: WARNING is benign, mitigate by switching críticos to voice fallback.

```bash
gcloud logging read \
  'resource.type="cloud_function" AND jsonPayload.twilio.status="failed"' \
  --project=hmatologia2 \
  --limit=20 \
  --format=json | jq '.[] | {ts: .timestamp, error: .jsonPayload.twilio.errorCode, to: .jsonPayload.twilio.to}'
```

### Diagnose

Twilio error codes:
- `30003` — unreachable destination (phone off / no signal). Usually transient.
- `30005` — unknown destination (number invalid). Lab profile data quality issue.
- `30006` — landline / unreachable carrier. Need voice fallback.
- `21610` — recipient unsubscribed (STOP). Lab should know this number is opted out.
- `20003` — auth failure on Twilio side. **Check Twilio account status / billing.**

### Mitigate

- For `20003` / `20429` (rate limit): contact Twilio support, check account standing.
- For `30003` / `30006`: enable voice-call fallback for críticos for the duration of the incident.
- Sustained > 50% failure rate: switch to backup SMS provider (if configured) or escalate to manual phone tree.

### Communicate

- On-call engineer posts status in `#hmatologia2-ops`.
- RT informed only if críticos delivery is at risk (sustained > 50%).

### Post-incident

- If pattern is bad lab data (invalid numbers): open data-quality ticket per labId.
- File RCA in `docs/incidents/<date>-A5-twilio-sms.md`.

### Defining the log-based metric (one-time setup)

```bash
gcloud logging metrics create twilio_sms_attempts \
  --description="Twilio SMS dispatch attempts" \
  --log-filter='resource.type="cloud_function" AND resource.labels.function_name=~"criticos.*" AND jsonPayload.twilio.status:*' \
  --project=hmatologia2

gcloud logging metrics create twilio_sms_failures \
  --description="Twilio SMS dispatch failures" \
  --log-filter='resource.type="cloud_function" AND resource.labels.function_name=~"criticos.*" AND jsonPayload.twilio.status="failed"' \
  --project=hmatologia2
```

The policy then references both metrics for the ratio condition.

---

## A6 — Gemini call without consent

**Alert ID:** A6 · **Severity:** CRITICAL
**Compliance:** LGPD Art. 9; DICQ 4.4. **This is a privacy breach if confirmed.**

### Triage (first 5 min)

- DPO + CTO join incident bridge.
- Identify the labId, patientId, captureId from the egress audit log:

  ```bash
  gcloud logging read \
    '[geminiEgressAudit] CONSENT_BYPASS' \
    --project=hmatologia2 \
    --limit=10 \
    --format=json | jq '.[] | {ts: .timestamp, labId: .jsonPayload.labId, captureId: .jsonPayload.captureId}'
  ```

- **A6 implies that A3 (consent gate) was bypassed** — either gate disabled, code path skipped it, or the gate was added after a code path was deployed without it. Every A6 is a P0.

### Diagnose

1. **Gate code removed/disabled** — check git log for `consentGate.ts` changes.
2. **New Gemini-calling path skipped the gate** — every new IA feature must call `consentGate()` BEFORE Gemini. Check if the bypassing function imports `consentGate`.
3. **Audit log race** — `imuno-ia-guardrails` event was written but > 60s after Gemini call (out of window). Less likely.

### Mitigate

- **Immediately disable** the bypassing function:
  ```bash
  gcloud functions deploy <fn-name> --no-allow-unauthenticated --project=hmatologia2 --region=southamerica-east1
  ```
  (Or remove from `functions/src/index.ts` and redeploy.)
- Suspend IA-strip for the affected labId pending DPO clearance.
- Snapshot Gemini logs + Firestore state for forensics.

### Communicate

- **Within 1 hour:** DPO drafts initial assessment.
- **Within 72 hours (if confirmed PII reached Gemini without consent):** ANPD notification per LGPD Art. 48 + lab + patient notification.
- Internal: `#incident-critical`.

### Post-incident

- Mandatory code review of every Gemini-calling function: confirm `consentGate()` is the first line.
- Add to PR template: "Does this path call Gemini? If yes, was `consentGate()` called first?"
- File RCA in `docs/incidents/<date>-A6-gemini-bypass.md` with full timeline, scope of data exposure, remediation.

---

## Quick reference — escalation tree

```
WARNING (A1, A5)
  └─→ on-call eng (15 min ack)
       └─→ if unresolved 2h → CTO

ERROR (A2, A3)
  ├─→ on-call eng (5 min ack)
  ├─→ A2: + RT (10 min ack)
  └─→ A3: + DPO + RT (10 min ack)
       └─→ if pattern persists → CTO

CRITICAL (A4, A6)
  ├─→ CTO (5 min ack, phone)
  ├─→ A4: + RT (immediate)
  ├─→ A6: + DPO (immediate)
  └─→ regulatory notification clock starts (72h)
```

---

## Generic "alert not firing when expected" troubleshooting

1. Verify the policy exists: `gcloud alpha monitoring policies list --project=hmatologia2 --filter="displayName:A<N>*"`.
2. Verify notification channels are bound: `gcloud alpha monitoring channels list --project=hmatologia2`.
3. Verify the log query returns data: paste filter into Cloud Logs Explorer manually.
4. Verify the policy is `enabled: true` (not paused).
5. Verify recent log volume — if function never invoked, alert can't fire.

---

**Last Updated:** 2026-05-08 | **Version:** 1.4-rc1 | **Owner:** Wave 2 Agent 5 (initial); CTO (ongoing)

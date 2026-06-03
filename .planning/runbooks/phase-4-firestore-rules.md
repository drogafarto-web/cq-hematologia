# Runbook: Firestore Rules Rejections Spike

**Alert Name:** `firestore-rule-rejections-spike`  
**Severity:** P2 — Some users cannot access data  
**Response Time SLA:** <1 hour  
**Escalation:** Security team if multi-tenant isolation breach suspected

---

## What This Alert Means

Firestore is rejecting read/write operations from authenticated users. >10 permission denials in 5 minutes indicates either:

1. A rule syntax bug (allows rejecting valid users)
2. Client passing corrupted session tokens
3. Multi-tenant isolation breach attempt (security incident)

---

## Immediate Triage (5 minutes)

### 1. Identify Rejection Pattern

```bash
cd /c/hc\ quality

# Get rejection details
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*"' \
  --limit=50 --project=hmatologia2 --format=json | \
  jq '.[] | {timestamp: .timestamp, path: .labels.documentPath, uid: .labels.uid, operation: .labels.operation}'
```

**Categorize by path pattern:**

```bash
# Count rejections by path
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*"' \
  --limit=100 --project=hmatologia2 --format=json | \
  jq '[.[] | .labels.documentPath] | group_by(.) | map({path: .[0], count: length}) | sort_by(.count) | reverse' | head -10
```

**Look for:**

- **Single user, multiple paths** → User token corrupted or revoked
- **Multiple users, same path** → Rule syntax bug
- **Portal tokens + patient paths** → Multi-tenant isolation check needed
- **RT tokens + admin paths** → RBAC enforcement check

### 2. Decision Tree

**Is the rejected path a portal patient collection?**

- Yes (e.g., `/labs/X/patients/Y/laudos`) → Go to **Section 2A** (Portal Access)
- No → Go to **Section 2B** (Internal Access)

---

## Section 2A: Portal Patient Access Rejection

**Applies if:** Patient tokens being rejected on `/labs/{labId}/patients/{patientId}/*`

### Step 1: Verify Patient Token is Valid

```bash
# Get sample rejection
gcloud logging read \
  'resource.type="firestore" AND \
   textPayload=~".*Permission.*denied.*" AND \
   labels.documentPath=~".*/patients/.*"' \
  --limit=1 --project=hmatologia2 --format=json | \
  jq '.[0] | {uid: .labels.uid, path: .labels.documentPath, operation: .labels.operation}'
```

**Get user details:**

```bash
# What is this user's role?
gcloud firestore documents get \
  labs/{labId}/members/{uid} \
  --project=hmatologia2 | jq '.data | {role: .role, status: .status}'
```

**Expected for patient access:**

```json
{
  "role": "patient",
  "status": "active"
}
```

**If role is not "patient":**

- This is expected rejection (rule is working)
- Not a bug — inform user they don't have access to that lab

**If role is "patient" but still rejected:**

- Go to **Step 2** (Rule syntax check)

### Step 2: Check Firestore Rules Syntax

```bash
# Show relevant rule block
grep -A20 "match /labs/{labId}/patients" firestore.rules
```

**Look for:**

```firestore
match /labs/{labId}/patients/{patientId} {
  allow read: if isActiveMemberOfLab(labId) &&
              request.auth.token.role == 'patient' &&
              request.auth.uid == patientId;
}
```

**Common bugs:**

- Missing `request.auth.token.role` check
- Typo in role name (e.g., `'Patient'` vs `'patient'`)
- Missing `isActiveMemberOfLab()` call
- Incorrect `uid` comparison (should use `patientId`, not request.auth.uid)

**If bug found:**

1. Fix syntax in `firestore.rules`
2. Validate:
   ```bash
   npx firebase-rules-compile firestore.rules
   ```
3. Test in emulator:
   ```bash
   firebase emulators:start --only firestore
   npm run test:rules
   ```
4. Deploy:
   ```bash
   firebase deploy --only firestore:rules --project=hmatologia2
   ```

### Step 3: Check Patient Session Token

If rules syntax is correct but patient still rejected:

```bash
# Patient: Get token from browser console
// In browser (portal logged in as patient):
const token = await auth.currentUser.getIdTokenResult();
console.log({
  uid: token.uid,
  labId: token.claims.labId,
  role: token.claims.role
});
```

**Expected:**

```json
{
  "uid": "{patientId}",
  "labId": "{correctLabId}",
  "role": "patient"
}
```

**If `labId` is wrong:**

- Patient logged into wrong lab account
- Fix: Patient logout + re-login to correct lab
- Not a bug

**If `role` is wrong:**

- Token generation bug (should not happen)
- Page CTO immediately
- Soft-delete patient session + force re-auth

### Step 4: Check Multi-Tenant Isolation

**Critical security check:**

```bash
# Are patients reading patients from OTHER labs?
gcloud logging read \
  'resource.type="firestore" AND \
   textPayload=~".*Permission.*denied.*" AND \
   labels.documentPath=~".*/patients/.*"' \
  --limit=50 --project=hmatologia2 --format=json | \
  jq '.[] |
    select(.labels.documentPath | test("labs/[^/]+/patients")) |
    {uid: .labels.uid, path: .labels.documentPath} |
    split("/") as $parts |
    {labId: $parts[1], patientId: $parts[3], uid: .uid} |
    select(.patientId != .uid)'
```

**If any patients are trying to access other patients' data:**

- 🚨 **SECURITY INCIDENT** — Page CTO immediately
- Possible account compromise or privilege escalation
- Investigate login history + session tokens

---

## Section 2B: Internal (RT/Admin) Access Rejection

**Applies if:** RT or admin tokens being rejected on internal paths

### Step 1: Verify User Role

```bash
# Get rejection details
gcloud logging read \
  'resource.type="firestore" AND textPayload=~".*Permission.*denied.*" AND \
   labels.documentPath!~".*/patients/.*"' \
  --limit=1 --project=hmatologia2 --format=json | \
  jq '.[0] | {uid: .labels.uid, path: .labels.documentPath, operation: .labels.operation}'
```

**Check user membership:**

```bash
gcloud firestore documents get \
  labs/{labId}/members/{uid} \
  --project=hmatologia2 | jq '.data | {role: .role, status: .status}'
```

**Common scenarios:**

| User Role | Rejected Path             | Expected? | Action                            |
| --------- | ------------------------- | --------- | --------------------------------- |
| RT        | `/labs/{labId}/runs/*`    | No        | Rule bug → Fix rules              |
| RT        | `/labs/{labId}/admin/*`   | Yes       | User doesn't have permission — OK |
| Admin     | `/labs/{labId}/runs/*`    | No        | Rule bug → Fix rules              |
| Viewer    | `/labs/{labId}/results/*` | Yes       | User can only read → OK           |

### Step 2: If Rejection is Unexpected

```bash
# Check the specific rule
grep -B5 -A10 "match /labs/{labId}/runs" firestore.rules | head -20
```

**Expected rule block:**

```firestore
match /labs/{labId}/runs/{runId} {
  allow read: if isActiveMemberOfLab(labId);
  allow write: if isActiveMemberOfLab(labId) &&
               request.auth.token.role in ['admin', 'RT'];
}
```

**Common bugs:**

- Missing `isActiveMemberOfLab()` check
- Role comparison typo (e.g., `'rt'` vs `'RT'`)
- Overly restrictive role check (missing allowed roles)
- Collection guard blocking valid operations

**If bug found:**

1. Fix in `firestore.rules`
2. Test in emulator
3. Deploy: `firebase deploy --only firestore:rules`

### Step 3: Check User Status

```bash
# Is user marked as "active" in members collection?
gcloud firestore documents get \
  labs/{labId}/members/{uid} \
  --project=hmatologia2 | jq '.data.status'
```

**If status is not "active":**

- User was soft-deleted or deactivated
- This is expected rejection
- Reactivate user if needed:
  ```bash
  gcloud firestore documents update \
    labs/{labId}/members/{uid} \
    status="active"
  ```

---

## Step 3: Check for Session Token Corruption

```bash
# Get user's auth claims from Firebase
firebase auth:export users.json --project=hmatologia2 | \
  jq '.users[] | select(.uid == "{uid}") | {
    displayName: .displayName,
    email: .email,
    customClaims: .customClaims
  }'
```

**Expected custom claims:**

```json
{
  "labId": "{expectedLabId}",
  "role": "{expectedRole}",
  "status": "active"
}
```

**If claims don't match member doc:**

- Token may be stale (user was updated but token not refreshed)
- User: Logout + re-login
- Or: Force token refresh: `await auth.currentUser.getIdToken(true)`

---

## Recovery Validation (5 minutes)

```bash
# Monitor rejection rate
watch -n 10 'gcloud logging read \
  "resource.type=firestore AND textPayload=~Permission.denied" \
  --limit=50 --project=hmatologia2 | \
  jq "length"'
```

**Success criteria:**

- Rejection count <2 per 5 minutes (normal background noise)
- Affected users can access data again
- No new rejections for same user/path pair

---

## Post-Incident Checklist

- [ ] Create incident ticket (title: "Firestore Rules Rejections [date]")
- [ ] Document root cause (rule bug, token issue, or security event)
- [ ] If rule bug: verify fix passes emulator tests before deploying
- [ ] If token issue: notify affected users + guide re-auth
- [ ] If security event: conduct detailed investigation + notify security team
- [ ] Review audit trail for suspicious access patterns (see Dashboard 3)
- [ ] Update alert threshold if rate was false positive

---

## Security Escalation Criteria

**Immediately page CTO + Security team if:**

1. **Cross-lab access detected** — Patient from Lab A accessing Lab B data
2. **Privilege escalation** — User with "viewer" role writing to admin collections
3. **Mass rejection spike** — >50 rejections per minute (possible DDoS)
4. **Signature validation failures** — Hash mismatches on audit writes

---

**Last Updated:** 2026-05-07  
**Owner:** Security team + Alert Manager  
**Review Frequency:** Per incident

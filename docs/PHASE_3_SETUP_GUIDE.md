# Phase 3 CI/CD Setup Guide

> **Status**: Initial setup required before first deployment  
> **Time required**: 15 minutes  
> **Date**: 2026-05-07

---

## Overview

The Phase 3 deployment workflow requires:

1. GitHub secrets (Firebase authentication)
2. Branch protection rules (merge gates)
3. GitHub Actions permissions (deployment triggers)
4. Local validation scripts (pre-merge checks)

This guide walks through each step.

---

## Step 1: Firebase Authentication Token

### Generate Token

```bash
cd /c/hc\ quality

# Login to Firebase with your account
firebase login:ci --project hmatologia2
```

**Output**: Long token string (starts with `[1]`)

```
i  To sign in with credentialfor this CI environment, run the command below and follow the prompts:

To open this link on a browser, navigate to https://accounts.google.com/...
Waiting for authentication...

[1] <your-firebase-token-here>
```

### Store in GitHub

1. Navigate to: **GitHub → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. **Name**: `FIREBASE_TOKEN`
4. **Value**: Paste the token from step above
5. Click **Add secret**

**Verify**:

```bash
# In GitHub Actions UI, you should see "FIREBASE_TOKEN" in the Secrets list
```

---

## Step 2: Branch Protection Rules

### Create/Update Main Branch Rule

1. Navigate to: **GitHub → Settings → Branches**
2. Click **Add rule** (or edit existing `main` rule)
3. **Branch name pattern**: `main`

### Configure Protection

#### Require Pull Request Reviews

```
✅ Require a pull request before merging
   ├─ Required number of reviews before merge: 1
   ├─ ✅ Dismiss stale pull request approvals when new commits are pushed
   └─ ✅ Require review from code owners (if .github/CODEOWNERS exists)
```

#### Require Status Checks

```
✅ Require status checks to pass before merging
   ├─ ✅ Require branches to be up to date before merging
   └─ Select required status checks:
       ├─ web (Node 22)
       ├─ functions
       └─ pre-deploy-gate
```

#### Other Protections

```
✅ Require conversation resolution before merging
❌ Allow auto-merge (keep disabled for control)
✅ Require code reviews from owners
```

### Save

Click **Create/Update rule** (at bottom)

---

## Step 3: Workflow Permissions

### GitHub Actions Permissions

1. Navigate to: **GitHub → Settings → Actions → General**
2. Under "Workflow permissions":

```
✅ Read and write permissions
   (allows workflows to deploy)

✅ Allow GitHub Actions to create and approve pull requests
   (optional, but recommended for automated fixes)
```

3. Click **Save**

---

## Step 4: Local Pre-Merge Setup

### Add npm Scripts (Already in package.json)

Verify these exist:

```bash
cd /c/hc\ quality

# Should all succeed
npm run typecheck
npm run lint
npm run test:unit
npm run test:coverage
npm run build
npm run test:smoke

cd functions && npm run build && cd ..
bash scripts/preflight-secrets-check.sh
```

### Git Hooks (Optional but Recommended)

Create `.git/hooks/pre-commit` to validate before commit:

```bash
#!/bin/bash
set -e

echo "Pre-commit: Running validation..."

npm run typecheck || {
  echo "❌ Type-check failed"
  exit 1
}

npm run lint -- --max-warnings 88 || {
  echo "❌ Lint failed"
  exit 1
}

echo "✅ Pre-commit checks passed"
```

**Setup**:

```bash
# On macOS/Linux:
chmod +x .git/hooks/pre-commit

# On Windows (Git Bash):
# Hooks already work if using Git Bash
```

---

## Step 5: Verify Workflow File

### Check Workflow Syntax

The workflow is committed at: `.github/workflows/phase-3-deploy.yml`

**Verify in GitHub UI**:

1. Navigate to: **GitHub → Actions**
2. Look for **"Phase 3 Deploy — Production Gates + Rollback"**
3. Should show status: `No recent runs` (until first trigger)

### Test Trigger (Optional)

To verify workflow runs (without deploying production):

```bash
# Push to a branch (not main)
git checkout -b test/workflow-validation
git push origin test/workflow-validation

# Create PR to main
# This will trigger: pre-deploy-gate, web, functions checks
# (But not actual deploy, since it's not a merge to main)

# Check Actions tab → All checks should pass
# Then close PR without merging
```

---

## Step 6: Document Deployment Contacts

### Create DEPLOYMENT_CONTACTS.md (Optional)

In repo root:

```markdown
# Deployment Contacts

## On-Call Engineer

- **Name**: [Your Name]
- **Slack**: @on-call
- **Escalation**: Platform team lead

## Incident Response

- **Post critical deploy**: Notify #deployments
- **Rollback needed**: Call on-call immediately
- **Out of hours**: Page PagerDuty

## Secrets Management

- **Firebase token expired**: Contact GCP admin
- **New secret needed**: File ticket in [system]
```

---

## Step 7: Cloud Logs Setup (Post-Deploy Monitoring)

### Enable Cloud Logs Export

**In Google Cloud Console**:

1. Go to: https://console.cloud.google.com/logs?project=hmatologia2
2. Create a **Log Sink** (optional, for long-term retention):
   - **Sink name**: `hcq-deploy-monitoring`
   - **Query**:
     ```
     resource.type=cloud_function
     severity>=ERROR
     timestamp>="2026-05-07T00:00:00Z"
     ```
   - **Destination**: Cloud Storage bucket (or BigQuery for querying)

### Verify Scripts Work

```bash
# Test the monitoring script locally (requires gcloud CLI)
bash scripts/monitor-cloud-logs.sh 1 30
# Should output logs every 30s for 1 minute
```

---

## Step 8: Verify All Pieces Work

### Full Pre-Deploy Validation

```bash
cd /c/hc\ quality

echo "1. Type-check..."
npm run typecheck

echo "2. Lint..."
npm run lint

echo "3. Unit tests..."
npm run test:unit

echo "4. Coverage..."
npm run test:coverage

echo "5. Build app..."
npm run build

echo "6. Build functions..."
cd functions && npm run build && cd ..

echo "7. Secrets check..."
bash scripts/preflight-secrets-check.sh

echo "✅ All pre-deploy gates pass locally!"
```

**Expected output**:

```
✅ All pre-deploy gates pass locally!
```

### First Deployment (Test)

1. Create test branch:

   ```bash
   git checkout -b test/first-deploy
   echo "test" >> README.md
   git add -A
   git commit -m "test: first deploy workflow"
   git push origin test/first-deploy
   ```

2. Open PR to main

3. Wait for status checks:
   - `pre-deploy-gate` ✅
   - `web` ✅
   - `functions` ✅

4. **Don't merge yet** — just verify checks pass

5. Close PR

6. Now you're ready for real deploys!

---

## Troubleshooting

### Problem: `FIREBASE_TOKEN` not found during deploy

**Cause**: Secret not stored in GitHub

**Fix**:

```bash
# Regenerate token
firebase login:ci --project hmatologia2

# Add to GitHub Secrets
# Settings → Secrets and variables → Actions → New secret
# Name: FIREBASE_TOKEN
```

### Problem: Workflow doesn't trigger on push to main

**Cause**: Branch protection rule or workflow config issue

**Check**:

1. File exists: `.github/workflows/phase-3-deploy.yml` ✅
2. Branch protection rule for `main` exists ✅
3. YAML syntax is valid (GitHub UI shows no error) ✅
4. Commit affected `firestore.rules`, `firestore.indexes.json`, or `functions/` ✅

### Problem: Pre-deploy gate fails locally

**Cause**: Code doesn't meet quality standards

**Fix**:

```bash
npm run typecheck          # Fix any TS errors
npm run lint --fix          # Auto-fix lint issues
npm run test:unit           # Fix failing tests
npm run test:coverage       # Add tests for uncovered paths
npm run build               # Verify build succeeds
```

### Problem: `preflight-secrets-check.sh` fails

**Cause**: Firebase secret is unprovisioned

**Fix**:

```bash
firebase functions:secrets:set SECRET_NAME --project hmatologia2
# Follow prompts to set value

# Retry gate
bash scripts/preflight-secrets-check.sh
```

---

## Next Steps

1. **Complete all 8 steps above**
2. **Run local validation** (Step 8)
3. **Push small PR** to test workflow (Step 8, test phase)
4. **Verify checks pass** in GitHub UI
5. **Deploy confidently** 🚀

---

## Checklist

- [ ] Step 1: Firebase token generated + stored in GitHub
- [ ] Step 2: Branch protection rule created for `main`
- [ ] Step 3: GitHub Actions permissions set to "read and write"
- [ ] Step 4: Local npm scripts verified working
- [ ] Step 5: Workflow file exists + no syntax errors
- [ ] Step 6: Deployment contacts documented (optional)
- [ ] Step 7: Cloud Logs monitoring script tested
- [ ] Step 8: Full pre-deploy validation passes
- [ ] Final: Small PR merged successfully

---

## Support

| Issue            | Command                                   | Reference                            |
| ---------------- | ----------------------------------------- | ------------------------------------ |
| Type-check fails | `npm run typecheck`                       | `tsconfig.json`                      |
| Lint fails       | `npm run lint --fix`                      | `.eslintrc.js`                       |
| Tests fail       | `npm run test:unit --watch`               | `vitest.config.ts`                   |
| Coverage low     | `npm run test:coverage`                   | `vitest.config.ts`                   |
| Build fails      | `npm run build`                           | `vite.config.ts`                     |
| Secrets fail     | `bash scripts/preflight-secrets-check.sh` | `scripts/preflight-secrets-check.sh` |

---

**Generated**: 2026-05-07  
**For**: HC Quality (CQ Labclin) · Phase 3+  
**Next review**: 2026-06-07

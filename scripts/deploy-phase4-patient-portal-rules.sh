#!/bin/bash
# Deploy Phase 4 Patient Portal Firestore Rules and Indexes
# Deploys rules for /laudos, /labs/{labId}/patients, /patient-auth-sessions, /patient-nps-feedback
# Author: HC Quality Architecture
# Date: 2026-05-07

set -e

PROJECT="${1:-hmatologia2}"
STAGING_PROJECT="${2:-hcquality-staging}"
SKIP_STAGING="${3:-}"

echo "════════════════════════════════════════════════════════════════"
echo "Phase 4 Patient Portal Rules Deployment"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Target Project: $PROJECT"
echo "Staging Project: $STAGING_PROJECT"
echo ""

# Step 1: Validate rule syntax via emulator
echo "Step 1: Validating Firestore rules syntax via emulator..."
echo ""

# Start emulator in background
echo "Starting Firestore emulator..."
firebase emulators:start --only firestore --project "$PROJECT" &
EMULATOR_PID=$!
sleep 3

# Run rule validation tests
echo "Running rule validation tests..."
npm test -- --testPathPattern="firestore.rules" --testNamePattern="patient-portal" 2>&1 || {
  echo "❌ Rule validation failed!"
  kill $EMULATOR_PID 2>/dev/null || true
  exit 1
}

# Stop emulator
kill $EMULATOR_PID 2>/dev/null || true
sleep 1

echo "✓ Rule syntax valid"
echo ""

# Step 2: Deploy to staging (if not skipped)
if [ -z "$SKIP_STAGING" ]; then
  echo "Step 2: Deploying to staging ($STAGING_PROJECT)..."
  echo ""
  firebase deploy \
    --only firestore:rules,firestore:indexes \
    --project "$STAGING_PROJECT" \
    --force
  echo "✓ Staging deployment complete"
  echo ""

  echo "⚠️  Waiting for indexes to build on staging (2-5 minutes)..."
  echo "Monitor at: https://console.firebase.google.com/project/$STAGING_PROJECT/firestore/indexes"
  echo ""
  read -p "Press Enter once indexes are BUILT (green status)..." < /dev/tty
  echo ""
fi

# Step 3: Deploy to production
echo "Step 3: Deploying to production ($PROJECT)..."
echo ""
echo "⚠️  This will deploy new Firestore rules and indexes to PRODUCTION."
read -p "Are you sure? Type 'deploy' to confirm: " -r CONFIRM < /dev/tty
echo ""

if [ "$CONFIRM" != "deploy" ]; then
  echo "❌ Deployment cancelled."
  exit 1
fi

firebase deploy \
  --only firestore:rules,firestore:indexes \
  --project "$PROJECT" \
  --force

echo "✓ Production deployment complete"
echo ""

# Step 4: Wait for index build
echo "Step 4: Waiting for indexes to build (2-5 minutes)..."
echo "Monitor at: https://console.firebase.google.com/project/$PROJECT/firestore/indexes"
echo ""
echo "Index build is asynchronous. Come back after 2-5 min and verify all are in 'Ready' state."
echo ""

# Step 5: Smoke test commands
echo "════════════════════════════════════════════════════════════════"
echo "Step 5: Manual Smoke Tests"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Run these tests via Firestore Console or via gcloud CLI:"
echo ""
echo "Test 1: Portal patient reads own laudo"
echo "  → Authenticate as patient (portal token)"
echo "  → Query: laudos where patientId == user.uid"
echo "  → Expected: laudo visible, read allowed ✓"
echo ""
echo "Test 2: RT reads all lab laudos"
echo "  → Authenticate as RT (member of lab, role='rt')"
echo "  → Query: /labs/{labId}/laudos/* or query by labId in global collection"
echo "  → Expected: all lab laudos visible, read allowed ✓"
echo ""
echo "Test 3: Non-lab user cannot read laudo"
echo "  → Authenticate as user NOT in lab members"
echo "  → Try: read /laudos/{laudoId}"
echo "  → Expected: PERMISSION_DENIED ✓"
echo ""
echo "Test 4: Client cannot write laudo"
echo "  → Authenticate as any user"
echo "  → Try: create /laudos/{new_id}"
echo "  → Expected: PERMISSION_DENIED ✓"
echo ""
echo "Test 5: Patient can read own auth session"
echo "  → Authenticate as patient (portal token)"
echo "  → Query: /patient-auth-sessions where patientId == user.uid"
echo "  → Expected: own session visible, read allowed ✓"
echo ""
echo "Test 6: Auditor reads NPS feedback"
echo "  → Authenticate as auditor (member of lab, role='auditor')"
echo "  → Query: /patient-nps-feedback where labId == {labId}"
echo "  → Expected: feedback visible, read allowed ✓"
echo ""

echo "════════════════════════════════════════════════════════════════"
echo "✓ Deployment complete!"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Monitor Cloud Logs for rule rejections: https://console.cloud.google.com/logs/query"
echo "  2. Run smoke tests (see above)"
echo "  3. Update DEPLOYMENT_LOG.md with changes"
echo ""

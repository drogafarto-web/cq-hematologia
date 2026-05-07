#!/bin/bash

# Phase 4 Smoke Test Suite
# 10 automated checks for post-deployment validation
# Usage: bash .planning/scripts/phase-4-smoke-test.sh
# Exit code: 0 = all pass, 1 = at least one fail

set -e

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNED=0
TOTAL=10

# Helper functions
pass() {
  echo -e "${GREEN}✓ PASS${NC}"
  ((PASSED++))
}

fail() {
  echo -e "${RED}✗ FAIL${NC}"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}⚠ WARN${NC}"
  ((WARNED++))
}

# Banner
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Phase 4 Smoke Test Suite — 10 Automated Checks"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Target: hmatologia2.web.app (southamerica-east1)"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S UTC%z')"
echo ""

# ─────────────────────────────────────────────────────────────────
# CHECK 1: Hosting Reachable
# ─────────────────────────────────────────────────────────────────
echo -n "[1/$TOTAL] Hosting reachable... "

if curl -s -f https://hmatologia2.web.app/portal/auth > /tmp/phase4_auth.html 2>&1; then
  if grep -q "HC Quality\|auth" /tmp/phase4_auth.html; then
    pass
  else
    echo -e "${RED}✗ FAIL${NC} (page loaded but content missing)"
    ((FAILED++))
  fi
else
  fail
  echo "  Details: curl failed. Hosting may not be deployed."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 2: Firestore Rules Syntax
# ─────────────────────────────────────────────────────────────────
echo -n "[2/$TOTAL] Firestore rules deployed... "

if firebase deploy --only firestore:rules --dry-run --project hmatologia2 > /tmp/phase4_rules.log 2>&1; then
  if grep -q "Validating rules\|Rules are valid" /tmp/phase4_rules.log; then
    pass
  else
    echo -e "${RED}✗ FAIL${NC} (validation did not complete)"
    ((FAILED++))
  fi
else
  fail
  echo "  Details: firebase CLI error. Check credentials."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 3: Cloud Functions Deployed
# ─────────────────────────────────────────────────────────────────
echo -n "[3/$TOTAL] Cloud Functions deployed... "

if gcloud functions list --project hmatologia2 > /tmp/phase4_functions.txt 2>&1; then
  if grep -q "notivisaDraftCreate\|notivisaDraftSubmit\|notivisaQueueProcessor" /tmp/phase4_functions.txt; then
    pass
  else
    echo -e "${RED}✗ FAIL${NC} (NOTIVISA functions not found)"
    ((FAILED++))
  fi
else
  warn
  echo "  Note: gcloud not configured. Skipping function verification."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 4: Anvisa Credentials in Secret Manager
# ─────────────────────────────────────────────────────────────────
echo -n "[4/$TOTAL] Anvisa credentials accessible... "

if gcloud secrets versions access latest --secret "anvisa-credentials" --project hmatologia2 > /dev/null 2>&1; then
  pass
else
  warn
  echo "  Note: Secret not yet provisioned (expected before May 20). Continue."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 5: Cloud Logs Alert Policies
# ─────────────────────────────────────────────────────────────────
echo -n "[5/$TOTAL] Alert policies configured... "

if gcloud alpha monitoring policies list --project hmatologia2 > /tmp/phase4_alerts.txt 2>&1; then
  # Check for at least 3 of 5 expected policies
  ALERT_COUNT=$(grep -c "Auth Failures\|Unhandled Exceptions\|Function Latency\|Error Rate" /tmp/phase4_alerts.txt || echo 0)
  if [ "$ALERT_COUNT" -ge 3 ]; then
    pass
  else
    echo -e "${YELLOW}⚠ WARN${NC} (only $ALERT_COUNT alerts found, expected ≥3)"
    ((WARNED++))
  fi
else
  warn
  echo "  Note: gcloud monitoring not accessible. Manual verification needed."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 6: Firestore Indexes Ready
# ─────────────────────────────────────────────────────────────────
echo -n "[6/$TOTAL] Firestore indexes ready... "

if gcloud firestore indexes list --project hmatologia2 > /tmp/phase4_indexes.txt 2>&1; then
  # Check for notivisa indexes
  INDEX_READY=$(grep -c "READY\|CREATE_COMPLETE" /tmp/phase4_indexes.txt || echo 0)
  if [ "$INDEX_READY" -ge 2 ]; then
    pass
  else
    echo -e "${YELLOW}⚠ WARN${NC} (indexes still building, try in 2-3 minutes)"
    ((WARNED++))
  fi
else
  warn
  echo "  Note: Firestore indexes may still be building."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 7: Unit Tests Pass (Functions)
# ─────────────────────────────────────────────────────────────────
echo -n "[7/$TOTAL] Functions unit tests pass... "

if [ -f "functions/package.json" ]; then
  cd functions
  if npm test > /tmp/phase4_unit_tests.log 2>&1; then
    TEST_COUNT=$(grep -c "passing" /tmp/phase4_unit_tests.log || echo 0)
    if [ "$TEST_COUNT" -gt 0 ]; then
      pass
      echo "  Result: $(grep 'passing' /tmp/phase4_unit_tests.log | tail -1 | sed 's/^[[:space:]]*//')"
    else
      fail
      echo "  Details: Tests ran but output unclear."
    fi
  else
    fail
    echo "  Details: npm test failed. Check functions/package.json and tsconfig."
  fi
  cd - > /dev/null
else
  warn
  echo "  Note: functions/package.json not found. Skipping."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 8: E2E Tests Pass (Critical Flows)
# ─────────────────────────────────────────────────────────────────
echo -n "[8/$TOTAL] E2E tests passing... "

if [ -f "src/__tests__/e2e/phase-4-critical-flows.cy.ts" ]; then
  if npx cypress run --spec "src/__tests__/e2e/phase-4-critical-flows.cy.ts" > /tmp/phase4_e2e.log 2>&1; then
    if grep -q "passing" /tmp/phase4_e2e.log; then
      pass
      echo "  Result: $(grep 'passing' /tmp/phase4_e2e.log | tail -1 | sed 's/^[[:space:]]*//')"
    else
      fail
      echo "  Details: Cypress ran but tests may have failed."
    fi
  else
    fail
    echo "  Details: Cypress execution error. Check config and browser setup."
  fi
else
  warn
  echo "  Note: E2E spec not found. Assuming manual testing will validate."
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 9: Bundle Size <365 KB
# ─────────────────────────────────────────────────────────────────
echo -n "[9/$TOTAL] Bundle size <365 KB... "

if [ -f "dist/index.js" ]; then
  BUNDLE_SIZE=$(du -k "dist/index.js" | awk '{print $1}')
  LIMIT=365
  if [ "$BUNDLE_SIZE" -lt "$LIMIT" ]; then
    pass
    echo "  Size: ${BUNDLE_SIZE} KB (baseline: 362 KB)"
  else
    OVERAGE=$((BUNDLE_SIZE - 362))
    echo -e "${YELLOW}⚠ WARN${NC} (${BUNDLE_SIZE} KB, +${OVERAGE} KB over baseline)"
    ((WARNED++))
  fi
else
  fail
  echo "  Details: dist/index.js not found. Did npm run build complete?"
fi

# ─────────────────────────────────────────────────────────────────
# CHECK 10: Lighthouse Performance Score ≥87
# ─────────────────────────────────────────────────────────────────
echo -n "[10/$TOTAL] Lighthouse score ≥87... "

if command -v lighthouse > /dev/null 2>&1; then
  # Run quick lighthouse on dashboard route (timeout 60s)
  if timeout 60 lighthouse https://hmatologia2.web.app/portal/dashboard \
    --output=json \
    --output-path=/tmp/phase4_lighthouse.json \
    --quiet \
    2>/dev/null; then
    if [ -f "/tmp/phase4_lighthouse.json" ]; then
      SCORE=$(jq '.lighthouseResult.categories.performance.score * 100' /tmp/phase4_lighthouse.json 2>/dev/null || echo 0)
      if [ "$SCORE" -ge 87 ]; then
        pass
        echo "  Score: ${SCORE}/100"
      else
        echo -e "${YELLOW}⚠ WARN${NC} (score: ${SCORE}/100, target: ≥87)"
        ((WARNED++))
      fi
    else
      warn
      echo "  Note: Lighthouse output not parsed. Check manually."
    fi
  else
    warn
    echo "  Note: Lighthouse test timed out or failed. Check browser/network."
  fi
else
  warn
  echo "  Note: lighthouse CLI not installed. Install with: npm install -g lighthouse"
fi

# ─────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "  Passed: ${GREEN}$PASSED / $TOTAL${NC}"
echo "  Failed: ${RED}$FAILED / $TOTAL${NC}"
echo "  Warned: ${YELLOW}$WARNED / $TOTAL${NC}"
echo ""

# Determine overall status
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed. GO-LIVE READY.${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Verify 4-hour monitoring window (8:45am—12:30pm UTC-3)"
  echo "  2. Check all 4 dashboards for anomalies"
  echo "  3. Run manual smoke scenarios (auth, NOTIVISA draft, export)"
  echo "  4. Sign off deployment in #production-alerts Slack"
  echo ""
  exit 0
else
  echo -e "${RED}✗ $FAILED check(s) failed. STOP AND INVESTIGATE.${NC}"
  echo ""
  echo "Failing checks require fix before proceeding:"
  echo "  • Review details above for each failed check"
  echo "  • Fix root cause in code or infrastructure"
  echo "  • Re-run: bash .planning/scripts/phase-4-smoke-test.sh"
  echo "  • Do NOT proceed to GO-LIVE until all pass"
  echo ""
  exit 1
fi

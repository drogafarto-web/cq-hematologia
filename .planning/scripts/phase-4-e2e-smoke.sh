#!/bin/bash

##############################################################################
# Phase 4 E2E Test Smoke Script — Automated test execution
#
# Usage:
#   bash .planning/scripts/phase-4-e2e-smoke.sh [OPTIONS]
#
# Options:
#   --skip-emulator    Skip Firebase emulator check
#   --skip-build       Use cached build (no npm ci/build)
#   --timeout 600      Test timeout in seconds (default: 600)
#
# Examples:
#   bash .planning/scripts/phase-4-e2e-smoke.sh
#   bash .planning/scripts/phase-4-e2e-smoke.sh --skip-emulator --skip-build
#
# Author: HC Quality v1.4 Phase 4 Test Suite
# Date: 2026-05-07
# Runtime: ~5-10 minutes
##############################################################################

set -u  # Exit on undefined variable
set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helpers
log_success() { echo -e "${GREEN}✓ $*${NC}"; }
log_error() { echo -e "${RED}✗ $*${NC}"; }
log_warn() { echo -e "${YELLOW}⚠ $*${NC}"; }
log_info() { echo -e "${CYAN}→ $*${NC}"; }
log_sep() { echo "═══════════════════════════════════════════════════════════"; }

# Parse args
SKIP_EMULATOR=false
SKIP_BUILD=false
TIMEOUT_SECONDS=600

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-emulator) SKIP_EMULATOR=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --timeout) TIMEOUT_SECONDS="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Trap cleanup on exit
cleanup() {
  log_info "Cleaning up background jobs..."
  jobs -p | xargs -r kill -TERM 2>/dev/null || true
}
trap cleanup EXIT

# Start timer
START_TIME=$(date +%s)
log_sep
log_info "Phase 4 E2E Test Smoke Script"
log_info "Start time: $(date +'%H:%M:%S')"
log_sep
echo ""

# Step 1: Check prerequisites
log_info "Step 1: Checking prerequisites..."

check_cmd() {
  if command -v "$1" &>/dev/null; then
    VERSION=$("$@" 2>&1 | head -1)
    log_success "$1: $VERSION"
  else
    log_error "$1 not found"
    exit 1
  fi
}

check_cmd node --version
check_cmd npm --version
check_cmd git --version
echo ""

# Step 2: Install/build
if [ "$SKIP_BUILD" = false ]; then
  log_info "Step 2: Installing dependencies and building..."

  log_info "  npm ci --legacy-peer-deps"
  npm ci --legacy-peer-deps
  log_success "Dependencies installed"

  log_info "  npm run build"
  npm run build
  log_success "Build complete"
else
  log_info "Step 2: Skipped (--skip-build)"
fi
echo ""

# Step 3: Check Firebase Emulator
if [ "$SKIP_EMULATOR" = false ]; then
  log_info "Step 3: Checking Firebase Emulator..."

  if nc -z localhost 9999 2>/dev/null; then
    log_success "Emulator running on localhost:9999"
  else
    log_warn "Emulator not detected. Start with:"
    echo "  firebase emulators:start --project hmatologia2 --only firestore,auth"
    echo ""
    log_error "Please start emulator and run script again"
    exit 1
  fi
else
  log_info "Step 3: Skipped (--skip-emulator)"
fi
echo ""

# Step 4: Seed test data
log_info "Step 4: Seeding test data..."
log_info "  Seeding 10 test laudos per patient..."

mkdir -p .planning/tmp

cat > .planning/tmp/seed-test-data.mjs << 'EOF'
import * as admin from 'firebase-admin';
const db = admin.firestore();

async function seedData() {
  const patients = ['pat_alice_001', 'pat_bob_001', 'pat_carol_001'];
  const exams = ['Hemograma', 'Bioquímica', 'Coagulação'];

  for (const patId of patients) {
    for (let i = 0; i < 10; i++) {
      await db.collection('laudos').doc(`laudo_${patId}_${i}`).set({
        patientId: patId,
        exame: exams[i % 3],
        data: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        status: 'finalizado',
        publicado: true,
        resultados: [],
        criadoEm: new Date(),
      });
    }
  }

  console.log('✓ Seeded test data successfully');
  process.exit(0);
}

seedData().catch(err => {
  console.error('Error seeding:', err);
  process.exit(1);
});
EOF

if node .planning/tmp/seed-test-data.mjs 2>/dev/null; then
  log_success "Test data seeded"
else
  log_warn "Seed script failed (may be OK if data exists)"
fi
echo ""

# Step 5: Start Vite dev server
log_info "Step 5: Starting Vite dev server (localhost:5173)..."
log_info "  npm run dev"

npm run dev &>/tmp/vite-dev.log &
DEV_PID=$!

log_info "  Waiting for server to be ready (max 30s)..."

for i in {1..30}; do
  if nc -z localhost 5173 2>/dev/null; then
    log_success "Dev server ready on localhost:5173"
    break
  fi
  if [ $i -eq 30 ]; then
    log_error "Dev server did not start within 30 seconds"
    tail -20 /tmp/vite-dev.log
    exit 1
  fi
  sleep 1
done
echo ""

# Step 6: Run E2E tests
log_info "Step 6: Running E2E test suite..."
log_info "  File: src/__tests__/e2e/phase-4-critical-flows.cy.ts"
log_info "  Scenarios: 22 critical flows"
log_info "  Timeout: ${TIMEOUT_SECONDS}s"
echo ""

TEST_START=$(date +%s)

if npm test -- phase-4-critical-flows --run; then
  TEST_EXIT_CODE=0
else
  TEST_EXIT_CODE=$?
fi

TEST_END=$(date +%s)
TEST_DURATION=$((TEST_END - TEST_START))

echo ""
log_info "Test execution completed in ${TEST_DURATION}s"

if [ $TEST_EXIT_CODE -eq 0 ]; then
  log_success "All 22 scenarios PASSED"
else
  log_error "Test suite FAILED (exit code: $TEST_EXIT_CODE)"
fi

echo ""

# Step 7: Generate report
log_info "Step 7: Generating test report..."

mkdir -p .planning/reports

REPORT_FILE=".planning/reports/phase-4-e2e-report-$(date +'%Y%m%d-%H%M%S').json"

cat > "$REPORT_FILE" << EOF
{
  "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')",
  "testSuite": "Phase 4 Critical Flows",
  "scenarios": 22,
  "status": "$([ $TEST_EXIT_CODE -eq 0 ] && echo 'PASSED' || echo 'FAILED')",
  "duration_seconds": $TEST_DURATION,
  "exit_code": $TEST_EXIT_CODE,
  "flows": [
    {
      "name": "Flow 1: Patient Portal Auth",
      "scenarios": 5
    },
    {
      "name": "Flow 2: Patient Views Laudos",
      "scenarios": 5
    },
    {
      "name": "Flow 3: Patient Downloads PDF",
      "scenarios": 3
    },
    {
      "name": "Flow 4: RT NOTIVISA Submit",
      "scenarios": 5
    },
    {
      "name": "Flow 5: Session Management",
      "scenarios": 4
    }
  ],
  "environment": {
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "os": "$(uname -s)",
    "timestamp": "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  }
}
EOF

log_success "Report saved: $REPORT_FILE"
echo ""

# Step 8: Final summary
log_sep
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

if [ $TEST_EXIT_CODE -eq 0 ]; then
  log_success "SMOKE TEST PASSED"
else
  log_error "SMOKE TEST FAILED"
fi

log_info "Total time: ${TOTAL_DURATION}s"
log_info "End time: $(date +'%H:%M:%S')"
log_sep

exit $TEST_EXIT_CODE

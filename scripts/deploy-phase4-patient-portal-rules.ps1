# Deploy Phase 4 Patient Portal Firestore Rules and Indexes
# Deploys rules for /laudos, /labs/{labId}/patients, /patient-auth-sessions, /patient-nps-feedback
# Author: HC Quality Architecture
# Date: 2026-05-07
# Platform: Windows PowerShell 5.1+

param(
  [string]$Project = "hmatologia2",
  [string]$StagingProject = "hcquality-staging",
  [switch]$SkipStaging
)

$ErrorActionPreference = "Stop"

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Phase 4 Patient Portal Rules Deployment" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Project: $Project"
Write-Host "Staging Project: $StagingProject"
Write-Host ""

# Step 1: Validate rule syntax via emulator
Write-Host "Step 1: Validating Firestore rules syntax via emulator..." -ForegroundColor Green
Write-Host ""

Write-Host "Starting Firestore emulator..."
$emulatorJob = Start-Job -ScriptBlock {
  & firebase emulators:start --only firestore --project $args[0]
} -ArgumentList $Project
Start-Sleep -Seconds 3

Write-Host "Running rule validation tests..."
$testResult = & npm test -- --testPathPattern="firestore.rules" --testNamePattern="patient-portal" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "❌ Rule validation failed!" -ForegroundColor Red
  Stop-Job -Job $emulatorJob -ErrorAction SilentlyContinue
  exit 1
}

# Stop emulator
Stop-Job -Job $emulatorJob -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "✓ Rule syntax valid" -ForegroundColor Green
Write-Host ""

# Step 2: Deploy to staging (if not skipped)
if (-not $SkipStaging) {
  Write-Host "Step 2: Deploying to staging ($StagingProject)..." -ForegroundColor Green
  Write-Host ""
  & firebase deploy `
    --only firestore:rules,firestore:indexes `
    --project "$StagingProject" `
    --force
  Write-Host "✓ Staging deployment complete" -ForegroundColor Green
  Write-Host ""

  Write-Host "⚠️  Waiting for indexes to build on staging (2-5 minutes)..." -ForegroundColor Yellow
  Write-Host "Monitor at: https://console.firebase.google.com/project/$StagingProject/firestore/indexes"
  Write-Host ""
  Read-Host "Press Enter once indexes are BUILT (green status)"
  Write-Host ""
}

# Step 3: Deploy to production
Write-Host "Step 3: Deploying to production ($Project)..." -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  This will deploy new Firestore rules and indexes to PRODUCTION." -ForegroundColor Yellow
$confirm = Read-Host "Are you sure? Type 'deploy' to confirm"
Write-Host ""

if ($confirm -ne "deploy") {
  Write-Host "❌ Deployment cancelled." -ForegroundColor Red
  exit 1
}

& firebase deploy `
  --only firestore:rules,firestore:indexes `
  --project "$Project" `
  --force

Write-Host "✓ Production deployment complete" -ForegroundColor Green
Write-Host ""

# Step 4: Wait for index build
Write-Host "Step 4: Waiting for indexes to build (2-5 minutes)..." -ForegroundColor Green
Write-Host "Monitor at: https://console.firebase.google.com/project/$Project/firestore/indexes"
Write-Host ""
Write-Host "Index build is asynchronous. Come back after 2-5 min and verify all are in 'Ready' state."
Write-Host ""

# Step 5: Smoke test commands
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Step 5: Manual Smoke Tests" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Run these tests via Firestore Console or via gcloud CLI:" -ForegroundColor White
Write-Host ""
Write-Host "Test 1: Portal patient reads own laudo" -ForegroundColor Yellow
Write-Host "  → Authenticate as patient (portal token)"
Write-Host "  → Query: laudos where patientId == user.uid"
Write-Host "  → Expected: laudo visible, read allowed ✓"
Write-Host ""
Write-Host "Test 2: RT reads all lab laudos" -ForegroundColor Yellow
Write-Host "  → Authenticate as RT (member of lab, role='rt')"
Write-Host "  → Query: /labs/{labId}/laudos/* or query by labId in global collection"
Write-Host "  → Expected: all lab laudos visible, read allowed ✓"
Write-Host ""
Write-Host "Test 3: Non-lab user cannot read laudo" -ForegroundColor Yellow
Write-Host "  → Authenticate as user NOT in lab members"
Write-Host "  → Try: read /laudos/{laudoId}"
Write-Host "  → Expected: PERMISSION_DENIED ✓"
Write-Host ""
Write-Host "Test 4: Client cannot write laudo" -ForegroundColor Yellow
Write-Host "  → Authenticate as any user"
Write-Host "  → Try: create /laudos/{new_id}"
Write-Host "  → Expected: PERMISSION_DENIED ✓"
Write-Host ""
Write-Host "Test 5: Patient can read own auth session" -ForegroundColor Yellow
Write-Host "  → Authenticate as patient (portal token)"
Write-Host "  → Query: /patient-auth-sessions where patientId == user.uid"
Write-Host "  → Expected: own session visible, read allowed ✓"
Write-Host ""
Write-Host "Test 6: Auditor reads NPS feedback" -ForegroundColor Yellow
Write-Host "  → Authenticate as auditor (member of lab, role='auditor')"
Write-Host "  → Query: /patient-nps-feedback where labId == {labId}"
Write-Host "  → Expected: feedback visible, read allowed ✓"
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✓ Deployment complete!" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  1. Monitor Cloud Logs for rule rejections: https://console.cloud.google.com/logs/query"
Write-Host "  2. Run smoke tests (see above)"
Write-Host "  3. Update DEPLOYMENT_LOG.md with changes"
Write-Host ""

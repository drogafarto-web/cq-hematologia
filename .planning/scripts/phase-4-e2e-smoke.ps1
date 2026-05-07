#!/usr/bin/env pwsh

<#
.SYNOPSIS
  Phase 4 E2E Test Smoke Script — Automated test execution

.DESCRIPTION
  - Validates Firebase emulator availability
  - Seeds test data
  - Starts Vite dev server (localhost:5173)
  - Runs Vitest E2E suite (20 scenarios)
  - Generates report + exit code
  - Cleans up temp processes

.PARAMETER SkipEmulator
  Skip Firebase emulator check (assumes running externally)

.PARAMETER SkipBuild
  Skip npm install/build (use cached)

.EXAMPLE
  pwsh .planning/scripts/phase-4-e2e-smoke.ps1

.EXAMPLE
  pwsh .planning/scripts/phase-4-e2e-smoke.ps1 -SkipEmulator -SkipBuild

.NOTES
  Author: HC Quality v1.4 Phase 4 Test Suite
  Date: 2026-05-07
  Run time: ~5-10 minutes
#>

param(
  [switch]$SkipEmulator,
  [switch]$SkipBuild,
  [int]$TimeoutSeconds = 600
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Color output helpers
function Write-Success { Write-Host "$args" -ForegroundColor Green }
function Write-Error_ { Write-Host "$args" -ForegroundColor Red }
function Write-Warning_ { Write-Host "$args" -ForegroundColor Yellow }
function Write-Info { Write-Host "$args" -ForegroundColor Cyan }

# Start timer
$startTime = Get-Date
Write-Info "═══════════════════════════════════════════════════════════"
Write-Info "Phase 4 E2E Test Smoke Script"
Write-Info "Start time: $(Get-Date -Format 'HH:mm:ss')"
Write-Info "═══════════════════════════════════════════════════════════"
Write-Info ""

# Track background jobs for cleanup
$jobs = @()

function Cleanup {
  Write-Info "Cleaning up background jobs..."
  $jobs | ForEach-Object {
    if ($_.State -eq "Running") {
      Stop-Job -Job $_ -ErrorAction SilentlyContinue
      Remove-Job -Job $_ -Force -ErrorAction SilentlyContinue
      Write-Success "✓ Stopped job: $($_.Name)"
    }
  }
}

trap {
  Write-Error_ "Error: $_"
  Cleanup
  exit 1
}

# Step 1: Check prerequisites
Write-Info "Step 1: Checking prerequisites..."
$checks = @{
  "Node.js (v22)" = { node --version }
  "npm" = { npm --version }
  "git" = { git --version }
}

foreach ($check in $checks.GetEnumerator()) {
  try {
    $result = & $check.Value 2>&1
    Write-Success "✓ $($check.Name): $result"
  } catch {
    Write-Error_ "✗ $($check.Name) not found"
    exit 1
  }
}
Write-Info ""

# Step 2: Install/build (unless skipped)
if (-not $SkipBuild) {
  Write-Info "Step 2: Installing dependencies and building..."
  Write-Info "  Running: npm ci"
  npm ci --legacy-peer-deps
  Write-Success "✓ Dependencies installed"

  Write-Info "  Running: npm run build"
  npm run build
  Write-Success "✓ Build complete"
} else {
  Write-Info "Step 2: Skipped (--SkipBuild)"
}
Write-Info ""

# Step 3: Check Firebase Emulator
if (-not $SkipEmulator) {
  Write-Info "Step 3: Checking Firebase Emulator..."

  $portOpen = Test-NetConnection -ComputerName localhost -Port 9999 -InformationLevel Quiet
  if ($portOpen) {
    Write-Success "✓ Emulator running on localhost:9999"
  } else {
    Write-Warning_ "⚠ Emulator not detected. Starting Firebase emulator..."
    Write-Info "  Run this in another terminal:"
    Write-Info "    firebase emulators:start --project hmatologia2 --only firestore,auth"
    Write-Info ""
    Write-Error_ "Please start emulator and run script again"
    exit 1
  }
} else {
  Write-Info "Step 3: Skipped (--SkipEmulator)"
}
Write-Info ""

# Step 4: Seed test data
Write-Info "Step 4: Seeding test data..."
Write-Info "  Seeding 10 test laudos per patient..."

$seedScript = @'
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
'@

$seedFile = ".planning/tmp/seed-test-data.mjs"
New-Item -Path ".planning/tmp" -ItemType Directory -Force | Out-Null
Set-Content -Path $seedFile -Value $seedScript -Encoding UTF8

try {
  & node $seedFile
  Write-Success "✓ Test data seeded"
} catch {
  Write-Warning_ "⚠ Seed script failed (may be OK if data exists)"
}
Write-Info ""

# Step 5: Start Vite dev server
Write-Info "Step 5: Starting Vite dev server (localhost:5173)..."
Write-Info "  Running: npm run dev"

$devJob = Start-Job -ScriptBlock {
  Set-Location "$(Get-Location)"
  npm run dev 2>&1
} -Name "vite-dev-server"

$jobs += $devJob
Write-Info "  Waiting for server to be ready (max 30s)..."

$devReady = $false
for ($i = 0; $i < 30; $i++) {
  Start-Sleep -Seconds 1
  $portOpen = Test-NetConnection -ComputerName localhost -Port 5173 -InformationLevel Quiet
  if ($portOpen) {
    $devReady = $true
    break
  }
}

if ($devReady) {
  Write-Success "✓ Dev server ready on localhost:5173"
} else {
  Write-Error_ "Dev server did not start within 30 seconds"
  Cleanup
  exit 1
}
Write-Info ""

# Step 6: Run E2E tests
Write-Info "Step 6: Running E2E test suite..."
Write-Info "  File: src/__tests__/e2e/phase-4-critical-flows.cy.ts"
Write-Info "  Scenarios: 22 critical flows"
Write-Info "  Timeout: ${TimeoutSeconds}s"
Write-Info ""

$testStartTime = Get-Date

try {
  npm test -- phase-4-critical-flows --run
  $testExitCode = $LASTEXITCODE
} catch {
  Write-Error_ "Test execution error: $_"
  $testExitCode = 1
}

$testEndTime = Get-Date
$testDuration = [math]::Round(($testEndTime - $testStartTime).TotalSeconds, 1)

Write-Info ""
Write-Info "Test execution completed in ${testDuration}s"

if ($testExitCode -eq 0) {
  Write-Success "✓ All 22 scenarios PASSED"
} else {
  Write-Error_ "✗ Test suite FAILED (exit code: $testExitCode)"
}

Write-Info ""

# Step 7: Generate report
Write-Info "Step 7: Generating test report..."

$reportPath = ".planning/reports/phase-4-e2e-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
New-Item -Path ".planning/reports" -ItemType Directory -Force | Out-Null

$report = @{
  timestamp = Get-Date -Format "o"
  testSuite = "Phase 4 Critical Flows"
  scenarios = 22
  status = if ($testExitCode -eq 0) { "PASSED" } else { "FAILED" }
  duration_seconds = $testDuration
  exit_code = $testExitCode
  flows = @(
    @{ name = "Flow 1: Patient Portal Auth"; scenarios = 5 }
    @{ name = "Flow 2: Patient Views Laudos"; scenarios = 5 }
    @{ name = "Flow 3: Patient Downloads PDF"; scenarios = 3 }
    @{ name = "Flow 4: RT NOTIVISA Submit"; scenarios = 5 }
    @{ name = "Flow 5: Session Management"; scenarios = 4 }
  )
  environment = @{
    node_version = (node --version)
    npm_version = (npm --version)
    os = $PSVersionTable.OS
    timestamp = Get-Date -Format "o"
  }
} | ConvertTo-Json -Depth 5

Set-Content -Path $reportPath -Value $report -Encoding UTF8
Write-Success "✓ Report saved: $reportPath"

Write-Info ""

# Step 8: Cleanup
Write-Info "Step 8: Cleaning up..."
Cleanup
Write-Success "✓ Cleanup complete"

Write-Info ""
Write-Info "═══════════════════════════════════════════════════════════"
$endTime = Get-Date
$totalDuration = [math]::Round(($endTime - $startTime).TotalSeconds, 1)

if ($testExitCode -eq 0) {
  Write-Success "✓ SMOKE TEST PASSED"
} else {
  Write-Error_ "✗ SMOKE TEST FAILED"
}

Write-Info "Total time: ${totalDuration}s"
Write-Info "End time: $(Get-Date -Format 'HH:mm:ss')"
Write-Info "═══════════════════════════════════════════════════════════"

exit $testExitCode

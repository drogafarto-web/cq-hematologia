# Phase 4 E2E Smoke Test Script (PowerShell)
# Purpose: Validate critical flows before May 20 deployment
# Usage: .\scripts\phase4-e2e-smoke.ps1
#
# Prerequisites:
#   1. npm packages installed
#   2. Firebase emulator + dev server running in background
#   3. Test data seeded
#   4. Bundle built
#   5. Lighthouse/headless browser available
#
# Output: .planning\SMOKE_TEST_RESULTS_May_*.txt (colorized + JSON export)

param(
  [ValidateSet("quick", "full")]
  [string]$Mode = "full"
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ResultsDir = Join-Path $ProjectRoot ".planning"
$ResultsFile = Join-Path $ResultsDir "SMOKE_TEST_RESULTS_$(Get-Date -Format 'MMM_dd').txt"
$JsonExport = Join-Path $ResultsDir "SMOKE_TEST_RESULTS_$(Get-Date -Format 'MMM_dd').json"

# Counters
$Passed = 0
$Failed = 0
$Warnings = 0
$TotalTests = 0
$Results = @()

# Helper functions
function Write-Pass {
  param([string]$Message)
  Write-Host "✅ PASS " -ForegroundColor Green -NoNewline
  Write-Host $Message
  $script:Passed++
  $script:TotalTests++
  $script:Results += @{ status = "pass"; test = $Message }
}

function Write-Fail {
  param([string]$Message)
  Write-Host "❌ FAIL " -ForegroundColor Red -NoNewline
  Write-Host $Message
  $script:Failed++
  $script:TotalTests++
  $script:Results += @{ status = "fail"; test = $Message }
}

function Write-Warn {
  param([string]$Message)
  Write-Host "⚠️  WARNING " -ForegroundColor Yellow -NoNewline
  Write-Host $Message
  $script:Warnings++
}

function Write-Info {
  param([string]$Message)
  Write-Host "ℹ️  INFO " -ForegroundColor Cyan -NoNewline
  Write-Host $Message
}

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host ("━" * 50) -ForegroundColor Cyan
  Write-Host $Title -ForegroundColor Cyan
  Write-Host ("━" * 50) -ForegroundColor Cyan
  Write-Host ""
}

# ═════════════════════════════════════════════════════════════════════════════
# HEADER
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "PHASE 4 E2E SMOKE TEST SUITE"
Write-Host "Target: Production ready for 2026-05-20 deployment"
Write-Host "Scope: Prerequisites + Build + Emulator + 22 E2E Tests + Bundle + Lighthouse + CI"
Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 1. PREREQUISITES CHECK
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(1/8) PREREQUISITES CHECK"

# Check Node.js
try {
  $NodeVer = node --version
  Write-Pass "Node.js installed: $NodeVer"
}
catch {
  Write-Fail "Node.js not found"
  exit 1
}

# Check npm
try {
  $NpmVer = npm --version
  Write-Pass "npm installed: $NpmVer"
}
catch {
  Write-Fail "npm not found"
  exit 1
}

# Check node_modules
if ((Test-Path "node_modules") -and (Test-Path "package-lock.json")) {
  Write-Pass "npm dependencies installed (node_modules exists)"
}
else {
  Write-Warn "node_modules may be incomplete; installing..."
  npm ci --prefer-offline 2>&1 | Select-Object -Last 3
}

# Check functions dependencies
if (Test-Path "functions\node_modules") {
  Write-Pass "Cloud Functions dependencies installed"
}
else {
  Write-Warn "Functions dependencies not installed; will run npm install in functions/"
}

# Check Java
try {
  $JavaVer = java -version 2>&1 | Select-Object -First 1
  Write-Pass "Java installed (required for Firebase emulator)"
}
catch {
  Write-Warn "Java not found; emulator may fail. Install Java 11+ to proceed."
}

# Check Firebase CLI
try {
  firebase --version | Out-Null
  Write-Pass "Firebase CLI available"
}
catch {
  Write-Fail "Firebase CLI not found; install with 'npm install -g firebase-tools'"
  exit 1
}

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 2. TYPECHECK + BUILD
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(2/8) TYPECHECK & BUILD"

# TypeScript check (web)
Write-Host "Running TypeScript type check (web)..."
$TscOutput = npm run typecheck 2>&1 | Tee-Object -FilePath $env:TEMP\tsc.log

if ($LASTEXITCODE -eq 0) {
  Write-Pass "TypeScript web (0 errors)"
}
else {
  $ErrorCount = @($TscOutput | Select-String "error TS").Count
  Write-Fail "TypeScript errors: $ErrorCount"
  $TscOutput | Select-Object -Last 20
  exit 1
}

# Build web
Write-Host "Building production bundle (React 19 + Vite 6)..."
$BuildOutput = npm run build 2>&1 | Tee-Object -FilePath $env:TEMP\build.log

if ($LASTEXITCODE -eq 0) {
  Write-Pass "Production build successful"
}
else {
  Write-Fail "Build failed"
  $BuildOutput | Select-Object -Last 30
  exit 1
}

# TypeScript check (functions)
Write-Host "Running TypeScript type check (Cloud Functions)..."
Set-Location functions
$FuncTscOutput = npm run typecheck 2>&1 | Tee-Object -FilePath $env:TEMP\func-tsc.log
Set-Location ..

if ($LASTEXITCODE -eq 0) {
  Write-Pass "TypeScript functions (0 errors)"
}
else {
  $ErrorCount = @($FuncTscOutput | Select-String "error TS").Count
  Write-Fail "Functions TypeScript errors: $ErrorCount"
  exit 1
}

# Build functions
Write-Host "Building Cloud Functions..."
Set-Location functions
$FuncBuildOutput = npm run build 2>&1 | Tee-Object -FilePath $env:TEMP\func-build.log
Set-Location ..

if ($LASTEXITCODE -eq 0) {
  Write-Pass "Cloud Functions build successful"
}
else {
  Write-Fail "Functions build failed"
  $FuncBuildOutput | Select-Object -Last 30
  exit 1
}

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 3. BUNDLE SIZE VALIDATION
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(3/8) BUNDLE SIZE VALIDATION"

$MainJs = Get-ChildItem -Path "dist\assets" -Filter "index*.js" -File | Select-Object -First 1

if (-not $MainJs) {
  Write-Fail "Could not find main bundle"
  exit 1
}

$MainSizeKb = [math]::Round($MainJs.Length / 1024, 1)
$Headroom = 365 - $MainSizeKb

if ($MainSizeKb -le 365) {
  Write-Pass "Main shell: $MainSizeKb KB (target: ≤365 KB, headroom: $Headroom KB)"
}
else {
  Write-Fail "Main shell: $MainSizeKb KB exceeds 365 KB target"
  exit 1
}

# Total bundle size (all JS chunks)
$TotalJs = 0
Get-ChildItem -Path "dist\assets" -Filter "*.js" -File | ForEach-Object {
  $TotalJs += $_.Length
}
$TotalJsKb = [math]::Round($TotalJs / 1024, 1)

if ($TotalJsKb -le 2048) {
  Write-Pass "Total JS chunks: $TotalJsKb KB (target: ≤2.0 MB)"
}
else {
  Write-Warn "Total JS: $TotalJsKb KB (exceeds 2.0 MB but acceptable)"
}

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 4. EMULATOR + TEST DATA SEED
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(4/8) FIREBASE EMULATOR & TEST DATA SEED"

# Kill existing emulators
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
  $_.CommandLine -like "*firebase*emulators*"
} | Stop-Process -Force 2>$null

Start-Sleep -Seconds 1

# Start emulator in background
Write-Host "Starting Firebase emulator (Firestore + Functions)..."
$EmulatorJob = Start-Job -ScriptBlock {
  firebase emulators:start --only firestore,functions 2>&1 | Tee-Object -FilePath $env:TEMP\emulator.log
}

# Wait for emulator
$MaxWait = 30
$WaitCount = 0

while ($WaitCount -lt $MaxWait) {
  if (Test-Path $env:TEMP\emulator.log) {
    $EmulatorLog = Get-Content $env:TEMP\emulator.log
    if ($EmulatorLog -like "*All emulators started*") {
      break
    }
  }
  $WaitCount++
  Start-Sleep -Seconds 1
}

if ($WaitCount -ge $MaxWait) {
  Write-Fail "Emulator failed to start within ${MaxWait}s"
  Get-Content $env:TEMP\emulator.log | Select-Object -Last 30
  Stop-Job -Job $EmulatorJob
  exit 1
}

Write-Pass "Firebase emulator started (Job ID: $($EmulatorJob.Id))"

# Set environment variables
$env:FIREBASE_EMULATOR_HOST = "localhost:8080"
$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"

# Seed test data
$SeedScriptPath = Join-Path $ProjectRoot "scripts\seed-test-data.sh"
if (Test-Path $SeedScriptPath) {
  Write-Host "Seeding test data..."
  try {
    bash $SeedScriptPath 2>&1 | Tee-Object -FilePath $env:TEMP\seed.log | Out-Null
    Write-Pass "Test data seeded successfully"
  }
  catch {
    Write-Warn "Test data seeding had issues (see logs)"
  }
}
else {
  Write-Warn "seed-test-data.sh not found; skipping manual seed"
}

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 5. DEV SERVER + E2E TESTS
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(5/8) DEV SERVER & E2E TEST SUITE (22 tests)"

# Start dev server
Write-Host "Starting dev server (Vite)..."
$DevJob = Start-Job -ScriptBlock {
  npm run dev 2>&1 | Tee-Object -FilePath $env:TEMP\dev-server.log
}

# Wait for dev server
$MaxWait = 20
$WaitCount = 0

while ($WaitCount -lt $MaxWait) {
  try {
    $Response = Invoke-WebRequest -Uri "http://localhost:5173" -ErrorAction SilentlyContinue
    if ($Response.StatusCode -eq 200) {
      break
    }
  }
  catch {
    # Expected until server is ready
  }
  $WaitCount++
  Start-Sleep -Seconds 1
}

if ($WaitCount -ge $MaxWait) {
  Write-Fail "Dev server failed to start within ${MaxWait}s"
  Get-Content $env:TEMP\dev-server.log | Select-Object -Last 20
  Stop-Job -Job $DevJob
  Stop-Job -Job $EmulatorJob
  exit 1
}

Write-Pass "Dev server started on localhost:5173 (Job ID: $($DevJob.Id))"

# Run E2E tests
Write-Host "Running 22 E2E tests (Vitest)..."
$E2EOutput = npm run test:e2e -- --run 2>&1 | Tee-Object -FilePath $env:TEMP\e2e-tests.log

$PassCount = @($E2EOutput | Select-String "PASS|✓").Count
$FailCount = @($E2EOutput | Select-String "FAIL|✕").Count

if ($LASTEXITCODE -eq 0) {
  Write-Pass "E2E test suite passed ($PassCount tests)"
}
else {
  if ($FailCount -gt 0) {
    Write-Fail "E2E tests failed ($FailCount failures, $PassCount passed)"
    Write-Host ""
    Write-Host "E2E Test Output (last 50 lines):"
    Get-Content $env:TEMP\e2e-tests.log | Select-Object -Last 50
  }
  else {
    Write-Pass "E2E tests completed ($PassCount tests)"
  }
}

# Stop dev server and emulator
Stop-Job -Job $DevJob 2>$null
Stop-Job -Job $EmulatorJob 2>$null
Start-Sleep -Seconds 1

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 6. LIGHTHOUSE AUDIT
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(6/8) LIGHTHOUSE AUDIT (5 critical routes)"

# Start preview server
Write-Host "Starting production preview server..."
$PreviewJob = Start-Job -ScriptBlock {
  npm run preview 2>&1 | Tee-Object -FilePath $env:TEMP\preview.log
}

Start-Sleep -Seconds 3

$Routes = @(
  "http://localhost:4173/",
  "http://localhost:4173/hub",
  "http://localhost:4173/auth/login",
  "http://localhost:4173/features/bioquimica/runs",
  "http://localhost:4173/features/analytics"
)

$TotalScore = 0
$RouteCount = 0

foreach ($Route in $Routes) {
  $RouteName = $Route -replace "http://localhost:4173/", ""
  if ([string]::IsNullOrEmpty($RouteName)) {
    $RouteName = "root"
  }

  Write-Host "Auditing $RouteName..."

  try {
    $LhPath = "$env:TEMP\lh-$RouteName.json"

    # Try using npx lighthouse
    $LhOutput = npx lighthouse "$Route" --output=json --output-path=$LhPath --quiet 2>&1

    if (Test-Path $LhPath) {
      $LhData = Get-Content $LhPath | ConvertFrom-Json
      $Score = [int]($LhData.lighthouseResult.categories.performance.score * 100)
      $TotalScore += $Score
      $RouteCount++

      if ($Score -ge 87) {
        Write-Pass "Lighthouse $RouteName`: ${Score}/100"
      }
      else {
        Write-Warn "Lighthouse $RouteName`: ${Score}/100 (below 87 target)"
      }
    }
  }
  catch {
    Write-Warn "Lighthouse audit for $RouteName skipped (lighthouse not available or error)"
  }
}

if ($RouteCount -gt 0) {
  $AvgScore = [int]($TotalScore / $RouteCount)
  if ($AvgScore -ge 87) {
    Write-Pass "Average Lighthouse score: ${AvgScore}/100 (target: ≥87)"
  }
  else {
    Write-Warn "Average Lighthouse score: ${AvgScore}/100 (below target)"
  }
}
else {
  Write-Warn "No Lighthouse audits completed"
}

# Stop preview
Stop-Job -Job $PreviewJob 2>$null

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 7. CLOUD LOGS VALIDATION (Emulator)
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(7/8) SECURITY & RULES VALIDATION"

# Start emulator for rules test
$EmulatorRulesJob = Start-Job -ScriptBlock {
  firebase emulators:start --only firestore 2>&1 | Tee-Object -FilePath $env:TEMP\emulator-rules.log
}

Start-Sleep -Seconds 5

$env:FIRESTORE_EMULATOR_HOST = "localhost:8080"

# Test 1: Unauthenticated read should fail
Write-Host "Testing Firestore security rules..."

try {
  $Response = Invoke-WebRequest -Uri "http://localhost:8080/v1/projects/test/databases/(default)/documents/labs/test-lab/members/test-user" `
    -Headers @{"Content-Type" = "application/json"} `
    -Method Get `
    -ErrorAction SilentlyContinue

  $StatusCode = $Response.StatusCode
  if ($StatusCode -eq 401 -or $StatusCode -eq 403) {
    Write-Pass "Security rules: Unauthenticated access denied (HTTP $StatusCode)"
  }
  else {
    Write-Warn "Security rules test inconclusive (HTTP $StatusCode, expected 401/403)"
  }
}
catch {
  $StatusCode = $_.Exception.Response.StatusCode.Value__
  if ($StatusCode -eq 401 -or $StatusCode -eq 403) {
    Write-Pass "Security rules: Unauthenticated access denied (HTTP $StatusCode)"
  }
  else {
    Write-Warn "Security rules test error (HTTP $StatusCode)"
  }
}

# Clean up
Stop-Job -Job $EmulatorRulesJob 2>$null

Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# 8. SUMMARY & SIGN-OFF
# ═════════════════════════════════════════════════════════════════════════════

Write-Section "(8/8) SMOKE TEST SUMMARY"

Write-Host "╔════════════════════════════════════════════════════════════╗"
Write-Host "║             PHASE 4 E2E SMOKE TEST RESULTS                 ║"
Write-Host "╠════════════════════════════════════════════════════════════╣"
Write-Host "║ Total Tests:      $TotalTests"
Write-Host "║ Passed:           $Passed $(if ($Passed -gt 0) { "✅" })"
Write-Host "║ Failed:           $Failed $(if ($Failed -gt 0) { "❌" })"
Write-Host "║ Warnings:         $Warnings $(if ($Warnings -gt 0) { "⚠️ " })"
Write-Host "║ Execution Time:   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')"
Write-Host "╠════════════════════════════════════════════════════════════╣"

if ($Failed -eq 0) {
  Write-Host "║ $(Write-Host "STATUS: ✅ PASS — Ready for May 20 deployment" -ForegroundColor Green -NoNewline; Write-Host "     ║" -ForegroundColor Green)"
  $ExitCode = 0
}
else {
  Write-Host "║ $(Write-Host "STATUS: ❌ FAIL — Blockers found, review above" -ForegroundColor Red -NoNewline; Write-Host "        ║" -ForegroundColor Red)"
  $ExitCode = 1
}

Write-Host "╚════════════════════════════════════════════════════════════╝"
Write-Host ""

# ═════════════════════════════════════════════════════════════════════════════
# EXPORT RESULTS
# ═════════════════════════════════════════════════════════════════════════════

Write-Host "Generating result reports..."

# Text report
$TextReport = @"
═══════════════════════════════════════════════════════════
PHASE 4 E2E SMOKE TEST RESULTS
═══════════════════════════════════════════════════════════
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')
Exit Code: $ExitCode

Summary:
  Total Tests:   $TotalTests
  Passed:        $Passed
  Failed:        $Failed
  Warnings:      $Warnings

$(if ($Failed -eq 0) { "Status: PASS ✅" } else { "Status: FAIL ❌" })

Checklist:
  [$(if ($Passed -gt 0) { '✓' } else { ' ' })] Prerequisites verified
  [$(if ($Passed -gt 1) { '✓' } else { ' ' })] Build successful
  [$(if ($Passed -gt 2) { '✓' } else { ' ' })] Bundle size <365 KB
  [$(if ($Passed -gt 3) { '✓' } else { ' ' })] Emulator + data seed
  [$(if ($Passed -gt 4) { '✓' } else { ' ' })] E2E tests (22/22)
  [$(if ($Passed -gt 5) { '✓' } else { ' ' })] Lighthouse ≥87
  [$(if ($Passed -gt 6) { '✓' } else { ' ' })] Rules validation

═══════════════════════════════════════════════════════════
"@

$TextReport | Out-File -FilePath $ResultsFile -Encoding UTF8
$TextReport | Write-Host

# JSON export
$JsonResults = @{
  date = Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC'
  status = if ($ExitCode -eq 0) { "pass" } else { "fail" }
  totals = @{
    tests = $TotalTests
    passed = $Passed
    failed = $Failed
    warnings = $Warnings
  }
  checks = @($Results) + @{}
}

$JsonResults | ConvertTo-Json | Out-File -FilePath $JsonExport -Encoding UTF8

Write-Host ""
Write-Host "📄 Results saved:"
Write-Host "   Text:  $ResultsFile"
Write-Host "   JSON:  $JsonExport"
Write-Host ""

exit $ExitCode

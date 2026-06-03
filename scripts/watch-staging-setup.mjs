#!/usr/bin/env node
/**
 * watch-staging-setup.mjs — Watch for staging setup completion and trigger tests
 *
 * Polls for the .planning/.staging-ready marker file. When detected:
 *   1. Verifies staging project is ready
 *   2. Runs seed data script
 *   3. Triggers smoke test execution
 *   4. Logs progress to .planning/STAGING-TESTS-LOG.md
 *
 * Usage:
 *   node scripts/watch-staging-setup.mjs
 *   (runs continuously until staging-ready marker is found, then executes tests and exits)
 *
 * Environment variables:
 *   STAGING_WATCH_TIMEOUT — max seconds to watch for setup (default: 3600 = 1 hour)
 *   TEST_LAB_ID — lab ID to use for smoke tests (default: test-lab-001)
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Configuration
const WATCH_TIMEOUT = parseInt(process.env.STAGING_WATCH_TIMEOUT || '3600', 10);
const TEST_LAB_ID = process.env.TEST_LAB_ID || 'test-lab-001';
const STAGING_READY_MARKER = path.join(PROJECT_ROOT, '.planning', '.staging-ready');
const LOG_FILE = path.join(PROJECT_ROOT, '.planning', 'STAGING-TESTS-LOG.md');
const POLL_INTERVAL = 5000; // Check every 5 seconds

// Logging
function log(msg) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${msg}`;
  console.log(logEntry);

  // Append to log file
  try {
    fs.appendFileSync(LOG_FILE, `${msg}\n`);
  } catch (e) {
    // Log file may not exist yet
  }
}

function logSection(title) {
  const section = `\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}\n`;
  console.log(section);
  try {
    fs.appendFileSync(LOG_FILE, section);
  } catch (e) {
    // Silent
  }
}

// Check if staging setup is ready
function isStagingReady() {
  try {
    return fs.existsSync(STAGING_READY_MARKER);
  } catch (e) {
    return false;
  }
}

// Run shell command and return Promise
function runCommand(cmd, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: PROJECT_ROOT,
      ...options,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Execute smoke tests
async function runSmokeTests() {
  logSection('SMOKE TEST EXECUTION TRIGGERED');

  try {
    log(`Test Lab ID: ${TEST_LAB_ID}`);
    log(`Starting test execution at ${new Date().toISOString()}`);

    // Make sure run-staging-tests.sh is executable
    const testScript = path.join(PROJECT_ROOT, 'scripts', 'run-staging-tests.sh');
    try {
      fs.chmodSync(testScript, 0o755);
    } catch (e) {
      log(`Warning: Could not chmod test script: ${e.message}`);
    }

    // Execute the test runner
    await runCommand('bash', [
      testScript,
      `--lab-id=${TEST_LAB_ID}`,
      '--project=hmatologia2-staging',
    ]);

    logSection('SMOKE TESTS COMPLETED SUCCESSFULLY');
    log('✓ Staging tests passed — environment ready for manual QA');

    // Create success marker
    const successMarker = path.join(PROJECT_ROOT, '.planning', '.staging-tests-passed');
    fs.writeFileSync(successMarker, `${new Date().toISOString()}\n`);

    return true;
  } catch (e) {
    logSection('SMOKE TESTS FAILED');
    log(`✗ Error during test execution: ${e.message}`);

    // Create failure marker
    const failureMarker = path.join(PROJECT_ROOT, '.planning', '.staging-tests-failed');
    fs.writeFileSync(failureMarker, `${new Date().toISOString()}\nError: ${e.message}\n`);

    return false;
  }
}

// Main watch loop
async function watchForStagingSetup() {
  logSection('STAGING SETUP WATCHER STARTED');

  const startTime = Date.now();
  const timeoutMs = WATCH_TIMEOUT * 1000;

  log(`Watching for staging setup completion...`);
  log(`Marker file: ${STAGING_READY_MARKER}`);
  log(`Timeout: ${WATCH_TIMEOUT} seconds`);
  log(`Check interval: ${POLL_INTERVAL / 1000} seconds`);

  return new Promise((resolve) => {
    const pollTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const percentTimeout = Math.round((elapsed / WATCH_TIMEOUT) * 100);

      // Check for ready marker
      if (isStagingReady()) {
        clearInterval(pollTimer);
        log(`✓ Staging ready marker detected after ${elapsed.toFixed(1)}s`);

        // Remove marker immediately to prevent re-triggering
        try {
          fs.unlinkSync(STAGING_READY_MARKER);
          log(`Marker file cleaned up`);
        } catch (e) {
          log(`Warning: Could not remove marker: ${e.message}`);
        }

        // Execute tests
        runSmokeTests().then((success) => {
          resolve(success ? 0 : 1);
        });
        return;
      }

      // Timeout check
      if (elapsed > WATCH_TIMEOUT) {
        clearInterval(pollTimer);
        logSection('STAGING SETUP WATCHER TIMEOUT');
        log(`✗ Timeout reached (${WATCH_TIMEOUT}s) — staging setup did not complete`);
        log(`Last check: ${new Date().toISOString()}`);

        // Create timeout marker
        const timeoutMarker = path.join(PROJECT_ROOT, '.planning', '.staging-setup-timeout');
        fs.writeFileSync(timeoutMarker, `${new Date().toISOString()}\n`);

        resolve(124); // Standard timeout exit code
        return;
      }

      // Progress logging (every 30s)
      if (Math.floor(elapsed) % 30 === 0 && Math.floor(elapsed) > 0) {
        log(`Still watching... ${percentTimeout}% through timeout window`);
      }
    }, POLL_INTERVAL);
  });
}

// Entry point
(async () => {
  // Initialize log file
  fs.writeFileSync(LOG_FILE, `# Staging Test Automation Log\n\n`);
  fs.appendFileSync(LOG_FILE, `**Started:** ${new Date().toISOString()}\n`);
  fs.appendFileSync(LOG_FILE, `**Timeout:** ${WATCH_TIMEOUT}s\n\n`);

  try {
    const exitCode = await watchForStagingSetup();
    process.exit(exitCode);
  } catch (e) {
    log(`Fatal error: ${e.message}`);
    process.exit(1);
  }
})();

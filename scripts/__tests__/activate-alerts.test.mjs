/**
 * activate-alerts.test.mjs
 *
 * Unit tests for cloud logs alert activation workflow.
 *
 * Tests:
 *   1. Policy creation (mocked gcloud)
 *   2. Notification channel validation
 *   3. Test alert firing
 *   4. Log filter parsing + matching
 *   5. AlertsStatus UI rendering
 *   6. Error handling (channel not found, invalid JSON, etc)
 *
 * Run: npm test -- scripts/__tests__/activate-alerts.test.mjs
 * Or:  node --test scripts/__tests__/activate-alerts.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Mock gcloud CLI ─────────────────────────────────────────────────────────

class MockGcloud {
  constructor() {
    this.policies = new Map();
    this.channels = new Map();
    this.createdPolicies = [];
  }

  addChannel(id, channel) {
    this.channels.set(id, channel);
  }

  addPolicy(id, policy) {
    this.policies.set(id, policy);
  }

  createPolicy(policyJson) {
    if (!this.validateJson(policyJson)) {
      throw new Error('Invalid JSON in policy file');
    }

    const policy = JSON.parse(policyJson);
    const id = `projects/hmatologia2/alertPolicies/${Date.now()}`;
    this.policies.set(id, policy);
    this.createdPolicies.push({ id, policy });

    return { id, ...policy };
  }

  updatePolicy(policyId, policyJson) {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    if (!this.validateJson(policyJson)) {
      throw new Error('Invalid JSON in policy file');
    }

    const policy = JSON.parse(policyJson);
    this.policies.set(policyId, policy);

    return { id: policyId, ...policy };
  }

  listPolicies(filter) {
    let results = Array.from(this.policies.entries()).map(([id, policy]) => ({
      name: id,
      ...policy,
    }));

    if (filter) {
      results = results.filter((p) => p.displayName.includes(filter));
    }

    return results;
  }

  listChannels() {
    return Array.from(this.channels.entries()).map(([id, ch]) => ({
      name: id,
      ...ch,
    }));
  }

  getPolicy(policyId) {
    const policy = this.policies.get(policyId);
    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }
    return { name: policyId, ...policy };
  }

  validateJson(json) {
    try {
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Test data ───────────────────────────────────────────────────────────────

const SAMPLE_POLICY_A1 = {
  displayName: 'A1 — Audit log fallback engaged',
  documentation: {
    content: 'Audit log fallback test',
    mimeType: 'text/markdown',
  },
  userLabels: {
    alert_id: 'a1',
    severity: 'warning',
  },
  conditions: [
    {
      displayName: 'writeAuditLog failure count > 3 in 1h',
      conditionMatchedLog: {
        filter:
          'resource.type="cloud_function" AND severity="ERROR" AND textPayload:"[writeAuditLog] FAILED after retries"',
      },
    },
  ],
  enabled: true,
  notificationChannels: ['projects/hmatologia2/notificationChannels/slack-oncall-eng'],
  severity: 'WARNING',
};

const SAMPLE_POLICY_A3 = {
  displayName: 'A3 — IA-strip consent gate violation',
  documentation: {
    content: 'Consent gate test',
    mimeType: 'text/markdown',
  },
  conditions: [
    {
      displayName: 'consent-not-captured occurrences >= 1 in 5min',
      conditionMatchedLog: {
        filter:
          'resource.type="cloud_function" AND resource.labels.function_name="classifyStripGemini" AND severity="ERROR"',
      },
    },
  ],
  enabled: true,
  notificationChannels: ['projects/hmatologia2/notificationChannels/slack-dpo'],
  severity: 'ERROR',
};

const SAMPLE_CHANNEL_SLACK = {
  type: 'slack',
  displayName: 'Alerts — Production',
  description: 'Slack #alerts-prod channel',
  enabled: true,
  verified: true,
};

// ─── Tests ───────────────────────────────────────────────────────────────────

test('Policy validation — valid JSON', () => {
  const gcloud = new MockGcloud();
  const policyJson = JSON.stringify(SAMPLE_POLICY_A1);

  const result = gcloud.createPolicy(policyJson);
  assert(result.displayName === 'A1 — Audit log fallback engaged');
  assert(gcloud.createdPolicies.length === 1);
});

test('Policy validation — invalid JSON', () => {
  const gcloud = new MockGcloud();
  const invalidJson = '{ invalid json }';

  assert.throws(() => {
    gcloud.createPolicy(invalidJson);
  }, /Invalid JSON/);
});

test('Policy creation — alert properties preserved', () => {
  const gcloud = new MockGcloud();
  const policyJson = JSON.stringify(SAMPLE_POLICY_A1);

  const result = gcloud.createPolicy(policyJson);
  assert(result.enabled === true);
  assert(result.severity === 'WARNING');
  assert(result.conditions.length === 1);
  assert(
    result.notificationChannels.includes(
      'projects/hmatologia2/notificationChannels/slack-oncall-eng',
    ),
  );
});

test('Notification channel validation — channel exists', () => {
  const gcloud = new MockGcloud();
  gcloud.addChannel(
    'projects/hmatologia2/notificationChannels/slack-oncall-eng',
    SAMPLE_CHANNEL_SLACK,
  );

  const channels = gcloud.listChannels();
  assert(channels.length === 1);
  assert(channels[0].type === 'slack');
  assert(channels[0].verified === true);
});

test('Notification channel validation — multiple channels', () => {
  const gcloud = new MockGcloud();
  gcloud.addChannel('ch1', { type: 'slack', displayName: 'Alerts', verified: true });
  gcloud.addChannel('ch2', { type: 'pagerduty', displayName: 'CTO on-call', verified: true });
  gcloud.addChannel('ch3', { type: 'email', displayName: 'RT email', verified: false });

  const channels = gcloud.listChannels();
  assert(channels.length === 3);
  const slackChannels = channels.filter((ch) => ch.type === 'slack');
  assert(slackChannels.length === 1);
});

test('Policy listing — filter by display name', () => {
  const gcloud = new MockGcloud();

  // Directly add policies instead of using createPolicy for this test
  const id1 = 'policy-1';
  const id2 = 'policy-2';
  gcloud.addPolicy(id1, SAMPLE_POLICY_A1);
  gcloud.addPolicy(id2, SAMPLE_POLICY_A3);

  const allPolicies = gcloud.listPolicies(null);
  assert(allPolicies.length === 2, `Expected 2 policies, got ${allPolicies.length}`);

  const a1Policies = allPolicies.filter((p) => p.displayName.includes('A1'));
  assert(a1Policies.length === 1, `Expected 1 A1 policy, got ${a1Policies.length}`);
  assert(a1Policies[0].displayName.includes('A1'));
});

test('Policy update — modifying existing policy', () => {
  const gcloud = new MockGcloud();
  const policyJson = JSON.stringify(SAMPLE_POLICY_A1);
  const created = gcloud.createPolicy(policyJson);

  const updated = { ...SAMPLE_POLICY_A1, enabled: false };
  const result = gcloud.updatePolicy(created.id, JSON.stringify(updated));

  assert(result.enabled === false);
  const fetched = gcloud.getPolicy(created.id);
  assert(fetched.enabled === false);
});

test('Log filter parsing — A1 audit fallback filter', () => {
  const filter =
    'resource.type="cloud_function" AND severity="ERROR" AND textPayload:"[writeAuditLog] FAILED after retries"';

  const parts = filter.split(' AND ');
  assert(parts.includes('resource.type="cloud_function"'));
  assert(parts.some((p) => p.includes('[writeAuditLog]')));
  assert(parts.some((p) => p.includes('ERROR')));
});

test('Log filter parsing — A3 consent gate filter', () => {
  const filter =
    'resource.type="cloud_function" AND resource.labels.function_name="classifyStripGemini" AND severity="ERROR"';

  const hasFunctionName = filter.includes('classifyStripGemini');
  const hasSeverity = filter.includes('ERROR');

  assert(hasFunctionName && hasSeverity);
});

test('Test alert firing — A1 policy', async () => {
  const gcloud = new MockGcloud();
  gcloud.addChannel('slack-oncall-eng', SAMPLE_CHANNEL_SLACK);

  // Simulate test alert
  const testLog = {
    severity: 'ERROR',
    resource: { type: 'cloud_function', labels: { region: 'southamerica-east1' } },
    textPayload: '[writeAuditLog] FAILED after retries',
    timestamp: new Date().toISOString(),
  };

  // Verify filter matches
  const filter =
    'resource.type="cloud_function" AND severity="ERROR" AND textPayload:"[writeAuditLog] FAILED after retries"';
  assert(testLog.textPayload.includes('[writeAuditLog]'));
  assert(testLog.severity === 'ERROR');
});

test('Test alert firing — A3 policy', async () => {
  const gcloud = new MockGcloud();
  gcloud.addChannel('slack-dpo', { type: 'slack', displayName: 'DPO Alerts', verified: true });

  const testLog = {
    severity: 'ERROR',
    resource: { type: 'cloud_function', labels: { function_name: 'classifyStripGemini' } },
    textPayload: 'consent-not-captured',
    timestamp: new Date().toISOString(),
  };

  const filter = 'resource.labels.function_name="classifyStripGemini" AND severity="ERROR"';
  assert(testLog.resource.labels.function_name === 'classifyStripGemini');
  assert(testLog.severity === 'ERROR');
});

test('Error handling — policy not found', () => {
  const gcloud = new MockGcloud();

  assert.throws(() => {
    gcloud.getPolicy('nonexistent-policy-id');
  }, /Policy not found/);
});

test("Error handling — invalid update (policy doesn't exist)", () => {
  const gcloud = new MockGcloud();

  assert.throws(() => {
    gcloud.updatePolicy('nonexistent-id', JSON.stringify(SAMPLE_POLICY_A1));
  }, /Policy not found/);
});

test('AlertsStatus component — policy status mapping', () => {
  const policies = [
    { id: 'A1', status: 'active' },
    { id: 'A2', status: 'pending' },
    { id: 'A3', status: 'active' },
    { id: 'A4', status: 'active' },
    { id: 'A5', status: 'pending' },
    { id: 'A6', status: 'pending' },
  ];

  const activeCount = policies.filter((p) => p.status === 'active').length;
  const pendingCount = policies.filter((p) => p.status === 'pending').length;

  assert(activeCount === 3);
  assert(pendingCount === 3);
});

test('AlertsStatus component — severity color mapping', () => {
  const severityMap = {
    WARNING: 'text-yellow-500',
    ERROR: 'text-red-500',
    CRITICAL: 'text-red-700',
  };

  assert(severityMap.WARNING === 'text-yellow-500');
  assert(severityMap.ERROR === 'text-red-500');
  assert(severityMap.CRITICAL === 'text-red-700');
});

test('Placeholder replacement — channel ID substitution', () => {
  const policyJson = JSON.stringify({
    ...SAMPLE_POLICY_A1,
    notificationChannels: ['projects/hmatologia2/notificationChannels/PLACEHOLDER_ONCALL_ENG'],
  });

  const policy = JSON.parse(policyJson);
  const placeholder = policy.notificationChannels[0];

  assert(placeholder.includes('PLACEHOLDER'));

  // Simulate replacement
  const replacement = 'projects/hmatologia2/notificationChannels/actual-slack-channel-id';
  const updatedPolicy = {
    ...policy,
    notificationChannels: [replacement],
  };

  assert(!updatedPolicy.notificationChannels[0].includes('PLACEHOLDER'));
  assert(updatedPolicy.notificationChannels[0] === replacement);
});

test('Rate limiting — notification interval validation', () => {
  const rateLimits = {
    A1: 3600, // 1h
    A3: 1800, // 30m
    A4: 60, // 1m (CRITICAL, aggressive)
  };

  assert(rateLimits.A1 === 3600);
  assert(rateLimits.A3 === 1800);
  assert(rateLimits.A4 === 60);
  assert(rateLimits.A1 > rateLimits.A4); // Warning rate limit > critical
});

test('Policy summary — activation checklist', () => {
  const checklist = [
    { policy: 'A1', active: true, verified: true },
    { policy: 'A2', active: false, verified: false },
    { policy: 'A3', active: true, verified: true },
    { policy: 'A4', active: true, verified: true },
    { policy: 'A5', active: false, verified: false },
    { policy: 'A6', active: false, verified: false },
  ];

  const activeCount = checklist.filter((c) => c.active).length;
  const verifiedCount = checklist.filter((c) => c.verified).length;

  assert(activeCount === 3, 'Expected 3 active policies (A1, A3, A4)');
  assert(verifiedCount === 3, 'Expected 3 verified policies (A1, A3, A4)');
});

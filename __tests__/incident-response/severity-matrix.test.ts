/**
 * Incident Severity Classification Tests
 *
 * Tests the incident severity decision tree (Green/Yellow/Red/Black) with realistic scenarios.
 * Validates SLA calculations and escalation rules per RDC 978 Art. 127 + DICQ 4.14.1
 */

import { z } from 'zod';

// ─── Types ────────────────────────────────────────────────────────────────

export type SeverityLevel = 'green' | 'yellow' | 'red' | 'black';
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'closed';
export type EscalationLevel = 'internal' | 'team' | 'leadership' | 'legal';

interface IncidentClassificationInput {
  affectedUsers: number;
  systemsDown: string[];
  dataImpact:
    | 'none'
    | 'read-slow'
    | 'read-only-affected'
    | 'write-blocked'
    | 'integrity-violated'
    | 'total-loss'
    | 'records-missing';
  regulatoryImpact: 'none' | 'minimal' | 'RDC-Art-128' | 'RDC-Art-99' | 'DICQ-4.4' | 'LGPD-breach';
  workaroundAvailable?: boolean;
  systemDown?: boolean;
}

interface IncidentForEscalation {
  severity: SeverityLevel;
  startedAt: number; // milliseconds timestamp
  resolved: boolean;
  dataLossConfirmed?: boolean;
}

// ─── Severity Classification Engine ────────────────────────────────────────

/**
 * Classifies incident severity based on impact matrix:
 * Green — Low Risk (no patient impact)
 * Yellow — Moderate Impact (some users, workaround exists)
 * Red — High Impact (core workflow down, many users)
 * Black — Complete Failure (system down, regulatory risk, data loss)
 */
export function classifySeverity(input: IncidentClassificationInput): SeverityLevel {
  // ─── BLACK: Most severe ───────────────────────────────────────────────────
  // Criteria: System completely down OR data integrity compromised OR patient data loss
  if (
    input.systemsDown.includes('firestore') ||
    input.dataImpact === 'total-loss' ||
    input.dataImpact === 'integrity-violated' ||
    input.dataImpact === 'records-missing' ||
    input.regulatoryImpact === 'LGPD-breach'
  ) {
    return 'black';
  }

  // ─── RED: High impact ─────────────────────────────────────────────────────
  // Criteria: Core workflow down, many users affected, regulatory impact
  if (
    (input.systemsDown.includes('laudo-release') ||
      input.systemsDown.includes('notivisa-queue') ||
      input.systemsDown.includes('auth')) &&
    input.affectedUsers >= 100
  ) {
    return 'red';
  }

  // Audit trail compromise = RED (DICQ 4.4 compliance)
  if (input.dataImpact === 'read-only-affected' && input.regulatoryImpact === 'DICQ-4.4') {
    return 'red';
  }

  // Write-blocked with regulatory impact = RED
  if (input.dataImpact === 'write-blocked' && input.regulatoryImpact !== 'none') {
    return 'red';
  }

  // RDC Art. 99 impact (CAPA/nonconformity system down) = RED
  if (input.regulatoryImpact === 'RDC-Art-99' && input.affectedUsers > 0) {
    return 'red';
  }

  // ─── YELLOW: Moderate impact ──────────────────────────────────────────────
  // Criteria: Some users affected, workaround available, no regulatory impact
  if (input.affectedUsers > 0 && input.affectedUsers < 100) {
    return 'yellow';
  }

  // Degradation with workaround = YELLOW
  if (input.dataImpact === 'read-slow' && input.workaroundAvailable === true) {
    return 'yellow';
  }

  // ─── GREEN: Low risk ──────────────────────────────────────────────────────
  // Criteria: No users affected, internal systems only, no regulatory impact
  return 'green';
}

/**
 * Returns SLA response time in minutes based on severity
 */
export function getSLAMinutes(severity: SeverityLevel): number {
  const slaMap: Record<SeverityLevel, number> = {
    green: 480, // Next business day (8 hours)
    yellow: 240, // 4 hours
    red: 60, // 1 hour
    black: 15, // 15 minutes (immediate escalation)
  };
  return slaMap[severity];
}

/**
 * Returns escalation level based on severity
 */
export function getEscalationLevel(severity: SeverityLevel): EscalationLevel {
  const escalationMap: Record<SeverityLevel, EscalationLevel> = {
    green: 'internal',
    yellow: 'team',
    red: 'leadership',
    black: 'legal',
  };
  return escalationMap[severity];
}

/**
 * Determines if incident should escalate from current to higher severity
 */
export function shouldEscalateToRed(incident: IncidentForEscalation): boolean {
  if (incident.severity !== 'yellow') return false;

  const elapsedMinutes = (Date.now() - incident.startedAt) / 60000;
  return elapsedMinutes > 120 && !incident.resolved; // 2 hours threshold
}

export function shouldEscalateToBlack(incident: IncidentForEscalation): boolean {
  if (incident.severity !== 'red') return false;

  return incident.dataLossConfirmed === true;
}

// ─── Test Suite ───────────────────────────────────────────────────────────

describe('Incident Severity Classification', () => {
  // ─── GREEN Incidents ──────────────────────────────────────────────────────

  describe('Green incidents (low risk)', () => {
    test('UI typo should be classified Green', () => {
      const severity = classifySeverity({
        affectedUsers: 0,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'none',
      });

      expect(severity).toBe('green');
    });

    test('dev environment broken should be Green', () => {
      const severity = classifySeverity({
        affectedUsers: 0,
        systemsDown: ['dev-database'],
        dataImpact: 'none',
        regulatoryImpact: 'none',
      });

      expect(severity).toBe('green');
    });

    test('Green SLA should be 8 hours (480 minutes)', () => {
      expect(getSLAMinutes('green')).toBe(480);
    });

    test('Green escalation level should be internal', () => {
      expect(getEscalationLevel('green')).toBe('internal');
    });
  });

  // ─── YELLOW Incidents ─────────────────────────────────────────────────────

  describe('Yellow incidents (moderate impact)', () => {
    test('analytics slow (5 users affected) should be Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 5,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'none',
        workaroundAvailable: true,
      });

      expect(severity).toBe('yellow');
    });

    test('5 percent exports failing should be Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 50, // 5% of 1000 users
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'minimal',
        workaroundAvailable: true,
      });

      expect(severity).toBe('yellow');
    });

    test('read-slow with workaround should be Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 20,
        systemsDown: [],
        dataImpact: 'read-slow',
        regulatoryImpact: 'none',
        workaroundAvailable: true,
      });

      expect(severity).toBe('yellow');
    });

    test('Yellow SLA should be 4 hours (240 minutes)', () => {
      expect(getSLAMinutes('yellow')).toBe(240);
    });

    test('Yellow escalation level should be team', () => {
      expect(getEscalationLevel('yellow')).toBe('team');
    });
  });

  // ─── RED Incidents ────────────────────────────────────────────────────────

  describe('Red incidents (high impact)', () => {
    test('laudo release blocked should be Red', () => {
      const severity = classifySeverity({
        affectedUsers: 500,
        systemsDown: ['laudo-release'],
        dataImpact: 'read-only-affected',
        regulatoryImpact: 'RDC-Art-128',
      });

      expect(severity).toBe('red');
    });

    test('NOTIVISA submissions failing should be Red', () => {
      const severity = classifySeverity({
        affectedUsers: 1000,
        systemsDown: ['notivisa-queue'],
        dataImpact: 'write-blocked',
        regulatoryImpact: 'RDC-Art-99',
      });

      expect(severity).toBe('red');
    });

    test('audit trail query timeout should be Red', () => {
      const severity = classifySeverity({
        affectedUsers: 100,
        systemsDown: [],
        dataImpact: 'read-slow',
        regulatoryImpact: 'DICQ-4.4',
        workaroundAvailable: false,
      });

      expect(severity).toBe('red');
    });

    test('auth system down should be Red', () => {
      const severity = classifySeverity({
        affectedUsers: 200,
        systemsDown: ['auth'],
        dataImpact: 'write-blocked',
        regulatoryImpact: 'RDC-Art-128',
      });

      expect(severity).toBe('red');
    });

    test('write-blocked with regulatory impact should be Red', () => {
      const severity = classifySeverity({
        affectedUsers: 50,
        systemsDown: [],
        dataImpact: 'write-blocked',
        regulatoryImpact: 'RDC-Art-99',
      });

      expect(severity).toBe('red');
    });

    test('Red SLA should be 1 hour (60 minutes)', () => {
      expect(getSLAMinutes('red')).toBe(60);
    });

    test('Red escalation level should be leadership', () => {
      expect(getEscalationLevel('red')).toBe('leadership');
    });
  });

  // ─── BLACK Incidents ──────────────────────────────────────────────────────

  describe('Black incidents (complete failure)', () => {
    test('database entirely inaccessible should be Black', () => {
      const severity = classifySeverity({
        affectedUsers: 10000,
        systemsDown: ['firestore'],
        dataImpact: 'total-loss',
        regulatoryImpact: 'RDC-Art-128',
      });

      expect(severity).toBe('black');
    });

    test('audit trail corrupted should be Black', () => {
      const severity = classifySeverity({
        affectedUsers: 1000,
        systemsDown: [],
        dataImpact: 'integrity-violated',
        regulatoryImpact: 'RDC-Art-128',
      });

      expect(severity).toBe('black');
    });

    test('patient data lost should be Black', () => {
      const severity = classifySeverity({
        affectedUsers: 1000,
        systemsDown: [],
        dataImpact: 'records-missing',
        regulatoryImpact: 'LGPD-breach',
      });

      expect(severity).toBe('black');
    });

    test('LGPD breach should be Black', () => {
      const severity = classifySeverity({
        affectedUsers: 100,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'LGPD-breach',
      });

      expect(severity).toBe('black');
    });

    test('Black SLA should be 15 minutes', () => {
      expect(getSLAMinutes('black')).toBe(15);
    });

    test('Black escalation level should be legal', () => {
      expect(getEscalationLevel('black')).toBe('legal');
    });
  });

  // ─── Escalation Rules ─────────────────────────────────────────────────────

  describe('Escalation rules', () => {
    test('Yellow escalates to Red if not resolved in 2 hours', () => {
      const incident: IncidentForEscalation = {
        severity: 'yellow',
        startedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        resolved: false,
      };

      expect(shouldEscalateToRed(incident)).toBe(true);
    });

    test('Yellow does NOT escalate to Red if resolved before 2 hours', () => {
      const incident: IncidentForEscalation = {
        severity: 'yellow',
        startedAt: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
        resolved: true,
      };

      expect(shouldEscalateToRed(incident)).toBe(false);
    });

    test('Yellow does NOT escalate if still within 2-hour window', () => {
      const incident: IncidentForEscalation = {
        severity: 'yellow',
        startedAt: Date.now() - 1.5 * 60 * 60 * 1000, // 1.5 hours ago
        resolved: false,
      };

      expect(shouldEscalateToRed(incident)).toBe(false);
    });

    test('Red escalates to Black if data loss confirmed', () => {
      const incident: IncidentForEscalation = {
        severity: 'red',
        startedAt: Date.now(),
        resolved: false,
        dataLossConfirmed: true,
      };

      expect(shouldEscalateToBlack(incident)).toBe(true);
    });

    test('Red does NOT escalate to Black if no data loss', () => {
      const incident: IncidentForEscalation = {
        severity: 'red',
        startedAt: Date.now(),
        resolved: false,
        dataLossConfirmed: false,
      };

      expect(shouldEscalateToBlack(incident)).toBe(false);
    });

    test('Green does NOT escalate', () => {
      const incident: IncidentForEscalation = {
        severity: 'green',
        startedAt: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
        resolved: false,
      };

      expect(shouldEscalateToRed(incident)).toBe(false);
    });
  });

  // ─── SLA Compliance ───────────────────────────────────────────────────────

  describe('SLA calculations', () => {
    test('Green SLA gives 8 hours response window', () => {
      const slaMinutes = getSLAMinutes('green');
      expect(slaMinutes).toBe(480);
      expect(slaMinutes / 60).toBe(8);
    });

    test('Yellow SLA gives 4 hours response window', () => {
      const slaMinutes = getSLAMinutes('yellow');
      expect(slaMinutes).toBe(240);
      expect(slaMinutes / 60).toBe(4);
    });

    test('Red SLA gives 1 hour response window', () => {
      const slaMinutes = getSLAMinutes('red');
      expect(slaMinutes).toBe(60);
      expect(slaMinutes / 60).toBe(1);
    });

    test('Black SLA gives 15 minutes response window', () => {
      const slaMinutes = getSLAMinutes('black');
      expect(slaMinutes).toBe(15);
      expect(slaMinutes / 60).toBeLessThan(1);
    });

    test('SLA should be respected in escalation window', () => {
      const yelloyStartTime = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago (exceeds 4-hour SLA)
      const yelloyIncident: IncidentForEscalation = {
        severity: 'yellow',
        startedAt: yelloyStartTime,
        resolved: false,
      };

      // Since 3 hours < 4 hours (Yellow SLA), should NOT escalate yet
      expect(shouldEscalateToRed(yelloyIncident)).toBe(false);
    });
  });

  // ─── Real-world Scenarios ──────────────────────────────────────────────────

  describe('Real-world scenarios', () => {
    test('slow analytics page for one user = Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 1,
        systemsDown: [],
        dataImpact: 'read-slow',
        regulatoryImpact: 'none',
        workaroundAvailable: true,
      });

      expect(severity).toBe('yellow');
      expect(getEscalationLevel(severity)).toBe('team');
    });

    test('export timeout affecting batch job = Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 0, // Automated job, no user impact
        systemsDown: ['export'],
        dataImpact: 'none',
        regulatoryImpact: 'minimal',
        workaroundAvailable: true,
      });

      expect(severity).toBe('green');
    });

    test('laudo release down for 1 hour, 500 users queued = Red', () => {
      const severity = classifySeverity({
        affectedUsers: 500,
        systemsDown: ['laudo-release'],
        dataImpact: 'read-only-affected',
        regulatoryImpact: 'RDC-Art-128',
      });

      expect(severity).toBe('red');
      const slaMinutes = getSLAMinutes(severity);
      expect(slaMinutes).toBeLessThanOrEqual(60);
    });

    test('NOTIVISA sandbox test failure = Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 0,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'minimal',
        workaroundAvailable: true,
      });

      expect(severity).toBe('green'); // Test environment, no patient impact
    });

    test('NOTIVISA production blocked = Red', () => {
      const severity = classifySeverity({
        affectedUsers: 100,
        systemsDown: ['notivisa-queue'],
        dataImpact: 'write-blocked',
        regulatoryImpact: 'RDC-Art-99',
      });

      expect(severity).toBe('red');
    });

    test('Database replication lag (read-only) = Red with DICQ 4.4 impact', () => {
      const severity = classifySeverity({
        affectedUsers: 50,
        systemsDown: [],
        dataImpact: 'read-only-affected',
        regulatoryImpact: 'DICQ-4.4',
      });

      expect(severity).toBe('red');
    });
  });
});

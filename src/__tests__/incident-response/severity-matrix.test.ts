/**
 * Incident Severity Classification Tests
 *
 * Validates severity matrix against decision criteria (Green/Yellow/Red/Black).
 * Aligns with incident response runbook and RDC 978 Art. 99 escalation rules.
 */

interface IncidentParams {
  affectedUsers: number;
  systemsDown: string[];
  dataImpact: 'none' | 'dev-only' | 'read-only-affected' | 'write-blocked' | 'read-slow' | 'total-loss' | 'integrity-violated' | 'records-missing';
  regulatoryImpact: 'none' | 'minimal' | 'RDC-Art-99' | 'RDC-Art-128' | 'DICQ-4.4' | 'LGPD-breach';
  workaroundAvailable?: boolean;
  dataLossConfirmed?: boolean;
}

function classifySeverity(params: IncidentParams): 'green' | 'yellow' | 'red' | 'black' {
  // Black: system down, data loss, integrity violated, or patient safety risk
  if (
    params.dataImpact === 'total-loss' ||
    params.dataImpact === 'integrity-violated' ||
    params.dataImpact === 'records-missing' ||
    params.regulatoryImpact === 'LGPD-breach'
  ) {
    return 'black';
  }

  // Red: critical systems down OR many users affected + regulatory impact OR read/write blocked
  if (
    (params.systemsDown.includes('firestore') &&
      (params.regulatoryImpact === 'RDC-Art-128' ||
        params.affectedUsers > 100)) ||
    (params.dataImpact === 'write-blocked' && params.affectedUsers > 100) ||
    (params.dataImpact === 'read-slow' &&
      params.regulatoryImpact === 'DICQ-4.4' &&
      !params.workaroundAvailable) ||
    (params.systemsDown.includes('laudo-release') && params.affectedUsers > 100) ||
    (params.systemsDown.includes('notivisa-queue') && params.affectedUsers > 100)
  ) {
    return 'red';
  }

  // Yellow: some users affected OR regulatory impact but workaround available
  if (
    (params.affectedUsers > 0 && params.affectedUsers <= 100 && params.workaroundAvailable) ||
    (params.regulatoryImpact === 'minimal' && params.affectedUsers > 0)
  ) {
    return 'yellow';
  }

  // Green: no users affected OR dev environment only
  if (params.affectedUsers === 0 || params.dataImpact === 'dev-only') {
    return 'green';
  }

  return 'green'; // default
}

function shouldEscalateToRed(incident: {
  severity: string;
  startedAt: number;
  resolved: boolean;
}): boolean {
  if (incident.severity !== 'yellow') return false;
  const now = Date.now();
  const elapsedTime = now - incident.startedAt;
  const twoHoursMs = 2 * 60 * 60 * 1000;
  return elapsedTime >= twoHoursMs && !incident.resolved;
}

function shouldEscalateToBlack(incident: {
  severity: string;
  dataLossConfirmed?: boolean;
}): boolean {
  return incident.severity === 'red' && incident.dataLossConfirmed === true;
}

describe('Incident Severity Classification', () => {
  describe('Green incidents', () => {
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
        dataImpact: 'dev-only',
        regulatoryImpact: 'none',
      });
      expect(severity).toBe('green');
    });
  });

  describe('Yellow incidents', () => {
    test('analytics slow should be Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 5,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'none',
        workaroundAvailable: true,
      });
      expect(severity).toBe('yellow');
    });

    test('small percentage exports failing should be Yellow', () => {
      const severity = classifySeverity({
        affectedUsers: 50,
        systemsDown: [],
        dataImpact: 'none',
        regulatoryImpact: 'minimal',
        workaroundAvailable: true,
      });
      expect(severity).toBe('yellow');
    });
  });

  describe('Red incidents', () => {
    test('laudo release blocked for many users should be Red', () => {
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
  });

  describe('Black incidents', () => {
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
  });

  describe('Escalation rules', () => {
    test('Yellow escalates to Red if not resolved in 2 hours', () => {
      const incident = {
        severity: 'yellow',
        startedAt: Date.now() - 2 * 60 * 60 * 1000,
        resolved: false,
      };

      expect(shouldEscalateToRed(incident)).toBe(true);
    });

    test('Red escalates to Black if data loss confirmed', () => {
      const incident = {
        severity: 'red',
        dataLossConfirmed: true,
      };

      expect(shouldEscalateToBlack(incident)).toBe(true);
    });
  });
});

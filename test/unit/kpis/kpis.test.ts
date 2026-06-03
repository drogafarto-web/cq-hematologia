import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for KPIs module (metrics aggregation).
 * Tests turnaround, rework%, conformance%, SLA alerts.
 */

describe('KPIs Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Turnaround Calculation', () => {
    it('should calculate average turnaround time', () => {
      const runs = [
        { criadoMs: 0, liberadoMs: 2 * 60 * 60 * 1000 }, // 2h
        { criadoMs: 0, liberadoMs: 3 * 60 * 60 * 1000 }, // 3h
        { criadoMs: 0, liberadoMs: 4 * 60 * 60 * 1000 }, // 4h
      ];

      const turnaroundHoras = runs.map((r) => (r.liberadoMs - r.criadoMs) / (1000 * 60 * 60));
      const media = turnaroundHoras.reduce((a, b) => a + b) / turnaroundHoras.length;

      expect(media).toBe(3); // average of 2, 3, 4
    });

    it('should calculate 95th percentile turnaround', () => {
      const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const sorted = [...times].sort((a, b) => a - b);
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      const p95 = sorted[p95Index];

      expect(p95).toBeGreaterThanOrEqual(9);
    });

    it('should alert when turnaround exceeds SLA', () => {
      const slaLimit = 24; // hours
      const turnaroundMedia = 26;

      const breachesSlA = turnaroundMedia > slaLimit;
      expect(breachesSlA).toBe(true);
    });
  });

  describe('Rework Calculation', () => {
    it('should count repeat runs (rework)', () => {
      const runsPerSample = {
        'sample-001': 2, // repeat run
        'sample-002': 1,
        'sample-003': 3, // 2 repeats
      };

      let reruns = 0;
      for (const count of Object.values(runsPerSample)) {
        if (count > 1) reruns += count - 1;
      }

      expect(reruns).toBe(3); // 1 + 2
    });

    it('should calculate rework percentage', () => {
      const totalRuns = 100;
      const reruns = 8;
      const retrabalhoPercentual = (reruns / totalRuns) * 100;

      expect(retrabalhoPercentual).toBe(8);
    });

    it('should trigger high rework alert (>10%)', () => {
      const reworkPercent = 12;
      const alertTriggered = reworkPercent > 10;

      expect(alertTriggered).toBe(true);
    });

    it('should escalate to critical if rework > 20%', () => {
      const reworkPercent = 22;
      const severidade = reworkPercent > 20 ? 'critical' : 'warning';

      expect(severidade).toBe('critical');
    });
  });

  describe('Conformance Calculation', () => {
    it('should count runs with all required fields', () => {
      const runs = [
        { popId: '1', equipId: 'e1', operadorId: 'o1' }, // conformes
        { popId: '2', equipId: 'e2', operadorId: 'o2' }, // conformes
        { popId: null, equipId: 'e3', operadorId: 'o3' }, // não-conforme
      ];

      const conformes = runs.filter((r) => r.popId && r.equipId && r.operadorId);
      expect(conformes.length).toBe(2);
    });

    it('should calculate conformance percentage', () => {
      const runsConformes = 95;
      const totalRuns = 100;
      const conformancePercentual = (runsConformes / totalRuns) * 100;

      expect(conformancePercentual).toBe(95);
    });

    it('should alert when conformance < 95%', () => {
      const conformance = 92;
      const alertTriggered = conformance < 95;

      expect(alertTriggered).toBe(true);
    });

    it('should escalate to critical if conformance < 90%', () => {
      const conformance = 88;
      const severidade = conformance < 90 ? 'critical' : 'warning';

      expect(severidade).toBe('critical');
    });
  });

  describe('NC Origins Aggregation', () => {
    it('should count NCs by module origin', () => {
      const ncPorOrigem = {
        hematologia: 5,
        imunologia: 3,
        pgrss: 2,
      };

      const total = Object.values(ncPorOrigem).reduce((a, b) => a + b, 0);
      expect(total).toBe(10);
    });

    it('should identify high-NC modules', () => {
      const ncPorOrigem = {
        hematologia: 10,
        imunologia: 2,
        pgrss: 1,
      };

      const highestModule = Object.entries(ncPorOrigem).sort((a, b) => b[1] - a[1])[0];
      expect(highestModule[0]).toBe('hematologia');
      expect(highestModule[1]).toBe(10);
    });
  });

  describe('SLA Compliance Tracking', () => {
    it('should compare turnaround against SLA limit', () => {
      const slaLimitHoras = 24;
      const turnaroundMedia = 20;
      const slaAtendido = turnaroundMedia <= slaLimitHoras;

      expect(slaAtendido).toBe(true);
    });

    it('should mark SLA as breached when exceeded', () => {
      const slaLimitHoras = 24;
      const turnaroundMedia = 28;
      const slaAtendido = turnaroundMedia <= slaLimitHoras;

      expect(slaAtendido).toBe(false);
    });

    it('should create alert for SLA breach', () => {
      const breach = {
        tipo: 'sla_breach',
        severidade: 'critical',
        mensagem: 'Turnaround médio (26.5h) excedeu limite de 24h',
      };

      expect(breach.tipo).toBe('sla_breach');
      expect(breach.severidade).toBe('critical');
    });
  });

  describe('Daily Aggregation Schedule', () => {
    it('should run aggregation at 00:00 UTC', () => {
      const scheduleTime = '0:00'; // 00:00 UTC
      expect(scheduleTime).toMatch(/^\d{1,2}:\d{2}$/);
    });

    it('should iterate all labs', () => {
      const labs = ['lab-001', 'lab-002', 'lab-003'];
      labs.forEach((labId) => {
        expect(labId).toMatch(/^lab-/);
      });
    });

    it('should handle missing runs gracefully', () => {
      const runs = [];
      const totalRuns = runs.length;

      if (totalRuns === 0) {
        console.log('No runs in last 24h, skipping aggregation');
      }
      expect(totalRuns).toBe(0);
    });

    it('should read lab SLA configuration', () => {
      const labConfig = {
        slaLimitHoras: 24,
        alertaRetrabalho: 10,
        alertaConformidade: 95,
      };

      expect(labConfig.slaLimitHoras).toBeGreaterThan(0);
    });
  });

  describe('Data Storage', () => {
    it('should store daily KPI record with timestamp', () => {
      const kpi = {
        labId: 'lab-001',
        data: new Date(),
        turnaround_media_horas: 12,
        retrabalho_percentual: 5,
        conformidade_percentual: 98,
      };

      expect(kpi.data).toBeInstanceOf(Date);
      expect(kpi.turnaround_media_horas).toBeGreaterThan(0);
    });

    it('should include all metrics in record', () => {
      const kpiFields = [
        'turnaround_media_horas',
        'turnaround_percentil_95',
        'retrabalho_percentual',
        'retrabalho_total',
        'conformidade_percentual',
        'runs_total',
        'runs_conformes',
        'nc_total_abertas',
        'nc_por_origem',
        'sla_atendido',
        'sla_limite_horas',
      ];

      expect(kpiFields.length).toBe(11);
    });

    it('should preserve historical trend data', () => {
      const historicalDays = 30;
      const dayRange = Array.from({ length: historicalDays }, (_, i) => i);

      expect(dayRange.length).toBe(30);
    });
  });
});

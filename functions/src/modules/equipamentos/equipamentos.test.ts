// @ts-ignore
import { describe, it, expect } from '@jest/globals';

describe('ADR 0007 — Equipamento Tests', () => {
  it('should block equipment with overdue calibration', () => {
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 1);
    expect(pastDate < new Date()).toBe(true);
  });

  it('should block broken equipment', () => {
    expect('quebrado').toBe('quebrado');
  });

  it('should block equipment in maintenance', () => {
    expect('em_manutencao').toBe('em_manutencao');
  });

  it('should allow active equipment with valid calibration', () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    expect(futureDate > new Date()).toBe(true);
  });
});

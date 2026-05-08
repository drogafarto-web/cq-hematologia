import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { computeSlaState, formatSlaCountdown } from '../utils/slaFormat';
import type { CriticosEscalacao } from '../types';

const baseEscalacao = (
  overrides: Partial<CriticosEscalacao> = {},
): CriticosEscalacao => ({
  id: 'e1',
  labId: 'lab-1',
  laudoId: 'laudo-1',
  laudoVersion: 1,
  exameId: 'ex-1',
  analitoId: 'K',
  valorObtido: 6.8,
  thresholdId: 'th-1',
  severidade: 'alta',
  motivo: 'Acima de 6.5',
  pacienteId: 'p1',
  pacienteNome: 'Paciente Teste',
  pacienteIdade: 60,
  pacienteSexo: 'M',
  medicoId: 'm1',
  medicoNome: 'Dr X',
  medicoTelefone: '+5511999999999',
  medicoEmail: 'doc@example.com',
  rtId: 'rt1',
  rtNome: 'RT',
  rtEmail: 'rt@example.com',
  escalacoes: [],
  status: 'enviado',
  sla_status: 'em_prazo',
  sla_minutos_target: 60,
  criadoEm: Timestamp.fromMillis(0),
  criadoPor: 'rt1',
  atualizadoEm: Timestamp.fromMillis(0),
  atualizadoPor: 'rt1',
  deletadoEm: null,
  ...overrides,
});

describe('slaFormat.computeSlaState', () => {
  it('classifies as in_window for elapsed < 50% of target', () => {
    const e = baseEscalacao({ criadoEm: Timestamp.fromMillis(0) });
    const s = computeSlaState(e, 10 * 60 * 1000); // 10 of 60 minutes
    expect(s.kind).toBe('in_window');
    expect(s.elapsedMs).toBe(10 * 60 * 1000);
    expect(s.targetMs).toBe(60 * 60 * 1000);
  });

  it('classifies as warning between 50% and 100% of target', () => {
    const e = baseEscalacao({ criadoEm: Timestamp.fromMillis(0) });
    const s = computeSlaState(e, 35 * 60 * 1000);
    expect(s.kind).toBe('warning');
  });

  it('classifies as expired at or past target', () => {
    const e = baseEscalacao({ criadoEm: Timestamp.fromMillis(0) });
    const s = computeSlaState(e, 60 * 60 * 1000);
    expect(s.kind).toBe('expired');
  });

  it('uses tempo_sla_ms snapshot when escalacao is reconhecida', () => {
    const e = baseEscalacao({
      status: 'reconhecido',
      tempo_sla_ms: 5 * 60 * 1000,
      criadoEm: Timestamp.fromMillis(0),
    });
    // Even with a "now" far in the future, we use the snapshot.
    const s = computeSlaState(e, 99 * 60 * 60 * 1000);
    expect(s.elapsedMs).toBe(5 * 60 * 1000);
    expect(s.kind).toBe('in_window');
  });

  it('handles plain number criadoEm gracefully', () => {
    const e = baseEscalacao({
      criadoEm: 0 as unknown as Timestamp,
    });
    const s = computeSlaState(e, 1000);
    expect(s.elapsedMs).toBe(1000);
  });
});

describe('slaFormat.formatSlaCountdown', () => {
  it('renders zero seconds with padded format', () => {
    expect(formatSlaCountdown(0, 60)).toBe('0m 00s / 60m');
  });

  it('renders elapsed minutes and zero-padded seconds', () => {
    expect(formatSlaCountdown(7 * 60 * 1000 + 3 * 1000, 30)).toBe('7m 03s / 30m');
  });

  it('rounds down to whole seconds', () => {
    expect(formatSlaCountdown(1500, 30)).toBe('0m 01s / 30m');
  });
});

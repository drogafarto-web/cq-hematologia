import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  evaluateInsumoUsability,
  motivoToTransitionType,
} from '../../../src/features/insumos/utils/insumoUsability';
import type {
  Insumo,
  InsumoReagente,
  InsumoControle,
} from '../../../src/features/insumos/types/Insumo';

function tsFromOffsetDays(days: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + days * 86_400_000));
}

const base = {
  id: 'i1',
  labId: 'lab1',
  fabricante: 'Bio-Rad',
  nomeComercial: 'Teste Insumo',
  lote: 'L001',
  validade: tsFromOffsetDays(30),
  validadeReal: tsFromOffsetDays(30),
  dataAbertura: null,
  diasEstabilidadeAbertura: 30,
  status: 'ativo' as const,
  createdAt: Timestamp.now(),
  createdBy: 'uid',
};

describe('evaluateInsumoUsability', () => {
  it('OK para controle válido', () => {
    const i: InsumoControle = {
      ...base,
      tipo: 'controle',
      modulo: 'hematologia',
      modulos: ['hematologia'],
      nivel: 'normal',
    };
    expect(evaluateInsumoUsability(i).ok).toBe(true);
  });

  it('bloqueia descartado', () => {
    const i: InsumoControle = {
      ...base,
      tipo: 'controle',
      modulo: 'hematologia',
      modulos: ['hematologia'],
      nivel: 'normal',
      status: 'descartado',
      motivoDescarte: 'derramou',
    };
    const r = evaluateInsumoUsability(i);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('descartado');
  });

  it('bloqueia vencido', () => {
    const i: InsumoControle = {
      ...base,
      tipo: 'controle',
      modulo: 'hematologia',
      modulos: ['hematologia'],
      nivel: 'normal',
      validadeReal: tsFromOffsetDays(-1),
    };
    const r = evaluateInsumoUsability(i);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe('vencido');
  });

  describe('imuno — CQ por lote', () => {
    const imunoBase: InsumoReagente = {
      ...base,
      tipo: 'reagente',
      modulo: 'imunologia',
      modulos: ['imunologia'],
    };

    it('bloqueia quando qcStatus=pendente', () => {
      const r = evaluateInsumoUsability({ ...imunoBase, qcStatus: 'pendente' });
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe('imuno-nao-aprovado');
    });

    it('bloqueia quando qcStatus=reprovado', () => {
      const r = evaluateInsumoUsability({ ...imunoBase, qcStatus: 'reprovado' });
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe('imuno-nao-aprovado');
    });

    it('OK quando qcStatus=aprovado', () => {
      const r = evaluateInsumoUsability({ ...imunoBase, qcStatus: 'aprovado' });
      expect(r.ok).toBe(true);
    });

    it('bloqueia quando qcStatus ausente (novo lote)', () => {
      const r = evaluateInsumoUsability(imunoBase);
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe('imuno-nao-aprovado');
    });
  });

  describe('hemato — qcValidationRequired', () => {
    const reagHemato: InsumoReagente = {
      ...base,
      tipo: 'reagente',
      modulo: 'hematologia',
      modulos: ['hematologia'],
    };

    it('OK quando qcValidationRequired false', () => {
      expect(evaluateInsumoUsability({ ...reagHemato, qcValidationRequired: false }).ok).toBe(true);
    });

    it('bloqueia qc-pendente', () => {
      const r = evaluateInsumoUsability({ ...reagHemato, qcValidationRequired: true });
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe('qc-pendente');
    });
  });

  describe('ordem de severidade', () => {
    it('descartado vence vencido', () => {
      const i: InsumoControle = {
        ...base,
        tipo: 'controle',
        modulo: 'hematologia',
        modulos: ['hematologia'],
        nivel: 'normal',
        status: 'descartado',
        motivoDescarte: 'x',
        validadeReal: tsFromOffsetDays(-10),
      };
      expect(evaluateInsumoUsability(i).motivo).toBe('descartado');
    });

    it('vencido vence qc-pendente', () => {
      const i: InsumoReagente = {
        ...base,
        tipo: 'reagente',
        modulo: 'hematologia',
        modulos: ['hematologia'],
        validadeReal: tsFromOffsetDays(-1),
        qcValidationRequired: true,
      };
      expect(evaluateInsumoUsability(i).motivo).toBe('vencido');
    });
  });
});

describe('motivoToTransitionType', () => {
  it('vencido → override-vencido', () => {
    expect(motivoToTransitionType('vencido')).toBe('override-vencido');
  });

  it('qc-pendente → override-qc-pendente', () => {
    expect(motivoToTransitionType('qc-pendente')).toBe('override-qc-pendente');
  });

  it('imuno-nao-aprovado → override-qc-pendente', () => {
    expect(motivoToTransitionType('imuno-nao-aprovado')).toBe('override-qc-pendente');
  });
});

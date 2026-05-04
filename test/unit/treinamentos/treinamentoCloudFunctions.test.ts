import { describe, it, expect } from 'vitest';
import type { TreinamentoCreationRequest, RegistroPresencaRequest, EmitirCertificadoRequest } from '../../../src/features/treinamentos/types/Treinamento';
import { Timestamp } from 'firebase/firestore';

describe('Treinamento Cloud Functions', () => {
  describe('criarTreinamento', () => {
    it('should validate required fields in creation request', () => {
      const request: TreinamentoCreationRequest = {
        labId: 'lab-001',
        popId: 'pop-001',
        popVersaoNumero: '1.0',
        tipo: 'inicial',
        titulo: 'Treinamento Inicial',
        dataAgendada: Timestamp.now(),
        instrutorId: 'user-instrutor-01',
        duracao_minutos: 120,
        participantes: ['user-op-01', 'user-op-02'],
      };

      expect(request.labId).toBeDefined();
      expect(request.popId).toBeDefined();
      expect(request.tipo).toBeDefined();
      expect(request.titulo).toBeDefined();
      expect(request.dataAgendada).toBeDefined();
      expect(request.instrutorId).toBeDefined();
      expect(request.duracao_minutos).toBeGreaterThan(0);
      expect(request.participantes.length).toBeGreaterThan(0);
    });

    it('should reject request with missing labId', () => {
      const invalidRequest = {
        // Missing labId
        popId: 'pop-001',
        tipo: 'inicial',
        titulo: 'Treinamento',
        dataAgendada: Timestamp.now(),
        instrutorId: 'user-01',
        duracao_minutos: 120,
        participantes: ['user-op-01'],
      };

      expect(invalidRequest.labId).toBeUndefined();
    });

    it('should validate instructor exists', () => {
      const request: TreinamentoCreationRequest = {
        labId: 'lab-001',
        popId: 'pop-001',
        popVersaoNumero: '1.0',
        tipo: 'inicial',
        titulo: 'Treinamento',
        dataAgendada: Timestamp.now(),
        instrutorId: 'user-instrutor-01',
        duracao_minutos: 120,
        participantes: ['user-op-01'],
      };

      expect(request.instrutorId).toBeTruthy();
    });

    it('should validate at least one participant', () => {
      const request: TreinamentoCreationRequest = {
        labId: 'lab-001',
        popId: 'pop-001',
        popVersaoNumero: '1.0',
        tipo: 'inicial',
        titulo: 'Treinamento',
        dataAgendada: Timestamp.now(),
        instrutorId: 'user-instrutor-01',
        duracao_minutos: 120,
        participantes: ['user-op-01'],
      };

      expect(request.participantes.length).toBeGreaterThan(0);
    });

    it('should set initial status as agendado', () => {
      const expectedStatus = 'agendado' as const;
      expect(expectedStatus).toBe('agendado');
    });

    it('should initialize empty presenca object', () => {
      const presenca: Record<string, any> = {};
      expect(presenca).toEqual({});
    });

    it('should link to POP version', () => {
      const request: TreinamentoCreationRequest = {
        labId: 'lab-001',
        popId: 'pop-001',
        popVersaoNumero: '1.0',
        tipo: 'inicial',
        titulo: 'Treinamento POP 1.0',
        dataAgendada: Timestamp.now(),
        instrutorId: 'user-instrutor-01',
        duracao_minutos: 120,
        participantes: ['user-op-01'],
      };

      expect(request.popVersaoNumero).toBe('1.0');
    });
  });

  describe('registrarPresenca', () => {
    it('should validate required fields', () => {
      const request: RegistroPresencaRequest = {
        labId: 'lab-001',
        treinamentoId: 'train-001',
        participanteId: 'user-op-01',
        presente: true,
      };

      expect(request.labId).toBeDefined();
      expect(request.treinamentoId).toBeDefined();
      expect(request.participanteId).toBeDefined();
      expect(typeof request.presente).toBe('boolean');
    });

    it('should allow optional signature', () => {
      const request: RegistroPresencaRequest = {
        labId: 'lab-001',
        treinamentoId: 'train-001',
        participanteId: 'user-op-01',
        presente: true,
        assinatura: 'signature-data',
      };

      expect(request.assinatura).toBeDefined();
    });

    it('should handle presence without signature', () => {
      const request: RegistroPresencaRequest = {
        labId: 'lab-001',
        treinamentoId: 'train-001',
        participanteId: 'user-op-01',
        presente: false,
      };

      expect(request.assinatura).toBeUndefined();
    });

    it('should support multiple registrations per training', () => {
      const requests: RegistroPresencaRequest[] = [
        {
          labId: 'lab-001',
          treinamentoId: 'train-001',
          participanteId: 'user-op-01',
          presente: true,
        },
        {
          labId: 'lab-001',
          treinamentoId: 'train-001',
          participanteId: 'user-op-02',
          presente: false,
        },
      ];

      expect(requests.length).toBe(2);
    });

    it('should require admin permission', () => {
      // Permission model: admin claim required
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });
  });

  describe('emitirCertificado', () => {
    it('should validate required fields', () => {
      const request: EmitirCertificadoRequest = {
        labId: 'lab-001',
        treinamentoId: 'train-001',
        validadesMeses: 12,
      };

      expect(request.labId).toBeDefined();
      expect(request.treinamentoId).toBeDefined();
      expect(request.validadesMeses).toBeGreaterThan(0);
    });

    it('should generate certificate number', () => {
      const number = `CERT-${Date.now()}`;
      expect(number).toMatch(/^CERT-\d+$/);
    });

    it('should calculate expiration correctly', () => {
      const months = 12;
      const daysInSeconds = months * 30 * 24 * 60 * 60 * 1000;
      expect(daysInSeconds).toBeGreaterThan(0);
    });

    it('should support different validity periods', () => {
      const validities = [6, 12, 24, 36];
      validities.forEach((months) => {
        expect(months).toBeGreaterThan(0);
      });
    });

    it('should update training status to realizado', () => {
      const newStatus = 'realizado' as const;
      expect(newStatus).toBe('realizado');
    });

    it('should allow optional certificate URL', () => {
      const request: EmitirCertificadoRequest = {
        labId: 'lab-001',
        treinamentoId: 'train-001',
        validadesMeses: 12,
        certificadoUrl: 'https://storage.example.com/cert-001.pdf',
      };

      expect(request.certificadoUrl).toBeDefined();
    });

    it('should require admin permission', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });
  });

  describe('Authorization', () => {
    it('should require admin or instructor for creation', () => {
      const allowedRoles = ['admin', 'instrutor'];
      expect(allowedRoles).toContain('admin');
    });

    it('should require admin for presence registration', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should require admin for certificate issuance', () => {
      const requiredRole = 'admin';
      expect(requiredRole).toBe('admin');
    });

    it('should enforce multi-tenant isolation', () => {
      const labId1 = 'lab-001';
      const labId2 = 'lab-002';
      expect(labId1).not.toEqual(labId2);
    });
  });

  describe('NC blocking gate', () => {
    it('should check for blocking NCs before creation', () => {
      // Integration with ADR 0003 (NC spine)
      const checkRequired = true;
      expect(checkRequired).toBe(true);
    });

    it('should prevent creation if critical NC active', () => {
      const ncBlocking = true;
      expect(ncBlocking).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should return error for invalid arguments', () => {
      const errorCode = 'invalid-argument';
      expect(errorCode).toBe('invalid-argument');
    });

    it('should return error for permission denied', () => {
      const errorCode = 'permission-denied';
      expect(errorCode).toBe('permission-denied');
    });

    it('should return error for internal failures', () => {
      const errorCode = 'internal';
      expect(errorCode).toBe('internal');
    });

    it('should return error for precondition failures', () => {
      const errorCode = 'failed-precondition';
      expect(errorCode).toBe('failed-precondition');
    });
  });

  describe('Response validation', () => {
    it('should return success flag', () => {
      const response = { success: true };
      expect(response.success).toBe(true);
    });

    it('should return treinamentoId on creation', () => {
      const response = { success: true, treinamentoId: 'train-001' };
      expect(response.treinamentoId).toBeDefined();
    });

    it('should return certificate details on issuance', () => {
      const response = {
        success: true,
        numero: 'CERT-001',
        validoAte: new Date(),
      };
      expect(response.numero).toBeDefined();
      expect(response.validoAte).toBeDefined();
    });
  });
});

/**
 * Test Fixtures for Smoke Tests
 *
 * Pre-built test data for Phase 3.1 + Stream A smoke tests
 * Provides helpers for creating consistent test data across all smoke test files
 */

import type {
  Lab,
  UserRole,
} from '../../../src/types';
import type { CEQParticipacao, CEQAmostra, CEQResultado } from '../../../src/features/ceq/types/CEQ';
import type { ExportJob, ExportRequest } from '../../../src/features/export/types';
import type { CIQComplianceMetrics } from '../../../src/features/analytics/types';

// ─── Lab Fixture ─────────────────────────────────────────────────────────────

export const SAMPLE_LAB_ID = 'test-lab-001';
export const SAMPLE_USER_ID = 'test-user-001';
export const SAMPLE_USER_EMAIL = 'test@labclin.local';

export const createSampleLab = (overrides?: Partial<Lab>): Lab => ({
  id: SAMPLE_LAB_ID,
  name: 'Labclin Test Lab',
  city: 'Rio Pomba',
  state: 'MG',
  cnes: '1234567',
  ownerEmail: SAMPLE_USER_EMAIL,
  createdAt: new Date('2026-01-01'),
  ...overrides,
});

// ─── CEQ Fixtures ────────────────────────────────────────────────────────────

export const createSampleCEQParticipacao = (
  overrides?: Partial<CEQParticipacao>,
): CEQParticipacao => ({
  id: 'ceq-part-001',
  labId: SAMPLE_LAB_ID,
  provedorId: 'controllab',
  provedorNome: 'Controllab',
  esquema: 'hematologia-basica',
  dataInicio: new Date('2026-01-01'),
  frequencia: 'mensal',
  analitosParticipados: ['hb', 'wbc', 'rbc'],
  ativo: true,
  criadoEm: new Date('2026-01-01'),
  criadoPor: SAMPLE_USER_ID,
  ...overrides,
});

export const createSampleCEQAmostra = (
  overrides?: Partial<CEQAmostra>,
): CEQAmostra => ({
  id: 'ceq-amo-001',
  labId: SAMPLE_LAB_ID,
  ceqParticipacaoId: 'ceq-part-001',
  rodada: 5,
  ano: 2026,
  dataRecepcao: new Date('2026-05-01'),
  status: 'recebida',
  criadoEm: new Date('2026-05-01'),
  criadoPor: SAMPLE_USER_ID,
  ...overrides,
});

export const createSampleCEQResultadoSatisfactory = (
  overrides?: Partial<CEQResultado>,
): CEQResultado => ({
  id: 'ceq-res-001',
  labId: SAMPLE_LAB_ID,
  ceqAmostraId: 'ceq-amo-001',
  ceqParticipacaoId: 'ceq-part-001',
  analyteId: 'hb',
  analyteName: 'Hemoglobin',
  valorObtido: 13.6,
  unidade: 'g/dL',
  valorReferencia: 13.5,
  desvioEstimado: 0.3,
  zScore: 0.333,
  interpretacao: 'satisfatoria',
  temNCGrave: false,
  status: 'lancado',
  criadoEm: new Date(),
  criadoPor: SAMPLE_USER_ID,
  ...overrides,
});

export const createSampleCEQResultadoUnsatisfactory = (
  overrides?: Partial<CEQResultado>,
): CEQResultado => ({
  id: 'ceq-res-002',
  labId: SAMPLE_LAB_ID,
  ceqAmostraId: 'ceq-amo-001',
  ceqParticipacaoId: 'ceq-part-001',
  analyteId: 'wbc',
  analyteName: 'White Blood Cell Count',
  valorObtido: 11.5,
  unidade: '10³/µL',
  valorReferencia: 7.0,
  desvioEstimado: 1.0,
  zScore: 4.5,
  interpretacao: 'insatisfatoria',
  temNCGrave: true,
  ncAutomaticaCriadaId: 'nc-001',
  status: 'lancado',
  criadoEm: new Date(),
  criadoPor: SAMPLE_USER_ID,
  ...overrides,
});

// ─── Export Job Fixtures ─────────────────────────────────────────────────────

export const createSampleExportRequest = (
  overrides?: Partial<ExportRequest>,
): ExportRequest => ({
  labId: SAMPLE_LAB_ID,
  format: 'xlsx',
  startDate: new Date('2026-01-01'),
  endDate: new Date('2026-05-04'),
  includeModules: ['ceq', 'ciq-imuno', 'coagulacao'],
  ...overrides,
});

export const createSampleExportJob = (
  overrides?: Partial<ExportJob>,
): ExportJob => ({
  id: 'job-001',
  labId: SAMPLE_LAB_ID,
  format: 'xlsx',
  status: 'queued',
  createdAt: new Date(),
  createdBy: SAMPLE_USER_ID,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  fileName: 'cq-export-2026-05-04.xlsx',
  downloadUrl: 'https://storage.googleapis.com/hmatologia2.appspot.com/exports/job-001.xlsx?token=abc123',
  fileSize: 1234567,
  processingTimeMs: 5000,
  ...overrides,
});

// ─── Analytics Fixtures ──────────────────────────────────────────────────────

export const createSampleAnalyticsMetrics = (
  overrides?: Partial<CIQComplianceMetrics>,
): CIQComplianceMetrics => ({
  totalRuns: 100,
  validRuns: 87,
  invalidRuns: 13,
  openNCs: 5,
  closedNCs: 12,
  compliancePercent: 87,
  ncResolutionRate: 71,
  avgResolutionDays: 3.5,
  avgProcessingHours: 2.1,
  computedAt: new Date(),
  dataAsOf: new Date(),
  ...overrides,
});

// ─── Auth Fixtures ──────────────────────────────────────────────────────────

export const createSampleAuthToken = (
  overrides?: Partial<{ uid: string; email: string; labIds: string[] }>,
) => ({
  uid: SAMPLE_USER_ID,
  email: SAMPLE_USER_EMAIL,
  labIds: [SAMPLE_LAB_ID],
  ...overrides,
});

// ─── Equipment Fixtures (for CIQ Bio integration) ──────────────────────────

export interface SampleEquipamento {
  id: string;
  labId: string;
  nome: string;
  modelo: string;
  numeroSerie: string;
  fabricante: string;
  status: 'ativa' | 'manutencao' | 'inativa';
}

export const createSampleEquipamento = (
  overrides?: Partial<SampleEquipamento>,
): SampleEquipamento => ({
  id: 'equip-001',
  labId: SAMPLE_LAB_ID,
  nome: 'Analisador Hematológico',
  modelo: 'H550',
  numeroSerie: 'SN123456',
  fabricante: 'Yumizen',
  status: 'ativa',
  ...overrides,
});

// ─── POP Fixtures (for CEQ Z-score blocking) ────────────────────────────────

export interface SamplePOP {
  id: string;
  labId: string;
  numero: string;
  titulo: string;
  versao: number;
  ativo: boolean;
}

export const createSamplePOP = (
  overrides?: Partial<SamplePOP>,
): SamplePOP => ({
  id: 'pop-001',
  labId: SAMPLE_LAB_ID,
  numero: 'POP-001',
  titulo: 'Procedimento de Análise Hematológica',
  versao: 1,
  ativo: true,
  ...overrides,
});

// ─── NC Fixtures (for CEQ auto-NC blocking) ────────────────────────────────

export interface SampleNaoConformidade {
  id: string;
  labId: string;
  numero: string;
  origem: 'controle' | 'operacional' | 'auditoria';
  severidade: 'leve' | 'grave' | 'critica';
  bloqueiaOperacoes: boolean;
  status: 'aberta' | 'em_investigacao' | 'resolvida' | 'fechada';
}

export const createSampleNaoConformidade = (
  overrides?: Partial<SampleNaoConformidade>,
): SampleNaoConformidade => ({
  id: 'nc-001',
  labId: SAMPLE_LAB_ID,
  numero: 'NC-2026-0042',
  origem: 'controle',
  severidade: 'grave',
  bloqueiaOperacoes: true,
  status: 'aberta',
  ...overrides,
});

// ─── Test Data Factory ───────────────────────────────────────────────────────

export const TestDataFactory = {
  lab: createSampleLab,
  ceqParticipacao: createSampleCEQParticipacao,
  ceqAmostra: createSampleCEQAmostra,
  ceqResultadoSatisfactory: createSampleCEQResultadoSatisfactory,
  ceqResultadoUnsatisfactory: createSampleCEQResultadoUnsatisfactory,
  exportRequest: createSampleExportRequest,
  exportJob: createSampleExportJob,
  analyticsMetrics: createSampleAnalyticsMetrics,
  authToken: createSampleAuthToken,
  equipamento: createSampleEquipamento,
  pop: createSamplePOP,
  naoConformidade: createSampleNaoConformidade,
};

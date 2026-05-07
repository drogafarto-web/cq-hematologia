/**
 * Phase 4 E2E Test Fixtures & Mock Data
 *
 * Centralized test data for Phase 4 critical flows:
 * - Test patients + auth links
 * - Test laudos + medical data
 * - Test RT/Auditor users
 * - NOTIVISA test payloads
 *
 * Usage:
 * ```ts
 * import { TEST_PATIENT, TEST_LAUDOS, NOTIVISA_PAYLOADS } from './phase-4-test-data';
 *
 * it('should...', () => {
 *   const patient = TEST_PATIENT.alice;
 *   // ...
 * });
 * ```
 */

import { Timestamp } from 'firebase/firestore';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST PATIENTS & AUTH DATA
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TEST_PATIENT = {
  alice: {
    id: 'pat_alice_001',
    email: 'alice@lab.test',
    nome: 'Alice Silva Santos',
    cpf: '123.456.789-00',
    dataNascimento: new Date('1990-05-15'),
    sexo: 'F' as const,
    telefone: '(11) 98765-4321',
    endereco: 'Rua dos Testes, 123 - São Paulo, SP',
  },
  bob: {
    id: 'pat_bob_001',
    email: 'bob@lab.test',
    nome: 'Roberto de Oliveira',
    cpf: '987.654.321-11',
    dataNascimento: new Date('1985-03-20'),
    sexo: 'M' as const,
    telefone: '(11) 99876-5432',
    endereco: 'Av. Principal, 456 - Rio de Janeiro, RJ',
  },
  carol: {
    id: 'pat_carol_001',
    email: 'carol@lab.test',
    nome: 'Carolina Mendes Costa',
    cpf: '456.789.123-22',
    dataNascimento: new Date('1988-12-10'),
    sexo: 'F' as const,
    telefone: '(11) 97654-3210',
    endereco: 'Rua das Flores, 789 - Belo Horizonte, MG',
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST USERS (RT, AUDITOR, ADMIN)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TEST_USER = {
  rt: {
    id: 'rt_user_001',
    email: 'rt@lab.test',
    nome: 'Dr. RT Silva',
    role: 'RT' as const,
    labId: 'lab_456',
    crm: 'CRM 123456/SP',
    assinatura: {
      hash: 'a'.repeat(64), // Mock SHA256
      operatorId: 'rt_user_001',
      ts: Timestamp.now(),
    },
  },
  auditor: {
    id: 'auditor_user_001',
    email: 'auditor@lab.test',
    nome: 'Dra. Auditora Santos',
    role: 'AUDITOR' as const,
    labId: 'lab_456',
    crm: 'CRM 654321/SP',
    assinatura: {
      hash: 'b'.repeat(64),
      operatorId: 'auditor_user_001',
      ts: Timestamp.now(),
    },
  },
  admin: {
    id: 'admin_user_001',
    email: 'admin@lab.test',
    nome: 'Administrador Lab',
    role: 'ADMIN' as const,
    labId: 'lab_456',
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST LAUDOS (Medical Reports)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TEST_LAUDO = {
  hemograma_alice_2026_05_07: {
    id: 'laudo_hem_alice_2026_05_07',
    patientId: TEST_PATIENT.alice.id,
    labId: 'lab_456',
    exame: {
      nome: 'Hemograma',
      codigo: 'HEM-001',
      tipoMaterial: 'Sangue total com EDTA',
      metodoAnalitico: 'Citometria de fluxo',
    },
    data: Timestamp.fromDate(new Date('2026-05-07T10:30:00')),
    status: 'finalizado' as const,
    criticoFlag: false,
    resultados: [
      {
        analito: 'Hemoglobina',
        valor: 14.5,
        unidade: 'g/dL',
        referencia: '12.0-16.0',
        status: 'normal',
      },
      {
        analito: 'Hematócrito',
        valor: 43.5,
        unidade: '%',
        referencia: '36-46',
        status: 'normal',
      },
      {
        analito: 'Leucócitos',
        valor: 7.2,
        unidade: 'mil/µL',
        referencia: '4.5-11.0',
        status: 'normal',
      },
      {
        analito: 'Plaquetas',
        valor: 250,
        unidade: 'mil/µL',
        referencia: '150-400',
        status: 'normal',
      },
    ],
    rtNome: TEST_USER.rt.nome,
    rtRegistro: TEST_USER.rt.crm,
    assinatura: TEST_USER.rt.assinatura,
    criadoEm: Timestamp.fromDate(new Date('2026-05-07T09:15:00')),
    publicado: true,
  },

  bioquimica_bob_2026_05_05: {
    id: 'laudo_bioquim_bob_2026_05_05',
    patientId: TEST_PATIENT.bob.id,
    labId: 'lab_456',
    exame: {
      nome: 'Bioquímica Básica',
      codigo: 'BIOQUIM-002',
      tipoMaterial: 'Soro',
      metodoAnalitico: 'Espectrofotometria',
    },
    data: Timestamp.fromDate(new Date('2026-05-05T14:20:00')),
    status: 'finalizado' as const,
    criticoFlag: true,
    classification: 'bloqueio-critico',
    resultados: [
      {
        analito: 'Glicose',
        valor: 42,
        unidade: 'mg/dL',
        referencia: '70-100',
        status: 'critico',
        critico: true,
      },
      {
        analito: 'Creatinina',
        valor: 1.2,
        unidade: 'mg/dL',
        referencia: '0.7-1.3',
        status: 'normal',
      },
    ],
    rtNome: TEST_USER.rt.nome,
    rtRegistro: TEST_USER.rt.crm,
    assinatura: TEST_USER.rt.assinatura,
    criadoEm: Timestamp.fromDate(new Date('2026-05-05T13:00:00')),
    publicado: true,
  },

  coagulacao_carol_2026_04_28: {
    id: 'laudo_coag_carol_2026_04_28',
    patientId: TEST_PATIENT.carol.id,
    labId: 'lab_456',
    exame: {
      nome: 'Coagulação',
      codigo: 'COAG-001',
      tipoMaterial: 'Plasma citratado',
      metodoAnalitico: 'TP Reativo',
    },
    data: Timestamp.fromDate(new Date('2026-04-28T11:45:00')),
    status: 'finalizado' as const,
    criticoFlag: false,
    resultados: [
      {
        analito: 'TP (INR)',
        valor: 1.1,
        unidade: 'INR',
        referencia: '0.8-1.1',
        status: 'normal',
      },
      {
        analito: 'TTPA',
        valor: 28,
        unidade: 'seg',
        referencia: '24-36',
        status: 'normal',
      },
      {
        analito: 'Fibrinogênio',
        valor: 320,
        unidade: 'mg/dL',
        referencia: '200-400',
        status: 'normal',
      },
    ],
    rtNome: TEST_USER.rt.nome,
    rtRegistro: TEST_USER.rt.crm,
    assinatura: TEST_USER.rt.assinatura,
    criadoEm: Timestamp.fromDate(new Date('2026-04-28T10:30:00')),
    publicado: true,
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * TEST NOTIVISA PAYLOADS (Government Submission)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const NOTIVISA_PAYLOAD = {
  valid_malaria: {
    versao: '1.0',
    tipoRegistro: 'RESULTADO',
    codigoDoenca: 'B54', // Malaria (ICD-10)
    dataDoencaAcometimento: '2026-05-01',
    pacienteCpf: TEST_PATIENT.alice.cpf,
    pacienteNome: TEST_PATIENT.alice.nome,
    pacienteSexo: TEST_PATIENT.alice.sexo,
    pacienteDataNascimento: '1990-05-15',
    resultado: 'POSITIVO',
    laboratorioNome: 'Lab Test',
    laboratorioNomeFantasia: 'Lab de Testes',
    laboratorioCNES: '1234567',
    profissionalNomeAssinante: TEST_USER.rt.nome,
    profissionalCRM: TEST_USER.rt.crm,
    dataResultado: '2026-05-07',
    horaResultado: '10:30',
  },

  valid_leukemia: {
    versao: '1.0',
    tipoRegistro: 'RESULTADO',
    codigoDoenca: 'C91.0', // Acute lymphoid leukemia (ICD-10)
    dataDoencaAcometimento: '2026-04-15',
    pacienteCpf: TEST_PATIENT.bob.cpf,
    pacienteNome: TEST_PATIENT.bob.nome,
    pacienteSexo: TEST_PATIENT.bob.sexo,
    pacienteDataNascimento: '1985-03-20',
    resultado: 'POSITIVO',
    laboratorioNome: 'Lab Test',
    laboratorioNomeFantasia: 'Lab de Testes',
    laboratorioCNES: '1234567',
    profissionalNomeAssinante: TEST_USER.rt.nome,
    profissionalCRM: TEST_USER.rt.crm,
    dataResultado: '2026-05-05',
    horaResultado: '14:20',
  },

  invalid_missing_doenca: {
    versao: '1.0',
    tipoRegistro: 'RESULTADO',
    // codigoDoenca missing — invalid
    pacienteCpf: TEST_PATIENT.carol.cpf,
    pacienteNome: TEST_PATIENT.carol.nome,
    resultado: 'POSITIVO',
  },

  invalid_bad_cpf: {
    versao: '1.0',
    tipoRegistro: 'RESULTADO',
    codigoDoenca: 'B54',
    pacienteCpf: 'invalid-cpf',
    pacienteNome: TEST_PATIENT.alice.nome,
    resultado: 'POSITIVO',
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTIVISA DRAFT STATES (for queue testing)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const NOTIVISA_DRAFT = {
  draft_alice_hemograma: {
    id: 'draft_f47ac10b58cc4372a567',
    patientId: TEST_PATIENT.alice.id,
    laudoId: TEST_LAUDO.hemograma_alice_2026_05_07.id,
    status: 'draft' as const,
    payload: NOTIVISA_PAYLOAD.valid_malaria,
    createdBy: TEST_USER.rt.id,
    createdAt: Timestamp.fromDate(new Date('2026-05-07T11:00:00')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-07T11:00:00')),
  },

  approved_bob_bioquimica: {
    id: 'draft_a1b2c3d4e5f6g7h8i9j0',
    patientId: TEST_PATIENT.bob.id,
    laudoId: TEST_LAUDO.bioquimica_bob_2026_05_05.id,
    status: 'approved' as const,
    payload: NOTIVISA_PAYLOAD.valid_leukemia,
    createdBy: TEST_USER.rt.id,
    approvedBy: TEST_USER.auditor.id,
    approvedAt: Timestamp.fromDate(new Date('2026-05-05T15:30:00')),
    auditSignature: {
      hash: 'b'.repeat(64),
      operatorId: TEST_USER.auditor.id,
      ts: Timestamp.fromDate(new Date('2026-05-05T15:30:00')),
    },
    createdAt: Timestamp.fromDate(new Date('2026-05-05T14:45:00')),
    updatedAt: Timestamp.fromDate(new Date('2026-05-05T15:30:00')),
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * NOTIVISA QUEUE ENTRIES (Submission tracking)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const NOTIVISA_QUEUE = {
  pending_submission: {
    id: 'queue_queue123abc',
    patientId: TEST_PATIENT.alice.id,
    draftId: NOTIVISA_DRAFT.draft_alice_hemograma.id,
    status: 'pending' as const,
    createdAt: Timestamp.fromDate(new Date('2026-05-07T11:15:00')),
    submittedAt: null,
    acknowledgedAt: null,
    apiAttempts: 0,
    nextRetry: Timestamp.fromDate(new Date('2026-05-07T11:20:00')),
  },

  submitted_awaiting_ack: {
    id: 'queue_queue456def',
    patientId: TEST_PATIENT.bob.id,
    draftId: NOTIVISA_DRAFT.approved_bob_bioquimica.id,
    status: 'submitted' as const,
    createdAt: Timestamp.fromDate(new Date('2026-05-05T15:45:00')),
    submittedAt: Timestamp.fromDate(new Date('2026-05-05T16:00:00')),
    acknowledgedAt: null,
    apiAttempts: 1,
    lastApiResponse: {
      statusCode: '200',
      receiptCode: 'ANVISA-REC-2026-0001',
      timestamp: new Date('2026-05-05T16:00:05'),
    },
    nextRetry: null,
  },

  acknowledged: {
    id: 'queue_queue789ghi',
    patientId: TEST_PATIENT.carol.id,
    draftId: 'draft_carol_coagulacao',
    status: 'acknowledged' as const,
    createdAt: Timestamp.fromDate(new Date('2026-04-28T12:00:00')),
    submittedAt: Timestamp.fromDate(new Date('2026-04-28T12:10:00')),
    acknowledgedAt: Timestamp.fromDate(new Date('2026-04-28T12:25:00')),
    apiAttempts: 1,
    lastApiResponse: {
      statusCode: '200',
      receiptCode: 'ANVISA-REC-2026-0002',
      timestamp: new Date('2026-04-28T12:10:05'),
    },
    webhookAck: {
      receiptCode: 'ANVISA-REC-2026-0002',
      status: 'acknowledged',
      timestamp: new Date('2026-04-28T12:25:00'),
    },
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK LAB CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const TEST_LAB = {
  labclin: {
    id: 'lab_456',
    nome: 'Lab Clínico de Testes',
    nomeAbreviado: 'LCT',
    cnpj: '12.345.678/0001-99',
    cnes: '1234567',
    endereco: 'Av. Principal, 1000 - São Paulo, SP',
    telefone: '(11) 3333-4444',
    email: 'contato@labclin.test',
    notivisaConfig: {
      enabled: true,
      apiEndpoint: 'https://sandbox.notivisa.test/api',
      credentials: {
        usuario: 'lab_teste',
        senha: 'encrypted_password',
      },
    },
  },
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * BATCH GENERATORS (for stress/pagination testing)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function generateTestLaudos(patientId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `laudo_bulk_${patientId}_${i}`,
    patientId,
    labId: 'lab_456',
    exame: {
      nome: ['Hemograma', 'Bioquímica', 'Coagulação', 'Uroanálise'][i % 4],
      codigo: `EXAM-${String(i).padStart(3, '0')}`,
    },
    data: Timestamp.fromDate(
      new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    ),
    status: ['finalizado', 'revisão', 'bloqueado'][i % 3],
    publicado: true,
    resultados: [],
    criadoEm: Timestamp.now(),
  }));
}

export function generateNotivisaPayloads(count: number) {
  const diseases = ['B54', 'C91.0', 'A15.0', 'B20', 'J15.9'];
  return Array.from({ length: count }, (_, i) => ({
    versao: '1.0',
    tipoRegistro: 'RESULTADO',
    codigoDoenca: diseases[i % diseases.length],
    dataDoencaAcometimento: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    pacienteCpf: `${String(i).padStart(3, '0')}.456.789-00`,
    pacienteNome: `Patient ${i}`,
    resultado: i % 2 === 0 ? 'POSITIVO' : 'NEGATIVO',
    laboratorioNome: TEST_LAB.labclin.nome,
    laboratorioCNES: TEST_LAB.labclin.cnes,
    profissionalNomeAssinante: TEST_USER.rt.nome,
    profissionalCRM: TEST_USER.rt.crm,
    dataResultado: new Date().toISOString().split('T')[0],
  }));
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EXPORT SUMMARY
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Fixtures included:
 * - 3 test patients (alice, bob, carol)
 * - 3 test users (RT, Auditor, Admin)
 * - 3 complete test laudos (Hemograma, Bioquímica, Coagulação)
 * - 4 NOTIVISA payloads (2 valid, 2 invalid)
 * - 2 NOTIVISA draft states (draft, approved)
 * - 3 NOTIVISA queue entries (pending, submitted, acknowledged)
 * - Test lab config
 * - Batch generators for stress testing
 *
 * All timestamps use Firebase Timestamp format.
 * All CPF/CRM/ID values are test fixtures, not real data.
 */

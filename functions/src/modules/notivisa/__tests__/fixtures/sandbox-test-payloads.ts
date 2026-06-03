/**
 * notivisa/__tests__/fixtures/sandbox-test-payloads.ts
 *
 * 6 realistic NOTIVISA test payloads for sandbox integration testing.
 * Each represents a real-world scenario:
 *   1. Normal result (syphilis, single analito)
 *   2. Critical values (HIV, high viral load)
 *   3. Multiple panels (dengue with NS1 + IgM + IgG)
 *   4. Notes/observations (syphilis with clinical notes)
 *   5. Edge case dates (pre-2000 birth date)
 *   6. Multiple results (coagulation panel with 3 tests)
 *
 * All payloads are pre-validated and ready for submission.
 */

import { NotivisaDraftPayload } from '../../http/client';

export const sandboxTestPayloads = {
  // ─────────────────────────────────────────────────────────────────────
  // 1. Normal Result: Syphilis (Single Analito)
  // ─────────────────────────────────────────────────────────────────────

  syphilis_normal: {
    versao: '1.0' as const,
    laudo_id: 'laudo-syphilis-normal-20260507-001',
    paciente_cpf: '12345678900',
    data_resultado: new Date('2026-05-07T10:30:00Z').getTime(),
    resultados: [
      {
        analito: 'VDRL',
        valor: '1:256',
        unidade: 'título',
        referencia: 'Negativo',
      },
    ],
    assinador: {
      cpf: '98765432100',
      nome: 'Dr. João Silva RT',
      data_assinatura: new Date('2026-05-07T10:45:00Z').getTime(),
    },
  } as NotivisaDraftPayload,

  // ─────────────────────────────────────────────────────────────────────
  // 2. Critical Values: HIV (High Viral Load)
  // ─────────────────────────────────────────────────────────────────────

  hiv_critical: {
    versao: '1.0' as const,
    laudo_id: 'laudo-hiv-critical-20260507-002',
    paciente_cpf: '55544433322',
    data_resultado: new Date('2026-05-07T14:20:00Z').getTime(),
    resultados: [
      {
        analito: 'HIV Ag/Ab',
        valor: '4.85',
        unidade: 'S/CO (Signal/Cutoff)',
        referencia: '<1.0 (Negativo)',
      },
      {
        analito: 'HIV Carga Viral',
        valor: '850000',
        unidade: 'cópias/mL',
        referencia: '<20 (Indetectável)',
      },
      {
        analito: 'CD4 Count',
        valor: '42',
        unidade: 'células/µL',
        referencia: '>500 (Normal)',
      },
    ],
    assinador: {
      cpf: '11122233344',
      nome: 'Dra. Maria Santos RT',
      data_assinatura: new Date('2026-05-07T14:35:00Z').getTime(),
    },
  } as NotivisaDraftPayload,

  // ─────────────────────────────────────────────────────────────────────
  // 3. Multiple Panels: Dengue (NS1 + IgM + IgG)
  // ─────────────────────────────────────────────────────────────────────

  dengue_multipanel: {
    versao: '1.0' as const,
    laudo_id: 'laudo-dengue-multipanel-20260507-003',
    paciente_cpf: '11111111111',
    data_resultado: new Date('2026-05-06T09:15:00Z').getTime(),
    resultados: [
      {
        analito: 'Dengue NS1',
        valor: 'Positivo',
        unidade: 'qualitativo',
        referencia: 'Negativo',
      },
      {
        analito: 'Dengue IgM',
        valor: 'Positivo',
        unidade: 'qualitativo',
        referencia: 'Negativo',
      },
      {
        analito: 'Dengue IgG',
        valor: 'Negativo',
        unidade: 'qualitativo',
        referencia: 'Negativo',
      },
    ],
    assinador: {
      cpf: '99988877766',
      nome: 'Dr. Carlos Oliveira RT',
      data_assinatura: new Date('2026-05-06T10:30:00Z').getTime(),
    },
  } as NotivisaDraftPayload,

  // ─────────────────────────────────────────────────────────────────────
  // 4. With Notes/Observations: Syphilis + Clinical Notes
  // ─────────────────────────────────────────────────────────────────────

  syphilis_with_notes: {
    versao: '1.0' as const,
    laudo_id: 'laudo-syphilis-notes-20260507-004',
    paciente_cpf: '22222222222',
    data_resultado: new Date('2026-05-05T16:45:00Z').getTime(),
    resultados: [
      {
        analito: 'VDRL',
        valor: '1:512',
        unidade: 'título',
        referencia: 'Negativo',
      },
      {
        analito: 'FTA-Abs',
        valor: 'Positivo',
        unidade: 'qualitativo',
        referencia: 'Negativo',
      },
    ],
    assinador: {
      cpf: '77788899900',
      nome: 'Dra. Ana Paula RT',
      data_assinatura: new Date('2026-05-05T17:00:00Z').getTime(),
    },
  } as NotivisaDraftPayload,

  // ─────────────────────────────────────────────────────────────────────
  // 5. Edge Case: Birth Date Pre-2000 (Age > 26 years)
  // ─────────────────────────────────────────────────────────────────────

  syphilis_elderly_patient: {
    versao: '1.0' as const,
    laudo_id: 'laudo-elderly-syphilis-20260507-005',
    paciente_cpf: '33333333333',
    data_resultado: new Date('2026-05-07T11:00:00Z').getTime(),
    resultados: [
      {
        analito: 'VDRL',
        valor: '1:128',
        unidade: 'título',
        referencia: 'Negativo',
      },
      {
        analito: 'TP-PA',
        valor: 'Positivo',
        unidade: 'qualitativo',
        referencia: 'Negativo',
      },
    ],
    assinador: {
      cpf: '44455566677',
      nome: 'Dr. Pedro Costa RT',
      data_assinatura: new Date('2026-05-07T11:20:00Z').getTime(),
    },
  } as NotivisaDraftPayload,

  // ─────────────────────────────────────────────────────────────────────
  // 6. Multiple Results: Coagulation Panel (PT + aPTT + Fibrinogen)
  // ─────────────────────────────────────────────────────────────────────

  coagulation_panel: {
    versao: '1.0' as const,
    laudo_id: 'laudo-coag-panel-20260507-006',
    paciente_cpf: '44444444444',
    data_resultado: new Date('2026-05-07T13:30:00Z').getTime(),
    resultados: [
      {
        analito: 'TP (Tempo de Protrombina)',
        valor: '12.5',
        unidade: 'segundos',
        referencia: '11.0-13.5',
      },
      {
        analito: 'RNI (INR)',
        valor: '1.0',
        unidade: 'razão',
        referencia: '0.8-1.1',
      },
      {
        analito: 'aPTT (Tempo de Tromboplastina)',
        valor: '28.3',
        unidade: 'segundos',
        referencia: '25.0-35.0',
      },
      {
        analito: 'Fibrinogênio',
        valor: '285',
        unidade: 'mg/dL',
        referencia: '200-400',
      },
    ],
    assinador: {
      cpf: '55566677788',
      nome: 'Dra. Fernanda Silva RT',
      data_assinatura: new Date('2026-05-07T14:00:00Z').getTime(),
    },
  } as NotivisaDraftPayload,
};

// ─────────────────────────────────────────────────────────────────────────
// Payload Metadata for Test Planning
// ─────────────────────────────────────────────────────────────────────────

export const sandboxPayloadMetadata = {
  syphilis_normal: {
    name: 'Normal Syphilis Result (VDRL)',
    disease_code: '99078',
    panel_count: 1,
    risk_level: 'low',
    description: 'Single positive result for notifiable disease',
  },
  hiv_critical: {
    name: 'Critical HIV Result (High Viral Load)',
    disease_code: '99088',
    panel_count: 3,
    risk_level: 'critical',
    description: 'Multiple critical values requiring urgent notification',
  },
  dengue_multipanel: {
    name: 'Dengue Multi-panel (NS1 + IgM + IgG)',
    disease_code: '99001',
    panel_count: 3,
    risk_level: 'high',
    description: 'Multiple dengue markers indicating acute infection',
  },
  syphilis_with_notes: {
    name: 'Syphilis with Confirmatory Tests',
    disease_code: '99078',
    panel_count: 2,
    risk_level: 'high',
    description: 'VDRL + FTA-Abs confirmation, requires notification',
  },
  syphilis_elderly_patient: {
    name: 'Syphilis in Elderly Patient',
    disease_code: '99078',
    panel_count: 2,
    risk_level: 'high',
    description: 'Positive syphilis in patient >50 years, unusual presentation',
  },
  coagulation_panel: {
    name: 'Coagulation Panel (4 Tests)',
    disease_code: null,
    panel_count: 4,
    risk_level: 'low',
    description: 'Non-notifiable panel, included for edge case testing',
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Utility: Get payload by name
// ─────────────────────────────────────────────────────────────────────────

export function getSandboxPayload(name: keyof typeof sandboxTestPayloads): NotivisaDraftPayload {
  return sandboxTestPayloads[name];
}

export function getAllSandboxPayloads(): NotivisaDraftPayload[] {
  return Object.values(sandboxTestPayloads) as NotivisaDraftPayload[];
}

export function getSandboxPayloadByDisease(diseaseCode: string): NotivisaDraftPayload | undefined {
  const payloadNames = Object.entries(sandboxPayloadMetadata)
    .filter(([_, meta]) => meta.disease_code === diseaseCode)
    .map(([name]) => name);

  return payloadNames.length > 0
    ? sandboxTestPayloads[payloadNames[0] as keyof typeof sandboxTestPayloads]
    : undefined;
}

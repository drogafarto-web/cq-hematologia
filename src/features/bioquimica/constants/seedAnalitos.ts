/**
 * bioquimica/constants/seedAnalitos.ts
 *
 * 17 analitos seed carregados pela Cloud Function `seedBioquimicaDefaults`
 * na primeira ativação do módulo por lab. Idempotente — query por
 * `seedDefault: true` evita duplicação.
 *
 * Cobertura clínica:
 *   - Painel básico:   Glicose, Ureia, Creatinina
 *   - Painel hepático: TGO, TGP, FA, GGT, BT-D, BT-I
 *   - Painel lipídico: CT, HDL, LDL, TG
 *   - Eletrólitos:     Na, K, Cl, Ca
 *
 * Range biológico = adultos saudáveis de referência (média de bulas
 * comerciais brasileiras 2024–2026 — Bioclin, Labtest, Wiener). Lab pode
 * customizar via UI admin sem refazer release.
 *
 * CV alvo segue PACS-CIQ (BR) e CLSI EP15 — limites superiores aceitos para
 * imprecisão analítica no nível clínico de decisão.
 *
 * Fontes consultadas:
 *   - Bioclin · Catálogo 2025 (rangeBiologico + método)
 *   - PACS-CIQ 2024 (cvAlvo)
 *   - DICQ 4.3 Bloco F 5.5.1.1 (registro de método)
 */

import type { AnalitoInput } from '../types';

export const SEED_ANALITOS_BIOQUIMICA: ReadonlyArray<AnalitoInput> = [
  // ── Painel básico ───────────────────────────────────────────────────────
  {
    nome: 'Glicose',
    sigla: 'GLI',
    unidade: 'mg/dL',
    unidadeSI: 'mmol/L',
    rangeBiologico: { min: 70, max: 99 },
    metodo: 'Hexoquinase',
    cvAlvo: 2.5,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Ureia',
    sigla: 'URE',
    unidade: 'mg/dL',
    rangeBiologico: { min: 17, max: 49 },
    metodo: 'Urease UV',
    cvAlvo: 3.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Creatinina',
    sigla: 'CRE',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0.6, max: 1.3 },
    metodo: 'Jaffé Cinético',
    cvAlvo: 4.0,
    ativo: true,
    seedDefault: true,
  },

  // ── Painel hepático ─────────────────────────────────────────────────────
  {
    nome: 'TGO/AST',
    sigla: 'TGO',
    unidade: 'U/L',
    rangeBiologico: { min: 5, max: 40 },
    metodo: 'IFCC sem piridoxal',
    cvAlvo: 5.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'TGP/ALT',
    sigla: 'TGP',
    unidade: 'U/L',
    rangeBiologico: { min: 5, max: 41 },
    metodo: 'IFCC sem piridoxal',
    cvAlvo: 5.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Fosfatase Alcalina',
    sigla: 'FA',
    unidade: 'U/L',
    rangeBiologico: { min: 40, max: 129 },
    metodo: 'IFCC (AMP)',
    cvAlvo: 4.5,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'GGT',
    sigla: 'GGT',
    unidade: 'U/L',
    rangeBiologico: { min: 8, max: 61 },
    metodo: 'Szasz/IFCC',
    cvAlvo: 6.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Bilirrubina Direta',
    sigla: 'BT-D',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 0.3 },
    metodo: 'Diazo (Sims-Horn)',
    cvAlvo: 8.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Bilirrubina Indireta',
    sigla: 'BT-I',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0.1, max: 1.0 },
    metodo: 'Calculado (Total − Direta)',
    cvAlvo: 8.0,
    ativo: true,
    seedDefault: true,
  },

  // ── Painel lipídico ─────────────────────────────────────────────────────
  {
    nome: 'Colesterol Total',
    sigla: 'CT',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 199 },
    metodo: 'CHOD-PAP',
    cvAlvo: 3.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'HDL Colesterol',
    sigla: 'HDL',
    unidade: 'mg/dL',
    rangeBiologico: { min: 40, max: 999 },
    metodo: 'Direto (homogêneo)',
    cvAlvo: 4.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'LDL Colesterol',
    sigla: 'LDL',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 129 },
    metodo: 'Direto / Friedewald',
    cvAlvo: 4.5,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Triglicerídeos',
    sigla: 'TG',
    unidade: 'mg/dL',
    rangeBiologico: { min: 0, max: 150 },
    metodo: 'GPO-PAP',
    cvAlvo: 4.0,
    ativo: true,
    seedDefault: true,
  },

  // ── Eletrólitos ─────────────────────────────────────────────────────────
  {
    nome: 'Sódio',
    sigla: 'Na',
    unidade: 'mEq/L',
    unidadeSI: 'mmol/L',
    rangeBiologico: { min: 136, max: 145 },
    metodo: 'ISE',
    cvAlvo: 1.5,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Potássio',
    sigla: 'K',
    unidade: 'mEq/L',
    unidadeSI: 'mmol/L',
    rangeBiologico: { min: 3.5, max: 5.0 },
    metodo: 'ISE',
    cvAlvo: 2.0,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Cloro',
    sigla: 'Cl',
    unidade: 'mEq/L',
    unidadeSI: 'mmol/L',
    rangeBiologico: { min: 98, max: 107 },
    metodo: 'ISE',
    cvAlvo: 1.5,
    ativo: true,
    seedDefault: true,
  },
  {
    nome: 'Cálcio Total',
    sigla: 'Ca',
    unidade: 'mg/dL',
    rangeBiologico: { min: 8.6, max: 10.2 },
    metodo: 'Arsenazo III / OCP',
    cvAlvo: 2.5,
    ativo: true,
    seedDefault: true,
  },
] as const;

/** Total esperado pós-seed em lab limpo. Validação cross-check em testes. */
export const SEED_ANALITOS_COUNT = SEED_ANALITOS_BIOQUIMICA.length;

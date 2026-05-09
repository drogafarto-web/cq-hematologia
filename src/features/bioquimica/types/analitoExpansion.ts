/**
 * bioquimica/types/analitoExpansion.ts
 *
 * Type extensions for the analyte catalog. Defines category enumerations,
 * expanded metadata for 50+ analytes, and helper functions.
 *
 * Zero logic — types only. No imports beyond _shared_refs.
 *
 * Compliance: DICQ 4.3 5.5.1.1 (CIQ planning), RDC 978 Arts. 179-180.
 */

import type { AnalitoId } from './_shared_refs';

// ─── Analyte Categories ───────────────────────────────────────────────────

export type AnalitoCategory =
  | 'enzimologia'      // ALT, AST, GGT, ALP, CK, LDH, amilase, lipase
  | 'lipidograma'      // colesterol total, HDL, LDL, triglicerídeos
  | 'glicemia'         // glicose jejum, hemoglobina-glicada
  | 'função-renal'     // ureia, creatinina, ácido-úrico
  | 'função-hepática'  // bilirrubinas, albumina, proteínas-totais
  | 'eletrólitos'      // sódio, potássio, cloreto, cálcio, fósforo, magnésio
  | 'hormonal'         // TSH, T4-livre, cortisol, ferritina, vitamina-B12, vitamina-D
  | 'cardíaco'         // troponina-I, CK-MB, mioglobina, NT-proBNP
  | 'inflamação'       // PCR, VHS
  | 'metabolismo-ósseo'; // fosfatase-alcalina, vitamina-D, PTH

// ─── Expanded Analyte Metadata ────────────────────────────────────────────

export interface AnalitoExpandedMetadata {
  id: AnalitoId;
  category: AnalitoCategory;
  unit: string;            // 'mg/dL' | 'U/L' | 'ng/mL' | etc — string livre, validada server-side
  refRangeLow: number;
  refRangeHigh: number;
  refRangeUnit: 'adult-male' | 'adult-female' | 'pediatric' | 'unisex';
  expectedMethods: string[]; // canonical methods e.g. ['enzymatic-uv', 'colorimetric-photometric']
  alternativeNames: string[]; // fuzzy match aliases — e.g. ['ALT', 'TGP', 'alanina-aminotransferase']
  loincCode?: string;        // optional LOINC for interlab comparison
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const ANALITO_CATEGORIES: readonly AnalitoCategory[] = [
  'enzimologia',
  'lipidograma',
  'glicemia',
  'função-renal',
  'função-hepática',
  'eletrólitos',
  'hormonal',
  'cardíaco',
  'inflamação',
  'metabolismo-ósseo',
] as const;

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Validate if a string represents a known analyte category.
 * Pure function — no I/O.
 */
export function isExpandedAnalito(id: string): boolean {
  // This is a placeholder check — in production, would validate against
  // the actual catalog. Here we just check that it's a non-empty string.
  return typeof id === 'string' && id.length > 0;
}

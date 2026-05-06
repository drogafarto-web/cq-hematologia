/**
 * bioquimica/types/controlMaterial.ts
 *
 * Schema do material de controle (lote) bioquímico. Suporta multi-instrumento
 * desde o dia 1 (1 lote vinculado a N equipamentos) e 3 caminhos de origem:
 *
 *   - `bula`        — bula PDF parseada via Gemini Vision; `manufacturerStats`
 *                     populado por analito × nível.
 *   - `sem-bula-7d` — controle chegou antes da bula (lag típico Controllab
 *                     ≤7 dias). `bulaPendente: true`, Westgard suspenso até
 *                     `applyBulaToLot` chegar.
 *   - `avulso`     — lote cadastrado manualmente sem bula esperada (dev/teste).
 *
 * RDC 978/2025 Art. 181 — amostras controle devem ter rastreabilidade.
 * DICQ 4.3 Bloco F 5.5.2 — registros de origem do material de controle.
 *
 * Multi-tenant: `labId` redundante; soft-delete only (RN-06).
 */

import type { Timestamp } from '../../../shared/services/firebase';
import type { AnalitoId, EquipmentId, LabId, NivelId } from './_shared_refs';

// ─── Nível de controle ────────────────────────────────────────────────────
//
// Cada lote tem 1-3 níveis (typically Normal + Patológico ± Crítico).
// `id` é estável dentro do lote (slug curto) — NUNCA renomear após criar
// runs, sob risco de orfanizar resultados históricos.

export interface ControlLevel {
  readonly id: NivelId;
  readonly nome: string;
  readonly descricao?: string;
}

// ─── Stats de fabricante por par (analitoId, nivelId) ─────────────────────

export interface AnalyteLevelStat {
  readonly mean: number;
  readonly sd: number;
}

/**
 * Map aninhado: `manufacturerStats[analitoId][nivelId] = { mean, sd }`.
 * `null` quando lote está em `bulaPendente: true` — recomputado quando
 * `applyBulaToLot` resolve a bula.
 */
export type ManufacturerStatsBio = Record<AnalitoId, Record<NivelId, AnalyteLevelStat>>;

// ─── Origem do lote ────────────────────────────────────────────────────────

export type ControlMaterialOrigem = 'bula' | 'sem-bula-7d' | 'avulso';

// ─── ControlMaterial ──────────────────────────────────────────────────────

export interface ControlMaterial {
  readonly id: string;
  readonly labId: LabId;

  /** Multi-instrumento: 1+ equipamentos por lote (FK em `/equipamentos`). */
  readonly equipmentIds: readonly EquipmentId[];

  readonly fornecedor: string;
  readonly lote: string;
  readonly validade: Timestamp;

  /** 1-3 níveis (ordem fixa após criação — não mexer em níveis usados em runs). */
  readonly niveis: readonly ControlLevel[];

  /**
   * `true` quando lote aguarda bula. Westgard fica suspenso e
   * `manufacturerStats` é `null` até `applyBulaToLot` resolver. Derivado de
   * `manufacturerStats == null && origem != 'avulso'` mas mantido explícito
   * para queries e UI (badges/banners).
   */
  readonly bulaPendente: boolean;

  /** URL do PDF da bula em Storage (se origem === 'bula' e foi anexado). */
  readonly bulaPdfUrl?: string;

  /** `null` enquanto `bulaPendente` ou `origem === 'avulso'`. */
  readonly manufacturerStats: ManufacturerStatsBio | null;

  readonly origem: ControlMaterialOrigem;

  /**
   * Encerramento manual (substituído por bula nova antes do vencimento).
   * Move o lote para HISTÓRICO em `groupByStatus` — distinto de `validade`
   * (data impressa).
   */
  readonly archivedAt?: Timestamp;

  readonly criadoEm: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

/**
 * Input DTO — service é a única fonte de `id`, `labId`, `criadoEm` e
 * `deletadoEm`. `bulaPendente` e `manufacturerStats` são derivados de
 * `origem` no service.
 */
export type ControlMaterialInput = Omit<
  ControlMaterial,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm'
>;

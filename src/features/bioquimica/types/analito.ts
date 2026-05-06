/**
 * bioquimica/types/analito.ts
 *
 * Schema do analito bioquímico — unidade de medida atômica do módulo.
 * Cada analito (Glicose, Ureia, etc.) tem range biológico, método e CV alvo
 * próprios. Lab pode customizar seeds via UI admin (`seedDefault: true`
 * marca os analitos carregados pela Cloud Function, mas todos são editáveis).
 *
 * RDC 978/2025 Art. 179 — CIQ obrigatório com critérios definidos por analito.
 * DICQ 4.3 Bloco F (Analítico) 5.5.1.1 — descrição de método e parâmetros.
 *
 * Multi-tenant: `labId` redundante; soft-delete only (RN-06).
 */

import type { Timestamp } from '../../../shared/services/firebase';
import type { LabId } from './_shared_refs';

// ─── Range biológico ──────────────────────────────────────────────────────

export interface RangeBiologico {
  readonly min: number;
  readonly max: number;
}

// ─── Analito ──────────────────────────────────────────────────────────────

export interface Analito {
  readonly id: string;
  readonly labId: LabId;

  /** Nome de exibição (ex: "Glicose"). */
  readonly nome: string;
  /** Sigla curta para tabelas com `tabular-nums` (ex: "GLI"). */
  readonly sigla?: string;

  /** Unidade convencional pt-BR (ex: "mg/dL", "U/L", "mEq/L"). */
  readonly unidade: string;
  /** Unidade SI opcional (ex: "mmol/L"). */
  readonly unidadeSI?: string;

  /** Range biológico de referência — adultos saudáveis. */
  readonly rangeBiologico: RangeBiologico;

  /** Método analítico (ex: "Hexoquinase", "ISE", "Espectrofotometria UV"). */
  readonly metodo?: string;

  /**
   * CV alvo em percentual (ex: 2.5 para 2.5%). Usado como threshold de alerta
   * em LeveyJenningsChart e relatórios mensais. Não confundir com regras
   * Westgard — CV é métrica de tendência, Westgard é gate de aceite.
   */
  readonly cvAlvo?: number;

  /** Master switch — `false` esconde o analito de runs sem afetar histórico. */
  readonly ativo: boolean;

  /**
   * `true` quando o analito veio do seed `seedBioquimicaDefaults`. Lab pode
   * editar (override) ou desativar — flag persiste para distinguir custom
   * 100% do lab vs. customização sobre seed (relevante em telemetria
   * de adoção e merge de updates de seed em versões futuras).
   */
  readonly seedDefault: boolean;

  readonly criadoEm: Timestamp;
  readonly deletadoEm: Timestamp | null;
}

/**
 * Input DTO — service é a única fonte de `id`, `labId`, `criadoEm` e
 * `deletadoEm`. Nunca aceitar esses campos no payload do client.
 */
export type AnalitoInput = Omit<Analito, 'id' | 'labId' | 'criadoEm' | 'deletadoEm'>;

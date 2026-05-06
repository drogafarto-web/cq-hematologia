/**
 * Sugestao Domain Types
 *
 * Suggestion/Improvement module per DICQ 4.14.4.
 * Separate from complaints — simpler workflow, public + internal surfaces.
 * Multi-tenant: `/labs/{labId}/sugestoes/`
 */

import type { Timestamp } from 'firebase/firestore';
import type { LogicalSignature } from './reclamacao';

export type CategoriasugestaoSugestao =
  | 'produto'             // product/reagent feedback
  | 'processo'            // process improvement
  | 'ambiente'            // lab environment/safety
  | 'atendimento'         // customer service
  | 'outro';              // other

export type StatusSugestao = 'aberta' | 'analisada' | 'implementada' | 'rejeitada';

export type TipoAutor = 'colaborador' | 'paciente' | 'externo';

/** Single suggestion comment */
export interface ComentarioSugestao {
  id: string;
  autorId?: string;       // null if anonymous internal
  textoAutor?: string;    // display name if needed
  texto: string;
  criadoEm: Timestamp;
  deletadoEm?: Timestamp; // soft-delete
}

/** Main suggestion entity */
export interface Sugestao {
  // ─── Identity ────────────────────────────────────────────────────────────
  id: string;
  labId: string;

  // ─── Author ──────────────────────────────────────────────────────────────
  autorId?: string;       // null for anonymous external suggestions
  autorTipo: TipoAutor;   // track origin
  autorNome?: string;     // display name (public can skip)

  // ─── Content ─────────────────────────────────────────────────────────────
  titulo: string;
  descricao: string;
  categoria: CategoriasugestaoSugestao;

  // ─── Workflow ────────────────────────────────────────────────────────────
  status: StatusSugestao;
  motivoRejeicao?: string; // if rejeitada
  dataImplementacao?: Timestamp;

  // ─── Community features ──────────────────────────────────────────────────
  votos: number;          // upvote count (collaborators only)
  votaraisPor?: string[]; // userIds who upvoted

  // ─── Discussion ──────────────────────────────────────────────────────────
  comentarios: ComentarioSugestao[];

  // ─── Audit Trail ────────────────────────────────────────────────────────
  signature: LogicalSignature;
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null;
}

export type CreateSugestaoInput = Omit<
  Sugestao,
  'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature' | 'votos' | 'votaraisPor'
>;

export type UpdateSugestaoInput = Partial<
  Omit<Sugestao, 'id' | 'labId' | 'criadoEm' | 'deletadoEm' | 'signature'>
>;

/**
 * personnel/types/CienciaResponsabilidades.ts
 *
 * Assinatura de Ciência das Responsabilidades.
 * Colaborador confirma que leu e entendeu as responsabilidades/autoridades do cargo.
 * DICQ 5.1.3 + RDC 978/2025 Art. 122
 */

import type { Timestamp } from '../../../shared/services/firebase';

export interface CienciaResponsabilidades {
  id: string;
  labId: string;
  colaboradorId: string;
  colaboradorNome: string;
  cargoId: string;
  cargoTitulo: string;
  responsabilidades: string[]; // snapshot of responsibilities at time of signing
  autoridades: string[]; // snapshot of authorities at time of signing
  dataAssinatura: Timestamp;
  assinadoPorId: string; // the colaborador who signed
  testemunhaId?: string; // witness (RT or admin)
  testemunhaNome?: string;
  hash: string; // SHA-256 of content for tamper evidence
  criadoEm: Timestamp;
  updatedAt: Timestamp;
  deletadoEm: Timestamp | null;
}

export type CienciaResponsabilidadesInput = Omit<
  CienciaResponsabilidades,
  'id' | 'labId' | 'criadoEm' | 'updatedAt' | 'deletadoEm'
>;

/**
 * CEQ Cloud Function types
 * Server-side interfaces for proficiency testing
 */

import type { CEQParticipacaoInput, CEQResultado } from '../../..';

export interface CreateCEQParticipacaoRequest {
  labId: string;
  input: CEQParticipacaoInput;
}

export interface RecebeCEQAmostraRequest {
  labId: string;
  ceqParticipacaoId: string;
  rodada: number;
  ano: number;
  dataRecepcao: string; // ISO date
  provedorRodadaId?: string;
}

export interface LancarCEQResultadoRequest {
  labId: string;
  ceqAmostraId: string;
  ceqParticipacaoId: string;
  analyteId: string;
  analyteName: string;
  valorObtido: number;
  unidade: string;
  valorReferencia: number;
  desvioEstimado: number;
}

export interface LancarCEQResultadoResponse {
  success: boolean;
  resultadoId: string;
  zScore: number;
  interpretacao: 'satisfatoria' | 'questionavel' | 'insatisfatoria';
  ncAutomaticaCriadaId?: string;
  ncNumero?: string;
}

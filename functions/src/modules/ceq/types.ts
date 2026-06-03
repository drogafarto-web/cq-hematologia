/**
 * CEQ Cloud Function types
 * Server-side interfaces for proficiency testing
 */

/** Input for enrolling a lab in an external proficiency testing (CEQ) program. */
export interface CEQParticipacaoInput {
  provedorId: string;
  provedorNome: string;
  programaNome: string;
  analitoIds: string[];
  dataInicio: string; // ISO date
  dataFim?: string; // ISO date, optional
  [key: string]: unknown;
}

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

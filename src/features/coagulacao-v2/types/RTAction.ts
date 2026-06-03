import type { Timestamp } from 'firebase/firestore';

export interface RTAction {
  id: string;
  labId: string;
  tipo: 'aprovar_controle' | 'rejeitar_controle' | 'notificar_notivisa';
  targetRef: { type: 'ControlOperacional'; id: string } | { type: 'Attempt'; id: string };
  payload: AprovarControlePayload | RejeitarControlePayload | NotificarNotivisaPayload;
  criadoEm: Timestamp;
  criadoPor: string;
}

export interface AprovarControlePayload {
  tipo: 'aprovar_controle';
  decisao: 'A' | 'NA';
  motivo: string;
}

export interface RejeitarControlePayload {
  tipo: 'rejeitar_controle';
  motivo: string;
  acaoRecomendada?: string;
}

export interface NotificarNotivisaPayload {
  tipo: 'notificar_notivisa';
  notivisaTipo: 'queixa_tecnica' | 'evento_adverso';
  notivisaProtocolo?: string;
  notivisaDataEnvio?: string;
  notivisaJustificativa?: string;
  motivo: string;
}

export type RTActionInput =
  | {
      tipo: 'aprovar_controle';
      controlOperacionalId: string;
      payload: Omit<AprovarControlePayload, 'tipo'>;
    }
  | {
      tipo: 'rejeitar_controle';
      controlOperacionalId: string;
      payload: Omit<RejeitarControlePayload, 'tipo'>;
    }
  | {
      tipo: 'notificar_notivisa';
      attemptId: string;
      payload: Omit<NotificarNotivisaPayload, 'tipo'>;
    };

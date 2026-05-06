import { Timestamp } from 'firebase/firestore';
import type { LabId, UserId } from './_shared_refs';
import { LogicalSignatureLaudo } from './laudoVersion';

/**
 * Registro imutável de comunicação de valor crítico
 * RDC 978 Art. 184-191: crítico precisa ser comunicado e registrado
 *
 * Canal de entrada: email (MVP), verbal (registrado manualmente), SMS/WhatsApp (v1.4)
 */
export type ComunicacaoCanal = 'email' | 'verbal' | 'sms' | 'whatsapp';
export type ComunicacaoReceptor =
  | 'medico-solicitante'
  | 'enfermeira'
  | 'supervisor'
  | 'outro';

export interface Comunicacao {
  // Identity
  id: string;
  laudoId: string;
  laudoVersion: number;
  labId: LabId;

  // Canal de comunicação
  canal: ComunicacaoCanal;

  // Receptor
  receptorTipo: ComunicacaoReceptor;
  receptorNome: string;
  receptorContato?: string; // email ou telefone

  // RT que comunicou
  rtComunicadorId: UserId;
  rtComunicadorNome: string;
  rtComunicadorRegistro: string;

  // Observação adicional
  observacao?: string;

  // Status da entrega (importante para email)
  sucesso: boolean; // entregue/aceito
  bouncedReason?: string; // se sucesso === false

  // Assinatura (para casos verbais ou quando crítico for formalmente comunicado)
  signature: LogicalSignatureLaudo;

  // Audit
  criadoEm: Timestamp;
}

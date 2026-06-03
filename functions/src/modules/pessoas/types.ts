import { Timestamp } from 'firebase-admin/firestore';

export interface Qualificacao {
  id: string;
  uid: string;
  tipo: 'treinamento' | 'capacitacao' | 'reciclagem';
  modulosLiberados: Array<
    'hematologia' | 'imunologia' | 'coagulacao' | 'uroanalise' | 'bioquimica'
  >;
  evidenciaUrl?: string;
  validoDe: Timestamp;
  validoAte?: Timestamp;
  liberadoPor: string;
  hmac: string;
  createdAt: Timestamp;
  deletadoEm?: Timestamp | null;
}

export interface Member {
  uid: string;
  role: 'owner' | 'admin' | 'analista' | 'tecnico' | 'leitor';
  active: boolean;
  cargo: string;
  conselhoProfissional?: {
    sigla: 'CRBM' | 'CRF' | 'CRM' | 'CRBio';
    numero: string;
    uf: string;
  };
  responsavelTecnico?: boolean;
  createdAt?: Timestamp;
}

export interface User {
  uid: string;
  email: string;
  nome: string;
  cpfHash: string;
  status: 'ativo' | 'afastado' | 'desligado';
  labsAtivos: string[];
}

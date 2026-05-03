import * as admin from 'firebase-admin';

export interface Equipamento {
  id: string;
  labId: string;
  nome: string;
  marca: string;
  modelo: string;
  numeroSerie: string;

  // Qualification
  dataQualificacaoInicial: admin.firestore.Timestamp;
  qualificadoPor: string; // uid

  // Calibration
  proximaCalibracaoPrevista: admin.firestore.Timestamp;
  ultimaCalibracaoData?: admin.firestore.Timestamp;
  ultimaCalibracaoFornecedorId?: string;

  // Maintenance
  proximaManutenccaoPrevista: admin.firestore.Timestamp;
  ultimaManutenccaoData?: admin.firestore.Timestamp;
  ultimaManutenccaoFornecedorId?: string;

  // Status
  status: 'ativo' | 'inativo' | 'em_manutencao' | 'quebrado';
  motivo_inativacao?: string;

  // Supplier
  fornecedorCalibracaoId: string; // FK to Fornecedor
  fornecedorManutencaoId?: string;

  // Audit
  hmac: string; // ADR 0005 signature
  previousHash: string | null;
  equipamentoAuditId?: string;

  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  createdBy: string; // uid

  // Metadata
  _version?: number;
}

export interface Calibracao {
  id: string;
  equipamentoId: string;
  labId: string;

  dataRealizacao: admin.firestore.Timestamp;
  realizadoPor: string; // uid (technician)
  fornecedorId: string; // FK to Fornecedor

  proximaDataCalibracao: admin.firestore.Timestamp;
  certificado_url: string; // PDF proof

  status: 'ok' | 'com_restricoes' | 'reprovado';
  observacoes?: string;

  hmac: string; // ADR 0005 signature

  createdAt: admin.firestore.Timestamp;
}

export interface Manutencao {
  id: string;
  equipamentoId: string;
  labId: string;

  dataRealizacao: admin.firestore.Timestamp;
  realizadoPor: string; // uid
  fornecedorId: string; // FK to Fornecedor

  tipo: 'preventiva' | 'corretiva' | 'emergencial';
  descricao: string; // Work performed

  proximaDataManutencao: admin.firestore.Timestamp;

  pecasSubstituidas: Array<{
    nome: string;
    custo?: number;
  }>;
  custo_total: number;

  hmac: string; // ADR 0005 signature

  createdAt: admin.firestore.Timestamp;
}

export interface EquipamentoValidacao {
  allowed: boolean;
  reason?: string;
  dataVencimento?: admin.firestore.Timestamp;
}

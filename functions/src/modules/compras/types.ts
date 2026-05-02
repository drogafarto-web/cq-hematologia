import { Timestamp } from 'firebase-admin/firestore';

export interface Fornecedor {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  status: 'pendente' | 'qualificado' | 'suspenso' | 'desqualificado';
  qualificadoEm?: Timestamp;
  proximaRequalificacao?: Timestamp;
  evidencias: Array<{
    tipo: 'certificado' | 'laudo' | 'contrato' | 'outro';
    url: string;
    dataUpload: Timestamp;
  }>;
  categoriasFornecidas: string[];
  contato: {
    email?: string;
    telefone?: string;
    responsavel?: string;
  };
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

export interface NotaFiscalItem {
  id: string;
  descricao: string;
  codigoProduto?: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  precoTotal: number;
  loteNumber?: string;
  validadeAte?: string; // YYYY-MM-DD
}

export interface NotaFiscal {
  id: string;
  labId: string;
  numero: string;
  serie: string;
  dataEmissao: string; // YYYY-MM-DD
  dataRecebimento?: Timestamp;
  fornecedorId: string;
  fornecedorRazaoSocial?: string;
  cnpjFornecedor?: string;
  itens: NotaFiscalItem[];
  valorTotal: number;
  conferenciaOk?: boolean;
  desviosObservados?: string[];
  ncId?: string; // FK a Não-Conformidade se divergência
  conferidoPor?: string; // operadorId
  dataConferencia?: Timestamp;
  createdAt: Timestamp;
  createdBy: string;
}

export interface InsumoLote {
  id: string;
  labId: string;
  codigo?: string;
  tipo: 'reagente' | 'controle' | 'calibrador' | 'consumivel';
  descricao: string;
  fabricante?: string;
  codigoFabricante?: string;
  loteNumber: string;
  dataFabricacao: string; // YYYY-MM-DD
  validadeAte: string; // YYYY-MM-DD
  validadeReal?: string; // Pode ser antes se teste anterior falhou
  quantidade: number;
  unidade: string;
  status: 'ativo' | 'segregado' | 'vencido' | 'reprovado' | 'em-teste';
  // ADR 0002: Rastreabilidade fiscal
  notaFiscalId?: string; // FK NotaFiscal obrigatório
  fornecedorId?: string; // FK Fornecedor obrigatório (via NF)
  nfItemIndex?: number; // Qual item da NF gera este lote
  // Auditoria
  createdAt: Timestamp;
  createdBy: string;
  hmac?: string; // Para chain-hash (ADR 0005)
  hash?: string;
  previousHash?: string | null;
}

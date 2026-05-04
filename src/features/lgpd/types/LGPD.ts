/**
 * Módulo: LGPD (Lei Geral de Proteção de Dados)
 *
 * Política de privacidade, direitos do titular, exclusão de dados,
 * DPIA (Data Protection Impact Assessment).
 *
 * Firestore path: /labs/{labId}/lgpd-* collections
 */

import type { Timestamp } from 'firebase/firestore';

export interface LGPDPolicy {
  readonly labId: string;
  versao: string;
  titulo: string;
  conteudo: string;
  data_vigencia: Timestamp;
  consentimento_obrigatorio: boolean;

  readonly criadoEm: Timestamp;
  readonly atualizadoEm: Timestamp;
}

export interface SolicitacaoDados {
  readonly id: string;
  readonly labId: string;

  titular_id: string;
  titular_nome: string;
  titular_email: string;
  tipo: 'acesso' | 'retificacao' | 'exclusao' | 'portabilidade';
  status: 'pendente' | 'processando' | 'concluida' | 'recusada';
  motivo?: string;

  data_solicitacao: Timestamp;
  data_prazo: Timestamp;
  data_conclusao?: Timestamp;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

export interface DPIA {
  readonly id: string;
  readonly labId: string;

  titulo: string;
  descricao: string;
  dados_pessoais_processados: string[];
  riscos_identificados: string[];
  medidas_mitigacao: string[];
  status: 'rascunho' | 'em_revisao' | 'aprovado' | 'rejeitado';

  data_criacao: Timestamp;
  data_revisao?: Timestamp;
  revisor?: string;

  readonly criadoEm: Timestamp;
}

export interface ConsentimentoUsuario {
  readonly id: string;
  readonly labId: string;

  usuario_id: string;
  usuario_email: string;
  tipo_consentimento: 'privacidade' | 'marketing' | 'pesquisa';
  consentido: boolean;
  data_consentimento: Timestamp;
  ip_origem?: string;

  readonly criadoEm: Timestamp;
}

export interface LogExclusao {
  readonly id: string;
  readonly labId: string;

  usuario_id: string;
  usuario_nome: string;
  data_exclusao: Timestamp;
  tipo: 'anonimizacao' | 'remocao_completa' | 'arquivamento';
  dados_excluidos: string[];
  verificado: boolean;

  readonly criadoEm: Timestamp;
  readonly criadoPor: string;
}

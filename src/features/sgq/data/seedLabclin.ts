/**
 * Seed data — Lista Mestra Labclin (L-001 + L-002)
 *
 * Fonte: planilha real da Lista Mestra do laboratório Labclin Riopomba.
 * Uso: bulk import via bulkCreateDocumentos() para popular lab novo ou restore.
 *
 * Nenhuma dependência de runtime — dados puros.
 */

import type { TipoDocumento } from '../types/Documento';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface SeedDocumento {
  tipo: TipoDocumento;
  codigo: string;
  titulo: string;
  versao: number;
  dataElaboracao: string;
  dataRevisao?: string;
  listaDistribuicao: string[];
}

export interface SeedDocumentoExterno {
  sigla: string;
  codigo: string;
  titulo: string;
  versaoExterna?: string;
  situacao: 'ativo' | 'inativo';
  dataEmissao?: string;
  dataRevisao?: string;
}

// ─── Documentos Internos (LM-001) ───────────────────────────────────────────

export const SEED_DOCUMENTOS_INTERNOS: SeedDocumento[] = [
  // ── Listas ──────────────────────────────────────────────────────────────────
  {
    tipo: 'LM',
    codigo: 'L-001',
    titulo: 'Lista Mestra de Documentos Internos e Externos',
    versao: 1,
    dataElaboracao: '2025-10-02',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'LM',
    codigo: 'L-002',
    titulo: 'Lista Nominal',
    versao: 1,
    dataElaboracao: '2025-09-17',
    listaDistribuicao: ['Mercês', 'Silveirânia', 'Guarani'],
  },

  // ── CDC ─────────────────────────────────────────────────────────────────────
  {
    tipo: 'CDC',
    codigo: 'CDC-001',
    titulo: 'Código de Ética e Conduta',
    versao: 1,
    dataElaboracao: '2025-09-11',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Recepção', 'Coleta',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },

  // ── MQ ──────────────────────────────────────────────────────────────────────
  {
    tipo: 'MQ',
    codigo: 'MQ-001',
    titulo: 'Manual da Qualidade',
    versao: 4,
    dataElaboracao: '2024-05-06',
    dataRevisao: '2025-08-12',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Recepção', 'Coleta',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },

  // ── PQ ──────────────────────────────────────────────────────────────────────
  {
    tipo: 'PQ',
    codigo: 'PQ-001',
    titulo: 'Formação e Treinamento',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-03',
    listaDistribuicao: ['Direção', 'Estoque', 'RH', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-002',
    titulo: 'Exames',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-06',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'Coleta', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-003',
    titulo: 'Limpeza e Desinfecção de Superfícies e Equipamentos',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-06',
    listaDistribuicao: [
      'Recepção', 'Coleta', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Triagem', 'Área Técnica',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-004',
    titulo: 'Equipamentos e Instrumentos',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-06',
    listaDistribuicao: [
      'Coleta', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Triagem', 'Área Técnica',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-005',
    titulo: 'Qualificação de Fornecedores',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-06',
    listaDistribuicao: ['Qualidade', 'Direção', 'RH'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-006',
    titulo: 'Gerenciamento de Informação',
    versao: 2,
    dataElaboracao: '2024-06-19',
    dataRevisao: '2025-08-18',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'RH', 'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-007',
    titulo: 'Gerenciamento de Materiais e Insumos',
    versao: 1,
    dataElaboracao: '2023-11-23',
    dataRevisao: '2025-11-03',
    listaDistribuicao: [
      'Qualidade', 'Coleta', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Triagem', 'Área Técnica',
      'Estoque', 'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-008',
    titulo: 'Água Reagente',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-09-05',
    listaDistribuicao: ['Qualidade', 'Área Técnica'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-009',
    titulo: 'Controle Interno da Qualidade',
    versao: 2,
    dataElaboracao: '2024-06-23',
    dataRevisao: '2025-10-31',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Área Técnica',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-010',
    titulo: 'Controle Externo da Qualidade',
    versao: 2,
    dataElaboracao: '2024-06-19',
    dataRevisao: '2025-08-18',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Área Técnica',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-011',
    titulo: 'Laboratórios de Apoio',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-08',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-012',
    titulo: 'Laudo Laboratorial',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-10-08',
    listaDistribuicao: ['Qualidade', 'Direção', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-013',
    titulo: 'Plano de Gerenciamento de Tecnologias',
    versao: 2,
    dataElaboracao: '2024-06-16',
    dataRevisao: '2025-09-10',
    listaDistribuicao: [
      'Qualidade', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-014',
    titulo: 'Elaboração de Documentos',
    versao: 2,
    dataElaboracao: '2024-06-16',
    dataRevisao: '2025-08-12',
    listaDistribuicao: ['Qualidade'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-015',
    titulo: 'Biossegurança e Tratamento de Acidente de Trabalho',
    versao: 1,
    dataElaboracao: '2023-11-03',
    dataRevisao: '2025-09-09',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-016',
    titulo: 'Lavagem e Esterilização de Materiais',
    versao: 1,
    dataElaboracao: '2023-11-23',
    dataRevisao: '2025-11-03',
    listaDistribuicao: ['Uroanálise', 'Parasitologia', 'Área Técnica'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-017',
    titulo: 'Transporte de Material Biológico',
    versao: 2,
    dataElaboracao: '2023-06-21',
    dataRevisao: '2025-08-28',
    listaDistribuicao: [
      'Qualidade', 'Coleta', 'Área Técnica', 'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-018',
    titulo: 'Tratamento de Não Conformidades e Melhoria Contínua',
    versao: 2,
    dataElaboracao: '2024-06-06',
    dataRevisao: '2025-08-14',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Recepção', 'Coleta', 'Bioquímica', 'Hematologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-019',
    titulo: 'Atendimento ao Cliente',
    versao: 1,
    dataElaboracao: '2025-09-15',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'Coleta', 'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-020',
    titulo: 'Pesquisa de Satisfação',
    versao: 2,
    dataElaboracao: '2024-06-23',
    dataRevisao: '2025-08-13',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'Coleta', 'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-021',
    titulo: 'Indicadores',
    versao: 2,
    dataElaboracao: '2024-06-19',
    dataRevisao: '2025-09-02',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'Coleta', 'Bioquímica', 'Hematologia', 'Microbiologia',
      'Uroanálise', 'Parasitologia', 'Imunologia', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-022',
    titulo: 'Verificação e Validação de Processos Analíticos',
    versao: 2,
    dataElaboracao: '2024-06-27',
    dataRevisao: '2025-08-21',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Coleta', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-023',
    titulo: 'Gestão de Risco',
    versao: 2,
    dataElaboracao: '2024-06-21',
    dataRevisao: '2025-08-14',
    listaDistribuicao: [
      'Qualidade', 'Direção', 'Recepção', 'Coleta', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-024',
    titulo: 'Gestão de Pessoal',
    versao: 2,
    dataElaboracao: '2024-06-19',
    dataRevisao: '2025-08-12',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-025',
    titulo: 'Consultoria',
    versao: 2,
    dataElaboracao: '2024-06-27',
    dataRevisao: '2025-08-14',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-026',
    titulo: 'Controle de Documentos e Registros',
    versao: 2,
    dataElaboracao: '2024-06-21',
    dataRevisao: '2025-08-12',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-027',
    titulo: 'Notificação de Valores Críticos',
    versao: 1,
    dataElaboracao: '2023-05-17',
    dataRevisao: '2025-08-12',
    listaDistribuicao: ['Qualidade', 'Área Técnica', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-028',
    titulo: 'Liberação, Emissão e Retificação de Laudos',
    versao: 2,
    dataElaboracao: '2024-06-19',
    dataRevisao: '2025-08-18',
    listaDistribuicao: ['Qualidade', 'Direção', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-029',
    titulo: 'Análise Crítica',
    versao: 2,
    dataElaboracao: '2024-06-23',
    dataRevisao: '2025-08-21',
    listaDistribuicao: [
      'Qualidade', 'Recepção', 'Coleta', 'Triagem', 'Área Técnica',
      'Mercês', 'Silveirânia', 'Guarani',
    ],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-030',
    titulo: 'Limpeza de Caixa D\'Água',
    versao: 1,
    dataElaboracao: '2024-07-06',
    dataRevisao: '2025-08-12',
    listaDistribuicao: ['Qualidade', 'Faturamento'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-031',
    titulo: 'Controle de Coloração',
    versao: 1,
    dataElaboracao: '2025-10-25',
    listaDistribuicao: ['Qualidade', 'Área Técnica'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-032',
    titulo: 'Plano de Gerenciamento de Resíduos de Serviço de Saúde',
    versao: 1,
    dataElaboracao: '2024-08-12',
    dataRevisao: '2025-09-09',
    listaDistribuicao: ['Qualidade', 'Direção', 'Faturamento'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-033',
    titulo: 'Infraestrutura e Ambiente do Laboratório',
    versao: 1,
    dataElaboracao: '2025-08-14',
    listaDistribuicao: ['Qualidade', 'Direção', 'Faturamento'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-034',
    titulo: 'Contrato de Serviços',
    versao: 2,
    dataElaboracao: '2024-06-23',
    dataRevisao: '2025-08-14',
    listaDistribuicao: ['Qualidade', 'Direção', 'Faturamento'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-035',
    titulo: 'Educação Continuada',
    versao: 1,
    dataElaboracao: '2025-08-08',
    listaDistribuicao: ['Qualidade', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-036',
    titulo: 'Avaliação de Desempenho',
    versao: 1,
    dataElaboracao: '2025-11-04',
    listaDistribuicao: ['Qualidade', 'Direção', 'Mercês', 'Silveirânia', 'Guarani'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-037',
    titulo: 'Programa de Controle Interobservador',
    versao: 1,
    dataElaboracao: '2025-11-05',
    listaDistribuicao: ['Qualidade', 'Área Técnica'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-038',
    titulo: 'Auditoria Interna',
    versao: 1,
    dataElaboracao: '2025-06-23',
    dataRevisao: '2025-11-28',
    listaDistribuicao: ['Qualidade', 'Direção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-039',
    titulo: 'Gestão de Comunicação',
    versao: 1,
    dataElaboracao: '2025-11-28',
    listaDistribuicao: ['Qualidade', 'Direção', 'Recepção'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-040',
    titulo: 'Recebimento, Identificação e Manuseio de Amostras',
    versao: 1,
    dataElaboracao: '2025-11-28',
    listaDistribuicao: ['Qualidade', 'Coleta', 'Área Técnica'],
  },
  {
    tipo: 'PQ',
    codigo: 'PQ-041',
    titulo: 'Gerenciamento de Documentos Externos',
    versao: 1,
    dataElaboracao: '2026-01-27',
    listaDistribuicao: ['Qualidade'],
  },
];

// ─── Documentos Externos (LM-002) ───────────────────────────────────────────

export const SEED_DOCUMENTOS_EXTERNOS: SeedDocumentoExterno[] = [
  // ── RDC ─────────────────────────────────────────────────────────────────────
  {
    sigla: 'RDC',
    codigo: 'RDC-001',
    titulo: 'RDC 978/2025',
    situacao: 'ativo',
  },

  // ── FDS (Fichas de Dados de Segurança) ──────────────────────────────────────
  {
    sigla: 'FDS',
    codigo: 'FDS-001',
    titulo: 'Álcool Etílico (Antares)',
    versaoExterna: 'v10',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-002',
    titulo: 'Hipoclorito de Sódio (Antares)',
    versaoExterna: 'v10',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-003',
    titulo: 'Coloração de Gram (New Prov)',
    versaoExterna: 'v5',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-004',
    titulo: 'Corante May Grunwald (New Prov)',
    versaoExterna: 'v5',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-005',
    titulo: 'Corante Giemsa (New Prov)',
    versaoExterna: 'v5',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-006',
    titulo: 'Controle Controllab (Hematologia)',
    versaoExterna: 'v5',
    situacao: 'ativo',
    dataRevisao: '2025-07-15',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-007',
    titulo: 'aPTT Líquido In Vitro',
    versaoExterna: 'v2',
    situacao: 'ativo',
    dataRevisao: '2025-05-01',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-008',
    titulo: 'Imuno Látex - PCR',
    versaoExterna: 'v2',
    situacao: 'ativo',
    dataRevisao: '2025-05-01',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-009',
    titulo: 'Coagulação TP',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-010',
    titulo: 'Coagulação aPTT',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-011',
    titulo: 'Controle Uroanálise PNCQ',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-012',
    titulo: 'Controle Coagulograma PNCQ',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-013',
    titulo: 'Gluc Up',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-014',
    titulo: 'Lact Up',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-015',
    titulo: 'Analisa Glicose',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-016',
    titulo: 'Analisa Lactose',
    situacao: 'ativo',
  },
  {
    sigla: 'FDS',
    codigo: 'FDS-017',
    titulo: 'Líquido de Turck',
    situacao: 'ativo',
  },

  // ── NR (Normas Regulamentadoras) ────────────────────────────────────────────
  {
    sigla: 'NR',
    codigo: 'NR-001',
    titulo: 'NR 006 - Equipamento de Proteção Individual',
    situacao: 'ativo',
  },
  {
    sigla: 'NR',
    codigo: 'NR-003',
    titulo: 'Laudo Técnico das Condições do Ambiente de Trabalho',
    situacao: 'ativo',
    dataEmissao: '2021-06-01',
  },
  {
    sigla: 'NR',
    codigo: 'NR-005',
    titulo: 'Programa de Controle Médico de Saúde Ocupacional',
    situacao: 'ativo',
    dataEmissao: '2026-03-23',
  },
  {
    sigla: 'NR',
    codigo: 'NR-006',
    titulo: 'Programa de Gerenciamento de Riscos',
    situacao: 'ativo',
    dataEmissao: '2026-03-23',
  },

  // ── ME (Manuais de Equipamentos) ───────────────────────────────────────────
  {
    sigla: 'ME',
    codigo: 'ME-001',
    titulo: 'Manual Yumizen H550',
    situacao: 'ativo',
  },
  {
    sigla: 'ME',
    codigo: 'ME-002',
    titulo: 'Manual Coagulômetro',
    situacao: 'ativo',
  },
];
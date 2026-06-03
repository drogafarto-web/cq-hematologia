/**
 * Quality Tools Type System — Ferramentas da Qualidade para NC/CAPA
 *
 * Operador escolhe qual ferramenta usar para tratar cada NC.
 * DICQ 4.10 + ISO 15189 10.2 + RDC 978 Art. 105-106
 *
 * Firestore path: /labs/{labId}/capa/{capaId}/ferramentas/{ferramentaId}
 */

import type { Timestamp } from 'firebase/firestore';

export type QualityToolType =
  | 'cinco-porques'
  | 'ishikawa'
  | '5w2h'
  | 'pdca'
  | 'pareto'
  | 'gut'
  | '8d'
  | 'brainstorming';

export const QUALITY_TOOL_LABELS: Record<QualityToolType, string> = {
  'cinco-porques': '5 Porquês',
  ishikawa: 'Diagrama de Ishikawa (6M)',
  '5w2h': '5W2H — Plano de Ação',
  pdca: 'Ciclo PDCA',
  pareto: 'Diagrama de Pareto',
  gut: 'Matriz GUT',
  '8d': '8D — Oito Disciplinas',
  brainstorming: 'Brainstorming Estruturado',
};

export const QUALITY_TOOL_DESCRIPTIONS: Record<QualityToolType, string> = {
  'cinco-porques': 'Pergunte "Por quê?" iterativamente até encontrar a causa raiz',
  ishikawa:
    'Mapeie causas por categoria: Mão de obra, Método, Material, Máquina, Meio ambiente, Medição',
  '5w2h': 'Estruture ações: O quê, Por quê, Onde, Quando, Quem, Como, Quanto custa',
  pdca: 'Ciclo Plan-Do-Check-Act para melhoria contínua',
  pareto: 'Priorize causas pela regra 80/20 (frequência x impacto)',
  gut: 'Priorize problemas por Gravidade × Urgência × Tendência',
  '8d': 'Metodologia completa de 8 disciplinas para NCs críticas/sistêmicas',
  brainstorming: 'Sessão estruturada de geração de ideias com equipe multidisciplinar',
};

export const QUALITY_TOOL_PHASES: Record<QualityToolType, string> = {
  'cinco-porques': 'Investigação (causa raiz)',
  ishikawa: 'Investigação (causa raiz)',
  '5w2h': 'Planejamento de ação',
  pdca: 'Ciclo completo',
  pareto: 'Priorização / Tendência',
  gut: 'Priorização',
  '8d': 'Ciclo completo (NCs críticas)',
  brainstorming: 'Investigação (geração de hipóteses)',
};

// ─── 5 Porquês ───────────────────────────────────────────────────────────────

export interface CincosPorquesData {
  tipo: 'cinco-porques';
  problema: string;
  porques: { pergunta: string; resposta: string }[];
  causaRaiz: string;
  evidencia: string;
}

// ─── Ishikawa (6M) ──────────────────────────────────────────────────────────

export type IshikawaCategoria =
  | 'mao-de-obra'
  | 'metodo'
  | 'material'
  | 'maquina'
  | 'meio-ambiente'
  | 'medicao';

export const ISHIKAWA_CATEGORIAS: Record<IshikawaCategoria, string> = {
  'mao-de-obra': 'Mão de Obra',
  metodo: 'Método',
  material: 'Material',
  maquina: 'Máquina',
  'meio-ambiente': 'Meio Ambiente',
  medicao: 'Medição',
};

export interface IshikawaData {
  tipo: 'ishikawa';
  efeito: string;
  causas: Record<IshikawaCategoria, string[]>;
  causaRaizSelecionada: string;
  categoriaCausaRaiz: IshikawaCategoria;
}

// ─── 5W2H ────────────────────────────────────────────────────────────────────

export interface Acao5W2H {
  what: string;
  why: string;
  where: string;
  when: string;
  who: string;
  how: string;
  howMuch: string;
}

export interface FiveW2HData {
  tipo: '5w2h';
  acoes: Acao5W2H[];
}

// ─── PDCA ────────────────────────────────────────────────────────────────────

export type PDCAFase = 'plan' | 'do' | 'check' | 'act';

export interface PDCAData {
  tipo: 'pdca';
  objetivo: string;
  indicadorSucesso: string;
  fases: {
    plan: string;
    do: string;
    check: string;
    act: string;
  };
  faseAtual: PDCAFase;
  resultado: 'em-andamento' | 'eficaz' | 'novo-ciclo';
}

// ─── Pareto ──────────────────────────────────────────────────────────────────

export interface ParetoItem {
  categoria: string;
  frequencia: number;
  percentual?: number;
  acumulado?: number;
}

export interface ParetoData {
  tipo: 'pareto';
  periodoInicio: string;
  periodoFim: string;
  itens: ParetoItem[];
  conclusao: string;
}

// ─── GUT ─────────────────────────────────────────────────────────────────────

export interface GUTItem {
  problema: string;
  gravidade: 1 | 2 | 3 | 4 | 5;
  urgencia: 1 | 2 | 3 | 4 | 5;
  tendencia: 1 | 2 | 3 | 4 | 5;
  score?: number;
}

export interface GUTData {
  tipo: 'gut';
  itens: GUTItem[];
  decisao: string;
}

// ─── 8D ──────────────────────────────────────────────────────────────────────

export interface EightDData {
  tipo: '8d';
  d1_equipe: { membros: string[]; lider: string };
  d2_descricao: string;
  d3_contencao: { acao: string; responsavel: string; prazo: string };
  d4_causaRaiz: string;
  d5_acaoCorretiva: string;
  d6_implementacao: string;
  d7_prevencao: string;
  d8_reconhecimento: string;
}

// ─── Brainstorming ───────────────────────────────────────────────────────────

export interface BrainstormingData {
  tipo: 'brainstorming';
  tema: string;
  participantes: { nome: string; funcao: string }[];
  dataHora: string;
  ideias: string[];
  agrupamento: Record<IshikawaCategoria, string[]>;
  selecionadas: string[];
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type QualityToolData =
  | CincosPorquesData
  | IshikawaData
  | FiveW2HData
  | PDCAData
  | ParetoData
  | GUTData
  | EightDData
  | BrainstormingData;

// ─── Documento Firestore ─────────────────────────────────────────────────────

export interface QualityToolDocument {
  readonly id: string;
  readonly labId: string;
  readonly capaId: string;
  toolType: QualityToolType;
  data: QualityToolData;
  criadoPor: string;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
  status: 'rascunho' | 'concluido';
}

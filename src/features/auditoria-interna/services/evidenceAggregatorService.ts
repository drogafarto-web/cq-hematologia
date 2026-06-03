/**
 * Evidence Aggregator Service
 *
 * Queries other HC Quality modules and returns relevant evidence/documentation
 * for a given checklist item being audited. Maps FR-044 indicator IDs to their
 * corresponding Firestore collections and fetches the most recent records.
 *
 * Multi-tenant: all operations require explicit labId parameter.
 */

import { collection, query, orderBy, limit, getDocs, Timestamp } from 'firebase/firestore';

import { db } from '../../../shared/services/firebase';

// ──────────────────────────────────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────────────────────────────────

export interface EvidenciaAgregada {
  id: string;
  moduloOrigem: string;
  tipo: 'documento' | 'registro' | 'certificado' | 'relatorio' | 'indicador' | 'foto';
  titulo: string;
  descricao: string;
  dataRegistro: Date;
  status: 'vigente' | 'vencido' | 'pendente' | 'nao-encontrado';
  linkDireto: string;
  preview?: string;
}

export interface ModuleMapping {
  indicadorId: string;
  modulosConsultados: string[];
  collectionPath: string;
  queryFields: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// Module Mappings (FR-044 indicator IDs -> Firestore collections)
// ──────────────────────────────────────────────────────────────────────────

export const MODULE_MAPPINGS: Record<string, ModuleMapping> = {
  fornecedores: {
    indicadorId: 'fornecedores',
    modulosConsultados: ['fornecedores'],
    collectionPath: '/labs/{labId}/fornecedores',
    queryFields: ['nome', 'status', 'dataAvaliacao'],
  },
  equipamentos: {
    indicadorId: 'equipamentos',
    modulosConsultados: ['equipamentos'],
    collectionPath: '/labs/{labId}/equipamentos',
    queryFields: ['nome', 'status', 'dataManutencao'],
  },
  calibracao: {
    indicadorId: 'calibracao',
    modulosConsultados: ['calibracao'],
    collectionPath: '/labs/{labId}/calibracoes',
    queryFields: ['equipamentoId', 'dataCalibracao', 'resultado'],
  },
  treinamentos: {
    indicadorId: 'treinamentos',
    modulosConsultados: ['treinamentos'],
    collectionPath: '/labs/{labId}/treinamentos',
    queryFields: ['titulo', 'dataRealizacao', 'status'],
  },
  risks: {
    indicadorId: 'risks',
    modulosConsultados: ['risks'],
    collectionPath: '/labs/{labId}/risks',
    queryFields: ['descricao', 'severidade', 'dataIdentificacao'],
  },
  'nao-conformidades': {
    indicadorId: 'nao-conformidades',
    modulosConsultados: ['nao-conformidades'],
    collectionPath: '/labs/{labId}/nao-conformidades',
    queryFields: ['descricao', 'status', 'dataAbertura'],
  },
  'capa-tracking': {
    indicadorId: 'capa-tracking',
    modulosConsultados: ['capa-tracking'],
    collectionPath: '/labs/{labId}/capas',
    queryFields: ['descricao', 'tipo', 'status', 'dataCriacao'],
  },
  sgq: {
    indicadorId: 'sgq',
    modulosConsultados: ['sgq'],
    collectionPath: '/labs/{labId}/sgq-documentos',
    queryFields: ['titulo', 'versao', 'status', 'dataPublicacao'],
  },
  personnel: {
    indicadorId: 'personnel',
    modulosConsultados: ['personnel'],
    collectionPath: '/labs/{labId}/personnel',
    queryFields: ['nome', 'cargo', 'dataAdmissao'],
  },
  'notivisa-portal': {
    indicadorId: 'notivisa-portal',
    modulosConsultados: ['notivisa-portal'],
    collectionPath: '/labs/{labId}/notificacoes-notivisa',
    queryFields: ['tipo', 'descricao', 'dataNotificacao'],
  },
  'controle-temperatura': {
    indicadorId: 'controle-temperatura',
    modulosConsultados: ['controle-temperatura'],
    collectionPath: '/labs/{labId}/temperature-readings',
    queryFields: ['equipamentoId', 'temperatura', 'dataLeitura'],
  },
  'ciq-imuno': {
    indicadorId: 'ciq-imuno',
    modulosConsultados: ['ciq-imuno'],
    collectionPath: '/labs/{labId}/ciq-analyses',
    queryFields: ['analito', 'resultado', 'dataAnalise'],
  },
  biosseguranca: {
    indicadorId: 'biosseguranca',
    modulosConsultados: ['biosseguranca'],
    collectionPath: '/labs/{labId}/biosseguranca',
    queryFields: ['tipo', 'descricao', 'dataRegistro'],
  },
  pgrss: {
    indicadorId: 'pgrss',
    modulosConsultados: ['pgrss'],
    collectionPath: '/labs/{labId}/pgrss',
    queryFields: ['tipo', 'descricao', 'dataRegistro'],
  },
  lgpd: {
    indicadorId: 'lgpd',
    modulosConsultados: ['lgpd'],
    collectionPath: '/labs/{labId}/lgpd-consents',
    queryFields: ['titular', 'finalidade', 'dataConsentimento'],
  },
  reclamacoes: {
    indicadorId: 'reclamacoes',
    modulosConsultados: ['reclamacoes'],
    collectionPath: '/labs/{labId}/reclamacoes',
    queryFields: ['descricao', 'status', 'dataAbertura'],
  },
  liberacao: {
    indicadorId: 'liberacao',
    modulosConsultados: ['liberacao'],
    collectionPath: '/labs/{labId}/laudos',
    queryFields: ['paciente', 'exame', 'dataLiberacao'],
  },
  criticos: {
    indicadorId: 'criticos',
    modulosConsultados: ['criticos'],
    collectionPath: '/labs/{labId}/critical-values',
    queryFields: ['analito', 'valor', 'dataNotificacao'],
  },
  'lab-apoio': {
    indicadorId: 'lab-apoio',
    modulosConsultados: ['lab-apoio'],
    collectionPath: '/labs/{labId}/lab-apoio-contracts',
    queryFields: ['laboratorio', 'status', 'dataContrato'],
  },
  'management-review': {
    indicadorId: 'management-review',
    modulosConsultados: ['management-review'],
    collectionPath: '/labs/{labId}/management-reviews',
    queryFields: ['titulo', 'dataReuniao', 'status'],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Resolve the actual Firestore collection path by replacing {labId} placeholder.
 */
function resolveCollectionPath(template: string, labId: string): string {
  return template.replace('{labId}', labId).replace(/^\//, '');
}

/**
 * Determine the tipo based on the module origin.
 */
function inferTipo(moduloOrigem: string): EvidenciaAgregada['tipo'] {
  const tipoMap: Record<string, EvidenciaAgregada['tipo']> = {
    sgq: 'documento',
    calibracao: 'certificado',
    treinamentos: 'certificado',
    'ciq-imuno': 'indicador',
    'controle-temperatura': 'registro',
    'nao-conformidades': 'relatorio',
    'capa-tracking': 'relatorio',
    'management-review': 'relatorio',
    risks: 'relatorio',
    liberacao: 'relatorio',
    criticos: 'registro',
  };
  return tipoMap[moduloOrigem] ?? 'registro';
}

/**
 * Determine the status based on document data.
 */
function inferStatus(data: Record<string, unknown>): EvidenciaAgregada['status'] {
  const status = data['status'] as string | undefined;
  if (!status) return 'vigente';

  const statusLower = status.toLowerCase();
  if (statusLower.includes('vencid') || statusLower.includes('expirad')) return 'vencido';
  if (statusLower.includes('pendent') || statusLower.includes('aberto')) return 'pendente';
  if (
    statusLower.includes('vigent') ||
    statusLower.includes('ativo') ||
    statusLower.includes('conforme')
  )
    return 'vigente';

  return 'vigente';
}

/**
 * Extract a date from document data, checking common date field names.
 */
function extractDate(data: Record<string, unknown>): Date {
  const dateFields = [
    'dataRegistro',
    'dataCriacao',
    'criadoEm',
    'dataPublicacao',
    'dataRealizacao',
    'dataCalibracao',
    'dataAvaliacao',
    'dataAbertura',
    'dataLeitura',
    'dataAnalise',
    'dataNotificacao',
    'dataConsentimento',
    'dataLiberacao',
    'dataContrato',
    'dataReuniao',
    'dataManutencao',
    'dataIdentificacao',
    'dataAdmissao',
    'createdAt',
    'updatedAt',
  ];

  for (const field of dateFields) {
    const value = data[field];
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'number' && value > 0) {
      return new Date(value);
    }
  }

  return new Date();
}

/**
 * Extract a human-readable title from document data.
 */
function extractTitulo(data: Record<string, unknown>, moduloOrigem: string): string {
  const titleFields = [
    'titulo',
    'nome',
    'descricao',
    'analito',
    'exame',
    'tipo',
    'laboratorio',
    'titular',
  ];
  for (const field of titleFields) {
    const value = data[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return `Registro de ${moduloOrigem}`;
}

/**
 * Build the in-app route link for a given module and document ID.
 */
function buildLinkDireto(moduloOrigem: string, docId: string, labId: string): string {
  return `/${moduloOrigem}?labId=${labId}&id=${docId}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Main fetch functions
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fetch evidence records for a single FR-044 indicator.
 *
 * Looks up the MODULE_MAPPINGS for the given indicadorId, queries the
 * corresponding Firestore collection (limit 10 most recent), and maps
 * results to EvidenciaAgregada format.
 *
 * Returns empty array if no mapping or no data found.
 */
export async function fetchEvidenciasParaIndicador(
  labId: string,
  indicadorId: string,
): Promise<EvidenciaAgregada[]> {
  const mapping = MODULE_MAPPINGS[indicadorId];
  if (!mapping) {
    return [];
  }

  const collectionPathResolved = resolveCollectionPath(mapping.collectionPath, labId);

  try {
    const colRef = collection(db, collectionPathResolved);
    const q = query(colRef, orderBy('criadoEm', 'desc'), limit(10));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return [];
    }

    const evidencias: EvidenciaAgregada[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        moduloOrigem: indicadorId,
        tipo: inferTipo(indicadorId),
        titulo: extractTitulo(data, indicadorId),
        descricao: typeof data['descricao'] === 'string' ? data['descricao'] : '',
        dataRegistro: extractDate(data),
        status: inferStatus(data),
        linkDireto: buildLinkDireto(indicadorId, docSnap.id, labId),
        preview: typeof data['preview'] === 'string' ? data['preview'] : undefined,
      };
    });

    return evidencias;
  } catch (error) {
    console.error(
      `[EvidenceAggregator] Erro ao buscar evidências para indicador "${indicadorId}":`,
      error,
    );
    return [];
  }
}

/**
 * Batch fetch evidence for multiple FR-044 indicators.
 *
 * Runs all queries in parallel for performance.
 * Returns a record keyed by indicadorId.
 */
export async function fetchAllEvidencias(
  labId: string,
  indicadorIds: string[],
): Promise<Record<string, EvidenciaAgregada[]>> {
  const results: Record<string, EvidenciaAgregada[]> = {};

  const promises = indicadorIds.map(async (indicadorId) => {
    const evidencias = await fetchEvidenciasParaIndicador(labId, indicadorId);
    results[indicadorId] = evidencias;
  });

  await Promise.all(promises);

  return results;
}

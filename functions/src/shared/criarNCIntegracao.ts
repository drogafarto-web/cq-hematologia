/**
 * criarNCIntegracao.ts
 *
 * Helper compartilhado para criação automática de NCs a partir de outros módulos.
 * Padrão: módulo detecta condição → chama criarNCIntegracao() → NC aparece no módulo unificado.
 *
 * Usado por: Equipamentos, Controle Temperatura, Insumos, Reclamações, Críticos, Treinamentos.
 * Collection destino: /labs/{labId}/naoConformidades (camelCase — ADR 0003)
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

export interface NCIntegracaoInput {
  labId: string;
  titulo: string;
  descricao: string;
  severidade: 'critica' | 'grave' | 'moderada' | 'leve';
  moduloOrigem: string; // ex: 'equipamentos', 'controle-temperatura', 'insumos'
  origemRef?: string; // ID do documento de origem (equipamentoId, insumoId, etc.)
  bloqueiaOperacoes?: boolean;
  modulosBloqueados?: string[];
  prazoDias?: number; // prazo para resolução (default: 15 para grave, 7 para crítica)
  criadoPor: string; // uid do sistema ou operador
}

export interface NCIntegracaoResult {
  ncId: string;
  ncCodigo: string;
}

/**
 * Cria uma NC automaticamente na collection correta.
 * Retorna null se falhar (não bloqueia o módulo de origem).
 */
export async function criarNCIntegracao(
  input: NCIntegracaoInput,
): Promise<NCIntegracaoResult | null> {
  try {
    const {
      labId,
      titulo,
      descricao,
      severidade,
      moduloOrigem,
      origemRef,
      bloqueiaOperacoes = severidade === 'critica' || severidade === 'grave',
      modulosBloqueados = [],
      prazoDias,
      criadoPor,
    } = input;

    // Sequência numérica
    const seqRef = db.doc(`labs/${labId}/nc-sequencia/_counter`);
    const seqSnap = await seqRef.get();
    const nextSeq = ((seqSnap.data()?.count as number) || 0) + 1;
    await seqRef.set({ count: nextSeq }, { merge: true });

    const ano = new Date().getFullYear();
    const ncCodigo = `NC-${ano}-${String(nextSeq).padStart(4, '0')}`;

    // Prazo default por severidade
    const prazo = prazoDias ?? (severidade === 'critica' ? 7 : severidade === 'grave' ? 15 : 30);
    const prazoClosure = Timestamp.fromMillis(Date.now() + prazo * 24 * 60 * 60 * 1000);

    // Criar NC
    const ncRef = db.collection(`labs/${labId}/naoConformidades`).doc();

    const ncDoc = {
      id: ncRef.id,
      labId,
      codigo: ncCodigo,
      titulo,
      descricao,
      severidade,
      origem: 'modulo' as const,
      moduloOrigem,
      auditoriaId: origemRef || null,
      bloqueiaOperacoes,
      modulosBloqueados,
      capaStatus: 'nao_iniciada' as const,
      capaHistorico: [
        {
          status: 'nao_iniciada',
          timestamp: Timestamp.now(),
          realizadoPor: 'system',
          realizadoPorName: `Sistema (${moduloOrigem})`,
          descricao: `NC auto-criada pelo módulo ${moduloOrigem}.`,
          evidencias: [],
        },
      ],
      abertaEm: Timestamp.now(),
      abertaPor: criadoPor,
      prazoClosure,
      fechadaEm: null,
      fechadaPor: null,
      deletadoEm: null,
    };

    await ncRef.set(ncDoc);

    return { ncId: ncRef.id, ncCodigo };
  } catch (error) {
    console.error(`[criarNCIntegracao] Erro ao criar NC (${input.moduloOrigem}):`, error);
    return null;
  }
}

/**
 * Verifica se já existe NC aberta para o mesmo módulo + origemRef.
 * Evita duplicatas (ex: não criar 2 NCs para o mesmo equipamento com calibração vencida).
 */
export async function ncJaExisteParaOrigem(
  labId: string,
  moduloOrigem: string,
  origemRef: string,
): Promise<boolean> {
  const snap = await db
    .collection(`labs/${labId}/naoConformidades`)
    .where('moduloOrigem', '==', moduloOrigem)
    .where('auditoriaId', '==', origemRef)
    .where('capaStatus', 'in', ['nao_iniciada', 'investigacao', 'acao', 'eficacia'])
    .where('deletadoEm', '==', null)
    .limit(1)
    .get();

  return !snap.empty;
}

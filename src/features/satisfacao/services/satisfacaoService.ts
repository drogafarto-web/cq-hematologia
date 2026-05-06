import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint,
  FieldValue,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId, UserId } from '../../../types';

export interface NPSResposta {
  id: string;
  labId: LabId;
  pacienteId: string | null;
  reclamacaoId?: string | null;
  nota: number;
  categoria: 'detrator' | 'neutro' | 'promotor';
  comentario: string;
  respondidoEm: any; // Timestamp
  anonimizadoEm: any | null;
  origem: 'pos-reclamacao' | 'trimestral';
}

export interface CampanhaSatisfacao {
  id: string;
  labId: LabId;
  titulo: string;
  descricao: string;
  tipo: 'trimestral' | 'custom';
  status: 'planejada' | 'ativa' | 'concluida';
  dataInicio: any;
  dataFim: any;
  template: string;
  criadoPor: UserId;
  criadoEm: any;
  deletadoEm?: any;
}

class SatisfacaoService {
  /**
   * Get NPS responses for a lab with filters
   */
  static async getRespostas(
    labId: LabId,
    filters?: {
      origem?: 'pos-reclamacao' | 'trimestral';
      dataInicio?: Date;
      dataFim?: Date;
      limit?: number;
    }
  ): Promise<NPSResposta[]> {
    const constraints: QueryConstraint[] = [
      where('labId', '==', labId),
      orderBy('respondidoEm', 'desc'),
    ];

    if (filters?.origem) {
      constraints.push(where('origem', '==', filters.origem));
    }

    if (filters?.limit) {
      constraints.push(limit(filters.limit));
    }

    const q = query(collection(db, `labs/${labId}/satisfacao-respostas`), ...constraints);
    const snap = await getDocs(q);

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as NPSResposta));
  }

  /**
   * Calculate NPS = % promotores - % detratores
   */
  static calculateNPS(respostas: NPSResposta[]): number {
    if (respostas.length === 0) return 0;

    const promotores = respostas.filter((r) => r.categoria === 'promotor').length;
    const detratores = respostas.filter((r) => r.categoria === 'detrator').length;

    return Math.round(((promotores - detratores) / respostas.length) * 100);
  }

  /**
   * Get breakdown by category
   */
  static getCategoryBreakdown(respostas: NPSResposta[]): {
    promotores: number;
    neutros: number;
    detratores: number;
  } {
    return {
      promotores: respostas.filter((r) => r.categoria === 'promotor').length,
      neutros: respostas.filter((r) => r.categoria === 'neutro').length,
      detratores: respostas.filter((r) => r.categoria === 'detrator').length,
    };
  }

  /**
   * Get campanhas for a lab
   */
  static async getCampanhas(labId: LabId): Promise<CampanhaSatisfacao[]> {
    const q = query(
      collection(db, `labs/${labId}/satisfacao-campanhas`),
      where('deletadoEm', '==', null),
      orderBy('dataInicio', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as CampanhaSatisfacao));
  }
}

export default SatisfacaoService;

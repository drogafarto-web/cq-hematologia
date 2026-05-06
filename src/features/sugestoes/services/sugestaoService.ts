import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
  DocumentData,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase';
import type { LabId } from '../../../types';

export interface Sugestao extends DocumentData {
  id: string;
  labId: LabId;
  titulo: string;
  descricao: string;
  categoria: 'produto' | 'processo' | 'ambiente' | 'atendimento' | 'outro';
  autorId?: string;
  autorTipo: 'colaborador' | 'paciente';
  status: 'aberta' | 'analisada' | 'implementada' | 'rejeitada';
  votos: number;
  motivo?: string;
  criadoEm: any;
  deletadoEm: any;
}

class SugestaoService {
  /**
   * Get sugestoes for a lab with filters
   */
  static async getSugestoes(
    labId: LabId,
    filters?: {
      categoria?: string;
      status?: string;
      ordenarPor?: 'votos' | 'recencia';
      limit?: number;
    }
  ): Promise<Sugestao[]> {
    const constraints: QueryConstraint[] = [
      where('labId', '==', labId),
      where('deletadoEm', '==', null),
    ];

    if (filters?.categoria) {
      constraints.push(where('categoria', '==', filters.categoria));
    }

    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    // Order by
    if (filters?.ordenarPor === 'votos') {
      constraints.push(orderBy('votos', 'desc'), orderBy('criadoEm', 'desc'));
    } else {
      constraints.push(orderBy('criadoEm', 'desc'));
    }

    if (filters?.limit) {
      // Note: Can't use limit with Firebase, use client-side slicing
    }

    const q = query(collection(db, `labs/${labId}/sugestoes`), ...constraints);
    const snap = await getDocs(q);

    let data = snap.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        } as Sugestao)
    );

    if (filters?.limit) {
      data = data.slice(0, filters.limit);
    }

    return data;
  }

  /**
   * Get single sugestao
   */
  static async getSugestao(labId: LabId, sugestaoId: string): Promise<Sugestao | null> {
    const docSnap = await db.doc(`labs/${labId}/sugestoes/${sugestaoId}`).get();
    if (!docSnap.exists()) return null;

    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Sugestao;
  }
}

export default SugestaoService;

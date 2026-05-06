import { Timestamp } from 'firebase/firestore';
import type { LabId, UserId } from './_shared_refs';
import { ExamClassification } from './releaseState';

/**
 * Configuração de exame para regras de liberação automática
 * Cada lab define qual tipo de exame (rotina/revisao-rt/bloqueio-critico)
 *
 * Exempro:
 * - "Glicose": rotina, auto-libera se Westgard OK + sem crítico
 * - "Hemograma": revisao-rt, sempre precisa RT (analisar manualmente)
 * - "Cultura": bloqueio-critico, qualquer positivo bloqueia
 */
export interface ExameConfig {
  // Identity
  id: string;
  labId: LabId;

  // Referência ao exame (Worklab code)
  examCode: string; // mesmo código usado em integração Worklab
  examName: string;

  // Classificação para auto-liberação
  classification: ExamClassification;

  // Controle
  autoReleaseEnabled: boolean; // lab pode desativar auto-liberar temporariamente
  cv_alvo?: number; // coeficiente de variação alvo (para Westgard)
  rtRevisorObrigatorioId?: UserId; // RT específico se definido

  // Audit
  criadoEm: Timestamp;
  deletadoEm: Timestamp | null; // soft-delete only
}

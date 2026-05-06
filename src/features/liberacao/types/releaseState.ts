/**
 * State machine estados para liberação de laudo
 * Pendente → Em Revisão → Liberado → Comunicado → Superado
 *     ↓ (auto)                           ↓ (via retificação)
 * Auto-Liberado ──────────────────────────┘
 */
export type ReleaseState =
  | 'Pendente'
  | 'Em Revisão'
  | 'Liberado'
  | 'Auto-Liberado'
  | 'Comunicado'
  | 'Superado';

/**
 * Classificação de exame para regra de liberação automática
 */
export type ExamClassification = 'rotina' | 'revisao-rt' | 'bloqueio-critico';

import { ExameConfig } from '../types/exameConfig';
import { ExamClassification } from '../types/releaseState';
import { Laudo } from '../types/laudo';

/**
 * Classifica um exame conforme config
 * Retorna a categoria que determina se auto-libera ou requer RT
 */
export function classifyExame(config: ExameConfig): ExamClassification {
  return config.classification;
}

/**
 * Contexto de decisão para auto-liberação
 */
export interface AutoReleaseContext {
  hasWestgardReject: boolean; // Violação Westgard
  hasCritico: boolean; // Valor crítico detectado
  hasMaterialRestrito: boolean; // Amostra com restrição
}

interface AutoReleaseDecision {
  autoRelease: boolean;
  reason: string;
}

/**
 * Determina se laudo pode ser auto-liberado
 *
 * Critérios:
 * 1. Auto-release deve estar habilitado no exame config
 * 2. Classificação deve permitir auto-release (rotina sim, revisao-rt não, bloqueio-critico depende de contexto)
 * 3. Nenhum bloqueador (Westgard, crítico, material restrito)
 *
 * @param laudo Laudo a verificar
 * @param config Configuração do exame
 * @param context Contexto de bloqueadores
 * @returns { autoRelease: boolean, reason: string }
 */
export function shouldAutoRelease(
  laudo: Laudo,
  config: ExameConfig,
  context: AutoReleaseContext,
): AutoReleaseDecision {
  // 1. Auto-release desativado pelo lab?
  if (!config.autoReleaseEnabled) {
    return {
      autoRelease: false,
      reason: 'Auto-release desativado pelo laboratório',
    };
  }

  // 2. Classificação permite?
  if (config.classification === 'revisao-rt') {
    return {
      autoRelease: false,
      reason: `Exame ${config.examName} classificado como 'revisao-rt' — sempre requer RT`,
    };
  }

  // 3. Bloqueadores presentes?
  if (config.classification === 'bloqueio-critico' && context.hasCritico) {
    return {
      autoRelease: false,
      reason: `Valor crítico detectado em exame ${config.examName} (bloqueio-critico)`,
    };
  }

  if (context.hasWestgardReject) {
    return {
      autoRelease: false,
      reason: 'Violação Westgard CLSI detectada — requer review RT',
    };
  }

  if (context.hasMaterialRestrito) {
    return {
      autoRelease: false,
      reason: 'Material de amostra restrito — requer revisão RT',
    };
  }

  // Se chegou aqui, auto-libera
  return {
    autoRelease: true,
    reason: 'Critérios de auto-liberação atendidos',
  };
}

/**
 * Classifica um exame conforme config
 * Puro — sem deps Firebase
 */

import type { ExamClassification, ExameConfig } from './types';
export type { ExamClassification, ExameConfig };

/**
 * Threshold de valor crítico (subset usado pela detecção server-side).
 */
export interface CriticoThreshold {
  analitoId?: string;
  analitoNome: string;
  unidade?: string;
  min?: number;
  max?: number;
  severidade?: 'alta' | 'media' | 'baixa';
  faixaIdade?: { minAnos?: number; maxAnos?: number };
  sexo?: 'M' | 'F' | 'NI';
  ativo?: boolean;
}

export interface CriticoMatch {
  exameId: string;
  threshold: CriticoThreshold;
  valor: number;
  severidade: 'alta' | 'media' | 'baixa';
  reason: string;
}

export interface AllCriticosResult {
  hasCritico: boolean;
  criticos: CriticoMatch[];
}

/**
 * Detect critical values for all exames in a laudo against a list of thresholds.
 * Server-side mirror of the web `criticoDetector.detectAllCriticos`.
 */
export function detectAllCriticos(
  exames: Array<{ id: string; resultados?: Array<{ value: number | string; unidade?: string }> }>,
  thresholds: CriticoThreshold[],
  paciente: { idade: number; sexo: 'M' | 'F' | 'NI' },
): AllCriticosResult {
  const criticos: CriticoMatch[] = [];

  for (const exame of exames) {
    for (const resultado of exame.resultados || []) {
      const valor = typeof resultado.value === 'string' ? parseFloat(resultado.value) : resultado.value;
      if (typeof valor !== 'number' || isNaN(valor)) continue;

      for (const t of thresholds) {
        if (t.ativo === false) continue;
        if (t.analitoId && t.analitoId !== exame.id) continue;
        if (t.unidade && resultado.unidade && t.unidade !== resultado.unidade) continue;
        if (t.sexo && t.sexo !== 'NI' && paciente.sexo !== 'NI' && t.sexo !== paciente.sexo) continue;
        if (t.faixaIdade?.minAnos != null && paciente.idade < t.faixaIdade.minAnos) continue;
        if (t.faixaIdade?.maxAnos != null && paciente.idade > t.faixaIdade.maxAnos) continue;

        let hit = false;
        let reason = '';
        if (t.min != null && valor < t.min) {
          hit = true;
          reason = `${t.analitoNome} ${valor} abaixo de mínimo crítico ${t.min}`;
        } else if (t.max != null && valor > t.max) {
          hit = true;
          reason = `${t.analitoNome} ${valor} acima de máximo crítico ${t.max}`;
        }

        if (hit) {
          criticos.push({
            exameId: exame.id,
            threshold: t,
            valor,
            severidade: t.severidade || 'alta',
            reason,
          });
          break;
        }
      }
    }
  }

  return { hasCritico: criticos.length > 0, criticos };
}

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
 * @param config Configuração do exame
 * @param context Contexto de bloqueadores
 * @returns { autoRelease: boolean, reason: string }
 */
export function shouldAutoRelease(
  config: ExameConfig,
  context: AutoReleaseContext
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

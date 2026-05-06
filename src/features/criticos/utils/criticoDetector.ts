/**
 * criticoDetector — Puro engine para detecção de valores críticos
 * Sem deps Firebase; roda server-side e client-side
 */

export interface CriticoThreshold {
  id: string;
  analitoId: string;
  analitoNome: string;
  min: number | null;
  max: number | null;
  unidade: string;
  severidade: 'alta' | 'baixa';
  condicional?: {
    idadeMin?: number;
    idadeMax?: number;
    sexo?: 'M' | 'F';
  };
  ativo: boolean;
}

export interface CriticoDetectionResult {
  isCritico: boolean;
  threshold?: CriticoThreshold;
  severidade?: 'alta' | 'baixa';
  reason?: string;
}

export interface AllCriticosResult {
  hasCritico: boolean;
  criticos: Array<{
    exameId: string;
    threshold: CriticoThreshold;
    valor: number;
    severidade: 'alta' | 'baixa';
    reason: string;
  }>;
}

/**
 * Detecta se um resultado individual é crítico
 */
export function detectCriticoEm(
  resultado: { value: number; analitoId: string; unidade: string },
  thresholds: CriticoThreshold[],
  paciente: { idade: number; sexo: 'M' | 'F' | 'NI' },
): CriticoDetectionResult {
  // Filtra thresholds aplicáveis
  const applicable = thresholds.filter((t) => {
    if (!t.ativo) return false;
    if (t.analitoId !== resultado.analitoId) return false;
    if (t.unidade !== resultado.unidade) return false;

    // Filtro condicional idade/sexo
    if (t.condicional?.sexo && t.condicional.sexo !== paciente.sexo) return false;
    if (t.condicional?.idadeMin && paciente.idade < t.condicional.idadeMin)
      return false;
    if (t.condicional?.idadeMax && paciente.idade > t.condicional.idadeMax)
      return false;

    return true;
  });

  // Verifica cada threshold aplicável
  for (const t of applicable) {
    if (t.min !== null && resultado.value < t.min) {
      return {
        isCritico: true,
        threshold: t,
        severidade: t.severidade,
        reason: `Abaixo de ${t.min}`,
      };
    }
    if (t.max !== null && resultado.value > t.max) {
      return {
        isCritico: true,
        threshold: t,
        severidade: t.severidade,
        reason: `Acima de ${t.max}`,
      };
    }
  }

  return { isCritico: false };
}

/**
 * Detecta todos os críticos em um laudo
 */
export function detectAllCriticos(
  exames: any[],
  thresholds: CriticoThreshold[],
  paciente: { idade: number; sexo: 'M' | 'F' | 'NI' },
): AllCriticosResult {
  const criticos: AllCriticosResult['criticos'] = [];

  for (const exame of exames) {
    for (const resultado of exame.resultados || []) {
      const res = detectCriticoEm(
        {
          value: resultado.value,
          analitoId: exame.id,
          unidade: resultado.unidade,
        },
        thresholds,
        paciente,
      );

      if (res.isCritico && res.threshold) {
        criticos.push({
          exameId: exame.id,
          threshold: res.threshold,
          valor: resultado.value,
          severidade: res.severidade || 'alta',
          reason: res.reason || '',
        });
      }
    }
  }

  return {
    hasCritico: criticos.length > 0,
    criticos,
  };
}

/**
 * criticoDetector — Pure engine para detecção de valores críticos e SLA
 * Phase 5: W2-A2 critical value detection + SLA escalation
 * RDC 978 Art. 128 (rastreabilidade) + DICQ 4.3
 *
 * No Firebase dependencies; roda server-side (functions) e client-side (UI).
 */

// ─── Types ────────────────────────────────────────────────────────────────

export interface CriticoThreshold {
  id: string;
  labId: string;
  analitoId: string;
  analitoNome: string;
  min: number | null;
  max: number | null;
  unidade: string;
  severidade: 'alta' | 'baixa';
  alwaysCritico?: boolean;
  neverCritico?: boolean;
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

export interface CriticosConfig {
  ativo: boolean;
  canaisPrefixo: 'SMS' | 'EMAIL' | 'SMS_THEN_EMAIL';
  slaMinutosTarget: number;
  slaAlertas: {
    minutos50Pct: number;
    minutos100Pct: number;
  };
}

export interface SLADeadlines {
  tier1Deadline: Date;
  tier2Deadline: Date;
  tier3Deadline: Date;
  status: 'em_prazo' | 'vencido' | 'nao_aplicavel';
}

export interface EscalationChannel {
  order: number;
  canal: 'SMS' | 'EMAIL' | 'WEBHOOK';
  retry: boolean;
}

// ─── Core Detection ──────────────────────────────────────────────────────

/**
 * isCritico — Detecta se um resultado é crítico
 *
 * Returns { isCritico: true, threshold, severidade } ou { isCritico: false }
 */
export function isCritico(
  result: number,
  thresholds: CriticoThreshold[],
  paciente?: { idade: number; sexo: 'M' | 'F' | 'NI' },
): { isCritico: boolean; threshold?: CriticoThreshold; severidade?: 'alta' | 'baixa' } {
  // Apply each active threshold in order
  for (const t of thresholds) {
    if (!t.ativo || t.neverCritico) continue;

    // Check conditional age/sex
    if (paciente) {
      if (t.condicional?.sexo && t.condicional.sexo !== paciente.sexo) continue;
      if (t.condicional?.idadeMin && paciente.idade < t.condicional.idadeMin) continue;
      if (t.condicional?.idadeMax && paciente.idade > t.condicional.idadeMax) continue;
    }

    // Always mark as critical if flag set
    if (t.alwaysCritico) {
      return { isCritico: true, threshold: t, severidade: t.severidade };
    }

    // Check min/max boundaries
    if (t.min !== null && result < t.min) {
      return { isCritico: true, threshold: t, severidade: t.severidade };
    }
    if (t.max !== null && result > t.max) {
      return { isCritico: true, threshold: t, severidade: t.severidade };
    }
  }

  return { isCritico: false };
}

// ─── SLA Calculation ─────────────────────────────────────────────────────

/**
 * calculateSLA — Compute tier deadlines from detection time
 *
 * Tier 1: 15 min (RT)
 * Tier 2: 30 min (Physician)
 * Tier 3: 60 min (CTO) — RDC 978 Art. 5.7.1 max
 */
export function calculateSLA(criticoTime: Date, labConfig: CriticosConfig): SLADeadlines {
  if (!labConfig.ativo) {
    return {
      tier1Deadline: new Date(criticoTime.getTime() + 15 * 60 * 1000),
      tier2Deadline: new Date(criticoTime.getTime() + 30 * 60 * 1000),
      tier3Deadline: new Date(criticoTime.getTime() + 60 * 60 * 1000),
      status: 'nao_aplicavel',
    };
  }

  const slaTarget = labConfig.slaMinutosTarget || 60;
  return {
    tier1Deadline: new Date(criticoTime.getTime() + 15 * 60 * 1000),
    tier2Deadline: new Date(criticoTime.getTime() + 30 * 60 * 1000),
    tier3Deadline: new Date(criticoTime.getTime() + slaTarget * 60 * 1000),
    status: 'em_prazo',
  };
}

// ─── Deadline Verification ──────────────────────────────────────────────

/**
 * isOverdue — Check if deadline has passed
 */
export function isOverdue(deadline: Date, now: Date = new Date()): boolean {
  return now.getTime() > deadline.getTime();
}

// ─── Escalation Routing ─────────────────────────────────────────────────

/**
 * generateEscalationPath — Determine channel sequence (SMS → Email → Webhook)
 *
 * RDC 978 Art. 5.7.1: Escalation must happen within 60 minutes.
 * Order depends on lab config preference.
 */
export function generateEscalationPath(
  critico: CriticoThreshold,
  config: CriticosConfig,
): EscalationChannel[] {
  const baseChannels: EscalationChannel[] = [];

  if (config.canaisPrefixo === 'SMS' || config.canaisPrefixo === 'SMS_THEN_EMAIL') {
    baseChannels.push({ order: 1, canal: 'SMS', retry: true });
  }

  if (config.canaisPrefixo === 'EMAIL' || config.canaisPrefixo === 'SMS_THEN_EMAIL') {
    baseChannels.push({
      order: config.canaisPrefixo === 'SMS_THEN_EMAIL' ? 2 : 1,
      canal: 'EMAIL',
      retry: true,
    });
  }

  // Webhook as final fallback for high-severity
  if (critico.severidade === 'alta') {
    baseChannels.push({
      order: baseChannels.length + 1,
      canal: 'WEBHOOK',
      retry: false,
    });
  }

  return baseChannels.sort((a, b) => a.order - b.order);
}

// ─── Confidence Validation ──────────────────────────────────────────────

/**
 * validateConfidenceThreshold — Enforce confidence >= 0.85
 *
 * Used by AI/OCR path to ensure critical value detection confidence.
 * Throws if below threshold (no silent failures in production).
 */
export function validateConfidenceThreshold(confidence: number): void {
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new Error(`Invalid confidence: ${confidence}. Must be number in [0, 1].`);
  }
  if (confidence < 0.85) {
    throw new Error(
      `Confidence ${confidence.toFixed(3)} below 0.85 threshold. ` +
        'AI-detected critical values require manual review.',
    );
  }
}

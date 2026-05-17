/**
 * anomalyDetector.ts
 *
 * Multi-dimensional anomaly detection engine for audit trail entries.
 * Phase 7 Wave 2 — Advanced Auditoria
 *
 * RDC 978 Art. 107 — Anomaly detection in audit trail
 * DICQ 4.4 — Audit monitoring
 *
 * 5 dimensions:
 * - operation_rarity: action vs operator baseline
 * - time_anomaly: hour vs operator hourly distribution
 * - result_rarity: failure rate vs historical
 * - velocity: burst of operations in short window
 * - module_jump: rapid module switching
 */

import * as admin from 'firebase-admin';
import type { AuditEntry, BaselineStats, AnomalyDimension, DimensionScore } from '../types/anomalyTypes';

const db = admin.firestore();

export interface AnomalyDetectionResult {
  entryId: string;
  overall: number;
  dimensions: DimensionScore[];
  flags: string[];
}

const DIMENSION_WEIGHTS: Record<AnomalyDimension, number> = {
  operation_rarity: 0.25,
  time_anomaly: 0.15,
  result_rarity: 0.20,
  velocity: 0.25,
  module_jump: 0.15,
};

/**
 * Detect anomalies in audit entry based on operator baseline.
 */
export async function detectAnomalies(
  entry: AuditEntry,
  baseline: BaselineStats
): Promise<AnomalyDetectionResult> {
  const dimensions: DimensionScore[] = [];
  const flags: string[] = [];

  // 1. Operation Rarity
  const opRarity = scoreOperationRarity(entry.action, baseline);
  dimensions.push(opRarity);
  if (opRarity.score >= 80) flags.push('rare_operation');

  // 2. Time Anomaly
  const timeAnomaly = scoreTimeAnomaly(entry.timestamp, baseline);
  dimensions.push(timeAnomaly);
  if (timeAnomaly.score >= 80) flags.push('unusual_hour');

  // 3. Result Rarity
  const resultRarity = scoreResultRarity(entry, baseline);
  dimensions.push(resultRarity);
  if (resultRarity.score >= 80) flags.push('unusual_result');

  // 4. Velocity
  const velocity = await scoreVelocity(entry);
  dimensions.push(velocity);
  if (velocity.score >= 80) flags.push('burst_detected');

  // 5. Module Jump
  const moduleJump = await scoreModuleJump(entry);
  dimensions.push(moduleJump);
  if (moduleJump.score >= 80) flags.push('rapid_module_switch');

  // Weighted average
  const overall = dimensions.reduce(
    (sum, d) => sum + d.score * (DIMENSION_WEIGHTS[d.dimension] || 0.2),
    0
  ) / 100;

  return {
    entryId: entry.id,
    overall: Math.min(1, Math.max(0, overall)),
    dimensions,
    flags,
  };
}

function scoreOperationRarity(action: string, baseline: BaselineStats): DimensionScore {
  const total = baseline.totalEntries || 1;
  const actionCount = baseline.operationCounts[action] || 0;
  const frequency = actionCount / total;

  let score = 0;
  let evidence = '';

  if (actionCount === 0) {
    score = 95;
    evidence = `Operação "${action}" nunca realizada por este operador`;
  } else if (frequency < 0.01) {
    score = 80;
    evidence = `Operação "${action}" representa <1% do histórico (${actionCount}/${total})`;
  } else if (frequency < 0.05) {
    score = 50;
    evidence = `Operação "${action}" é incomum (${(frequency * 100).toFixed(1)}% do histórico)`;
  } else {
    score = Math.max(0, 30 - frequency * 100);
    evidence = `Operação "${action}" é rotineira (${(frequency * 100).toFixed(1)}%)`;
  }

  return { dimension: 'operation_rarity', score, evidence };
}

function scoreTimeAnomaly(timestamp: number, baseline: BaselineStats): DimensionScore {
  const hour = new Date(timestamp).getHours();
  const hourlyPattern = baseline.hourlyPattern;
  const totalOps = hourlyPattern.reduce((a, b) => a + b, 0) || 1;
  const hourFrequency = (hourlyPattern[hour] || 0) / totalOps;

  let score = 0;
  let evidence = '';

  if (hourFrequency === 0) {
    score = 90;
    evidence = `Operação às ${hour}h — horário sem histórico para este operador`;
  } else if (hourFrequency < 0.02) {
    score = 70;
    evidence = `Operação às ${hour}h — horário raro (<2% das operações)`;
  } else if (hourFrequency < 0.05) {
    score = 40;
    evidence = `Operação às ${hour}h — horário pouco frequente`;
  } else {
    score = 10;
    evidence = `Operação às ${hour}h — dentro do padrão habitual`;
  }

  return { dimension: 'time_anomaly', score, evidence };
}

function scoreResultRarity(entry: AuditEntry, baseline: BaselineStats): DimensionScore {
  const entropy = baseline.entropyScore || 0;

  let score = 0;
  let evidence = '';

  if (entropy > 0.8) {
    score = 75;
    evidence = 'Alta entropia nos resultados recentes — padrão irregular';
  } else if (entropy > 0.5) {
    score = 40;
    evidence = 'Entropia moderada nos resultados';
  } else {
    score = 10;
    evidence = 'Resultados dentro do padrão esperado';
  }

  return { dimension: 'result_rarity', score, evidence };
}

async function scoreVelocity(entry: AuditEntry): Promise<DimensionScore> {
  const fiveMinAgo = entry.timestamp - 5 * 60 * 1000;

  let score = 0;
  let evidence = '';

  try {
    const recentSnap = await db
      .collection('labs')
      .doc(entry.labId)
      .collection('audit-trail')
      .where('operatorId', '==', entry.operatorId)
      .where('timestamp', '>=', fiveMinAgo)
      .where('timestamp', '<=', entry.timestamp)
      .get();

    const count = recentSnap.size;

    if (count >= 50) {
      score = 95;
      evidence = `${count} operações em 5 min — burst extremo`;
    } else if (count >= 20) {
      score = 75;
      evidence = `${count} operações em 5 min — velocidade alta`;
    } else if (count >= 10) {
      score = 40;
      evidence = `${count} operações em 5 min — acima do normal`;
    } else {
      score = 5;
      evidence = `${count} operações em 5 min — velocidade normal`;
    }
  } catch (err) {
    score = 0;
    evidence = 'Não foi possível calcular velocidade';
  }

  return { dimension: 'velocity', score, evidence };
}

async function scoreModuleJump(entry: AuditEntry): Promise<DimensionScore> {
  const twoMinAgo = entry.timestamp - 2 * 60 * 1000;

  let score = 0;
  let evidence = '';

  try {
    const recentSnap = await db
      .collection('labs')
      .doc(entry.labId)
      .collection('audit-trail')
      .where('operatorId', '==', entry.operatorId)
      .where('timestamp', '>=', twoMinAgo)
      .where('timestamp', '<=', entry.timestamp)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const modules = new Set<string>();
    recentSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.moduleId) modules.add(data.moduleId);
    });

    const uniqueModules = modules.size;

    if (uniqueModules >= 5) {
      score = 90;
      evidence = `${uniqueModules} módulos diferentes em 2 min — troca muito rápida`;
    } else if (uniqueModules >= 3) {
      score = 60;
      evidence = `${uniqueModules} módulos em 2 min — troca frequente`;
    } else {
      score = 5;
      evidence = `${uniqueModules} módulo(s) em 2 min — padrão normal`;
    }
  } catch (err) {
    score = 0;
    evidence = 'Não foi possível calcular module jump';
  }

  return { dimension: 'module_jump', score, evidence };
}

/**
 * Fetch or compute baseline for an operator.
 */
export async function getOperatorBaseline(
  labId: string,
  operatorId: string
): Promise<BaselineStats> {
  try {
    const baselineDoc = await db
      .collection('labs')
      .doc(labId)
      .collection('anomaly-baselines')
      .doc(operatorId)
      .get();

    if (baselineDoc.exists) {
      const data = baselineDoc.data()!;
      return {
        operationCounts: data.operationCounts || {},
        moduleFrequency: data.moduleFrequency || {},
        hourlyPattern: data.hourlyPattern || new Array(24).fill(0),
        totalEntries: data.totalEntries || 0,
        entropyScore: data.entropyScore || 0,
      };
    }
  } catch (err) {
    console.warn('[anomalyDetector] Failed to fetch baseline', { labId, operatorId });
  }

  return {
    operationCounts: {},
    moduleFrequency: {},
    hourlyPattern: new Array(24).fill(0),
    totalEntries: 0,
    entropyScore: 0,
  };
}

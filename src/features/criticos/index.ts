/**
 * Criticos Module — Critical Value Detection & Escalation
 *
 * Phase 5 Wave 2 — Task 05-01
 * RDC 978 Art. 17 — Critical Value Management
 * DICQ 5.8.7 — Threshold Definition and Escalation
 *
 * Phase 10-03 production shell + Phase 5 core services
 */

// Phase 10 Shell & Components
export { default } from './CriticosShell';
export { CriticosThresholdsAdmin } from './components/CriticosThresholdsAdmin';
export { CriticosEscalacaoList } from './components/CriticosEscalacaoList';
export { ComunicacaoModal } from './components/ComunicacaoModal';

// Phase 5 Core Services
export type { CriticoThreshold, CriticoThresholdInput, RoutingRule, RoutingRuleInput, AnalyteRegistry, EscalationRecipients } from './types/threshold';

export { getThresholds, createThreshold, updateThreshold, softDeleteThreshold, getThresholdById, listThresholdsByAnalyte, validateThresholdInput } from './services/thresholdService';

export { getEscalationRecipients, getRoutingRules, mergeEscalationRecipients } from './utils/routingEngine';
export type { CriticoDetectionResult } from './utils/routingEngine';

// Phase 5 UI Components
export { ThresholdConfigPanel } from './components/ThresholdConfigPanel';

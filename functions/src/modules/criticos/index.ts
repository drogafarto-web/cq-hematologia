/**
 * Críticos (Critical Values) Escalation Module
 * Phase 6: SMS + Email escalation for critical lab results
 *
 * Implements RDC 978 Art. 128 (rastreabilidade)
 * Implements DICQ 4.3 (actions on critical values)
 */

export { acknowledgeEscalacao } from './acknowledge';
export { escalacaoCriticos, escalacaoCriticos_webhook } from './cron';
// Canonical registerCriticoDetection: standalone file with cors:true + full Zod validation + tier-SLA logic
export { registerCriticoDetection } from './registerDetection';

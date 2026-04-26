/**
 * Re-exports das callables do módulo CT (Fase 0b equivalente do EC).
 *
 * Por enquanto só `ct_commitLeitura`. Próximos candidatos (backlog):
 *   - `ct_resolverNC` — ação corretiva com assinatura server-side
 *   - `ct_registrarCalibracao` — RN-09 com Admin SDK
 */

export { ct_commitLeitura } from './commitLeitura';

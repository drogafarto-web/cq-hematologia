import { createHash } from 'crypto';

// Genesis hash determinístico por lab — primeira entrada da cadeia.
// Uma mudança neste prefixo invalida toda a cadeia existente. NÃO MEXER.
const GENESIS_PREFIX = 'hcq-audit-genesis:';

export function genesisHash(labId: string): string {
  return createHash('sha256').update(GENESIS_PREFIX + labId).digest('hex');
}

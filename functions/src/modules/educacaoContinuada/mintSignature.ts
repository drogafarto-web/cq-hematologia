/**
 * ec_mintSignature — assinatura server-side em lote para escritas que
 * permanecem client-side (execucão planejada via ExecucaoForm e via
 * ImportTreinamentosModal).
 *
 * Para escritas regulatórias (commitRealizada/Adiada, registrar*) o caller
 * NÃO usa esta função — as callables específicas geram assinatura internamente.
 *
 * Transport: `ts` é serializado como `tsMillis: number`. Cliente reconstrói
 * via `Timestamp.fromMillis(tsMillis)`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';

import { assertEcAccess, MintSignatureInputSchema } from './validators';
import { generateEcSignatureServer } from './signatureCanonical';
import { writeAuditLog } from '../../shared/audit/writeAuditLog';

interface MintedSignatureWire {
  hash: string;
  operatorId: string;
  tsMillis: number;
}

export const ec_mintSignature = onCall<unknown, Promise<{ signatures: MintedSignatureWire[] }>>(
  {},
  async (request) => {
    const parsed = MintSignatureInputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', `Dados inválidos: ${parsed.error.message}`);
    }
    const { labId, payloads } = parsed.data;

    await assertEcAccess(request.auth, labId);
    const uid = request.auth!.uid;

    const signatures: MintedSignatureWire[] = payloads.map((payload) => {
      const sig = generateEcSignatureServer(uid, payload);
      return {
        hash: sig.hash,
        operatorId: sig.operatorId,
        tsMillis: sig.ts.toMillis(),
      };
    });

    // Audit — best-effort com retry + fallback (alta cardinalidade aceitável, cap de 500 no schema)
    await writeAuditLog({
      action: 'EC_MINT_SIGNATURE',
      callerUid: uid,
      labId,
      payload: { count: signatures.length },
    });

    return { signatures };
  },
);

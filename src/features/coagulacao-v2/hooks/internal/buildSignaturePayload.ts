import type { CoagAnalyteId } from '../../../coagulacao/types/_shared_refs';

export function buildAttemptSignaturePayload(
  operatorDoc: string,
  controlOperacionalId: string,
  resultados: Record<CoagAnalyteId, number>,
  dataRealizacao: string,
): string {
  const canonicalResults = JSON.stringify(
    Object.fromEntries(
      Object.entries(resultados).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
  return `${operatorDoc}|${controlOperacionalId}|${canonicalResults}|${dataRealizacao}`;
}

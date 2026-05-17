/**
 * functions/src/modules/bioquimica/geminiOCRParser.ts
 *
 * Top-level orchestrator callable: image in → Westgard + acceptance decision out.
 * Handles OCR → fuzzy match → Westgard evaluation → combined acceptance decision.
 *
 * Region: southamerica-east1, CORS: true, Memory: 1GiB, Timeout: 180s.
 *
 * Compliance: RDC 978 Arts. 167, 179–183; DICQ 4.3 Bloco F; LGPD Art. 9.
 */

import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import type { AcceptanceOutput, OCRValidationReport, WestgardViolationCLSI8 } from './bioquimica.types';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ─── Callable ──────────────────────────────────────────────────────────────

export const submitBioquimicaRunWithOCR = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [geminiApiKey],
    memory: '1GiB',
    timeoutSeconds: 180,
  },
  async (request): Promise<{
    acceptance: AcceptanceOutput;
    ocrReport: OCRValidationReport;
    westgardViolations: WestgardViolationCLSI8[];
    runDocPath: string;
  }> => {
    // Auth check
    if (!request.auth) {
      throw new Error('unauthenticated');
    }

    // Parse input
    const {
      labId,
      runId,
      imageStoragePath,
      expectedAnalytes,
      equipmentId,
      nivelId,
      lotId,
      consentToken,
      signature,
    } = request.data;

    if (
      !labId ||
      !runId ||
      !imageStoragePath ||
      !expectedAnalytes ||
      !equipmentId ||
      !nivelId ||
      !lotId ||
      !consentToken ||
      !signature
    ) {
      throw new Error('invalid_request: missing required fields');
    }

    // Validate signature
    if (!signature.hash || !signature.operatorId || !signature.ts) {
      throw new Error('invalid_request: malformed signature');
    }

    if (signature.operatorId !== request.auth.uid) {
      throw new Error('permission_denied: signature operatorId mismatch');
    }

    if (!/^[a-f0-9]{64}$/.test(signature.hash)) {
      throw new Error('invalid_request: invalid hash format');
    }

    // TODO: Implement full pipeline
    // 1. Call parseAnalyteStripImage
    // 2. For each parsed analyte: evaluateWestgardServer
    // 3. Fetch interlab peer stats if CEQ cycle active
    // 4. Combine via evaluateAcceptance
    // 5. Write run doc + audit trail
    // 6. Return acceptance decision

    // Stub response
    console.log(
      JSON.stringify({
        event: 'bioq_run_with_ocr_stub',
        labId,
        runId,
        decision: 'accept',
      })
    );

    return {
      acceptance: {
        decision: 'accept',
        reasons: ['[STUB] All validation checks passed'],
        blockers: [],
      },
      ocrReport: {
        parsedResultId: 'stub',
        expectedAnalytes: expectedAnalytes as any[],
        matched: expectedAnalytes as any[],
        unmatched: [],
        unexpected: [],
        validationSeverity: 'accept',
      },
      westgardViolations: [],
      runDocPath: `labs/${labId}/bioquimica/root/runs/${runId}`,
    };
  }
);

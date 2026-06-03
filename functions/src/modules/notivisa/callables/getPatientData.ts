/**
 * getPatientData — Callable to retrieve patient data for NOTIVISA submission
 * Phase 4 — Fetches patient demographics, validates data completeness, returns formatted payload
 *
 * Input: { labId, pacienteCpf, laudoId? }
 * Output: { ok, paciente, laudo, readyForSubmission }
 *
 * RDC 978 Art. 66 - Validates that all required fields are present before submission.
 * Returns minimal error detail to avoid exposing PII.
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { assertNotivisaAccess } from '../validators';

const getPatientDataInputSchema = z.object({
  labId: z.string().min(1, 'labId required'),
  pacienteCpf: z.string().regex(/^\d{11}$/, 'CPF must be 11 digits'),
  laudoId: z.string().optional(),
});

const pacienteSchema = z.object({
  cpf: z.string(),
  nome: z.string(),
  dataNascimento: z.number().int().optional(),
  sexo: z.enum(['M', 'F', 'O']).optional(),
  mae: z.string().optional(),
});

const laudoSchema = z.object({
  id: z.string(),
  pacienteCpf: z.string(),
  resultadoEm: z.number().int(),
  resultados: z.array(
    z.object({
      analito: z.string(),
      valor: z.union([z.string(), z.number()]),
      unidade: z.string(),
      referencia: z.string(),
    }),
  ),
  assinatura: z.object({
    operatorCpf: z.string(),
    operatorNome: z.string(),
    ts: z.number().int(),
  }),
});

const getPatientDataOutputSchema = z.object({
  ok: z.literal(true),
  paciente: pacienteSchema,
  laudo: laudoSchema,
  readyForSubmission: z.boolean(),
  missingFields: z.array(z.string()).optional(),
});

const getPatientDataErrorSchema = z.object({
  ok: z.literal(false),
  code: z.enum([
    'PATIENT_NOT_FOUND',
    'LAUDO_NOT_FOUND',
    'INCOMPLETE_DATA',
    'PERMISSION_DENIED',
    'INTERNAL_ERROR',
  ]),
  message: z.string(),
});

type GetPatientDataInput = z.infer<typeof getPatientDataInputSchema>;
type GetPatientDataOutput = z.infer<typeof getPatientDataOutputSchema>;
type GetPatientDataError = z.infer<typeof getPatientDataErrorSchema>;

export const getPatientData = functions
  .region('southamerica-east1')
  .onCall(async (request): Promise<GetPatientDataOutput | GetPatientDataError> => {
    try {
      // ========== 1. Validate request ==========
      if (!request.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
      }

      const input = getPatientDataInputSchema.parse(request.data);
      const { labId, pacienteCpf, laudoId } = input;
      const uid = request.auth.uid;

      // ========== 2. Authorization check ==========
      try {
        await assertNotivisaAccess(request.auth, labId);
      } catch (error: any) {
        return {
          ok: false,
          code: 'PERMISSION_DENIED',
          message: error.message || 'User does not have NOTIVISA access',
        };
      }

      const db = admin.firestore();

      // ========== 3. Fetch patient data ==========
      const pacienteSnap = await db
        .collection('labs')
        .doc(labId)
        .collection('pacientes')
        .where('cpf', '==', pacienteCpf)
        .limit(1)
        .get();

      if (pacienteSnap.empty) {
        return {
          ok: false,
          code: 'PATIENT_NOT_FOUND',
          message: 'Patient not found in database',
        };
      }

      const pacienteDoc = pacienteSnap.docs[0];
      const pacienteData = pacienteDoc.data();

      // ========== 4. Validate patient data completeness ==========
      const pacienteValidation = validatePatientData(pacienteData);
      if (!pacienteValidation.valid) {
        return {
          ok: false,
          code: 'INCOMPLETE_DATA',
          message: 'Patient data is incomplete',
          missingFields: pacienteValidation.missingFields,
        };
      }

      const paciente = {
        cpf: pacienteData.cpf,
        nome: pacienteData.nome,
        dataNascimento: pacienteData.dataNascimento,
        sexo: pacienteData.sexo,
        mae: pacienteData.mae,
      };

      // ========== 5. Fetch laudo (latest or specified) ==========
      let laudoQuery = db
        .collection('labs')
        .doc(labId)
        .collection('laudos')
        .where('pacienteCpf', '==', pacienteCpf)
        .orderBy('resultadoEm', 'desc')
        .limit(1);

      if (laudoId) {
        laudoQuery = db
          .collection('labs')
          .doc(labId)
          .collection('laudos')
          .where('id', '==', laudoId)
          .where('pacienteCpf', '==', pacienteCpf);
      }

      const laudoSnap = await laudoQuery.get();

      if (laudoSnap.empty) {
        return {
          ok: false,
          code: 'LAUDO_NOT_FOUND',
          message: 'No laudo found for this patient',
        };
      }

      const laudoDoc = laudoSnap.docs[0];
      const laudoData = laudoDoc.data();

      // ========== 6. Validate laudo data completeness ==========
      const laudoValidation = validateLaudoData(laudoData);
      if (!laudoValidation.valid) {
        return {
          ok: false,
          code: 'INCOMPLETE_DATA',
          message: 'Laudo data is incomplete',
          missingFields: laudoValidation.missingFields,
        };
      }

      const laudo = {
        id: laudoData.id || laudoDoc.id,
        pacienteCpf: laudoData.pacienteCpf,
        resultadoEm: laudoData.resultadoEm,
        resultados: (laudoData.resultados || []).map((r: any) => ({
          analito: r.analito || '',
          valor: r.valor !== undefined ? r.valor : '',
          unidade: r.unidade || '',
          referencia: r.referencia || '',
        })),
        assinatura: {
          operatorCpf: laudoData.assinatura?.operatorCpf || '',
          operatorNome: laudoData.assinatura?.operatorNome || '',
          ts: laudoData.assinatura?.ts || 0,
        },
      };

      // ========== 7. Final readiness check ==========
      const allMissingFields = [
        ...pacienteValidation.missingFields,
        ...laudoValidation.missingFields,
      ];
      const readyForSubmission = allMissingFields.length === 0;

      // ========== 8. Log data retrieval ==========
      await db
        .collection('notivisa-audit-logs')
        .doc(labId)
        .collection('data-access')
        .doc(`${Date.now()}`)
        .set({
          action: 'PATIENT_DATA_RETRIEVED',
          operatorId: uid,
          ts: Date.now(),
          pacienteCpf: pacienteCpf.substring(0, 3) + '***', // Mask CPF
          laudoId: laudo.id,
          readyForSubmission,
        });

      functions.logger.info('[NOTIVISA] Patient data retrieved', {
        labId,
        uid,
        pacienteCpf: pacienteCpf.substring(0, 3) + '***',
        readyForSubmission,
      });

      return {
        ok: true,
        paciente,
        laudo,
        readyForSubmission,
        missingFields: allMissingFields.length > 0 ? allMissingFields : undefined,
      };
    } catch (error: any) {
      functions.logger.error('[getPatientData] Error:', error);

      if (error instanceof z.ZodError) {
        return {
          ok: false,
          code: 'INTERNAL_ERROR',
          message: `Validation error: ${error.errors[0].message}`,
        };
      }

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      return {
        ok: false,
        code: 'INTERNAL_ERROR',
        message: error.message || 'Internal error retrieving patient data',
      };
    }
  });

/**
 * Validate patient data completeness for NOTIVISA submission
 */
function validatePatientData(data: any): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!data.cpf) missingFields.push('paciente.cpf');
  if (!data.nome) missingFields.push('paciente.nome');
  if (!data.dataNascimento) missingFields.push('paciente.dataNascimento');
  if (!data.sexo) missingFields.push('paciente.sexo');
  if (!data.mae) missingFields.push('paciente.mae');

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate laudo data completeness for NOTIVISA submission
 */
function validateLaudoData(data: any): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!data.id && !data.laudoId) missingFields.push('laudo.id');
  if (!data.pacienteCpf) missingFields.push('laudo.pacienteCpf');
  if (!data.resultadoEm) missingFields.push('laudo.resultadoEm');
  if (!Array.isArray(data.resultados) || data.resultados.length === 0) {
    missingFields.push('laudo.resultados');
  } else {
    // Validate each resultado
    data.resultados.forEach((r: any, idx: number) => {
      if (!r.analito) missingFields.push(`laudo.resultados[${idx}].analito`);
      if (r.valor === undefined || r.valor === null || r.valor === '') {
        missingFields.push(`laudo.resultados[${idx}].valor`);
      }
      if (!r.unidade) missingFields.push(`laudo.resultados[${idx}].unidade`);
    });
  }

  if (!data.assinatura?.operatorCpf) missingFields.push('laudo.assinatura.operatorCpf');
  if (!data.assinatura?.operatorNome) missingFields.push('laudo.assinatura.operatorNome');
  if (!data.assinatura?.ts) missingFields.push('laudo.assinatura.ts');

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

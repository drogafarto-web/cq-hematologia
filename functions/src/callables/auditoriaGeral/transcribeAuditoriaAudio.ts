import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';
import { z } from 'zod';
import { logger } from 'firebase-functions';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

const inputSchema = z.object({
  labId: z.string().min(1),
  auditoriaId: z.string().min(1),
  indicadorId: z.string().min(1),
  audioPath: z.string().min(1),
});

export const transcribeAuditoriaAudio = onCall(
  {
    region: 'southamerica-east1',
    cors: true,
    secrets: [geminiApiKey],
    memory: '512MiB',
    timeoutSeconds: 60,
  },
  async (request): Promise<{ transcription: string }> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Auth required');
    }

    const parsed = inputSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid input: ' + parsed.error.message);
    }

    const { labId, audioPath } = parsed.data;
    const uid = request.auth.uid;

    const memberSnap = await admin.firestore()
      .doc(`labs/${labId}/members/${uid}`)
      .get();
    if (!memberSnap.exists || memberSnap.data()?.status !== 'active') {
      throw new HttpsError('permission-denied', 'Not an active member of this lab');
    }

    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(audioPath);
      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'Audio file not found');
      }

      const [audioBuffer] = await file.download();
      const base64Audio = audioBuffer.toString('base64');

      const genAI = new GoogleGenAI({ apiKey: geminiApiKey.value() });
      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: 'Transcreva o seguinte audio de auditoria laboratorial em portugues. Retorne apenas o texto transcrito, sem formatacao.' },
              { inlineData: { mimeType: 'audio/webm', data: base64Audio } },
            ],
          },
        ],
      });

      const transcription = response.text?.trim() ?? '';
      if (!transcription) {
        throw new HttpsError('internal', 'Empty transcription returned');
      }

      logger.info('Audio transcribed', { labId, audioPath, length: transcription.length });
      return { transcription };
    } catch (err: any) {
      if (err instanceof HttpsError) throw err;
      logger.error('Transcription failed', { error: err.message, audioPath });
      throw new HttpsError('internal', 'Transcription failed: ' + err.message);
    }
  }
);

import * as admin from 'firebase-admin';

const db = admin.firestore();

const DEFAULT_MODEL = 'gemini-2.5-flash';
const ALLOWED_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

let cachedModel: string | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getGeminiModel(labId?: string): Promise<string> {
  const now = Date.now();
  if (cachedModel && now - cacheTs < CACHE_TTL_MS) {
    return cachedModel;
  }

  try {
    const path = labId
      ? `labs/${labId}/settings/ai`
      : 'platform/ai-config';
    const snap = await db.doc(path).get();
    const model = snap.data()?.geminiModel;
    if (model && ALLOWED_MODELS.includes(model)) {
      cachedModel = model;
      cacheTs = now;
      return model;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[getGeminiModel] fallback to default model', { error: message });
  }

  cachedModel = DEFAULT_MODEL;
  cacheTs = now;
  return DEFAULT_MODEL;
}

export { ALLOWED_MODELS, DEFAULT_MODEL };

import { GoogleGenerativeAI } from '@google/generative-ai';
import { retryWithBackoff } from './retryWithBackoff';

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

export interface TextRequest {
  prompt: string;
  systemPrompt?: string;
}

export interface JSONRequest {
  prompt: string;
  systemPrompt?: string;
}

export interface VisionRequest {
  prompt: string;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface AIResponse {
  text: string;
  model: string;
}

export interface AIJSONResponse<T = unknown> {
  parsed: T;
  raw: string;
  model: string;
}

export interface AIClient {
  generateText(req: TextRequest): Promise<AIResponse>;
  generateJSON<T = unknown>(req: JSONRequest): Promise<AIJSONResponse<T>>;
  generateVision(req: VisionRequest): Promise<AIResponse>;
}

const NON_RETRYABLE = ['INVALID_ARGUMENT', 'PERMISSION_DENIED', 'NOT_FOUND'];

function isRetryable(err: Error): boolean {
  return !NON_RETRYABLE.some((code) => err.message.includes(code));
}

export function createAIClient(config: AIClientConfig): AIClient {
  const { apiKey, model = 'gemini-2.5-flash', maxRetries = 3 } = config;

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({ model });

  async function callWithRetry(fn: () => Promise<string>): Promise<string> {
    const text = await retryWithBackoff(fn, {
      maxAttempts: maxRetries,
      baseDelayMs: 1000,
      isRetryable,
    });
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from AI provider');
    }
    return text.trim();
  }

  function cleanJSON(raw: string): string {
    return raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  }

  return {
    async generateText(req: TextRequest): Promise<AIResponse> {
      const parts: string[] = [];
      if (req.systemPrompt) parts.push(req.systemPrompt + '\n\n');
      parts.push(req.prompt);

      const text = await callWithRetry(async () => {
        const res = await genModel.generateContent(parts.join(''));
        return res.response.text();
      });

      return { text, model };
    },

    async generateJSON<T = unknown>(req: JSONRequest): Promise<AIJSONResponse<T>> {
      const parts: string[] = [];
      if (req.systemPrompt) parts.push(req.systemPrompt + '\n\n');
      parts.push(req.prompt);
      parts.push('\n\nRespond with valid JSON only. No markdown, no explanation.');

      const raw = await callWithRetry(async () => {
        const res = await genModel.generateContent(parts.join(''));
        return res.response.text();
      });

      const cleaned = cleanJSON(raw);
      const parsed = JSON.parse(cleaned) as T;
      return { parsed, raw: cleaned, model };
    },

    async generateVision(req: VisionRequest): Promise<AIResponse> {
      const text = await callWithRetry(async () => {
        const res = await genModel.generateContent([
          { inlineData: { mimeType: req.mimeType, data: req.imageBase64 } },
          req.prompt,
        ]);
        return res.response.text();
      });

      return { text, model };
    },
  };
}

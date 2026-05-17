import { createAIClient, AIClient } from '../aiClient';

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: jest.fn(),
    }),
  })),
}));

import { GoogleGenerativeAI } from '@google/generative-ai';

describe('AIClient', () => {
  let client: AIClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = createAIClient({ apiKey: 'test-key', model: 'gemini-2.5-flash' });
  });

  it('generates text from a prompt', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      response: { text: () => 'Generated text' },
    });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerate }),
    }));

    client = createAIClient({ apiKey: 'test-key', model: 'gemini-2.5-flash' });
    const result = await client.generateText({ prompt: 'Hello' });
    expect(result.text).toBe('Generated text');
  });

  it('generates structured JSON from a prompt', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      response: { text: () => '{"name": "test", "score": 42}' },
    });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerate }),
    }));

    client = createAIClient({ apiKey: 'test-key', model: 'gemini-2.5-flash' });
    const result = await client.generateJSON({ prompt: 'Extract data' });
    expect(result.parsed).toEqual({ name: 'test', score: 42 });
  });

  it('classifies vision input (image + prompt)', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      response: { text: () => '{"analyte": "HIV", "result": "negative", "confidence": 0.95}' },
    });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerate }),
    }));

    client = createAIClient({ apiKey: 'test-key', model: 'gemini-2.5-flash' });
    const result = await client.generateVision({
      prompt: 'Classify strip',
      imageBase64: 'base64data',
      mimeType: 'image/jpeg',
    });
    expect(result.text).toContain('HIV');
  });

  it('throws on empty response', async () => {
    const mockGenerate = jest.fn().mockResolvedValue({
      response: { text: () => '' },
    });
    (GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
      getGenerativeModel: () => ({ generateContent: mockGenerate }),
    }));

    client = createAIClient({ apiKey: 'test-key', model: 'gemini-2.5-flash' });
    await expect(client.generateText({ prompt: 'Hello' }))
      .rejects.toThrow('Empty response');
  });
});

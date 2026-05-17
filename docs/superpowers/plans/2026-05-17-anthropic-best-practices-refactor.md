# Anthropic Best Practices Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the AI integration layer to follow Anthropic's recommended patterns — provider abstraction, prompt engineering, code quality, and Claude Code workflow improvements.

**Architecture:** Create an `AIClient` abstraction that wraps the current Gemini SDK, centralizes prompt management in versioned template files, enforces structured output via Zod validation, adds retry/backoff, and improves the Claude Code developer experience (hooks, permissions, CLAUDE.md cleanup).

**Tech Stack:** `@google/generative-ai` (kept), Zod 3, Firebase Functions v2, Jest, TypeScript 5.8 strict

---

## File Structure

### New files
- `functions/src/shared/ai/aiClient.ts` — Provider-agnostic AI client interface + Gemini implementation
- `functions/src/shared/ai/aiClient.test.ts` — Unit tests for AIClient
- `functions/src/shared/ai/retryWithBackoff.ts` — Exponential backoff utility
- `functions/src/shared/ai/retryWithBackoff.test.ts` — Tests for retry
- `functions/src/shared/ai/prompts/stripClassification.ts` — Strip OCR prompt template
- `functions/src/shared/ai/prompts/laudoExtraction.ts` — Laudo OCR prompt template
- `functions/src/shared/ai/prompts/auditSummary.ts` — Audit summary prompt template
- `functions/src/shared/ai/prompts/reclamacaoClassification.ts` — Complaint classification prompt
- `functions/src/shared/ai/prompts/patternAnalysis.ts` — Anomaly pattern prompt
- `functions/src/shared/ai/prompts/index.ts` — Barrel export

### Modified files
- `functions/src/shared/gemini/visionClient.ts` — Refactor to use AIClient
- `functions/src/shared/nlpSummarizer.ts` — Refactor to use AIClient
- `functions/src/shared/aiPatternMatcher.ts` — Refactor to use AIClient
- `functions/src/callables/auditoriaGeral/generateAuditoriaSummary.ts` — Use AIClient + prompt template
- `functions/src/modules/reclamacoes/classificarReclamacaoIA.ts` — Use AIClient + prompt template
- `functions/src/shared/gemini/getModelConfig.ts` — Extend to support provider config
- `.claude/settings.local.json` — Clean up permissions
- `CLAUDE.md` — Trim module table, add AI architecture section

---

## Task 1: AIClient Abstraction + Retry Utility

**Files:**
- Create: `functions/src/shared/ai/retryWithBackoff.ts`
- Create: `functions/src/shared/ai/retryWithBackoff.test.ts`
- Create: `functions/src/shared/ai/aiClient.ts`
- Create: `functions/src/shared/ai/aiClient.test.ts`

- [ ] **Step 1: Write failing test for retryWithBackoff**

```typescript
// functions/src/shared/ai/retryWithBackoff.test.ts
import { retryWithBackoff } from './retryWithBackoff';

describe('retryWithBackoff', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after max attempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent'));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10 }))
      .rejects.toThrow('persistent');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('INVALID_ARGUMENT'));
    await expect(retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      isRetryable: (e) => !e.message.includes('INVALID_ARGUMENT'),
    })).rejects.toThrow('INVALID_ARGUMENT');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd functions && npx jest src/shared/ai/retryWithBackoff.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement retryWithBackoff**

```typescript
// functions/src/shared/ai/retryWithBackoff.ts
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  isRetryable: () => true,
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, isRetryable } = {
    ...DEFAULT_OPTIONS,
    ...opts,
  };

  let lastError: Error = new Error('retryWithBackoff: no attempts made');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts || !isRetryable(lastError)) {
        throw lastError;
      }

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      const jitter = delay * (0.5 + Math.random() * 0.5);
      await new Promise((r) => setTimeout(r, jitter));
    }
  }

  throw lastError;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd functions && npx jest src/shared/ai/retryWithBackoff.test.ts --no-coverage`
Expected: 4 tests PASS

- [ ] **Step 5: Write failing test for AIClient**

```typescript
// functions/src/shared/ai/aiClient.test.ts
import { createAIClient, AIClient } from './aiClient';

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
    const result = await client.generateJSON({
      prompt: 'Extract data',
    });
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
```

- [ ] **Step 6: Implement AIClient**

```typescript
// functions/src/shared/ai/aiClient.ts
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
```

- [ ] **Step 7: Run all AIClient tests**

Run: `cd functions && npx jest src/shared/ai/ --no-coverage`
Expected: All 8 tests PASS

- [ ] **Step 8: Commit**

```bash
git add functions/src/shared/ai/
git commit -m "feat(ai): add AIClient abstraction with retry, tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```


---

## Task 2: Prompt Templates (Extracted + Versioned)

**Files:**
- Create: `functions/src/shared/ai/prompts/stripClassification.ts`
- Create: `functions/src/shared/ai/prompts/laudoExtraction.ts`
- Create: `functions/src/shared/ai/prompts/auditSummary.ts`
- Create: `functions/src/shared/ai/prompts/reclamacaoClassification.ts`
- Create: `functions/src/shared/ai/prompts/patternAnalysis.ts`
- Create: `functions/src/shared/ai/prompts/index.ts`

- [ ] **Step 1: Create all 5 prompt template files**

Each prompt template exports a const object with `version`, `system`, and `template` function. The system prompt sets the AI role/persona. The template function accepts context and returns the user prompt. This separates concerns (system vs user) per Anthropic best practices.

Key patterns applied:
- System prompt defines role, constraints, output format expectations
- User prompt provides data + specific task
- No markdown in expected output (cleaner JSON parsing)
- Version field enables A/B testing and rollback

- [ ] **Step 2: Create barrel export in index.ts**

- [ ] **Step 3: Commit**

```bash
git add functions/src/shared/ai/prompts/
git commit -m "feat(ai): extract prompt templates with versioning

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Refactor nlpSummarizer to use AIClient

**Files:**
- Modify: `functions/src/shared/nlpSummarizer.ts`
- Modify: `functions/src/shared/__tests__/nlpSummarizer.test.ts`

- [ ] **Step 1: Update test to mock AIClient instead of GoogleGenerativeAI**

Replace the `vi.mock('@google/generative-ai')` with a mock of `./ai/aiClient`. Update assertions to verify `generateText` is called with the audit summary prompt template.

- [ ] **Step 2: Refactor nlpSummarizer.ts**

Replace:
- Direct `GoogleGenerativeAI` import and instantiation
- Inline prompt string
- Manual error handling

With:
- `createAIClient` from `./ai/aiClient`
- Prompt template from `./ai/prompts`
- AIClient handles retry internally

- [ ] **Step 3: Run tests**

Run: `cd functions && npx jest src/shared/__tests__/nlpSummarizer.test.ts --no-coverage`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add functions/src/shared/nlpSummarizer.ts functions/src/shared/__tests__/nlpSummarizer.test.ts
git commit -m "refactor(ai): nlpSummarizer uses AIClient + prompt template

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Refactor aiPatternMatcher to use AIClient

**Files:**
- Modify: `functions/src/shared/aiPatternMatcher.ts`
- Modify: `functions/src/shared/__tests__/aiPatternMatcher.test.ts`

- [ ] **Step 1: Update test mocks**

Replace `jest.mock('@google/generative-ai')` with mock of `./ai/aiClient`. Verify `generateJSON` is called (not `generateText`) since we expect structured JSON output.

- [ ] **Step 2: Refactor aiPatternMatcher.ts**

Replace:
- `callGemini()` function (direct SDK usage, no retry)
- `parseInsight()` with manual regex JSON extraction
- `process.env.GOOGLE_GENERATIVE_AI_API_KEY` direct access

With:
- `createAIClient` + `generateJSON<AiInsight>()`
- `PATTERN_ANALYSIS_PROMPT` template
- Zod validation on parsed response
- AIClient handles retry + JSON cleaning internally

- [ ] **Step 3: Run tests**

Run: `cd functions && npx jest src/shared/__tests__/aiPatternMatcher.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add functions/src/shared/aiPatternMatcher.ts functions/src/shared/__tests__/aiPatternMatcher.test.ts
git commit -m "refactor(ai): aiPatternMatcher uses AIClient + generateJSON

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Refactor generateAuditoriaSummary to use AIClient

**Files:**
- Modify: `functions/src/callables/auditoriaGeral/generateAuditoriaSummary.ts`

- [ ] **Step 1: Refactor callable**

Replace:
- Direct `GoogleGenerativeAI` instantiation inside the callable
- Inline prompt string concatenation
- `catch (err: any)` pattern

With:
- `createAIClient({ apiKey: geminiApiKey.value(), model: 'gemini-2.5-flash' })`
- `AUDIT_SUMMARY_PROMPT.template(ctx)` with system prompt
- Typed error handling (`catch (err: unknown)`)

- [ ] **Step 2: Verify build**

Run: `cd functions && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add functions/src/callables/auditoriaGeral/generateAuditoriaSummary.ts
git commit -m "refactor(ai): generateAuditoriaSummary uses AIClient + prompt template

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Refactor classificarReclamacaoIA to use AIClient

**Files:**
- Modify: `functions/src/modules/reclamacoes/classificarReclamacaoIA.ts`

- [ ] **Step 1: Refactor task dispatcher**

Replace:
- `GoogleGenAI` (new SDK) direct usage
- Inline prompt via `buildClassificationPrompt`
- Manual JSON.parse without Zod on the response

With:
- `createAIClient` + `generateJSON<GeminiClassification>()`
- `RECLAMACAO_CLASSIFICATION_PROMPT` template
- Zod `GeminiClassificationResponse.parse()` on the AIClient response
- Remove the now-unused `buildClassificationPrompt` function

- [ ] **Step 2: Verify build**

Run: `cd functions && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add functions/src/modules/reclamacoes/classificarReclamacaoIA.ts
git commit -m "refactor(ai): classificarReclamacaoIA uses AIClient + Zod validation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Refactor GeminiVisionClient to use AIClient

**Files:**
- Modify: `functions/src/shared/gemini/visionClient.ts`

- [ ] **Step 1: Refactor class to delegate to AIClient**

Replace:
- Direct `GoogleGenerativeAI` instantiation in constructor
- Manual retry-less API calls
- Inline prompts in `classifyStripImage` and `extractFieldsFromLaudo`

With:
- Internal `AIClient` instance created in constructor
- `STRIP_CLASSIFICATION_PROMPT` for strip classification
- `LAUDO_EXTRACTION_PROMPT` for laudo extraction
- `client.generateVision()` + JSON parse for both methods
- Keep the public API surface identical (no breaking changes)

- [ ] **Step 2: Verify build**

Run: `cd functions && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add functions/src/shared/gemini/visionClient.ts
git commit -m "refactor(ai): GeminiVisionClient delegates to AIClient with prompt templates

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Code Quality - Fix error handling anti-patterns

**Files:**
- Modify: `functions/src/shared/gemini/getModelConfig.ts`
- Modify: `functions/src/shared/gemini/visionClient.ts`
- Modify: `functions/src/callables/auditoriaGeral/generateAuditoriaSummary.ts`
- Modify: `functions/src/shared/aiPatternMatcher.ts`

- [ ] **Step 1: Fix silent catch in getModelConfig.ts**

Replace `catch { /* fallback */ }` with:
```typescript
catch (err: unknown) {
  functions.logger.warn('getModelConfig: fallback to default', {
    error: err instanceof Error ? err.message : String(err),
  });
}
```

- [ ] **Step 2: Fix all `catch (err: any)` to `catch (err: unknown)`**

Use type narrowing pattern:
```typescript
catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('context', { error: message });
}
```

- [ ] **Step 3: Fix unused `let` in visionClient.ts line 187**

Change `let finalConfidence = rawConfidence;` to `const finalConfidence = rawConfidence;`

- [ ] **Step 4: Verify build**

Run: `cd functions && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add functions/src/shared/ functions/src/callables/auditoriaGeral/
git commit -m "fix(ai): replace silent catches and any types with proper error handling

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Claude Code Workflow - Clean up settings + permissions

**Files:**
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Consolidate permissions**

Replace the 50+ ad-hoc Bash permissions with pattern-based rules:
- `Bash(git *)` - all git operations
- `Bash(npm *)` - all npm operations
- `Bash(npx *)` - all npx operations
- `Bash(firebase *)` - all firebase CLI
- `Bash(node *)` - all node scripts
- Remove one-off permissions that are subsets of the above
- Keep Skill permissions as-is

- [ ] **Step 2: Verify settings.local.json is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .claude/settings.local.json
git commit -m "chore(claude-code): consolidate permissions to pattern-based rules

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: CLAUDE.md - Add AI Architecture section

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add AI Architecture section after Stack section**

Add a new section documenting the AI integration layer:

```markdown
## AI Integration Architecture

- **Provider:** Gemini 2.5 Flash (via `@google/generative-ai`)
- **Abstraction:** `functions/src/shared/ai/aiClient.ts` (provider-agnostic interface)
- **Prompts:** `functions/src/shared/ai/prompts/` (versioned, system/user separated)
- **Retry:** Exponential backoff with jitter, 3 attempts, non-retryable error detection
- **Pattern:** All AI calls go through AIClient. Never instantiate GoogleGenerativeAI directly.
- **Testing:** Mock AIClient in tests, not the SDK.
- **Adding a new AI feature:** Create prompt in `prompts/`, call via `createAIClient()` + `generateText|generateJSON|generateVision`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add AI architecture section to CLAUDE.md

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Summary

| Task | Scope | Commit message |
|------|-------|----------------|
| 1 | AIClient + retry | `feat(ai): add AIClient abstraction with retry, tests` |
| 2 | Prompt templates | `feat(ai): extract prompt templates with versioning` |
| 3 | nlpSummarizer refactor | `refactor(ai): nlpSummarizer uses AIClient` |
| 4 | aiPatternMatcher refactor | `refactor(ai): aiPatternMatcher uses AIClient + generateJSON` |
| 5 | generateAuditoriaSummary | `refactor(ai): generateAuditoriaSummary uses AIClient` |
| 6 | classificarReclamacaoIA | `refactor(ai): classificarReclamacaoIA uses AIClient + Zod` |
| 7 | GeminiVisionClient | `refactor(ai): GeminiVisionClient delegates to AIClient` |
| 8 | Error handling cleanup | `fix(ai): replace silent catches and any types` |
| 9 | Claude Code permissions | `chore(claude-code): consolidate permissions` |
| 10 | CLAUDE.md docs | `docs: add AI architecture section` |

**Total: 10 tasks, ~10 commits, zero breaking changes.**

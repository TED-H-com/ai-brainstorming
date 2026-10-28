import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { unlinkSync } from 'node:fs';

const TEST_PORT = 3033;
const TEST_DB = resolve(`./data/test-${randomUUID()}.db`);
const MOCK_API_KEY = 'test-key';

let serverModule: any;

describe('E2E Idea Review', () => {
  beforeAll(async () => {
    process.env.PORT = String(TEST_PORT);
    process.env.DB_PATH = TEST_DB;
    process.env.OPENROUTER_API_KEY = MOCK_API_KEY;

    // Mock global fetch to simulate LLM API response and SearXNG
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url, options) => {
      const urlStr = url.toString();

      // Mock OpenRouter Chat Completions API
      if (urlStr.includes('openrouter.ai/api/v1/chat/completions')) {
        const body = JSON.parse(options?.body as string || '{}');
        const model = body.model || 'unknown';
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: `Mocked AI response for ${model} confirming the idea works.`
            }
          }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      // Mock SearXNG API if it was configured (though we didn't configure it for this test)
      if (urlStr.includes('/search?q=')) {
        return new Response(JSON.stringify({
          results: [{ title: 'Mock Result', url: 'http://example.com', content: 'Mock search content.' }]
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return originalFetch(url, options);
    });

    // Start server by importing index.ts
    // Wait for the app to initialize
    serverModule = await import('../src/index.js');
    await new Promise(r => setTimeout(r, 1000));
  });

  afterAll(() => {
    vi.restoreAllMocks();
    try {
      unlinkSync(TEST_DB);
      unlinkSync(TEST_DB + '-wal');
      unlinkSync(TEST_DB + '-shm');
    } catch {
      // ignore
    }
  });

  it('should run a multi-round debate and generate summary', async () => {
    // 1. Start the idea review session
    const startRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/idea/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        idea: 'A great idea for an AI app.',
        roundCount: 5
      })
    });

    expect(startRes.status).toBe(200);
    const startData = await startRes.json();
    expect(startData.session.token).toBeDefined();

    const token = startData.session.token;

    // 2. Run the debate
    const runRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/idea/run/${token}`, {
      method: 'POST'
    });

    expect(runRes.status).toBe(200);

    // Read SSE stream
    const reader = runRes.body!.getReader();
    const decoder = new TextDecoder();
    let sseData = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseData += decoder.decode(value, { stream: true });
    }

    // Verify SSE stream contains expected outputs
    expect(sseData).toContain('Mocked AI response for');
    expect(sseData).toContain('"type":"idea_completed"');

    // 3. Export Markdown Report
    const mdRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/idea/export/${token}.md`);
    expect(mdRes.status).toBe(200);

    const mdText = await mdRes.text();
    expect(mdText).toContain('# Idea Review');
    expect(mdText).toContain('A great idea for an AI app.');
    expect(mdText).toContain('Mocked AI response for');
  }, 30000);
});

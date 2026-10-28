import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPrompt, callParticipant, type StepResult } from './llm.js';
import { type Participant, type Phase } from './models.js';

describe('llm', () => {
  describe('buildPrompt', () => {
    it('should correctly synthesize the prompt with given arguments', () => {
      const args = {
        idea: 'A revolutionary new app for brainstorming.',
        participant: 'claude' as Participant,
        round: 2,
        totalRounds: 5,
        phase: 'clash' as Phase,
        evidence: 'Market research shows 50% increase in demand.',
        history: [
          { provider: 'gemini' as Participant, round: 1, text: 'This is a great idea.' }
        ]
      };

      const prompt = buildPrompt(args);

      // Verify participant name
      expect(prompt).toContain('你是 Claude');

      // Verify idea
      expect(prompt).toContain(args.idea);

      // Verify evidence
      expect(prompt).toContain(args.evidence);

      // Verify round and phase label (clash -> 互相攻防)
      expect(prompt).toContain('第 2/5 輪');
      expect(prompt).toContain('互相攻防');

      // Verify history rendering
      expect(prompt).toContain('目前討論紀錄:');
      expect(prompt).toContain('[R1 Gemini]');
      expect(prompt).toContain('This is a great idea.');
    });
  });

  describe('callParticipant', () => {
    let mockFetch: any;

    beforeEach(() => {
      mockFetch = vi.fn();
      vi.stubGlobal('fetch', mockFetch);
      process.env.OPENROUTER_API_KEY = 'test-key';
    });

    it('should pass temperature: 0.75 in the fetch request payload', async () => {
      // Mock successful fetch response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'This is a valid response.' } }]
        })
      });

      await callParticipant('claude', 'Some prompt text');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0];
      const requestOptions = callArgs[1];
      const requestBody = JSON.parse(requestOptions.body);

      expect(requestBody.temperature).toBe(0.75);
    });

    it('should format suggestions properly by filtering out blocked terms and deduplicating paragraphs', async () => {
      // Create a mocked response text containing blocked words and duplicate paragraphs
      const mockedResponseContent = [
        'Here is a normal paragraph.',
        'This paragraph contains a system prompt.',
        'Another normal paragraph.',
        'This paragraph contains workflow instructions.',
        'Here is a normal paragraph.', // Duplicate
        'It uses searxng tool.',
        'Here are some 提示詞 to consider.',
        'Also read this 系統提示.',
        'Another normal paragraph.', // Duplicate
        'Final valid paragraph.'
      ].join('\n\n');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: mockedResponseContent } }]
        })
      });

      const result = await callParticipant('gemini', 'Some prompt text');

      // Assert blocked phrases are filtered
      expect(result).not.toContain('system prompt');
      expect(result).not.toContain('workflow');
      expect(result).not.toContain('searxng');
      expect(result).not.toContain('提示詞');
      expect(result).not.toContain('系統提示');

      // Assert paragraphs are deduplicated
      const expectedContent = [
        'Here is a normal paragraph.',
        'Another normal paragraph.',
        'Final valid paragraph.'
      ].join('\n\n');

      expect(result).toBe(expectedContent);
    });
  });
});

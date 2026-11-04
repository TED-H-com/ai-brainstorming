import { describe, it, expect } from 'vitest';
import { titleFromIdea, escapeHtml } from './markdown.js';
import { sanitizeModelText } from './llm.js';

describe('Performance optimizations', () => {
  describe('Logic correctness', () => {
    it('titleFromIdea works correctly', () => {
      expect(titleFromIdea('  hello  world  ')).toBe('hello world');
      expect(titleFromIdea('a'.repeat(100))).toBe('a'.repeat(72) + '...');
    });

    it('escapeHtml works correctly', () => {
      expect(escapeHtml('<b class="foo">& bar</b>')).toBe('&lt;b class=&quot;foo&quot;&gt;&amp; bar&lt;/b&gt;');
    });

    it('sanitizeModelText works correctly', () => {
      const text = "A \r\n\n\n\n B";
      expect(sanitizeModelText(text)).toBe("A\n\nB");
      expect(sanitizeModelText(" system prompt here ")).toBe("");
    });
  });

  describe('Benchmarks', () => {
    it('runs benchmarks within a test (simulated)', () => {
      const largeIdea = `   This is    a    very    long   idea     with    multiple   spaces     `.repeat(100);
      const largeText = `This is a <b>test</b> of "HTML" escaping with & symbols and <tags>`.repeat(10000);
      const largeModelText = `
This is a very long text to benchmark the sanitizeModelText function.
It has multiple paragraphs.

Here is a system prompt reference which should be filtered out.

Another paragraph that is totally fine.

And one more with some spacing   issues.
`.repeat(1000);

      const start1 = performance.now();
      for (let i = 0; i < 100; i++) titleFromIdea(largeIdea);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      for (let i = 0; i < 100; i++) escapeHtml(largeText);
      const time2 = performance.now() - start2;

      const start3 = performance.now();
      for (let i = 0; i < 100; i++) sanitizeModelText(largeModelText);
      const time3 = performance.now() - start3;

      console.log(`titleFromIdea benchmark time: ${time1.toFixed(2)}ms`);
      console.log(`escapeHtml benchmark time: ${time2.toFixed(2)}ms`);
      console.log(`sanitizeModelText benchmark time: ${time3.toFixed(2)}ms`);

      // Ensure it doesn't take forever, 100 iterations of heavily loaded inputs shouldn't take more than 5 seconds each
      expect(time1).toBeLessThan(5000);
      expect(time2).toBeLessThan(5000);
      expect(time3).toBeLessThan(5000);
    });
  });
});

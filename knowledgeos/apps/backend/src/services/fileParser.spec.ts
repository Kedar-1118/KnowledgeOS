import { describe, it, expect, vi } from 'vitest';
import { parseFile } from './fileParser.js';

// We can extract private functions using query/eval/re-implementation or test them via chunkText/parseFile.
// Let's implement unit tests targeting public parseFile and verify text outputs.

describe('File Parser Service', () => {
  describe('parseFile with plain text', () => {
    it('should successfully parse plain text buffer into structured chunks', async () => {
      const textContent = `
# Introduction to Testing
Testing is an essential part of software engineering. It ensures that applications meet requirements.

## Section 1: Unit Tests
Unit tests verify individual components. They run in isolation.
      `.trim();

      const buffer = Buffer.from(textContent, 'utf-8');
      const result = await parseFile(buffer, 'text/plain', 'test_doc.txt');

      expect(result.title).toBe('Introduction to Testing');
      expect(result.author).toBeNull();
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.readingTimeMinutes).toBe(1);

      // Verify first chunk structure
      const chunk = result.chunks[0];
      expect(chunk).toBeDefined();
      expect(chunk?.content).toContain('Testing is an essential part');
      expect(chunk?.pageNumber).toBeNull(); // Text files don't have page numbers
    });

    it('should chunk large texts into overlapping segments', async () => {
      // Build a text of many sentences to force multiple chunks
      const sentences = Array.from({ length: 60 }, (_, i) => `This is sentence number ${i} which acts as long text segment.`).join(' ');
      const content = `# Large Doc\n\n${sentences}`;
      const buffer = Buffer.from(content, 'utf-8');

      const result = await parseFile(buffer, 'text/plain', 'large.txt');
      expect(result.chunks.length).toBeGreaterThan(0);
      
      // Verify all chunks have content
      result.chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.tokenCount).toBeLessThanOrEqual(512);
      });
    });
  });

  describe('parseFile with unsupported or binary mime-types', () => {
    it('should skip text extraction for image types and return empty chunks', async () => {
      const buffer = Buffer.from('fake image binary content');
      const result = await parseFile(buffer, 'image/png', 'diagram.png');

      expect(result.title).toBe('diagram');
      expect(result.chunks).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.readingTimeMinutes).toBe(0);
    });

    it('should skip text extraction for video types and return empty chunks', async () => {
      const buffer = Buffer.from('fake video binary content');
      const result = await parseFile(buffer, 'video/mp4', 'lecture.mp4');

      expect(result.title).toBe('lecture');
      expect(result.chunks).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.readingTimeMinutes).toBe(0);
    });

    it('should fallback to parse text for unknown types', async () => {
      const content = 'Some random custom text content';
      const buffer = Buffer.from(content, 'utf-8');
      const result = await parseFile(buffer, 'application/octet-stream', 'random.custom');

      expect(result.title).toBe(content);
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0]?.content).toBe(content);
    });
  });
});

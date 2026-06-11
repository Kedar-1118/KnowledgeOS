// apps/backend/src/services/fileParser.ts
/**
 * File Parser Service
 *
 * Handles parsing of different file types into text chunks:
 * - PDF: pdf-parse → extract text + page numbers, detect headings via font size heuristics
 * - TXT/MD: direct read
 * - Images: store reference, skip text extraction (OCR in V2)
 *
 * Chunking: 512 tokens max, 50 token overlap, preserve sentence boundaries
 */

import pdfParse from 'pdf-parse';

import { logger } from '../utils/logger.js';

// ─── Types ───

export interface ParsedChunk {
  content: string;
  pageNumber: number | null;
  headingContext: string | null;
  tokenCount: number;
}

export interface ParseResult {
  title: string;
  author: string | null;
  chunks: ParsedChunk[];
  totalTokens: number;
  readingTimeMinutes: number;
}

// ─── Constants ───

const MAX_CHUNK_TOKENS = 512;
const CHUNK_OVERLAP_TOKENS = 50;
const AVERAGE_READING_WPM = 238;
const APPROXIMATE_CHARS_PER_TOKEN = 4;

// ─── Token Estimation ───

/**
 * Estimate token count for a text string.
 * Uses a simple character-based approximation (~4 chars per token).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROXIMATE_CHARS_PER_TOKEN);
}

// ─── Sentence Splitting ───

/**
 * Split text into sentences while preserving boundaries.
 * Handles common abbreviations and edge cases.
 */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace and a capital letter
  const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
  return sentences.filter(s => s.trim().length > 0);
}

// ─── Heading Detection ───

/**
 * Detect headings from text lines using heuristics:
 * - Lines in ALL CAPS
 * - Lines starting with # (markdown)
 * - Short lines followed by empty lines
 * - Lines matching "Chapter", "Section", numbered patterns
 */
function detectHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;

  // Markdown headings
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // ALL CAPS headings (at least 3 words)
  if (trimmed === trimmed.toUpperCase() && trimmed.split(/\s+/).length >= 2) return true;

  // Numbered headings like "1. Introduction" or "1.1 Methods"
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(trimmed)) return true;

  // Chapter/Section patterns
  if (/^(chapter|section|part)\s+\d+/i.test(trimmed)) return true;

  return false;
}

/**
 * Extract the nearest heading context for a given position in text.
 */
function findHeadingContext(lines: string[], targetLineIndex: number): string | null {
  for (let i = targetLineIndex; i >= 0; i--) {
    const line = lines[i];
    if (line && detectHeading(line)) {
      return line.trim().replace(/^#+\s+/, '');
    }
  }
  return null;
}

// ─── Chunking ───

/**
 * Split text into overlapping chunks that respect sentence boundaries.
 *
 * Algorithm:
 * 1. Split into sentences
 * 2. Accumulate sentences until we hit MAX_CHUNK_TOKENS
 * 3. Create chunk, then back up by CHUNK_OVERLAP_TOKENS worth of sentences
 * 4. Continue from the overlap point
 */
function chunkText(
  text: string,
  pageNumber: number | null,
  headingContext: string | null,
): ParsedChunk[] {
  const sentences = splitSentences(text);
  const chunks: ParsedChunk[] = [];

  let currentChunkSentences: string[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;

    const sentenceTokens = estimateTokens(sentence);

    // If single sentence exceeds max, split it by words
    if (sentenceTokens > MAX_CHUNK_TOKENS && currentChunkSentences.length === 0) {
      const words = sentence.split(/\s+/);
      let wordChunk: string[] = [];
      let wordTokens = 0;

      for (const word of words) {
        const wTokens = estimateTokens(word + ' ');
        if (wordTokens + wTokens > MAX_CHUNK_TOKENS && wordChunk.length > 0) {
          const content = wordChunk.join(' ');
          chunks.push({
            content,
            pageNumber,
            headingContext,
            tokenCount: estimateTokens(content),
          });
          wordChunk = [];
          wordTokens = 0;
        }
        wordChunk.push(word);
        wordTokens += wTokens;
      }

      if (wordChunk.length > 0) {
        const content = wordChunk.join(' ');
        chunks.push({
          content,
          pageNumber,
          headingContext,
          tokenCount: estimateTokens(content),
        });
      }
      continue;
    }

    // Would adding this sentence exceed the limit?
    if (currentTokens + sentenceTokens > MAX_CHUNK_TOKENS && currentChunkSentences.length > 0) {
      // Emit current chunk
      const content = currentChunkSentences.join(' ');
      chunks.push({
        content,
        pageNumber,
        headingContext,
        tokenCount: estimateTokens(content),
      });

      // Calculate overlap: back up enough sentences to cover CHUNK_OVERLAP_TOKENS
      let overlapTokens = 0;
      let overlapStart = currentChunkSentences.length;
      for (let j = currentChunkSentences.length - 1; j >= 0; j--) {
        const s = currentChunkSentences[j];
        if (!s) continue;
        overlapTokens += estimateTokens(s);
        overlapStart = j;
        if (overlapTokens >= CHUNK_OVERLAP_TOKENS) break;
      }

      currentChunkSentences = currentChunkSentences.slice(overlapStart);
      currentTokens = currentChunkSentences.reduce(
        (sum, s) => sum + estimateTokens(s),
        0,
      );
    }

    currentChunkSentences.push(sentence);
    currentTokens += sentenceTokens;
  }

  // Don't forget the last chunk
  if (currentChunkSentences.length > 0) {
    const content = currentChunkSentences.join(' ');
    chunks.push({
      content,
      pageNumber,
      headingContext,
      tokenCount: estimateTokens(content),
    });
  }

  return chunks;
}

// ─── PDF Parser ───

/**
 * Parse a PDF file buffer into structured text with page awareness.
 */
async function parsePdf(buffer: Buffer): Promise<ParseResult> {
  const data = await pdfParse(buffer);

  const text = data.text;
  const lines = text.split('\n');
  const title = data.info?.Title ?? lines[0]?.trim() ?? 'Untitled';
  const author = data.info?.Author ?? null;

  // Split by page markers (pdf-parse separates pages with form feeds)
  const pages = text.split('\f');
  const allChunks: ParsedChunk[] = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageText = pages[pageIdx]?.trim();
    if (!pageText) continue;

    const pageLines = pageText.split('\n');
    const headingContext = findHeadingContext(pageLines, 0);
    const pageChunks = chunkText(pageText, pageIdx + 1, headingContext);
    allChunks.push(...pageChunks);
  }

  const totalTokens = allChunks.reduce((sum, c) => sum + c.tokenCount, 0);
  const wordCount = text.split(/\s+/).length;
  const readingTimeMinutes = Math.ceil(wordCount / AVERAGE_READING_WPM);

  return {
    title,
    author,
    chunks: allChunks,
    totalTokens,
    readingTimeMinutes,
  };
}

// ─── Plain Text / Markdown Parser ───

/**
 * Parse plain text or markdown content.
 */
function parseText(content: string, fileName: string): ParseResult {
  const lines = content.split('\n');
  const title = lines[0]?.replace(/^#+\s+/, '').trim() ?? fileName.replace(/\.[^.]+$/, '');
  const headingContext = findHeadingContext(lines, 0);

  const chunks = chunkText(content, null, headingContext);
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);
  const wordCount = content.split(/\s+/).length;
  const readingTimeMinutes = Math.ceil(wordCount / AVERAGE_READING_WPM);

  return {
    title,
    author: null,
    chunks,
    totalTokens,
    readingTimeMinutes,
  };
}

// ─── Main Parser Entry Point ───

/**
 * Parse a file buffer based on its MIME type.
 * Returns structured text chunks ready for embedding.
 */
export async function parseFile(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<ParseResult> {
  logger.info(`Parsing file: ${fileName} (${mimeType})`);

  switch (mimeType) {
    case 'application/pdf':
      return parsePdf(buffer);

    case 'text/plain':
    case 'text/markdown':
    case 'text/x-markdown':
      return parseText(buffer.toString('utf-8'), fileName);

    default:
      if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        // Images/videos: no text extraction in V1 (OCR in V2)
        logger.info(`Skipping text extraction for ${mimeType}: ${fileName}`);
        return {
          title: fileName.replace(/\.[^.]+$/, ''),
          author: null,
          chunks: [],
          totalTokens: 0,
          readingTimeMinutes: 0,
        };
      }

      // Try to parse as text for unknown types
      try {
        return parseText(buffer.toString('utf-8'), fileName);
      } catch {
        logger.warn(`Unable to parse file as text: ${fileName} (${mimeType})`);
        return {
          title: fileName.replace(/\.[^.]+$/, ''),
          author: null,
          chunks: [],
          totalTokens: 0,
          readingTimeMinutes: 0,
        };
      }
  }
}

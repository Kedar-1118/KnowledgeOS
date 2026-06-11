// packages/shared-types/src/index.ts
/**
 * KnowledgeOS — Shared type definitions
 * Used by both frontend and backend packages.
 */

// ═══════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════

export enum FileType {
  PDF = 'PDF',
  TXT = 'TXT',
  MD = 'MD',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  INDEXED = 'INDEXED',
  FAILED = 'FAILED',
}

export enum JobType {
  PARSE = 'PARSE',
  EMBED = 'EMBED',
  SUMMARIZE = 'SUMMARIZE',
  TAG = 'TAG',
  GRAPH_EXTRACT = 'GRAPH_EXTRACT',
}

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export enum TagAssignment {
  AUTO = 'AUTO',
  USER = 'USER',
}

export enum NodeType {
  CONCEPT = 'CONCEPT',
  PERSON = 'PERSON',
  PLACE = 'PLACE',
  TECHNOLOGY = 'TECHNOLOGY',
  METHOD = 'METHOD',
  OTHER = 'OTHER',
}

// ═══════════════════════════════════════════
// API Response Wrapper
// ═══════════════════════════════════════════

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ═══════════════════════════════════════════
// User Types
// ═══════════════════════════════════════════

export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  driveFolderId: string | null;
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

// ═══════════════════════════════════════════
// Document Types
// ═══════════════════════════════════════════

export interface Document {
  id: string;
  userId: string;
  driveFileId: string;
  driveFileUrl: string | null;
  title: string;
  author: string | null;
  fileName: string;
  fileType: FileType;
  mimeType: string;
  fileSizeBytes: number;
  driveModifiedAt: string;
  status: DocumentStatus;
  summary: string | null;
  summaryGeneratedAt: string | null;
  readingTimeMinutes: number | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  qdrantPointId: string | null;
  headingContext: string | null;
  pageNumber: number | null;
  createdAt: string;
}

// ═══════════════════════════════════════════
// Tag Types
// ═══════════════════════════════════════════

export interface Tag {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  createdAt: string;
}

export interface DocumentTag {
  documentId: string;
  tagId: string;
  confidence: number;
  assignedBy: TagAssignment;
}

// ═══════════════════════════════════════════
// Knowledge Graph Types
// ═══════════════════════════════════════════

export interface KnowledgeNode {
  id: string;
  userId: string;
  label: string;
  type: NodeType;
  description: string | null;
  neo4jNodeId: string | null;
  createdAt: string;
}

export interface DocumentRelation {
  id: string;
  sourceDocId: string;
  targetDocId: string;
  relationType: string;
  strength: number;
  createdAt: string;
}

// ═══════════════════════════════════════════
// Search Types
// ═══════════════════════════════════════════

export interface SearchRequest {
  query: string;
  topK?: number;
  filters?: {
    tags?: string[];
    fileType?: FileType[];
    dateRange?: {
      from: string;
      to: string;
    };
    minScore?: number;
  };
}

export interface SearchResult {
  documentId: string;
  documentTitle: string;
  chunkContent: string;
  score: number;
  pageNumber: number | null;
  headingContext: string | null;
  fileType: FileType;
  tags: Tag[];
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  queryTimeMs: number;
}

// ═══════════════════════════════════════════
// Q&A Types
// ═══════════════════════════════════════════

export interface QARequest {
  question: string;
  topK?: number;
}

export interface QASource {
  documentId: string;
  title: string;
  page: number | null;
  snippet: string;
}

// ═══════════════════════════════════════════
// Processing Job Types
// ═══════════════════════════════════════════

export interface ProcessingJob {
  id: string;
  documentId: string;
  jobType: JobType;
  status: JobStatus;
  attempts: number;
  lastError: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════
// Revision Types
// ═══════════════════════════════════════════

export interface RevisionItem {
  id: string;
  userId: string;
  documentId: string;
  topicName: string;
  nextReviewAt: string;
  intervalDays: number;
  easeFactor: number;
  repetitionCount: number;
  createdAt: string;
  updatedAt: string;
}

// ═══════════════════════════════════════════
// Health Score Types
// ═══════════════════════════════════════════

export interface KnowledgeHealthScore {
  id: string;
  userId: string;
  score: number;
  coverageScore: number;
  recencyScore: number;
  gapScore: number;
  revisionScore: number;
  breakdown: Record<string, unknown>;
  calculatedAt: string;
}

// ═══════════════════════════════════════════
// Drive Sync Types
// ═══════════════════════════════════════════

export interface DriveSyncStatus {
  isRunning: boolean;
  lastSyncAt: string | null;
  filesFound: number;
  filesProcessed: number;
  errors: string[];
}

export interface ParsedDocument {
  title: string;
  author: string | null;
  chunks: ParsedChunk[];
}

export interface ParsedChunk {
  content: string;
  pageNumber: number | null;
  headingContext: string | null;
  tokenCount: number;
}

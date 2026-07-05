import { vi } from 'vitest';

export const prismaMock = {
  $queryRaw: vi.fn(),
  document: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  chunk: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  knowledgeNode: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  documentRelation: {
    findMany: vi.fn(),
  },
  documentTag: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  tag: {
    upsert: vi.fn(),
    count: vi.fn(),
  },
  processingJob: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  },
  revisionItem: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  cluster: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  space: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  spaceMember: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  semanticBookmark: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  knowledgeGap: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  documentConversation: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  searchHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  learningRoadmap: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  roadmapNode: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  mentorSession: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  mentorMessage: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  knowledgeHealthScore: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('./prisma.js', () => ({
  prisma: prismaMock,
}));


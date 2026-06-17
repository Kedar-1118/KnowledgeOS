import { vi } from 'vitest';

export const prismaMock = {
  $queryRaw: vi.fn(),
  document: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock('./prisma.js', () => ({
  prisma: prismaMock,
}));

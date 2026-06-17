import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Import mock before importing app to ensure mock hoisting works cleanly
import { prismaMock } from '../utils/prismaMock.js';
import { app } from '../index.js';

describe('API Router Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should successfully return 200 and healthy checks status', async () => {
      // Stub PG query success
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '1': 1 }]);

      // Stub fetch for ML service
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBeUndefined(); // raw endpoint returns state object
      expect(res.body.status).toBe('ok');
      expect(res.body.dependencies.postgres).toBe('ok');
      expect(res.body.dependencies.mlService).toBe('ok');
    });

    it('should report status as degraded if postgres check fails', async () => {
      // Stub PG query failure
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('PG Connection lost'));

      // Stub fetch for ML service
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(app).get('/health');

      expect(res.status).toBe(200); // endpoint responds with 200 even when degraded
      expect(res.body.status).toBe('degraded');
      expect(res.body.dependencies.postgres).toBe('error');
      expect(res.body.dependencies.mlService).toBe('ok');
    });
  });

  describe('Protected Workspace Endpoints Auth checks', () => {
    it('should reject GET /api/documents without token with 401', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject GET /api/drive/status without token with 401', async () => {
      const res = await request(app).get('/api/drive/status');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject POST /api/search without token with 401', async () => {
      const res = await request(app).post('/api/search').send({ query: 'test' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Flow Validation Integration Tests', () => {
    const testUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      avatarUrl: null,
    };
    let token: string;

    beforeEach(() => {
      token = jwt.sign(
        { userId: testUser.id, email: testUser.email },
        'dev-jwt-secret-change-me'
      );
      prismaMock.user.findUnique.mockResolvedValue(testUser);
    });

    describe('GET /api/graph/nodes', () => {
      it('should return a hybrid set of concept and document nodes', async () => {
        prismaMock.knowledgeNode.findMany.mockResolvedValueOnce([
          { id: 'c1', label: 'Docker', type: 'TECHNOLOGY', description: 'Containerization tool' },
        ]);
        prismaMock.document.findMany.mockResolvedValueOnce([
          { id: 'd1', title: 'Getting Started with Docker', summary: 'Docker is cool' },
        ]);

        const res = await request(app)
          .get('/api/graph/nodes')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.nodes).toHaveLength(2);
        expect(res.body.data.nodes[0]).toEqual({
          id: 'c1',
          label: 'Docker',
          type: 'TECHNOLOGY',
          description: 'Containerization tool',
          size: 1,
        });
        expect(res.body.data.nodes[1]).toEqual({
          id: 'd1',
          label: 'Getting Started with Docker',
          type: 'OTHER',
          description: 'Docker is cool',
          size: 2,
        });
      });
    });

    describe('GET /api/graph/edges', () => {
      it('should return relations, shared tags, and dynamically extracted concept links', async () => {
        prismaMock.documentRelation.findMany.mockResolvedValueOnce([
          {
            sourceDocId: 'd1',
            targetDocId: 'd2',
            relationType: 'SIMILAR',
            strength: 0.9,
            sourceDocument: { title: 'Doc 1' },
            targetDocument: { title: 'Doc 2' },
          },
        ]);
        prismaMock.documentTag.findMany.mockResolvedValueOnce([]);
        prismaMock.knowledgeNode.findMany.mockResolvedValueOnce([
          { id: 'c1', label: 'Docker' },
        ]);
        prismaMock.chunk.findMany.mockResolvedValueOnce([
          { documentId: 'd1', content: 'In this guide we will install Docker and run some containers.' },
        ]);

        const res = await request(app)
          .get('/api/graph/edges')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.edges).toHaveLength(2);
        expect(res.body.data.edges).toContainEqual({
          source: 'd1',
          target: 'd2',
          type: 'SIMILAR',
          strength: 0.9,
          label: 'SIMILAR',
          sourceTitle: 'Doc 1',
          targetTitle: 'Doc 2',
        });
        expect(res.body.data.edges).toContainEqual({
          source: 'c1',
          target: 'd1',
          type: 'CONCEPT_LINK',
          strength: 0.8,
          label: 'MENTIONS',
        });
      });
    });

    describe('GET /api/revision/stats', () => {
      it('should request cumulative revision items including due now items', async () => {
        prismaMock.revisionItem.count.mockResolvedValue(5);
        prismaMock.revisionItem.aggregate.mockResolvedValue({ _avg: { easeFactor: 2.5 } });

        const res = await request(app)
          .get('/api/revision/stats')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.dueThisWeek).toBe(5);

        const countCalls = prismaMock.revisionItem.count.mock.calls;
        const dueThisWeekCall = countCalls.find(call => {
          const where = call[0]?.where;
          return where && where.nextReviewAt && where.nextReviewAt.lte && !where.nextReviewAt.gt;
        });
        expect(dueThisWeekCall).toBeDefined();
      });
    });
  });
});

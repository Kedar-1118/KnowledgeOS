import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

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
});

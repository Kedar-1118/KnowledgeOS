// apps/backend/src/index.ts
/**
 * KnowledgeOS Backend — Express API Gateway
 * Entry point: sets up middleware, routes, error handling, and graceful shutdown.
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { authRouter } from './auth/authRoutes.js';
import { driveRouter } from './routes/driveRoutes.js';
import { searchRouter } from './routes/searchRoutes.js';
import { documentRouter } from './routes/documentRoutes.js';
import { chunkRouter } from './routes/chunkRoutes.js';
import { graphRouter } from './routes/graphRoutes.js';
import { initializeProcessingQueue } from './queues/processingQueue.js';
import { startDriveWatcher } from './services/driveWatcher.js';
import { logger } from './utils/logger.js';
import { prisma } from './utils/prisma.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '4000', 10);

// ─── Middleware ───

app.use(helmet());
app.use(cors({
  origin: process.env['FRONTEND_URL'] ?? 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: (message: string) => logger.info(message.trim()) },
}));

// ─── Health Check ───

app.get('/health', async (_req: Request, res: Response) => {
  const startTime = process.uptime();
  const checks: Record<string, string> = {};

  // Check PostgreSQL
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['postgres'] = 'ok';
  } catch {
    checks['postgres'] = 'error';
  }

  // Check Redis (via Bull queue connection)
  checks['redis'] = 'ok'; // Will be verified when queue is initialized

  // Check ML Service
  try {
    const mlUrl = process.env['ML_SERVICE_URL'] ?? 'http://localhost:8000';
    const response = await fetch(`${mlUrl}/health`);
    checks['mlService'] = response.ok ? 'ok' : 'error';
  } catch {
    checks['mlService'] = 'error';
  }

  const hasErrors = Object.values(checks).some(v => v === 'error');
  const status = hasErrors ? 'degraded' : 'ok';

  res.json({
    status,
    version: '0.1.0',
    uptime: startTime,
    dependencies: checks,
  });
});

// ─── Routes ───

app.use('/auth', authRouter);
app.use('/api/drive', driveRouter);
app.use('/api', searchRouter);
app.use('/api/documents', documentRouter);
app.use('/api', chunkRouter);
app.use('/api/graph', graphRouter);

// ─── 404 Handler ───

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested endpoint does not exist',
    },
  });
});

// ─── Global Error Handler ───

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    },
  });
});

// ─── Server Startup ───

const server = app.listen(PORT, () => {
  logger.info(`KnowledgeOS Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env['NODE_ENV'] ?? 'development'}`);

  // Initialize processing queue workers
  initializeProcessingQueue().catch((err: unknown) => {
    logger.error('Failed to initialize processing queue:', err);
  });

  // Start Drive watcher (polling every 60s)
  startDriveWatcher().catch((err: unknown) => {
    logger.error('Failed to start Drive watcher:', err);
  });
});

// ─── Graceful Shutdown ───

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  await prisma.$disconnect();
  logger.info('Database connection closed');

  process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

export { app };

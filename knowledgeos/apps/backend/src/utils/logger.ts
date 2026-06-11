// apps/backend/src/utils/logger.ts
/**
 * Winston logger configured for KnowledgeOS backend.
 */

import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts, stack }) => {
  return `${ts as string} [${level}]: ${(stack as string) ?? (message as string)}`;
});

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'debug',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  ],
  defaultMeta: { service: 'knowledgeos-backend' },
});

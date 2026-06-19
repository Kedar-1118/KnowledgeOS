// apps/backend/src/auth/jwtMiddleware.ts
/**
 * JWT verification middleware.
 * Extracts and verifies the Bearer token from the Authorization header,
 * then attaches the authenticated user to req.user.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-jwt-secret-change-me';

interface JwtPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        preferences?: any;
      };
    }
  }
}

/**
 * Middleware that verifies JWT and attaches user to request.
 * Returns 401 if token is missing, invalid, or expired.
 */
export async function jwtMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>',
      },
    });
    return;
  }

  const token = authHeader.slice(7); // Remove "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Fetch user from database to ensure they still exist
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        preferences: true,
      },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Authenticated user no longer exists',
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'JWT token has expired. Please re-authenticate.',
        },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'JWT token is invalid',
        },
      });
      return;
    }

    logger.error('JWT middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed due to an internal error',
      },
    });
  }
}

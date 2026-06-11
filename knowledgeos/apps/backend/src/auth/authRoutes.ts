// apps/backend/src/auth/authRoutes.ts
/**
 * Authentication routes for Google OAuth flow.
 * GET  /auth/google          → Redirect to Google consent screen
 * GET  /auth/google/callback → Handle OAuth callback, issue JWT
 * POST /auth/logout          → Client-side logout (invalidate token)
 * GET  /auth/me              → Get current authenticated user
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { getAuthUrl, handleGoogleCallback } from './googleAuth.js';
import { jwtMiddleware } from './jwtMiddleware.js';
import { logger } from '../utils/logger.js';

export const authRouter = Router();

const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:3000';

/**
 * GET /auth/google
 * Initiates the Google OAuth flow by redirecting to Google's consent screen.
 */
authRouter.get('/google', (_req: Request, res: Response) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles the OAuth callback from Google.
 * Exchanges the authorization code for tokens, creates/updates user,
 * issues JWT, and redirects to frontend with the token.
 */
const callbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  try {
    const parsed = callbackSchema.safeParse(req.query);

    if (!parsed.success) {
      logger.error('OAuth callback missing code:', req.query);
      res.redirect(`${FRONTEND_URL}/login?error=missing_code`);
      return;
    }

    const { token, user } = await handleGoogleCallback(parsed.data.code);

    logger.info(`OAuth callback successful for ${user.email}`);

    // Redirect to frontend with token in URL fragment (more secure than query param)
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
});

/**
 * POST /auth/logout
 * Logout is primarily client-side (discard JWT).
 * This endpoint exists for audit logging and future token blacklisting.
 */
authRouter.post('/logout', jwtMiddleware, (req: Request, res: Response) => {
  logger.info(`User logged out: ${req.user?.email}`);

  res.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * GET /auth/me
 * Returns the currently authenticated user's profile.
 */
authRouter.get('/me', jwtMiddleware, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: req.user,
  });
});

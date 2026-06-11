// apps/backend/src/auth/googleAuth.ts
/**
 * Google OAuth 2.0 authentication using googleapis.
 * Handles token exchange, user upsert, and JWT issuance.
 */

import { google } from 'googleapis';
import jwt from 'jsonwebtoken';

import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'] ?? '';
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
const GOOGLE_REDIRECT_URI = process.env['GOOGLE_REDIRECT_URI'] ?? 'http://localhost:4000/auth/google/callback';
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-jwt-secret-change-me';
const JWT_EXPIRES_IN_SECONDS = parseInt(process.env['JWT_EXPIRES_IN_SECONDS'] ?? '604800', 10); // 7 days

/**
 * Create an OAuth2 client instance.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

/**
 * Generate the Google OAuth consent URL.
 * Requests: profile, email, and Drive read-only scopes.
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
  });
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

/**
 * Exchange authorization code for tokens, fetch user info, upsert user in DB.
 * Returns a JWT token for subsequent API calls.
 */
export async function handleGoogleCallback(code: string): Promise<{
  token: string;
  user: { id: string; email: string; name: string; avatarUrl: string | null };
}> {
  const oauth2Client = createOAuth2Client();

  // Exchange code for tokens
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  logger.info('Google OAuth tokens received');

  // Fetch user info
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const googleUser: GoogleUserInfo = {
    id: userInfo.id ?? '',
    email: userInfo.email ?? '',
    name: userInfo.name ?? '',
    picture: userInfo.picture ?? '',
  };

  if (!googleUser.id || !googleUser.email) {
    throw new Error('Failed to retrieve Google user information');
  }

  // Upsert user in database
  const user = await prisma.user.upsert({
    where: { googleId: googleUser.id },
    update: {
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
      driveAccessToken: tokens.access_token ?? undefined,
      driveRefreshToken: tokens.refresh_token ?? undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    },
    create: {
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      avatarUrl: googleUser.picture,
      driveAccessToken: tokens.access_token ?? undefined,
      driveRefreshToken: tokens.refresh_token ?? undefined,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    },
  });

  logger.info(`User authenticated: ${user.email} (${user.id})`);

  // Issue JWT
  const token = jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN_SECONDS },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
    },
  };
}

/**
 * Refresh the Google Drive access token for a user.
 * Called when the token has expired before making Drive API calls.
 */
export async function refreshDriveToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { driveRefreshToken: true },
  });

  if (!user?.driveRefreshToken) {
    throw new Error('No refresh token available. User must re-authenticate.');
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: user.driveRefreshToken });

  const { credentials } = await oauth2Client.refreshAccessToken();

  await prisma.user.update({
    where: { id: userId },
    data: {
      driveAccessToken: credentials.access_token ?? undefined,
      tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
    },
  });

  logger.info(`Drive token refreshed for user ${userId}`);

  return credentials.access_token ?? '';
}

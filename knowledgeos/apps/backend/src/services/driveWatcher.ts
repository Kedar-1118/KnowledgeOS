// apps/backend/src/services/driveWatcher.ts
/**
 * Drive Watcher — Polling service that periodically checks for changes
 * in each user's KnowledgeOS/ Drive folder using the Drive Changes API.
 *
 * Polls every 60 seconds for all active users.
 */

import { logger } from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { syncDriveFolder } from './driveSync.js';

const POLL_INTERVAL_MS = 60_000; // 60 seconds
let watcherInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

/**
 * Run a single sync cycle for all users who have Drive connected.
 */
async function runSyncCycle(): Promise<void> {
  if (isRunning) {
    logger.debug('Sync cycle already running, skipping...');
    return;
  }

  isRunning = true;

  try {
    // Find all users with Drive tokens
    const users = await prisma.user.findMany({
      where: {
        driveAccessToken: { not: null },
        driveFolderId: { not: null },
      },
      select: { id: true, email: true },
    });

    if (users.length === 0) {
      logger.debug('No users with Drive connected, skipping sync cycle');
      return;
    }

    logger.debug(`Running sync cycle for ${users.length} user(s)`);

    for (const user of users) {
      try {
        const result = await syncDriveFolder(user.id);

        if (result.newFiles > 0 || result.updatedFiles > 0) {
          logger.info(
            `Sync cycle for ${user.email}: ${result.newFiles} new, ${result.updatedFiles} updated`,
          );
        }
      } catch (error) {
        logger.error(
          `Sync cycle failed for user ${user.email}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  } catch (error) {
    logger.error('Sync cycle error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the Drive watcher polling loop.
 * Called on server startup.
 */
export async function startDriveWatcher(): Promise<void> {
  if (watcherInterval) {
    logger.warn('Drive watcher is already running');
    return;
  }

  logger.info(`Starting Drive watcher (polling every ${POLL_INTERVAL_MS / 1000}s)`);

  // Run first sync immediately
  await runSyncCycle();

  // Start polling interval
  watcherInterval = setInterval(() => {
    runSyncCycle().catch((err: unknown) => {
      logger.error('Sync cycle failed:', err);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the Drive watcher polling loop.
 * Called on graceful shutdown.
 */
export function stopDriveWatcher(): void {
  if (watcherInterval) {
    clearInterval(watcherInterval);
    watcherInterval = null;
    logger.info('Drive watcher stopped');
  }
}

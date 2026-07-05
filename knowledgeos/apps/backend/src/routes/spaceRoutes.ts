// apps/backend/src/routes/spaceRoutes.ts
import { Router, type Request, type Response } from 'express';
import { jwtMiddleware } from '../auth/jwtMiddleware.js';
import { prisma } from '../utils/prisma.js';
import { logger } from '../utils/logger.js';

export const spaceRouter = Router();

spaceRouter.use(jwtMiddleware);

/**
 * POST /api/spaces
 * Create a new Shared Knowledge Space.
 */
spaceRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const { name, type } = req.body as { name: string; type: 'PERSONAL' | 'TEAM' | 'ORGANIZATION' };

    if (!name?.trim() || !type) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Name and type are required' } });
      return;
    }

    const userId = req.user.id;

    // Create space
    const space = await prisma.space.create({
      data: {
        name,
        type,
      }
    });

    // Add creator as member
    await prisma.spaceMember.create({
      data: {
        spaceId: space.id,
        userId,
        role: 'OWNER'
      }
    });

    res.json({ success: true, data: space });
  } catch (error: any) {
    logger.error('Failed to create space:', error);
    res.status(500).json({ success: false, error: { code: 'SPACE_FAILED', message: error.message } });
  }
});

/**
 * GET /api/spaces
 * List all spaces the user belongs to.
 */
spaceRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const userId = req.user.id;

    const memberships = await prisma.spaceMember.findMany({
      where: { userId },
      include: {
        space: {
          include: {
            _count: {
              select: { documents: true, members: true }
            }
          }
        }
      }
    });

    const spaces = memberships.map(m => m.space);

    res.json({ success: true, data: spaces });
  } catch (error: any) {
    logger.error('Failed to list spaces:', error);
    res.status(500).json({ success: false, error: { code: 'SPACE_FAILED', message: error.message } });
  }
});

/**
 * POST /api/spaces/:id/invite
 * Invite a user to a Space by email.
 */
spaceRouter.post('/:id/invite', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const spaceId = req.params['id'] as string;
    const { email, role } = req.body as { email: string; role: 'ADMIN' | 'MEMBER' };

    if (!email || !role) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Email and role are required' } });
      return;
    }

    // Verify current user has permission (OWNER or ADMIN)
    const membership = await prisma.spaceMember.findFirst({
      where: { spaceId, userId: req.user.id }
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to invite users' } });
      return;
    }

    // Find the target user by email
    const targetUser = await prisma.user.findUnique({
      where: { email }
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User with this email not registered in KnowledgeOS' } });
      return;
    }

    // Create membership record
    const newMember = await prisma.spaceMember.create({
      data: {
        spaceId,
        userId: targetUser.id,
        role
      }
    });

    res.json({ success: true, data: newMember });
  } catch (error: any) {
    logger.error('Failed to invite to space:', error);
    res.status(500).json({ success: false, error: { code: 'INVITE_FAILED', message: error.message } });
  }
});

/**
 * POST /api/spaces/:id/documents
 * Associate a document with a Shared Space.
 */
spaceRouter.post('/:id/documents', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }

    const spaceId = req.params['id'] as string;
    const { documentId } = req.body as { documentId: string };

    if (!documentId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'documentId is required' } });
      return;
    }

    // Verify document belongs to user
    const doc = await prisma.document.findFirst({
      where: { id: documentId, userId: req.user.id }
    });

    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found' } });
      return;
    }

    if (spaceId !== 'personal') {
      const membership = await prisma.spaceMember.findFirst({
        where: { spaceId, userId: req.user.id }
      });
      if (!membership) {
        res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not belong to this space' } });
        return;
      }
    }

    // Update document spaceId
    const updatedDoc = await prisma.document.update({
      where: { id: documentId },
      data: {
        spaceId: spaceId === 'personal' ? null : spaceId
      }
    });

    res.json({ success: true, data: updatedDoc });
  } catch (error: any) {
    logger.error('Failed to assign document to space:', error);
    res.status(500).json({ success: false, error: { code: 'ASSIGN_FAILED', message: error.message } });
  }
});

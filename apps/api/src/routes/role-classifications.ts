import { Router } from 'express';
import {
  createRoleClassificationSchema,
  updateRoleClassificationSchema,
  bulkClassifyRequestSchema,
  classificationQuerySchema,
  UserRole,
} from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';
import {
  getUnclassifiedRoles,
  classifyRoleWithAI,
  bulkClassifyRoles,
  getRoleClassificationsWithCounts,
} from '../services/role-classification.js';

export const roleClassificationRouter = Router();
roleClassificationRouter.use(authenticate);

// List all classifications with filters
roleClassificationRouter.get('/', async (req, res, next) => {
  try {
    const query = classificationQuerySchema.parse(req.query);
    const classifications = await getRoleClassificationsWithCounts(
      req.user!.organizationId!,
      {
        status: query.status as 'UNCLASSIFIED' | 'AI_SUGGESTED' | 'CONFIRMED' | undefined,
        country: query.country,
        jobFamily: query.jobFamily,
      },
    );
    res.json(classifications);
  } catch (err) {
    next(err);
  }
});

// Get unclassified roles from employee data
roleClassificationRouter.get('/unclassified', async (req, res, next) => {
  try {
    const roles = await getUnclassifiedRoles(req.user!.organizationId!);
    res.json(roles);
  } catch (err) {
    next(err);
  }
});

// Get a single classification with tags
roleClassificationRouter.get('/:id', async (req, res, next) => {
  try {
    const classification = await prisma.roleClassification.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      include: {
        tags: { include: { dimension: true } },
        confirmedBy: { select: { id: true, email: true } },
      },
    });
    if (!classification) {
      res.status(404).json({ error: 'Role classification not found' });
      return;
    }
    res.json(classification);
  } catch (err) {
    next(err);
  }
});

// Create a new classification with tags
roleClassificationRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const body = createRoleClassificationSchema.parse(req.body);
      const orgId = req.user!.organizationId!;

      const classification = await prisma.$transaction(async (tx) => {
        const created = await tx.roleClassification.create({
          data: {
            organizationId: orgId,
            country: body.country,
            jobFamily: body.jobFamily ?? null,
            level: body.level,
            roleTitle: body.roleTitle,
            jobDescription: body.jobDescription ?? null,
            status: body.tags && body.tags.length > 0 ? 'CONFIRMED' : 'UNCLASSIFIED',
            confirmedByUserId: body.tags && body.tags.length > 0 ? req.user!.userId : null,
            confirmedAt: body.tags && body.tags.length > 0 ? new Date() : null,
          },
        });

        if (body.tags) {
          for (const tag of body.tags) {
            await tx.roleClassificationTag.create({
              data: {
                roleClassificationId: created.id,
                dimensionId: tag.dimensionId,
                value: tag.value,
                numericValue: tag.numericValue ?? null,
                notes: tag.notes ?? null,
              },
            });
          }
        }

        return tx.roleClassification.findUnique({
          where: { id: created.id },
          include: { tags: { include: { dimension: true } } },
        });
      });

      logAudit({
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'ROLE_CLASSIFICATION_UPDATED',
        entityType: 'RoleClassification',
        entityId: classification!.id,
        metadata: { roleTitle: body.roleTitle, status: classification!.status },
      });

      res.status(201).json(classification);
    } catch (err) {
      next(err);
    }
  },
);

// Update classification tags
roleClassificationRouter.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.roleClassification.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Role classification not found' });
        return;
      }

      const body = updateRoleClassificationSchema.parse(req.body);

      const updated = await prisma.$transaction(async (tx) => {
        if (body.jobDescription !== undefined) {
          await tx.roleClassification.update({
            where: { id: existing.id },
            data: { jobDescription: body.jobDescription },
          });
        }

        if (body.tags) {
          await tx.roleClassificationTag.deleteMany({
            where: { roleClassificationId: existing.id },
          });
          for (const tag of body.tags) {
            await tx.roleClassificationTag.create({
              data: {
                roleClassificationId: existing.id,
                dimensionId: tag.dimensionId,
                value: tag.value,
                numericValue: tag.numericValue ?? null,
                notes: tag.notes ?? null,
              },
            });
          }
        }

        return tx.roleClassification.findUnique({
          where: { id: existing.id },
          include: { tags: { include: { dimension: true } } },
        });
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'ROLE_CLASSIFICATION_UPDATED',
        entityType: 'RoleClassification',
        entityId: existing.id,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Confirm an AI-suggested classification
roleClassificationRouter.patch(
  '/:id/confirm',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.roleClassification.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Role classification not found' });
        return;
      }

      // Optionally update tags before confirming
      const body = updateRoleClassificationSchema.parse(req.body);
      if (body.tags) {
        await prisma.roleClassificationTag.deleteMany({
          where: { roleClassificationId: existing.id },
        });
        for (const tag of body.tags) {
          await prisma.roleClassificationTag.create({
            data: {
              roleClassificationId: existing.id,
              dimensionId: tag.dimensionId,
              value: tag.value,
              numericValue: tag.numericValue ?? null,
              notes: tag.notes ?? null,
            },
          });
        }
      }

      const updated = await prisma.roleClassification.update({
        where: { id: existing.id },
        data: {
          status: 'CONFIRMED',
          confirmedByUserId: req.user!.userId,
          confirmedAt: new Date(),
        },
        include: { tags: { include: { dimension: true } } },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'ROLE_CLASSIFICATION_CONFIRMED',
        entityType: 'RoleClassification',
        entityId: existing.id,
        metadata: { roleTitle: existing.roleTitle },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Trigger bulk AI classification
roleClassificationRouter.post(
  '/bulk-ai-classify',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const body = bulkClassifyRequestSchema.parse(req.body);
      const result = await bulkClassifyRoles(req.user!.organizationId!, body.roleIds);

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'ROLE_CLASSIFICATION_AI_GENERATED',
        entityType: 'RoleClassification',
        metadata: {
          processed: result.processed,
          successful: result.successful,
          failed: result.failed,
        },
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// Classify a single role with AI
roleClassificationRouter.post(
  '/:id/ai-classify',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const result = await classifyRoleWithAI(req.params['id']!, req.user!.organizationId!);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      const updated = await prisma.roleClassification.findUnique({
        where: { id: req.params['id'] },
        include: { tags: { include: { dimension: true } } },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'ROLE_CLASSIFICATION_AI_GENERATED',
        entityType: 'RoleClassification',
        entityId: req.params['id'],
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Delete a classification
roleClassificationRouter.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const existing = await prisma.roleClassification.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Role classification not found' });
        return;
      }

      await prisma.roleClassification.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

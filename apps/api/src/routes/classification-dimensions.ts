import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { createClassificationDimensionSchema, updateClassificationDimensionSchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export const classificationDimensionRouter = Router();
classificationDimensionRouter.use(authenticate);

// List all dimensions for organization (sorted by sortOrder)
classificationDimensionRouter.get('/', async (req, res, next) => {
  try {
    const dimensions = await prisma.classificationDimension.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(dimensions);
  } catch (err) {
    next(err);
  }
});

// Get a single dimension
classificationDimensionRouter.get('/:id', async (req, res, next) => {
  try {
    const dimension = await prisma.classificationDimension.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!dimension) {
      res.status(404).json({ error: 'Classification dimension not found' });
      return;
    }
    res.json(dimension);
  } catch (err) {
    next(err);
  }
});

// Create a new dimension
classificationDimensionRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const body = createClassificationDimensionSchema.parse(req.body);
      const dimension = await prisma.classificationDimension.create({
        data: {
          ...body,
          scaleConfig: body.scaleConfig as Prisma.InputJsonValue,
          organizationId: req.user!.organizationId!,
        },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'CLASSIFICATION_DIMENSION_CREATED',
        entityType: 'ClassificationDimension',
        entityId: dimension.id,
        metadata: { code: dimension.code, name: dimension.name },
      });

      res.status(201).json(dimension);
    } catch (err) {
      next(err);
    }
  },
);

// Update a dimension
classificationDimensionRouter.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.classificationDimension.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Classification dimension not found' });
        return;
      }

      const body = updateClassificationDimensionSchema.parse(req.body);
      const dimension = await prisma.classificationDimension.update({
        where: { id: existing.id },
        data: {
          ...body,
          scaleConfig: body.scaleConfig ? (body.scaleConfig as Prisma.InputJsonValue) : undefined,
        },
      });

      logAudit({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
        action: 'CLASSIFICATION_DIMENSION_UPDATED',
        entityType: 'ClassificationDimension',
        entityId: dimension.id,
        metadata: { code: dimension.code },
      });

      res.json(dimension);
    } catch (err) {
      next(err);
    }
  },
);

// Delete a dimension (only if no tags reference it)
classificationDimensionRouter.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const existing = await prisma.classificationDimension.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Classification dimension not found' });
        return;
      }

      const tagCount = await prisma.roleClassificationTag.count({
        where: { dimensionId: existing.id },
      });
      if (tagCount > 0) {
        res.status(409).json({
          error: 'Cannot delete dimension with existing classification tags. Remove tags first.',
        });
        return;
      }

      await prisma.classificationDimension.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

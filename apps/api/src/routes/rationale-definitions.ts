import { Router } from 'express';
import {
  createRationaleDefinitionSchema,
  updateRationaleDefinitionSchema,
  UserRole,
} from '@cdi/shared';
import { RationaleStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../services/audit.js';

export const rationaleDefinitionRouter = Router();
rationaleDefinitionRouter.use(authenticate);

// List rationale definitions for the org
// Query params: status (ACTIVE|ARCHIVED), category, includeAllVersions (true|false)
rationaleDefinitionRouter.get('/', async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const {
      status = 'ACTIVE',
      category,
      includeAllVersions,
    } = req.query as Record<string, string>;

    if (includeAllVersions === 'true') {
      const where: Record<string, unknown> = { organizationId: orgId };
      if (status && status !== 'ALL') where['status'] = status;
      if (category) where['category'] = category;

      const definitions = await prisma.rationaleDefinition.findMany({
        where,
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      });
      res.json(definitions);
      return;
    }

    // Default: only latest version per code
    const where: Record<string, unknown> = { organizationId: orgId };
    if (status && status !== 'ALL') where['status'] = status;
    if (category) where['category'] = category;

    const allDefs = await prisma.rationaleDefinition.findMany({
      where,
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
    });

    // Keep only the latest version per code
    const latestByCode = new Map<string, (typeof allDefs)[0]>();
    for (const def of allDefs) {
      if (!latestByCode.has(def.code)) {
        latestByCode.set(def.code, def);
      }
    }

    res.json(Array.from(latestByCode.values()));
  } catch (err) {
    next(err);
  }
});

// Get a single definition by ID
rationaleDefinitionRouter.get('/:id', async (req, res, next) => {
  try {
    const def = await prisma.rationaleDefinition.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!def) {
      res.status(404).json({ error: 'Rationale definition not found' });
      return;
    }
    res.json(def);
  } catch (err) {
    next(err);
  }
});

// Get version history for a specific code
rationaleDefinitionRouter.get('/code/:code/history', async (req, res, next) => {
  try {
    const versions = await prisma.rationaleDefinition.findMany({
      where: {
        organizationId: req.user!.organizationId!,
        code: req.params['code'],
      },
      orderBy: { version: 'desc' },
    });
    if (versions.length === 0) {
      res.status(404).json({ error: 'No rationale definitions found for this code' });
      return;
    }
    res.json(versions);
  } catch (err) {
    next(err);
  }
});

// Create a new rationale definition
rationaleDefinitionRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!;
      const body = createRationaleDefinitionSchema.parse(req.body);

      // Check code uniqueness within org
      const existing = await prisma.rationaleDefinition.findFirst({
        where: { organizationId: orgId, code: body.code },
      });
      if (existing) {
        res.status(409).json({ error: `Rationale code "${body.code}" already exists` });
        return;
      }

      const def = await prisma.rationaleDefinition.create({
        data: {
          organizationId: orgId,
          code: body.code,
          name: body.name,
          legalDescription: body.legalDescription,
          plainLanguageDescription: body.plainLanguageDescription,
          category: body.category,
          objectiveCriteriaTags: body.objectiveCriteriaTags,
          applicableDecisionTypes: body.applicableDecisionTypes,
          jurisdictionScope: body.jurisdictionScope,
          requiresSubstantiation: body.requiresSubstantiation,
          effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : new Date(),
          version: 1,
          createdByUserId: req.user!.userId,
        },
      });

      logAudit({
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'RATIONALE_CREATED',
        entityType: 'RationaleDefinition',
        entityId: def.id,
        metadata: { code: def.code, version: def.version },
        ipAddress: req.ip ?? null,
      });

      res.status(201).json(def);
    } catch (err) {
      next(err);
    }
  },
);

// Update a rationale definition (creates a new version)
rationaleDefinitionRouter.put(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!;
      const existing = await prisma.rationaleDefinition.findFirst({
        where: { id: req.params['id'], organizationId: orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Rationale definition not found' });
        return;
      }

      // Verify this is the latest version
      const latest = await prisma.rationaleDefinition.findFirst({
        where: { organizationId: orgId, code: existing.code },
        orderBy: { version: 'desc' },
      });
      if (latest && latest.id !== existing.id) {
        res.status(400).json({
          error: 'Can only edit the latest version. This definition has a newer version.',
        });
        return;
      }

      if (existing.status === RationaleStatus.ARCHIVED) {
        res.status(400).json({ error: 'Cannot edit an archived rationale definition' });
        return;
      }

      const body = updateRationaleDefinitionSchema.parse(req.body);

      // Transaction: close old version + create new
      const [, newDef] = await prisma.$transaction([
        prisma.rationaleDefinition.update({
          where: { id: existing.id },
          data: { effectiveTo: new Date() },
        }),
        prisma.rationaleDefinition.create({
          data: {
            organizationId: orgId,
            code: existing.code,
            name: body.name ?? existing.name,
            legalDescription: body.legalDescription ?? existing.legalDescription,
            plainLanguageDescription:
              body.plainLanguageDescription ?? existing.plainLanguageDescription,
            category: body.category ?? existing.category,
            objectiveCriteriaTags:
              body.objectiveCriteriaTags ??
              (existing.objectiveCriteriaTags as string[]),
            applicableDecisionTypes:
              body.applicableDecisionTypes ??
              (existing.applicableDecisionTypes as string[]),
            jurisdictionScope:
              body.jurisdictionScope ?? (existing.jurisdictionScope as string[]),
            requiresSubstantiation:
              body.requiresSubstantiation ?? existing.requiresSubstantiation,
            effectiveFrom: body.effectiveFrom
              ? new Date(body.effectiveFrom)
              : new Date(),
            version: existing.version + 1,
            status: existing.status,
            createdByUserId: req.user!.userId,
          },
        }),
      ]);

      logAudit({
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'RATIONALE_UPDATED',
        entityType: 'RationaleDefinition',
        entityId: newDef.id,
        metadata: {
          code: newDef.code,
          previousVersionId: existing.id,
          previousVersion: existing.version,
          newVersion: newDef.version,
        },
        ipAddress: req.ip ?? null,
      });

      res.json(newDef);
    } catch (err) {
      next(err);
    }
  },
);

// Archive a rationale definition
rationaleDefinitionRouter.post(
  '/:id/archive',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!;
      const existing = await prisma.rationaleDefinition.findFirst({
        where: { id: req.params['id'], organizationId: orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Rationale definition not found' });
        return;
      }
      if (existing.status === RationaleStatus.ARCHIVED) {
        res.status(400).json({ error: 'Already archived' });
        return;
      }

      const updated = await prisma.rationaleDefinition.update({
        where: { id: existing.id },
        data: {
          status: RationaleStatus.ARCHIVED,
          effectiveTo: new Date(),
        },
      });

      logAudit({
        organizationId: orgId,
        userId: req.user!.userId,
        action: 'RATIONALE_ARCHIVED',
        entityType: 'RationaleDefinition',
        entityId: updated.id,
        metadata: { code: updated.code, version: updated.version },
        ipAddress: req.ip ?? null,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// Delete a rationale definition (only if no historical usage)
rationaleDefinitionRouter.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const orgId = req.user!.organizationId!;
      const existing = await prisma.rationaleDefinition.findFirst({
        where: { id: req.params['id'], organizationId: orgId },
      });
      if (!existing) {
        res.status(404).json({ error: 'Rationale definition not found' });
        return;
      }

      // Check for historical usage across ALL versions of this code
      const usageCount = await prisma.payDecisionRationale.count({
        where: { rationaleDefinitionId: existing.id },
      });

      if (usageCount > 0) {
        res.status(409).json({
          error:
            'Cannot delete a rationale with historical pay decision usage. Archive it instead.',
          usageCount,
        });
        return;
      }

      await prisma.rationaleDefinition.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

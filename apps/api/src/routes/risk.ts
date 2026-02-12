import { Router } from 'express';
import { riskGroupQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const riskRouter = Router();
riskRouter.use(authenticate);

// Trigger a risk run manually
riskRouter.post('/run', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    // TODO: implement risk computation service
    const run = await prisma.riskRun.create({
      data: {
        triggeredBy: req.user!.userId,
        organizationId: req.user!.organizationId,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });
    res.status(202).json({ riskRunId: run.id, status: 'RUNNING' });
  } catch (err) {
    next(err);
  }
});

// Get latest risk run summary
riskRouter.get('/latest', async (req, res, next) => {
  try {
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestRun) {
      res.json({ message: 'No completed risk runs found' });
      return;
    }
    const groups = await prisma.riskGroupResult.findMany({
      where: { riskRunId: latestRun.id },
    });
    res.json({ run: latestRun, groups });
  } catch (err) {
    next(err);
  }
});

// List risk groups with filters
riskRouter.get('/groups', async (req, res, next) => {
  try {
    const query = riskGroupQuerySchema.parse(req.query);
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestRun) {
      res.json([]);
      return;
    }

    const where: Record<string, unknown> = { riskRunId: latestRun.id };
    if (query.riskState) where['riskState'] = query.riskState;
    if (query.country) where['country'] = query.country;
    if (query.jobFamily) where['jobFamily'] = query.jobFamily;
    if (query.level) where['level'] = query.level;

    const groups = await prisma.riskGroupResult.findMany({ where });
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Get group drilldown
riskRouter.get('/groups/:groupKey', async (req, res, next) => {
  try {
    const latestRun = await prisma.riskRun.findFirst({
      where: { status: 'COMPLETED', organizationId: req.user!.organizationId },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestRun) {
      res.status(404).json({ error: 'No completed risk runs' });
      return;
    }

    const group = await prisma.riskGroupResult.findFirst({
      where: { riskRunId: latestRun.id, groupKey: req.params['groupKey'] },
    });
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // TODO: include impacted employees and recent decisions in drilldown
    res.json(group);
  } catch (err) {
    next(err);
  }
});

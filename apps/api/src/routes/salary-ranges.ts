import { Router } from 'express';
import { createSalaryRangeSchema, salaryRangeFieldsSchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const salaryRangeRouter = Router();
salaryRangeRouter.use(authenticate);

// List all salary ranges for organization
salaryRangeRouter.get('/', async (req, res, next) => {
  try {
    const ranges = await prisma.salaryRange.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: [{ country: 'asc' }, { jobFamily: 'asc' }, { level: 'asc' }],
    });
    res.json(ranges);
  } catch (err) {
    next(err);
  }
});

// Get distinct employee groups and their salary range coverage
// NOTE: Must be before /:id to avoid Express matching "coverage" as an id
salaryRangeRouter.get('/coverage', async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    // Get distinct (country, jobFamily, level, currency) from employees
    const employeeGroups = await prisma.employee.groupBy({
      by: ['country', 'jobFamily', 'level', 'currency'],
      where: { organizationId: orgId },
      _count: { id: true },
    });

    // Get all salary ranges for this org
    const ranges = await prisma.salaryRange.findMany({
      where: { organizationId: orgId },
    });

    // Build a set of covered keys
    const coveredKeys = new Set(
      ranges.map((r) => `${r.country}|${r.jobFamily ?? ''}|${r.level}`),
    );

    const groups = employeeGroups.map((g) => ({
      country: g.country,
      jobFamily: g.jobFamily,
      level: g.level,
      currency: g.currency,
      employeeCount: g._count.id,
      hasSalaryRange: coveredKeys.has(`${g.country}|${g.jobFamily ?? ''}|${g.level}`),
    }));

    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// Get a single salary range
salaryRangeRouter.get('/:id', async (req, res, next) => {
  try {
    const range = await prisma.salaryRange.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId! },
    });
    if (!range) {
      res.status(404).json({ error: 'Salary range not found' });
      return;
    }
    res.json(range);
  } catch (err) {
    next(err);
  }
});

// Create a new salary range
salaryRangeRouter.post(
  '/',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const body = createSalaryRangeSchema.parse(req.body);
      const range = await prisma.salaryRange.create({
        data: {
          ...body,
          organizationId: req.user!.organizationId!,
        },
      });
      res.status(201).json(range);
    } catch (err) {
      next(err);
    }
  },
);

// Update a salary range
salaryRangeRouter.patch(
  '/:id',
  authorize(UserRole.ADMIN, UserRole.HR_MANAGER),
  async (req, res, next) => {
    try {
      const existing = await prisma.salaryRange.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Salary range not found' });
        return;
      }

      const body = salaryRangeFieldsSchema.partial().parse(req.body);
      const range = await prisma.salaryRange.update({
        where: { id: existing.id },
        data: body,
      });
      res.json(range);
    } catch (err) {
      next(err);
    }
  },
);

// Delete a salary range
salaryRangeRouter.delete(
  '/:id',
  authorize(UserRole.ADMIN),
  async (req, res, next) => {
    try {
      const existing = await prisma.salaryRange.findFirst({
        where: { id: req.params['id'], organizationId: req.user!.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: 'Salary range not found' });
        return;
      }

      await prisma.salaryRange.delete({ where: { id: existing.id } });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

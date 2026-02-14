import { Router } from 'express';
import { employeeListQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const employeeRouter = Router();
employeeRouter.use(authenticate);

employeeRouter.get('/', async (req, res, next) => {
  try {
    const query = employeeListQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
    };
    if (query.country) where['country'] = query.country;
    if (query.jobFamily) where['jobFamily'] = query.jobFamily;
    if (query.level) where['level'] = query.level;
    if (query.q) {
      where['OR'] = [
        { employeeId: { contains: query.q, mode: 'insensitive' } },
        { roleTitle: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { employeeId: 'asc' },
        include: {
          _count: { select: { payDecisions: true } },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    // Count employees with at least one pay decision (org-wide, not filtered)
    const withDecisions = await prisma.employee.count({
      where: {
        organizationId: req.user!.organizationId,
        payDecisions: { some: {} },
      },
    });
    const totalOrg = await prisma.employee.count({
      where: { organizationId: req.user!.organizationId },
    });

    const data = employees.map((emp: any) => ({
      ...emp,
      decisionCount: emp._count.payDecisions,
      _count: undefined,
    }));

    res.json({
      data,
      total,
      page: query.page,
      pageSize: query.pageSize,
      coverage: { withDecisions, totalEmployees: totalOrg },
    });
  } catch (err) {
    next(err);
  }
});

employeeRouter.get('/:id', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

// Get all snapshots for an employee (data history)
employeeRouter.get('/:id/snapshots', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const snapshots = await prisma.employeeSnapshot.findMany({
      where: { employeeId: employee.id },
      orderBy: { snapshotAt: 'desc' },
    });
    res.json(snapshots);
  } catch (err) {
    next(err);
  }
});

// Get the latest snapshot for an employee
employeeRouter.get('/:id/snapshots/latest', async (req, res, next) => {
  try {
    const employee = await prisma.employee.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const snapshot = await prisma.employeeSnapshot.findFirst({
      where: { employeeId: employee.id },
      orderBy: { snapshotAt: 'desc' },
    });
    if (!snapshot) {
      res.status(404).json({ error: 'No snapshots found for this employee' });
      return;
    }
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

employeeRouter.patch('/:id', authorize(UserRole.ADMIN, UserRole.HR_MANAGER), async (req, res, next) => {
  try {
    const existing = await prisma.employee.findFirst({
      where: { id: req.params['id'], organizationId: req.user!.organizationId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const employee = await prisma.employee.update({
      where: { id: existing.id },
      data: req.body,
    });
    res.json(employee);
  } catch (err) {
    next(err);
  }
});

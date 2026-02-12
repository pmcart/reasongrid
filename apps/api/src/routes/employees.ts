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
      }),
      prisma.employee.count({ where }),
    ]);

    res.json({ data: employees, total, page: query.page, pageSize: query.pageSize });
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

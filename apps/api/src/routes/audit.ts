import { Router } from 'express';
import { auditLogQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(authorize(UserRole.ADMIN, UserRole.HR_MANAGER));

// Get paginated audit log for the organization
auditRouter.get('/', async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const where: Record<string, unknown> = {
      organizationId: req.user!.organizationId,
    };
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.entityId) where['entityId'] = query.entityId;
    if (query.action) where['action'] = query.action;
    if (query.userId) where['userId'] = query.userId;

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ data: entries, total, page: query.page, pageSize: query.pageSize });
  } catch (err) {
    next(err);
  }
});

// Get all audit entries for a specific entity
auditRouter.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    const entries = await prisma.auditLog.findMany({
      where: {
        organizationId: req.user!.organizationId,
        entityType: req.params['entityType'],
        entityId: req.params['entityId'],
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(entries);
  } catch (err) {
    next(err);
  }
});

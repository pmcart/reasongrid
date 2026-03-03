import { Router } from 'express';
import { auditLogQuerySchema, UserRole } from '@cdi/shared';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorize } from '../middleware/auth.js';

export const auditRouter = Router();
auditRouter.use(authenticate);
auditRouter.use(authorize(UserRole.ADMIN, UserRole.HR_MANAGER));

/**
 * Batch-resolve entity references for audit log entries.
 * Returns a map of entityId -> human-readable label.
 */
async function resolveEntityRefs(
  entries: Array<{ entityType: string; entityId: string | null }>,
  organizationId: string,
): Promise<Map<string, string>> {
  const refs = new Map<string, string>();

  const employeeIds = entries
    .filter((e) => e.entityType === 'Employee' && e.entityId)
    .map((e) => e.entityId as string);

  const decisionIds = entries
    .filter((e) => e.entityType === 'PayDecision' && e.entityId)
    .map((e) => e.entityId as string);

  const importIds = entries
    .filter((e) => e.entityType === 'ImportJob' && e.entityId)
    .map((e) => e.entityId as string);

  await Promise.all([
    // Employees: show their short employeeId code
    employeeIds.length > 0
      ? prisma.employee
          .findMany({
            where: { id: { in: employeeIds }, organizationId },
            select: { id: true, employeeId: true },
          })
          .then((rows) => rows.forEach((r) => refs.set(r.id, r.employeeId)))
      : Promise.resolve(),

    // Pay decisions: show "EMP-XXX / Decision Type"
    decisionIds.length > 0
      ? prisma.payDecision
          .findMany({
            where: { id: { in: decisionIds } },
            select: {
              id: true,
              decisionType: true,
              employee: { select: { employeeId: true, organizationId: true } },
            },
          })
          .then((rows) =>
            rows.forEach((r) => {
              if (r.employee.organizationId !== organizationId) return;
              const type = r.decisionType
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase());
              refs.set(r.id, `${r.employee.employeeId} / ${type}`);
            }),
          )
      : Promise.resolve(),

    // Import jobs: show "Import — MMM d"
    importIds.length > 0
      ? prisma.importJob
          .findMany({
            where: { id: { in: importIds }, organizationId },
            select: { id: true, createdAt: true },
          })
          .then((rows) =>
            rows.forEach((r) => {
              const date = r.createdAt.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
              refs.set(r.id, `Import — ${date}`);
            }),
          )
      : Promise.resolve(),
  ]);

  return refs;
}

/**
 * Batch-resolve user emails from userId values.
 */
async function resolveUserEmails(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.email]));
}

// Get paginated audit log for the organization
auditRouter.get('/', async (req, res, next) => {
  try {
    const query = auditLogQuerySchema.parse(req.query);
    const orgId = req.user!.organizationId!;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.entityId) where['entityId'] = query.entityId;
    if (query.userId) where['userId'] = query.userId;

    // Apply action filter — respect explicit action, but exclude USER_LOGIN by default
    if (query.action) {
      where['action'] = query.action;
    } else if (query.excludeUserLogin) {
      where['action'] = { not: 'USER_LOGIN' };
    }

    const [entries, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Batch enrich: user emails + entity references
    const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean) as string[])];
    const [emailMap, entityRefMap] = await Promise.all([
      resolveUserEmails(userIds),
      resolveEntityRefs(entries, orgId),
    ]);

    const enriched = entries.map((entry) => ({
      ...entry,
      userEmail: entry.userId ? (emailMap.get(entry.userId) ?? null) : null,
      entityRef: entry.entityId ? (entityRefMap.get(entry.entityId) ?? null) : null,
    }));

    res.json({ data: enriched, total, page: query.page, pageSize: query.pageSize });
  } catch (err) {
    next(err);
  }
});

// Get all audit entries for a specific entity
auditRouter.get('/entity/:entityType/:entityId', async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId!;
    const entries = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: req.params['entityType'],
        entityId: req.params['entityId'],
      },
      orderBy: { createdAt: 'desc' },
    });

    const userIds = [...new Set(entries.map((e) => e.userId).filter(Boolean) as string[])];
    const [emailMap, entityRefMap] = await Promise.all([
      resolveUserEmails(userIds),
      resolveEntityRefs(entries, orgId),
    ]);

    const enriched = entries.map((entry) => ({
      ...entry,
      userEmail: entry.userId ? (emailMap.get(entry.userId) ?? null) : null,
      entityRef: entry.entityId ? (entityRefMap.get(entry.entityId) ?? null) : null,
    }));

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

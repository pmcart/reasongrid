import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', async (req, res, next) => {
  try {
    const orgId = req.user!.organizationId!;

    // PayDecision doesn't have organizationId directly — filter via employee relation
    const employeeOrgFilter = { employee: { organizationId: orgId } };

    const [
      employeeTotal,
      employeesWithDecisions,
      decisionTotal,
      decisionsByStatus,
      decisionsByType,
      recentDecisions,
      latestRiskRun,
      rationaleTotal,
      rationalesByCategory,
      recentActivity,
      latestAiReport,
    ] = await Promise.all([
      // Employee metrics
      prisma.employee.count({ where: { organizationId: orgId } }),

      prisma.employee.count({
        where: {
          organizationId: orgId,
          payDecisions: { some: {} },
        },
      }),

      // Pay decision metrics (scoped via employee relation)
      prisma.payDecision.count({ where: employeeOrgFilter }),

      prisma.payDecision.groupBy({
        by: ['status'],
        where: employeeOrgFilter,
        _count: { _all: true },
      }),

      prisma.payDecision.groupBy({
        by: ['decisionType'],
        where: employeeOrgFilter,
        _count: { _all: true },
      }),

      prisma.payDecision.findMany({
        where: { ...employeeOrgFilter, status: 'FINALISED' },
        orderBy: { finalisedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          decisionType: true,
          effectiveDate: true,
          payBeforeBase: true,
          payAfterBase: true,
          status: true,
          finalisedAt: true,
          employee: { select: { id: true, employeeId: true, roleTitle: true } },
        },
      }),

      // Risk metrics — latest completed run + its groups
      prisma.riskRun.findFirst({
        where: { organizationId: orgId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: {
          id: true,
          finishedAt: true,
          groups: {
            select: { groupKey: true, gapPct: true, riskState: true, country: true, jobFamily: true, level: true },
          },
        },
      }),

      // Rationale metrics
      prisma.rationaleDefinition.count({
        where: { organizationId: orgId, status: 'ACTIVE', effectiveTo: null },
      }),

      prisma.rationaleDefinition.groupBy({
        by: ['category'],
        where: { organizationId: orgId, status: 'ACTIVE', effectiveTo: null },
        _count: { _all: true },
      }),

      // Recent activity (AuditLog has no user relation — just userId)
      prisma.auditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userId: true,
          createdAt: true,
        },
      }),

      // Latest AI report
      prisma.aiRiskReport.findFirst({
        where: { organizationId: orgId },
        orderBy: { generatedAt: 'desc' },
        select: { id: true, summary: true, generatedAt: true, model: true },
      }),
    ]);

    // Look up emails for audit log users
    const userIds = [...new Set(recentActivity.map((a) => a.userId).filter(Boolean))] as string[];
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.email]));

    const activityWithUsers = recentActivity.map((a) => ({
      id: a.id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      createdAt: a.createdAt,
      user: a.userId ? { email: userMap.get(a.userId) ?? null } : null,
    }));

    // Aggregate risk groups
    const groups = latestRiskRun?.groups ?? [];
    const withinRange = groups.filter((g) => g.riskState === 'WITHIN_EXPECTED_RANGE').length;
    const requiresReview = groups.filter((g) => g.riskState === 'REQUIRES_REVIEW').length;
    const thresholdAlert = groups.filter((g) => g.riskState === 'THRESHOLD_ALERT').length;
    const avgGapPct =
      groups.length > 0 ? groups.reduce((sum, g) => sum + (g.gapPct ?? 0), 0) / groups.length : null;
    const highestGapGroup = groups.length > 0
      ? groups.reduce((max, g) => ((g.gapPct ?? 0) > (max.gapPct ?? 0) ? g : max), groups[0])
      : null;

    // Map groupBy counts to plain objects
    const statusMap: Record<string, number> = {};
    for (const s of decisionsByStatus) statusMap[s.status] = s._count._all;
    const typeMap: Record<string, number> = {};
    for (const t of decisionsByType) typeMap[t.decisionType] = t._count._all;
    const categoryMap: Record<string, number> = {};
    for (const c of rationalesByCategory) categoryMap[c.category] = c._count._all;

    res.json({
      employees: {
        total: employeeTotal,
        withDecisions: employeesWithDecisions,
        withoutDecisions: employeeTotal - employeesWithDecisions,
      },
      decisions: {
        total: decisionTotal,
        draft: statusMap['DRAFT'] ?? 0,
        finalised: statusMap['FINALISED'] ?? 0,
        byType: typeMap,
        recent: recentDecisions,
      },
      risk: {
        lastRunAt: latestRiskRun?.finishedAt ?? null,
        groups: {
          total: groups.length,
          withinRange,
          requiresReview,
          thresholdAlert,
        },
        avgGapPct: avgGapPct !== null ? Math.round(avgGapPct * 100) / 100 : null,
        highestGapGroup,
      },
      rationales: {
        total: rationaleTotal,
        byCategory: categoryMap,
      },
      recentActivity: activityWithUsers,
      aiInsight: latestAiReport,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Compliance service — readiness metrics and audit pack generation.
 */

import { prisma } from '../lib/prisma.js';
import { Readable } from 'stream';

export interface ReadinessMetric {
  covered: number;
  total: number;
  percentage: number;
}

export interface ReadinessMetrics {
  salaryRangeCoverage: ReadinessMetric;
  payDecisionDocumentation: ReadinessMetric;
  rationaleLibrary: {
    active: number;
    categoryCoverage: Record<string, number>;
  };
  riskAnalysis: {
    lastRunAt: string | null;
    alertCount: number;
    reviewCount: number;
  };
  genderDataCoverage: ReadinessMetric;
  classificationCoverage: ReadinessMetric;
  overallScore: number;
  status: 'INCOMPLETE' | 'PARTIAL' | 'COMPLETE';
}

/**
 * Calculate directive readiness metrics for an organization.
 */
export async function calculateReadiness(organizationId: string): Promise<ReadinessMetrics> {
  // 1. Salary range coverage
  const employeeGroups = await prisma.employee.groupBy({
    by: ['country', 'jobFamily', 'level'],
    where: { organizationId },
  });
  const salaryRanges = await prisma.salaryRange.findMany({
    where: { organizationId },
  });
  const rangeKeys = new Set(
    salaryRanges.map((r) => `${r.country}|${r.jobFamily ?? ''}|${r.level}`),
  );
  const coveredGroups = employeeGroups.filter((g) =>
    rangeKeys.has(`${g.country}|${g.jobFamily ?? ''}|${g.level}`),
  ).length;
  const salaryRangeCoverage = makeMetric(coveredGroups, employeeGroups.length);

  // 2. Pay decision documentation
  const totalEmployees = await prisma.employee.count({ where: { organizationId } });
  const employeesWithDecisions = await prisma.payDecision.groupBy({
    by: ['employeeId'],
    where: {
      employee: { organizationId },
      status: 'FINALISED',
    },
  });
  const payDecisionDocumentation = makeMetric(employeesWithDecisions.length, totalEmployees);

  // 3. Rationale library completeness
  const activeRationales = await prisma.rationaleDefinition.findMany({
    where: { organizationId, status: 'ACTIVE', effectiveTo: null },
    select: { category: true },
  });
  const categoryCoverage: Record<string, number> = {};
  for (const r of activeRationales) {
    categoryCoverage[r.category] = (categoryCoverage[r.category] || 0) + 1;
  }

  // 4. Risk analysis currency
  const latestRun = await prisma.riskRun.findFirst({
    where: { organizationId, status: 'COMPLETED' },
    orderBy: { finishedAt: 'desc' },
    include: {
      groups: { select: { riskState: true } },
    },
  });
  const alertCount = latestRun?.groups.filter((g) => g.riskState === 'THRESHOLD_ALERT').length ?? 0;
  const reviewCount = latestRun?.groups.filter((g) => g.riskState === 'REQUIRES_REVIEW').length ?? 0;

  // 5. Gender data coverage
  const employeesWithGender = await prisma.employee.count({
    where: { organizationId, gender: { not: null } },
  });
  const genderDataCoverage = makeMetric(employeesWithGender, totalEmployees);

  // 6. Classification coverage
  const uniqueRoles = await prisma.employee.groupBy({
    by: ['country', 'jobFamily', 'level', 'roleTitle'],
    where: { organizationId },
  });
  const confirmedClassifications = await prisma.roleClassification.count({
    where: { organizationId, status: 'CONFIRMED' },
  });
  const classificationCoverage = makeMetric(confirmedClassifications, uniqueRoles.length);

  // Calculate overall score (weighted)
  const overallScore = Math.round(
    salaryRangeCoverage.percentage * 0.20 +
    payDecisionDocumentation.percentage * 0.25 +
    (Object.keys(categoryCoverage).length >= 4 ? 100 : (Object.keys(categoryCoverage).length / 4) * 100) * 0.15 +
    (latestRun ? 100 : 0) * 0.15 +
    genderDataCoverage.percentage * 0.15 +
    classificationCoverage.percentage * 0.10,
  );

  const status = overallScore >= 80 ? 'COMPLETE' : overallScore >= 40 ? 'PARTIAL' : 'INCOMPLETE';

  return {
    salaryRangeCoverage,
    payDecisionDocumentation,
    rationaleLibrary: {
      active: activeRationales.length,
      categoryCoverage,
    },
    riskAnalysis: {
      lastRunAt: latestRun?.finishedAt?.toISOString() ?? null,
      alertCount,
      reviewCount,
    },
    genderDataCoverage,
    classificationCoverage,
    overallScore,
    status,
  };
}

function makeMetric(covered: number, total: number): ReadinessMetric {
  return {
    covered,
    total,
    percentage: total > 0 ? Math.round((covered / total) * 100) : 0,
  };
}

/**
 * Generate CSV content from an array of objects.
 */
export function toCsv(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate audit pack data (returns structured data for ZIP creation).
 */
export async function generateAuditPackData(
  organizationId: string,
  dateRange?: { from: Date; to: Date },
) {
  const dateFilter = dateRange
    ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
    : {};

  const [employees, payDecisions, riskResults, auditLogs, rationales, salaryRanges, classifications] =
    await Promise.all([
      prisma.employee.findMany({
        where: { organizationId, ...dateFilter },
        orderBy: { employeeId: 'asc' },
      }),
      prisma.payDecision.findMany({
        where: { employee: { organizationId }, ...dateFilter },
        include: {
          rationales: { include: { rationaleDefinition: true } },
          employee: { select: { employeeId: true } },
        },
        orderBy: { effectiveDate: 'desc' },
      }),
      prisma.riskGroupResult.findMany({
        where: {
          riskRun: { organizationId },
          ...(dateRange ? { computedAt: { gte: dateRange.from, lte: dateRange.to } } : {}),
        },
        orderBy: { computedAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: { organizationId, ...dateFilter },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      }),
      prisma.rationaleDefinition.findMany({
        where: { organizationId },
        orderBy: [{ code: 'asc' }, { version: 'desc' }],
      }),
      prisma.salaryRange.findMany({
        where: { organizationId },
        orderBy: [{ country: 'asc' }, { jobFamily: 'asc' }, { level: 'asc' }],
      }),
      prisma.roleClassification.findMany({
        where: { organizationId },
        include: { tags: { include: { dimension: true } } },
        orderBy: [{ country: 'asc' }, { roleTitle: 'asc' }],
      }),
    ]);

  return {
    employees: toCsv(employees.map((e) => ({
      employeeId: e.employeeId,
      roleTitle: e.roleTitle,
      jobFamily: e.jobFamily,
      level: e.level,
      country: e.country,
      location: e.location,
      currency: e.currency,
      baseSalary: e.baseSalary,
      bonusTarget: e.bonusTarget,
      ltiTarget: e.ltiTarget,
      gender: e.gender,
      hireDate: e.hireDate?.toISOString(),
      performanceRating: e.performanceRating,
    }))),
    payDecisions: toCsv(payDecisions.map((d) => ({
      employeeId: d.employee.employeeId,
      decisionType: d.decisionType,
      effectiveDate: d.effectiveDate.toISOString(),
      payBeforeBase: d.payBeforeBase,
      payAfterBase: d.payAfterBase,
      status: d.status,
      rationales: d.rationales.map((r) => r.rationaleDefinition.code).join('; '),
      supportingContext: d.supportingContext,
      finalisedAt: d.finalisedAt?.toISOString(),
    }))),
    riskResults: toCsv(riskResults.map((r) => ({
      groupKey: r.groupKey,
      country: r.country,
      jobFamily: r.jobFamily,
      level: r.level,
      womenCount: r.womenCount,
      menCount: r.menCount,
      gapPct: r.gapPct,
      riskState: r.riskState,
      notes: r.notes,
      computedAt: r.computedAt.toISOString(),
    }))),
    auditLog: toCsv(auditLogs.map((a) => ({
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      userId: a.userId,
      createdAt: a.createdAt.toISOString(),
      metadata: a.metadata ? JSON.stringify(a.metadata) : '',
    }))),
    rationaleDefinitions: toCsv(rationales.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      legalDescription: r.legalDescription,
      status: r.status,
      version: r.version,
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString(),
    }))),
    salaryRanges: toCsv(salaryRanges.map((s) => ({
      country: s.country,
      jobFamily: s.jobFamily,
      level: s.level,
      currency: s.currency,
      min: s.min,
      mid: s.mid,
      max: s.max,
    }))),
    roleClassifications: toCsv(classifications.map((c) => ({
      country: c.country,
      jobFamily: c.jobFamily,
      level: c.level,
      roleTitle: c.roleTitle,
      status: c.status,
      confirmedAt: c.confirmedAt?.toISOString(),
      tags: c.tags.map((t) => `${t.dimension.code}=${t.value}`).join('; '),
    }))),
  };
}

import { prisma } from '../lib/prisma.js';
import { DecisionType, DecisionStatus } from '@cdi/shared';

interface SnapshotContextInput {
  employeeId: string;
  organizationId: string;
  employee: {
    country: string;
    jobFamily: string | null;
    level: string;
    roleTitle: string;
    currency: string;
    baseSalary: number;
    hireDate: Date | null;
  };
}

interface ComputedContext {
  tenureYears: number | null;
  compaRatio: number | null;
  positionInRange: number | null;
  comparatorGroupKey: string;
  priorPromotionCount: number;
  lastPromotionDate: Date | null;
  priorIncreaseCount: number;
  priorIncreaseTotalPct: number;
}

export async function computeSnapshotContext(
  input: SnapshotContextInput,
): Promise<ComputedContext> {
  const { employeeId, organizationId, employee } = input;

  // 1. Tenure years from hireDate
  const tenureYears = employee.hireDate
    ? Math.round(((Date.now() - employee.hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) * 100) / 100
    : null;

  // 2. Comparator group key
  const comparatorGroupKey = employee.jobFamily
    ? `${employee.country}:${employee.jobFamily}:${employee.level}`
    : `${employee.country}:${employee.level}:${employee.roleTitle}`;

  // 3. Compa ratio + position in range from SalaryRange
  let compaRatio: number | null = null;
  let positionInRange: number | null = null;

  const salaryRange = await prisma.salaryRange.findFirst({
    where: {
      organizationId,
      country: employee.country,
      jobFamily: employee.jobFamily,
      level: employee.level,
    },
  });

  if (salaryRange && salaryRange.mid > 0) {
    compaRatio = Math.round((employee.baseSalary / salaryRange.mid) * 1000) / 1000;
    const rangeSpan = salaryRange.max - salaryRange.min;
    if (rangeSpan > 0) {
      positionInRange = Math.round(((employee.baseSalary - salaryRange.min) / rangeSpan) * 1000) / 1000;
    }
  }

  // 4. Promotion history (all finalised promotions for this employee)
  const promotions = await prisma.payDecision.findMany({
    where: {
      employeeId,
      decisionType: DecisionType.PROMOTION,
      status: DecisionStatus.FINALISED,
    },
    orderBy: { effectiveDate: 'desc' },
    select: { effectiveDate: true },
  });

  const priorPromotionCount = promotions.length;
  const lastPromotionDate = promotions[0]?.effectiveDate ?? null;

  // 5. Prior increases in last 24 months (finalised annual increases + adjustments)
  const twentyFourMonthsAgo = new Date();
  twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24);

  const recentIncreases = await prisma.payDecision.findMany({
    where: {
      employeeId,
      decisionType: { in: [DecisionType.ANNUAL_INCREASE, DecisionType.ADJUSTMENT] },
      status: DecisionStatus.FINALISED,
      effectiveDate: { gte: twentyFourMonthsAgo },
    },
    select: { payBeforeBase: true, payAfterBase: true },
  });

  const priorIncreaseCount = recentIncreases.length;
  const priorIncreaseTotalPct = recentIncreases.reduce((sum, d) => {
    if (d.payBeforeBase > 0) {
      return sum + ((d.payAfterBase - d.payBeforeBase) / d.payBeforeBase) * 100;
    }
    return sum;
  }, 0);

  return {
    tenureYears,
    compaRatio,
    positionInRange,
    comparatorGroupKey,
    priorPromotionCount,
    lastPromotionDate,
    priorIncreaseCount,
    priorIncreaseTotalPct: Math.round(priorIncreaseTotalPct * 100) / 100,
  };
}

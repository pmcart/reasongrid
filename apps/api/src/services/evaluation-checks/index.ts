import { prisma } from '../../lib/prisma.js';
import { CheckType, DecisionType } from '@cdi/shared';
import type { EvaluationContext, CheckResult, CheckFunction } from './types.js';
import { genderGapImpactCheck } from './gender-gap-impact.js';
import { salaryRangeCheck } from './salary-range.js';
import { medianDeviationCheck } from './median-deviation.js';
import { historicalConsistencyCheck } from './historical-consistency.js';
import { changeMagnitudeCheck } from './change-magnitude.js';

const CHECK_REGISTRY: Record<string, CheckFunction> = {
  [CheckType.GENDER_GAP_IMPACT]: genderGapImpactCheck,
  [CheckType.SALARY_RANGE_COMPLIANCE]: salaryRangeCheck,
  [CheckType.MEDIAN_DEVIATION]: medianDeviationCheck,
  [CheckType.HISTORICAL_CONSISTENCY]: historicalConsistencyCheck,
  [CheckType.CHANGE_MAGNITUDE]: changeMagnitudeCheck,
};

export interface EvaluationInput {
  employeeId: string;
  organizationId: string;
  decisionType: DecisionType;
  payAfterBase: number;
}

export interface EvaluationOutput {
  overallStatus: 'PASS' | 'WARNING' | 'BLOCK';
  checks: CheckResult[];
}

/**
 * Build the evaluation context once, then run all enabled checks.
 */
export async function runEvaluation(input: EvaluationInput): Promise<EvaluationOutput> {
  const { employeeId, organizationId, decisionType, payAfterBase } = input;

  // Load employee
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, organizationId },
  });
  if (!employee) {
    throw Object.assign(new Error('Employee not found'), { status: 404 });
  }

  // Load enabled policy rules for this org
  const allRules = await prisma.policyRule.findMany({
    where: { organizationId, enabled: true },
  });

  // Filter rules applicable to this decision type and country
  const applicableRules = allRules.filter((rule) => {
    const types = rule.appliesToDecisionTypes as string[];
    const countries = rule.appliesToCountries as string[];
    const typeMatch = types.length === 0 || types.includes(decisionType);
    const countryMatch = countries.length === 0 || countries.includes(employee.country);
    return typeMatch && countryMatch;
  });

  if (applicableRules.length === 0) {
    return { overallStatus: 'PASS', checks: [] };
  }

  // Build context (single set of queries)
  const context = await buildContext(employee, organizationId, decisionType);

  // Run each check
  const checks: CheckResult[] = [];
  for (const rule of applicableRules) {
    const checkFn = CHECK_REGISTRY[rule.checkType];
    if (!checkFn) continue;

    const result = checkFn(
      context,
      payAfterBase,
      rule.params as Record<string, any>,
      rule.severity as any,
    );
    checks.push(result);
  }

  // Compute overall status
  let overallStatus: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  for (const check of checks) {
    if (check.status === 'BLOCK') {
      overallStatus = 'BLOCK';
      break;
    }
    if (check.status === 'WARNING') {
      overallStatus = 'WARNING';
    }
  }

  return { overallStatus, checks };
}

async function buildContext(
  employee: {
    id: string;
    baseSalary: number;
    gender: string | null;
    country: string;
    jobFamily: string | null;
    level: string;
    roleTitle: string;
    currency: string;
    organizationId: string;
  },
  organizationId: string,
  decisionType: DecisionType,
): Promise<EvaluationContext> {
  // Build comparator group key
  const groupFilter = employee.jobFamily
    ? { country: employee.country, jobFamily: employee.jobFamily, level: employee.level }
    : { country: employee.country, level: employee.level, roleTitle: employee.roleTitle };

  // Parallel queries
  const [peers, salaryRange, recentDecisions] = await Promise.all([
    // Comparator group peers (same country+jobFamily+level, or fallback)
    prisma.employee.findMany({
      where: { organizationId, ...groupFilter },
      select: { baseSalary: true, gender: true },
    }),

    // Salary range
    prisma.salaryRange.findFirst({
      where: {
        organizationId,
        country: employee.country,
        jobFamily: employee.jobFamily,
        level: employee.level,
      },
    }),

    // Recent similar decisions (same decisionType, same level, last 12 months)
    prisma.payDecision.findMany({
      where: {
        employee: {
          organizationId,
          level: employee.level,
        },
        decisionType: decisionType,
        status: 'FINALISED',
        effectiveDate: {
          gte: new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000),
        },
      },
      select: {
        payAfterBase: true,
        payBeforeBase: true,
        effectiveDate: true,
      },
      orderBy: { effectiveDate: 'desc' },
      take: 50,
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      baseSalary: employee.baseSalary,
      gender: employee.gender,
      country: employee.country,
      jobFamily: employee.jobFamily,
      level: employee.level,
      roleTitle: employee.roleTitle,
      currency: employee.currency,
    },
    comparatorGroupPeers: peers,
    salaryRange: salaryRange
      ? { min: salaryRange.min, mid: salaryRange.mid, max: salaryRange.max, currency: salaryRange.currency }
      : null,
    recentSimilarDecisions: recentDecisions,
    currentGroupGapPct: null, // computed within the gender gap check itself
  };
}

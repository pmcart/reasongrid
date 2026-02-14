/**
 * Risk Computation Service
 *
 * Computes gender pay gap risk across comparator groups for an organisation.
 * Groups employees by (country + jobFamily + level) with a fallback to
 * (country + level + roleTitle) when jobFamily is null.
 *
 * Gap metric: median baseSalary comparison (men vs women).
 * Falls back to mean when either gender has fewer than 3 members.
 *
 * Thresholds:
 *   < 4%  → WITHIN_EXPECTED_RANGE
 *   4–<5% → REQUIRES_REVIEW
 *   ≥ 5%  → THRESHOLD_ALERT
 */

import { prisma } from '../lib/prisma.js';
import { logAudit } from './audit.js';

// Gender classification maps (case-insensitive)
const FEMALE_VALUES = new Set(['female', 'f', 'woman', 'w']);
const MALE_VALUES = new Set(['male', 'm', 'man']);

type GenderCategory = 'female' | 'male' | 'unknown';

function classifyGender(raw: string | null | undefined): GenderCategory {
  if (!raw) return 'unknown';
  const normalised = raw.trim().toLowerCase();
  if (FEMALE_VALUES.has(normalised)) return 'female';
  if (MALE_VALUES.has(normalised)) return 'male';
  return 'unknown';
}

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

interface GroupedEmployee {
  baseSalary: number;
  gender: GenderCategory;
}

interface ComparatorGroup {
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitleFallback: string | null;
  groupKey: string;
  employees: GroupedEmployee[];
}

function buildGroupKey(
  country: string,
  jobFamily: string | null,
  level: string,
  roleTitle: string,
): { groupKey: string; roleTitleFallback: string | null } {
  if (jobFamily) {
    return { groupKey: `${country}:${jobFamily}:${level}`, roleTitleFallback: null };
  }
  return { groupKey: `${country}:${level}:${roleTitle}`, roleTitleFallback: roleTitle };
}

function determineRiskState(absGapPct: number): 'WITHIN_EXPECTED_RANGE' | 'REQUIRES_REVIEW' | 'THRESHOLD_ALERT' {
  if (absGapPct >= 5) return 'THRESHOLD_ALERT';
  if (absGapPct >= 4) return 'REQUIRES_REVIEW';
  return 'WITHIN_EXPECTED_RANGE';
}

/**
 * Create a RiskRun record and return its ID immediately.
 * Then kick off computation asynchronously.
 */
export async function startRiskComputation(
  organizationId: string,
  triggeredBy: string,
  importJobId?: string,
): Promise<string> {
  const run = await prisma.riskRun.create({
    data: {
      organizationId,
      triggeredBy,
      importJobId: importJobId ?? null,
      status: 'RUNNING',
      startedAt: new Date(),
    },
  });

  logAudit({
    organizationId,
    userId: triggeredBy === 'SYSTEM' ? null : triggeredBy,
    action: 'RISK_RUN_TRIGGERED',
    entityType: 'RiskRun',
    entityId: run.id,
  });

  // Fire-and-forget the actual computation
  executeRiskComputation(run.id, organizationId, triggeredBy).catch((err) =>
    console.error('Risk computation failed:', err),
  );

  return run.id;
}

/**
 * Run risk computation for an organisation (convenience wrapper that awaits everything).
 * Used by scheduler and event triggers where we don't need the run ID immediately.
 */
export async function runRiskComputation(
  organizationId: string,
  triggeredBy: string,
  importJobId?: string,
): Promise<string> {
  const runId = await startRiskComputation(organizationId, triggeredBy, importJobId);
  // Wait for computation to finish (the startRiskComputation already kicked it off)
  // Poll until done
  for (let i = 0; i < 120; i++) {
    const run = await prisma.riskRun.findUnique({ where: { id: runId } });
    if (run && (run.status === 'COMPLETED' || run.status === 'FAILED')) return runId;
    await new Promise((r) => setTimeout(r, 500));
  }
  return runId;
}

/**
 * Execute the actual risk computation for a pre-created RiskRun.
 */
async function executeRiskComputation(
  runId: string,
  organizationId: string,
  triggeredBy: string,
): Promise<void> {
  try {
    // Fetch all employees in the org (only fields needed for computation)
    const employees = await prisma.employee.findMany({
      where: { organizationId },
      select: {
        baseSalary: true,
        gender: true,
        country: true,
        jobFamily: true,
        level: true,
        roleTitle: true,
      },
    });

    // Build comparator groups
    const groupMap = new Map<string, ComparatorGroup>();

    for (const emp of employees) {
      const genderCat = classifyGender(emp.gender);
      if (genderCat === 'unknown') continue; // skip employees without recognised gender

      const { groupKey, roleTitleFallback } = buildGroupKey(
        emp.country,
        emp.jobFamily,
        emp.level,
        emp.roleTitle,
      );

      let group = groupMap.get(groupKey);
      if (!group) {
        group = {
          country: emp.country,
          jobFamily: emp.jobFamily,
          level: emp.level,
          roleTitleFallback,
          groupKey,
          employees: [],
        };
        groupMap.set(groupKey, group);
      }

      group.employees.push({ baseSalary: emp.baseSalary, gender: genderCat });
    }

    // Compute risk metrics per group
    const results: Array<{
      riskRunId: string;
      country: string;
      jobFamily: string | null;
      level: string;
      roleTitleFallback: string | null;
      groupKey: string;
      womenCount: number;
      menCount: number;
      gapPct: number;
      riskState: 'WITHIN_EXPECTED_RANGE' | 'REQUIRES_REVIEW' | 'THRESHOLD_ALERT';
      notes: string | null;
      computedAt: Date;
    }> = [];

    const now = new Date();

    for (const group of groupMap.values()) {
      const womenSalaries = group.employees
        .filter((e) => e.gender === 'female')
        .map((e) => e.baseSalary);
      const menSalaries = group.employees
        .filter((e) => e.gender === 'male')
        .map((e) => e.baseSalary);

      const womenCount = womenSalaries.length;
      const menCount = menSalaries.length;

      let gapPct = 0;
      let riskState: 'WITHIN_EXPECTED_RANGE' | 'REQUIRES_REVIEW' | 'THRESHOLD_ALERT' = 'WITHIN_EXPECTED_RANGE';
      let notes: string | null = null;

      if (womenCount === 0 || menCount === 0) {
        // Only one gender present
        notes = 'insufficient data';
      } else {
        // Both genders present — choose median or mean
        const useMedian = womenCount >= 3 && menCount >= 3;
        if (!useMedian) {
          notes = 'low sample size';
        }

        const womenMetric = useMedian ? computeMedian(womenSalaries) : computeMean(womenSalaries);
        const menMetric = useMedian ? computeMedian(menSalaries) : computeMean(menSalaries);

        if (menMetric !== 0) {
          gapPct = ((menMetric - womenMetric) / menMetric) * 100;
        }

        riskState = determineRiskState(Math.abs(gapPct));

        // Round to 1 decimal place
        gapPct = Math.round(gapPct * 10) / 10;
      }

      results.push({
        riskRunId: runId,
        country: group.country,
        jobFamily: group.jobFamily,
        level: group.level,
        roleTitleFallback: group.roleTitleFallback,
        groupKey: group.groupKey,
        womenCount,
        menCount,
        gapPct,
        riskState,
        notes,
        computedAt: now,
      });
    }

    // Bulk create results
    if (results.length > 0) {
      await prisma.riskGroupResult.createMany({ data: results });
    }

    // Mark run as completed
    await prisma.riskRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });

    logAudit({
      organizationId,
      userId: triggeredBy === 'SYSTEM' ? null : triggeredBy,
      action: 'RISK_RUN_COMPLETED',
      entityType: 'RiskRun',
      entityId: runId,
      metadata: { groupCount: results.length },
    });
  } catch (err) {
    console.error('Risk computation failed:', err);

    await prisma.riskRun.update({
      where: { id: runId },
      data: { status: 'FAILED', finishedAt: new Date() },
    }).catch(() => {}); // don't throw if this also fails

    logAudit({
      organizationId,
      userId: triggeredBy === 'SYSTEM' ? null : triggeredBy,
      action: 'RISK_RUN_COMPLETED',
      entityType: 'RiskRun',
      entityId: runId,
      metadata: { error: String(err) },
    });

    throw err;
  }
}

import type { CheckType, PolicySeverity } from '@cdi/shared';

export interface EvaluationContext {
  employee: {
    id: string;
    baseSalary: number;
    gender: string | null;
    country: string;
    jobFamily: string | null;
    level: string;
    roleTitle: string;
    currency: string;
  };
  comparatorGroupPeers: Array<{
    baseSalary: number;
    gender: string | null;
  }>;
  salaryRange: {
    min: number;
    mid: number;
    max: number;
    currency: string;
  } | null;
  recentSimilarDecisions: Array<{
    payAfterBase: number;
    payBeforeBase: number;
    effectiveDate: Date;
  }>;
  currentGroupGapPct: number | null;
}

export interface CheckResult {
  checkType: CheckType;
  status: 'PASS' | 'WARNING' | 'BLOCK';
  severity: PolicySeverity;
  headline: string;
  detail: string;
  currentValue?: number;
  projectedValue?: number;
  threshold?: number;
}

export type CheckFunction = (
  context: EvaluationContext,
  proposedPayAfterBase: number,
  params: Record<string, any>,
  severity: PolicySeverity,
) => CheckResult;

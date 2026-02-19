import { CheckType, PolicySeverity } from '@cdi/shared';
import type { CheckFunction, EvaluationContext } from './types.js';

const FEMALE_VALUES = new Set(['female', 'f', 'woman', 'w']);
const MALE_VALUES = new Set(['male', 'm', 'man']);

function classifyGender(raw: string | null | undefined): 'female' | 'male' | 'unknown' {
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
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function computeGap(peers: Array<{ baseSalary: number; gender: string | null }>): number | null {
  const women: number[] = [];
  const men: number[] = [];

  for (const p of peers) {
    const g = classifyGender(p.gender);
    if (g === 'female') women.push(p.baseSalary);
    else if (g === 'male') men.push(p.baseSalary);
  }

  if (women.length === 0 || men.length === 0) return null;

  const womenMetric = women.length >= 3 && men.length >= 3 ? computeMedian(women) : women.reduce((a, b) => a + b, 0) / women.length;
  const menMetric = women.length >= 3 && men.length >= 3 ? computeMedian(men) : men.reduce((a, b) => a + b, 0) / men.length;

  if (menMetric === 0) return null;
  return Math.round(((menMetric - womenMetric) / menMetric) * 1000) / 10;
}

export const genderGapImpactCheck: CheckFunction = (
  context: EvaluationContext,
  proposedPayAfterBase: number,
  params: Record<string, any>,
  severity: PolicySeverity,
) => {
  const { warningThresholdPct = 4, blockThresholdPct = 5 } = params;

  // Compute current gap
  const currentGap = computeGap(context.comparatorGroupPeers);

  if (currentGap === null) {
    return {
      checkType: CheckType.GENDER_GAP_IMPACT,
      status: 'PASS',
      severity,
      headline: 'Insufficient data for gender gap analysis',
      detail: 'The comparator group does not have both male and female employees, so gap impact cannot be assessed.',
    };
  }

  // Simulate: replace this employee's salary in the group
  const employeeGender = classifyGender(context.employee.gender);
  const simulatedPeers = context.comparatorGroupPeers.map((p) => {
    // Find the employee in the peer list and replace their salary
    if (p.baseSalary === context.employee.baseSalary && classifyGender(p.gender) === employeeGender) {
      return { ...p, baseSalary: proposedPayAfterBase };
    }
    return p;
  });

  // If the employee wasn't found in peers (shouldn't happen), add them
  const projectedGap = computeGap(simulatedPeers) ?? currentGap;
  const absProjected = Math.abs(projectedGap);

  let status: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  if (absProjected >= blockThresholdPct && severity === PolicySeverity.BLOCK) {
    status = 'BLOCK';
  } else if (absProjected >= warningThresholdPct) {
    status = absProjected >= blockThresholdPct && severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
  }

  // Re-evaluate with severity mapping
  if (absProjected >= blockThresholdPct) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
  } else if (absProjected >= warningThresholdPct) {
    status = 'WARNING';
  } else {
    status = 'PASS';
  }

  const direction = projectedGap > 0 ? 'favouring men' : 'favouring women';

  return {
    checkType: CheckType.GENDER_GAP_IMPACT,
    status,
    severity,
    headline: status === 'PASS'
      ? `Gender gap remains within threshold (${absProjected.toFixed(1)}%)`
      : `Creates ${absProjected.toFixed(1)}% gender gap in comparator group (${direction})`,
    detail: status === 'PASS'
      ? `Current gap: ${Math.abs(currentGap).toFixed(1)}%. Projected gap after this change: ${absProjected.toFixed(1)}%. Threshold: ${warningThresholdPct}%.`
      : `Current gap: ${Math.abs(currentGap).toFixed(1)}%. This change would move the gap to ${absProjected.toFixed(1)}%, which ${absProjected >= blockThresholdPct ? 'exceeds' : 'approaches'} the ${blockThresholdPct}% threshold and may require review.`,
    currentValue: Math.round(Math.abs(currentGap) * 10) / 10,
    projectedValue: Math.round(absProjected * 10) / 10,
    threshold: warningThresholdPct,
  };
};

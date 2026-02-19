import { CheckType, PolicySeverity } from '@cdi/shared';
import type { CheckFunction } from './types.js';

export const salaryRangeCheck: CheckFunction = (context, proposedPayAfterBase, params, severity) => {
  const { allowAboveMax = false, allowBelowMin = false } = params;

  if (!context.salaryRange) {
    return {
      checkType: CheckType.SALARY_RANGE_COMPLIANCE,
      status: 'PASS',
      severity,
      headline: 'No salary range defined for this role',
      detail: 'No salary range has been configured for this employee\'s country, job family, and level. Configure salary ranges to enable this check.',
    };
  }

  const { min, mid, max } = context.salaryRange;
  const positionInRange = max !== min ? (proposedPayAfterBase - min) / (max - min) : 0.5;
  const positionPct = Math.round(positionInRange * 100);

  let status: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  let headline = '';
  let detail = '';

  if (proposedPayAfterBase > max && !allowAboveMax) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
    const overPct = ((proposedPayAfterBase - max) / max * 100).toFixed(1);
    headline = `Proposed pay exceeds salary range maximum by ${overPct}%`;
    detail = `Range: ${min.toLocaleString()} – ${max.toLocaleString()} (mid: ${mid.toLocaleString()}). Proposed pay of ${proposedPayAfterBase.toLocaleString()} is ${overPct}% above the maximum.`;
  } else if (proposedPayAfterBase < min && !allowBelowMin) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
    const underPct = ((min - proposedPayAfterBase) / min * 100).toFixed(1);
    headline = `Proposed pay is ${underPct}% below salary range minimum`;
    detail = `Range: ${min.toLocaleString()} – ${max.toLocaleString()} (mid: ${mid.toLocaleString()}). Proposed pay of ${proposedPayAfterBase.toLocaleString()} is below the minimum.`;
  } else {
    headline = `Within salary range at ${positionPct}% position`;
    detail = `Range: ${min.toLocaleString()} – ${max.toLocaleString()} (mid: ${mid.toLocaleString()}). Proposed pay of ${proposedPayAfterBase.toLocaleString()} is at the ${positionPct}th percentile of the range.`;
  }

  return {
    checkType: CheckType.SALARY_RANGE_COMPLIANCE,
    status,
    severity,
    headline,
    detail,
    currentValue: context.employee.baseSalary,
    projectedValue: proposedPayAfterBase,
    threshold: max,
  };
};

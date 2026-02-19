import { CheckType, PolicySeverity } from '@cdi/shared';
import type { CheckFunction } from './types.js';

export const changeMagnitudeCheck: CheckFunction = (context, proposedPayAfterBase, params, severity) => {
  const { warningPct = 15, blockPct = 25 } = params;
  const currentBase = context.employee.baseSalary;

  if (currentBase === 0) {
    return {
      checkType: CheckType.CHANGE_MAGNITUDE,
      status: 'PASS',
      severity,
      headline: 'Current base salary is zero',
      detail: 'Cannot compute change magnitude when the current base salary is zero.',
    };
  }

  const changePct = ((proposedPayAfterBase - currentBase) / currentBase) * 100;
  const absChangePct = Math.abs(changePct);
  const changeRounded = Math.round(absChangePct * 10) / 10;
  const direction = changePct > 0 ? 'increase' : 'decrease';

  let status: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  if (absChangePct >= blockPct) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
  } else if (absChangePct >= warningPct) {
    status = 'WARNING';
  }

  return {
    checkType: CheckType.CHANGE_MAGNITUDE,
    status,
    severity,
    headline: status === 'PASS'
      ? `${changeRounded}% ${direction} — within normal range`
      : `Large ${direction}: ${changeRounded}% change in base salary`,
    detail: `Current: ${currentBase.toLocaleString()}. Proposed: ${proposedPayAfterBase.toLocaleString()} (${changePct > 0 ? '+' : ''}${changeRounded}% ${direction}). Warning threshold: ${warningPct}%, block threshold: ${blockPct}%.`,
    currentValue: currentBase,
    projectedValue: proposedPayAfterBase,
    threshold: warningPct,
  };
};

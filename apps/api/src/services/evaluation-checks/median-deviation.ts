import { CheckType, PolicySeverity } from '@cdi/shared';
import type { CheckFunction } from './types.js';

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export const medianDeviationCheck: CheckFunction = (context, proposedPayAfterBase, params, severity) => {
  const { warningDeviationPct = 10, blockDeviationPct = 20 } = params;

  const peerSalaries = context.comparatorGroupPeers.map((p) => p.baseSalary);
  if (peerSalaries.length < 2) {
    return {
      checkType: CheckType.MEDIAN_DEVIATION,
      status: 'PASS',
      severity,
      headline: 'Insufficient peers for median comparison',
      detail: 'The comparator group has fewer than 2 employees, so median deviation cannot be assessed.',
    };
  }

  const median = computeMedian(peerSalaries);
  if (median === 0) {
    return {
      checkType: CheckType.MEDIAN_DEVIATION,
      status: 'PASS',
      severity,
      headline: 'Peer median is zero',
      detail: 'Cannot compute deviation when the peer median salary is zero.',
    };
  }

  const deviationPct = Math.abs(((proposedPayAfterBase - median) / median) * 100);
  const deviationRounded = Math.round(deviationPct * 10) / 10;
  const direction = proposedPayAfterBase > median ? 'above' : 'below';

  let status: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  if (deviationPct >= blockDeviationPct) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
  } else if (deviationPct >= warningDeviationPct) {
    status = 'WARNING';
  }

  return {
    checkType: CheckType.MEDIAN_DEVIATION,
    status,
    severity,
    headline: status === 'PASS'
      ? `Within ${deviationRounded}% of peer median`
      : `${deviationRounded}% ${direction} peer median in comparator group`,
    detail: `Peer median salary: ${median.toLocaleString()}. Proposed pay of ${proposedPayAfterBase.toLocaleString()} is ${deviationRounded}% ${direction} the median (${peerSalaries.length} peers in group).`,
    currentValue: context.employee.baseSalary,
    projectedValue: proposedPayAfterBase,
    threshold: warningDeviationPct,
  };
};

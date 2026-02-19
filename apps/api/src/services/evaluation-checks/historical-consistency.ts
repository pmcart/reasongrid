import { CheckType, PolicySeverity } from '@cdi/shared';
import type { CheckFunction } from './types.js';

export const historicalConsistencyCheck: CheckFunction = (context, proposedPayAfterBase, params, severity) => {
  const { warningDeviationPct = 15 } = params;

  if (context.recentSimilarDecisions.length === 0) {
    return {
      checkType: CheckType.HISTORICAL_CONSISTENCY,
      status: 'PASS',
      severity,
      headline: 'No recent comparable decisions found',
      detail: 'There are no finalised decisions of the same type and level in the lookback period for comparison.',
    };
  }

  const avgPayAfter = context.recentSimilarDecisions.reduce((s, d) => s + d.payAfterBase, 0) / context.recentSimilarDecisions.length;

  if (avgPayAfter === 0) {
    return {
      checkType: CheckType.HISTORICAL_CONSISTENCY,
      status: 'PASS',
      severity,
      headline: 'Historical average is zero',
      detail: 'Cannot compute consistency when historical pay average is zero.',
    };
  }

  const deviationPct = Math.abs(((proposedPayAfterBase - avgPayAfter) / avgPayAfter) * 100);
  const deviationRounded = Math.round(deviationPct * 10) / 10;
  const direction = proposedPayAfterBase > avgPayAfter ? 'above' : 'below';

  let status: 'PASS' | 'WARNING' | 'BLOCK' = 'PASS';
  if (deviationPct >= warningDeviationPct) {
    status = severity === PolicySeverity.BLOCK ? 'BLOCK' : 'WARNING';
  }

  return {
    checkType: CheckType.HISTORICAL_CONSISTENCY,
    status,
    severity,
    headline: status === 'PASS'
      ? `Consistent with recent similar decisions (${deviationRounded}% deviation)`
      : `${deviationRounded}% ${direction} the average of recent similar decisions`,
    detail: `Average pay-after-base of ${context.recentSimilarDecisions.length} recent comparable decisions: ${avgPayAfter.toLocaleString()}. Proposed: ${proposedPayAfterBase.toLocaleString()} (${deviationRounded}% ${direction}).`,
    currentValue: Math.round(avgPayAfter),
    projectedValue: proposedPayAfterBase,
    threshold: warningDeviationPct,
  };
};

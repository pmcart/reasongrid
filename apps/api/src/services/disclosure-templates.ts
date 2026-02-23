/**
 * Disclosure template service — template-based salary disclosure text generation.
 * Uses simple {{variable}} interpolation, NOT AI-generated text.
 */

/**
 * Interpolate template variables in the form {{variableName}}.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = variables[key];
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Format a currency value for display.
 */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

/**
 * Default disclosure templates seeded into the database.
 */
export const DEFAULT_DISCLOSURE_TEMPLATES = [
  {
    templateType: 'JOB_AD_FULL' as const,
    name: 'Full Job Ad Disclosure (EU Standard)',
    country: null,
    content: `Salary Transparency Notice

Position: {{roleTitle}}
Level: {{level}}
Location: {{country}}

In accordance with EU Pay Transparency Directive requirements, the salary range for this position is:

Minimum: {{salaryMinFormatted}}
Midpoint: {{salaryMidFormatted}}
Maximum: {{salaryMaxFormatted}}

The actual salary offered will be determined based on objective, gender-neutral criteria including relevant experience, qualifications, and scope of responsibility. These criteria are applied consistently across all candidates.

Additional compensation elements (where applicable) will be discussed during the recruitment process.

This information is provided to support pay transparency and equal pay for equal work or work of equal value.`,
  },
  {
    templateType: 'JOB_AD_BRIEF' as const,
    name: 'Brief Job Ad Disclosure',
    country: null,
    content: `Salary Range: {{salaryMinFormatted}} – {{salaryMaxFormatted}} ({{currency}})
Position: {{roleTitle}} ({{level}})

Placement within the range is based on objective criteria including experience and qualifications.`,
  },
  {
    templateType: 'OFFER_LETTER' as const,
    name: 'Offer Letter Salary Context',
    country: null,
    content: `For transparency, the salary range for the {{roleTitle}} role at {{level}} level is {{salaryMinFormatted}} to {{salaryMaxFormatted}} ({{currency}}). Your offered salary of {{offeredSalary}} positions you at the {{positionDescription}} of this range.

This salary has been determined based on objective, gender-neutral criteria as outlined in our pay determination framework.`,
  },
];

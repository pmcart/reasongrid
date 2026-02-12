/**
 * NormalizationService — assists with CSV column mapping and value normalization.
 * For MVP, implements deterministic logic. Placeholder for LLM-based enhancement later.
 */

const COUNTRY_MAP: Record<string, string> = {
  france: 'FR', fr: 'FR',
  germany: 'DE', de: 'DE',
  ireland: 'IE', ie: 'IE',
  'united kingdom': 'GB', uk: 'GB', gb: 'GB',
  spain: 'ES', es: 'ES',
  italy: 'IT', it: 'IT',
  netherlands: 'NL', nl: 'NL',
  belgium: 'BE', be: 'BE',
  portugal: 'PT', pt: 'PT',
  austria: 'AT', at: 'AT',
  'united states': 'US', usa: 'US', us: 'US',
};

const STANDARD_FIELDS = [
  'employeeId', 'roleTitle', 'jobFamily', 'level',
  'country', 'location', 'currency', 'baseSalary', 'bonusTarget',
  'ltiTarget', 'hireDate', 'employmentType', 'gender', 'performanceRating',
];

const COLUMN_ALIASES: Record<string, string[]> = {
  employeeId: ['employee_id', 'emp_id', 'id', 'staff_id', 'employee id', 'employee number'],
  roleTitle: ['role_title', 'role', 'title', 'job_title', 'job title', 'position'],
  jobFamily: ['job_family', 'job family', 'function', 'department'],
  level: ['level', 'grade', 'band', 'job_level', 'job level'],
  country: ['country', 'country_code', 'country code', 'nation'],
  location: ['location', 'city', 'office', 'site'],
  currency: ['currency', 'currency_code', 'currency code', 'ccy'],
  baseSalary: ['base_salary', 'base salary', 'salary', 'annual_salary', 'annual salary', 'base_pay', 'base pay'],
  bonusTarget: ['bonus_target', 'bonus target', 'bonus', 'target_bonus', 'target bonus'],
  ltiTarget: ['lti_target', 'lti target', 'lti', 'long_term_incentive', 'equity'],
  hireDate: ['hire_date', 'hire date', 'start_date', 'start date', 'date_of_hire'],
  employmentType: ['employment_type', 'employment type', 'emp_type', 'contract_type'],
  gender: ['gender', 'sex'],
  performanceRating: ['performance_rating', 'performance rating', 'rating', 'perf_rating', 'performance'],
};

export function suggestMappings(csvColumns: string[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};

  for (const field of STANDARD_FIELDS) {
    const aliases = COLUMN_ALIASES[field] || [];
    const match = csvColumns.find((col) => {
      const normalized = col.toLowerCase().trim();
      return normalized === field.toLowerCase() || aliases.includes(normalized);
    });
    mapping[field] = match || null;
  }

  return mapping;
}

/**
 * Compute confidence scores for a mapping based on column name similarity.
 * Used instead of LLM-generated confidence which tends to be unreliable.
 */
export function computeMappingConfidence(
  mapping: Record<string, string | null>,
  csvColumns: string[],
): Record<string, number> {
  const confidence: Record<string, number> = {};

  for (const [field, csvCol] of Object.entries(mapping)) {
    if (!csvCol) {
      confidence[field] = 0;
      continue;
    }

    const aliases = COLUMN_ALIASES[field] || [];
    const normalizedCol = csvCol.toLowerCase().trim();
    const normalizedField = field.toLowerCase();

    if (normalizedCol === normalizedField) {
      // Exact match to field name (e.g. "gender" -> gender)
      confidence[field] = 0.98;
    } else if (aliases.includes(normalizedCol)) {
      // Exact match to a known alias
      confidence[field] = 0.95;
    } else if (normalizedCol.includes(normalizedField) || normalizedField.includes(normalizedCol)) {
      // Substring match (e.g. "employee_id_number" -> employeeId)
      confidence[field] = 0.85;
    } else if (aliases.some(a => normalizedCol.includes(a) || a.includes(normalizedCol))) {
      // Partial alias match
      confidence[field] = 0.75;
    } else {
      // AI mapped it but no obvious name similarity — lower confidence
      confidence[field] = 0.6;
    }
  }

  return confidence;
}

export function normalizeCountry(value: string): string {
  const normalized = value.toLowerCase().trim();
  return COUNTRY_MAP[normalized] || value.toUpperCase().slice(0, 2);
}

export function normalizeSalary(value: string): number | null {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function annualizeSalary(amount: number, period: string): number {
  switch (period.toLowerCase().trim()) {
    case 'monthly': return amount * 12;
    case 'weekly': return amount * 52;
    case 'biweekly': return amount * 26;
    default: return amount; // assume annual
  }
}

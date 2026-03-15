/**
 * HiBob API integration service.
 *
 * Uses the HiBob people search API to fetch employee data including
 * compensation fields, then maps to CDI standard employee fields.
 *
 * Auth: HTTP Basic — serviceUserId as username, token as password.
 * Base URL: https://api.hibob.com/v1
 *
 * The "subdomain" field in HrisConnection stores the Service User ID.
 * The "apiKey" field stores the Service User Token.
 *
 * Permission requirements on the HiBob service user:
 *   - Basic Info (name, email, employee ID)
 *   - Work Info (title, department, site, start date)
 *   - Personal Info (gender/legal gender)
 *   - Payroll (salary, employment type)
 *   - Address (site country)
 */

import { normalizeCountry } from './normalization.js';

const BASE_URL = 'https://api.hibob.com/v1';

// Fields to request from HiBob people search.
// We do NOT use humanReadable=REPLACE because it reformats currency fields to
// locale strings ("$37,000.00") and dates to DD/MM/YYYY, which breaks parsing.
// Without it: salary comes back as { value, currency } objects, dates as ISO.
// List fields (title, department) return display strings already in this env.
// orgLevel returns camelCase internal IDs — normalised in mapHiBobEmployee().
const REQUESTED_FIELDS = [
  'root.id',
  'root.firstName',
  'root.surname',
  'root.fullName',
  'root.displayName',
  'work.employeeIdInCompany',
  'work.title',
  'work.department',
  'work.site',
  'work.startDate',
  'employee.orgLevel',
  'home.legalGender',
  'address.siteCountry',
  'payroll.salary.payment',
  'payroll.salary.yearlyPayment',
  'payroll.salary.payPeriod',
  'payroll.variable.Bonus.amount',
  'payroll.variable.Bonus.percentageOfAnnualSalary',
  'payroll.employment.type',
];

export interface HiBobEmployee {
  employeeId: string;
  fullName: string;
  roleTitle: string;
  jobFamily: string | null;
  level: string;
  country: string;
  location: string | null;
  currency: string;
  baseSalary: number;
  bonusTarget: number | null;
  ltiTarget: null;
  hireDate: Date | null;
  employmentType: string | null;
  gender: string | null;
  performanceRating: null;
}

export interface HiBobTestResult {
  success: boolean;
  message: string;
  employeeCount?: number;
}

// Raw employee shape from HiBob people/search response
// (humanReadable=REPLACE; list fields return display strings, currency fields may be
//  plain numbers or {value, currency} objects depending on HiBob version)
interface HiBobRawEmployee {
  id?: string;
  firstName?: string;
  surname?: string;
  fullName?: string;
  displayName?: string;
  work?: {
    employeeIdInCompany?: number | string | null;
    title?: string | null;
    department?: string | null;
    site?: string | null;
    startDate?: string | null;
  };
  employee?: {
    orgLevel?: string | null;
  };
  home?: {
    legalGender?: string | null;
  };
  address?: {
    siteCountry?: string | null;
  };
  payroll?: {
    salary?: {
      // Without humanReadable, currency fields return { value, currency } objects
      payment?: { value?: number; currency?: string } | null;
      yearlyPayment?: { value?: number; currency?: string } | null;
      payPeriod?: string | null;
    } | null;
    variable?: {
      Bonus?: {
        amount?: { value?: number; currency?: string } | null;
        percentageOfAnnualSalary?: number | null;
      } | null;
    } | null;
    employment?: {
      type?: string | null;
    } | null;
  } | null;
  [key: string]: unknown;
}

interface HiBobSearchResponse {
  employees?: HiBobRawEmployee[];
  next?: string | null;
}

function buildAuthHeader(serviceUserId: string, token: string): string {
  return 'Basic ' + Buffer.from(`${serviceUserId}:${token}`).toString('base64');
}

/**
 * Test a HiBob connection by attempting a people search.
 * Returns success/failure and employee count.
 */
export async function testHiBobConnection(
  serviceUserId: string,
  token: string,
): Promise<HiBobTestResult> {
  const url = `${BASE_URL}/people/search`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(serviceUserId, token),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ showInactive: false, pagination: { limit: 200 } }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401) {
      return { success: false, message: 'Invalid credentials — authentication failed. Check your Service User ID and Token.' };
    }
    if (res.status === 403) {
      return { success: false, message: 'Service user does not have permission to access people data.' };
    }
    if (!res.ok) {
      return { success: false, message: `HiBob returned HTTP ${res.status}` };
    }

    const data = await res.json() as HiBobSearchResponse;
    const employeeCount = Array.isArray(data?.employees) ? data.employees.length : 0;

    if (employeeCount === 0) {
      return {
        success: true,
        message: 'Connected successfully, but no employee data was returned. Ensure the service user has People read permissions in HiBob (Settings → Integrations → Service Users).',
        employeeCount: 0,
      };
    }

    return {
      success: true,
      message: `Connected successfully. Found ${employeeCount}+ employee${employeeCount !== 1 ? 's' : ''}.`,
      employeeCount,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, message: 'Connection timed out. Check your network or try again.' };
    }
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Fetch all employees from HiBob via the people search API.
 * Paginates automatically using cursor-based pagination.
 *
 * fieldMapping allows overriding which HiBob field maps to CDI fields.
 * Default mapping:
 *   level → employee.orgLevel
 *   jobFamily → work.department
 *
 * fieldMapping example: { "level": "work.customColumn_xxx" }
 */
export async function fetchHiBobEmployees(
  serviceUserId: string,
  token: string,
  fieldMapping?: Record<string, string>,
): Promise<{ employees: HiBobEmployee[]; errors: Array<{ id: string; message: string }> }> {
  const allRaw: HiBobRawEmployee[] = [];

  let cursor: string | null | undefined = undefined;
  let page = 0;

  // Paginate through all employees (max 200 per page)
  do {
    const body: Record<string, unknown> = {
      showInactive: false,
      fields: REQUESTED_FIELDS,
      pagination: { limit: 200, ...(cursor ? { cursor } : {}) },
    };

    const res = await fetch(`${BASE_URL}/people/search`, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(serviceUserId, token),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`HiBob people search returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as HiBobSearchResponse;
    const batch = data.employees ?? [];
    allRaw.push(...batch);

    cursor = data.next ?? null;
    page++;

    // Safety: stop at 50 pages (10,000 employees) to avoid infinite loops
    if (page >= 50) break;
  } while (cursor);

  const employees: HiBobEmployee[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of allRaw) {
    const rawId = String(raw.id ?? raw.work?.employeeIdInCompany ?? '(unknown)');
    try {
      const mapped = mapHiBobEmployee(raw, fieldMapping);
      if (!mapped) {
        errors.push({ id: rawId, message: 'Skipped: missing required fields (employeeId, roleTitle, country, or baseSalary)' });
        continue;
      }
      employees.push(mapped);
    } catch (err) {
      errors.push({ id: rawId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { employees, errors };
}

function mapHiBobEmployee(
  raw: HiBobRawEmployee,
  fieldMapping?: Record<string, string>,
): HiBobEmployee | null {
  // Employee ID — prefer employeeIdInCompany (stable HR ID), fall back to HiBob internal id
  const empIdRaw = raw.work?.employeeIdInCompany;
  const employeeId = empIdRaw != null ? String(empIdRaw).trim() : (raw.id?.trim() ?? '');
  if (!employeeId) return null;

  // Full name
  const fullName =
    raw.fullName?.trim() ||
    raw.displayName?.trim() ||
    [raw.firstName, raw.surname].filter(Boolean).join(' ').trim() ||
    '';
  if (!fullName) return null;

  // Role title
  const roleTitle = raw.work?.title?.trim() ?? '';
  if (!roleTitle) return null;

  // Country — prefer site country (work location), fall back to home address country
  const rawCountry = raw.address?.siteCountry?.trim() ?? '';
  if (!rawCountry) return null;
  const country = normalizeCountry(rawCountry) ?? rawCountry;

  // Location (site name)
  const location = raw.work?.site?.trim() || null;

  // Job family (department by default; overridable)
  const jobFamilyPath = fieldMapping?.['jobFamily'] ?? null;
  const jobFamily = jobFamilyPath
    ? getNestedString(raw, jobFamilyPath)
    : (raw.work?.department?.trim() || null);

  // Level (orgLevel by default; overridable via custom field path)
  // Without humanReadable, orgLevel returns camelCase: "individualContributor" → normalised to display form
  const levelPath = fieldMapping?.['level'] ?? null;
  const rawOrgLevel = levelPath ? getNestedString(raw, levelPath) : (raw.employee?.orgLevel?.trim() ?? null);
  const level = rawOrgLevel ? normalizeOrgLevel(rawOrgLevel) : 'Unknown';

  // Compensation
  const salary = raw.payroll?.salary;

  // Currency — from the payment or yearlyPayment { value, currency } objects
  const currency =
    extractCurrencyFromField(salary?.payment) ||
    extractCurrencyFromField(salary?.yearlyPayment) ||
    'USD';

  // Base salary — prefer yearlyPayment (already annualised), else annualise from payment
  const yearlyVal = extractAmountFromField(salary?.yearlyPayment);
  const paymentVal = extractAmountFromField(salary?.payment);

  let baseSalary: number | null = null;
  if (yearlyVal != null && yearlyVal > 0) {
    baseSalary = yearlyVal;
  } else if (paymentVal != null && paymentVal > 0) {
    const payPeriod = salary?.payPeriod?.trim()?.toLowerCase() ?? 'annual';
    baseSalary = annualizeFromHiBob(paymentVal, payPeriod);
  }

  if (baseSalary === null || baseSalary === 0) return null;

  // Bonus target — prefer explicit amount, fall back to % of annual salary
  const bonusRaw = raw.payroll?.variable?.Bonus;
  let bonusTarget: number | null = null;
  if (bonusRaw) {
    const bonusAmt = extractAmountFromField(bonusRaw.amount);
    if (bonusAmt != null && bonusAmt > 0) {
      bonusTarget = bonusAmt;
    } else if ((bonusRaw.percentageOfAnnualSalary ?? 0) > 0) {
      bonusTarget = (baseSalary * bonusRaw.percentageOfAnnualSalary!) / 100;
    }
  }

  // Employment type
  const employmentType = normalizeEmploymentType(raw.payroll?.employment?.type?.trim() ?? '');

  // Gender — home.legalGender is a list field, returns display value with humanReadable
  const gender = normalizeGender(raw.home?.legalGender?.trim() ?? '');

  // Hire date
  const hireDate = raw.work?.startDate ? parseDate(raw.work.startDate) : null;

  return {
    employeeId,
    fullName,
    roleTitle,
    jobFamily,
    level,
    country,
    location,
    currency,
    baseSalary,
    bonusTarget,
    ltiTarget: null,
    hireDate,
    employmentType,
    gender,
    performanceRating: null, // No standard performance field in HiBob
  };
}

/**
 * Extract a numeric amount from a HiBob currency field { value, currency }.
 */
function extractAmountFromField(field: { value?: number; currency?: string } | null | undefined): number | null {
  if (field == null) return null;
  return field.value ?? null;
}

/**
 * Extract currency code from a HiBob currency field { value, currency }.
 */
function extractCurrencyFromField(field: { value?: number; currency?: string } | null | undefined): string | null {
  if (field == null) return null;
  return field.currency?.trim() || null;
}

/**
 * Read a value from a nested object using a dot-separated path.
 * e.g. getNestedString(raw, "work.customColumn_xxx")
 */
function getNestedString(obj: Record<string, unknown>, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current.trim() || null : null;
}

/**
 * Convert HiBob orgLevel camelCase internal IDs to display-friendly strings.
 * e.g. "individualContributor" → "Individual Contributor"
 */
function normalizeOrgLevel(raw: string): string {
  const map: Record<string, string> = {
    individualContributor: 'Individual Contributor',
    firstLevelManager: 'Manager',
    secondLevelManager: 'Senior Manager',
    thirdLevelManager: 'Director',
    fourthLevelManager: 'Senior Director',
    fifthLevelManager: 'VP',
    sixthLevelManager: 'SVP',
    executiveVicePresident: 'EVP',
    cSuite: 'C-Suite',
  };
  // Return mapped value, or convert unknown camelCase to Title Case
  return map[raw] ?? raw.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function annualizeFromHiBob(rate: number, payPeriod: string): number {
  // HiBob payPeriod values (humanReadable): 'Annual', 'Monthly', 'Weekly', 'Hourly', 'Daily', 'Bi-Weekly'
  const p = payPeriod.toLowerCase();
  if (p.includes('month')) return rate * 12;
  if (p.includes('semi-month') || p.includes('semi monthly')) return rate * 24;
  if (p.includes('bi-week') || p.includes('biweek')) return rate * 26;
  if (p.includes('week')) return rate * 52;
  if (p.includes('hour')) return rate * 2080; // 40h × 52w
  if (p.includes('day')) return rate * 260; // 5d × 52w
  return rate; // 'annual' / unknown → assume annual
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeEmploymentType(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes('full')) return 'FULL_TIME';
  if (lower.includes('part')) return 'PART_TIME';
  if (lower.includes('contract')) return 'CONTRACT';
  if (lower.includes('intern')) return 'INTERN';
  if (lower.includes('temp')) return 'TEMPORARY';
  return raw;
}

function normalizeGender(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'male' || lower === 'm') return 'MALE';
  if (lower === 'female' || lower === 'f') return 'FEMALE';
  if (lower.includes('non') || lower.includes('other') || lower.includes('prefer')) return 'NON_BINARY';
  return raw;
}

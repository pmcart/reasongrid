/**
 * Personio API integration service.
 *
 * Uses the Personio v1 REST API to fetch employee data including
 * compensation fields, then maps to CDI standard employee fields.
 *
 * Auth: OAuth 2.0 Client Credentials — POST /v1/auth with client_id + client_secret,
 * then use the returned token as a Bearer token on subsequent requests.
 *
 * The "subdomain" field in HrisConnection stores the Client ID.
 * The "apiKey" field stores the Client Secret.
 *
 * Permission requirements (configured in Personio → Settings → API credentials):
 *   - Employee data (read)
 *   - Salary data (read) — must be explicitly whitelisted
 *   - Personal data (read) — required for gender
 *
 * Note on "level": Personio has no standard Level field. It is typically a
 * custom attribute. Use fieldMapping.level to specify the attribute key
 * (e.g. "dynamic_12345") or label (e.g. "Level"). CDI will search by both.
 */

import { normalizeCountry } from './normalization.js';

const BASE_URL = 'https://api.personio.de/v1';

export interface PersonioEmployee {
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

export interface PersonioTestResult {
  success: boolean;
  message: string;
  employeeCount?: number;
  companyName?: string;
}

// Personio attribute value wrapper — most fields use { label, value }
interface PersonioAttr<T = unknown> {
  label?: string;
  value?: T;
  currency?: string;
  type?: string;
  universal_id?: string | null;
}

// Nested object type used by Department, Office, HolidayCalendar etc.
interface PersonioNestedObject {
  type?: string;
  attributes?: Record<string, unknown>;
}

// Raw employee shape from Personio /v1/company/employees
interface PersonioRawEmployee {
  type?: string;
  attributes?: Record<string, PersonioAttr>;
}

interface PersonioAuthResponse {
  success?: boolean;
  data?: { token?: string };
  error?: string;
  message?: string;
}

interface PersonioEmployeesResponse {
  success?: boolean;
  data?: PersonioRawEmployee[];
  metadata?: {
    total_elements?: number;
    current_page?: number;
    total_pages?: number;
  };
  offset?: number;
  limit?: number;
}

/**
 * Fetch a short-lived Bearer token from Personio.
 * Tokens are valid for 24 hours.
 */
async function getPersonioToken(clientId: string, clientSecret: string): Promise<string> {
  const url = `${BASE_URL}/auth`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json() as PersonioAuthResponse;

  if (!res.ok || !data.success) {
    const msg = data.error ?? data.message ?? `HTTP ${res.status}`;
    throw new Error(`Personio authentication failed: ${msg}`);
  }

  const token = data.data?.token;
  if (!token) {
    throw new Error('Personio authentication succeeded but no token was returned.');
  }

  return token;
}

/**
 * Test a Personio connection by authenticating and fetching a single employee page.
 */
export async function testPersonioConnection(
  clientId: string,
  clientSecret: string,
): Promise<PersonioTestResult> {
  try {
    const token = await getPersonioToken(clientId, clientSecret);

    // Fetch one page to verify data access and get employee count
    const res = await fetch(`${BASE_URL}/company/employees?limit=1&offset=0`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401) {
      return { success: false, message: 'Token rejected — check that your credentials are still valid.' };
    }
    if (res.status === 403) {
      return { success: false, message: 'API credentials do not have employee read access. Check attribute permissions in Personio → Settings → API credentials.' };
    }
    if (!res.ok) {
      return { success: false, message: `Personio returned HTTP ${res.status}` };
    }

    const data = await res.json() as PersonioEmployeesResponse;
    const total = data.metadata?.total_elements ?? (Array.isArray(data.data) ? data.data.length : 0);

    return {
      success: true,
      message: `Connected successfully. Found ${total} employee${total !== 1 ? 's' : ''}.`,
      employeeCount: total,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, message: 'Connection timed out. Check your network or try again.' };
    }
    return { success: false, message: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Fetch all active employees from Personio.
 *
 * fieldMapping allows overriding which Personio attribute maps to CDI fields.
 * Keys: "level", "jobFamily", "performanceRating"
 *
 * For "level": provide the attribute key (e.g. "dynamic_12345") or the attribute
 * label (e.g. "Level"). If not provided, CDI attempts auto-detection by scanning
 * attribute labels for common level/grade keywords.
 *
 * fieldMapping example: { "level": "dynamic_12345", "jobFamily": "dynamic_67890" }
 */
export async function fetchPersonioEmployees(
  clientId: string,
  clientSecret: string,
  fieldMapping?: Record<string, string>,
): Promise<{ employees: PersonioEmployee[]; errors: Array<{ id: string; message: string }> }> {
  const token = await getPersonioToken(clientId, clientSecret);

  const allRaw: PersonioRawEmployee[] = [];
  const pageSize = 100;
  let offset = 0;
  let totalPages: number | null = null;
  let page = 0;

  do {
    const res = await fetch(`${BASE_URL}/company/employees?limit=${pageSize}&offset=${offset}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Personio employees API returned HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json() as PersonioEmployeesResponse;
    const batch = data.data ?? [];
    allRaw.push(...batch);

    if (totalPages === null) {
      totalPages = data.metadata?.total_pages ?? 1;
    }

    offset += pageSize;
    page++;

    // Safety cap at 100 pages (10,000 employees)
    if (page >= 100) break;
  } while (page < (totalPages ?? 1));

  const employees: PersonioEmployee[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of allRaw) {
    const attrs = raw.attributes ?? {};
    const rawId = String(getAttrValue(attrs['id']) ?? '(unknown)');
    try {
      // Only process active employees
      const status = String(getAttrValue(attrs['status']) ?? '').toLowerCase();
      if (status && status !== 'active') continue;

      const mapped = mapPersonioEmployee(attrs, fieldMapping);
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

function mapPersonioEmployee(
  attrs: Record<string, PersonioAttr>,
  fieldMapping?: Record<string, string>,
): PersonioEmployee | null {
  // Employee ID — prefer the custom attribute with universal_id "company_employee_id"
  // (the HR-assigned employee number), fall back to Personio's internal numeric id.
  const hrIdAttr = Object.values(attrs).find((a) => a?.universal_id === 'company_employee_id');
  const hrId = hrIdAttr?.value != null ? String(hrIdAttr.value).trim() : '';
  const internalId = String(getAttrValue(attrs['id']) ?? '').trim();
  const employeeId = hrId || internalId;
  if (!employeeId) return null;

  // Full name
  const firstName = String(getAttrValue(attrs['first_name']) ?? '').trim();
  const lastName = String(getAttrValue(attrs['last_name']) ?? '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  if (!fullName) return null;

  // Role title
  const roleTitle = String(getAttrValue(attrs['position']) ?? '').trim();
  if (!roleTitle) return null;

  // Country — Personio's office object does NOT include a country field.
  // The most reliable source is holiday_calendar.attributes.country (ISO 2-letter code).
  const holidayCalRaw = getAttrValue(attrs['holiday_calendar']) as PersonioNestedObject | null;
  const rawCountry = holidayCalRaw?.attributes
    ? String(holidayCalRaw.attributes['country'] ?? '').trim()
    : '';
  if (!rawCountry) return null;
  const country = normalizeCountry(rawCountry) ?? rawCountry;

  // Location — office name (e.g. "London", "Remote")
  const officeRaw = getAttrValue(attrs['office']) as PersonioNestedObject | null;
  const location = officeRaw?.attributes
    ? (String(officeRaw.attributes['name'] ?? '').trim() || null)
    : null;

  // Job family — department name by default, or custom attribute via fieldMapping
  const jobFamilyKey = fieldMapping?.['jobFamily'];
  let jobFamily: string | null = null;
  if (jobFamilyKey) {
    jobFamily = resolveCustomAttr(attrs, jobFamilyKey);
  } else {
    const deptRaw = getAttrValue(attrs['department']) as PersonioNestedObject | null;
    jobFamily = deptRaw?.attributes ? (String(deptRaw.attributes['name'] ?? '').trim() || null) : null;
  }

  // Level — no standard field; look up via fieldMapping key/label, auto-detect by label,
  // then fall back to position (job title) which is the most meaningful proxy in Personio.
  const levelKey = fieldMapping?.['level'];
  let level: string;
  if (levelKey) {
    level = resolveCustomAttr(attrs, levelKey) ?? roleTitle;
  } else {
    level = autoDetectLevel(attrs) ?? roleTitle;
  }

  // Salary — fix_salary.value is the raw amount, fix_salary_interval tells us the pay period.
  // Personio commonly stores monthly salaries; we must annualise them.
  const fixSalaryAttr = attrs['fix_salary'];
  const salaryValue = fixSalaryAttr?.value;
  const salaryCurrency = fixSalaryAttr?.currency;

  const rawSalary = typeof salaryValue === 'number' && salaryValue > 0 ? salaryValue : null;
  if (rawSalary === null) return null;

  const salaryInterval = String(getAttrValue(attrs['fix_salary_interval']) ?? 'monthly').toLowerCase().trim();
  const baseSalary = annualizeSalary(rawSalary, salaryInterval);

  const currency = (typeof salaryCurrency === 'string' && salaryCurrency.trim())
    ? salaryCurrency.trim().toUpperCase()
    : 'EUR';

  // Hire date (ISO 8601 with timezone offset — Date constructor handles this fine)
  const hireDateRaw = String(getAttrValue(attrs['hire_date']) ?? '');
  const hireDate = hireDateRaw ? parseDate(hireDateRaw) : null;

  // Employment type — Personio values: 'internal' | 'external'
  const empTypeRaw = String(getAttrValue(attrs['employment_type']) ?? '').trim();
  const employmentType = normalizeEmploymentType(empTypeRaw);

  // Gender
  const genderRaw = String(getAttrValue(attrs['gender']) ?? '').trim();
  const gender = normalizeGender(genderRaw);

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
    bonusTarget: null,
    ltiTarget: null,
    hireDate,
    employmentType,
    gender,
    performanceRating: null,
  };
}

/**
 * Get the raw value from a Personio attribute wrapper { label, value, ... }.
 */
function getAttrValue(attr: PersonioAttr | undefined): unknown {
  if (attr == null) return null;
  return attr.value ?? null;
}

/**
 * Resolve a custom attribute by exact key name OR by matching attribute label (case-insensitive).
 * Returns string value or null.
 */
function resolveCustomAttr(
  attrs: Record<string, PersonioAttr>,
  keyOrLabel: string,
): string | null {
  // Try exact key first
  if (attrs[keyOrLabel] !== undefined) {
    const val = getAttrValue(attrs[keyOrLabel]);
    return val != null ? String(val).trim() || null : null;
  }

  // Fall back: search by label (case-insensitive)
  const lowerTarget = keyOrLabel.toLowerCase();
  for (const [, attr] of Object.entries(attrs)) {
    if (attr?.label?.toLowerCase() === lowerTarget) {
      const val = attr.value;
      return val != null ? String(val).trim() || null : null;
    }
  }

  return null;
}

/**
 * Auto-detect a "level" value by scanning attribute labels for common level keywords.
 * Returns the first matching attribute's value, or null.
 */
function autoDetectLevel(attrs: Record<string, PersonioAttr>): string | null {
  const levelKeywords = ['level', 'grade', 'band', 'career level', 'job level', 'seniority'];
  for (const [, attr] of Object.entries(attrs)) {
    const label = attr?.label?.toLowerCase() ?? '';
    if (levelKeywords.some((kw) => label === kw || label.startsWith(kw))) {
      const val = attr.value;
      if (val != null) return String(val).trim() || null;
    }
  }
  return null;
}

/**
 * Annualise a Personio salary based on the fix_salary_interval value.
 * Personio commonly stores monthly salaries.
 * Interval values: 'monthly', 'yearly', 'weekly', 'biweekly', 'hourly', 'daily'
 */
function annualizeSalary(amount: number, interval: string): number {
  if (interval.includes('month')) return amount * 12;
  if (interval.includes('semi-month') || interval.includes('semimonth')) return amount * 24;
  if (interval === 'biweekly' || interval.includes('bi-week') || interval.includes('biweek')) return amount * 26;
  if (interval.includes('week')) return amount * 52;
  if (interval.includes('hour')) return amount * 2080; // 40h × 52w
  if (interval.includes('day')) return amount * 260;   // 5d × 52w
  // 'yearly', 'annual', or unknown — treat as already annual
  return amount;
}

function parseDate(s: string): Date | null {
  if (!s || s === '0000-00-00' || s === 'null') return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function normalizeEmploymentType(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  // Personio standard values: 'internal', 'external'
  if (lower === 'internal') return 'FULL_TIME';
  if (lower === 'external') return 'CONTRACT';
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
  if (lower.includes('non') || lower.includes('other') || lower.includes('diverse') || lower.includes('prefer')) return 'NON_BINARY';
  return raw;
}

/**
 * Rippling API integration service.
 *
 * Uses the Rippling REST API v2 to fetch worker data including
 * compensation fields, then maps to CDI standard employee fields.
 *
 * Auth: Bearer token — generated at Tools → Developer → API Tokens.
 * Base URL: https://rest.ripplingapis.com
 * Endpoint: GET /workers?expand=compensation,employment_type,department,level
 *
 * IMPORTANT:
 * - API access requires the Rippling "API Key Package" add-on.
 * - The token owner must have a Super Admin (or company-wide) permission profile
 *   to retrieve all employees. Manager-scoped tokens only return direct reports.
 * - The expand parameter is required — without it, compensation/level/department
 *   objects are null even if the scope is granted.
 * - null values in the response mean "permission denied", not "no data".
 * - Scope errors surface as: "Insufficient oauth scopes to access ____"
 * - Required scopes: workers.read, compensation.read (exact name TBC — check token
 *   creation UI in Rippling), workers.custom-fields.read, workers.sensitive.personal.read
 *   (for gender). The compensation scope name may vary — if compensation is null,
 *   check the Rippling token UI for the exact scope label.
 *
 * The "subdomain" field in HrisConnection is repurposed as a human-readable
 * company identifier / display label — it is not used in API calls.
 *
 * Response shape: { results: RipplingWorker[], next_link: string | null }
 * Pagination: cursor-based via next_link (full URL).
 *
 * Key native fields confirmed from API schema:
 *   - level: native object { name, ... } — no custom field lookup needed
 *   - country: top-level ISO-2 code
 *   - compensation.annual_compensation: { value, currency_type }
 *   - compensation.target_annual_bonus: { value, currency_type }
 *   - gender: top-level enum (MALE, FEMALE, etc.)
 *   - status: top-level enum (ACTIVE, TERMINATED, INIT, etc.)
 */

import { normalizeCountry } from './normalization.js';

const BASE_URL = 'https://rest.ripplingapis.com';
const PAGE_SIZE = 100;

// expand params required to get nested objects — without these, compensation/level/department are null.
// custom_fields requires the workers.custom-fields.read scope.
const EXPAND_PARAMS = 'expand=compensation,employment_type,department,level,custom_fields';

export interface RipplingEmployee {
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

export interface RipplingTestResult {
  success: boolean;
  message: string;
  employeeCount?: number;
}

// Monetary value shape used throughout Rippling compensation object
interface RipplingMoneyField {
  currency_type?: string | null;
  value?: number | null;
}

// Raw worker shape from Rippling REST API v2 /workers
interface RipplingRawWorker {
  id?: string;
  number?: number | null;
  work_email?: string | null;
  title?: string | null;
  country?: string | null; // Top-level ISO-2 country code
  start_date?: string | null;
  status?: string | null; // ACTIVE, TERMINATED, INIT, etc.
  gender?: string | null; // MALE, FEMALE, NON_BINARY, etc. — already an enum
  user?: {
    id?: string;
    number?: string | null;
    name?: {
      formatted?: string | null;
      given_name?: string | null;
      middle_name?: string | null;
      family_name?: string | null;
      preferred_given_name?: string | null;
    } | null;
    display_name?: string | null;
    active?: boolean;
  } | null;
  department?: {
    id?: string;
    name?: string | null;
  } | null;
  level?: {
    id?: string;
    name?: string | null;
    global_level?: number | null;
    track?: {
      id?: string;
      name?: string | null;
    } | null;
  } | null;
  location?: {
    type?: string | null; // REMOTE, HYBRID, ON_SITE
    work_location_id?: string | null;
  } | null;
  employment_type?: {
    id?: string;
    name?: string | null;
    type?: string | null; // CONTRACTOR, FULL_TIME, PART_TIME, etc.
    compensation_time_period?: string | null; // HOURLY, SALARY, etc.
    amount_worked?: string | null; // FULL-TIME, PART-TIME
  } | null;
  compensation?: {
    id?: string;
    annual_compensation?: RipplingMoneyField | null;
    annual_salary_equivalent?: RipplingMoneyField | null;
    hourly_wage?: RipplingMoneyField | null;
    monthly_compensation?: RipplingMoneyField | null;
    weekly_compensation?: RipplingMoneyField | null;
    target_annual_bonus?: RipplingMoneyField | null;
    target_annual_bonus_percent?: number | null;
    on_target_commission?: RipplingMoneyField | null;
  } | null;
  custom_fields?: unknown[] | null;
  // __meta appears at the top-level response, not per-worker, but handle defensively
  __meta?: {
    redacted_fields?: Array<{ name?: string; reason?: string }>;
  };
}

// Top-level API response shape
interface RipplingWorkersResponse {
  results?: RipplingRawWorker[];
  next_link?: string | null;
  __meta?: {
    redacted_fields?: Array<{ name?: string; reason?: string }>;
  };
}

function buildAuthHeader(apiKey: string): string {
  return `Bearer ${apiKey}`;
}

/**
 * Translate a Rippling HTTP error status into a meaningful user-facing message.
 */
function interpretErrorStatus(status: number, body: string): string {
  const lower = body.toLowerCase();

  if (status === 401) {
    return (
      'Invalid or expired API token. ' +
      'Verify the token is still active in Rippling Admin → Settings → API Tokens. ' +
      'Tokens expire after 30 days of inactivity.'
    );
  }

  if (status === 402) {
    return (
      'Rippling API access requires the "API Key Package" add-on. ' +
      'Contact your Rippling account representative to enable it.'
    );
  }

  if (status === 403) {
    // Rippling's specific scope error message
    if (lower.includes('insufficient oauth scopes') || lower.includes('insufficient_scope')) {
      const field = body.match(/insufficient oauth scopes to access ([^\s"]+)/i)?.[1];
      return (
        `API token lacks required scope${field ? ` for "${field}"` : ''}. ` +
        'Go to Tools → Developer → API Tokens, edit the token, and add the missing scopes ' +
        '(at minimum: workers.read and compensation.read).'
      );
    }
    if (
      lower.includes('package') ||
      lower.includes('license') ||
      lower.includes('subscription') ||
      lower.includes('plan') ||
      lower.includes('entitlement')
    ) {
      return (
        'API access is not enabled on this account. ' +
        'Rippling requires the "API Key Package" add-on. ' +
        'Contact your Rippling account representative to enable it.'
      );
    }
    return (
      'Access denied. The API token may lack required permissions, ' +
      'or the "API Key Package" add-on may not be enabled on your account. ' +
      'Regenerate your token at Tools → Developer → API Tokens, ensuring all required scopes are selected.'
    );
  }

  if (status === 404) {
    return (
      'Rippling API endpoint not found (HTTP 404). ' +
      'This typically means the "API Key Package" is not enabled on your account, ' +
      'or the API URL has changed. Contact your Rippling account representative.'
    );
  }

  if (status === 429) {
    return 'Rate limit reached. Please wait a moment before trying again.';
  }

  if (status >= 500) {
    return `Rippling API is currently unavailable (HTTP ${status}). Please try again later.`;
  }

  return `Rippling returned HTTP ${status}. Check your credentials and that API access is enabled on your account.`;
}

/**
 * Check a Rippling API response for common failure modes before parsing JSON.
 * Returns an error message string if the response is problematic, null if OK.
 */
async function checkRipplingResponse(res: Response): Promise<string | null> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return interpretErrorStatus(res.status, body);
  }

  // Detect HTML response — Rippling may return a login redirect page instead of
  // JSON when API access is not licensed, rather than a proper HTTP error.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
    const body = await res.text().catch(() => '');
    if (body.trim().startsWith('<')) {
      return (
        'Rippling returned an HTML page instead of worker data. ' +
        'This usually means the "API Key Package" add-on is not enabled on your account. ' +
        'Contact your Rippling account representative to enable API access.'
      );
    }
    return (
      `Rippling returned an unexpected content type (${contentType || 'unknown'}). ` +
      'Please try again or contact your Rippling account representative.'
    );
  }

  return null;
}

/**
 * Check whether compensation fields appear in the redacted_fields list.
 */
function checkCompensationRedacted(
  meta: RipplingWorkersResponse['__meta'],
): string | null {
  const redacted = meta?.redacted_fields ?? [];
  const compensationRedacted = redacted.some(
    (f) =>
      f.name?.toLowerCase().includes('compensation') ||
      f.name?.toLowerCase().includes('salary') ||
      f.name?.toLowerCase().includes('wage') ||
      f.name === 'annual_compensation' ||
      f.name === 'hourly_wage',
  );

  if (compensationRedacted) {
    const reasons = redacted
      .filter((f) => f.name?.toLowerCase().includes('compensation') || f.name?.toLowerCase().includes('salary'))
      .map((f) => `"${f.name}" (${f.reason ?? 'Insufficient entitlements'})`)
      .join(', ');
    return (
      `Connected to Rippling, but compensation data is not accessible: ${reasons}. ` +
      'Regenerate your API token and ensure the compensation scope is included, ' +
      'or contact your Rippling account representative.'
    );
  }

  return null;
}

/**
 * Test a Rippling connection by fetching the first page of workers.
 * Reports worker count and checks for redacted compensation fields.
 */
export async function testRipplingConnection(apiKey: string): Promise<RipplingTestResult> {
  const url = `${BASE_URL}/workers?limit=${PAGE_SIZE}&${EXPAND_PARAMS}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: buildAuthHeader(apiKey),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    const errMsg = await checkRipplingResponse(res);
    if (errMsg) {
      return { success: false, message: errMsg };
    }

    let data: RipplingWorkersResponse;
    try {
      data = await res.json() as RipplingWorkersResponse;
    } catch {
      return { success: false, message: 'Rippling returned a malformed JSON response. Please try again.' };
    }

    // Check for redacted compensation at response level
    const compensationErr = checkCompensationRedacted(data.__meta);
    if (compensationErr) {
      return { success: false, message: compensationErr };
    }

    const workers = data.results ?? [];
    const workerCount = workers.length;

    if (workerCount === 0) {
      return {
        success: true,
        message:
          'Connected successfully, but no worker records were returned. ' +
          'Confirm the API token belongs to an admin with access to worker data.',
        employeeCount: 0,
      };
    }

    // Check if compensation is null on all workers — null means permission denied, not absent.
    // This happens when the token is missing compensation scope or the expand param is ignored.
    const allNullCompensation = workers.every((w) => w.compensation == null);
    if (allNullCompensation) {
      return {
        success: false,
        message:
          `Connected to Rippling (${workerCount} worker${workerCount !== 1 ? 's' : ''} found), ` +
          'but compensation data is null for all records — the token lacks "compensation" scope. ' +
          'Go to Tools → Developer → API Tokens, edit the token, and add the compensation.read scope.',
        employeeCount: workerCount,
      };
    }

    // Warn if compensation values are zero/missing even though the object is present
    const allZeroCompensation = workers.every(
      (w) =>
        w.compensation != null &&
        (w.compensation.annual_compensation?.value == null || w.compensation.annual_compensation.value === 0) &&
        (w.compensation.annual_salary_equivalent?.value == null || w.compensation.annual_salary_equivalent.value === 0),
    );
    if (allZeroCompensation) {
      return {
        success: false,
        message:
          `Connected to Rippling (${workerCount} worker${workerCount !== 1 ? 's' : ''} found), ` +
          'but annual compensation values are zero or missing for all records. ' +
          'Verify the token owner has a Super Admin (company-wide) permission profile in Rippling.',
        employeeCount: workerCount,
      };
    }

    const suffix = workerCount === PAGE_SIZE ? '+' : '';
    return {
      success: true,
      message: `Connected successfully. Found ${workerCount}${suffix} worker${workerCount !== 1 ? 's' : ''}.`,
      employeeCount: workerCount,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return { success: false, message: 'Connection timed out. Check your network or try again.' };
    }
    return {
      success: false,
      message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Fetch all active workers from Rippling using cursor-based pagination.
 *
 * fieldMapping allows overriding CDI field resolution.
 * For Rippling, level is a native field so fieldMapping is mainly useful for
 * overriding jobFamily (e.g. to use a team name instead of department).
 *
 * fieldMapping example: { "jobFamily": "teams" }
 */
export async function fetchRipplingEmployees(
  apiKey: string,
  fieldMapping?: Record<string, string>,
): Promise<{ employees: RipplingEmployee[]; errors: Array<{ id: string; message: string }> }> {
  const allRaw: RipplingRawWorker[] = [];

  let nextLink: string | null = `${BASE_URL}/workers?limit=${PAGE_SIZE}&${EXPAND_PARAMS}`;
  let page = 0;

  // Paginate through all workers using cursor links
  while (nextLink) {
    const res = await fetch(nextLink, {
      headers: {
        Authorization: buildAuthHeader(apiKey),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(60000),
    });

    const errMsg = await checkRipplingResponse(res);
    if (errMsg) {
      throw new Error(errMsg);
    }

    const data = await res.json() as RipplingWorkersResponse;
    const batch = data.results ?? [];
    allRaw.push(...batch);

    nextLink = data.next_link ?? null;
    page++;

    // Safety: stop at 200 pages (20,000 workers)
    if (page >= 200) break;
  }

  // Filter to active workers only
  const activeRaw = allRaw.filter((w) => {
    const s = w.status?.toUpperCase();
    // Include workers without a status field and those explicitly ACTIVE
    // Exclude TERMINATED, INIT (pre-hire), and other non-active statuses
    if (!s) return true;
    return s === 'ACTIVE';
  });

  const employees: RipplingEmployee[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of activeRaw) {
    const rawId = String(raw.id ?? raw.number ?? raw.work_email ?? '(unknown)');
    try {
      const mapped = mapRipplingWorker(raw, fieldMapping);
      if (!mapped) {
        errors.push({
          id: rawId,
          message: 'Skipped: missing required fields (employeeId, roleTitle, country, or baseSalary)',
        });
        continue;
      }
      employees.push(mapped);
    } catch (err) {
      errors.push({ id: rawId, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { employees, errors };
}

function mapRipplingWorker(
  raw: RipplingRawWorker,
  fieldMapping?: Record<string, string>,
): RipplingEmployee | null {
  // Employee ID — prefer worker number (stable HR ID), fall back to internal id
  const employeeId =
    (raw.number != null ? String(raw.number) : null) ??
    raw.id?.trim() ??
    '';
  if (!employeeId) return null;

  // Full name — from user.name.formatted, or build from parts
  const nameObj = raw.user?.name;
  const fullName =
    nameObj?.formatted?.trim() ||
    [nameObj?.preferred_given_name ?? nameObj?.given_name, nameObj?.family_name]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    raw.user?.display_name?.trim() ||
    '';
  if (!fullName) return null;

  // Role title
  const roleTitle = raw.title?.trim() ?? '';
  if (!roleTitle) return null;

  // Country — top-level ISO-2 code
  const rawCountry = raw.country?.trim() ?? '';
  if (!rawCountry) return null;
  const country = normalizeCountry(rawCountry) ?? rawCountry;

  // Location — Rippling v2 location only has type (REMOTE/HYBRID/ON_SITE) + work_location_id
  // There is no human-readable location name at this level without an extra API call
  const location = raw.location?.type ?? null;

  // Job family — department.name by default
  // fieldMapping can override with a different source if needed
  const jobFamilyOverride = fieldMapping?.['jobFamily'];
  let jobFamily: string | null = null;
  if (jobFamilyOverride === 'teams' && Array.isArray((raw as Record<string, unknown>)['teams'])) {
    const teams = (raw as Record<string, unknown>)['teams'] as Array<{ name?: string }>;
    jobFamily = teams[0]?.name?.trim() || null;
  } else {
    jobFamily = raw.department?.name?.trim() || null;
  }

  // Level — native field in Rippling v2
  const level = raw.level?.name?.trim() || 'Unknown';

  // Compensation — null means the token lacks compensation scope (permission denied),
  // not that the employee has no salary. Rippling returns null for inaccessible fields.
  if (raw.compensation == null) {
    throw new Error(
      'Compensation data is null — the API token lacks the "compensation" scope. ' +
      'Go to Tools → Developer → API Tokens, edit the token, and add compensation.read scope.',
    );
  }

  // Prefer annual_compensation; fall back to annual_salary_equivalent
  const annualComp = raw.compensation.annual_compensation;
  const annualEquiv = raw.compensation.annual_salary_equivalent;

  const baseSalaryValue =
    (annualComp?.value != null && annualComp.value > 0 ? annualComp.value : null) ??
    (annualEquiv?.value != null && annualEquiv.value > 0 ? annualEquiv.value : null) ??
    null;

  if (baseSalaryValue == null || baseSalaryValue <= 0) {
    throw new Error(
      'Annual salary is missing or zero. The token may lack compensation scope, ' +
      'or this worker has no salary record in Rippling.',
    );
  }

  // Currency — from annual_compensation field, fall back to annual_salary_equivalent
  const currency =
    annualComp?.currency_type?.trim().toUpperCase() ||
    annualEquiv?.currency_type?.trim().toUpperCase() ||
    'USD';

  // Bonus target — target_annual_bonus value; fall back to percent of base salary
  let bonusTarget: number | null = null;
  const bonusAmt = raw.compensation.target_annual_bonus?.value;
  if (bonusAmt != null && bonusAmt > 0) {
    bonusTarget = bonusAmt;
  } else if ((raw.compensation.target_annual_bonus_percent ?? 0) > 0) {
    bonusTarget = (baseSalaryValue * raw.compensation.target_annual_bonus_percent!) / 100;
  }

  // Optional fields
  const hireDate = raw.start_date ? parseDate(raw.start_date) : null;
  const employmentType = normalizeEmploymentType(raw.employment_type);

  // Gender — Rippling v2 returns an enum value (MALE, FEMALE, NON_BINARY, etc.)
  const gender = normalizeGender(raw.gender?.trim() ?? '');

  return {
    employeeId,
    fullName,
    roleTitle,
    jobFamily,
    level,
    country,
    location,
    currency,
    baseSalary: baseSalaryValue,
    bonusTarget,
    ltiTarget: null,
    hireDate,
    employmentType,
    gender,
    performanceRating: null,
  };
}

function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Normalize Rippling employment type to CDI standard.
 * Rippling v2 employment_type object has both a `type` enum and a `name` string.
 * type values: CONTRACTOR, FULL_TIME, PART_TIME, etc.
 * amount_worked: FULL-TIME, PART-TIME
 */
function normalizeEmploymentType(
  et: RipplingRawWorker['employment_type'],
): string | null {
  if (!et) return null;

  // Use the structured type enum first
  const type = et.type?.toUpperCase() ?? '';
  if (type === 'CONTRACTOR') return 'CONTRACT';
  if (type === 'FULL_TIME' || type === 'FULLTIME') return 'FULL_TIME';
  if (type === 'PART_TIME' || type === 'PARTTIME') return 'PART_TIME';
  if (type === 'INTERN') return 'INTERN';
  if (type === 'TEMPORARY' || type === 'TEMP') return 'TEMPORARY';

  // Fall back to amount_worked (FULL-TIME / PART-TIME)
  const amount = et.amount_worked?.toUpperCase() ?? '';
  if (amount.includes('FULL')) return 'FULL_TIME';
  if (amount.includes('PART')) return 'PART_TIME';

  // Fall back to name string
  if (et.name) {
    const lower = et.name.toLowerCase();
    if (lower.includes('contract')) return 'CONTRACT';
    if (lower.includes('full')) return 'FULL_TIME';
    if (lower.includes('part')) return 'PART_TIME';
    if (lower.includes('intern')) return 'INTERN';
    if (lower.includes('temp')) return 'TEMPORARY';
    return et.name;
  }

  return null;
}

/**
 * Normalize Rippling gender enum to CDI standard.
 * Rippling v2 already returns an enum: MALE, FEMALE, NON_BINARY, etc.
 */
function normalizeGender(raw: string): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (upper === 'MALE' || upper === 'M') return 'MALE';
  if (upper === 'FEMALE' || upper === 'F') return 'FEMALE';
  if (upper.includes('NON') || upper.includes('OTHER') || upper.includes('PREFER')) return 'NON_BINARY';
  return raw;
}

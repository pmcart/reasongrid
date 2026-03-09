/**
 * BambooHR API integration service.
 *
 * Uses the BambooHR custom report API to fetch employee data including
 * compensation fields, then maps to CDI standard employee fields.
 *
 * Auth: HTTP Basic — API key as username, literal "x" as password.
 * Base URL: https://api.bamboohr.com/api/gateway.php/{subdomain}/v1
 */

import { normalizeCountry, normalizeSalary } from './normalization.js';

export interface BambooHrEmployee {
  employeeId: string;
  roleTitle: string;
  jobFamily: string | null;
  level: string;
  country: string;
  location: string | null;
  currency: string;
  baseSalary: number;
  bonusTarget: number | null;
  ltiTarget: number | null;
  hireDate: Date | null;
  employmentType: string | null;
  gender: string | null;
  performanceRating: string | null;
}

export interface BambooHrTestResult {
  success: boolean;
  message: string;
  employeeCount?: number;
  companyName?: string;
}

// BambooHR raw response row
interface BambooRawEmployee {
  id?: string;
  employeeNumber?: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  country?: string;
  hireDate?: string;
  gender?: string;
  employmentHistoryStatus?: string;
  payRate?: string;
  payType?: string;
  currency?: string;
  payPeriod?: string;
  performanceRating?: string;
  // Allow any custom field overrides
  [key: string]: string | undefined;
}

interface BambooReportResponse {
  title: string;
  fields: Array<{ id: string; name: string }>;
  employees: BambooRawEmployee[];
}

function buildAuthHeader(apiKey: string): string {
  return 'Basic ' + Buffer.from(`${apiKey}:x`).toString('base64');
}

/**
 * Test a BambooHR connection by fetching the directory.
 * Returns success/failure and employee count.
 */
export async function testBambooHrConnection(
  subdomain: string,
  apiKey: string,
): Promise<BambooHrTestResult> {
  const url = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/employees/directory`;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: buildAuthHeader(apiKey),
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401) {
      return { success: false, message: 'Invalid API key — authentication failed.' };
    }
    if (res.status === 403) {
      return { success: false, message: 'API key does not have permission to access employee data.' };
    }
    if (res.status === 404) {
      return { success: false, message: `Company subdomain "${subdomain}" not found. Check your BambooHR subdomain.` };
    }
    if (!res.ok) {
      return { success: false, message: `BambooHR returned HTTP ${res.status}` };
    }

    const data = await res.json() as { employees?: unknown[] };
    const employeeCount = Array.isArray(data?.employees) ? data.employees.length : 0;

    return {
      success: true,
      message: `Connected successfully. Found ${employeeCount} employee${employeeCount !== 1 ? 's' : ''} in directory.`,
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
 * Fetch all employees from BambooHR via the custom report API.
 *
 * fieldMapping allows overriding which BambooHR field maps to CDI fields.
 * Default mapping:
 *   level → tries 'customLevel', then falls back to 'department'
 *
 * fieldMapping example: { "level": "customLevel4", "jobFamily": "department" }
 */
export async function fetchBambooHrEmployees(
  subdomain: string,
  apiKey: string,
  fieldMapping?: Record<string, string>,
): Promise<{ employees: BambooHrEmployee[]; errors: Array<{ id: string; message: string }> }> {
  const levelField = fieldMapping?.['level'] ?? 'customLevel';
  const jobFamilyField = fieldMapping?.['jobFamily'] ?? 'department';
  const performanceField = fieldMapping?.['performanceRating'] ?? 'performanceRating';

  // Request standard fields + configured custom fields
  const requestedFields = [
    'id',
    'employeeNumber',
    'jobTitle',
    jobFamilyField,
    levelField,
    'location',
    'country',
    'hireDate',
    'gender',
    'employmentHistoryStatus',
    'payRate',
    'payType',
    'currency',
    'payPeriod',
    performanceField,
  ];

  // Deduplicate
  const uniqueFields = [...new Set(requestedFields)];

  const url = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/reports/custom?format=JSON&onlyCurrent=true`;

  let reportData: BambooReportResponse;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(apiKey),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'CDI Employee Export',
        fields: uniqueFields,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`BambooHR report API returned HTTP ${res.status}: ${await res.text()}`);
    }

    reportData = await res.json() as BambooReportResponse;
  } catch (err) {
    throw new Error(`Failed to fetch from BambooHR: ${err instanceof Error ? err.message : String(err)}`);
  }

  const employees: BambooHrEmployee[] = [];
  const errors: Array<{ id: string; message: string }> = [];

  for (const raw of reportData.employees ?? []) {
    const rawId = raw.id ?? raw.employeeNumber ?? '(unknown)';
    try {
      const mapped = mapBambooEmployee(raw, levelField, jobFamilyField, performanceField);
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

function mapBambooEmployee(
  raw: BambooRawEmployee,
  levelField: string,
  jobFamilyField: string,
  performanceField: string,
): BambooHrEmployee | null {
  // Employee ID — prefer employeeNumber (stable HR ID), fall back to BambooHR internal id
  const employeeId = raw.employeeNumber?.trim() || raw.id?.trim() || '';
  if (!employeeId) return null;

  // Full name
  // Role
  const roleTitle = raw.jobTitle?.trim() || '';
  if (!roleTitle) return null;

  // Location
  const rawCountry = raw.country?.trim() ?? '';
  if (!rawCountry) return null;
  const country = normalizeCountry(rawCountry) ?? rawCountry;

  const location = raw.location?.trim() || null;

  // Job family + level (use configured field names)
  const jobFamily = raw[jobFamilyField]?.trim() || null;
  const level = raw[levelField]?.trim() || raw.department?.trim() || 'Unknown';

  // Compensation
  const currency = raw.currency?.trim() || 'USD';
  const rawPayRate = raw.payRate?.trim() ?? '';
  if (!rawPayRate) return null;

  const payRateNum = normalizeSalary(rawPayRate);
  if (payRateNum === null) return null;

  // Annualize based on payPeriod
  const payPeriod = raw.payPeriod?.trim()?.toLowerCase() ?? 'year';
  const baseSalary = annualizeFromBamboo(payRateNum, payPeriod);

  // Optional fields
  const hireDate = raw.hireDate ? parseDate(raw.hireDate) : null;
  const employmentType = normalizeEmploymentType(raw.employmentHistoryStatus?.trim() ?? '');
  const gender = normalizeGender(raw.gender?.trim() ?? '');
  const performanceRating = raw[performanceField]?.trim() || null;

  return {
    employeeId,
    roleTitle,
    jobFamily,
    level,
    country,
    location,
    currency,
    baseSalary,
    bonusTarget: null, // BambooHR standard fields don't include bonus; can be added via custom fields
    ltiTarget: null,
    hireDate,
    employmentType,
    gender,
    performanceRating,
  };
}

function annualizeFromBamboo(rate: number, payPeriod: string): number {
  // BambooHR payPeriod values: 'Year', 'Month', 'Week', 'Hour', 'Day', 'Bi-Weekly', 'Semi-Monthly'
  const period = payPeriod.toLowerCase();
  if (period.includes('month') && !period.includes('semi')) return rate * 12;
  if (period.includes('semi-month') || period.includes('semi monthly')) return rate * 24;
  if (period.includes('week') && !period.includes('bi')) return rate * 52;
  if (period.includes('bi-week') || period.includes('biweek')) return rate * 26;
  if (period.includes('hour')) return rate * 2080; // 40h × 52w
  if (period.includes('day')) return rate * 260; // 5d × 52w
  return rate; // 'year' or unknown → assume annual
}

function parseDate(s: string): Date | null {
  if (!s || s === '0000-00-00') return null;
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
  if (lower.includes('non') || lower.includes('other')) return 'NON_BINARY';
  return raw;
}

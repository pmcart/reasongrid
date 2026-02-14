/**
 * CSV processor service — handles parsing CSV files, previewing data
 * with mapping applied, and processing imports into employee records.
 */

import fs from 'fs';
import { parse } from 'csv-parse';
import { prisma } from '../lib/prisma.js';
import { normalizeCountry, normalizeSalary, annualizeSalary } from './normalization.js';
import { logAudit } from './audit.js';
import { runRiskComputation } from './risk-computation.js';

interface ImportError {
  row: number;
  field?: string;
  message: string;
}

interface PreviewRow {
  rowNumber: number;
  data: Record<string, string | null>;
  warnings: string[];
}

/**
 * Parse CSV headers (first row) from a file.
 */
export async function parseHeaders(filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const rows: string[][] = [];
    fs.createReadStream(filePath)
      .pipe(parse({ to_line: 1 }))
      .on('data', (row: string[]) => rows.push(row))
      .on('end', () => {
        if (rows.length === 0) reject(new Error('CSV file is empty'));
        else resolve(rows[0].map((h) => h.trim()));
      })
      .on('error', reject);
  });
}

/**
 * Parse first N data rows from CSV (after header) as objects keyed by header name.
 */
export async function parseSampleRows(
  filePath: string,
  count: number = 5,
): Promise<{ rows: Record<string, string>[]; totalRows: number }> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    let totalRows = 0;
    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true }))
      .on('data', (row: Record<string, string>) => {
        totalRows++;
        if (rows.length < count) {
          rows.push(row);
        }
      })
      .on('end', () => resolve({ rows, totalRows }))
      .on('error', reject);
  });
}

const REQUIRED_FIELDS = ['employeeId', 'roleTitle', 'level', 'country', 'currency', 'baseSalary'];

/**
 * Generate a preview of how data will look after applying the mapping + normalization.
 */
export async function generatePreview(
  filePath: string,
  mapping: Record<string, string>,
  previewCount: number = 5,
): Promise<{ rows: PreviewRow[]; totalRows: number; validRows: number; warningRows: number }> {
  const { rows: sampleRows, totalRows } = await parseSampleRows(filePath, previewCount);
  const previewRows: PreviewRow[] = [];
  let warningRows = 0;

  for (let i = 0; i < sampleRows.length; i++) {
    const csvRow = sampleRows[i];
    const warnings: string[] = [];
    const data: Record<string, string | null> = {};

    for (const [standardField, csvColumn] of Object.entries(mapping)) {
      const rawValue = csvRow[csvColumn] ?? null;

      if (!rawValue && REQUIRED_FIELDS.includes(standardField)) {
        warnings.push(`Missing required field: ${standardField}`);
        data[standardField] = null;
        continue;
      }

      if (!rawValue) {
        data[standardField] = null;
        continue;
      }

      // Apply normalization for preview
      switch (standardField) {
        case 'country':
          data[standardField] = normalizeCountry(rawValue);
          break;
        case 'baseSalary':
        case 'bonusTarget':
        case 'ltiTarget': {
          const parsed = normalizeSalary(rawValue);
          if (parsed === null) {
            warnings.push(`Could not parse ${standardField}: "${rawValue}"`);
            data[standardField] = rawValue;
          } else {
            // Check for salary period column
            const periodCol = mapping['salaryPeriod'];
            if (periodCol && csvRow[periodCol] && standardField === 'baseSalary') {
              data[standardField] = String(annualizeSalary(parsed, csvRow[periodCol]));
            } else {
              data[standardField] = String(parsed);
            }
          }
          break;
        }
        default:
          data[standardField] = rawValue;
      }
    }

    if (warnings.length > 0) warningRows++;

    previewRows.push({
      rowNumber: i + 2, // +2 for 1-indexed + header row
      data,
      warnings,
    });
  }

  return {
    rows: previewRows,
    totalRows,
    validRows: totalRows - warningRows,
    warningRows,
  };
}

/**
 * Process full CSV import — apply mapping, normalize, and upsert employees.
 * Runs async and updates ImportJob status when complete.
 */
export async function processImport(
  importId: string,
  mapping: Record<string, string>,
  organizationId: string,
): Promise<void> {
  const importJob = await prisma.importJob.findUnique({ where: { id: importId } });
  if (!importJob || !importJob.filePath) {
    await prisma.importJob.update({
      where: { id: importId },
      data: { status: 'FAILED', errorCount: 0 },
    });
    return;
  }

  let createdCount = 0;
  let updatedCount = 0;
  const errors: ImportError[] = [];
  let rowNumber = 1; // data row number (after header)

  try {
    const rows = await new Promise<Record<string, string>[]>((resolve, reject) => {
      const result: Record<string, string>[] = [];
      fs.createReadStream(importJob.filePath!)
        .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
        .on('data', (row: Record<string, string>) => result.push(row))
        .on('end', () => resolve(result))
        .on('error', reject);
    });

    for (const csvRow of rows) {
      rowNumber++;
      try {
        const employeeData = mapAndNormalizeRow(csvRow, mapping, rowNumber, errors);
        if (!employeeData) continue; // row had critical errors

        // Upsert by (organizationId, employeeId)
        const existing = await prisma.employee.findUnique({
          where: {
            organizationId_employeeId: {
              organizationId,
              employeeId: employeeData.employeeId,
            },
          },
        });

        let employee;
        if (existing) {
          employee = await prisma.employee.update({
            where: { id: existing.id },
            data: { ...employeeData, organizationId },
          });
          updatedCount++;
        } else {
          employee = await prisma.employee.create({
            data: { ...employeeData, organizationId },
          });
          createdCount++;
        }

        // Create immutable snapshot of employee data at import time
        await prisma.employeeSnapshot.create({
          data: {
            employeeId: employee.id,
            importJobId: importId,
            organizationId,
            employeeExternalId: employeeData.employeeId,
            roleTitle: employeeData.roleTitle,
            jobFamily: employeeData.jobFamily,
            level: employeeData.level,
            country: employeeData.country,
            location: employeeData.location,
            currency: employeeData.currency,
            baseSalary: employeeData.baseSalary,
            bonusTarget: employeeData.bonusTarget,
            ltiTarget: employeeData.ltiTarget,
            hireDate: employeeData.hireDate,
            employmentType: employeeData.employmentType,
            gender: employeeData.gender,
            performanceRating: employeeData.performanceRating,
          },
        });
      } catch (err) {
        errors.push({
          row: rowNumber,
          message: `Unexpected error: ${(err as Error).message}`,
        });
      }
    }

    await prisma.importJob.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        createdCount,
        updatedCount,
        errorCount: errors.length,
        mappingJson: mapping,
      },
    });

    logAudit({
      organizationId,
      action: 'IMPORT_COMPLETED',
      entityType: 'ImportJob',
      entityId: importId,
      metadata: { createdCount, updatedCount, errorCount: errors.length },
    });

    // Trigger risk computation after successful import (fire-and-forget)
    runRiskComputation(organizationId, 'SYSTEM', importId).catch((err) =>
      console.error('Risk computation after import failed:', err),
    );
  } catch (err) {
    await prisma.importJob.update({
      where: { id: importId },
      data: {
        status: 'FAILED',
        createdCount,
        updatedCount,
        errorCount: errors.length + 1,
      },
    });

    logAudit({
      organizationId,
      action: 'IMPORT_FAILED',
      entityType: 'ImportJob',
      entityId: importId,
      metadata: { error: (err as Error).message },
    });

    console.error('Import processing failed:', err);
  }
}

interface EmployeeCreateData {
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

function mapAndNormalizeRow(
  csvRow: Record<string, string>,
  mapping: Record<string, string>,
  rowNumber: number,
  errors: ImportError[],
): EmployeeCreateData | null {
  function getVal(field: string): string | null {
    const col = mapping[field];
    if (!col) return null;
    const val = csvRow[col];
    return val && val.trim() !== '' ? val.trim() : null;
  }

  // Check required fields
  const employeeId = getVal('employeeId');
  const roleTitle = getVal('roleTitle');
  const level = getVal('level');
  const countryRaw = getVal('country');
  const currency = getVal('currency');
  const salaryRaw = getVal('baseSalary');

  if (!employeeId) {
    errors.push({ row: rowNumber, field: 'employeeId', message: 'Missing employee ID' });
    return null;
  }
  if (!roleTitle) {
    errors.push({ row: rowNumber, field: 'roleTitle', message: 'Missing role title' });
    return null;
  }
  if (!level) {
    errors.push({ row: rowNumber, field: 'level', message: 'Missing level' });
    return null;
  }
  if (!countryRaw) {
    errors.push({ row: rowNumber, field: 'country', message: 'Missing country' });
    return null;
  }
  if (!currency) {
    errors.push({ row: rowNumber, field: 'currency', message: 'Missing currency' });
    return null;
  }
  if (!salaryRaw) {
    errors.push({ row: rowNumber, field: 'baseSalary', message: 'Missing base salary' });
    return null;
  }

  const baseSalary = normalizeSalary(salaryRaw);
  if (baseSalary === null) {
    errors.push({ row: rowNumber, field: 'baseSalary', message: `Invalid salary value: "${salaryRaw}"` });
    return null;
  }

  // Annualize if salaryPeriod is mapped
  let annualizedSalary = baseSalary;
  const periodCol = mapping['salaryPeriod'];
  if (periodCol && csvRow[periodCol]) {
    annualizedSalary = annualizeSalary(baseSalary, csvRow[periodCol]);
  }

  // Normalize optional numeric fields
  const bonusRaw = getVal('bonusTarget');
  const ltiRaw = getVal('ltiTarget');
  const bonusTarget = bonusRaw ? normalizeSalary(bonusRaw) : null;
  const ltiTarget = ltiRaw ? normalizeSalary(ltiRaw) : null;

  // Parse hire date
  let hireDate: Date | null = null;
  const hireDateRaw = getVal('hireDate');
  if (hireDateRaw) {
    const parsed = new Date(hireDateRaw);
    if (!isNaN(parsed.getTime())) {
      hireDate = parsed;
    } else {
      errors.push({ row: rowNumber, field: 'hireDate', message: `Invalid date: "${hireDateRaw}"` });
    }
  }

  return {
    employeeId,
    roleTitle,
    jobFamily: getVal('jobFamily'),
    level,
    country: normalizeCountry(countryRaw),
    location: getVal('location'),
    currency: currency.toUpperCase(),
    baseSalary: annualizedSalary,
    bonusTarget,
    ltiTarget,
    hireDate,
    employmentType: getVal('employmentType'),
    gender: getVal('gender'),
    performanceRating: getVal('performanceRating'),
  };
}

/**
 * Regression Engine — Controlled OLS (Ordinary Least Squares) regression
 * for pay equity analysis.
 *
 * Computes the unexplained gender pay gap after controlling for legitimate
 * pay factors: tenure, level, country, job family, and performance rating.
 *
 * Methodology:
 *   Dependent variable : log(baseSalary)  — normalises salary distribution
 *   Key variable       : isFemale (1 = female, 0 = male)
 *   Controls           : tenureYears, level (ordinal or one-hot),
 *                        country (one-hot), jobFamily (one-hot),
 *                        performanceRating (one-hot if present)
 *
 * The gender coefficient from this regression represents the fraction of the
 * pay gap that CANNOT be explained by the observable factors listed above.
 */

import { prisma } from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Matrix utilities
// ---------------------------------------------------------------------------

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = (B[0] ?? []).length;
  const inner = B.length;
  const C: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0) as number[]);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let s = 0;
      for (let k = 0; k < inner; k++) s += (A[i]![k] ?? 0) * (B[k]![j] ?? 0);
      C[i]![j] = s;
    }
  }
  return C;
}

function matTranspose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  const rows = A.length;
  const cols = (A[0] ?? []).length;
  const T: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0) as number[]);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) T[j]![i] = A[i]![j] ?? 0;
  }
  return T;
}

function matVecMul(A: number[][], v: number[]): number[] {
  return A.map((row) => row.reduce((sum, a, j) => sum + a * (v[j] ?? 0), 0));
}

/** Invert a square matrix using Gaussian elimination with partial pivoting. */
function matInverse(A: number[][]): number[][] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => {
    const ext = new Array(n).fill(0) as number[];
    ext[i] = 1;
    return [...row, ...ext];
  });

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(aug[col]![col] ?? 0);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(aug[row]![col] ?? 0);
      if (v > maxVal) {
        maxVal = v;
        maxRow = row;
      }
    }
    if (maxVal < 1e-10) return null; // numerically singular

    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!];
    const pivot = aug[col]![col]!;
    for (let j = 0; j < 2 * n; j++) aug[col]![j] = (aug[col]![j] ?? 0) / pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = aug[row]![col] ?? 0;
      for (let j = 0; j < 2 * n; j++) {
        aug[row]![j] = (aug[row]![j] ?? 0) - f * (aug[col]![j] ?? 0);
      }
    }
  }
  return aug.map((row) => row.slice(n));
}

// ---------------------------------------------------------------------------
// Statistics utilities
// ---------------------------------------------------------------------------

/** Standard normal CDF approximation (Abramowitz & Stegun 26.2.17). */
function normalCDF(z: number): number {
  const a = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * a);
  const poly =
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const phi = Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - phi * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

/**
 * Two-tailed p-value from a t-statistic.
 * Uses normal approximation for df > 30 (accurate to 3 dp);
 * applies a conservative correction for smaller samples.
 */
function twoTailedPValue(tStat: number, df: number): number {
  const absT = Math.abs(tStat);
  const z = df > 30 ? absT : absT * Math.sqrt(df / (df + absT * absT));
  return Math.min(1, 2 * (1 - normalCDF(z)));
}

// ---------------------------------------------------------------------------
// Feature engineering helpers
// ---------------------------------------------------------------------------

const FEMALE_VALUES = new Set(['female', 'f', 'woman', 'w']);
const MALE_VALUES = new Set(['male', 'm', 'man']);

function classifyGender(raw: string | null | undefined): 'female' | 'male' | null {
  if (!raw) return null;
  const n = raw.trim().toLowerCase();
  if (FEMALE_VALUES.has(n)) return 'female';
  if (MALE_VALUES.has(n)) return 'male';
  return null;
}

function computeTenureYears(hireDate: Date | null): number {
  if (!hireDate) return 0;
  const years = (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.min(years, 40));
}

/**
 * Try to extract an ordinal number from common level formats:
 *   L1, L2, L3 … → 1, 2, 3
 *   Junior, Mid, Senior, Lead, Principal, Director …
 * Returns null if no mapping found.
 */
function tryOrdinalLevel(level: string): number | null {
  const m = level.match(/^[Ll](\d+)$/);
  if (m) return parseInt(m[1]!, 10);
  const namedMap: Record<string, number> = {
    junior: 1,
    associate: 1,
    entry: 1,
    mid: 2,
    intermediate: 2,
    senior: 3,
    lead: 4,
    staff: 4,
    principal: 5,
    distinguished: 5,
    director: 6,
    'senior director': 7,
    vp: 7,
    svp: 8,
  };
  return namedMap[level.toLowerCase()] ?? null;
}

// ---------------------------------------------------------------------------
// Public result interface
// ---------------------------------------------------------------------------

export interface RegressionResult {
  status: 'COMPLETED' | 'INSUFFICIENT_DATA' | 'COMPUTATION_ERROR';
  message?: string;
  sampleSize: number;
  excludedCount: number;
  rSquared?: number;
  adjustedRSquared?: number;
  /** Gender coefficient on log(salary) scale. */
  genderCoefficient?: number;
  /** (exp(genderCoefficient) - 1) × 100 — the pay gap as a percentage. Negative = women earn less. */
  genderEffectPct?: number;
  genderTStat?: number;
  genderPValue?: number;
  isStatSignificant?: boolean;
  coefficients?: Array<{
    variable: string;
    coefficient: number;
    stdError: number;
    tStat: number;
    pValue: number;
  }>;
  flaggedIndividuals?: Array<{
    employeeDbId: string;
    employeeExternalId: string;
    gender: string;
    country: string;
    jobFamily: string | null;
    level: string;
    baseSalary: number;
    currency: string;
    predictedSalary: number;
    unexplainedGapPct: number;
    riskLevel: 'HIGH' | 'MEDIUM';
  }>;
  methodology: {
    dependentVariable: string;
    controlVariables: string[];
    levelEncoding: 'ordinal' | 'one-hot';
    notes: string[];
  };
}

// ---------------------------------------------------------------------------
// Main regression function
// ---------------------------------------------------------------------------

export async function runRegressionAnalysis(organizationId: string): Promise<RegressionResult> {
  const employees = await prisma.employee.findMany({
    where: { organizationId },
    select: {
      id: true,
      employeeId: true,
      baseSalary: true,
      gender: true,
      hireDate: true,
      level: true,
      country: true,
      jobFamily: true,
      performanceRating: true,
      currency: true,
    },
  });

  const notes: string[] = [];

  // Filter to employees with valid gender and a positive salary
  const valid = employees.filter((e) => {
    return classifyGender(e.gender) !== null && e.baseSalary > 0;
  });
  const excludedCount = employees.length - valid.length;
  if (excludedCount > 0) {
    notes.push(
      `${excludedCount} employee(s) excluded due to missing/unrecognised gender or invalid salary.`,
    );
  }

  const MIN_SAMPLE = 20;
  if (valid.length < MIN_SAMPLE) {
    return {
      status: 'INSUFFICIENT_DATA',
      message: `Insufficient data: ${valid.length} employees with recognised gender (minimum ${MIN_SAMPLE} required).`,
      sampleSize: valid.length,
      excludedCount,
      methodology: {
        dependentVariable: 'log(baseSalary)',
        controlVariables: [],
        levelEncoding: 'one-hot',
        notes,
      },
    };
  }

  // ----- Level encoding strategy -----
  const levels = [...new Set(valid.map((e) => e.level))].sort();
  const allOrdinal = levels.every((l) => tryOrdinalLevel(l) !== null);
  const levelEncoding: 'ordinal' | 'one-hot' = allOrdinal ? 'ordinal' : 'one-hot';
  notes.push(
    allOrdinal
      ? 'Level encoded as ordinal (detected structured hierarchy).'
      : 'Level encoded as one-hot categorical dummies.',
  );

  // ----- Category lists for dummies -----
  const countries = [...new Set(valid.map((e) => e.country))].sort();
  const jobFamilies = [...new Set(valid.map((e) => e.jobFamily ?? 'Unknown'))].sort();
  const hasPerformance = valid.some((e) => e.performanceRating);
  const performances = hasPerformance
    ? [...new Set(valid.map((e) => e.performanceRating ?? 'Unknown'))].sort()
    : [];

  if (!hasPerformance) {
    notes.push('Performance rating not available for most employees — excluded from model.');
  }

  // ----- Build feature name list -----
  const featureNames: string[] = ['intercept', 'isFemale', 'tenureYears'];

  if (allOrdinal) {
    featureNames.push('levelOrdinal');
  } else {
    // Drop first level as reference category
    for (let i = 1; i < levels.length; i++) featureNames.push(`level_${levels[i]}`);
  }

  // Country dummies (drop first as reference)
  for (let i = 1; i < countries.length; i++) featureNames.push(`country_${countries[i]}`);

  // Job family dummies (drop first as reference)
  if (jobFamilies.length > 1) {
    for (let i = 1; i < jobFamilies.length; i++) featureNames.push(`jobFamily_${jobFamilies[i]}`);
  }

  // Performance dummies (drop first as reference)
  if (performances.length > 1) {
    for (let i = 1; i < performances.length; i++) {
      featureNames.push(`performance_${performances[i]}`);
    }
  }

  const n = valid.length;
  const k = featureNames.length;

  if (n <= k + 1) {
    return {
      status: 'INSUFFICIENT_DATA',
      message: `Insufficient degrees of freedom: ${n} employees, ${k} parameters. Add more employees or reduce the number of distinct levels/countries.`,
      sampleSize: n,
      excludedCount,
      methodology: {
        dependentVariable: 'log(baseSalary)',
        controlVariables: featureNames.slice(1),
        levelEncoding,
        notes,
      },
    };
  }

  // ----- Build X matrix and y vector -----
  const X: number[][] = [];
  const y: number[] = [];
  const employeeRows = valid.slice(); // preserve order

  for (const emp of valid) {
    const gender = classifyGender(emp.gender)!;
    const isFemale = gender === 'female' ? 1 : 0;
    const tenure = computeTenureYears(emp.hireDate);
    const country = emp.country;
    const jobFamily = emp.jobFamily ?? 'Unknown';
    const performance = emp.performanceRating ?? 'Unknown';

    const row: number[] = [1, isFemale, tenure];

    if (allOrdinal) {
      row.push(tryOrdinalLevel(emp.level) ?? 1);
    } else {
      for (let i = 1; i < levels.length; i++) {
        row.push(emp.level === levels[i] ? 1 : 0);
      }
    }

    for (let i = 1; i < countries.length; i++) {
      row.push(country === countries[i] ? 1 : 0);
    }

    if (jobFamilies.length > 1) {
      for (let i = 1; i < jobFamilies.length; i++) {
        row.push(jobFamily === jobFamilies[i] ? 1 : 0);
      }
    }

    if (performances.length > 1) {
      for (let i = 1; i < performances.length; i++) {
        row.push(performance === performances[i] ? 1 : 0);
      }
    }

    X.push(row);
    y.push(Math.log(emp.baseSalary));
  }

  // ----- OLS: β = (X'X)⁻¹ X'y -----
  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X);
  const XtXinv = matInverse(XtX);

  if (!XtXinv) {
    return {
      status: 'COMPUTATION_ERROR',
      message:
        'Matrix inversion failed — likely due to perfect multicollinearity (e.g. all employees in a single country). Check for duplicate or constant feature columns.',
      sampleSize: n,
      excludedCount,
      methodology: {
        dependentVariable: 'log(baseSalary)',
        controlVariables: featureNames.slice(1),
        levelEncoding,
        notes,
      },
    };
  }

  const Xty = matVecMul(Xt, y);
  const beta = matVecMul(XtXinv, Xty);

  // ----- Residuals, σ², standard errors -----
  const yPred = matVecMul(X, beta);
  const residuals = y.map((yi, i) => yi - (yPred[i] ?? 0));
  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const sigma2 = rss / (n - k);

  const seBeta = XtXinv.map((row, j) => Math.sqrt(Math.max(0, (row[j] ?? 0) * sigma2)));
  const tStats = beta.map((b, j) => ((seBeta[j] ?? 0) > 1e-12 ? b / seBeta[j]! : 0));
  const pValues = tStats.map((t) => twoTailedPValue(t, n - k));

  // ----- R² -----
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const rSquared = ssTot > 0 ? 1 - rss / ssTot : 0;
  const adjustedRSquared = 1 - (1 - rSquared) * (n - 1) / (n - k - 1);

  // ----- Gender effect -----
  const genderIdx = 1; // isFemale is always index 1
  const genderCoef = beta[genderIdx] ?? 0;
  const genderEffectPct = (Math.exp(genderCoef) - 1) * 100;
  const genderTStat = tStats[genderIdx] ?? 0;
  const genderPValue = pValues[genderIdx] ?? 1;

  // ----- Build full coefficients table -----
  const coefficients = featureNames.map((name, j) => ({
    variable: name,
    coefficient: round(beta[j] ?? 0, 4),
    stdError: round(seBeta[j] ?? 0, 4),
    tStat: round(tStats[j] ?? 0, 3),
    pValue: round(pValues[j] ?? 1, 4),
  }));

  // ----- Flag individuals: women earning ≥5% below predicted -----
  const THRESHOLD_PCT = 5;
  const flaggedIndividuals: NonNullable<RegressionResult['flaggedIndividuals']> = [];

  for (let i = 0; i < n; i++) {
    const emp = employeeRows[i]!;
    const gender = classifyGender(emp.gender)!;
    if (gender !== 'female') continue;

    const predictedSalary = Math.exp(yPred[i] ?? 0);
    const unexplainedGapPct = ((predictedSalary - emp.baseSalary) / predictedSalary) * 100;

    if (unexplainedGapPct >= THRESHOLD_PCT) {
      flaggedIndividuals.push({
        employeeDbId: emp.id,
        employeeExternalId: emp.employeeId,
        gender: 'female',
        country: emp.country,
        jobFamily: emp.jobFamily,
        level: emp.level,
        baseSalary: emp.baseSalary,
        currency: emp.currency,
        predictedSalary: Math.round(predictedSalary),
        unexplainedGapPct: round(unexplainedGapPct, 1),
        riskLevel: unexplainedGapPct >= 10 ? 'HIGH' : 'MEDIUM',
      });
    }
  }

  flaggedIndividuals.sort((a, b) => b.unexplainedGapPct - a.unexplainedGapPct);

  const controlVars = featureNames.slice(1).filter((f) => f !== 'isFemale');

  return {
    status: 'COMPLETED',
    sampleSize: n,
    excludedCount,
    rSquared: round(rSquared, 3),
    adjustedRSquared: round(adjustedRSquared, 3),
    genderCoefficient: round(genderCoef, 4),
    genderEffectPct: round(genderEffectPct, 1),
    genderTStat: round(genderTStat, 2),
    genderPValue: round(genderPValue, 4),
    isStatSignificant: genderPValue < 0.05,
    coefficients,
    flaggedIndividuals,
    methodology: {
      dependentVariable: 'log(baseSalary)',
      controlVariables: controlVars,
      levelEncoding,
      notes,
    },
  };
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}

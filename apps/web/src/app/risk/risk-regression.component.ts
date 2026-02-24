import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../core/api.service';

interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  stdError: number;
  tStat: number;
  pValue: number;
}

interface FlaggedIndividual {
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
}

interface RegressionResult {
  id?: string;
  startedAt?: string;
  finishedAt?: string;
  status: 'COMPLETED' | 'INSUFFICIENT_DATA' | 'COMPUTATION_ERROR';
  message?: string;
  sampleSize: number;
  excludedCount: number;
  rSquared?: number;
  adjustedRSquared?: number;
  genderCoefficient?: number;
  genderEffectPct?: number;
  genderTStat?: number;
  genderPValue?: number;
  isStatSignificant?: boolean;
  coefficients?: RegressionCoefficient[];
  flaggedIndividuals?: FlaggedIndividual[];
  methodology?: {
    dependentVariable: string;
    controlVariables: string[];
    levelEncoding: string;
    notes: string[];
  };
}

@Component({
  selector: 'app-risk-regression',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <div class="regression-section">
      <div class="regression-header">
        <div class="regression-title-row">
          <mat-icon class="regression-icon">function</mat-icon>
          <div>
            <h2>Workforce Regression Analysis</h2>
            <p class="regression-subtitle">Controlled OLS regression identifying unexplained gender pay gaps</p>
          </div>
        </div>
        <button mat-stroked-button (click)="runAnalysis()" [disabled]="loading || !hasRiskData">
          <mat-icon>{{ loading ? 'hourglass_empty' : 'play_arrow' }}</mat-icon>
          {{ loading ? 'Running...' : (result ? 'Re-run Analysis' : 'Run Analysis') }}
        </button>
      </div>

      @if (!hasRiskData && !loading) {
        <p class="regression-placeholder">Run a risk analysis first to enable regression.</p>
      }

      @if (loading) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <p class="loading-text">Running controlled regression — controlling for tenure, level, country, job family, and performance...</p>
      }

      @if (error) {
        <div class="regression-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error }}</span>
        </div>
      }

      @if (result && !loading) {
        <!-- Insufficient data or computation error -->
        @if (result.status !== 'COMPLETED') {
          <div class="insufficient-state">
            <mat-icon class="insufficient-icon">info</mat-icon>
            <div>
              <p class="insufficient-title">{{ result.status === 'INSUFFICIENT_DATA' ? 'Insufficient Data' : 'Computation Error' }}</p>
              <p class="insufficient-msg">{{ result.message }}</p>
              @if (result.sampleSize !== undefined) {
                <p class="insufficient-detail">Employees with recognised gender: {{ result.sampleSize }} / {{ result.sampleSize + result.excludedCount }}</p>
              }
            </div>
          </div>
        }

        @if (result.status === 'COMPLETED') {
          <!-- A. Summary cards -->
          <div class="regression-stats">
            <div class="reg-stat-card" [class.gap-significant]="result.isStatSignificant && (result.genderEffectPct ?? 0) < 0">
              <div class="reg-stat-value" [class.value-alert]="result.isStatSignificant && (result.genderEffectPct ?? 0) < 0">
                {{ result.genderEffectPct !== undefined ? (result.genderEffectPct | number:'1.1-1') + '%' : 'N/A' }}
              </div>
              <div class="reg-stat-label">Unexplained Gender Gap</div>
              <div class="reg-stat-sub">After controlling for tenure, level, location</div>
            </div>

            <div class="reg-stat-card">
              <div class="sig-badge" [class]="result.isStatSignificant ? 'sig-yes' : 'sig-no'">
                <mat-icon>{{ result.isStatSignificant ? 'warning' : 'check_circle' }}</mat-icon>
                {{ result.isStatSignificant ? 'Statistically significant' : 'Not statistically significant' }}
              </div>
              <div class="reg-stat-label">Significance</div>
              <div class="reg-stat-sub">p = {{ result.genderPValue | number:'1.4-4' }} &nbsp;|&nbsp; t = {{ result.genderTStat | number:'1.2-2' }}</div>
            </div>

            <div class="reg-stat-card">
              <div class="reg-stat-value">{{ result.rSquared !== undefined ? (result.rSquared | number:'1.3-3') : 'N/A' }}</div>
              <div class="reg-stat-label">R² (model fit)</div>
              <div class="reg-stat-sub">{{ result.sampleSize }} employees in model</div>
            </div>

            <div class="reg-stat-card">
              <div class="reg-stat-value flag-count" [class.has-flags]="(result.flaggedIndividuals?.length ?? 0) > 0">
                {{ result.flaggedIndividuals?.length ?? 0 }}
              </div>
              <div class="reg-stat-label">Flagged Individuals</div>
              <div class="reg-stat-sub">Women earning ≥5% below model prediction</div>
            </div>
          </div>

          <!-- B. Methodology disclosure -->
          <div class="methodology-panel" [class.expanded]="methodologyExpanded">
            <button class="methodology-toggle" (click)="methodologyExpanded = !methodologyExpanded">
              <mat-icon>{{ methodologyExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
              Methodology
            </button>
            @if (methodologyExpanded) {
              <div class="methodology-content">
                <div class="method-row">
                  <span class="method-label">Dependent variable:</span>
                  <span class="method-value">{{ result.methodology?.dependentVariable }}</span>
                </div>
                <div class="method-row">
                  <span class="method-label">Level encoding:</span>
                  <span class="method-value">{{ result.methodology?.levelEncoding }}</span>
                </div>
                <div class="method-row">
                  <span class="method-label">Controls:</span>
                  <span class="method-value">{{ (result.methodology?.controlVariables ?? []).join(', ') || 'N/A' }}</span>
                </div>
                @if ((result.methodology?.notes ?? []).length > 0) {
                  <div class="method-notes">
                    @for (note of result.methodology?.notes ?? []; track $index) {
                      <p>{{ note }}</p>
                    }
                  </div>
                }
                <div class="method-disclaimer">
                  <mat-icon>info</mat-icon>
                  OLS regression on log(baseSalary). Results are indicative and do not constitute legal findings. Excluded employees ({{ result.excludedCount }}) lacked recognised gender or valid salary data.
                </div>
              </div>
            }
          </div>

          <!-- C. Key coefficients table -->
          @if (keyCoefficients.length > 0) {
            <div class="coeff-section">
              <h4 class="coeff-title">Key Model Coefficients</h4>
              <table class="coeff-table">
                <thead>
                  <tr>
                    <th>Variable</th>
                    <th>Coefficient</th>
                    <th>Std Error</th>
                    <th>T-Stat</th>
                    <th>P-Value</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of keyCoefficients; track c.variable) {
                    <tr [class.coeff-gender-row]="c.variable === 'isFemale'">
                      <td class="var-name">{{ formatVarName(c.variable) }}</td>
                      <td class="coeff-val">{{ c.coefficient | number:'1.4-4' }}</td>
                      <td>{{ c.stdError | number:'1.4-4' }}</td>
                      <td [class.t-significant]="Math.abs(c.tStat) >= 1.96">{{ c.tStat | number:'1.2-2' }}</td>
                      <td>{{ c.pValue | number:'1.4-4' }}</td>
                      <td class="sig-stars">{{ sigStars(c.pValue) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
              <p class="coeff-note">Significance: *** p&lt;0.001 &nbsp; ** p&lt;0.01 &nbsp; * p&lt;0.05</p>
            </div>
          }

          <!-- D. Flagged individuals -->
          <div class="flagged-section">
            <h4 class="flagged-title">
              Flagged Individuals
              @if ((result.flaggedIndividuals?.length ?? 0) > 0) {
                <span class="flagged-count">{{ result.flaggedIndividuals!.length }}</span>
              }
            </h4>

            @if ((result.flaggedIndividuals?.length ?? 0) === 0) {
              <div class="no-flags-state">
                <mat-icon class="no-flags-icon">check_circle</mat-icon>
                <p>No individuals flagged — no women are earning significantly below their model-predicted salary.</p>
              </div>
            } @else {
              <p class="flagged-intro">
                The following employees earn at least 5% less than their model-predicted salary after controlling for all observable factors.
                This does not indicate intentional discrimination but warrants individual pay review.
              </p>
              <table class="flagged-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Level</th>
                    <th>Country</th>
                    <th>Job Family</th>
                    <th>Actual Salary</th>
                    <th>Predicted</th>
                    <th>Gap %</th>
                    <th>Risk</th>
                  </tr>
                </thead>
                <tbody>
                  @for (ind of result.flaggedIndividuals; track ind.employeeDbId) {
                    <tr>
                      <td class="emp-id">{{ ind.employeeExternalId }}</td>
                      <td><span class="level-badge">{{ ind.level }}</span></td>
                      <td>{{ ind.country }}</td>
                      <td>{{ ind.jobFamily || '—' }}</td>
                      <td class="salary-val">{{ ind.currency }} {{ ind.baseSalary | number:'1.0-0' }}</td>
                      <td class="salary-val muted">{{ ind.currency }} {{ ind.predictedSalary | number:'1.0-0' }}</td>
                      <td class="gap-val">-{{ ind.unexplainedGapPct | number:'1.1-1' }}%</td>
                      <td>
                        <span class="risk-chip" [class]="'risk-' + ind.riskLevel.toLowerCase()">{{ ind.riskLevel }}</span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>

          @if (result.finishedAt) {
            <p class="run-meta">Analysis run: {{ result.startedAt | date:'medium' }}</p>
          }
        }
      }
    </div>
  `,
  styles: [`
    .regression-section {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .regression-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .regression-title-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .regression-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #6366f1;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .regression-title-row h2 {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 3px 0;
    }

    .regression-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }

    .regression-placeholder {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }

    .loading-text {
      font-size: 13px;
      color: #64748b;
      margin: 10px 0 0 0;
    }

    .regression-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b91c1c;
      font-size: 14px;
      margin-top: 8px;
    }

    /* Summary cards */
    .regression-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .reg-stat-card {
      padding: 14px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .gap-significant {
      border-color: #fca5a5;
      background: #fff1f2;
    }

    .reg-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 5px;
    }

    .value-alert { color: #b91c1c; }

    .reg-stat-label {
      font-size: 12px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 2px;
    }

    .reg-stat-sub {
      font-size: 11px;
      color: #94a3b8;
    }

    .sig-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      font-weight: 600;
      padding: 4px 0;
      margin-bottom: 5px;
    }

    .sig-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .sig-yes { color: #b91c1c; }
    .sig-no { color: #15803d; }

    .flag-count { font-size: 28px; }
    .has-flags { color: #b91c1c; }

    /* Insufficient data */
    .insufficient-state {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
    }

    .insufficient-icon {
      color: #d97706;
      font-size: 22px;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
    }

    .insufficient-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 4px 0;
    }

    .insufficient-msg {
      font-size: 13px;
      color: #374151;
      margin: 0 0 4px 0;
    }

    .insufficient-detail {
      font-size: 12px;
      color: #64748b;
      margin: 0;
    }

    /* Methodology */
    .methodology-panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .methodology-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      width: 100%;
      text-align: left;
    }

    .methodology-content {
      padding: 0 16px 14px;
      border-top: 1px solid #e2e8f0;
    }

    .method-row {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
    }

    .method-label { color: #94a3b8; font-weight: 500; min-width: 130px; }
    .method-value { color: #374151; }

    .method-notes {
      margin-top: 8px;
      font-size: 12px;
      color: #64748b;
    }

    .method-notes p { margin: 2px 0; }

    .method-disclaimer {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin-top: 10px;
      padding: 8px 12px;
      background: #eff6ff;
      border-radius: 6px;
      font-size: 11px;
      color: #1d4ed8;
    }

    .method-disclaimer mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Coefficients table */
    .coeff-section {
      margin-bottom: 16px;
    }

    .coeff-title {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 8px 0;
    }

    .coeff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .coeff-table th {
      text-align: left;
      padding: 6px 10px;
      background: #f8fafc;
      color: #64748b;
      font-weight: 500;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }

    .coeff-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #374151;
    }

    .coeff-gender-row { background: #fef9ec; }

    .var-name { font-weight: 500; color: #0f172a; font-size: 12px; }
    .coeff-val { font-weight: 600; font-variant-numeric: tabular-nums; }
    .t-significant { color: #b91c1c; font-weight: 600; }
    .sig-stars { font-weight: 700; color: #6366f1; }

    .coeff-note {
      font-size: 11px;
      color: #94a3b8;
      margin: 4px 0 0 0;
      font-style: italic;
    }

    /* Flagged individuals */
    .flagged-section {
      margin-bottom: 16px;
    }

    .flagged-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 10px 0;
    }

    .flagged-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      height: 22px;
      padding: 0 6px;
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 11px;
      font-size: 11px;
      font-weight: 700;
    }

    .flagged-intro {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 10px 0;
      line-height: 1.5;
    }

    .no-flags-state {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px;
      background: #f0fdf4;
      border: 1px solid #6ee7b7;
      border-radius: 8px;
      font-size: 13px;
      color: #166534;
    }

    .no-flags-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #16a34a;
      flex-shrink: 0;
    }

    .flagged-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .flagged-table th {
      text-align: left;
      padding: 7px 10px;
      background: #f8fafc;
      color: #64748b;
      font-weight: 500;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }

    .flagged-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #f1f5f9;
    }

    .flagged-table tr:hover { background: #fafafa; }

    .emp-id { font-family: monospace; font-size: 12px; color: #475569; }
    .level-badge {
      display: inline-block;
      padding: 1px 7px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: #475569;
    }
    .salary-val { font-variant-numeric: tabular-nums; color: #374151; }
    .muted { color: #94a3b8; }
    .gap-val { font-weight: 600; color: #b91c1c; }

    .risk-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .risk-high { background: #fee2e2; color: #b91c1c; }
    .risk-medium { background: #fef3c7; color: #b45309; }

    .run-meta {
      font-size: 11px;
      color: #94a3b8;
      margin: 0;
      text-align: right;
    }
  `],
})
export class RiskRegressionComponent implements OnInit {
  @Input() hasRiskData = false;

  result: RegressionResult | null = null;
  loading = false;
  error: string | null = null;
  methodologyExpanded = false;

  protected Math = Math;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Pre-load the latest regression run if one exists
    this.api.get<RegressionResult | null>('/risk/regression/latest').subscribe({
      next: (res) => {
        this.result = res ?? null;
        this.cdr.detectChanges();
      },
      error: () => {
        // Not a critical error — just means no prior run
      },
    });
  }

  runAnalysis() {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.api.post<RegressionResult>('/risk/regression', {}).subscribe({
      next: (res) => {
        this.result = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.error ?? 'Regression analysis failed. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get keyCoefficients(): RegressionCoefficient[] {
    if (!this.result?.coefficients) return [];
    // Show: intercept, isFemale, tenureYears, levelOrdinal (if present), plus first few others
    const priority = ['intercept', 'isFemale', 'tenureYears', 'levelOrdinal'];
    const prioritised = priority
      .map((name) => this.result!.coefficients!.find((c) => c.variable === name))
      .filter(Boolean) as RegressionCoefficient[];
    const rest = this.result.coefficients
      .filter((c) => !priority.includes(c.variable))
      .slice(0, 4);
    return [...prioritised, ...rest];
  }

  formatVarName(variable: string): string {
    if (variable === 'isFemale') return 'Gender (female)';
    if (variable === 'tenureYears') return 'Tenure (years)';
    if (variable === 'levelOrdinal') return 'Level (ordinal)';
    if (variable === 'intercept') return 'Intercept';
    return variable.replace(/^(country|jobFamily|level|performance)_/, (_, p) => `${p}: `);
  }

  sigStars(pValue: number): string {
    if (pValue < 0.001) return '***';
    if (pValue < 0.01) return '**';
    if (pValue < 0.05) return '*';
    return '';
  }
}

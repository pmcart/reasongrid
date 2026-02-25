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
          <mat-icon class="regression-icon">manage_search</mat-icon>
          <div>
            <h2>Controlled Pay Gap Analysis</h2>
            <p class="regression-subtitle">Compares pay between women and men in equivalent roles, adjusting for seniority, location, and tenure</p>
          </div>
        </div>
        <button mat-stroked-button (click)="runAnalysis()" [disabled]="loading || !hasRiskData">
          <mat-icon>{{ loading ? 'hourglass_empty' : 'play_arrow' }}</mat-icon>
          {{ loading ? 'Analysing...' : (result ? 'Re-run' : 'Run Analysis') }}
        </button>
      </div>

      @if (!hasRiskData && !loading) {
        <p class="regression-placeholder">Run a risk analysis first to enable this.</p>
      }

      @if (loading) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <p class="loading-text">Comparing pay across equivalent roles...</p>
      }

      @if (error) {
        <div class="regression-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error }}</span>
        </div>
      }

      @if (result && !loading) {

        <!-- Insufficient data state -->
        @if (result.status !== 'COMPLETED') {
          <div class="info-box info-amber">
            <mat-icon>info</mat-icon>
            <div>
              <p class="info-title">Not enough data to run this analysis</p>
              <p class="info-body">{{ result.message }}</p>
              <p class="info-hint">This analysis needs at least 20 employees with gender data recorded.</p>
            </div>
          </div>
        }

        @if (result.status === 'COMPLETED') {

          <!-- ===== MAIN VERDICT CARD ===== -->
          <div class="verdict-card" [class]="verdictClass">
            <div class="verdict-icon-col">
              <mat-icon class="verdict-icon">{{ verdictIcon }}</mat-icon>
            </div>
            <div class="verdict-body">
              <p class="verdict-headline">{{ verdictHeadline }}</p>
              <p class="verdict-detail">{{ verdictDetail }}</p>
              <div class="verdict-chips">
                <span class="v-chip">
                  <mat-icon>people</mat-icon>
                  {{ result.sampleSize }} employees compared
                </span>
                <span class="v-chip">
                  <mat-icon>shield</mat-icon>
                  {{ confidenceLabel }} confidence
                </span>
                <span class="v-chip">
                  <mat-icon>tune</mat-icon>
                  Adjusted for {{ controlSummary }}
                </span>
              </div>
            </div>
            @if ((result.genderEffectPct ?? 0) !== 0) {
              <div class="verdict-stat">
                <span class="verdict-pct" [class.pct-bad]="(result.genderEffectPct ?? 0) < -1">
                  {{ result.genderEffectPct! > 0 ? '+' : '' }}{{ result.genderEffectPct | number:'1.1-1' }}%
                </span>
                <span class="verdict-pct-label">unexplained gap</span>
              </div>
            }
          </div>

          <!-- Confidence explainer (only show if result is ambiguous) -->
          @if (!result.isStatSignificant && (result.genderEffectPct ?? 0) !== 0) {
            <div class="info-box info-blue">
              <mat-icon>info</mat-icon>
              <p>A gap of {{ result.genderEffectPct | number:'1.1-1' }}% was found, but the dataset is too small to be statistically certain this isn't just random variation. It's worth monitoring as your workforce grows.</p>
            </div>
          }

          <!-- ===== EMPLOYEES TO REVIEW ===== -->
          <div class="review-section">
            <div class="review-header">
              <div class="review-title-row">
                <mat-icon [class]="(result.flaggedIndividuals?.length ?? 0) > 0 ? 'icon-alert' : 'icon-ok'">
                  {{ (result.flaggedIndividuals?.length ?? 0) > 0 ? 'person_alert' : 'person_check' }}
                </mat-icon>
                <h3>Employees to Review</h3>
                @if ((result.flaggedIndividuals?.length ?? 0) > 0) {
                  <span class="review-count">{{ result.flaggedIndividuals!.length }}</span>
                }
              </div>
            </div>

            @if ((result.flaggedIndividuals?.length ?? 0) === 0) {
              <div class="no-flags">
                <mat-icon>check_circle</mat-icon>
                <p>No individuals identified — no women in this dataset are earning significantly below what would be expected for their role profile.</p>
              </div>
            } @else {
              <p class="review-intro">
                These employees earn noticeably less than others in equivalent roles. This doesn't indicate a definite problem, but each warrants a confidential pay review.
              </p>
              <div class="review-cards">
                @for (ind of result.flaggedIndividuals; track ind.employeeDbId) {
                  <div class="review-card" [class.card-high]="ind.riskLevel === 'HIGH'">
                    <div class="rc-top">
                      <div class="rc-id">
                        <span class="rc-emp-id">{{ ind.employeeExternalId }}</span>
                        <span class="rc-location">{{ ind.country }}{{ ind.jobFamily ? ' · ' + ind.jobFamily : '' }} · {{ ind.level }}</span>
                      </div>
                      <span class="rc-risk-badge" [class.badge-high]="ind.riskLevel === 'HIGH'" [class.badge-medium]="ind.riskLevel === 'MEDIUM'">
                        {{ ind.riskLevel === 'HIGH' ? 'High priority' : 'Moderate' }}
                      </span>
                    </div>
                    <div class="rc-pay">
                      <div class="rc-pay-item">
                        <span class="rc-pay-label">Current pay</span>
                        <span class="rc-pay-value">{{ ind.currency }} {{ ind.baseSalary | number:'1.0-0' }}</span>
                      </div>
                      <div class="rc-pay-arrow">
                        <mat-icon>arrow_forward</mat-icon>
                      </div>
                      <div class="rc-pay-item">
                        <span class="rc-pay-label">Expected for this role</span>
                        <span class="rc-pay-value rc-pay-expected">{{ ind.currency }} {{ ind.predictedSalary | number:'1.0-0' }}</span>
                      </div>
                      <div class="rc-gap-pill">
                        -{{ ind.unexplainedGapPct | number:'1.1-1' }}% below expected
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- ===== TECHNICAL DETAILS (collapsed) ===== -->
          <div class="tech-section">
            <button class="tech-toggle" (click)="techExpanded = !techExpanded">
              <mat-icon>{{ techExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
              Technical details
              <span class="tech-toggle-sub">(for analysts)</span>
            </button>

            @if (techExpanded) {
              <div class="tech-content">
                <div class="tech-stats-row">
                  <div class="tech-stat">
                    <span class="ts-label">Gender coefficient</span>
                    <span class="ts-value">{{ result.genderCoefficient | number:'1.4-4' }}</span>
                  </div>
                  <div class="tech-stat">
                    <span class="ts-label">T-statistic</span>
                    <span class="ts-value">{{ result.genderTStat | number:'1.2-2' }}</span>
                  </div>
                  <div class="tech-stat">
                    <span class="ts-label">P-value</span>
                    <span class="ts-value">{{ result.genderPValue | number:'1.4-4' }}</span>
                  </div>
                  <div class="tech-stat">
                    <span class="ts-label">R²</span>
                    <span class="ts-value">{{ result.rSquared | number:'1.3-3' }}</span>
                  </div>
                  <div class="tech-stat">
                    <span class="ts-label">Adj. R²</span>
                    <span class="ts-value">{{ result.adjustedRSquared | number:'1.3-3' }}</span>
                  </div>
                  <div class="tech-stat">
                    <span class="ts-label">Excluded</span>
                    <span class="ts-value">{{ result.excludedCount }}</span>
                  </div>
                </div>

                @if (keyCoefficients.length > 0) {
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
                          <td>{{ c.coefficient | number:'1.4-4' }}</td>
                          <td>{{ c.stdError | number:'1.4-4' }}</td>
                          <td [class.t-sig]="mathAbs(c.tStat) >= 1.96">{{ c.tStat | number:'1.2-2' }}</td>
                          <td>{{ c.pValue | number:'1.4-4' }}</td>
                          <td class="sig-stars">{{ sigStars(c.pValue) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                  <p class="coeff-note">*** p&lt;0.001 &nbsp; ** p&lt;0.01 &nbsp; * p&lt;0.05</p>
                }

                @if (result.methodology) {
                  <div class="method-notes">
                    <p><strong>Method:</strong> OLS regression on log(baseSalary). Dependent variable: {{ result.methodology.dependentVariable }}.</p>
                    <p><strong>Controls:</strong> {{ result.methodology.controlVariables.join(', ') || 'none' }}.</p>
                    @for (note of result.methodology.notes; track $index) {
                      <p>{{ note }}</p>
                    }
                  </div>
                }
              </div>
            }
          </div>

          @if (result.startedAt) {
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
    }

    .regression-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 16px;
    }

    .regression-title-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .regression-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: #6366f1;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .regression-title-row h2 {
      font-size: 17px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 3px 0;
    }

    .regression-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    .regression-placeholder, .loading-text {
      font-size: 13px;
      color: #94a3b8;
      margin: 0;
    }

    .regression-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b91c1c;
      font-size: 14px;
    }

    /* Info boxes */
    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 16px;
    }

    .info-box mat-icon { flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; margin-top: 1px; }

    .info-amber { background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; }
    .info-amber mat-icon { color: #d97706; }
    .info-blue { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
    .info-blue mat-icon { color: #3b82f6; }

    .info-title { font-weight: 600; margin: 0 0 3px 0; }
    .info-body { margin: 0 0 4px 0; }
    .info-hint { font-size: 12px; opacity: 0.75; margin: 0; }

    /* Verdict card */
    .verdict-card {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      border: 1px solid;
    }

    .verdict-ok { background: #f0fdf4; border-color: #86efac; }
    .verdict-warn { background: #fffbeb; border-color: #fcd34d; }
    .verdict-alert { background: #fff1f2; border-color: #fca5a5; }

    .verdict-icon-col { flex-shrink: 0; padding-top: 2px; }

    .verdict-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .verdict-ok .verdict-icon { color: #16a34a; }
    .verdict-warn .verdict-icon { color: #d97706; }
    .verdict-alert .verdict-icon { color: #dc2626; }

    .verdict-body { flex: 1; }

    .verdict-headline {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 5px 0;
      line-height: 1.3;
    }

    .verdict-detail {
      font-size: 13px;
      color: #475569;
      margin: 0 0 12px 0;
      line-height: 1.5;
    }

    .verdict-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .v-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: rgba(255,255,255,0.7);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: 12px;
      font-size: 11px;
      color: #374151;
    }

    .v-chip mat-icon { font-size: 13px; width: 13px; height: 13px; }

    .verdict-stat {
      flex-shrink: 0;
      text-align: center;
      padding: 8px 16px;
      background: rgba(255,255,255,0.6);
      border-radius: 8px;
    }

    .verdict-pct {
      display: block;
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
    }

    .pct-bad { color: #dc2626; }

    .verdict-pct-label {
      font-size: 11px;
      color: #64748b;
      display: block;
      margin-top: 3px;
      white-space: nowrap;
    }

    /* Review section */
    .review-section {
      margin-bottom: 20px;
    }

    .review-header {
      margin-bottom: 12px;
    }

    .review-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .review-title-row h3 {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .icon-alert { color: #dc2626; font-size: 20px; width: 20px; height: 20px; }
    .icon-ok { color: #16a34a; font-size: 20px; width: 20px; height: 20px; }

    .review-count {
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

    .review-intro {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 12px 0;
      line-height: 1.5;
    }

    .no-flags {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 16px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      font-size: 13px;
      color: #166534;
      line-height: 1.5;
    }

    .no-flags mat-icon { font-size: 22px; width: 22px; height: 22px; color: #16a34a; flex-shrink: 0; }

    /* Review cards */
    .review-cards {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .review-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff;
    }

    .card-high {
      border-color: #fca5a5;
      background: #fff8f8;
    }

    .rc-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .rc-id {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .rc-emp-id {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      font-family: monospace;
    }

    .rc-location {
      font-size: 12px;
      color: #64748b;
    }

    .rc-risk-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .badge-high { background: #fee2e2; color: #b91c1c; }
    .badge-medium { background: #fef3c7; color: #92400e; }

    .rc-pay {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .rc-pay-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .rc-pay-label {
      font-size: 11px;
      color: #94a3b8;
    }

    .rc-pay-value {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      font-variant-numeric: tabular-nums;
    }

    .rc-pay-expected { color: #059669; }

    .rc-pay-arrow mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
    }

    .rc-gap-pill {
      margin-left: auto;
      padding: 4px 12px;
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    /* Technical section */
    .tech-section {
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
      margin-bottom: 8px;
    }

    .tech-toggle {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      padding: 4px 0;
    }

    .tech-toggle:hover { color: #374151; }
    .tech-toggle mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tech-toggle-sub { color: #94a3b8; font-weight: 400; }

    .tech-content {
      margin-top: 12px;
      padding: 14px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .tech-stats-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 14px;
    }

    .tech-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .ts-label { font-size: 11px; color: #94a3b8; }
    .ts-value { font-size: 13px; font-weight: 600; color: #374151; font-variant-numeric: tabular-nums; }

    .coeff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 4px;
    }

    .coeff-table th {
      text-align: left;
      padding: 5px 8px;
      background: #f1f5f9;
      color: #64748b;
      font-weight: 500;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }

    .coeff-table td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #374151;
    }

    .coeff-gender-row { background: #fef9ec; }
    .var-name { font-weight: 500; color: #0f172a; }
    .t-sig { color: #b91c1c; font-weight: 600; }
    .sig-stars { font-weight: 700; color: #6366f1; }
    .coeff-note { font-size: 11px; color: #94a3b8; font-style: italic; margin: 4px 0 12px; }

    .method-notes {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .method-notes p { margin: 2px 0; }

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
  techExpanded = false;

  protected mathAbs = Math.abs;

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.api.get<RegressionResult | null>('/risk/regression/latest').subscribe({
      next: (res) => {
        this.result = res ?? null;
        this.cdr.detectChanges();
      },
      error: () => {},
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
        this.error = err?.error?.error ?? 'Analysis failed. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Verdict helpers — plain language derived from stats
  // ---------------------------------------------------------------------------

  get verdictClass(): string {
    if (!this.result || this.result.status !== 'COMPLETED') return 'verdict-ok';
    const gap = this.result.genderEffectPct ?? 0;
    if (this.result.isStatSignificant && gap < -1) return 'verdict-alert';
    if (Math.abs(gap) >= 2) return 'verdict-warn';
    return 'verdict-ok';
  }

  get verdictIcon(): string {
    switch (this.verdictClass) {
      case 'verdict-alert': return 'warning';
      case 'verdict-warn': return 'info';
      default: return 'check_circle';
    }
  }

  get verdictHeadline(): string {
    const gap = this.result?.genderEffectPct ?? 0;
    const sig = this.result?.isStatSignificant;
    const absGap = Math.abs(gap);

    if (absGap < 1) return 'No meaningful pay gap detected after adjusting for role factors';
    if (gap < 0 && sig) return `Women earn ${absGap.toFixed(1)}% less than equally-qualified men`;
    if (gap < 0 && !sig) return `A ${absGap.toFixed(1)}% gap was found, but the data is too limited to be certain`;
    if (gap > 0 && sig) return `Women earn ${absGap.toFixed(1)}% more than equally-qualified men`;
    return `A ${absGap.toFixed(1)}% gap was observed — monitor as the workforce grows`;
  }

  get verdictDetail(): string {
    const gap = this.result?.genderEffectPct ?? 0;
    const sig = this.result?.isStatSignificant;
    const absGap = Math.abs(gap);
    const controls = this.controlSummary;

    if (absGap < 1) {
      return `After accounting for ${controls}, pay between women and men is broadly equivalent across your workforce.`;
    }
    if (gap < 0 && sig) {
      return `This ${absGap.toFixed(1)}% gap cannot be explained by ${controls}. It warrants a structured pay review.`;
    }
    if (gap < 0 && !sig) {
      return `After adjusting for ${controls}, a gap exists but the sample size means we can't rule out that it's statistical noise.`;
    }
    return `After accounting for ${controls}, women appear to earn slightly more. This is worth validating.`;
  }

  get confidenceLabel(): string {
    const p = this.result?.genderPValue ?? 1;
    if (p < 0.01) return 'high';
    if (p < 0.05) return 'moderate';
    if (p < 0.15) return 'low';
    return 'very low';
  }

  get controlSummary(): string {
    const vars = this.result?.methodology?.controlVariables ?? [];
    const labels: Record<string, string> = {
      tenureYears: 'tenure',
      levelOrdinal: 'level',
    };
    const readable = vars
      .filter((v) => !v.startsWith('level_') && !v.startsWith('country_') && !v.startsWith('jobFamily_') && !v.startsWith('performance_'))
      .map((v) => labels[v] ?? v);

    if (vars.some((v) => v.startsWith('level_') || v === 'levelOrdinal')) readable.push('level');
    if (vars.some((v) => v.startsWith('country_'))) readable.push('location');
    if (vars.some((v) => v.startsWith('jobFamily_'))) readable.push('job family');
    if (vars.some((v) => v.startsWith('performance_'))) readable.push('performance');

    const unique = [...new Set(readable)];
    if (unique.length === 0) return 'role factors';
    if (unique.length === 1) return unique[0]!;
    return unique.slice(0, -1).join(', ') + ' and ' + unique[unique.length - 1];
  }

  // ---------------------------------------------------------------------------
  // Technical detail helpers
  // ---------------------------------------------------------------------------

  get keyCoefficients() {
    if (!this.result?.coefficients) return [];
    const priority = ['intercept', 'isFemale', 'tenureYears', 'levelOrdinal'];
    const prioritised = priority
      .map((name) => this.result!.coefficients!.find((c) => c.variable === name))
      .filter(Boolean) as RegressionCoefficient[];
    const rest = this.result.coefficients.filter((c) => !priority.includes(c.variable)).slice(0, 4);
    return [...prioritised, ...rest];
  }

  formatVarName(v: string): string {
    if (v === 'isFemale') return 'Gender (female)';
    if (v === 'tenureYears') return 'Tenure (years)';
    if (v === 'levelOrdinal') return 'Level (ordinal)';
    if (v === 'intercept') return 'Intercept';
    return v.replace(/^(country|jobFamily|level|performance)_/, (_, p) => `${p}: `);
  }

  sigStars(p: number): string {
    if (p < 0.001) return '***';
    if (p < 0.01) return '**';
    if (p < 0.05) return '*';
    return '';
  }
}

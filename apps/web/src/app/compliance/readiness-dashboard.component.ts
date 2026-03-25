import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ComplianceService, ReadinessMetrics } from '../core/compliance.service';

interface PriorityAction {
  icon: string;
  title: string;
  description: string;
  link: string;
  queryParams?: Record<string, string>;
  weight: number;
}

@Component({
  selector: 'app-readiness-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Directive Readiness</h1>
          <p class="page-subtitle">Track your organisation's readiness for EU Pay Transparency Directive requirements</p>
        </div>
      </div>

      <div class="disclaimer-banner">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>
          This information supports internal governance and transparency requirements.
          It does not constitute legal advice.
        </span>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading readiness metrics...</p>
        </div>
      } @else if (metrics) {
        <!-- Overall Score -->
        <div class="overall-score-card">
          <div class="score-content">
            <div class="score-number" [class]="getScoreColorClass(metrics.overallScore)">
              {{ metrics.overallScore }}%
            </div>
            <div class="score-details">
              <span class="status-badge" [class]="'status-badge status-' + metrics.status.toLowerCase()">
                {{ metrics.status }}
              </span>
              <span class="score-label">Overall Readiness Score</span>
            </div>
          </div>
        </div>

        <!-- Priority Action List -->
        @if (topActions.length > 0) {
          <div class="action-list-card">
            <div class="action-list-header">
              <mat-icon class="action-list-icon">flag</mat-icon>
              <div>
                <h2 class="action-list-title">Your top {{ topActions.length }} actions before 7 June 2026</h2>
                <p class="action-list-subtitle">Prioritised by impact on your readiness score</p>
              </div>
            </div>
            <div class="action-items">
              @for (action of topActions; track action.title; let i = $index) {
                <div class="action-item">
                  <div class="action-rank">{{ i + 1 }}</div>
                  <mat-icon class="action-item-icon">{{ action.icon }}</mat-icon>
                  <div class="action-item-body">
                    <p class="action-item-title">{{ action.title }}</p>
                    <p class="action-item-desc">{{ action.description }}</p>
                  </div>
                  <a mat-stroked-button color="primary" class="action-item-cta"
                     [routerLink]="action.link" [queryParams]="action.queryParams ?? {}">
                    Go
                    <mat-icon>arrow_forward</mat-icon>
                  </a>
                </div>
              }
            </div>
          </div>
        }

        <!-- Metric Cards Grid -->
        <div class="metrics-grid">
          <!-- Salary Range Coverage -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon" [class]="getColorClass(metrics.salaryRangeCoverage.percentage)">paid</mat-icon>
              <h3>Salary Range Coverage</h3>
            </div>
            <div class="metric-body">
              <mat-progress-bar
                mode="determinate"
                [value]="metrics.salaryRangeCoverage.percentage"
                [class]="'progress-bar ' + getColorClass(metrics.salaryRangeCoverage.percentage)">
              </mat-progress-bar>
              <div class="metric-stats">
                <span class="metric-count">{{ metrics.salaryRangeCoverage.covered }} / {{ metrics.salaryRangeCoverage.total }} groups</span>
                <span class="metric-pct" [class]="getColorClass(metrics.salaryRangeCoverage.percentage)">
                  {{ metrics.salaryRangeCoverage.percentage }}%
                </span>
              </div>
              <span class="metric-status-badge" [class]="'metric-status-badge ' + getColorClass(metrics.salaryRangeCoverage.percentage)">
                {{ getStatusLabel(metrics.salaryRangeCoverage.percentage) }}
              </span>
              @if (metrics.salaryRangeCoverage.percentage < 100) {
                <p class="metric-guidance">Define salary ranges for all comparator groups to support pay transparency disclosures.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/settings/salary-ranges">
                Go to Salary Ranges
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>

          <!-- Pay Decision Documentation -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon" [class]="getColorClass(metrics.payDecisionDocumentation.percentage)">gavel</mat-icon>
              <h3>Pay Decision Documentation</h3>
            </div>
            <div class="metric-body">
              <mat-progress-bar
                mode="determinate"
                [value]="metrics.payDecisionDocumentation.percentage"
                [class]="'progress-bar ' + getColorClass(metrics.payDecisionDocumentation.percentage)">
              </mat-progress-bar>
              <div class="metric-stats">
                <span class="metric-count">{{ metrics.payDecisionDocumentation.covered }} / {{ metrics.payDecisionDocumentation.total }} employees</span>
                <span class="metric-pct" [class]="getColorClass(metrics.payDecisionDocumentation.percentage)">
                  {{ metrics.payDecisionDocumentation.percentage }}%
                </span>
              </div>
              <span class="metric-status-badge" [class]="'metric-status-badge ' + getColorClass(metrics.payDecisionDocumentation.percentage)">
                {{ getStatusLabel(metrics.payDecisionDocumentation.percentage) }}
              </span>
              @if (metrics.payDecisionDocumentation.percentage < 100) {
                <p class="metric-guidance">Ensure all employees have at least one finalised pay decision on record.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/employees" [queryParams]="{ filter: 'no-decisions' }">
                Go to Employees
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>

          <!-- Rationale Library -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon color-green">menu_book</mat-icon>
              <h3>Rationale Library</h3>
            </div>
            <div class="metric-body">
              <div class="rationale-summary">
                <div class="rationale-stat">
                  <span class="rationale-value">{{ metrics.rationaleLibrary.active }}</span>
                  <span class="rationale-label">Active Definitions</span>
                </div>
                <div class="category-coverage">
                  @for (entry of categoryEntries; track entry[0]) {
                    <div class="category-row">
                      <span class="category-name">{{ formatCategory(entry[0]) }}</span>
                      <span class="category-count">{{ entry[1] }}</span>
                    </div>
                  }
                </div>
              </div>
              <span class="metric-status-badge color-green">
                {{ metrics.rationaleLibrary.active > 0 ? 'Active' : 'Not Started' }}
              </span>
              @if (metrics.rationaleLibrary.active === 0) {
                <p class="metric-guidance">Configure your rationale library to support structured pay decision documentation.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/rationale-library">
                Go to Rationale Library
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>

          <!-- Risk Analysis -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon" [class]="getRiskColorClass()">monitoring</mat-icon>
              <h3>Risk Analysis</h3>
            </div>
            <div class="metric-body">
              <div class="risk-summary">
                <div class="risk-stat-row">
                  <span class="risk-stat-label">Last Run</span>
                  <span class="risk-stat-value">
                    {{ metrics.riskAnalysis.lastRunAt ? (metrics.riskAnalysis.lastRunAt | date:'mediumDate') : 'Never' }}
                  </span>
                </div>
                <div class="risk-stat-row">
                  <span class="risk-stat-label">Threshold Alerts</span>
                  <span class="risk-stat-value" [class.risk-alert]="metrics.riskAnalysis.alertCount > 0">
                    {{ metrics.riskAnalysis.alertCount }}
                  </span>
                </div>
                <div class="risk-stat-row">
                  <span class="risk-stat-label">Requires Review</span>
                  <span class="risk-stat-value" [class.risk-review]="metrics.riskAnalysis.reviewCount > 0">
                    {{ metrics.riskAnalysis.reviewCount }}
                  </span>
                </div>
              </div>
              <span class="metric-status-badge" [class]="'metric-status-badge ' + getRiskColorClass()">
                {{ getRiskStatusLabel() }}
              </span>
              @if (!metrics.riskAnalysis.lastRunAt) {
                <p class="metric-guidance">Run a risk analysis to identify pay gap risks across comparator groups.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/risk">
                Go to Risk Radar
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>

          <!-- Gender Data Coverage -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon" [class]="getColorClass(metrics.genderDataCoverage.percentage)">wc</mat-icon>
              <h3>Gender Data Coverage</h3>
            </div>
            <div class="metric-body">
              <mat-progress-bar
                mode="determinate"
                [value]="metrics.genderDataCoverage.percentage"
                [class]="'progress-bar ' + getColorClass(metrics.genderDataCoverage.percentage)">
              </mat-progress-bar>
              <div class="metric-stats">
                <span class="metric-count">{{ metrics.genderDataCoverage.covered }} / {{ metrics.genderDataCoverage.total }} employees</span>
                <span class="metric-pct" [class]="getColorClass(metrics.genderDataCoverage.percentage)">
                  {{ metrics.genderDataCoverage.percentage }}%
                </span>
              </div>
              <span class="metric-status-badge" [class]="'metric-status-badge ' + getColorClass(metrics.genderDataCoverage.percentage)">
                {{ getStatusLabel(metrics.genderDataCoverage.percentage) }}
              </span>
              @if (metrics.genderDataCoverage.percentage < 100) {
                <p class="metric-guidance">Gender data is required for pay gap risk analysis. Populate gender for all employees.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/imports/new">
                Go to Import
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>

          <!-- Classification Coverage -->
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon" [class]="getColorClass(metrics.classificationCoverage.percentage)">category</mat-icon>
              <h3>Classification Coverage</h3>
            </div>
            <div class="metric-body">
              <mat-progress-bar
                mode="determinate"
                [value]="metrics.classificationCoverage.percentage"
                [class]="'progress-bar ' + getColorClass(metrics.classificationCoverage.percentage)">
              </mat-progress-bar>
              <div class="metric-stats">
                <span class="metric-count">{{ metrics.classificationCoverage.covered }} / {{ metrics.classificationCoverage.total }} confirmed</span>
                <span class="metric-pct" [class]="getColorClass(metrics.classificationCoverage.percentage)">
                  {{ metrics.classificationCoverage.percentage }}%
                </span>
              </div>
              <span class="metric-status-badge" [class]="'metric-status-badge ' + getColorClass(metrics.classificationCoverage.percentage)">
                {{ getStatusLabel(metrics.classificationCoverage.percentage) }}
              </span>
              @if (metrics.classificationCoverage.percentage < 100) {
                <p class="metric-guidance">Confirm role classifications to support equal work / equal value comparisons.</p>
              }
            </div>
            <div class="metric-footer">
              <a mat-button color="primary" routerLink="/employees" [queryParams]="{ filter: 'no-classification' }">
                Go to Employees
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
          </mat-card>
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">verified</mat-icon>
          <p class="empty-state-title">Unable to load readiness metrics</p>
          <p class="empty-state-text">Import employees and configure your organisation to view readiness status.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
    }

    .page-header {
      margin-bottom: 20px;
    }

    .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }

    .page-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 6px 0 0 0;
      max-width: 640px;
      line-height: 1.5;
    }

    .disclaimer-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
    }

    .disclaimer-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #64748b;
    }

    .loading-state p {
      margin-top: 12px;
    }

    /* Overall Score */
    .overall-score-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 24px 32px;
      margin-bottom: 24px;
    }

    .score-content {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .score-number {
      font-size: 56px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .score-number.color-green { color: #10b981; }
    .score-number.color-amber { color: #f59e0b; }
    .score-number.color-red { color: #ef4444; }

    .score-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .score-label {
      font-size: 14px;
      color: #64748b;
    }

    .status-badge {
      display: inline-block;
      width: fit-content;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .status-badge.status-complete {
      background: #ecfdf5;
      color: #059669;
    }

    .status-badge.status-partial {
      background: #fffbeb;
      color: #d97706;
    }

    .status-badge.status-incomplete {
      background: #fef2f2;
      color: #dc2626;
    }

    /* Priority Action List */
    .action-list-card {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }

    .action-list-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
    }

    .action-list-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #f59e0b;
      margin-top: 2px;
      flex-shrink: 0;
    }

    .action-list-title {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 2px 0;
    }

    .action-list-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }

    .action-items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .action-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }

    .action-rank {
      font-size: 13px;
      font-weight: 700;
      color: #94a3b8;
      width: 20px;
      text-align: center;
      flex-shrink: 0;
    }

    .action-item-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #4f46e5;
      flex-shrink: 0;
    }

    .action-item-body {
      flex: 1;
    }

    .action-item-title {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 2px 0;
    }

    .action-item-desc {
      font-size: 12px;
      color: #64748b;
      margin: 0;
      line-height: 1.4;
    }

    .action-item-cta {
      flex-shrink: 0;
      font-size: 13px;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .metric-card {
      padding: 20px !important;
      border-radius: 12px !important;
      display: flex;
      flex-direction: column;
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .metric-header h3 {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .metric-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .metric-icon.color-green { color: #10b981; }
    .metric-icon.color-amber { color: #f59e0b; }
    .metric-icon.color-red { color: #ef4444; }

    .metric-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* Progress bar color overrides */
    :host ::ng-deep .progress-bar.color-green .mdc-linear-progress__bar-inner {
      border-color: #10b981;
    }

    :host ::ng-deep .progress-bar.color-amber .mdc-linear-progress__bar-inner {
      border-color: #f59e0b;
    }

    :host ::ng-deep .progress-bar.color-red .mdc-linear-progress__bar-inner {
      border-color: #ef4444;
    }

    .metric-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .metric-count {
      font-size: 13px;
      color: #475569;
    }

    .metric-pct {
      font-size: 18px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .metric-pct.color-green { color: #10b981; }
    .metric-pct.color-amber { color: #f59e0b; }
    .metric-pct.color-red { color: #ef4444; }

    .metric-status-badge {
      display: inline-block;
      width: fit-content;
      padding: 2px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }

    .metric-status-badge.color-green {
      background: #ecfdf5;
      color: #059669;
    }

    .metric-status-badge.color-amber {
      background: #fffbeb;
      color: #d97706;
    }

    .metric-status-badge.color-red {
      background: #fef2f2;
      color: #dc2626;
    }

    .metric-guidance {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      margin: 0;
    }

    .metric-footer {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }

    /* Rationale summary */
    .rationale-summary {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rationale-stat {
      display: flex;
      align-items: baseline;
      gap: 8px;
    }

    .rationale-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
    }

    .rationale-label {
      font-size: 13px;
      color: #64748b;
    }

    .category-coverage {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .category-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }

    .category-name {
      color: #475569;
    }

    .category-count {
      font-weight: 600;
      color: #0f172a;
      background: #f1f5f9;
      padding: 1px 8px;
      border-radius: 10px;
      font-size: 11px;
    }

    /* Risk summary */
    .risk-summary {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .risk-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }

    .risk-stat-label {
      color: #64748b;
    }

    .risk-stat-value {
      font-weight: 600;
      color: #0f172a;
    }

    .risk-stat-value.risk-alert {
      color: #ef4444;
    }

    .risk-stat-value.risk-review {
      color: #f59e0b;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #e2e8f0;
    }

    .empty-state-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
      margin-bottom: 12px;
    }

    .empty-state-title {
      font-size: 16px;
      font-weight: 600;
      color: #475569;
      margin: 0 0 4px 0;
    }

    .empty-state-text {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }

    @media (max-width: 1100px) {
      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 700px) {
      .metrics-grid {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class ReadinessDashboardComponent implements OnInit {
  private complianceService = inject(ComplianceService);

  metrics: ReadinessMetrics | null = null;
  loading = true;
  categoryEntries: [string, number][] = [];
  topActions: PriorityAction[] = [];

  ngOnInit() {
    this.loadMetrics();
  }

  loadMetrics() {
    this.loading = true;
    this.complianceService.getReadiness().subscribe({
      next: (data) => {
        this.metrics = data;
        this.categoryEntries = Object.entries(data.rationaleLibrary.categoryCoverage);
        this.topActions = this.computeTopActions(data);
        this.loading = false;
      },
      error: () => {
        this.metrics = null;
        this.loading = false;
      },
    });
  }

  getScoreColorClass(score: number): string {
    if (score >= 80) return 'color-green';
    if (score >= 40) return 'color-amber';
    return 'color-red';
  }

  getColorClass(pct: number): string {
    if (pct >= 80) return 'color-green';
    if (pct >= 40) return 'color-amber';
    return 'color-red';
  }

  getStatusLabel(pct: number): string {
    if (pct >= 80) return 'On Track';
    if (pct >= 40) return 'In Progress';
    return 'Needs Attention';
  }

  getRiskColorClass(): string {
    if (!this.metrics) return 'color-red';
    if (!this.metrics.riskAnalysis.lastRunAt) return 'color-red';
    if (this.metrics.riskAnalysis.alertCount > 0) return 'color-red';
    if (this.metrics.riskAnalysis.reviewCount > 0) return 'color-amber';
    return 'color-green';
  }

  getRiskStatusLabel(): string {
    if (!this.metrics || !this.metrics.riskAnalysis.lastRunAt) return 'Not Started';
    if (this.metrics.riskAnalysis.alertCount > 0) return 'Alerts Present';
    if (this.metrics.riskAnalysis.reviewCount > 0) return 'Review Needed';
    return 'All Clear';
  }

  formatCategory(category: string): string {
    return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private computeTopActions(m: ReadinessMetrics): PriorityAction[] {
    const actions: PriorityAction[] = [];
    const missing = (covered: number, total: number) => total - covered;

    const pdMissing = missing(m.payDecisionDocumentation.covered, m.payDecisionDocumentation.total);
    if (pdMissing > 0) {
      actions.push({
        icon: 'gavel',
        title: `Document pay decisions for ${pdMissing} employee${pdMissing !== 1 ? 's' : ''}`,
        description: 'Finalised pay decisions are required to demonstrate structured, objective decision-making for every employee.',
        link: '/employees',
        queryParams: { filter: 'no-decisions' },
        weight: (100 - m.payDecisionDocumentation.percentage) * 0.25,
      });
    }

    const srMissing = missing(m.salaryRangeCoverage.covered, m.salaryRangeCoverage.total);
    if (srMissing > 0) {
      actions.push({
        icon: 'paid',
        title: `Define salary ranges for ${srMissing} comparator group${srMissing !== 1 ? 's' : ''}`,
        description: 'Salary ranges are required for pay transparency disclosures and compa-ratio analysis.',
        link: '/settings/salary-ranges',
        weight: (100 - m.salaryRangeCoverage.percentage) * 0.20,
      });
    }

    if (!m.riskAnalysis.lastRunAt) {
      actions.push({
        icon: 'monitoring',
        title: 'Run a pay gap risk analysis',
        description: 'Identify comparator groups that may exceed the 5% gender pay gap threshold before your reporting deadline.',
        link: '/risk',
        weight: 15,
      });
    } else if (m.riskAnalysis.alertCount > 0) {
      actions.push({
        icon: 'monitoring',
        title: `Review ${m.riskAnalysis.alertCount} pay gap alert${m.riskAnalysis.alertCount !== 1 ? 's' : ''}`,
        description: 'Groups with gaps at or above 5% require documented review and remediation planning.',
        link: '/risk',
        weight: m.riskAnalysis.alertCount * 5,
      });
    }

    const gdMissing = missing(m.genderDataCoverage.covered, m.genderDataCoverage.total);
    if (gdMissing > 0) {
      actions.push({
        icon: 'wc',
        title: `Add gender data for ${gdMissing} employee${gdMissing !== 1 ? 's' : ''}`,
        description: 'Gender data is required for pay gap calculations. Update records via CSV re-import.',
        link: '/imports/new',
        weight: (100 - m.genderDataCoverage.percentage) * 0.15,
      });
    }

    const clMissing = missing(m.classificationCoverage.covered, m.classificationCoverage.total);
    if (clMissing > 0) {
      actions.push({
        icon: 'category',
        title: `Confirm classifications for ${clMissing} role${clMissing !== 1 ? 's' : ''}`,
        description: 'Confirmed role classifications support equal work comparisons required by the directive.',
        link: '/employees',
        queryParams: { filter: 'no-classification' },
        weight: (100 - m.classificationCoverage.percentage) * 0.10,
      });
    }

    return actions.sort((a, b) => b.weight - a.weight).slice(0, 3);
  }
}

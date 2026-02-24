import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Subscription, interval, forkJoin } from 'rxjs';
import { switchMap, filter, take } from 'rxjs/operators';
import { ApiService } from '../core/api.service';
import {
  RiskReportVisualComponent,
  StructuredRiskReport,
} from './risk-report-visual.component';
import { RiskRegressionComponent } from './risk-regression.component';

interface AiReportListItem {
  id: string;
  summary: string;
  reportData?: StructuredRiskReport;
  model: string;
  generatedAt: string;
  riskRunId: string;
  riskRun: {
    id: string;
    startedAt: string;
    finishedAt: string;
    triggeredBy: string;
    importJobId: string | null;
    importJob: { id: string; createdAt: string; createdCount: number; updatedCount: number } | null;
  };
}

@Component({
  selector: 'app-risk-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatTabsModule,
    RiskReportVisualComponent,
    RiskRegressionComponent,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Risk Radar</h1>
          <p class="page-description">Pay gap risk analysis across comparator groups</p>
        </div>
        <div class="header-actions">
          @if (lastRunAt) {
            <span class="last-run">Last analysis: {{ lastRunAt | date:'medium' }}</span>
          }
          <button mat-raised-button color="primary" (click)="triggerRun()" [disabled]="running">
            <mat-icon>{{ running ? 'hourglass_empty' : (lastRunAt ? 'refresh' : 'play_arrow') }}</mat-icon>
            {{ running ? 'Running...' : (lastRunAt ? 'Re-run Analysis' : 'Run Analysis') }}
          </button>
        </div>
      </div>

      <div class="disclaimer-banner">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>
          This information supports internal governance and transparency requirements.
          It does not constitute legal advice.
        </span>
      </div>

      @if (allGroups.length > 0) {
        <!-- Summary cards -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <div class="summary-value">{{ allGroups.length }}</div>
            <div class="summary-label">Comparator Groups</div>
          </mat-card>
          <mat-card class="summary-card green">
            <div class="summary-value">{{ countByRisk('WITHIN_EXPECTED_RANGE') }}</div>
            <div class="summary-label">Within Range</div>
          </mat-card>
          <mat-card class="summary-card amber">
            <div class="summary-value">{{ countByRisk('REQUIRES_REVIEW') }}</div>
            <div class="summary-label">Requires Review</div>
          </mat-card>
          <mat-card class="summary-card red">
            <div class="summary-value">{{ countByRisk('THRESHOLD_ALERT') }}</div>
            <div class="summary-label">Threshold Alerts</div>
          </mat-card>
        </div>

        <!-- Tabbed sections -->
        <mat-tab-group class="content-tabs" animationDuration="150ms">

          <!-- Report tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">bar_chart</mat-icon>
              Report
            </ng-template>

            <div class="tab-content">
              <mat-card class="report-card">
                <div class="report-header">
                  <div class="report-title-row">
                    <mat-icon class="report-icon">bar_chart</mat-icon>
                    <h2>Risk Analysis Report</h2>
                  </div>
                  <div class="report-header-actions">
                    @if (reports.length > 0) {
                      <button mat-button (click)="historyExpanded = !historyExpanded">
                        <mat-icon>history</mat-icon>
                        History ({{ reports.length }})
                      </button>
                    }
                    <button mat-stroked-button (click)="generateReport()" [disabled]="reportLoading">
                      <mat-icon>{{ reportLoading ? 'hourglass_empty' : 'refresh' }}</mat-icon>
                      {{ reportLoading ? 'Generating...' : (reports.length > 0 ? 'Regenerate' : 'Generate Report') }}
                    </button>
                  </div>
                </div>

                @if (reportLoading) {
                  <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                  <p class="loading-text">Building risk analysis report...</p>
                }

                @if (reportError) {
                  <div class="report-error">
                    <mat-icon>error_outline</mat-icon>
                    <span>{{ reportError }}</span>
                  </div>
                }

                @if (activeReport && !reportLoading && isReportStale()) {
                  <div class="stale-banner">
                    <mat-icon class="stale-icon">update</mat-icon>
                    <span>Risk data has been updated since this report was generated. Regenerate to reflect the latest analysis.</span>
                  </div>
                }

                @if (historyExpanded && reports.length > 0) {
                  <div class="history-panel">
                    <table mat-table [dataSource]="reports" class="history-table">
                      <ng-container matColumnDef="generatedAt">
                        <th mat-header-cell *matHeaderCellDef>Generated</th>
                        <td mat-cell *matCellDef="let r">{{ r.generatedAt | date:'medium' }}</td>
                      </ng-container>
                      <ng-container matColumnDef="model">
                        <th mat-header-cell *matHeaderCellDef>Source</th>
                        <td mat-cell *matCellDef="let r">
                          <span class="model-badge">{{ r.model === 'deterministic' ? 'Deterministic' : r.model }}</span>
                        </td>
                      </ng-container>
                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let r">
                          <button mat-button color="primary" (click)="viewReport(r); $event.stopPropagation()">
                            <mat-icon>visibility</mat-icon>
                            {{ activeReport?.id === r.id ? 'Viewing' : 'View' }}
                          </button>
                        </td>
                      </ng-container>
                      <tr mat-header-row *matHeaderRowDef="historyColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: historyColumns;"
                          class="clickable-row"
                          [class.active-row]="activeReport?.id === row.id"
                          (click)="viewReport(row)"></tr>
                    </table>
                  </div>
                }

                @if (activeReport && !reportLoading) {
                  <app-risk-report-visual
                    [reportData]="activeReportData"
                    [generatedAt]="activeReport.generatedAt"
                    [model]="activeReport.model"
                    [aiEnhanced]="activeReport.model !== 'deterministic'"
                  />
                  <div class="report-meta">
                    <span>Generated {{ activeReport.generatedAt | date:'medium' }}</span>
                    <span class="model-badge">{{ activeReport.model === 'deterministic' ? 'Deterministic' : activeReport.model }}</span>
                  </div>
                }

                @if (!activeReport && !reportLoading && !reportError) {
                  <div class="report-placeholder">
                    <mat-icon class="placeholder-icon">analytics</mat-icon>
                    <p>Click <strong>Generate Report</strong> to build a structured risk analysis from the current data.</p>
                    <p class="placeholder-sub">Works without AI configuration — AI enriches the narrative if configured.</p>
                  </div>
                }
              </mat-card>
            </div>
          </mat-tab>

          <!-- Regression tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">show_chart</mat-icon>
              Regression
            </ng-template>
            <div class="tab-content">
              <app-risk-regression [hasRiskData]="allGroups.length > 0" />
            </div>
          </mat-tab>

          <!-- Analysis tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">table_chart</mat-icon>
              Analysis
            </ng-template>
            <div class="tab-content">
              <div class="filter-row">
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Country</mat-label>
                  <mat-select [(ngModel)]="filterCountry" (selectionChange)="applyFilters()">
                    <mat-option [value]="''">All</mat-option>
                    @for (c of countryOptions; track c) {
                      <mat-option [value]="c">{{ c }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Level</mat-label>
                  <mat-select [(ngModel)]="filterLevel" (selectionChange)="applyFilters()">
                    <mat-option [value]="''">All</mat-option>
                    @for (l of levelOptions; track l) {
                      <mat-option [value]="l">{{ l }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Risk State</mat-label>
                  <mat-select [(ngModel)]="filterRiskState" (selectionChange)="applyFilters()">
                    <mat-option [value]="''">All</mat-option>
                    <mat-option value="WITHIN_EXPECTED_RANGE">Within Range</mat-option>
                    <mat-option value="REQUIRES_REVIEW">Requires Review</mat-option>
                    <mat-option value="THRESHOLD_ALERT">Threshold Alert</mat-option>
                  </mat-select>
                </mat-form-field>
                @if (filterCountry || filterLevel || filterRiskState) {
                  <button mat-button (click)="clearFilters()">
                    <mat-icon>clear</mat-icon>
                    Clear
                  </button>
                }
              </div>

              <table mat-table [dataSource]="filteredGroups">
                <ng-container matColumnDef="groupKey">
                  <th mat-header-cell *matHeaderCellDef>Group</th>
                  <td mat-cell *matCellDef="let g">
                    <span class="group-key">{{ g.groupKey }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="country">
                  <th mat-header-cell *matHeaderCellDef>Country</th>
                  <td mat-cell *matCellDef="let g">{{ g.country }}</td>
                </ng-container>
                <ng-container matColumnDef="jobFamily">
                  <th mat-header-cell *matHeaderCellDef>Job Family</th>
                  <td mat-cell *matCellDef="let g">{{ g.jobFamily || g.roleTitleFallback || '\u2014' }}</td>
                </ng-container>
                <ng-container matColumnDef="level">
                  <th mat-header-cell *matHeaderCellDef>Level</th>
                  <td mat-cell *matCellDef="let g">
                    <span class="level-badge">{{ g.level }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="gapPct">
                  <th mat-header-cell *matHeaderCellDef>Gap %</th>
                  <td mat-cell *matCellDef="let g">
                    <span class="gap-value" [class.gap-high]="mathAbs(g.gapPct) >= 5" [class.gap-warn]="mathAbs(g.gapPct) >= 4 && mathAbs(g.gapPct) < 5">
                      {{ g.gapPct > 0 ? '+' : '' }}{{ g.gapPct | number:'1.1-1' }}%
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="riskState">
                  <th mat-header-cell *matHeaderCellDef>Risk State</th>
                  <td mat-cell *matCellDef="let g">
                    <span class="risk-chip" [class]="'risk-chip risk-' + g.riskState.toLowerCase()">
                      {{ formatRiskState(g.riskState) }}
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="womenCount">
                  <th mat-header-cell *matHeaderCellDef>Women</th>
                  <td mat-cell *matCellDef="let g">{{ g.womenCount }}</td>
                </ng-container>
                <ng-container matColumnDef="menCount">
                  <th mat-header-cell *matHeaderCellDef>Men</th>
                  <td mat-cell *matCellDef="let g">{{ g.menCount }}</td>
                </ng-container>
                <ng-container matColumnDef="notes">
                  <th mat-header-cell *matHeaderCellDef>Notes</th>
                  <td mat-cell *matCellDef="let g">
                    <span class="notes-text">{{ g.notes || '' }}</span>
                  </td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                    class="clickable-row"
                    (click)="navigateToGroup(row.groupKey)"></tr>
              </table>
            </div>
          </mat-tab>

        </mat-tab-group>

      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">monitoring</mat-icon>
          <p class="empty-state-title">No risk analysis results</p>
          <p class="empty-state-text">Run an analysis to generate pay gap risk results across comparator groups</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 20px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .last-run {
      font-size: 13px;
      color: #64748b;
      white-space: nowrap;
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

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }

    .summary-card {
      padding: 20px !important;
      text-align: center;
    }

    .summary-card.green { border-top: 3px solid #10b981; }
    .summary-card.amber { border-top: 3px solid #f59e0b; }
    .summary-card.red { border-top: 3px solid #ef4444; }

    .summary-value {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 6px;
    }

    .summary-label {
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }

    /* Tabs */
    .content-tabs {
      background: transparent;

      ::ng-deep .mat-mdc-tab-header {
        margin-bottom: 0;
        background: #fff;
        border-radius: 8px 8px 0 0;
        border: 1px solid #e2e8f0;
        border-bottom: none;
      }

      ::ng-deep .mat-mdc-tab-body-wrapper {
        border: 1px solid #e2e8f0;
        border-radius: 0 0 8px 8px;
        background: #fff;
      }
    }

    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      vertical-align: middle;
    }

    .tab-content {
      padding: 24px;
    }

    /* Report card */
    .report-card {
      padding: 24px !important;
      box-shadow: none !important;
      border: none !important;
    }

    .report-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .report-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .report-title-row h2 {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .report-icon {
      color: #6366f1;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .report-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .loading-text {
      font-size: 13px;
      color: #64748b;
      margin: 10px 0 0 0;
    }

    .report-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b91c1c;
      font-size: 14px;
      margin-top: 8px;
    }

    .stale-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 13px;
      color: #92400e;
      margin-bottom: 16px;
    }

    .stale-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #d97706;
      flex-shrink: 0;
    }

    /* Report history */
    .history-panel {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .history-table { width: 100%; }

    .active-row { background: #f5f3ff !important; }

    .model-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #4338ca;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    /* Report placeholder */
    .report-placeholder {
      text-align: center;
      padding: 32px 16px;
      color: #64748b;
    }

    .placeholder-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #cbd5e1;
      margin-bottom: 12px;
    }

    .report-placeholder p { margin: 0 0 6px 0; font-size: 14px; }

    .placeholder-sub { font-size: 12px; color: #94a3b8; }

    .report-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }

    /* Filters & table */
    .filter-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      margin-top: 0;
    }

    .filter-field { width: 180px; }

    .group-key {
      font-family: 'Inter', monospace;
      font-size: 13px;
      color: #64748b;
    }

    .level-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .gap-value {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .gap-warn { color: #b45309; }
    .gap-high { color: #b91c1c; }

    .notes-text {
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
    }

    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f8fafc; }

    .empty-state {
      text-align: center;
      padding: 60px 24px;
      color: #64748b;
    }

    .empty-state-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
      margin-bottom: 16px;
    }

    .empty-state-title {
      font-size: 18px;
      font-weight: 600;
      color: #374151;
      margin: 0 0 8px 0;
    }

    .empty-state-text {
      font-size: 14px;
      color: #9ca3af;
      margin: 0;
    }
  `],
})
export class RiskDashboardComponent implements OnInit, OnDestroy {
  allGroups: any[] = [];
  filteredGroups: any[] = [];
  running = false;
  lastRunAt: string | null = null;
  displayedColumns = ['groupKey', 'country', 'jobFamily', 'level', 'gapPct', 'riskState', 'womenCount', 'menCount', 'notes'];

  // Filter state
  filterCountry = '';
  filterLevel = '';
  filterRiskState = '';
  countryOptions: string[] = [];
  levelOptions: string[] = [];

  // Report state
  activeReport: AiReportListItem | null = null;
  activeReportData: StructuredRiskReport | null = null;
  reportLoading = false;
  reportError: string | null = null;
  reports: AiReportListItem[] = [];
  historyColumns = ['generatedAt', 'model', 'actions'];
  historyExpanded = false;

  mathAbs = Math.abs;

  private pollSub?: Subscription;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
  }

  loadData() {
    forkJoin({
      latest: this.api.get<any>('/risk/latest'),
      reports: this.api.get<AiReportListItem[]>('/risk/reports'),
    }).subscribe((data) => {
      this.allGroups = data.latest?.groups ?? [];
      this.lastRunAt = data.latest?.run?.finishedAt ?? null;
      this.buildFilterOptions();
      this.applyFilters();

      this.reports = data.reports ?? [];
      if (!this.activeReport && this.reports.length > 0) {
        this.viewReport(this.reports[0]!);
      }

      this.cdr.detectChanges();
    });
  }

  buildFilterOptions() {
    this.countryOptions = [...new Set(this.allGroups.map((g: any) => g.country as string))].sort();
    this.levelOptions = [...new Set(this.allGroups.map((g: any) => g.level as string))].sort();
  }

  applyFilters() {
    this.filteredGroups = this.allGroups.filter((g: any) => {
      if (this.filterCountry && g.country !== this.filterCountry) return false;
      if (this.filterLevel && g.level !== this.filterLevel) return false;
      if (this.filterRiskState && g.riskState !== this.filterRiskState) return false;
      return true;
    });
  }

  clearFilters() {
    this.filterCountry = '';
    this.filterLevel = '';
    this.filterRiskState = '';
    this.applyFilters();
  }

  triggerRun() {
    this.running = true;
    this.api.post<any>('/risk/run', {}).subscribe({
      next: (res) => this.pollForCompletion(res.riskRunId),
      error: () => (this.running = false),
    });
  }

  private pollForCompletion(runId: string) {
    this.pollSub?.unsubscribe();
    this.pollSub = interval(1500)
      .pipe(
        switchMap(() => this.api.get<any>(`/risk/runs/${runId}`)),
        filter((result) => {
          const status = result?.run?.status;
          return status === 'COMPLETED' || status === 'FAILED';
        }),
        take(1),
      )
      .subscribe({
        next: (data) => {
          this.allGroups = data?.groups ?? [];
          this.lastRunAt = data?.run?.finishedAt ?? null;
          this.buildFilterOptions();
          this.applyFilters();
          this.running = false;
          this.activeReport = null;
          this.activeReportData = null;
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadData();
          this.running = false;
          this.cdr.detectChanges();
        },
      });

    setTimeout(() => {
      if (this.running) {
        this.pollSub?.unsubscribe();
        this.loadData();
        this.running = false;
      }
    }, 60000);
  }

  generateReport() {
    this.reportLoading = true;
    this.reportError = null;
    this.cdr.markForCheck();
    this.api.post<AiReportListItem>('/risk/analyze', {}).subscribe({
      next: (report) => {
        this.activeReport = report;
        this.activeReportData = this.extractReportData(report);
        this.reportLoading = false;
        this.reports = [report, ...this.reports];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.reportError = err?.error?.error || 'Failed to generate report.';
        this.reportLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewReport(report: AiReportListItem) {
    this.activeReport = report;
    this.activeReportData = this.extractReportData(report);
    this.reportError = null;
    this.cdr.detectChanges();
  }

  private extractReportData(report: AiReportListItem): StructuredRiskReport | null {
    if (report.reportData) return report.reportData;
    if (report.summary) {
      try {
        const parsed = JSON.parse(report.summary);
        if (parsed?.executiveSummary) return parsed as StructuredRiskReport;
      } catch {
        // Legacy markdown — cannot render visually
      }
    }
    return null;
  }

  navigateToGroup(groupKey: string) {
    this.router.navigate(['/risk/groups', groupKey]);
  }

  isReportStale(): boolean {
    if (!this.activeReport || !this.lastRunAt) return false;
    return new Date(this.lastRunAt) > new Date(this.activeReport.generatedAt);
  }

  countByRisk(state: string): number {
    return this.allGroups.filter((g) => g.riskState === state).length;
  }

  formatRiskState(state: string): string {
    return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

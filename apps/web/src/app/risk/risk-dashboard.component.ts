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
import { Subscription, interval, forkJoin } from 'rxjs';
import { switchMap, filter, take } from 'rxjs/operators';
import { ApiService } from '../core/api.service';

interface AiReportListItem {
  id: string;
  summary: string;
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
            <mat-icon>{{ running ? 'hourglass_empty' : 'play_arrow' }}</mat-icon>
            {{ running ? 'Running...' : 'Run Analysis' }}
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

        <!-- AI Analysis Section -->
        <mat-card class="ai-analysis-card">
          <div class="ai-header">
            <div class="ai-title-row">
              <mat-icon class="ai-icon">psychology</mat-icon>
              <h2>AI Risk Report</h2>
            </div>
            <button mat-stroked-button (click)="generateAiReport()" [disabled]="aiLoading">
              <mat-icon>{{ aiLoading ? 'hourglass_empty' : 'auto_awesome' }}</mat-icon>
              {{ aiLoading ? 'Generating...' : (activeReport ? 'Regenerate' : 'Generate Report') }}
            </button>
          </div>
          @if (aiLoading) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p class="ai-loading-text">Analyzing risk data with AI...</p>
          }
          @if (aiError) {
            <div class="ai-error">
              <mat-icon>error_outline</mat-icon>
              <span>{{ aiError }}</span>
            </div>
          }
          @if (activeReport && !aiLoading) {
            <div class="ai-report-content" [innerHTML]="renderedReport"></div>
            <div class="ai-meta">
              <span>Generated {{ activeReport.generatedAt | date:'medium' }}</span>
              <span class="ai-model-badge">{{ activeReport.model }}</span>
              @if (getReportSource(activeReport)) {
                <span class="ai-source-badge">{{ getReportSource(activeReport) }}</span>
              }
            </div>
          }
          @if (!activeReport && !aiLoading && !aiError) {
            <p class="ai-placeholder">Click "Generate Report" to get an AI-powered analysis of the current risk data.</p>
          }
        </mat-card>

        <!-- Report History -->
        @if (reports.length > 0) {
          <mat-card class="report-history-card">
            <div class="report-history-header">
              <div class="ai-title-row">
                <mat-icon class="history-icon">history</mat-icon>
                <h2>Report History</h2>
              </div>
              <span class="report-count">{{ reports.length }} report{{ reports.length !== 1 ? 's' : '' }}</span>
            </div>
            <table mat-table [dataSource]="reports" class="report-table">
              <ng-container matColumnDef="generatedAt">
                <th mat-header-cell *matHeaderCellDef>Generated</th>
                <td mat-cell *matCellDef="let r">{{ r.generatedAt | date:'medium' }}</td>
              </ng-container>
              <ng-container matColumnDef="model">
                <th mat-header-cell *matHeaderCellDef>Model</th>
                <td mat-cell *matCellDef="let r">
                  <span class="ai-model-badge">{{ r.model }}</span>
                </td>
              </ng-container>
              <ng-container matColumnDef="source">
                <th mat-header-cell *matHeaderCellDef>Data Source</th>
                <td mat-cell *matCellDef="let r">
                  <span class="source-label">{{ getReportSource(r) }}</span>
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
              <tr mat-header-row *matHeaderRowDef="reportColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: reportColumns;"
                  class="clickable-row"
                  [class.active-report-row]="activeReport?.id === row.id"
                  (click)="viewReport(row)"></tr>
            </table>
          </mat-card>
        }

        <!-- Filters -->
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
              <span class="gap-value" [class.gap-high]="g.gapPct >= 5" [class.gap-warn]="g.gapPct >= 4 && g.gapPct < 5">
                {{ g.gapPct | number:'1.1-1' }}%
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

    .summary-card.green {
      border-top: 3px solid #10b981;
    }

    .summary-card.amber {
      border-top: 3px solid #f59e0b;
    }

    .summary-card.red {
      border-top: 3px solid #ef4444;
    }

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

    /* AI Analysis Card */
    .ai-analysis-card {
      padding: 24px !important;
      margin-bottom: 24px;
      border: 1px solid #e0e7ff;
      background: linear-gradient(135deg, #fafafe 0%, #f5f3ff 100%);
    }

    .ai-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .ai-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .ai-title-row h2 {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .ai-icon {
      color: #6366f1;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .ai-loading-text {
      font-size: 13px;
      color: #64748b;
      margin: 12px 0 0 0;
    }

    .ai-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #b91c1c;
      font-size: 14px;
      margin-top: 8px;
    }

    .ai-error mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .ai-report-content {
      font-size: 14px;
      line-height: 1.7;
      color: #1e293b;
      white-space: pre-wrap;
    }

    :host ::ng-deep .ai-report-content h1,
    :host ::ng-deep .ai-report-content h2,
    :host ::ng-deep .ai-report-content h3 {
      font-size: 15px;
      font-weight: 600;
      color: #0f172a;
      margin: 16px 0 8px 0;
    }

    :host ::ng-deep .ai-report-content h1:first-child,
    :host ::ng-deep .ai-report-content h2:first-child {
      margin-top: 0;
    }

    :host ::ng-deep .ai-report-content ul,
    :host ::ng-deep .ai-report-content ol {
      margin: 4px 0 12px 0;
      padding-left: 20px;
    }

    :host ::ng-deep .ai-report-content li {
      margin-bottom: 4px;
    }

    :host ::ng-deep .ai-report-content p {
      margin: 0 0 10px 0;
    }

    :host ::ng-deep .ai-report-content strong {
      color: #0f172a;
    }

    .ai-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
    }

    .ai-model-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #e0e7ff;
      color: #4338ca;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .ai-source-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #ecfdf5;
      color: #047857;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .ai-placeholder {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }

    /* Report History Card */
    .report-history-card {
      padding: 24px !important;
      margin-bottom: 24px;
    }

    .report-history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .history-icon {
      color: #64748b;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .report-count {
      font-size: 13px;
      color: #94a3b8;
    }

    .report-table {
      width: 100%;
    }

    .source-label {
      font-size: 13px;
      color: #475569;
    }

    .active-report-row {
      background: #f5f3ff !important;
    }

    .filter-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }

    .filter-field {
      width: 180px;
    }

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

    .gap-warn {
      color: #b45309;
    }

    .gap-high {
      color: #b91c1c;
    }

    .notes-text {
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f8fafc;
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

  // AI analysis state
  activeReport: AiReportListItem | null = null;
  aiLoading = false;
  aiError: string | null = null;
  renderedReport = '';

  // Report history
  reports: AiReportListItem[] = [];
  reportColumns = ['generatedAt', 'model', 'source', 'actions'];

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
      // Show the latest report by default if no report is currently active
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
          // Clear active report since data changed
          this.activeReport = null;
          this.renderedReport = '';
          this.cdr.detectChanges();
        },
        error: () => {
          this.loadData();
          this.running = false;
          this.cdr.detectChanges();
        },
      });

    // Safety timeout after 60 seconds
    setTimeout(() => {
      if (this.running) {
        this.pollSub?.unsubscribe();
        this.loadData();
        this.running = false;
      }
    }, 60000);
  }

  generateAiReport() {
    this.aiLoading = true;
    this.aiError = null;
    this.cdr.markForCheck();
    this.api.post<AiReportListItem>('/risk/analyze', {}).subscribe({
      next: (report) => {
        this.activeReport = report;
        this.renderedReport = this.markdownToHtml(report.summary);
        this.aiLoading = false;
        // Prepend to report history
        this.reports = [report, ...this.reports];
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.aiError = err?.error?.error || 'Failed to generate AI analysis. Ensure Ollama is running.';
        this.aiLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  viewReport(report: AiReportListItem) {
    this.activeReport = report;
    this.renderedReport = this.markdownToHtml(report.summary);
    this.aiError = null;
    this.cdr.detectChanges();
  }

  getReportSource(report: AiReportListItem): string {
    if (report.riskRun?.importJob) {
      const job = report.riskRun.importJob;
      return `Import (${job.createdCount ?? 0} created, ${job.updatedCount ?? 0} updated)`;
    }
    if (report.riskRun?.triggeredBy === 'SYSTEM') {
      return 'Scheduled';
    }
    return 'Manual trigger';
  }

  navigateToGroup(groupKey: string) {
    this.router.navigate(['/risk/groups', groupKey]);
  }

  countByRisk(state: string): number {
    return this.allGroups.filter((g) => g.riskState === state).length;
  }

  formatRiskState(state: string): string {
    return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /** Simple markdown to HTML for the AI report */
  private markdownToHtml(md: string): string {
    return md
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Unordered list items
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      // Numbered list items
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      // Paragraphs (lines that aren't already wrapped)
      .replace(/^(?!<[hulo])((?!<).+)$/gm, '<p>$1</p>')
      // Clean up empty lines
      .replace(/\n{2,}/g, '\n');
  }
}

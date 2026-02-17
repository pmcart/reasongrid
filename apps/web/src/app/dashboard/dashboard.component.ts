import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';

interface DashboardSummary {
  employees: { total: number; withDecisions: number; withoutDecisions: number };
  decisions: {
    total: number;
    draft: number;
    finalised: number;
    byType: Record<string, number>;
    recent: {
      id: string;
      decisionType: string;
      effectiveDate: string;
      payBeforeBase: number;
      payAfterBase: number;
      status: string;
      finalisedAt: string;
      employee: { id: string; employeeId: string; roleTitle: string };
    }[];
  };
  risk: {
    lastRunAt: string | null;
    groups: { total: number; withinRange: number; requiresReview: number; thresholdAlert: number };
    avgGapPct: number | null;
    highestGapGroup: { groupKey: string; gapPct: number; riskState: string; country: string; jobFamily: string | null; level: string } | null;
  };
  rationales: { total: number; byCategory: Record<string, number> };
  recentActivity: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
    user: { email: string } | null;
  }[];
  aiInsight: { id: string; summary: string; generatedAt: string; model: string } | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Dashboard</h1>
          <p class="page-description">Overview of your compensation governance metrics</p>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading dashboard...</p>
        </div>
      } @else if (data) {
        <!-- Summary Cards -->
        <div class="summary-grid">
          <mat-card class="summary-card" (click)="router.navigate(['/employees'])">
            <div class="card-icon-row">
              <mat-icon class="card-icon people">people</mat-icon>
            </div>
            <div class="summary-value">{{ data.employees.total }}</div>
            <div class="summary-label">Employees</div>
            <div class="summary-sub">
              <span class="sub-good">{{ data.employees.withDecisions }} with decisions</span>
              @if (data.employees.withoutDecisions > 0) {
                <span class="sub-neutral">{{ data.employees.withoutDecisions }} without</span>
              }
            </div>
          </mat-card>

          <mat-card class="summary-card" (click)="router.navigate(['/employees'])">
            <div class="card-icon-row">
              <mat-icon class="card-icon decisions">gavel</mat-icon>
            </div>
            <div class="summary-value">{{ data.decisions.total }}</div>
            <div class="summary-label">Pay Decisions</div>
            <div class="summary-sub">
              <span class="sub-good">{{ data.decisions.finalised }} finalised</span>
              @if (data.decisions.draft > 0) {
                <span class="sub-neutral">{{ data.decisions.draft }} draft</span>
              }
            </div>
          </mat-card>

          <mat-card class="summary-card" (click)="router.navigate(['/risk'])">
            <div class="card-icon-row">
              <mat-icon class="card-icon risk">monitoring</mat-icon>
            </div>
            <div class="summary-value">{{ data.risk.groups.total }}</div>
            <div class="summary-label">Risk Groups</div>
            <div class="summary-sub risk-chips">
              @if (data.risk.groups.withinRange > 0) {
                <span class="risk-chip green">{{ data.risk.groups.withinRange }} OK</span>
              }
              @if (data.risk.groups.requiresReview > 0) {
                <span class="risk-chip amber">{{ data.risk.groups.requiresReview }} Review</span>
              }
              @if (data.risk.groups.thresholdAlert > 0) {
                <span class="risk-chip red">{{ data.risk.groups.thresholdAlert }} Alert</span>
              }
              @if (data.risk.groups.total === 0) {
                <span class="sub-neutral">No analysis yet</span>
              }
            </div>
          </mat-card>

          <mat-card class="summary-card" (click)="router.navigate(['/rationale-library'])">
            <div class="card-icon-row">
              <mat-icon class="card-icon rationale">menu_book</mat-icon>
            </div>
            <div class="summary-value">{{ data.rationales.total }}</div>
            <div class="summary-label">Active Rationales</div>
            <div class="summary-sub">
              @for (entry of categoryEntries; track entry[0]) {
                <span class="sub-neutral">{{ entry[1] }} {{ entry[0] | lowercase }}</span>
              }
            </div>
          </mat-card>
        </div>

        <!-- Two column layout for Risk + AI Insight -->
        <div class="two-col">
          <!-- Risk Overview -->
          <mat-card class="section-card">
            <div class="section-header">
              <div class="section-title-row">
                <mat-icon class="section-icon">monitoring</mat-icon>
                <h2>Risk Overview</h2>
              </div>
              <a mat-button color="primary" routerLink="/risk">
                View Risk Radar
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            @if (data.risk.groups.total > 0) {
              <div class="risk-bar">
                @if (data.risk.groups.withinRange > 0) {
                  <div class="bar-segment green"
                    [style.flex]="data.risk.groups.withinRange"
                    [matTooltip]="data.risk.groups.withinRange + ' within range'">
                  </div>
                }
                @if (data.risk.groups.requiresReview > 0) {
                  <div class="bar-segment amber"
                    [style.flex]="data.risk.groups.requiresReview"
                    [matTooltip]="data.risk.groups.requiresReview + ' requires review'">
                  </div>
                }
                @if (data.risk.groups.thresholdAlert > 0) {
                  <div class="bar-segment red"
                    [style.flex]="data.risk.groups.thresholdAlert"
                    [matTooltip]="data.risk.groups.thresholdAlert + ' threshold alerts'">
                  </div>
                }
              </div>
              <div class="risk-legend">
                <span class="legend-item"><span class="dot green"></span> Within Range</span>
                <span class="legend-item"><span class="dot amber"></span> Requires Review</span>
                <span class="legend-item"><span class="dot red"></span> Threshold Alert</span>
              </div>
              @if (data.risk.highestGapGroup) {
                <div class="highest-gap">
                  <mat-icon class="gap-warning-icon">warning</mat-icon>
                  <div>
                    <span class="gap-label">Highest gap:</span>
                    <strong>{{ data.risk.highestGapGroup.gapPct }}%</strong>
                    in
                    <a [routerLink]="['/risk/groups', data.risk.highestGapGroup.groupKey]" class="group-link">
                      {{ data.risk.highestGapGroup.groupKey }}
                    </a>
                  </div>
                </div>
              }
              @if (data.risk.avgGapPct !== null) {
                <div class="avg-gap">
                  Average gap across groups: <strong>{{ data.risk.avgGapPct }}%</strong>
                </div>
              }
              @if (data.risk.lastRunAt) {
                <div class="last-run-info">
                  Last analysis: {{ data.risk.lastRunAt | date:'medium' }}
                </div>
              }
            } @else {
              <div class="empty-section">
                <mat-icon>info_outline</mat-icon>
                <p>No risk analysis has been run yet. Go to Risk Radar to run your first analysis.</p>
              </div>
            }
          </mat-card>

          <!-- AI Insight -->
          <mat-card class="section-card">
            <div class="section-header">
              <div class="section-title-row">
                <mat-icon class="section-icon">psychology</mat-icon>
                <h2>AI Insight</h2>
              </div>
              <a mat-button color="primary" routerLink="/risk">
                Full Report
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            @if (data.aiInsight) {
              <div class="ai-snippet" [innerHTML]="aiSnippet"></div>
              <div class="ai-meta">
                <span>Generated {{ data.aiInsight.generatedAt | date:'medium' }}</span>
                <span class="ai-model-badge">{{ data.aiInsight.model }}</span>
              </div>
            } @else {
              <div class="empty-section">
                <mat-icon>auto_awesome</mat-icon>
                <p>No AI report generated yet. Generate one from the Risk Radar page.</p>
              </div>
            }
          </mat-card>
        </div>

        <!-- Two column: Recent Decisions + Activity -->
        <div class="two-col">
          <!-- Recent Pay Decisions -->
          <mat-card class="section-card">
            <div class="section-header">
              <div class="section-title-row">
                <mat-icon class="section-icon">gavel</mat-icon>
                <h2>Recent Pay Decisions</h2>
              </div>
            </div>
            @if (data.decisions.recent.length > 0) {
              <table mat-table [dataSource]="data.decisions.recent" class="decisions-table">
                <ng-container matColumnDef="employee">
                  <th mat-header-cell *matHeaderCellDef>Employee</th>
                  <td mat-cell *matCellDef="let d">
                    <div class="emp-name">{{ d.employee.employeeId }}</div>
                    <div class="emp-role">{{ d.employee.roleTitle }}</div>
                  </td>
                </ng-container>
                <ng-container matColumnDef="type">
                  <th mat-header-cell *matHeaderCellDef>Type</th>
                  <td mat-cell *matCellDef="let d">
                    <span class="decision-type-badge" [attr.data-type]="d.decisionType">
                      {{ formatDecisionType(d.decisionType) }}
                    </span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="change">
                  <th mat-header-cell *matHeaderCellDef>Change</th>
                  <td mat-cell *matCellDef="let d">
                    @if (d.payBeforeBase && d.payAfterBase) {
                      <span [class]="d.payAfterBase > d.payBeforeBase ? 'change-up' : 'change-neutral'">
                        {{ formatChange(d.payBeforeBase, d.payAfterBase) }}
                      </span>
                    } @else {
                      <span class="change-neutral">—</span>
                    }
                  </td>
                </ng-container>
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let d">{{ d.effectiveDate | date:'mediumDate' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="decisionColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: decisionColumns;"
                    class="clickable-row"
                    (click)="router.navigate(['/pay-decisions', row.id])"></tr>
              </table>
            } @else {
              <div class="empty-section">
                <mat-icon>description</mat-icon>
                <p>No finalised pay decisions yet.</p>
              </div>
            }
          </mat-card>

          <!-- Recent Activity -->
          <mat-card class="section-card">
            <div class="section-header">
              <div class="section-title-row">
                <mat-icon class="section-icon">history</mat-icon>
                <h2>Recent Activity</h2>
              </div>
              <a mat-button color="primary" routerLink="/audit">
                View All
                <mat-icon>arrow_forward</mat-icon>
              </a>
            </div>
            @if (data.recentActivity.length > 0) {
              <div class="activity-feed">
                @for (a of data.recentActivity; track a.id) {
                  <div class="activity-item">
                    <mat-icon class="activity-icon" [class]="getActivityIconClass(a.action)">
                      {{ getActivityIcon(a.action) }}
                    </mat-icon>
                    <div class="activity-body">
                      <div class="activity-text">{{ formatAction(a.action) }}</div>
                      <div class="activity-meta">
                        @if (a.user) {
                          <span>{{ a.user.email }}</span>
                          <span class="meta-dot"></span>
                        }
                        <span>{{ a.createdAt | date:'short' }}</span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-section">
                <mat-icon>history</mat-icon>
                <p>No recent activity.</p>
              </div>
            }
          </mat-card>
        </div>

        <!-- Decision Type Breakdown -->
        @if (data.decisions.total > 0) {
          <mat-card class="section-card">
            <div class="section-header">
              <div class="section-title-row">
                <mat-icon class="section-icon">pie_chart</mat-icon>
                <h2>Decisions by Type</h2>
              </div>
            </div>
            <div class="type-breakdown">
              @for (entry of decisionTypeEntries; track entry[0]) {
                <div class="type-bar-row">
                  <span class="type-label">{{ formatDecisionType(entry[0]) }}</span>
                  <div class="type-bar-track">
                    <div class="type-bar-fill" [style.width.%]="(entry[1] / data.decisions.total) * 100"></div>
                  </div>
                  <span class="type-count">{{ entry[1] }}</span>
                </div>
              }
            </div>
          </mat-card>
        }
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">dashboard</mat-icon>
          <p class="empty-state-title">No data available</p>
          <p class="empty-state-text">Import employees to get started.</p>
          <button mat-raised-button color="primary" routerLink="/imports/new">
            <mat-icon>upload_file</mat-icon>
            Import Employees
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
    }

    .page-header {
      margin-bottom: 24px;
    }

    .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }

    .page-description {
      font-size: 14px;
      color: #64748b;
      margin: 0;
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

    /* Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      padding: 20px !important;
      cursor: pointer;
      transition: box-shadow 0.15s, transform 0.15s;
      border-radius: 12px !important;
    }

    .summary-card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.1);
      transform: translateY(-2px);
    }

    .card-icon-row {
      margin-bottom: 12px;
    }

    .card-icon {
      width: 40px;
      height: 40px;
      font-size: 20px;
      line-height: 40px;
      text-align: center;
      border-radius: 10px;
    }

    .card-icon.people { background: #eff6ff; color: #3b82f6; }
    .card-icon.decisions { background: #f5f3ff; color: #8b5cf6; }
    .card-icon.risk { background: #fff7ed; color: #f97316; }
    .card-icon.rationale { background: #ecfdf5; color: #10b981; }

    .summary-value {
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
      margin-bottom: 4px;
    }

    .summary-label {
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      margin-bottom: 8px;
    }

    .summary-sub {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
    }

    .sub-good { color: #10b981; }
    .sub-neutral { color: #94a3b8; }

    .risk-chips {
      gap: 6px;
    }

    .risk-chip {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }

    .risk-chip.green { background: #ecfdf5; color: #059669; }
    .risk-chip.amber { background: #fffbeb; color: #d97706; }
    .risk-chip.red { background: #fef2f2; color: #dc2626; }

    /* Two column layout */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .section-card {
      padding: 20px !important;
      border-radius: 12px !important;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title-row h2 {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .section-icon {
      color: #64748b;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Risk bar */
    .risk-bar {
      display: flex;
      height: 12px;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 8px;
      gap: 2px;
    }

    .bar-segment {
      border-radius: 4px;
      min-width: 4px;
    }

    .bar-segment.green { background: #10b981; }
    .bar-segment.amber { background: #f59e0b; }
    .bar-segment.red { background: #ef4444; }

    .risk-legend {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #64748b;
      margin-bottom: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .dot.green { background: #10b981; }
    .dot.amber { background: #f59e0b; }
    .dot.red { background: #ef4444; }

    .highest-gap {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #fef2f2;
      border-radius: 8px;
      font-size: 13px;
      color: #991b1b;
      margin-bottom: 8px;
    }

    .gap-warning-icon {
      color: #ef4444;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .gap-label { color: #64748b; }

    .group-link {
      color: #3b82f6;
      text-decoration: none;
    }

    .group-link:hover { text-decoration: underline; }

    .avg-gap {
      font-size: 13px;
      color: #475569;
      margin-bottom: 4px;
    }

    .last-run-info {
      font-size: 12px;
      color: #94a3b8;
    }

    /* AI Insight */
    .ai-snippet {
      font-size: 13px;
      color: #334155;
      line-height: 1.6;
      max-height: 200px;
      overflow: hidden;
      position: relative;
    }

    .ai-snippet::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 40px;
      background: linear-gradient(transparent, white);
    }

    .ai-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 11px;
      color: #94a3b8;
    }

    .ai-model-badge {
      background: #f1f5f9;
      color: #64748b;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }

    /* Decisions table */
    .decisions-table {
      width: 100%;
    }

    .emp-name {
      font-weight: 500;
      color: #0f172a;
      font-size: 13px;
    }

    .emp-role {
      font-size: 12px;
      color: #94a3b8;
    }

    .decision-type-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: #f1f5f9;
      color: #475569;
    }

    .decision-type-badge[data-type="PROMOTION"] { background: #f5f3ff; color: #7c3aed; }
    .decision-type-badge[data-type="NEW_HIRE"] { background: #ecfdf5; color: #059669; }
    .decision-type-badge[data-type="ANNUAL_INCREASE"] { background: #eff6ff; color: #2563eb; }
    .decision-type-badge[data-type="ADJUSTMENT"] { background: #fffbeb; color: #d97706; }

    .change-up {
      color: #059669;
      font-weight: 600;
      font-size: 13px;
    }

    .change-neutral {
      color: #94a3b8;
      font-size: 13px;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f8fafc;
    }

    /* Activity feed */
    .activity-feed {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .activity-item:last-child {
      border-bottom: none;
    }

    .activity-icon {
      width: 32px;
      height: 32px;
      font-size: 16px;
      line-height: 32px;
      text-align: center;
      border-radius: 8px;
      background: #f1f5f9;
      color: #64748b;
      flex-shrink: 0;
    }

    .activity-icon.activity-employee { background: #eff6ff; color: #3b82f6; }
    .activity-icon.activity-decision { background: #f5f3ff; color: #8b5cf6; }
    .activity-icon.activity-import { background: #ecfdf5; color: #10b981; }
    .activity-icon.activity-risk { background: #fff7ed; color: #f97316; }
    .activity-icon.activity-auth { background: #f1f5f9; color: #64748b; }

    .activity-body {
      flex: 1;
      min-width: 0;
    }

    .activity-text {
      font-size: 13px;
      color: #0f172a;
      font-weight: 500;
    }

    .activity-meta {
      font-size: 12px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .meta-dot {
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #cbd5e1;
    }

    /* Decision type breakdown */
    .type-breakdown {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .type-bar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .type-label {
      width: 140px;
      font-size: 13px;
      color: #475569;
      flex-shrink: 0;
    }

    .type-bar-track {
      flex: 1;
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }

    .type-bar-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 4px;
      min-width: 4px;
      transition: width 0.3s;
    }

    .type-count {
      width: 32px;
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }

    /* Empty states */
    .empty-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      color: #94a3b8;
      text-align: center;
    }

    .empty-section mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      margin-bottom: 8px;
      color: #cbd5e1;
    }

    .empty-section p {
      font-size: 13px;
      margin: 0;
    }

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
      margin: 0 0 16px 0;
    }

    @media (max-width: 900px) {
      .summary-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .two-col {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class DashboardComponent implements OnInit {
  data: DashboardSummary | null = null;
  loading = false;
  aiSnippet = '';

  decisionColumns = ['employee', 'type', 'change', 'date'];
  categoryEntries: [string, number][] = [];
  decisionTypeEntries: [string, number][] = [];

  constructor(
    public router: Router,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.loadDashboard();
  }

  loadDashboard() {
    this.loading = true;
    this.api.get<DashboardSummary>('/dashboard/summary').subscribe({
      next: (data) => {
        this.data = data;
        this.categoryEntries = Object.entries(data.rationales.byCategory);
        this.decisionTypeEntries = Object.entries(data.decisions.byType)
          .sort((a, b) => b[1] - a[1]);
        if (data.aiInsight?.summary) {
          this.aiSnippet = this.extractSnippet(data.aiInsight.summary);
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  formatDecisionType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatChange(before: number, after: number): string {
    const diff = after - before;
    const pct = before > 0 ? ((diff / before) * 100).toFixed(1) : '0.0';
    const sign = diff > 0 ? '+' : '';
    return `${sign}${pct}%`;
  }

  formatAction(action: string): string {
    const map: Record<string, string> = {
      EMPLOYEE_CREATED: 'Employee created',
      EMPLOYEE_UPDATED: 'Employee updated',
      EMPLOYEE_IMPORTED: 'Employees imported',
      PAY_DECISION_CREATED: 'Pay decision created',
      PAY_DECISION_UPDATED: 'Pay decision updated',
      PAY_DECISION_FINALISED: 'Pay decision finalised',
      IMPORT_STARTED: 'Import started',
      IMPORT_COMPLETED: 'Import completed',
      IMPORT_FAILED: 'Import failed',
      RISK_RUN_TRIGGERED: 'Risk analysis triggered',
      RISK_RUN_COMPLETED: 'Risk analysis completed',
      USER_LOGIN: 'User logged in',
      RATIONALE_CREATED: 'Rationale created',
      RATIONALE_UPDATED: 'Rationale updated',
      RATIONALE_ARCHIVED: 'Rationale archived',
    };
    return map[action] ?? action.replace(/_/g, ' ').toLowerCase();
  }

  getActivityIcon(action: string): string {
    if (action.startsWith('EMPLOYEE') || action === 'EMPLOYEE_IMPORTED') return 'person';
    if (action.startsWith('PAY_DECISION')) return 'gavel';
    if (action.startsWith('IMPORT')) return 'upload_file';
    if (action.startsWith('RISK')) return 'monitoring';
    if (action.startsWith('RATIONALE')) return 'menu_book';
    if (action === 'USER_LOGIN') return 'login';
    return 'circle';
  }

  getActivityIconClass(action: string): string {
    if (action.startsWith('EMPLOYEE') || action === 'EMPLOYEE_IMPORTED') return 'activity-employee';
    if (action.startsWith('PAY_DECISION')) return 'activity-decision';
    if (action.startsWith('IMPORT')) return 'activity-import';
    if (action.startsWith('RISK')) return 'activity-risk';
    return 'activity-auth';
  }

  private extractSnippet(markdown: string): string {
    // Take first ~3 lines of meaningful content, strip markdown headers
    const lines = markdown.split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#') && !l.startsWith('---'));
    const snippet = lines.slice(0, 4).join('<br>');
    return snippet;
  }
}

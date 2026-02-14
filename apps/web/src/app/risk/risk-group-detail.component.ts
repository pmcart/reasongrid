import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-risk-group-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatTableModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-container">
      <button mat-button class="back-button" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
        Back to Risk Radar
      </button>

      @if (loading) {
        <div class="loading-state">
          <mat-icon class="loading-icon">hourglass_empty</mat-icon>
          <p>Loading group details...</p>
        </div>
      } @else if (group) {
        <div class="page-header">
          <h1>Comparator Group</h1>
          <span class="group-key-label">{{ group.groupKey }}</span>
        </div>

        <!-- Group summary -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <div class="summary-label">Country</div>
            <div class="summary-value-text">{{ group.country }}</div>
          </mat-card>
          <mat-card class="summary-card">
            <div class="summary-label">{{ group.jobFamily ? 'Job Family' : 'Role Title' }}</div>
            <div class="summary-value-text">{{ group.jobFamily || group.roleTitleFallback || '—' }}</div>
          </mat-card>
          <mat-card class="summary-card">
            <div class="summary-label">Level</div>
            <div class="summary-value-text">{{ group.level }}</div>
          </mat-card>
          <mat-card class="summary-card" [class]="'summary-card ' + riskClass">
            <div class="summary-label">Gap</div>
            <div class="summary-value-num">{{ group.gapPct | number:'1.1-1' }}%</div>
          </mat-card>
        </div>

        <div class="metrics-row">
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon">female</mat-icon>
              <span>Women</span>
            </div>
            <div class="metric-count">{{ group.womenCount }}</div>
          </mat-card>
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon">male</mat-icon>
              <span>Men</span>
            </div>
            <div class="metric-count">{{ group.menCount }}</div>
          </mat-card>
          <mat-card class="metric-card">
            <div class="metric-header">
              <mat-icon class="metric-icon">shield</mat-icon>
              <span>Risk State</span>
            </div>
            <span class="risk-chip" [class]="'risk-chip risk-' + group.riskState.toLowerCase()">
              {{ formatRiskState(group.riskState) }}
            </span>
          </mat-card>
          @if (group.notes) {
            <mat-card class="metric-card">
              <div class="metric-header">
                <mat-icon class="metric-icon">info</mat-icon>
                <span>Notes</span>
              </div>
              <div class="metric-notes">{{ group.notes }}</div>
            </mat-card>
          }
        </div>

        <!-- Employees in group -->
        <h2 class="section-title">Employees in Group</h2>
        @if (employees.length > 0) {
          <table mat-table [dataSource]="employees" class="section-table">
            <ng-container matColumnDef="employeeId">
              <th mat-header-cell *matHeaderCellDef>Employee ID</th>
              <td mat-cell *matCellDef="let e">{{ e.employeeId }}</td>
            </ng-container>
            <ng-container matColumnDef="roleTitle">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let e">{{ e.roleTitle }}</td>
            </ng-container>
            <ng-container matColumnDef="baseSalary">
              <th mat-header-cell *matHeaderCellDef>Base Salary</th>
              <td mat-cell *matCellDef="let e">
                <span class="salary-value">{{ e.baseSalary | number:'1.0-0' }}</span>
                <span class="currency-label">{{ e.currency }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="gender">
              <th mat-header-cell *matHeaderCellDef>Gender</th>
              <td mat-cell *matCellDef="let e">{{ e.gender || '—' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="employeeColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: employeeColumns;"
                class="clickable-row"
                (click)="navigateToEmployee(row.id)"></tr>
          </table>
        } @else {
          <p class="no-data">No employees found in this group.</p>
        }

        <!-- Recent decisions -->
        <h2 class="section-title">Recent Pay Decisions</h2>
        @if (recentDecisions.length > 0) {
          <table mat-table [dataSource]="recentDecisions" class="section-table">
            <ng-container matColumnDef="employeeId">
              <th mat-header-cell *matHeaderCellDef>Employee</th>
              <td mat-cell *matCellDef="let d">{{ d.employee?.employeeId || '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="decisionType">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let d">
                <span class="type-badge">{{ formatDecisionType(d.decisionType) }}</span>
              </td>
            </ng-container>
            <ng-container matColumnDef="effectiveDate">
              <th mat-header-cell *matHeaderCellDef>Effective Date</th>
              <td mat-cell *matCellDef="let d">{{ d.effectiveDate | date:'mediumDate' }}</td>
            </ng-container>
            <ng-container matColumnDef="payChange">
              <th mat-header-cell *matHeaderCellDef>Pay Change</th>
              <td mat-cell *matCellDef="let d">
                {{ d.payBeforeBase | number:'1.0-0' }}
                <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                {{ d.payAfterBase | number:'1.0-0' }}
              </td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let d">
                <span class="status-badge finalised">{{ d.status }}</span>
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="decisionColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: decisionColumns;"></tr>
          </table>
        } @else {
          <p class="no-data">No finalised pay decisions for employees in this group.</p>
        }

        <div class="disclaimer-banner">
          <mat-icon class="disclaimer-icon">info</mat-icon>
          <span>
            This information supports internal governance and transparency requirements.
            It does not constitute legal advice.
          </span>
        </div>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">error_outline</mat-icon>
          <p class="empty-state-title">Group not found</p>
          <p class="empty-state-text">This comparator group could not be found in the latest risk analysis.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .back-button {
      margin-bottom: 16px;
      color: #64748b;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0;
      }
    }

    .group-key-label {
      font-family: 'Inter', monospace;
      font-size: 14px;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 12px;
      border-radius: 6px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }

    .summary-card {
      padding: 16px !important;
    }

    .summary-card.risk-green {
      border-top: 3px solid #10b981;
    }

    .summary-card.risk-amber {
      border-top: 3px solid #f59e0b;
    }

    .summary-card.risk-red {
      border-top: 3px solid #ef4444;
    }

    .summary-label {
      font-size: 12px;
      font-weight: 500;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-value-text {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
    }

    .summary-value-num {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    .metrics-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 32px;
    }

    .metric-card {
      padding: 16px !important;
    }

    .metric-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }

    .metric-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
    }

    .metric-count {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
    }

    .metric-notes {
      font-size: 14px;
      color: #64748b;
      font-style: italic;
    }

    .section-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 12px 0;
    }

    .section-table {
      width: 100%;
      margin-bottom: 32px;
    }

    .salary-value {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .currency-label {
      font-size: 12px;
      color: #94a3b8;
      margin-left: 4px;
    }

    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      color: #475569;
    }

    .arrow-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      vertical-align: middle;
      color: #94a3b8;
      margin: 0 4px;
    }

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.finalised {
      background: #ecfdf5;
      color: #047857;
    }

    .no-data {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 32px;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f8fafc;
    }

    .loading-state {
      text-align: center;
      padding: 60px 0;
      color: #94a3b8;
    }

    .loading-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #cbd5e1;
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
      margin-top: 16px;
    }

    .disclaimer-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
      flex-shrink: 0;
    }
  `],
})
export class RiskGroupDetailComponent implements OnInit {
  group: any = null;
  employees: any[] = [];
  recentDecisions: any[] = [];
  loading = true;

  employeeColumns = ['employeeId', 'roleTitle', 'baseSalary', 'gender'];
  decisionColumns = ['employeeId', 'decisionType', 'effectiveDate', 'payChange', 'status'];

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    const groupKey = this.route.snapshot.params['groupKey'];
    this.api.get<any>(`/risk/groups/${encodeURIComponent(groupKey)}`).subscribe({
      next: (data) => {
        this.group = data.group;
        this.employees = data.employees ?? [];
        this.recentDecisions = data.recentDecisions ?? [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  get riskClass(): string {
    if (!this.group) return '';
    const absGap = Math.abs(this.group.gapPct);
    if (absGap >= 5) return 'risk-red';
    if (absGap >= 4) return 'risk-amber';
    return 'risk-green';
  }

  goBack() {
    this.router.navigate(['/risk']);
  }

  navigateToEmployee(id: string) {
    this.router.navigate(['/employees', id]);
  }

  formatRiskState(state: string): string {
    return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  formatDecisionType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

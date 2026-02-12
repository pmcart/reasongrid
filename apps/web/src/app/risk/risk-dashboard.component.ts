import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-risk-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatTableModule, MatButtonModule, MatIconModule],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Risk Radar</h1>
          <p class="page-description">Pay gap risk analysis across comparator groups</p>
        </div>
        <button mat-raised-button color="primary" (click)="triggerRun()" [disabled]="running">
          <mat-icon>{{ running ? 'hourglass_empty' : 'play_arrow' }}</mat-icon>
          {{ running ? 'Running...' : 'Run Analysis' }}
        </button>
      </div>

      <div class="disclaimer-banner">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>
          This information supports internal governance and transparency requirements.
          It does not constitute legal advice.
        </span>
      </div>

      @if (groups.length > 0) {
        <!-- Summary cards -->
        <div class="summary-grid">
          <mat-card class="summary-card">
            <div class="summary-value">{{ groups.length }}</div>
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

        <table mat-table [dataSource]="groups">
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
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
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
  `],
})
export class RiskDashboardComponent implements OnInit {
  groups: any[] = [];
  running = false;
  displayedColumns = ['groupKey', 'country', 'level', 'gapPct', 'riskState', 'womenCount', 'menCount'];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadGroups();
  }

  loadGroups() {
    this.api.get<any[]>('/risk/groups').subscribe((data) => (this.groups = data));
  }

  triggerRun() {
    this.running = true;
    this.api.post('/risk/run', {}).subscribe({
      next: () => {
        setTimeout(() => {
          this.loadGroups();
          this.running = false;
        }, 2000);
      },
      error: () => {
        this.running = false;
      },
    });
  }

  countByRisk(state: string): number {
    return this.groups.filter((g) => g.riskState === state).length;
  }

  formatRiskState(state: string): string {
    return state.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

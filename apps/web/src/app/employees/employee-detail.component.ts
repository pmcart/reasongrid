import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/api.service';
import { PayDecisionDialogComponent } from '../pay-decisions/pay-decision-dialog.component';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatTableModule, MatDialogModule, MatIconModule],
  template: `
    <div class="page-container" *ngIf="employee">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <a routerLink="/employees">Employees</a>
        <mat-icon class="breadcrumb-sep">chevron_right</mat-icon>
        <span>{{ employee.employeeId }}</span>
      </div>

      <!-- Employee header card -->
      <mat-card class="employee-header-card">
        <div class="employee-header">
          <div class="employee-avatar">
            {{ employee.employeeId?.charAt(0)?.toUpperCase() }}
          </div>
          <div class="employee-header-info">
            <h1 class="employee-name">{{ employee.employeeId }}</h1>
            <p class="employee-meta">{{ employee.roleTitle }} &middot; Level {{ employee.level }}</p>
          </div>
          <button mat-raised-button color="primary" (click)="openPayDecisionDialog()" class="record-btn">
            <mat-icon>add</mat-icon>
            Record Pay Decision
          </button>
        </div>
      </mat-card>

      <!-- Info grid -->
      <div class="info-grid">
        <mat-card class="info-card">
          <div class="info-label">Employee ID</div>
          <div class="info-value mono">{{ employee.employeeId }}</div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Country</div>
          <div class="info-value">{{ employee.country }}</div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Location</div>
          <div class="info-value">{{ employee.location || '—' }}</div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Job Family</div>
          <div class="info-value">{{ employee.jobFamily || '—' }}</div>
        </mat-card>
        <mat-card class="info-card highlight">
          <div class="info-label">Base Salary</div>
          <div class="info-value salary">{{ employee.baseSalary | number:'1.0-0' }} <span class="currency">{{ employee.currency }}</span></div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Bonus Target</div>
          <div class="info-value">{{ employee.bonusTarget ? (employee.bonusTarget | number:'1.0-0') + ' ' + employee.currency : '—' }}</div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Hire Date</div>
          <div class="info-value">{{ employee.hireDate ? (employee.hireDate | date:'mediumDate') : '—' }}</div>
        </mat-card>
        <mat-card class="info-card">
          <div class="info-label">Performance</div>
          <div class="info-value">{{ employee.performanceRating || '—' }}</div>
        </mat-card>
      </div>

      <!-- Pay decisions -->
      <div class="section-header">
        <h2>Pay Decision History</h2>
      </div>

      @if (decisions.length > 0) {
        <table mat-table [dataSource]="decisions">
          <ng-container matColumnDef="effectiveDate">
            <th mat-header-cell *matHeaderCellDef>Effective Date</th>
            <td mat-cell *matCellDef="let d">{{ d.effectiveDate | date:'mediumDate' }}</td>
          </ng-container>
          <ng-container matColumnDef="decisionType">
            <th mat-header-cell *matHeaderCellDef>Type</th>
            <td mat-cell *matCellDef="let d">
              <span class="type-badge">{{ d.decisionType | titlecase }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="payChange">
            <th mat-header-cell *matHeaderCellDef>Pay Change</th>
            <td mat-cell *matCellDef="let d">
              <span class="pay-before">{{ d.payBeforeBase | number:'1.0-0' }}</span>
              <mat-icon class="arrow-icon">arrow_forward</mat-icon>
              <span class="pay-after">{{ d.payAfterBase | number:'1.0-0' }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let d">
              <span class="status-badge" [class]="'status-badge status-' + d.status.toLowerCase()">
                {{ d.status }}
              </span>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="decisionColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: decisionColumns;"></tr>
        </table>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">description</mat-icon>
          <p class="empty-state-title">No pay decisions recorded</p>
          <p class="empty-state-text">Record a pay decision to build this employee's compensation history</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #64748b;

      a {
        color: #4f46e5;
        text-decoration: none;
        font-weight: 500;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    .breadcrumb-sep {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #cbd5e1;
    }

    .employee-header-card {
      padding: 24px !important;
      margin-bottom: 20px;
    }

    .employee-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .employee-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      min-width: 52px;
      border-radius: 14px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff;
      font-weight: 700;
      font-size: 22px;
    }

    .employee-header-info {
      flex: 1;
    }

    .employee-name {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
      line-height: 1.2;
    }

    .employee-meta {
      font-size: 14px;
      color: #64748b;
      margin: 4px 0 0 0;
    }

    .record-btn {
      white-space: nowrap;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 32px;
    }

    .info-card {
      padding: 16px 20px !important;
    }

    .info-card.highlight {
      border-left: 3px solid #4f46e5;
    }

    .info-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      margin-bottom: 4px;
    }

    .info-value {
      font-size: 15px;
      font-weight: 500;
      color: #1e293b;
    }

    .info-value.mono {
      font-family: 'Inter', monospace;
    }

    .info-value.salary {
      font-size: 18px;
      font-weight: 700;
      color: #0f172a;
    }

    .currency {
      font-size: 13px;
      font-weight: 500;
      color: #94a3b8;
    }

    .section-header {
      margin-bottom: 16px;

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #0f172a;
        margin: 0;
      }
    }

    .type-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4338ca;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .pay-before {
      color: #64748b;
      font-variant-numeric: tabular-nums;
    }

    .arrow-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #cbd5e1;
      vertical-align: middle;
      margin: 0 4px;
    }

    .pay-after {
      font-weight: 600;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }
  `],
})
export class EmployeeDetailComponent implements OnInit {
  employee: any = null;
  decisions: any[] = [];
  decisionColumns = ['effectiveDate', 'decisionType', 'payChange', 'status'];

  constructor(private route: ActivatedRoute, private api: ApiService, private dialog: MatDialog) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(`/employees/${id}`).subscribe((emp) => (this.employee = emp));
    this.api.get<any[]>(`/pay-decisions/employee/${id}`).subscribe((d) => (this.decisions = d));
  }

  openPayDecisionDialog() {
    const dialogRef = this.dialog.open(PayDecisionDialogComponent, {
      width: '600px',
      data: { employee: this.employee },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.decisions = [result, ...this.decisions];
      }
    });
  }
}

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { PayDecisionFormComponent } from '../pay-decisions/pay-decision-form.component';
import { FinaliseConfirmDialogComponent } from '../pay-decisions/finalise-confirm-dialog.component';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatButtonModule, MatTableModule,
    MatDialogModule, MatIconModule, MatTooltipModule, MatSnackBarModule, MatProgressSpinnerModule,
    PayDecisionFormComponent,
  ],
  template: `
    @if (loading) {
      <div class="loading-state">
        <mat-spinner diameter="40"></mat-spinner>
        <p>Loading employee...</p>
      </div>
    } @else if (error) {
      <div class="page-container">
        <div class="error-state">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <p class="error-title">Failed to load employee</p>
          <p class="error-text">{{ error }}</p>
          <button mat-raised-button color="primary" routerLink="/employees">
            <mat-icon>arrow_back</mat-icon>
            Back to Employees
          </button>
        </div>
      </div>
    }
    <div class="page-container" *ngIf="!loading && employee">
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
          <button mat-raised-button color="primary" (click)="newPayDecision()" class="record-btn">
            <mat-icon>add</mat-icon>
            New Pay Decision
          </button>
        </div>
        <!-- Tab buttons -->
        <div class="tab-bar">
          <button class="tab-btn" [class.active]="activeView === 'overview'"
                  (click)="switchView('overview')">
            <mat-icon>person</mat-icon>
            Overview
          </button>
          <button class="tab-btn" [class.active]="activeView === 'decisions'"
                  (click)="switchView('decisions')">
            <mat-icon>description</mat-icon>
            Pay Decisions
            @if (decisions.length > 0) {
              <span class="tab-count">{{ decisions.length }}</span>
            }
          </button>
        </div>
      </mat-card>

      <!-- OVERVIEW VIEW -->
      @if (activeView === 'overview') {
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

        <!-- Data History -->
        <div class="section-header">
          <h2>Data History</h2>
        </div>

        @if (snapshots.length > 0) {
          <div class="snapshots-timeline">
            @for (s of snapshots; track s.id; let i = $index) {
              <div class="snapshot-entry">
                <div class="snapshot-dot" [class.first-dot]="i === 0"></div>
                <div class="snapshot-content">
                  <div class="snapshot-date">
                    {{ s.snapshotAt | date:'medium' }}
                    @if (i === 0) {
                      <span class="snapshot-latest-badge">Latest</span>
                    }
                  </div>
                  <div class="snapshot-details">
                    <span class="snapshot-field">{{ s.roleTitle }}</span>
                    <span class="snapshot-sep">&middot;</span>
                    <span class="snapshot-field">Level {{ s.level }}</span>
                    <span class="snapshot-sep">&middot;</span>
                    <span class="snapshot-field">{{ s.country }}</span>
                    <span class="snapshot-sep">&middot;</span>
                    <span class="snapshot-field">{{ s.baseSalary | number:'1.0-0' }} {{ s.currency }}</span>
                  </div>
                  @if (getSnapshotChanges(i).length > 0) {
                    <div class="snapshot-changes">
                      @for (change of getSnapshotChanges(i); track change.field) {
                        <span class="change-chip">
                          <span class="change-field">{{ change.label }}:</span>
                          <span class="change-old">{{ change.oldValue }}</span>
                          <mat-icon class="change-arrow">arrow_forward</mat-icon>
                          <span class="change-new">{{ change.newValue }}</span>
                        </span>
                      }
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="empty-state" style="margin-bottom: 32px">
            <mat-icon class="empty-state-icon">history</mat-icon>
            <p class="empty-state-title">No import history</p>
            <p class="empty-state-text">Data snapshots will appear here after CSV imports</p>
          </div>
        }
      }

      <!-- PAY DECISIONS VIEW -->
      @if (activeView === 'decisions') {
        <!-- Inline form -->
        @if (showForm) {
          <app-pay-decision-form
            [employee]="employee"
            [decision]="editingDecision"
            (saved)="onDecisionSaved($event)"
            (cancelled)="onFormCancelled()">
          </app-pay-decision-form>
        }

        <!-- Actions bar -->
        <div class="decisions-toolbar">
          <h2>Pay Decision Records</h2>
          @if (!showForm) {
            <button mat-raised-button color="primary" (click)="openNewDecisionForm()">
              <mat-icon>add</mat-icon>
              New Pay Decision
            </button>
          }
        </div>

        <!-- Decisions table -->
        @if (decisions.length > 0) {
          <table mat-table [dataSource]="decisions" class="decisions-table">
            <ng-container matColumnDef="effectiveDate">
              <th mat-header-cell *matHeaderCellDef>Effective Date</th>
              <td mat-cell *matCellDef="let d">{{ d.effectiveDate | date:'mediumDate' }}</td>
            </ng-container>
            <ng-container matColumnDef="decisionType">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let d">
                <span class="type-badge">{{ formatType(d.decisionType) }}</span>
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
            <ng-container matColumnDef="owner">
              <th mat-header-cell *matHeaderCellDef>Owner</th>
              <td mat-cell *matCellDef="let d">{{ d.owner?.email ?? '—' }}</td>
            </ng-container>
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let d">
                <span class="status-badge" [class]="'status-badge status-' + d.status.toLowerCase()">
                  {{ d.status }}
                </span>
              </td>
            </ng-container>
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let d" class="actions-cell">
                <button mat-icon-button matTooltip="View details" (click)="viewDecision(d); $event.stopPropagation()">
                  <mat-icon>visibility</mat-icon>
                </button>
                @if (d.status === 'DRAFT') {
                  <button mat-icon-button matTooltip="Edit draft" (click)="editDecision(d); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon>
                  </button>
                  @if (canFinalise) {
                    <button mat-icon-button matTooltip="Finalise" (click)="finaliseDecision(d); $event.stopPropagation()">
                      <mat-icon>lock</mat-icon>
                    </button>
                  }
                }
              </td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="decisionColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: decisionColumns;"
                class="clickable-row" (click)="viewDecision(row)"></tr>
          </table>
        } @else {
          <div class="empty-state">
            <mat-icon class="empty-state-icon">description</mat-icon>
            <p class="empty-state-title">No pay decisions recorded</p>
            <p class="empty-state-text">Record a pay decision to build this employee's compensation history</p>
          </div>
        }
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
      padding: 24px 24px 0 !important;
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

    .tab-bar {
      display: flex;
      gap: 0;
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 12px 20px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.15s, border-color 0.15s;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover {
        color: #334155;
      }

      &.active {
        color: #4f46e5;
        border-bottom-color: #4f46e5;
      }
    }

    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: #eef2ff;
      color: #4f46e5;
      font-size: 12px;
      font-weight: 600;
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

    .snapshots-timeline {
      margin-bottom: 32px;
      padding-left: 12px;
      border-left: 2px solid #e2e8f0;
    }

    .snapshot-entry {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 10px 0;
      position: relative;
    }

    .snapshot-dot {
      width: 10px;
      height: 10px;
      min-width: 10px;
      border-radius: 50%;
      background: #4f46e5;
      margin-top: 5px;
      margin-left: -18px;
    }

    .snapshot-content {
      flex: 1;
    }

    .snapshot-date {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 2px;
    }

    .snapshot-details {
      font-size: 14px;
      color: #1e293b;
    }

    .snapshot-field {
      font-weight: 500;
    }

    .snapshot-sep {
      color: #cbd5e1;
      margin: 0 4px;
    }

    .first-dot {
      background: #16a34a;
    }

    .snapshot-latest-badge {
      display: inline-block;
      padding: 1px 6px;
      background: #ecfdf5;
      color: #059669;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 6px;
    }

    .snapshot-changes {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
    }

    .change-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 4px;
      font-size: 12px;
    }

    .change-field {
      font-weight: 600;
      color: #92400e;
    }

    .change-old {
      color: #94a3b8;
      text-decoration: line-through;
    }

    .change-arrow {
      font-size: 12px;
      width: 12px;
      height: 12px;
      color: #cbd5e1;
    }

    .change-new {
      font-weight: 600;
      color: #0f172a;
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

    .decisions-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      h2 {
        font-size: 18px;
        font-weight: 600;
        color: #0f172a;
        margin: 0;
      }
    }

    .decisions-table {
      width: 100%;
    }

    .clickable-row {
      cursor: pointer;

      &:hover {
        background: #f8fafc;
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

    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .status-draft {
      background: #fef3c7;
      color: #92400e;
    }

    .status-finalised {
      background: #d1fae5;
      color: #065f46;
    }

    .actions-cell {
      text-align: right;
      white-space: nowrap;

      button {
        opacity: 0.6;

        &:hover {
          opacity: 1;
        }
      }
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
      margin: 0;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 24px;
      color: #64748b;
      font-size: 14px;
    }

    .error-state {
      text-align: center;
      padding: 80px 24px;
    }

    .error-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #dc2626;
      margin-bottom: 12px;
    }

    .error-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 8px 0;
    }

    .error-text {
      font-size: 14px;
      color: #64748b;
      margin: 0 0 20px 0;
    }
  `],
})
export class EmployeeDetailComponent implements OnInit {
  employee: any = null;
  decisions: any[] = [];
  snapshots: any[] = [];
  loading = true;
  error: string | null = null;
  decisionColumns = ['effectiveDate', 'decisionType', 'payChange', 'owner', 'status', 'actions'];

  activeView: 'overview' | 'decisions' = 'overview';
  showForm = false;
  editingDecision: any = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  get canFinalise(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(`/employees/${id}`).subscribe({
      next: (emp) => {
        this.employee = emp;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.error || err?.message || 'Could not load employee data. Check that the API server is running.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
    this.loadDecisions(id);
    this.loadSnapshots(id);
  }

  switchView(view: 'overview' | 'decisions') {
    this.activeView = view;
    if (view !== 'decisions') {
      this.showForm = false;
      this.editingDecision = null;
    }
  }

  newPayDecision() {
    this.activeView = 'decisions';
    this.editingDecision = null;
    this.showForm = true;
  }

  openNewDecisionForm() {
    this.editingDecision = null;
    this.showForm = true;
  }

  onDecisionSaved(result: any) {
    this.showForm = false;
    this.editingDecision = null;
    this.loadDecisions(this.employee.id);
  }

  onFormCancelled() {
    this.showForm = false;
    this.editingDecision = null;
  }

  getSnapshotChanges(index: number): { field: string; label: string; oldValue: string; newValue: string }[] {
    const prev = this.snapshots[index + 1];
    const curr = this.snapshots[index];
    if (!prev || !curr) return [];

    const fields: { key: string; label: string }[] = [
      { key: 'roleTitle', label: 'Role' },
      { key: 'level', label: 'Level' },
      { key: 'country', label: 'Country' },
      { key: 'baseSalary', label: 'Base Salary' },
      { key: 'jobFamily', label: 'Job Family' },
      { key: 'performanceRating', label: 'Performance' },
    ];

    const changes: { field: string; label: string; oldValue: string; newValue: string }[] = [];
    for (const f of fields) {
      const oldVal = prev[f.key];
      const newVal = curr[f.key];
      if (oldVal !== newVal && (oldVal != null || newVal != null)) {
        changes.push({
          field: f.key,
          label: f.label,
          oldValue: oldVal != null ? String(oldVal) : '—',
          newValue: newVal != null ? String(newVal) : '—',
        });
      }
    }
    return changes;
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  viewDecision(d: any) {
    this.router.navigate(['/pay-decisions', d.id]);
  }

  editDecision(d: any) {
    this.editingDecision = d;
    this.showForm = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  finaliseDecision(d: any) {
    const dialogRef = this.dialog.open(FinaliseConfirmDialogComponent, {
      width: '480px',
      data: { decision: d },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDecisions(this.employee.id);
        this.snackBar.open('Pay decision finalised', 'OK', { duration: 3000 });
      }
    });
  }

  private loadDecisions(employeeId: string) {
    this.api.get<any[]>(`/pay-decisions/employee/${employeeId}`).subscribe({
      next: (d) => { this.decisions = d; this.cdr.markForCheck(); },
      error: () => { this.cdr.markForCheck(); },
    });
  }

  private loadSnapshots(employeeId: string) {
    this.api.get<any[]>(`/employees/${employeeId}/snapshots`).subscribe({
      next: (s) => { this.snapshots = s; this.cdr.markForCheck(); },
      error: () => { this.cdr.markForCheck(); },
    });
  }
}

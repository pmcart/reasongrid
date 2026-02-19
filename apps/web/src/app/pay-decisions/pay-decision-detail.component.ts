import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { PayDecisionEditDialogComponent } from './pay-decision-edit-dialog.component';
import { FinaliseConfirmDialogComponent } from './finalise-confirm-dialog.component';
import { ReturnDecisionDialogComponent } from './return-decision-dialog.component';
import { EvaluationPanelComponent } from './evaluation-panel.component';


@Component({
  selector: 'app-pay-decision-detail',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule, MatCardModule, MatButtonModule,
    MatIconModule, MatChipsModule, MatDialogModule, MatSnackBarModule,
    MatProgressSpinnerModule, EvaluationPanelComponent,
  ],
  template: `
    <div class="page-container" *ngIf="decision">
      <!-- Breadcrumb -->
      <div class="breadcrumb">
        <a routerLink="/employees">Employees</a>
        <mat-icon class="breadcrumb-sep">chevron_right</mat-icon>
        <a [routerLink]="'/employees/' + decision.employee?.id">{{ decision.employee?.employeeId }}</a>
        <mat-icon class="breadcrumb-sep">chevron_right</mat-icon>
        <span>Pay Decision</span>
      </div>

      <!-- Header -->
      <mat-card class="header-card">
        <div class="header-row">
          <div class="header-info">
            <div class="header-title-row">
              <h1 class="header-title">{{ formatType(decision.decisionType) }}</h1>
              <span class="status-badge" [class]="getStatusClass(decision.status)">
                {{ formatStatus(decision.status) }}
              </span>
            </div>
            <p class="header-meta">
              {{ decision.employee?.employeeId }} &middot; {{ decision.employee?.roleTitle }}
              &middot; Effective {{ decision.effectiveDate | date:'mediumDate' }}
            </p>
          </div>
          <div class="header-actions">
            <!-- Draft/Returned: Edit + Finalise -->
            @if (decision.status === 'DRAFT' || decision.status === 'RETURNED') {
              <button mat-stroked-button (click)="editDecision()">
                <mat-icon>edit</mat-icon>
                Edit
              </button>
              @if (canFinalise) {
                <button mat-raised-button color="primary" (click)="finaliseDecision()">
                  <mat-icon>lock</mat-icon>
                  Finalise
                </button>
              }
            }
            <!-- Pending Review: Approve/Return (for approver) -->
            @if (decision.status === 'PENDING_REVIEW' && isApprover) {
              <button mat-stroked-button color="warn" (click)="returnDecision()">
                <mat-icon>undo</mat-icon>
                Return
              </button>
              <button mat-raised-button color="primary" (click)="approveDecision()" [disabled]="approving">
                @if (approving) {
                  <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
                } @else {
                  <mat-icon>check_circle</mat-icon>
                }
                Approve
              </button>
            }
          </div>
        </div>
      </mat-card>

      <!-- Return reason notice -->
      @if (decision.status === 'RETURNED' && decision.returnReason) {
        <div class="return-notice">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Returned for revision</strong>
            <p>{{ decision.returnReason }}</p>
          </div>
        </div>
      }

      <!-- Evaluation Snapshot -->
      @if (decision.evaluationSnapshot && (decision.status === 'PENDING_REVIEW' || decision.status === 'APPROVED' || decision.status === 'FINALISED')) {
        <mat-card class="section-card">
          <div class="section-title">Policy Evaluation at Submission</div>
          <p class="eval-snapshot-meta">
            Evaluation checks were run when this decision was submitted for review.
          </p>
          <app-evaluation-panel [result]="decision.evaluationSnapshot"></app-evaluation-panel>
        </mat-card>
      }

      <!-- Compensation -->
      <mat-card class="section-card">
        <div class="section-title">Compensation Change</div>
        <div class="comp-grid">
          <div class="comp-item">
            <div class="comp-label">Base Salary</div>
            <div class="comp-row">
              <span class="comp-before">{{ decision.payBeforeBase | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
              <mat-icon class="comp-arrow">arrow_forward</mat-icon>
              <span class="comp-after">{{ decision.payAfterBase | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
              @if (baseChangePercent !== 0) {
                <span class="comp-change" [class.positive]="baseChangePercent > 0" [class.negative]="baseChangePercent < 0">
                  {{ baseChangePercent > 0 ? '+' : '' }}{{ baseChangePercent | number:'1.1-1' }}%
                </span>
              }
            </div>
          </div>
          @if (decision.payBeforeBonus != null || decision.payAfterBonus != null) {
            <div class="comp-item">
              <div class="comp-label">Bonus Target</div>
              <div class="comp-row">
                <span class="comp-before">{{ (decision.payBeforeBonus ?? 0) | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
                <mat-icon class="comp-arrow">arrow_forward</mat-icon>
                <span class="comp-after">{{ (decision.payAfterBonus ?? 0) | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
              </div>
            </div>
          }
          @if (decision.payBeforeLti != null || decision.payAfterLti != null) {
            <div class="comp-item">
              <div class="comp-label">LTI Target</div>
              <div class="comp-row">
                <span class="comp-before">{{ (decision.payBeforeLti ?? 0) | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
                <mat-icon class="comp-arrow">arrow_forward</mat-icon>
                <span class="comp-after">{{ (decision.payAfterLti ?? 0) | number:'1.0-0' }} {{ decision.employee?.currency }}</span>
              </div>
            </div>
          }
        </div>
      </mat-card>

      <!-- Rationale & Evidence -->
      <mat-card class="section-card">
        <div class="section-title">Rationale & Evidence</div>
        <div class="detail-group">
          <div class="detail-label">Rationale Categories</div>
          <div class="chips-row">
            @for (r of decision.rationales; track r.id) {
              <span class="rationale-chip" [title]="getRationaleDescription(r)">{{ getRationaleName(r) }}</span>
            }
          </div>
        </div>
        <div class="detail-group">
          <div class="detail-label">Supporting Context</div>
          <div class="detail-value context-text">{{ decision.supportingContext }}</div>
        </div>
        @if (decision.evidenceReference) {
          <div class="detail-group">
            <div class="detail-label">Evidence Reference</div>
            <div class="detail-value mono">{{ decision.evidenceReference }}</div>
          </div>
        }
      </mat-card>

      <!-- Employee Context at Decision Time -->
      @if (decision.snapshot) {
        <mat-card class="section-card">
          <div class="section-title">Employee Context at Decision Time</div>
          <p class="snapshot-meta">
            Data captured {{ decision.snapshot.snapshotAt | date:'medium' }}
            @if (hasSnapshotDrift) {
              <span class="drift-indicator">
                <mat-icon class="drift-icon">warning</mat-icon>
                Employee data has changed since this decision was recorded
              </span>
            }
          </p>

          @if (hasSnapshotDrift) {
            <div class="drift-comparison">
              <div class="drift-header">
                <span class="drift-col-label">Field</span>
                <span class="drift-col-label">At Decision Time</span>
                <span class="drift-col-label">Current</span>
              </div>
              @for (diff of snapshotDiffs; track diff.field) {
                <div class="drift-row">
                  <span class="drift-field">{{ diff.label }}</span>
                  <span class="drift-old">{{ diff.snapshotValue }}</span>
                  <span class="drift-current">{{ diff.currentValue }}</span>
                </div>
              }
            </div>
          }

          <div class="acc-grid">
            <div class="detail-group">
              <div class="detail-label">Role Title</div>
              <div class="detail-value">{{ decision.snapshot.roleTitle }}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Level</div>
              <div class="detail-value">{{ decision.snapshot.level }}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Country</div>
              <div class="detail-value">{{ decision.snapshot.country }}</div>
            </div>
            <div class="detail-group">
              <div class="detail-label">Base Salary</div>
              <div class="detail-value">{{ decision.snapshot.baseSalary | number:'1.0-0' }} {{ decision.snapshot.currency }}</div>
            </div>
            @if (decision.snapshot.jobFamily) {
              <div class="detail-group">
                <div class="detail-label">Job Family</div>
                <div class="detail-value">{{ decision.snapshot.jobFamily }}</div>
              </div>
            }
            @if (decision.snapshot.location) {
              <div class="detail-group">
                <div class="detail-label">Location</div>
                <div class="detail-value">{{ decision.snapshot.location }}</div>
              </div>
            }
          </div>

          <div class="snapshot-footer">
            <a [routerLink]="'/employees/' + decision.employee?.id" class="view-history-link">
              <mat-icon class="link-icon">history</mat-icon>
              View full data history
            </a>
          </div>
        </mat-card>
      }

      <!-- Decision Context -->
      @if (decision.snapshot && hasComputedContext) {
        <mat-card class="section-card">
          <div class="section-title">Decision Context</div>
          <p class="context-meta">Computed at decision time and frozen for audit purposes.</p>
          <div class="context-grid">
            @if (decision.snapshot.tenureYears != null) {
              <div class="context-item">
                <mat-icon class="context-icon">schedule</mat-icon>
                <div class="context-content">
                  <div class="context-label">Tenure</div>
                  <div class="context-value">{{ decision.snapshot.tenureYears | number:'1.1-1' }} years</div>
                </div>
              </div>
            }
            @if (decision.snapshot.compaRatio != null) {
              <div class="context-item">
                <mat-icon class="context-icon">analytics</mat-icon>
                <div class="context-content">
                  <div class="context-label">Compa Ratio</div>
                  <div class="context-value"
                       [class.below-market]="decision.snapshot.compaRatio < 0.95"
                       [class.above-market]="decision.snapshot.compaRatio > 1.05">
                    {{ decision.snapshot.compaRatio | number:'1.3-3' }}
                  </div>
                </div>
              </div>
            }
            @if (decision.snapshot.priorPromotionCount != null) {
              <div class="context-item">
                <mat-icon class="context-icon">trending_up</mat-icon>
                <div class="context-content">
                  <div class="context-label">Prior Promotions</div>
                  <div class="context-value">{{ decision.snapshot.priorPromotionCount }}</div>
                </div>
              </div>
            }
            @if (decision.snapshot.comparatorGroupKey) {
              <div class="context-item">
                <mat-icon class="context-icon">group</mat-icon>
                <div class="context-content">
                  <div class="context-label">Comparator Group</div>
                  <div class="context-value mono-small">{{ decision.snapshot.comparatorGroupKey }}</div>
                </div>
              </div>
            }
          </div>
        </mat-card>
      }

      <!-- Accountability -->
      <mat-card class="section-card">
        <div class="section-title">Accountability</div>
        <div class="acc-grid">
          <div class="detail-group">
            <div class="detail-label">Owner</div>
            <div class="detail-value">{{ decision.owner?.email ?? '—' }}</div>
          </div>
          <div class="detail-group">
            <div class="detail-label">Approver</div>
            <div class="detail-value">{{ decision.approver?.email ?? '—' }}</div>
          </div>
          <div class="detail-group">
            <div class="detail-label">Created</div>
            <div class="detail-value">{{ decision.createdAt | date:'medium' }}</div>
          </div>
          @if (decision.submittedAt) {
            <div class="detail-group">
              <div class="detail-label">Submitted</div>
              <div class="detail-value">{{ decision.submittedAt | date:'medium' }}</div>
            </div>
          }
          @if (decision.approvedAt) {
            <div class="detail-group">
              <div class="detail-label">Approved</div>
              <div class="detail-value">{{ decision.approvedAt | date:'medium' }}</div>
            </div>
          }
          @if (decision.finalisedAt) {
            <div class="detail-group">
              <div class="detail-label">Finalised</div>
              <div class="detail-value">{{ decision.finalisedAt | date:'medium' }}</div>
            </div>
          }
        </div>
      </mat-card>

      <!-- Immutability notice -->
      @if (decision.status === 'FINALISED') {
        <div class="immutable-notice">
          <mat-icon>lock</mat-icon>
          <span>This decision has been finalised and is now read-only. It forms part of the audit record.</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .breadcrumb {
      display: flex; align-items: center; gap: 4px; margin-bottom: 20px; font-size: 14px; color: #64748b;
      a { color: #4f46e5; text-decoration: none; font-weight: 500; &:hover { text-decoration: underline; } }
    }
    .breadcrumb-sep { font-size: 18px; width: 18px; height: 18px; color: #cbd5e1; }

    .header-card { padding: 24px !important; margin-bottom: 20px; }
    .header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .header-title-row { display: flex; align-items: center; gap: 12px; }
    .header-title { font-size: 22px; font-weight: 700; color: #0f172a; margin: 0; }
    .header-meta { font-size: 14px; color: #64748b; margin: 4px 0 0 0; }
    .header-actions { display: flex; gap: 8px; }

    .status-badge {
      display: inline-block; padding: 3px 10px; border-radius: 6px;
      font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .status-draft { background: #fef3c7; color: #92400e; }
    .status-pending-review { background: #dbeafe; color: #1e40af; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-returned { background: #fee2e2; color: #991b1b; }
    .status-finalised { background: #d1fae5; color: #065f46; }

    .return-notice {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 14px 18px; background: #fef2f2; border: 1px solid #fecaca;
      border-radius: 8px; margin-bottom: 16px; color: #991b1b; font-size: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #dc2626; margin-top: 2px; }
      p { margin: 4px 0 0 0; color: #7f1d1d; }
    }

    .eval-snapshot-meta { font-size: 13px; color: #64748b; margin: 0 0 12px 0; font-style: italic; }

    .section-card { padding: 24px !important; margin-bottom: 16px; }
    .section-title {
      font-size: 14px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 16px;
    }

    .comp-grid { display: flex; flex-direction: column; gap: 16px; }
    .comp-item { padding: 12px 16px; background: #f8fafc; border-radius: 8px; }
    .comp-label { font-size: 12px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .comp-row { display: flex; align-items: center; gap: 8px; }
    .comp-before { font-size: 16px; color: #64748b; font-variant-numeric: tabular-nums; }
    .comp-arrow { font-size: 16px; width: 16px; height: 16px; color: #cbd5e1; }
    .comp-after { font-size: 16px; font-weight: 600; color: #0f172a; font-variant-numeric: tabular-nums; }
    .comp-change { font-size: 13px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-left: 4px; }
    .comp-change.positive { background: #ecfdf5; color: #059669; }
    .comp-change.negative { background: #fef2f2; color: #dc2626; }

    .detail-group { margin-bottom: 16px; }
    .detail-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 4px; }
    .detail-value { font-size: 15px; color: #1e293b; }
    .detail-value.mono { font-family: 'Inter', monospace; }
    .context-text { white-space: pre-wrap; line-height: 1.5; }
    .chips-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .rationale-chip { display: inline-block; padding: 4px 12px; background: #eef2ff; color: #4338ca; border-radius: 6px; font-size: 13px; font-weight: 500; }

    .acc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

    .snapshot-meta { font-size: 13px; color: #64748b; margin: 0 0 16px 0; }
    .drift-indicator {
      display: inline-flex; align-items: center; gap: 4px; margin-left: 8px;
      padding: 2px 10px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 12px; font-weight: 500;
    }
    .drift-icon { font-size: 14px; width: 14px; height: 14px; }
    .drift-comparison { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .drift-header { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #fde68a; margin-bottom: 8px; }
    .drift-col-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #92400e; }
    .drift-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 4px 0; font-size: 13px; }
    .drift-field { font-weight: 600; color: #78350f; }
    .drift-old { color: #94a3b8; }
    .drift-current { font-weight: 600; color: #0f172a; }

    .snapshot-footer { margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
    .view-history-link {
      display: inline-flex; align-items: center; gap: 4px; color: #4f46e5;
      font-size: 13px; font-weight: 500; text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .link-icon { font-size: 16px; width: 16px; height: 16px; }

    .context-meta { font-size: 13px; color: #64748b; margin: 0 0 16px 0; font-style: italic; }
    .context-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .context-item { display: flex; align-items: flex-start; gap: 10px; padding: 12px; background: #f8fafc; border-radius: 8px; }
    .context-icon { font-size: 20px; width: 20px; height: 20px; color: #4f46e5; margin-top: 2px; }
    .context-content { flex: 1; }
    .context-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #94a3b8; margin-bottom: 2px; }
    .context-value { font-size: 16px; font-weight: 600; color: #0f172a; }
    .context-value.below-market { color: #dc2626; }
    .context-value.above-market { color: #059669; }
    .mono-small { font-family: 'Inter', monospace; font-size: 13px; }

    .immutable-notice {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 18px; background: #f0fdf4; border: 1px solid #bbf7d0;
      border-radius: 8px; color: #166534; font-size: 14px;
      mat-icon { font-size: 20px; width: 20px; height: 20px; color: #16a34a; }
    }

    .btn-spinner { display: inline-block; margin-right: 4px; }
  `],
})
export class PayDecisionDetailComponent implements OnInit {
  decision: any = null;
  approving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadDecision();
  }

  get canFinalise(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get isApprover(): boolean {
    return this.decision?.approverUserId === this.auth.user()?.id
      || this.auth.user()?.role === 'ADMIN';
  }

  get hasComputedContext(): boolean {
    const s = this.decision?.snapshot;
    if (!s) return false;
    return s.tenureYears != null || s.compaRatio != null || s.priorPromotionCount != null || s.comparatorGroupKey != null;
  }

  get hasSnapshotDrift(): boolean {
    const s = this.decision?.snapshot;
    const e = this.decision?.employee;
    if (!s || !e) return false;
    return s.roleTitle !== e.roleTitle || s.level !== e.level || s.country !== e.country
      || s.baseSalary !== e.baseSalary || s.jobFamily !== e.jobFamily;
  }

  get snapshotDiffs(): { field: string; label: string; snapshotValue: string; currentValue: string }[] {
    const s = this.decision?.snapshot;
    const e = this.decision?.employee;
    if (!s || !e) return [];
    const fields = [
      { key: 'roleTitle', label: 'Role Title' }, { key: 'level', label: 'Level' },
      { key: 'country', label: 'Country' }, { key: 'baseSalary', label: 'Base Salary' },
      { key: 'jobFamily', label: 'Job Family' }, { key: 'performanceRating', label: 'Performance' },
    ];
    return fields
      .filter(f => s[f.key] !== e[f.key] && (s[f.key] != null || e[f.key] != null))
      .map(f => ({
        field: f.key, label: f.label,
        snapshotValue: s[f.key] != null ? String(s[f.key]) : '—',
        currentValue: e[f.key] != null ? String(e[f.key]) : '—',
      }));
  }

  get baseChangePercent(): number {
    if (!this.decision?.payBeforeBase || this.decision.payBeforeBase === 0) return 0;
    return ((this.decision.payAfterBase - this.decision.payBeforeBase) / this.decision.payBeforeBase) * 100;
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  formatStatus(status: string): string {
    return status.replace(/_/g, ' ');
  }

  getStatusClass(status: string): string {
    const map: Record<string, string> = {
      'DRAFT': 'status-badge status-draft',
      'PENDING_REVIEW': 'status-badge status-pending-review',
      'APPROVED': 'status-badge status-approved',
      'RETURNED': 'status-badge status-returned',
      'FINALISED': 'status-badge status-finalised',
    };
    return map[status] ?? 'status-badge';
  }

  getRationaleName(r: any): string {
    return r.rationaleSnapshot?.name ?? r.rationaleDefinition?.name ?? r.rationaleDefinitionId;
  }

  getRationaleDescription(r: any): string {
    return r.rationaleSnapshot?.plainLanguageDescription ?? r.rationaleDefinition?.plainLanguageDescription ?? '';
  }

  editDecision() {
    const dialogRef = this.dialog.open(PayDecisionEditDialogComponent, {
      width: '640px',
      data: { employee: this.decision.employee, decision: this.decision },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.loadDecision();
    });
  }

  finaliseDecision() {
    const dialogRef = this.dialog.open(FinaliseConfirmDialogComponent, {
      width: '480px',
      data: { decision: this.decision },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.decision = result;
    });
  }

  approveDecision() {
    this.approving = true;
    this.api.post(`/pay-decisions/${this.decision.id}/approve`, {}).subscribe({
      next: (result) => {
        this.decision = result;
        this.approving = false;
        this.snackBar.open('Decision approved and finalised', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.approving = false;
        this.snackBar.open(err?.error?.error || 'Failed to approve', 'OK', { duration: 3000 });
      },
    });
  }

  returnDecision() {
    const dialogRef = this.dialog.open(ReturnDecisionDialogComponent, {
      width: '480px',
      data: { decision: this.decision },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.decision = result;
    });
  }

  private loadDecision() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get<any>(`/pay-decisions/${id}`).subscribe({
      next: (d) => (this.decision = d),
      error: () => {
        this.snackBar.open('Pay decision not found', 'OK', { duration: 3000 });
        this.router.navigate(['/employees']);
      },
    });
  }
}

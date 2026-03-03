import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { EvaluationResult } from '../core/evaluation.service';

const CHECK_TYPE_LABELS: Record<string, string> = {
  GENDER_GAP_IMPACT: 'Gender Gap Impact',
  SALARY_RANGE_COMPLIANCE: 'Salary Range',
  MEDIAN_DEVIATION: 'Peer Median Deviation',
  HISTORICAL_CONSISTENCY: 'Historical Consistency',
  CHANGE_MAGNITUDE: 'Change Magnitude',
};

interface DialogData {
  evaluationResult: EvaluationResult | null;
}

@Component({
  selector: 'app-submit-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <mat-icon class="header-icon">policy</mat-icon>
        <h2 mat-dialog-title>Policy Check Summary</h2>
      </div>

      <mat-dialog-content>
        <p class="dialog-intro">
          Review the policy check results below before submitting this decision for approval.
        </p>

        <!-- Summary row -->
        <div class="summary-row">
          @if (passCount > 0) {
            <div class="summary-chip pass">
              <mat-icon>check_circle</mat-icon>
              <span>{{ passCount }} passed</span>
            </div>
          }
          @if (warnCount > 0) {
            <div class="summary-chip warn">
              <mat-icon>warning</mat-icon>
              <span>{{ warnCount }} flagged</span>
            </div>
          }
          @if (blockCount > 0) {
            <div class="summary-chip block">
              <mat-icon>block</mat-icon>
              <span>{{ blockCount }} blocked</span>
            </div>
          }
          @if (!data.evaluationResult) {
            <div class="summary-chip neutral">
              <mat-icon>info</mat-icon>
              <span>No evaluation available</span>
            </div>
          }
        </div>

        <!-- Check list -->
        @if (data.evaluationResult) {
          <div class="check-list">
            @for (check of data.evaluationResult.checks; track check.checkType) {
              <div class="check-row" [class]="'status-' + check.status.toLowerCase()">
                <mat-icon class="check-icon">{{ getStatusIcon(check.status) }}</mat-icon>
                <div class="check-body">
                  <div class="check-label">{{ getCheckLabel(check.checkType) }}</div>
                  <div class="check-headline">{{ check.headline }}</div>
                </div>
              </div>
            }
          </div>
        }

        @if (warnCount > 0) {
          <div class="warn-notice">
            <mat-icon>info_outline</mat-icon>
            <span>Policy warnings have been acknowledged. The approver will see these checks when reviewing this decision.</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="cancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="confirm()">
          <mat-icon>send</mat-icon>
          Confirm Submission
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 420px;
      max-width: 540px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 24px 0;
    }

    .header-icon {
      color: #4f46e5;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    h2[mat-dialog-title] {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
    }

    mat-dialog-content {
      padding: 16px 24px !important;
    }

    .dialog-intro {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 16px 0;
    }

    .summary-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .summary-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }

    .summary-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .summary-chip.pass { background: #ecfdf5; color: #059669; }
    .summary-chip.warn { background: #fffbeb; color: #d97706; }
    .summary-chip.block { background: #fef2f2; color: #dc2626; }
    .summary-chip.neutral { background: #f1f5f9; color: #64748b; }

    .check-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }

    .check-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid transparent;
    }

    .check-row.status-pass { background: #f0fdf4; border-color: #bbf7d0; }
    .check-row.status-warning { background: #fffbeb; border-color: #fde68a; }
    .check-row.status-block { background: #fef2f2; border-color: #fecaca; }

    .check-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .status-pass .check-icon { color: #059669; }
    .status-warning .check-icon { color: #d97706; }
    .status-block .check-icon { color: #dc2626; }

    .check-body {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .check-label {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .check-headline {
      font-size: 13px;
      color: #0f172a;
    }

    .warn-notice {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    .warn-notice mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
      margin-top: 1px;
      color: #94a3b8;
    }

    mat-dialog-actions {
      padding: 12px 24px 20px !important;
      gap: 8px;
    }
  `],
})
export class SubmitConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<SubmitConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
  ) {}

  get passCount(): number {
    return this.data.evaluationResult?.checks.filter((c) => c.status === 'PASS').length ?? 0;
  }

  get warnCount(): number {
    return this.data.evaluationResult?.checks.filter((c) => c.status === 'WARNING').length ?? 0;
  }

  get blockCount(): number {
    return this.data.evaluationResult?.checks.filter((c) => c.status === 'BLOCK').length ?? 0;
  }

  getStatusIcon(status: string): string {
    if (status === 'PASS') return 'check_circle';
    if (status === 'WARNING') return 'warning';
    return 'block';
  }

  getCheckLabel(checkType: string): string {
    return CHECK_TYPE_LABELS[checkType] ?? checkType.replace(/_/g, ' ');
  }

  confirm() {
    this.dialogRef.close(true);
  }

  cancel() {
    this.dialogRef.close(false);
  }
}

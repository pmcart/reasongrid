import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';

const RATIONALE_LABELS: Record<string, string> = {
  SENIORITY_TENURE: 'Seniority / tenure',
  RELEVANT_EXPERIENCE: 'Relevant experience',
  PERFORMANCE_HISTORY: 'Performance history',
  SCOPE_OF_ROLE: 'Scope of role',
  MARKET_CONDITIONS: 'Market conditions',
  GEOGRAPHIC_FACTORS: 'Geographic factors',
  INTERNAL_EQUITY_ALIGNMENT: 'Internal equity alignment',
  PROMOTION_HIGHER_RESPONSIBILITY: 'Promotion into higher responsibility',
  TEMPORARY_ADJUSTMENT: 'Temporary adjustment',
};

@Component({
  selector: 'app-finalise-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="dialog-header">
      <mat-icon class="warning-icon">warning</mat-icon>
      <h2 class="dialog-title">Finalise Pay Decision</h2>
    </div>

    <mat-dialog-content>
      <p class="warning-text">
        Once finalised, this decision cannot be edited. It will become a permanent part of the audit record.
      </p>

      <div class="summary-card">
        <div class="summary-row">
          <span class="summary-label">Type</span>
          <span class="summary-value">{{ formatType(data.decision.decisionType) }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Effective Date</span>
          <span class="summary-value">{{ data.decision.effectiveDate | date:'mediumDate' }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Base Change</span>
          <span class="summary-value">
            {{ data.decision.payBeforeBase | number:'1.0-0' }}
            &rarr;
            {{ data.decision.payAfterBase | number:'1.0-0' }}
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Rationale</span>
          <span class="summary-value">
            {{ data.decision.rationales?.length ?? 0 }} categor{{ (data.decision.rationales?.length ?? 0) === 1 ? 'y' : 'ies' }} selected
          </span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Approver</span>
          <span class="summary-value">{{ data.decision.approver?.email ?? '—' }}</span>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      @if (errorMessage) {
        <span class="error-text">{{ errorMessage }}</span>
      }
      <button mat-button mat-dialog-close [disabled]="finalising">Cancel</button>
      <button mat-raised-button color="warn" (click)="confirm()" [disabled]="finalising">
        @if (finalising) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        } @else {
          <mat-icon>lock</mat-icon>
        }
        Confirm Finalisation
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 24px 12px;
    }

    .warning-icon {
      color: #f59e0b;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    mat-dialog-content {
      padding: 0 24px !important;
    }

    .warning-text {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 16px 0;
    }

    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }

    .summary-row:not(:last-child) {
      border-bottom: 1px solid #f1f5f9;
    }

    .summary-label {
      font-size: 13px;
      color: #94a3b8;
      font-weight: 500;
    }

    .summary-value {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
    }

    .error-text {
      color: #dc2626;
      font-size: 13px;
      margin-right: auto;
    }

    .btn-spinner {
      display: inline-block;
      margin-right: 4px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      border-top: 1px solid #e2e8f0;
      justify-content: flex-end;
      gap: 8px;
    }
  `],
})
export class FinaliseConfirmDialogComponent {
  finalising = false;
  errorMessage = '';

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<FinaliseConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { decision: any },
  ) {}

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  confirm() {
    this.finalising = true;
    this.errorMessage = '';

    this.api.post(`/pay-decisions/${this.data.decision.id}/finalise`, {}).subscribe({
      next: (result) => this.dialogRef.close(result),
      error: (err) => {
        this.finalising = false;
        this.errorMessage = err?.error?.error || 'Failed to finalise decision';
      },
    });
  }
}

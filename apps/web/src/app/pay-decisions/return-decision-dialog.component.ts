import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-return-decision-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-icon warn">undo</mat-icon>
      Return Decision
    </h2>
    <mat-dialog-content>
      <p class="dialog-description">
        This decision will be returned to the owner for revisions.
        Please provide a reason so they understand what needs to change.
      </p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Reason for return</mat-label>
        <textarea matInput [(ngModel)]="returnReason" rows="4" required
                  placeholder="Explain what needs to be revised..."></textarea>
      </mat-form-field>
      @if (error) {
        <p class="error-text">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="submitting">Cancel</button>
      <button mat-raised-button color="warn" (click)="submit()"
              [disabled]="!returnReason.trim() || submitting">
        @if (submitting) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        }
        Return for Revision
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-icon {
      vertical-align: middle;
      margin-right: 8px;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .dialog-icon.warn { color: #d97706; }
    .dialog-description {
      font-size: 14px;
      color: #475569;
      margin: 0 0 16px 0;
      line-height: 1.5;
    }
    .full-width { width: 100%; }
    .error-text { color: #dc2626; font-size: 13px; }
    .btn-spinner { display: inline-block; margin-right: 4px; }
  `],
})
export class ReturnDecisionDialogComponent {
  returnReason = '';
  submitting = false;
  error = '';

  constructor(
    private dialogRef: MatDialogRef<ReturnDecisionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { decision: any },
    private api: ApiService,
  ) {}

  submit() {
    if (!this.returnReason.trim()) return;
    this.submitting = true;
    this.error = '';

    this.api.post(`/pay-decisions/${this.data.decision.id}/return`, {
      returnReason: this.returnReason.trim(),
    }).subscribe({
      next: (result) => {
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error || 'Failed to return decision';
      },
    });
  }
}

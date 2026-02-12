import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { ApiService } from '../core/api.service';

const DECISION_TYPES = ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT', 'ANNUAL_INCREASE', 'OTHER'];

const RATIONALE_OPTIONS = [
  { value: 'SENIORITY_TENURE', label: 'Seniority / tenure' },
  { value: 'RELEVANT_EXPERIENCE', label: 'Relevant experience' },
  { value: 'PERFORMANCE_HISTORY', label: 'Performance history' },
  { value: 'SCOPE_OF_ROLE', label: 'Scope of role' },
  { value: 'MARKET_CONDITIONS', label: 'Market conditions' },
  { value: 'GEOGRAPHIC_FACTORS', label: 'Geographic factors' },
  { value: 'INTERNAL_EQUITY_ALIGNMENT', label: 'Internal equity alignment' },
  { value: 'PROMOTION_HIGHER_RESPONSIBILITY', label: 'Promotion into higher responsibility' },
  { value: 'TEMPORARY_ADJUSTMENT', label: 'Temporary adjustment' },
];

@Component({
  selector: 'app-pay-decision-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule,
    MatNativeDateModule, MatIconModule,
  ],
  template: `
    <div class="dialog-header">
      <div class="dialog-header-content">
        <mat-icon class="dialog-header-icon">description</mat-icon>
        <div>
          <h2 class="dialog-title">Record Pay Decision</h2>
          <p class="dialog-subtitle">{{ data.employee?.employeeId }} &middot; {{ data.employee?.roleTitle }}</p>
        </div>
      </div>
    </div>

    <mat-dialog-content>
      <div class="form-section">
        <div class="form-section-label">Decision Details</div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Decision Type</mat-label>
            <mat-select [(ngModel)]="form.decisionType" required>
              @for (t of decisionTypes; track t) {
                <mat-option [value]="t">{{ formatType(t) }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Effective Date</mat-label>
            <input matInput [matDatepicker]="picker" [(ngModel)]="form.effectiveDate" required />
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label">Compensation</div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Pay Before (Base)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payBeforeBase" required />
          </mat-form-field>
          <mat-icon class="arrow-between">arrow_forward</mat-icon>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Pay After (Base)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payAfterBase" required />
          </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label">Rationale & Evidence</div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rationale</mat-label>
          <mat-select [(ngModel)]="form.rationaleSelections" multiple required>
            @for (r of rationaleOptions; track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
          <mat-hint>Select one or more objective rationale categories</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Supporting Context</mat-label>
          <textarea matInput [(ngModel)]="form.supportingContext" rows="3" required
                    placeholder="Provide factual context supporting this decision..."></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Evidence Reference (optional)</mat-label>
          <input matInput [(ngModel)]="form.evidenceReference"
                 placeholder="e.g. performance review ID, market data source" />
        </mat-form-field>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="save()">
        <mat-icon>save</mat-icon>
        Save as Draft
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .dialog-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .dialog-header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      font-size: 24px;
      color: #4f46e5;
      background: #eef2ff;
      border-radius: 10px;
      padding: 8px;
    }

    .dialog-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .dialog-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    mat-dialog-content {
      min-width: 540px;
      padding: 0 24px !important;
    }

    .form-section {
      padding: 20px 0 4px;
    }

    .form-section:not(:last-child) {
      border-bottom: 1px solid #f1f5f9;
    }

    .form-section-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 12px;
    }

    .form-row {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .flex-1 { flex: 1; }
    .full-width { width: 100%; }

    .arrow-between {
      color: #cbd5e1;
      margin-bottom: 20px;
    }

    .currency-prefix {
      color: #94a3b8;
      font-size: 14px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      border-top: 1px solid #e2e8f0;
      justify-content: flex-end;
      gap: 8px;
    }
  `],
})
export class PayDecisionDialogComponent {
  decisionTypes = DECISION_TYPES;
  rationaleOptions = RATIONALE_OPTIONS;

  form: any = {
    decisionType: '',
    effectiveDate: new Date(),
    payBeforeBase: null,
    payAfterBase: null,
    rationaleSelections: [],
    supportingContext: '',
    evidenceReference: null,
    accountableOwnerUserId: '',
    approverUserId: '',
  };

  constructor(
    private api: ApiService,
    private dialogRef: MatDialogRef<PayDecisionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { employee: any },
  ) {
    if (data.employee) {
      this.form.payBeforeBase = data.employee.baseSalary;
    }
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  save() {
    const payload = {
      ...this.form,
      effectiveDate: new Date(this.form.effectiveDate).toISOString(),
    };

    this.api.post(`/pay-decisions/employee/${this.data.employee.id}`, payload).subscribe({
      next: (result) => this.dialogRef.close(result),
      error: (err) => console.error('Failed to save pay decision', err),
    });
  }
}

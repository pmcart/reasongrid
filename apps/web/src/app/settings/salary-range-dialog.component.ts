import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SalaryRangeService, SalaryRange, SalaryRangePayload, EmployeeGroup } from '../core/salary-range.service';

@Component({
  selector: 'app-salary-range-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-icon">paid</mat-icon>
      {{ data.range ? 'Edit' : 'Create' }} Salary Range
    </h2>
    <mat-dialog-content>
      @if (!data.range && uncoveredGroups.length > 0) {
        <div class="prefill-section">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Pre-fill from employee group without range</mat-label>
            <mat-select (selectionChange)="onGroupSelected($event.value)">
              <mat-option [value]="null">— Manual entry —</mat-option>
              @for (g of uncoveredGroups; track g.country + g.jobFamily + g.level) {
                <mat-option [value]="g">
                  {{ g.country }} / {{ g.jobFamily || '(no family)' }} / {{ g.level }} — {{ g.currency }} ({{ g.employeeCount }} emp{{ g.employeeCount !== 1 ? 's' : '' }})
                </mat-option>
              }
            </mat-select>
            <mat-hint>Select an employee group to auto-fill fields</mat-hint>
          </mat-form-field>
        </div>
      }

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Country (ISO)</mat-label>
          <input matInput [(ngModel)]="form.country" maxlength="2" placeholder="IE"
                 style="text-transform: uppercase" />
          <mat-hint>2-letter ISO code</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Currency (ISO)</mat-label>
          <input matInput [(ngModel)]="form.currency" maxlength="3" placeholder="EUR"
                 style="text-transform: uppercase" />
          <mat-hint>3-letter ISO code</mat-hint>
        </mat-form-field>
      </div>

      <div class="form-row">
        <mat-form-field appearance="outline">
          <mat-label>Job Family</mat-label>
          <input matInput [(ngModel)]="form.jobFamily" placeholder="Optional" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Level</mat-label>
          <input matInput [(ngModel)]="form.level" placeholder="e.g. L3, Senior" />
        </mat-form-field>
      </div>

      <div class="form-row three-col">
        <mat-form-field appearance="outline">
          <mat-label>Min</mat-label>
          <input matInput type="number" [(ngModel)]="form.min" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Mid</mat-label>
          <input matInput type="number" [(ngModel)]="form.mid" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Max</mat-label>
          <input matInput type="number" [(ngModel)]="form.max" />
        </mat-form-field>
      </div>

      @if (error) {
        <p class="error-text">{{ error }}</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving">
        @if (saving) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        }
        {{ data.range ? 'Save Changes' : 'Create Range' }}
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
      color: #4f46e5;
    }
    .prefill-section {
      margin-bottom: 12px;
      padding: 12px 14px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
    }
    .form-row {
      display: flex;
      gap: 12px;
      margin-bottom: 4px;
      mat-form-field { flex: 1; }
    }
    .full-width { width: 100%; }
    .three-col mat-form-field { flex: 1; }
    .error-text { color: #dc2626; font-size: 13px; }
    .btn-spinner { display: inline-block; margin-right: 4px; }
  `],
})
export class SalaryRangeDialogComponent {
  form: SalaryRangePayload;
  uncoveredGroups: EmployeeGroup[];
  saving = false;
  error = '';

  constructor(
    private dialogRef: MatDialogRef<SalaryRangeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      range: SalaryRange | null;
      uncoveredGroups?: EmployeeGroup[];
      prefill?: EmployeeGroup;
    },
    private salaryRangeService: SalaryRangeService,
  ) {
    this.uncoveredGroups = data.uncoveredGroups ?? [];
    const r = data.range;
    const prefill = data.prefill;
    this.form = {
      country: r?.country ?? prefill?.country ?? '',
      jobFamily: r?.jobFamily ?? prefill?.jobFamily ?? null,
      level: r?.level ?? prefill?.level ?? '',
      currency: r?.currency ?? prefill?.currency ?? '',
      min: r?.min ?? 0,
      mid: r?.mid ?? 0,
      max: r?.max ?? 0,
    };
  }

  onGroupSelected(group: EmployeeGroup | null) {
    if (group) {
      this.form.country = group.country;
      this.form.jobFamily = group.jobFamily;
      this.form.level = group.level;
      this.form.currency = group.currency;
    }
  }

  save() {
    this.error = '';

    if (!this.form.country || this.form.country.length !== 2) {
      this.error = 'Country must be a 2-letter ISO code';
      return;
    }
    if (!this.form.currency || this.form.currency.length !== 3) {
      this.error = 'Currency must be a 3-letter ISO code';
      return;
    }
    if (!this.form.level) {
      this.error = 'Level is required';
      return;
    }
    if (!(this.form.min < this.form.mid && this.form.mid < this.form.max)) {
      this.error = 'Salary range must satisfy: min < mid < max';
      return;
    }

    this.saving = true;
    const payload: SalaryRangePayload = {
      ...this.form,
      country: this.form.country.toUpperCase(),
      currency: this.form.currency.toUpperCase(),
      jobFamily: this.form.jobFamily?.trim() || null,
    };

    const request$ = this.data.range
      ? this.salaryRangeService.update(this.data.range.id, payload)
      : this.salaryRangeService.create(payload);

    request$.subscribe({
      next: (result) => this.dialogRef.close(result),
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'Failed to save salary range';
      },
    });
  }
}

import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClassificationService, ClassificationDimension } from '../core/classification.service';

const SCALE_TYPE_OPTIONS = [
  { value: 'NUMERIC_1_5', label: 'Numeric (1 - 5)' },
  { value: 'NUMERIC_1_10', label: 'Numeric (1 - 10)' },
  { value: 'LEVEL_LOW_MED_HIGH', label: 'Low / Medium / High' },
  { value: 'CUSTOM', label: 'Custom' },
];

@Component({
  selector: 'app-dimension-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-header-icon">category</mat-icon>
      <div>
        <h2 class="dialog-title">{{ isEdit ? 'Edit Dimension' : 'New Classification Dimension' }}</h2>
        <p class="dialog-subtitle">{{ isEdit ? 'Update the classification dimension properties.' : 'Define a new dimension for equal-value role classification.' }}</p>
      </div>
    </div>

    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Code</mat-label>
          <input matInput formControlName="code" placeholder="UPPER_SNAKE_CASE e.g. WORKING_CONDITIONS" />
          <mat-hint>Stable identifier. Cannot be changed after creation.</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Working Conditions" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3"
                    placeholder="Describe what this dimension measures..."></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Scale Type</mat-label>
          <mat-select formControlName="scaleType">
            @for (opt of scaleTypeOptions; track opt.value) {
              <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Sort Order</mat-label>
          <input matInput type="number" formControlName="sortOrder" />
          <mat-hint>Controls display order. Lower numbers appear first.</mat-hint>
        </mat-form-field>
      </form>

      @if (errorMessage) {
        <p class="error-text">{{ errorMessage }}</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving || form.invalid">
        @if (saving) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        } @else {
          <mat-icon>save</mat-icon>
        }
        {{ isEdit ? 'Save Changes' : 'Create Dimension' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e2e8f0;
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
      margin: 4px 0 0 0;
    }

    mat-dialog-content {
      min-width: 480px;
      max-height: 65vh;
      padding: 16px 24px !important;
    }

    .full-width { width: 100%; }

    .error-text {
      color: #dc2626;
      font-size: 13px;
      margin-top: 8px;
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
export class DimensionDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  errorMessage = '';
  scaleTypeOptions = SCALE_TYPE_OPTIONS;
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private classificationService: ClassificationService,
    private dialogRef: MatDialogRef<DimensionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { dimension: ClassificationDimension | null },
  ) {}

  ngOnInit() {
    this.isEdit = !!this.data.dimension;
    const dim = this.data.dimension;

    this.form = this.fb.group({
      code: [{ value: dim?.code ?? '', disabled: this.isEdit }, [Validators.required, Validators.pattern(/^[A-Z][A-Z0-9_]*$/)]],
      name: [dim?.name ?? '', Validators.required],
      description: [dim?.description ?? ''],
      scaleType: [dim?.scaleType ?? 'NUMERIC_1_5', Validators.required],
      sortOrder: [dim?.sortOrder ?? 0],
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    this.errorMessage = '';

    const raw = this.form.getRawValue();
    const payload = {
      code: raw.code,
      name: raw.name,
      description: raw.description,
      scaleType: raw.scaleType,
      scaleConfig: {},
      sortOrder: raw.sortOrder,
    };

    const request$ = this.isEdit
      ? this.classificationService.updateDimension(this.data.dimension!.id, payload)
      : this.classificationService.createDimension(payload);

    request$.subscribe({
      next: (result) => {
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to save dimension';
      },
    });
  }
}

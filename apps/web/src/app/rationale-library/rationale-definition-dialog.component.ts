import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RationaleService, RationaleDefinition } from '../core/rationale.service';

const DECISION_TYPES = ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT', 'ANNUAL_INCREASE', 'OTHER'];

const OBJECTIVE_CRITERIA_OPTIONS = [
  'Seniority', 'Tenure', 'Experience', 'Performance', 'Scope',
  'Benchmark', 'Market', 'Geographic', 'Equity', 'Promotion', 'Temporary',
];

@Component({
  selector: 'app-rationale-definition-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatChipsModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-header-icon">menu_book</mat-icon>
      <div>
        <h2 class="dialog-title">{{ isEdit ? 'Edit Rationale Definition' : 'New Rationale Definition' }}</h2>
        @if (isEdit) {
          <p class="dialog-notice">
            <mat-icon class="notice-icon">info</mat-icon>
            Editing creates a new version. The previous version is preserved for audit purposes.
          </p>
        }
      </div>
    </div>

    <mat-dialog-content>
      @if (!isEdit) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Code</mat-label>
          <input matInput [(ngModel)]="form.code" required
                 placeholder="UPPER_SNAKE_CASE e.g. MARKET_CONDITIONS"
                 pattern="^[A-Z][A-Z0-9_]*$" />
          <mat-hint>Stable identifier across versions. Cannot be changed after creation.</mat-hint>
        </mat-form-field>
      } @else {
        <div class="readonly-field">
          <span class="readonly-label">Code</span>
          <span class="readonly-value">{{ data.definition?.code }}</span>
        </div>
      }

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="form.name" required placeholder="Short neutral label" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Category</mat-label>
        <mat-select [(ngModel)]="form.category" required>
          <mat-option value="STRUCTURAL">Structural</mat-option>
          <mat-option value="MARKET">Market</mat-option>
          <mat-option value="PERFORMANCE">Performance</mat-option>
          <mat-option value="TEMPORARY">Temporary</mat-option>
          <mat-option value="OTHER">Other</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Legal Description</mat-label>
        <textarea matInput [(ngModel)]="form.legalDescription" rows="3" required
                  placeholder="Formal definition used in audit..."></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Plain Language Description</mat-label>
        <textarea matInput [(ngModel)]="form.plainLanguageDescription" rows="2"
                  placeholder="Internal explanatory copy (optional)"></textarea>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Objective Criteria Tags</mat-label>
        <mat-select [(ngModel)]="form.objectiveCriteriaTags" multiple>
          @for (tag of criteriaOptions; track tag) {
            <mat-option [value]="tag">{{ tag }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Applicable Decision Types</mat-label>
        <mat-select [(ngModel)]="form.applicableDecisionTypes" multiple>
          @for (dt of decisionTypes; track dt) {
            <mat-option [value]="dt">{{ formatType(dt) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Jurisdiction Scope</mat-label>
        <input matInput [(ngModel)]="jurisdictionInput"
               placeholder="ISO country codes, comma-separated (e.g. IE, FR, DE). Leave empty for Global." />
        <mat-hint>Leave empty for global scope</mat-hint>
      </mat-form-field>

      <div class="toggle-row">
        <mat-slide-toggle [(ngModel)]="form.requiresSubstantiation">
          Requires Substantiation
        </mat-slide-toggle>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      @if (errorMessage) {
        <span class="error-text">{{ errorMessage }}</span>
      }
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving || !isValid()">
        @if (saving) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        } @else {
          <mat-icon>save</mat-icon>
        }
        {{ isEdit ? 'Save New Version' : 'Create' }}
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

    .dialog-notice {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #92400e;
      background: #fef3c7;
      padding: 4px 8px;
      border-radius: 4px;
      margin: 6px 0 0 0;
    }

    .notice-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    mat-dialog-content {
      min-width: 540px;
      max-height: 65vh;
      padding: 16px 24px !important;
    }

    .full-width { width: 100%; }

    .readonly-field {
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .readonly-label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      margin-bottom: 2px;
    }

    .readonly-value {
      font-size: 14px;
      font-family: monospace;
      color: #0f172a;
    }

    .toggle-row {
      margin: 16px 0;
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
export class RationaleDefinitionDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  errorMessage = '';
  decisionTypes = DECISION_TYPES;
  criteriaOptions = OBJECTIVE_CRITERIA_OPTIONS;
  jurisdictionInput = '';

  form = {
    code: '',
    name: '',
    category: '',
    legalDescription: '',
    plainLanguageDescription: '',
    objectiveCriteriaTags: [] as string[],
    applicableDecisionTypes: [] as string[],
    requiresSubstantiation: false,
  };

  constructor(
    private rationaleService: RationaleService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<RationaleDefinitionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { mode: string; definition?: RationaleDefinition },
  ) {}

  ngOnInit() {
    if (this.data.mode === 'edit' && this.data.definition) {
      this.isEdit = true;
      const d = this.data.definition;
      this.form = {
        code: d.code,
        name: d.name,
        category: d.category,
        legalDescription: d.legalDescription,
        plainLanguageDescription: d.plainLanguageDescription,
        objectiveCriteriaTags: Array.isArray(d.objectiveCriteriaTags) ? [...d.objectiveCriteriaTags] : [],
        applicableDecisionTypes: Array.isArray(d.applicableDecisionTypes) ? [...d.applicableDecisionTypes] : [],
        requiresSubstantiation: d.requiresSubstantiation,
      };
      this.jurisdictionInput = Array.isArray(d.jurisdictionScope) ? d.jurisdictionScope.join(', ') : '';
    }
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  isValid(): boolean {
    return (
      (this.isEdit || !!this.form.code) &&
      !!this.form.name &&
      !!this.form.category &&
      !!this.form.legalDescription
    );
  }

  save() {
    if (!this.isValid()) return;
    this.saving = true;
    this.errorMessage = '';

    const jurisdictionScope = this.jurisdictionInput
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    const payload: Record<string, unknown> = {
      ...this.form,
      jurisdictionScope,
    };

    const request$ = this.isEdit
      ? this.rationaleService.update(this.data.definition!.id, payload)
      : this.rationaleService.create(payload);

    request$.subscribe({
      next: (result) => {
        this.snackBar.open(
          this.isEdit ? `New version (v${(result as any).version}) created` : 'Rationale definition created',
          'OK',
          { duration: 3000 },
        );
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to save';
      },
    });
  }
}

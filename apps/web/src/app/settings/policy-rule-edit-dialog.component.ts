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
import { PolicyRulesService, PolicyRule } from '../core/policy-rules.service';

const PARAM_LABELS: Record<string, string> = {
  warningThresholdPct: 'Warning Threshold (%)',
  blockThresholdPct: 'Block Threshold (%)',
  allowAboveMax: 'Allow Above Maximum',
  allowBelowMin: 'Allow Below Minimum',
  warningDeviationPct: 'Warning Deviation (%)',
  blockDeviationPct: 'Block Deviation (%)',
  lookbackMonths: 'Lookback Period (months)',
  warningPct: 'Warning Threshold (%)',
  blockPct: 'Block Threshold (%)',
};

@Component({
  selector: 'app-policy-rule-edit-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-icon">settings</mat-icon>
      Configure {{ data.checkInfo.label }}
    </h2>
    <mat-dialog-content>
      <p class="dialog-description">{{ data.checkInfo.description }}</p>

      <div class="config-section">
        <div class="config-label">Severity Level</div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Severity</mat-label>
          <mat-select [(ngModel)]="severity">
            <mat-option value="INFO">Info — informational only</mat-option>
            <mat-option value="WARNING">Warning — requires acknowledgement</mat-option>
            <mat-option value="BLOCK">Block — prevents submission</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="config-section">
        <div class="config-label">Parameters</div>
        @for (key of paramKeys; track key) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ getParamLabel(key) }}</mat-label>
            @if (isBoolean(params[key])) {
              <mat-select [(ngModel)]="params[key]">
                <mat-option [value]="true">Yes</mat-option>
                <mat-option [value]="false">No</mat-option>
              </mat-select>
            } @else {
              <input matInput type="number" [(ngModel)]="params[key]" />
            }
          </mat-form-field>
        }
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
        Save Changes
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
    .dialog-description {
      font-size: 14px;
      color: #475569;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }
    .config-section {
      margin-bottom: 16px;
    }
    .config-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      margin-bottom: 8px;
    }
    .full-width { width: 100%; }
    .error-text { color: #dc2626; font-size: 13px; }
    .btn-spinner { display: inline-block; margin-right: 4px; }
  `],
})
export class PolicyRuleEditDialogComponent {
  severity: string;
  params: Record<string, any>;
  paramKeys: string[];
  saving = false;
  error = '';

  constructor(
    private dialogRef: MatDialogRef<PolicyRuleEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { rule: PolicyRule; checkInfo: { label: string; description: string } },
    private policyService: PolicyRulesService,
  ) {
    this.severity = data.rule.severity;
    this.params = { ...data.rule.params };
    this.paramKeys = Object.keys(this.params);
  }

  getParamLabel(key: string): string {
    return PARAM_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }

  isBoolean(value: any): boolean {
    return typeof value === 'boolean';
  }

  save() {
    this.saving = true;
    this.error = '';

    this.policyService.updatePolicyRule(this.data.rule.id, {
      severity: this.severity,
      params: this.params,
    }).subscribe({
      next: (result) => {
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.error || 'Failed to save changes';
      },
    });
  }
}

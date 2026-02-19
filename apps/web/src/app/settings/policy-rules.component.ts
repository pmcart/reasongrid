import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { PolicyRulesService, PolicyRule } from '../core/policy-rules.service';
import { PolicyRuleEditDialogComponent } from './policy-rule-edit-dialog.component';

const CHECK_TYPE_INFO: Record<string, { label: string; description: string; icon: string }> = {
  GENDER_GAP_IMPACT: {
    label: 'Gender Gap Impact',
    description: 'Evaluates how a pay change affects the gender pay gap in the comparator group',
    icon: 'wc',
  },
  SALARY_RANGE_COMPLIANCE: {
    label: 'Salary Range Compliance',
    description: 'Checks if proposed pay falls within the defined salary range for the role',
    icon: 'straighten',
  },
  MEDIAN_DEVIATION: {
    label: 'Peer Median Deviation',
    description: 'Measures how far the proposed pay deviates from the peer group median',
    icon: 'bar_chart',
  },
  HISTORICAL_CONSISTENCY: {
    label: 'Historical Consistency',
    description: 'Compares the proposed pay to recent similar decisions for consistency',
    icon: 'history',
  },
  CHANGE_MAGNITUDE: {
    label: 'Change Magnitude',
    description: 'Flags unusually large percentage changes in base salary',
    icon: 'trending_up',
  },
};

@Component({
  selector: 'app-policy-rules',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatSlideToggleModule, MatSelectModule, MatFormFieldModule, MatInputModule,
    MatSnackBarModule, MatDialogModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Policy Rules</h1>
          <p class="page-subtitle">Configure the evaluation checks that run when pay decisions are proposed. These rules govern what triggers warnings or blocks during the approval workflow.</p>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">Loading policy rules...</div>
      }

      <div class="rules-grid">
        @for (rule of rules; track rule.id) {
          <mat-card class="rule-card" [class.disabled]="!rule.enabled">
            <div class="rule-header">
              <div class="rule-icon-wrap" [class]="'severity-' + rule.severity.toLowerCase()">
                <mat-icon>{{ getCheckInfo(rule.checkType).icon }}</mat-icon>
              </div>
              <div class="rule-header-info">
                <h3 class="rule-name">{{ getCheckInfo(rule.checkType).label }}</h3>
                <p class="rule-description">{{ getCheckInfo(rule.checkType).description }}</p>
              </div>
              <mat-slide-toggle [checked]="rule.enabled" (change)="toggleEnabled(rule)"
                                color="primary"></mat-slide-toggle>
            </div>

            <div class="rule-config">
              <div class="config-row">
                <div class="config-item">
                  <span class="config-label">Severity</span>
                  <span class="severity-badge" [class]="'sev-' + rule.severity.toLowerCase()">
                    {{ rule.severity }}
                  </span>
                </div>
                <div class="config-item">
                  <span class="config-label">Parameters</span>
                  <span class="config-value">{{ formatParams(rule.params) }}</span>
                </div>
              </div>
              <button mat-stroked-button class="edit-btn" (click)="editRule(rule)">
                <mat-icon>settings</mat-icon>
                Configure
              </button>
            </div>
          </mat-card>
        }
      </div>

      <div class="disclaimer">
        <mat-icon>info</mat-icon>
        <span>Policy rules are evaluated in real-time when users propose pay changes. Rules set to BLOCK severity will prevent submission; WARNING severity requires acknowledgement before proceeding.</span>
      </div>
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 24px;
    }

    .page-title {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 6px 0 0 0;
      max-width: 640px;
      line-height: 1.5;
    }

    .loading-state {
      text-align: center;
      padding: 48px;
      color: #94a3b8;
    }

    .rules-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .rule-card {
      padding: 20px 24px !important;
      transition: opacity 0.2s;
    }

    .rule-card.disabled {
      opacity: 0.6;
    }

    .rule-header {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 16px;
    }

    .rule-icon-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 42px;
      height: 42px;
      border-radius: 10px;
      flex-shrink: 0;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .severity-info { background: #eef2ff; color: #4f46e5; }
    .severity-warning { background: #fffbeb; color: #d97706; }
    .severity-block { background: #fef2f2; color: #dc2626; }

    .rule-header-info {
      flex: 1;
    }

    .rule-name {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .rule-description {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0 0;
      line-height: 1.4;
    }

    .rule-config {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .config-row {
      display: flex;
      gap: 24px;
      flex: 1;
    }

    .config-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .config-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }

    .config-value {
      font-size: 13px;
      color: #475569;
    }

    .severity-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .sev-info { background: #eef2ff; color: #4f46e5; }
    .sev-warning { background: #fef3c7; color: #92400e; }
    .sev-block { background: #fee2e2; color: #991b1b; }

    .edit-btn {
      white-space: nowrap;
    }

    .disclaimer {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 24px;
      padding: 14px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #475569;
      font-size: 13px;
      line-height: 1.5;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #94a3b8;
        margin-top: 1px;
        flex-shrink: 0;
      }
    }
  `],
})
export class PolicyRulesComponent implements OnInit {
  rules: PolicyRule[] = [];
  loading = true;

  constructor(
    private policyService: PolicyRulesService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.loadRules();
  }

  getCheckInfo(checkType: string) {
    return CHECK_TYPE_INFO[checkType] ?? { label: checkType, description: '', icon: 'rule' };
  }

  formatParams(params: Record<string, any>): string {
    return Object.entries(params)
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').trim()}: ${v}`)
      .join(', ');
  }

  toggleEnabled(rule: PolicyRule) {
    const newEnabled = !rule.enabled;
    this.policyService.updatePolicyRule(rule.id, { enabled: newEnabled }).subscribe({
      next: (updated) => {
        rule.enabled = updated.enabled;
        this.snackBar.open(
          `${this.getCheckInfo(rule.checkType).label} ${newEnabled ? 'enabled' : 'disabled'}`,
          'OK',
          { duration: 2000 },
        );
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to update', 'OK', { duration: 3000 });
      },
    });
  }

  editRule(rule: PolicyRule) {
    const dialogRef = this.dialog.open(PolicyRuleEditDialogComponent, {
      width: '500px',
      data: { rule, checkInfo: this.getCheckInfo(rule.checkType) },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const idx = this.rules.findIndex((r) => r.id === result.id);
        if (idx >= 0) this.rules[idx] = result;
      }
    });
  }

  private loadRules() {
    this.policyService.getPolicyRules().subscribe({
      next: (rules) => {
        this.rules = rules;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}

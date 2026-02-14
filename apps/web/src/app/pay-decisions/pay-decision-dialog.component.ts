import { Component, Inject, OnInit } from '@angular/core';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RationaleService, RationaleDefinition } from '../core/rationale.service';

const DECISION_TYPES = ['NEW_HIRE', 'PROMOTION', 'ADJUSTMENT', 'ANNUAL_INCREASE', 'OTHER'];

const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURAL: 'Structural',
  MARKET: 'Market',
  PERFORMANCE: 'Performance',
  TEMPORARY: 'Temporary',
  OTHER: 'Other',
};

interface RationaleGroup {
  category: string;
  categoryLabel: string;
  rationales: RationaleDefinition[];
}

interface OrgUser {
  id: string;
  email: string;
  role: string;
}

@Component({
  selector: 'app-pay-decision-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonModule, MatDatepickerModule,
    MatNativeDateModule, MatIconModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <div class="dialog-header-content">
        <mat-icon class="dialog-header-icon">description</mat-icon>
        <div>
          <h2 class="dialog-title">{{ isEditMode ? 'Edit Pay Decision' : 'Record Pay Decision' }}</h2>
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
        @if (form.payBeforeBase && form.payAfterBase && form.payBeforeBase > 0) {
          <div class="change-indicator" [class.positive]="changePercent > 0" [class.negative]="changePercent < 0">
            {{ changePercent > 0 ? '+' : '' }}{{ changePercent | number:'1.1-1' }}% change
          </div>
        }
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Bonus Before (optional)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payBeforeBonus" />
          </mat-form-field>
          <mat-icon class="arrow-between">arrow_forward</mat-icon>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Bonus After (optional)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payAfterBonus" />
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>LTI Before (optional)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payBeforeLti" />
          </mat-form-field>
          <mat-icon class="arrow-between">arrow_forward</mat-icon>
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>LTI After (optional)</mat-label>
            <span matPrefix class="currency-prefix">{{ data.employee?.currency }}&nbsp;</span>
            <input matInput type="number" [(ngModel)]="form.payAfterLti" />
          </mat-form-field>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-label">Rationale & Evidence</div>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rationale</mat-label>
          <mat-select [(ngModel)]="form.rationaleSelections" multiple required>
            @for (group of rationaleGroups; track group.category) {
              <mat-optgroup [label]="group.categoryLabel">
                @for (r of group.rationales; track r.id) {
                  <mat-option [value]="r.id">{{ r.name }}</mat-option>
                }
              </mat-optgroup>
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

      <div class="form-section">
        <div class="form-section-label">Accountability</div>
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Owner</mat-label>
            <mat-select [(ngModel)]="form.accountableOwnerUserId">
              @for (u of users; track u.id) {
                <mat-option [value]="u.id">{{ u.email }}</mat-option>
              }
            </mat-select>
            <mat-hint>Defaults to you if not selected</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Approver</mat-label>
            <mat-select [(ngModel)]="form.approverUserId" required>
              @for (u of users; track u.id) {
                <mat-option [value]="u.id">{{ u.email }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
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
        {{ isEditMode ? 'Update Draft' : 'Save as Draft' }}
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
      max-height: 70vh;
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

    .change-indicator {
      font-size: 13px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-bottom: 12px;
      background: #f1f5f9;
      color: #64748b;
    }

    .change-indicator.positive {
      background: #ecfdf5;
      color: #059669;
    }

    .change-indicator.negative {
      background: #fef2f2;
      color: #dc2626;
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
export class PayDecisionDialogComponent implements OnInit {
  decisionTypes = DECISION_TYPES;
  rationaleGroups: RationaleGroup[] = [];
  users: OrgUser[] = [];
  saving = false;
  errorMessage = '';

  isEditMode = false;

  form: any = {
    decisionType: '',
    effectiveDate: new Date(),
    payBeforeBase: null,
    payAfterBase: null,
    payBeforeBonus: null,
    payAfterBonus: null,
    payBeforeLti: null,
    payAfterLti: null,
    rationaleSelections: [],
    supportingContext: '',
    evidenceReference: null,
    accountableOwnerUserId: '',
    approverUserId: '',
  };

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    private rationaleService: RationaleService,
    private dialogRef: MatDialogRef<PayDecisionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { employee: any; decision?: any },
  ) {
    if (data.decision) {
      this.isEditMode = true;
      const d = data.decision;
      this.form = {
        decisionType: d.decisionType,
        effectiveDate: new Date(d.effectiveDate),
        payBeforeBase: d.payBeforeBase,
        payAfterBase: d.payAfterBase,
        payBeforeBonus: d.payBeforeBonus,
        payAfterBonus: d.payAfterBonus,
        payBeforeLti: d.payBeforeLti,
        payAfterLti: d.payAfterLti,
        rationaleSelections: d.rationales?.map((r: any) => r.rationaleDefinitionId) ?? [],
        supportingContext: d.supportingContext ?? '',
        evidenceReference: d.evidenceReference,
        accountableOwnerUserId: d.accountableOwnerUserId ?? '',
        approverUserId: d.approverUserId ?? '',
      };
    } else if (data.employee) {
      this.form.payBeforeBase = data.employee.baseSalary;
      this.form.payBeforeBonus = data.employee.bonusTarget;
      this.form.payBeforeLti = data.employee.ltiTarget;
      const user = this.auth.user();
      if (user) {
        this.form.accountableOwnerUserId = user.id;
      }
    }
  }

  ngOnInit() {
    this.api.get<OrgUser[]>('/auth/users').subscribe({
      next: (users) => (this.users = users),
      error: () => {},
    });
    this.rationaleService.getActive().subscribe({
      next: (defs) => {
        this.rationaleGroups = this.groupByCategory(defs);
      },
      error: () => {},
    });
  }

  private groupByCategory(defs: RationaleDefinition[]): RationaleGroup[] {
    const map = new Map<string, RationaleDefinition[]>();
    for (const def of defs) {
      const list = map.get(def.category) ?? [];
      list.push(def);
      map.set(def.category, list);
    }
    const order = ['STRUCTURAL', 'MARKET', 'PERFORMANCE', 'TEMPORARY', 'OTHER'];
    return order
      .filter((cat) => map.has(cat))
      .map((cat) => ({
        category: cat,
        categoryLabel: CATEGORY_LABELS[cat] ?? cat,
        rationales: map.get(cat)!,
      }));
  }

  get changePercent(): number {
    if (!this.form.payBeforeBase || this.form.payBeforeBase === 0) return 0;
    return ((this.form.payAfterBase - this.form.payBeforeBase) / this.form.payBeforeBase) * 100;
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  isValid(): boolean {
    return (
      !!this.form.decisionType &&
      !!this.form.effectiveDate &&
      this.form.payBeforeBase != null &&
      this.form.payAfterBase != null &&
      this.form.rationaleSelections.length > 0 &&
      !!this.form.supportingContext &&
      !!this.form.approverUserId
    );
  }

  save() {
    if (!this.isValid()) return;
    this.saving = true;
    this.errorMessage = '';

    const payload = {
      ...this.form,
      effectiveDate: new Date(this.form.effectiveDate).toISOString(),
      accountableOwnerUserId: this.form.accountableOwnerUserId || undefined,
    };

    const request$ = this.isEditMode
      ? this.api.patch(`/pay-decisions/${this.data.decision.id}`, payload)
      : this.api.post(`/pay-decisions/employee/${this.data.employee.id}`, payload);

    request$.subscribe({
      next: (result) => {
        this.snackBar.open(
          this.isEditMode ? 'Pay decision updated' : 'Pay decision saved as draft',
          'OK',
          { duration: 3000 },
        );
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to save pay decision';
      },
    });
  }
}

import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RationaleService, RationaleDefinition } from '../core/rationale.service';
import { EvaluationService, EvaluationResult } from '../core/evaluation.service';
import { EvaluationPanelComponent } from './evaluation-panel.component';

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
  selector: 'app-pay-decision-form',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule,
    MatIconModule, MatSnackBarModule, MatProgressSpinnerModule, MatCardModule,
    MatCheckboxModule, EvaluationPanelComponent,
  ],
  template: `
    <mat-card class="form-card">
      <div class="form-header">
        <div class="form-header-content">
          <mat-icon class="form-header-icon">description</mat-icon>
          <div>
            <h3 class="form-title">{{ isEditMode ? 'Edit Pay Decision' : 'Propose Pay Change' }}</h3>
            <p class="form-subtitle">{{ employee?.employeeId }} &middot; {{ employee?.roleTitle }}</p>
          </div>
        </div>
      </div>

      <div class="form-body">
        <div class="form-section">
          <div class="form-section-label">Decision Details</div>
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Decision Type</mat-label>
              <mat-select [(ngModel)]="form.decisionType" (ngModelChange)="onEvalInputChange()" required>
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
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
              <input matInput type="number" [(ngModel)]="form.payBeforeBase" required />
            </mat-form-field>
            <mat-icon class="arrow-between">arrow_forward</mat-icon>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Pay After (Base)</mat-label>
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
              <input matInput type="number" [(ngModel)]="form.payAfterBase"
                     (ngModelChange)="onPayAfterChange($event)" required />
            </mat-form-field>
          </div>
          @if (form.payBeforeBase && form.payAfterBase && form.payBeforeBase > 0) {
            <div class="change-indicator" [class.positive]="changePercent > 0" [class.negative]="changePercent < 0">
              {{ changePercent > 0 ? '+' : '' }}{{ changePercent | number:'1.1-1' }}% change
            </div>
          }

          <!-- Evaluation Panel (live feedback) -->
          <app-evaluation-panel
            [result]="evaluationResult"
            [loading]="evaluationLoading"
            [error]="evaluationError">
          </app-evaluation-panel>

          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Bonus Before (optional)</mat-label>
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
              <input matInput type="number" [(ngModel)]="form.payBeforeBonus" />
            </mat-form-field>
            <mat-icon class="arrow-between">arrow_forward</mat-icon>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Bonus After (optional)</mat-label>
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
              <input matInput type="number" [(ngModel)]="form.payAfterBonus" />
            </mat-form-field>
          </div>
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>LTI Before (optional)</mat-label>
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
              <input matInput type="number" [(ngModel)]="form.payBeforeLti" />
            </mat-form-field>
            <mat-icon class="arrow-between">arrow_forward</mat-icon>
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>LTI After (optional)</mat-label>
              <span matPrefix class="currency-prefix">{{ employee?.currency }}&nbsp;</span>
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

        <!-- Warning acknowledgement (when evaluation has warnings) -->
        @if (evaluationResult?.overallStatus === 'WARNING' && warningCheckTypes.length > 0) {
          <div class="form-section">
            <div class="warning-ack-box">
              <mat-checkbox [(ngModel)]="warningsAcknowledged" color="warn">
                I acknowledge the policy warnings above and confirm this decision should proceed for review
              </mat-checkbox>
            </div>
          </div>
        }
      </div>

      <div class="form-actions">
        @if (errorMessage) {
          <span class="error-text">{{ errorMessage }}</span>
        }
        <button mat-button (click)="cancel()" [disabled]="saving || submitting">Cancel</button>
        <button mat-raised-button (click)="save()" [disabled]="saving || submitting || !isValid()">
          @if (saving) {
            <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          {{ isEditMode ? 'Update Draft' : 'Save Draft' }}
        </button>
        @if (isEditMode && canSubmit) {
          <button mat-raised-button color="primary" (click)="submitForReview()"
                  [disabled]="submitting || !isValid() || isSubmitBlocked">
            @if (submitting) {
              <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
            } @else {
              <mat-icon>send</mat-icon>
            }
            Submit for Review
          </button>
        }
      </div>
    </mat-card>
  `,
  styles: [`
    .form-card {
      margin-bottom: 24px;
      overflow: hidden;
    }

    .form-header {
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e2e8f0;
    }

    .form-header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .form-header-icon {
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

    .form-title {
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .form-subtitle {
      font-size: 13px;
      color: #64748b;
      margin: 2px 0 0 0;
    }

    .form-body {
      padding: 0 24px;
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

    .warning-ack-box {
      padding: 12px 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
    }

    .form-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
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
  `],
})
export class PayDecisionFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() employee: any;
  @Input() decision: any = null;
  @Output() saved = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  decisionTypes = DECISION_TYPES;
  rationaleGroups: RationaleGroup[] = [];
  users: OrgUser[] = [];
  saving = false;
  submitting = false;
  errorMessage = '';
  isEditMode = false;

  // Evaluation state
  evaluationResult: EvaluationResult | null = null;
  evaluationLoading = false;
  evaluationError: string | null = null;
  warningsAcknowledged = false;

  private evalInput$ = new Subject<{ employeeId: string; decisionType: string; payAfterBase: number }>();
  private destroy$ = new Subject<void>();

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
    private evaluationService: EvaluationService,
  ) {}

  ngOnInit() {
    this.initForm();
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

    // Debounced evaluation
    this.evalInput$.pipe(
      debounceTime(500),
      distinctUntilChanged((a, b) =>
        a.employeeId === b.employeeId && a.decisionType === b.decisionType && a.payAfterBase === b.payAfterBase
      ),
      takeUntil(this.destroy$),
    ).subscribe(({ employeeId, decisionType, payAfterBase }) => {
      this.evaluationLoading = true;
      this.evaluationError = null;
      this.evaluationService.evaluate(employeeId, decisionType, payAfterBase).subscribe({
        next: (result) => {
          this.evaluationResult = result;
          this.evaluationLoading = false;
          this.warningsAcknowledged = false;
        },
        error: (err) => {
          this.evaluationLoading = false;
          this.evaluationError = err?.error?.error || 'Failed to run evaluation';
        },
      });
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes['decision'] || changes['employee']) {
      this.initForm();
    }
  }

  private initForm() {
    this.evaluationResult = null;
    this.evaluationError = null;
    this.warningsAcknowledged = false;

    if (this.decision) {
      this.isEditMode = true;
      const d = this.decision;
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
      // Trigger evaluation on edit load
      if (d.payAfterBase && d.decisionType) {
        this.triggerEvaluation();
      }
    } else if (this.employee) {
      this.isEditMode = false;
      this.form = {
        decisionType: '',
        effectiveDate: new Date(),
        payBeforeBase: this.employee.baseSalary,
        payAfterBase: null,
        payBeforeBonus: this.employee.bonusTarget,
        payAfterBonus: null,
        payBeforeLti: this.employee.ltiTarget,
        payAfterLti: null,
        rationaleSelections: [],
        supportingContext: '',
        evidenceReference: null,
        accountableOwnerUserId: this.auth.user()?.id ?? '',
        approverUserId: '',
      };
    }
    this.errorMessage = '';
    this.saving = false;
    this.submitting = false;
  }

  onPayAfterChange(_value: number) {
    this.triggerEvaluation();
  }

  onEvalInputChange() {
    this.triggerEvaluation();
  }

  private triggerEvaluation() {
    if (this.employee?.id && this.form.decisionType && this.form.payAfterBase > 0) {
      this.evalInput$.next({
        employeeId: this.employee.id,
        decisionType: this.form.decisionType,
        payAfterBase: this.form.payAfterBase,
      });
    }
  }

  get changePercent(): number {
    if (!this.form.payBeforeBase || this.form.payBeforeBase === 0) return 0;
    return ((this.form.payAfterBase - this.form.payBeforeBase) / this.form.payBeforeBase) * 100;
  }

  get warningCheckTypes(): string[] {
    if (!this.evaluationResult) return [];
    return this.evaluationResult.checks
      .filter(c => c.status === 'WARNING')
      .map(c => c.checkType);
  }

  get isSubmitBlocked(): boolean {
    if (!this.evaluationResult) return true;
    if (this.evaluationResult.overallStatus === 'BLOCK') return true;
    if (this.evaluationResult.overallStatus === 'WARNING' && !this.warningsAcknowledged) return true;
    return false;
  }

  get canSubmit(): boolean {
    return this.decision?.status === 'DRAFT' || this.decision?.status === 'RETURNED';
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

  cancel() {
    this.cancelled.emit();
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
      ? this.api.patch(`/pay-decisions/${this.decision.id}`, payload)
      : this.api.post(`/pay-decisions/employee/${this.employee.id}`, payload);

    request$.subscribe({
      next: (result) => {
        this.snackBar.open(
          this.isEditMode ? 'Pay decision updated' : 'Pay decision saved as draft',
          'OK',
          { duration: 3000 },
        );
        this.saved.emit(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to save pay decision';
      },
    });
  }

  submitForReview() {
    if (!this.decision?.id || !this.isValid()) return;
    this.submitting = true;
    this.errorMessage = '';

    // First save any changes
    const payload = {
      ...this.form,
      effectiveDate: new Date(this.form.effectiveDate).toISOString(),
      accountableOwnerUserId: this.form.accountableOwnerUserId || undefined,
    };

    this.api.patch(`/pay-decisions/${this.decision.id}`, payload).subscribe({
      next: () => {
        // Then submit
        const submitPayload: any = {};
        if (this.warningCheckTypes.length > 0 && this.warningsAcknowledged) {
          submitPayload.warningAcknowledgements = this.warningCheckTypes;
        }
        this.api.post(`/pay-decisions/${this.decision.id}/submit`, submitPayload).subscribe({
          next: (result) => {
            this.snackBar.open('Pay decision submitted for review', 'OK', { duration: 3000 });
            this.saved.emit(result);
          },
          error: (err) => {
            this.submitting = false;
            this.errorMessage = err?.error?.error || 'Failed to submit for review';
          },
        });
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage = err?.error?.error || 'Failed to save changes before submitting';
      },
    });
  }
}

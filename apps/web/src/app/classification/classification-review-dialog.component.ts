import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClassificationService, ClassificationDimension, RoleClassification, RoleClassificationTag } from '../core/classification.service';

interface DimensionEntry {
  dimension: ClassificationDimension;
  value: string;
  numericValue: number;
  notes: string;
  aiConfidence: number | null;
}

@Component({
  selector: 'app-classification-review-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatSliderModule, MatTooltipModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog-header">
      <mat-icon class="dialog-header-icon">rate_review</mat-icon>
      <div class="header-info">
        <h2 class="dialog-title">Review Role Classification</h2>
        <div class="role-meta">
          <span class="meta-chip role-chip">{{ classification.roleTitle }}</span>
          <span class="meta-chip level-chip">{{ classification.level }}</span>
          <span class="meta-chip country-chip">{{ classification.country }}</span>
          @if (classification.jobFamily) {
            <span class="meta-chip jf-chip">{{ classification.jobFamily }}</span>
          }
          <span class="meta-chip count-chip">{{ classification.employeeCount ?? 0 }} employee{{ (classification.employeeCount ?? 0) !== 1 ? 's' : '' }}</span>
        </div>
      </div>
    </div>

    <mat-dialog-content>
      <div class="section">
        <label class="section-label">Job Description</label>
        <mat-form-field appearance="outline" class="full-width">
          <textarea matInput [(ngModel)]="jobDescription" rows="3"
                    placeholder="Describe the role responsibilities and requirements..."></textarea>
        </mat-form-field>
      </div>

      @if (classification.status === 'AI_SUGGESTED' && classification.aiModel) {
        <div class="ai-notice">
          <mat-icon>auto_awesome</mat-icon>
          <span>AI-suggested classification from <strong>{{ classification.aiModel }}</strong>.
            Review and adjust scores before confirming.</span>
        </div>
      }

      <div class="dimensions-section">
        <label class="section-label">Classification Dimensions</label>

        @for (entry of dimensionEntries; track entry.dimension.id) {
          <div class="dimension-card">
            <div class="dimension-header">
              <div class="dimension-info">
                <h4 class="dimension-name">{{ entry.dimension.name }}</h4>
                @if (entry.dimension.description) {
                  <p class="dimension-desc">{{ entry.dimension.description }}</p>
                }
              </div>
              @if (entry.aiConfidence !== null) {
                <span class="confidence-badge" matTooltip="AI confidence score">
                  {{ (entry.aiConfidence * 100) | number:'1.0-0' }}% confidence
                </span>
              }
            </div>

            <div class="dimension-input">
              @if (entry.dimension.scaleType === 'NUMERIC_1_5') {
                <div class="slider-row">
                  <mat-slider min="1" max="5" step="1" discrete [displayWith]="displaySliderValue">
                    <input matSliderThumb [(ngModel)]="entry.numericValue" />
                  </mat-slider>
                  <span class="slider-value">{{ entry.numericValue }}</span>
                </div>
              } @else if (entry.dimension.scaleType === 'NUMERIC_1_10') {
                <div class="slider-row">
                  <mat-slider min="1" max="10" step="1" discrete [displayWith]="displaySliderValue">
                    <input matSliderThumb [(ngModel)]="entry.numericValue" />
                  </mat-slider>
                  <span class="slider-value">{{ entry.numericValue }}</span>
                </div>
              } @else {
                <mat-form-field appearance="outline" class="full-width compact-field">
                  <mat-label>Value</mat-label>
                  <input matInput [(ngModel)]="entry.value" placeholder="Enter classification value" />
                </mat-form-field>
              }
            </div>

            @if (entry.notes) {
              <div class="ai-reasoning">
                <mat-icon class="reasoning-icon">psychology</mat-icon>
                <span>{{ entry.notes }}</span>
              </div>
            }
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      @if (errorMessage) {
        <span class="error-text">{{ errorMessage }}</span>
      }
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-stroked-button (click)="reclassifyWithAi()" [disabled]="saving" matTooltip="Re-run AI classification for this role">
        @if (reclassifying) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        } @else {
          <mat-icon>auto_awesome</mat-icon>
        }
        Re-classify with AI
      </button>
      <button mat-stroked-button color="primary" (click)="saveDraft()" [disabled]="saving">
        <mat-icon>save</mat-icon>
        Save Draft
      </button>
      <button mat-raised-button color="primary" (click)="confirm()" [disabled]="saving">
        @if (confirming) {
          <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
        } @else {
          <mat-icon>check_circle</mat-icon>
        }
        Confirm
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
      margin: 0 0 8px 0;
    }

    .role-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .meta-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .role-chip { background: #f1f5f9; color: #334155; font-weight: 600; }
    .level-chip { background: #eef2ff; color: #4f46e5; }
    .country-chip { background: #eef2ff; color: #4f46e5; }
    .jf-chip { background: #f1f5f9; color: #475569; }
    .count-chip { background: #f8fafc; color: #94a3b8; }

    mat-dialog-content {
      min-width: 620px;
      max-height: 65vh;
      padding: 16px 24px !important;
    }

    .full-width { width: 100%; }

    .section {
      margin-bottom: 16px;
    }

    .section-label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      margin-bottom: 8px;
    }

    .ai-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 6px;
      font-size: 13px;
      color: #92400e;
      margin-bottom: 16px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #d97706;
        flex-shrink: 0;
      }
    }

    .dimensions-section {
      margin-bottom: 8px;
    }

    .dimension-card {
      padding: 14px 16px;
      margin-bottom: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .dimension-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 10px;
    }

    .dimension-name {
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .dimension-desc {
      font-size: 12px;
      color: #64748b;
      margin: 2px 0 0 0;
      line-height: 1.4;
    }

    .confidence-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #fde68a;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .dimension-input {
      margin-bottom: 4px;
    }

    .slider-row {
      display: flex;
      align-items: center;
      gap: 16px;

      mat-slider {
        flex: 1;
      }
    }

    .slider-value {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .compact-field {
      margin-bottom: 0;
    }

    .ai-reasoning {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 8px 10px;
      margin-top: 8px;
      background: #fffbeb;
      border-radius: 4px;
      font-size: 12px;
      color: #92400e;
      line-height: 1.4;

      .reasoning-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #d97706;
        margin-top: 1px;
        flex-shrink: 0;
      }
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
      flex-wrap: wrap;
    }
  `],
})
export class ClassificationReviewDialogComponent implements OnInit {
  classification: RoleClassification;
  dimensionEntries: DimensionEntry[] = [];
  jobDescription = '';
  saving = false;
  confirming = false;
  reclassifying = false;
  errorMessage = '';

  displaySliderValue = (value: number): string => `${value}`;

  constructor(
    private classificationService: ClassificationService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<ClassificationReviewDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      classification: RoleClassification;
      dimensions: ClassificationDimension[];
    },
  ) {
    this.classification = data.classification;
  }

  ngOnInit() {
    this.jobDescription = this.classification.jobDescription ?? '';
    this.buildDimensionEntries();
  }

  confirm() {
    this.confirming = true;
    this.saving = true;
    this.errorMessage = '';

    const tags = this.buildTagsPayload();

    this.classificationService.confirmClassification(this.classification.id, tags).subscribe({
      next: (result) => {
        this.snackBar.open('Classification confirmed', 'OK', { duration: 3000 });
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.confirming = false;
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to confirm classification';
      },
    });
  }

  saveDraft() {
    this.saving = true;
    this.errorMessage = '';

    const tags = this.buildTagsPayload();
    const payload = {
      jobDescription: this.jobDescription,
      tags,
    };

    this.classificationService.updateClassification(this.classification.id, payload).subscribe({
      next: (result) => {
        this.snackBar.open('Draft saved', 'OK', { duration: 3000 });
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.saving = false;
        this.errorMessage = err?.error?.error || 'Failed to save draft';
      },
    });
  }

  reclassifyWithAi() {
    this.reclassifying = true;
    this.saving = true;
    this.errorMessage = '';

    this.classificationService.aiClassifySingle(this.classification.id).subscribe({
      next: (result) => {
        this.reclassifying = false;
        this.saving = false;
        this.classification = result;
        this.jobDescription = result.jobDescription ?? this.jobDescription;
        this.buildDimensionEntries();
        this.snackBar.open('AI classification updated', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.reclassifying = false;
        this.saving = false;
        this.errorMessage = err?.error?.error || 'AI classification failed';
      },
    });
  }

  private buildDimensionEntries() {
    const tagMap = new Map<string, RoleClassificationTag>();
    for (const tag of this.classification.tags ?? []) {
      tagMap.set(tag.dimensionId, tag);
    }

    this.dimensionEntries = this.data.dimensions.map((dim) => {
      const tag = tagMap.get(dim.id);
      const defaultNumeric = dim.scaleType === 'NUMERIC_1_5' ? 3 : dim.scaleType === 'NUMERIC_1_10' ? 5 : 0;
      return {
        dimension: dim,
        value: tag?.value ?? '',
        numericValue: tag?.numericValue ?? defaultNumeric,
        notes: tag?.notes ?? '',
        aiConfidence: tag?.aiConfidence ?? null,
      };
    });
  }

  private buildTagsPayload(): { dimensionId: string; value: string; numericValue?: number; notes?: string }[] {
    return this.dimensionEntries.map((entry) => {
      const isNumeric = entry.dimension.scaleType === 'NUMERIC_1_5' || entry.dimension.scaleType === 'NUMERIC_1_10';
      return {
        dimensionId: entry.dimension.id,
        value: isNumeric ? String(entry.numericValue) : entry.value,
        numericValue: isNumeric ? entry.numericValue : undefined,
        notes: entry.notes || undefined,
      };
    });
  }
}

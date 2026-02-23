import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClassificationService, ClassificationDimension, RoleClassification } from '../core/classification.service';
import { AuthService } from '../core/auth.service';
import { ClassificationReviewDialogComponent } from './classification-review-dialog.component';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  UNCLASSIFIED: { label: 'Unclassified', bg: '#f1f5f9', text: '#64748b' },
  AI_SUGGESTED: { label: 'AI Suggested', bg: '#fffbeb', text: '#d97706' },
  CONFIRMED: { label: 'Confirmed', bg: '#f0fdf4', text: '#16a34a' },
};

@Component({
  selector: 'app-role-classification-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatTooltipModule, MatDialogModule,
    MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Role Classification</h1>
          <p class="page-subtitle">Tag roles with equal-value classification dimensions for EU Pay Transparency comparator group analysis.</p>
        </div>
        @if (canEdit) {
          <button mat-raised-button color="primary" (click)="bulkClassify()" [disabled]="classifying">
            @if (classifying) {
              <mat-spinner diameter="18" class="btn-spinner"></mat-spinner>
            } @else {
              <mat-icon>auto_awesome</mat-icon>
            }
            Classify with AI
          </button>
        }
      </div>

      @if (unclassifiedCount > 0) {
        <div class="unclassified-banner">
          <mat-icon>info</mat-icon>
          <span><strong>{{ unclassifiedCount }}</strong> role{{ unclassifiedCount !== 1 ? 's' : '' }} require classification. Use AI classification or review each role manually.</span>
        </div>
      }

      <div class="filters-bar">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="filterStatus" (ngModelChange)="applyFilters()">
            <mat-option value="">All</mat-option>
            <mat-option value="UNCLASSIFIED">Unclassified</mat-option>
            <mat-option value="AI_SUGGESTED">AI Suggested</mat-option>
            <mat-option value="CONFIRMED">Confirmed</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Country</mat-label>
          <mat-select [(ngModel)]="filterCountry" (ngModelChange)="applyFilters()">
            <mat-option value="">All</mat-option>
            @for (c of countries; track c) {
              <mat-option [value]="c">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Job Family</mat-label>
          <mat-select [(ngModel)]="filterJobFamily" (ngModelChange)="applyFilters()">
            <mat-option value="">All</mat-option>
            @for (jf of jobFamilies; track jf) {
              <mat-option [value]="jf">{{ jf }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <span class="filter-count">{{ filtered.length }} role{{ filtered.length !== 1 ? 's' : '' }}</span>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (filtered.length === 0) {
        <div class="empty-state">
          <mat-icon>work_outline</mat-icon>
          <p>No role classifications found.</p>
          <p class="empty-hint">Import employees via CSV to generate role groups for classification.</p>
        </div>
      } @else {
        <div class="roles-table">
          <div class="table-header">
            <span class="col-role">Role Title</span>
            <span class="col-level">Level</span>
            <span class="col-country">Country</span>
            <span class="col-jf">Job Family</span>
            <span class="col-count">Employees</span>
            <span class="col-status">Status</span>
            <span class="col-actions">Actions</span>
          </div>
          @for (rc of filtered; track rc.id) {
            <div class="table-row" (click)="openReview(rc)">
              <span class="col-role">{{ rc.roleTitle }}</span>
              <span class="col-level">{{ rc.level }}</span>
              <span class="col-country">
                <span class="country-badge">{{ rc.country }}</span>
              </span>
              <span class="col-jf">{{ rc.jobFamily || '—' }}</span>
              <span class="col-count">
                <span class="count-badge">{{ rc.employeeCount ?? 0 }}</span>
              </span>
              <span class="col-status">
                <span class="status-badge"
                      [style.background]="getStatusConfig(rc.status).bg"
                      [style.color]="getStatusConfig(rc.status).text">
                  {{ getStatusConfig(rc.status).label }}
                </span>
              </span>
              <span class="col-actions" (click)="$event.stopPropagation()">
                <button mat-icon-button matTooltip="Review / Edit" (click)="openReview(rc)">
                  <mat-icon>rate_review</mat-icon>
                </button>
              </span>
            </div>
          }
        </div>
      }

      <div class="disclaimer">
        <mat-icon>info</mat-icon>
        <span>Role classifications support equal-value assessment for internal governance and transparency requirements. They do not constitute legal advice.</span>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 1100px; margin: 0 auto; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
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

    .btn-spinner {
      display: inline-block;
      margin-right: 4px;
    }

    .unclassified-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      padding: 14px 18px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      font-size: 14px;
      color: #92400e;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #d97706;
        flex-shrink: 0;
      }
    }

    .filters-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .filter-field { width: 160px; }

    .filter-count {
      font-size: 13px;
      color: #94a3b8;
      margin-left: auto;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: #94a3b8;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
      }

      p {
        font-size: 15px;
        margin: 0 0 8px 0;
      }

      .empty-hint {
        font-size: 13px;
        color: #cbd5e1;
      }
    }

    .roles-table {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .table-header {
      display: flex;
      align-items: center;
      padding: 10px 16px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }

    .table-row {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      color: #334155;
      cursor: pointer;
      transition: background 0.15s;

      &:hover {
        background: #f8fafc;
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .col-role { width: 200px; flex-shrink: 0; font-weight: 500; color: #0f172a; }
    .col-level { width: 100px; flex-shrink: 0; }
    .col-country { width: 80px; flex-shrink: 0; }
    .col-jf { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .col-count { width: 90px; flex-shrink: 0; text-align: center; }
    .col-status { width: 120px; flex-shrink: 0; }
    .col-actions { width: 60px; flex-shrink: 0; display: flex; justify-content: flex-end; }

    .country-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .count-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      color: #475569;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.02em;
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
export class RoleClassificationListComponent implements OnInit {
  private classificationService = inject(ClassificationService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  allClassifications: RoleClassification[] = [];
  filtered: RoleClassification[] = [];
  dimensions: ClassificationDimension[] = [];
  loading = true;
  classifying = false;

  countries: string[] = [];
  jobFamilies: string[] = [];

  filterStatus = '';
  filterCountry = '';
  filterJobFamily = '';

  get canEdit(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get unclassifiedCount(): number {
    return this.allClassifications.filter((rc) => rc.status === 'UNCLASSIFIED').length;
  }

  ngOnInit() {
    this.loadData();
  }

  getStatusConfig(status: string): { label: string; bg: string; text: string } {
    return STATUS_CONFIG[status] ?? { label: status, bg: '#f1f5f9', text: '#64748b' };
  }

  applyFilters() {
    this.filtered = this.allClassifications.filter((rc) => {
      if (this.filterStatus && rc.status !== this.filterStatus) return false;
      if (this.filterCountry && rc.country !== this.filterCountry) return false;
      if (this.filterJobFamily && (rc.jobFamily || '') !== this.filterJobFamily) return false;
      return true;
    });
  }

  openReview(rc: RoleClassification) {
    const dialogRef = this.dialog.open(ClassificationReviewDialogComponent, {
      width: '720px',
      maxHeight: '90vh',
      data: { classification: rc, dimensions: this.dimensions },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  bulkClassify() {
    this.classifying = true;
    this.classificationService.bulkAiClassify().subscribe({
      next: (result) => {
        this.classifying = false;
        this.snackBar.open(
          `AI classification complete: ${result.successful} successful, ${result.failed} failed`,
          'OK',
          { duration: 5000 },
        );
        this.loadData();
      },
      error: (err) => {
        this.classifying = false;
        this.snackBar.open(err?.error?.error || 'AI classification failed', 'OK', { duration: 3000 });
      },
    });
  }

  private loadData() {
    this.loading = true;

    this.classificationService.getDimensions().subscribe({
      next: (dims) => {
        this.dimensions = dims.sort((a, b) => a.sortOrder - b.sortOrder);
      },
    });

    this.classificationService.getClassifications().subscribe({
      next: (classifications) => {
        this.allClassifications = classifications;
        this.countries = [...new Set(classifications.map((rc) => rc.country))].sort();
        this.jobFamilies = [...new Set(classifications.map((rc) => rc.jobFamily).filter(Boolean) as string[])].sort();
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ClassificationService, ClassificationDimension } from '../core/classification.service';
import { AuthService } from '../core/auth.service';
import { DimensionDialogComponent } from './dimension-dialog.component';

const SCALE_TYPE_LABELS: Record<string, string> = {
  NUMERIC_1_5: '1 - 5',
  NUMERIC_1_10: '1 - 10',
  LEVEL_LOW_MED_HIGH: 'Low / Med / High',
  CUSTOM: 'Custom',
};

@Component({
  selector: 'app-classification-dimensions',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTooltipModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Classification Dimensions</h1>
          <p class="page-subtitle">Define the dimensions used for EU equal-value role classification. Each dimension represents a measurable factor for assessing role equivalence.</p>
        </div>
        @if (canEdit) {
          <button mat-raised-button color="primary" (click)="createDimension()">
            <mat-icon>add</mat-icon>
            New Dimension
          </button>
        }
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (dimensions.length === 0) {
        <div class="empty-state">
          <mat-icon>category</mat-icon>
          <p>No classification dimensions defined yet.</p>
          @if (canEdit) {
            <button mat-stroked-button color="primary" (click)="createDimension()">
              <mat-icon>add</mat-icon> Add your first dimension
            </button>
          }
        </div>
      } @else {
        <div class="dimensions-table">
          <div class="table-header">
            <span class="col-code">Code</span>
            <span class="col-name">Name</span>
            <span class="col-description">Description</span>
            <span class="col-scale">Scale Type</span>
            <span class="col-default">Default</span>
            <span class="col-order">Order</span>
            @if (canEdit) {
              <span class="col-actions">Actions</span>
            }
          </div>
          @for (dim of dimensions; track dim.id) {
            <div class="table-row">
              <span class="col-code">
                <span class="code-badge">{{ dim.code }}</span>
              </span>
              <span class="col-name">{{ dim.name }}</span>
              <span class="col-description">{{ dim.description || '—' }}</span>
              <span class="col-scale">
                <span class="scale-badge">{{ getScaleLabel(dim.scaleType) }}</span>
              </span>
              <span class="col-default">
                @if (dim.isDefault) {
                  <span class="default-badge">EU Standard</span>
                }
              </span>
              <span class="col-order">{{ dim.sortOrder }}</span>
              @if (canEdit) {
                <span class="col-actions">
                  <button mat-icon-button matTooltip="Edit" (click)="editDimension(dim)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  @if (isAdmin && !dim.isDefault) {
                    <button mat-icon-button matTooltip="Delete" (click)="deleteDimension(dim)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </span>
              }
            </div>
          }
        </div>
      }

      <div class="disclaimer">
        <mat-icon>info</mat-icon>
        <span>Classification dimensions support internal governance and equal-value assessment. They do not constitute legal advice.</span>
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
        margin: 0 0 16px 0;
      }
    }

    .dimensions-table {
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
      transition: background 0.15s;

      &:hover {
        background: #f8fafc;
      }

      &:last-child {
        border-bottom: none;
      }
    }

    .col-code { width: 160px; flex-shrink: 0; }
    .col-name { width: 160px; flex-shrink: 0; font-weight: 500; color: #0f172a; }
    .col-description { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #64748b; font-size: 13px; }
    .col-scale { width: 130px; flex-shrink: 0; }
    .col-default { width: 100px; flex-shrink: 0; }
    .col-order { width: 60px; flex-shrink: 0; text-align: center; color: #94a3b8; font-size: 13px; }
    .col-actions { margin-left: auto; display: flex; gap: 4px; }

    .code-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      color: #475569;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      font-weight: 500;
    }

    .scale-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .default-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f0fdf4;
      color: #16a34a;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
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
export class ClassificationDimensionsComponent implements OnInit {
  private classificationService = inject(ClassificationService);
  private auth = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  dimensions: ClassificationDimension[] = [];
  loading = true;

  get canEdit(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  ngOnInit() {
    this.loadDimensions();
  }

  getScaleLabel(scaleType: string): string {
    return SCALE_TYPE_LABELS[scaleType] ?? scaleType;
  }

  createDimension() {
    const dialogRef = this.dialog.open(DimensionDialogComponent, {
      width: '560px',
      data: { dimension: null },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDimensions();
        this.snackBar.open('Dimension created', 'OK', { duration: 3000 });
      }
    });
  }

  editDimension(dim: ClassificationDimension) {
    const dialogRef = this.dialog.open(DimensionDialogComponent, {
      width: '560px',
      data: { dimension: dim },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDimensions();
        this.snackBar.open('Dimension updated', 'OK', { duration: 3000 });
      }
    });
  }

  deleteDimension(dim: ClassificationDimension) {
    if (!confirm(`Delete dimension "${dim.name}"? This cannot be undone.`)) return;

    this.classificationService.deleteDimension(dim.id).subscribe({
      next: () => {
        this.loadDimensions();
        this.snackBar.open('Dimension deleted', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to delete dimension', 'OK', { duration: 3000 });
      },
    });
  }

  private loadDimensions() {
    this.loading = true;
    this.classificationService.getDimensions().subscribe({
      next: (dims) => {
        this.dimensions = dims.sort((a, b) => a.sortOrder - b.sortOrder);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ComplianceService } from '../core/compliance.service';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-audit-pack',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Audit Pack Export</h1>
          <p class="page-subtitle">Generate a comprehensive audit pack for regulatory review or internal governance</p>
        </div>
      </div>

      <div class="disclaimer-banner">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>
          This information supports internal governance and transparency requirements.
          It does not constitute legal advice.
        </span>
      </div>

      <div class="audit-layout">
        <!-- Date Range Selection -->
        <mat-card class="config-card">
          <h2 class="section-title">Date Range</h2>
          <p class="section-description">Select the period to include in the audit pack. Leave empty to include all data.</p>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Date range</mat-label>
            <mat-date-range-input [rangePicker]="picker">
              <input matStartDate [(ngModel)]="dateFrom" placeholder="Start date">
              <input matEndDate [(ngModel)]="dateTo" placeholder="End date">
            </mat-date-range-input>
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-date-range-picker #picker></mat-date-range-picker>
          </mat-form-field>

          @if (dateFrom || dateTo) {
            <button mat-button class="clear-dates-btn" (click)="clearDates()">
              <mat-icon>clear</mat-icon>
              Clear dates
            </button>
          }
        </mat-card>

        <!-- Pack Contents -->
        <mat-card class="contents-card">
          <h2 class="section-title">Included in Audit Pack</h2>
          <p class="section-description">The exported ZIP file will contain the following data for the selected period.</p>

          <div class="contents-list">
            <div class="content-item">
              <mat-icon class="content-icon">people</mat-icon>
              <div>
                <span class="content-name">Employee Directory</span>
                <span class="content-desc">All employee records with current compensation data</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">gavel</mat-icon>
              <div>
                <span class="content-name">Pay Decisions</span>
                <span class="content-desc">All finalised pay decision records with rationale snapshots</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">monitoring</mat-icon>
              <div>
                <span class="content-name">Risk Analysis Results</span>
                <span class="content-desc">Comparator group risk results from all analysis runs</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">history</mat-icon>
              <div>
                <span class="content-name">Audit Log</span>
                <span class="content-desc">Complete audit trail of all system actions</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">menu_book</mat-icon>
              <div>
                <span class="content-name">Rationale Definitions</span>
                <span class="content-desc">All rationale library versions and their metadata</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">paid</mat-icon>
              <div>
                <span class="content-name">Salary Ranges</span>
                <span class="content-desc">All defined salary ranges by country, job family, and level</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">category</mat-icon>
              <div>
                <span class="content-name">Role Classifications</span>
                <span class="content-desc">Role classification mappings and equal work groupings</span>
              </div>
            </div>
            <div class="content-item">
              <mat-icon class="content-icon">verified</mat-icon>
              <div>
                <span class="content-name">Readiness Summary</span>
                <span class="content-desc">Current directive readiness metrics and coverage status</span>
              </div>
            </div>
          </div>
        </mat-card>
      </div>

      <!-- Export Action -->
      <div class="export-section">
        @if (exporting) {
          <mat-progress-bar mode="indeterminate" class="export-progress"></mat-progress-bar>
          <p class="export-status">Generating audit pack...</p>
        }

        @if (canExport) {
          <button mat-raised-button color="primary" class="export-btn"
                  (click)="exportPack()"
                  [disabled]="exporting">
            <mat-icon>{{ exporting ? 'hourglass_empty' : 'download' }}</mat-icon>
            {{ exporting ? 'Exporting...' : 'Export Audit Pack' }}
          </button>
        } @else {
          <div class="no-permission">
            <mat-icon>lock</mat-icon>
            <span>You need HR_MANAGER or ADMIN permissions to export audit packs.</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1200px;
    }

    .page-header {
      margin-bottom: 20px;
    }

    .page-header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 4px 0;
    }

    .page-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 6px 0 0 0;
      max-width: 640px;
      line-height: 1.5;
    }

    .disclaimer-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
    }

    .disclaimer-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
      flex-shrink: 0;
    }

    .audit-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
    }

    .config-card, .contents-card {
      padding: 24px !important;
      border-radius: 12px !important;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 6px 0;
    }

    .section-description {
      font-size: 13px;
      color: #64748b;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }

    .full-width {
      width: 100%;
    }

    .clear-dates-btn {
      margin-top: -8px;
    }

    /* Contents List */
    .contents-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .content-item {
      display: flex;
      align-items: flex-start;
      gap: 14px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .content-item:last-child {
      border-bottom: none;
    }

    .content-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #6366f1;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .content-name {
      display: block;
      font-size: 14px;
      font-weight: 500;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .content-desc {
      display: block;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.4;
    }

    /* Export Section */
    .export-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .export-progress {
      width: 100%;
      max-width: 400px;
    }

    .export-status {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }

    .export-btn {
      min-width: 220px;
      padding: 10px 32px;
      font-size: 15px;
    }

    .no-permission {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 20px;
      font-size: 13px;
      color: #64748b;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #94a3b8;
      }
    }

    @media (max-width: 900px) {
      .audit-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class AuditPackComponent {
  private complianceService = inject(ComplianceService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  dateFrom: Date | null = null;
  dateTo: Date | null = null;
  exporting = false;

  get canExport(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  clearDates() {
    this.dateFrom = null;
    this.dateTo = null;
  }

  exportPack() {
    this.exporting = true;

    const dateRange = this.dateFrom && this.dateTo
      ? {
          from: this.dateFrom.toISOString().split('T')[0],
          to: this.dateTo.toISOString().split('T')[0],
        }
      : undefined;

    this.complianceService.exportAuditPack(dateRange).subscribe({
      next: (blob) => {
        this.downloadBlob(blob);
        this.exporting = false;
        this.snackBar.open('Audit pack exported successfully', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to export audit pack', 'OK', { duration: 3000 });
        this.exporting = false;
      },
    });
  }

  private downloadBlob(blob: Blob) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    const dateSuffix = new Date().toISOString().split('T')[0];
    a.download = `audit-pack-${dateSuffix}.zip`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }
}

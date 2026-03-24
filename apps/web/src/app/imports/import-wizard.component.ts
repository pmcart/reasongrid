import { Component, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { ImportService } from './import.service';
import { HrisService } from '../core/hris.service';
import type { CsvUploadResponse, ImportPreview, PreviewRow, HrisConnection, HrisSyncPreview } from '@cdi/shared';
import { hrisProviderLabels } from '@cdi/shared';

const STANDARD_EMPLOYEE_FIELDS = [
  { key: 'employeeId', label: 'Employee ID', required: true },
  { key: 'roleTitle', label: 'Role Title', required: true },
  { key: 'jobFamily', label: 'Job Family', required: false },
  { key: 'level', label: 'Level', required: true },
  { key: 'country', label: 'Country', required: true },
  { key: 'location', label: 'Location', required: false },
  { key: 'currency', label: 'Currency', required: true },
  { key: 'baseSalary', label: 'Base Salary', required: true },
  { key: 'bonusTarget', label: 'Bonus Target', required: false },
  { key: 'ltiTarget', label: 'LTI Target', required: false },
  { key: 'hireDate', label: 'Hire Date', required: false },
  { key: 'employmentType', label: 'Employment Type', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'performanceRating', label: 'Performance Rating', required: false },
] as const;

interface MappingRow {
  key: string;
  label: string;
  required: boolean;
  csvColumn: string | null;
  confidence: number;
  sampleValues: string[];
}

@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Import Employees</h1>
          <p class="page-description">Choose how to import employee data</p>
        </div>
        <button mat-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          Back to Imports
        </button>
      </div>

      <!-- Source selection -->
      @if (!importSource) {
        <div class="source-picker">
          <div class="source-card" (click)="selectSource('csv')">
            <mat-icon class="source-icon">upload_file</mat-icon>
            <h3>Upload CSV File</h3>
            <p>Map and import a CSV export from your payroll or HR system. Includes AI-assisted column mapping.</p>
            <button mat-flat-button color="primary">Choose CSV</button>
          </div>
          <div class="source-card" (click)="selectSource('hris')">
            <mat-icon class="source-icon hris">hub</mat-icon>
            <h3>Sync from HRIS</h3>
            <p>Connect directly to BambooHR, HiBob, Rippling, or Personio to sync employee and salary data automatically — no file needed.</p>
            <button mat-flat-button color="accent">Connect HRIS</button>
          </div>
        </div>
      }

      <!-- HRIS flow -->
      @if (importSource === 'hris') {
        <mat-stepper #hrisStepper linear>

          <!-- Step 1: Select connection -->
          <mat-step [completed]="hrisConnectionSelected">
            <ng-template matStepLabel>Select Connection</ng-template>
            <div class="step-content">
              @if (hrisLoadingConnections) {
                <div class="center-loading">
                  <mat-spinner diameter="40"></mat-spinner>
                  <p>Loading HRIS connections…</p>
                </div>
              } @else if (hrisConnections.length === 0) {
                <div class="empty-connections">
                  <mat-icon>cable</mat-icon>
                  <h3>No HRIS connections configured</h3>
                  <p>Set up a connection to BambooHR, HiBob, Rippling, or Personio to sync employees directly.</p>
                  <a mat-flat-button color="primary" routerLink="/settings/integrations">
                    <mat-icon>settings</mat-icon> Go to Integrations Settings
                  </a>
                </div>
              } @else {
                <p class="step-desc">Select which HRIS connection to sync from:</p>
                <div class="connection-picker">
                  @for (conn of hrisConnections; track conn.id) {
                    <div class="connection-option" [class.selected]="selectedHrisConnection?.id === conn.id"
                         (click)="selectHrisConnection(conn)">
                      <mat-icon class="conn-icon" [style.color]="providerColor(conn.provider)">{{ providerIcon(conn.provider) }}</mat-icon>
                      <div class="conn-info">
                        <span class="conn-name">
                          {{ conn.name }}
                          <span class="provider-badge">{{ providerLabel(conn.provider) }}</span>
                        </span>
                        <span class="conn-sub">{{ conn.subdomain }}</span>
                        @if (conn.lastSyncAt) {
                          <span class="conn-last">Last synced {{ conn.lastSyncAt | date:'dd MMM yyyy' }}</span>
                        } @else {
                          <span class="conn-last">Never synced</span>
                        }
                      </div>
                      @if (selectedHrisConnection?.id === conn.id) {
                        <mat-icon class="selected-check">check_circle</mat-icon>
                      }
                    </div>
                  }
                </div>
                <div class="step-actions">
                  <button mat-button (click)="importSource = null">Back</button>
                  <button mat-flat-button color="primary"
                          [disabled]="!selectedHrisConnection || hrisLoadingPreview"
                          (click)="loadHrisPreview()">
                    @if (hrisLoadingPreview) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                    @else { <mat-icon>preview</mat-icon> }
                    Preview Data
                  </button>
                </div>
              }
            </div>
          </mat-step>

          <!-- Step 2: Preview -->
          <mat-step [completed]="hrisSyncStarted">
            <ng-template matStepLabel>Preview & Confirm</ng-template>
            <div class="step-content">
              @if (hrisPreview) {
                <div class="preview-summary">
                  <div class="summary-card success">
                    <span class="summary-number">{{ hrisPreview.totalEmployees }}</span>
                    <span class="summary-label">Employees Found</span>
                  </div>
                  @if (hrisPreview.fetchErrors > 0) {
                    <div class="summary-card warning">
                      <span class="summary-number">{{ hrisPreview.fetchErrors }}</span>
                      <span class="summary-label">Skipped (Errors)</span>
                    </div>
                  }
                </div>

                <h3 class="preview-heading">Sample (first {{ hrisPreview.sample.length }} employees)</h3>
                <div class="preview-table-wrapper">
                  <table mat-table [dataSource]="hrisPreview.sample" class="preview-table">
                    <ng-container matColumnDef="employeeId">
                      <th mat-header-cell *matHeaderCellDef>Employee ID</th>
                      <td mat-cell *matCellDef="let r">{{ r.employeeId }}</td>
                    </ng-container>
                    <ng-container matColumnDef="roleTitle">
                      <th mat-header-cell *matHeaderCellDef>Role Title</th>
                      <td mat-cell *matCellDef="let r">{{ r.roleTitle }}</td>
                    </ng-container>
                    <ng-container matColumnDef="jobFamily">
                      <th mat-header-cell *matHeaderCellDef>Job Family</th>
                      <td mat-cell *matCellDef="let r">{{ r.jobFamily ?? '—' }}</td>
                    </ng-container>
                    <ng-container matColumnDef="level">
                      <th mat-header-cell *matHeaderCellDef>Level</th>
                      <td mat-cell *matCellDef="let r">{{ r.level }}</td>
                    </ng-container>
                    <ng-container matColumnDef="country">
                      <th mat-header-cell *matHeaderCellDef>Country</th>
                      <td mat-cell *matCellDef="let r">{{ r.country }}</td>
                    </ng-container>
                    <ng-container matColumnDef="baseSalary">
                      <th mat-header-cell *matHeaderCellDef>Base Salary</th>
                      <td mat-cell *matCellDef="let r">{{ r.currency }} {{ r.baseSalary | number:'1.0-0' }}</td>
                    </ng-container>
                    <tr mat-header-row *matHeaderRowDef="hrisPreviewColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: hrisPreviewColumns;"></tr>
                  </table>
                </div>

                @if (hrisPreview.errors.length > 0) {
                  <div class="hris-errors">
                    <mat-icon>warning</mat-icon>
                    <strong>{{ hrisPreview.errors.length }} employee{{ hrisPreview.errors.length > 1 ? 's' : '' }} will be skipped</strong>
                    — missing required fields (employee ID, role title, country, or salary).
                  </div>
                }

                <div class="step-actions">
                  <button mat-button matStepperPrevious>Back</button>
                  <button mat-flat-button color="primary" [disabled]="hrisConfirming" (click)="confirmHrisSync()">
                    @if (hrisConfirming) { <mat-spinner diameter="18" style="display:inline-block;margin-right:6px"></mat-spinner> }
                    @else { <mat-icon>sync</mat-icon> }
                    Start Sync
                  </button>
                </div>
              }
            </div>
          </mat-step>

          <!-- Step 3: Results -->
          <mat-step>
            <ng-template matStepLabel>Results</ng-template>
            <div class="step-content">
              @if (polling) {
                <div class="results-loading">
                  <mat-spinner diameter="48"></mat-spinner>
                  <p>Syncing employees from {{ providerLabel(selectedHrisConnection?.provider) }}…</p>
                  <mat-progress-bar mode="indeterminate"></mat-progress-bar>
                </div>
              } @else if (importResult) {
                <div class="results-container">
                  <mat-icon class="results-icon" [class.success]="importResult.status === 'COMPLETED'" [class.failed]="importResult.status === 'FAILED'">
                    {{ importResult.status === 'COMPLETED' ? 'check_circle' : 'error' }}
                  </mat-icon>
                  <h2>Sync {{ importResult.status === 'COMPLETED' ? 'Complete' : 'Failed' }}</h2>
                  <div class="results-summary">
                    <div class="result-stat created">
                      <span class="stat-number">{{ importResult.createdCount ?? 0 }}</span>
                      <span class="stat-label">Created</span>
                    </div>
                    <div class="result-stat updated">
                      <span class="stat-number">{{ importResult.updatedCount ?? 0 }}</span>
                      <span class="stat-label">Updated</span>
                    </div>
                    <div class="result-stat errors">
                      <span class="stat-number">{{ importResult.errorCount ?? 0 }}</span>
                      <span class="stat-label">Errors</span>
                    </div>
                  </div>
                  <div class="step-actions">
                    <button mat-button (click)="goBack()">Back to Imports</button>
                    <button mat-flat-button color="primary" routerLink="/employees">
                      <mat-icon>people</mat-icon> View Employees
                    </button>
                  </div>
                </div>
              }
            </div>
          </mat-step>

        </mat-stepper>
      }

      <!-- CSV flow -->
      @if (importSource === 'csv') {
      <mat-stepper #stepper linear>
        <!-- Step 1: Upload CSV -->
        <mat-step [completed]="uploadComplete">
          <ng-template matStepLabel>Upload CSV</ng-template>
          <div class="step-content">
            <div
              class="upload-zone"
              [class.drag-over]="isDragOver"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              (click)="fileInput.click()"
            >
              @if (uploading) {
                <mat-spinner diameter="48"></mat-spinner>
                <p class="upload-text">Uploading and analyzing your CSV...</p>
                <p class="upload-hint">AI is analyzing column headers to suggest mappings</p>
              } @else if (selectedFile) {
                <mat-icon class="upload-icon success">check_circle</mat-icon>
                <p class="upload-text">{{ selectedFile.name }}</p>
                <p class="upload-hint">{{ formatFileSize(selectedFile.size) }}</p>
              } @else {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <p class="upload-text">Drop your CSV file here or click to browse</p>
                <p class="upload-hint">Supports .csv files with employee data</p>
              }
            </div>
            <input #fileInput type="file" accept=".csv" hidden (change)="onFileSelected($event)" />

            @if (uploadError) {
              <div class="error-banner">
                <mat-icon>error</mat-icon>
                {{ uploadError }}
              </div>
            }

            <div class="step-actions">
              <button
                mat-raised-button
                color="primary"
                [disabled]="!selectedFile || uploading"
                (click)="uploadFile()"
              >
                <mat-icon>auto_awesome</mat-icon>
                Upload & Analyze
              </button>
            </div>
          </div>
        </mat-step>

        <!-- Step 2: Column Mapping -->
        <mat-step [completed]="mappingConfirmed">
          <ng-template matStepLabel>Map Columns</ng-template>
          <div class="step-content">
            @if (uploadResponse) {
              <div class="mapping-info">
                <div class="info-chip">
                  <mat-icon>table_chart</mat-icon>
                  {{ uploadResponse.rowCount }} rows detected
                </div>
                <div class="info-chip">
                  <mat-icon>view_column</mat-icon>
                  {{ uploadResponse.detectedColumns.length }} columns found
                </div>
                @if (aiMappingStatus === 'pending') {
                  <div class="info-chip ai-pending">
                    <mat-spinner diameter="16"></mat-spinner>
                    AI analyzing...
                  </div>
                } @else if (aiMappingStatus === 'completed') {
                  <div class="info-chip ai-chip">
                    <mat-icon>auto_awesome</mat-icon>
                    AI-enhanced mappings
                  </div>
                } @else {
                  <div class="info-chip">
                    <mat-icon>tune</mat-icon>
                    Auto-detected mappings
                  </div>
                }
              </div>

              <table mat-table [dataSource]="mappingRows" class="mapping-table">
                <ng-container matColumnDef="field">
                  <th mat-header-cell *matHeaderCellDef>ReasonGrid Field</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="field-label">
                      {{ row.label }}
                      @if (row.required) {
                        <span class="required-badge">Required</span>
                      }
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="csvColumn">
                  <th mat-header-cell *matHeaderCellDef>CSV Column</th>
                  <td mat-cell *matCellDef="let row">
                    <mat-form-field appearance="outline" class="mapping-select">
                      <mat-select
                        [(value)]="row.csvColumn"
                        [placeholder]="row.required ? 'Select column (required)' : 'Not mapped'"
                        (selectionChange)="onMappingChanged()"
                      >
                        <mat-option [value]="null">-- Not mapped --</mat-option>
                        @for (col of uploadResponse!.detectedColumns; track col) {
                          <mat-option [value]="col">{{ col }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </td>
                </ng-container>

                <ng-container matColumnDef="sample">
                  <th mat-header-cell *matHeaderCellDef>Sample Values</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="sample-values">
                      @for (val of row.sampleValues; track $index) {
                        <span class="sample-chip">{{ val }}</span>
                      }
                      @if (row.sampleValues.length === 0) {
                        <span class="no-sample">—</span>
                      }
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="confidence">
                  <th mat-header-cell *matHeaderCellDef>Confidence</th>
                  <td mat-cell *matCellDef="let row">
                    @if (row.csvColumn) {
                      <div class="confidence-indicator" [matTooltip]="getConfidenceLabel(row.confidence)">
                        <div
                          class="confidence-dot"
                          [class.high]="row.confidence >= 0.8"
                          [class.medium]="row.confidence >= 0.5 && row.confidence < 0.8"
                          [class.low]="row.confidence < 0.5"
                        ></div>
                        {{ (row.confidence * 100) | number:'1.0-0' }}%
                      </div>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="mappingColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: mappingColumns;" [class.unmapped-required]="row.required && !row.csvColumn"></tr>
              </table>

              @if (mappingValidationError) {
                <div class="error-banner">
                  <mat-icon>warning</mat-icon>
                  {{ mappingValidationError }}
                </div>
              }

              <div class="step-actions">
                <button mat-button matStepperPrevious>Back</button>
                <button
                  mat-raised-button
                  color="primary"
                  [disabled]="!isMappingValid() || loadingPreview"
                  (click)="loadPreview()"
                >
                  @if (loadingPreview) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>preview</mat-icon>
                  }
                  Preview Data
                </button>
              </div>
            }
          </div>
        </mat-step>

        <!-- Step 3: Data Preview -->
        <mat-step [completed]="importStarted">
          <ng-template matStepLabel>Preview & Confirm</ng-template>
          <div class="step-content">
            @if (previewData) {
              <div class="preview-summary">
                <div class="summary-card">
                  <span class="summary-number">{{ previewData.totalRows }}</span>
                  <span class="summary-label">Total Rows</span>
                </div>
                <div class="summary-card success">
                  <span class="summary-number">{{ previewData.validRows }}</span>
                  <span class="summary-label">Valid</span>
                </div>
                @if (previewData.warningRows > 0) {
                  <div class="summary-card warning">
                    <span class="summary-number">{{ previewData.warningRows }}</span>
                    <span class="summary-label">With Warnings</span>
                  </div>
                }
              </div>

              <h3 class="preview-heading">Preview (first {{ previewData.rows.length }} rows)</h3>
              <div class="preview-table-wrapper">
                <table mat-table [dataSource]="previewData.rows" class="preview-table">
                  <ng-container matColumnDef="rowNumber">
                    <th mat-header-cell *matHeaderCellDef>Row</th>
                    <td mat-cell *matCellDef="let row">{{ row.rowNumber }}</td>
                  </ng-container>

                  @for (field of mappedFields; track field.key) {
                    <ng-container [matColumnDef]="field.key">
                      <th mat-header-cell *matHeaderCellDef>{{ field.label }}</th>
                      <td mat-cell *matCellDef="let row" [class.warning-cell]="hasWarningForField(row, field.key)">
                        {{ row.data[field.key] ?? '—' }}
                      </td>
                    </ng-container>
                  }

                  <ng-container matColumnDef="warnings">
                    <th mat-header-cell *matHeaderCellDef>Warnings</th>
                    <td mat-cell *matCellDef="let row">
                      @if (row.warnings.length > 0) {
                        <mat-icon class="warning-icon" [matTooltip]="row.warnings.join(', ')">warning</mat-icon>
                      }
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="previewColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: previewColumns;" [class.has-warnings]="row.warnings.length > 0"></tr>
                </table>
              </div>

              <div class="step-actions">
                <button mat-button matStepperPrevious>Back</button>
                <button
                  mat-raised-button
                  color="primary"
                  [disabled]="confirming"
                  (click)="confirmImport()"
                >
                  @if (confirming) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>check_circle</mat-icon>
                  }
                  Confirm Import
                </button>
              </div>
            }
          </div>
        </mat-step>

        <!-- Step 4: Results -->
        <mat-step>
          <ng-template matStepLabel>Results</ng-template>
          <div class="step-content">
            @if (polling) {
              <div class="results-loading">
                <mat-spinner diameter="48"></mat-spinner>
                <p>Processing import...</p>
                <mat-progress-bar mode="indeterminate"></mat-progress-bar>
              </div>
            } @else if (importResult) {
              <div class="results-container">
                <mat-icon class="results-icon" [class.success]="importResult.status === 'COMPLETED'" [class.failed]="importResult.status === 'FAILED'">
                  {{ importResult.status === 'COMPLETED' ? 'check_circle' : 'error' }}
                </mat-icon>
                <h2>Import {{ importResult.status === 'COMPLETED' ? 'Complete' : 'Failed' }}</h2>

                <div class="results-summary">
                  <div class="result-stat created">
                    <span class="stat-number">{{ importResult.createdCount ?? 0 }}</span>
                    <span class="stat-label">Created</span>
                  </div>
                  <div class="result-stat updated">
                    <span class="stat-number">{{ importResult.updatedCount ?? 0 }}</span>
                    <span class="stat-label">Updated</span>
                  </div>
                  <div class="result-stat errors">
                    <span class="stat-number">{{ importResult.errorCount ?? 0 }}</span>
                    <span class="stat-label">Errors</span>
                  </div>
                </div>

                <div class="step-actions">
                  <button mat-button (click)="goBack()">Back to Imports</button>
                  <button mat-raised-button color="primary" routerLink="/employees">
                    <mat-icon>people</mat-icon>
                    View Employees
                  </button>
                </div>
              </div>
            }
          </div>
        </mat-step>
      </mat-stepper>
      } <!-- end csv flow -->
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .step-content {
      padding: 24px 0;
    }

    .step-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    /* Upload Zone */
    .upload-zone {
      border: 2px dashed #cbd5e1;
      border-radius: 12px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #f8fafc;

      &:hover {
        border-color: #4f46e5;
        background: #eef2ff;
      }

      &.drag-over {
        border-color: #4f46e5;
        background: #eef2ff;
        border-style: solid;
      }
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #94a3b8;
      margin-bottom: 12px;

      &.success {
        color: #059669;
      }
    }

    .upload-text {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 8px 0 4px;
    }

    .upload-hint {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    /* Mapping */
    .mapping-info {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .info-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: #f1f5f9;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &.ai-chip {
        background: #eef2ff;
        color: #4338ca;
      }

      &.ai-pending {
        background: #fefce8;
        color: #a16207;
      }
    }

    .mapping-table {
      width: 100%;
    }

    .mapping-select {
      width: 220px;

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .field-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .required-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: #fef2f2;
      color: #dc2626;
    }

    .sample-values {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .sample-chip {
      font-size: 12px;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      color: #475569;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .no-sample {
      color: #94a3b8;
    }

    .confidence-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #475569;
    }

    .confidence-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;

      &.high { background: #059669; }
      &.medium { background: #d97706; }
      &.low { background: #dc2626; }
    }

    .unmapped-required {
      background: #fef2f2;
    }

    /* Preview */
    .preview-summary {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
    }

    .summary-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 24px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;

      &.success { background: #f0fdf4; border-color: #bbf7d0; }
      &.warning { background: #fffbeb; border-color: #fde68a; }
    }

    .summary-number {
      font-size: 28px;
      font-weight: 700;
      color: #0f172a;
    }

    .summary-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .preview-heading {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin: 0 0 12px;
    }

    .preview-table-wrapper {
      overflow-x: auto;
    }

    .preview-table {
      width: 100%;
      min-width: 800px;
    }

    .warning-cell {
      color: #d97706;
    }

    .has-warnings {
      background: #fffbeb;
    }

    .warning-icon {
      color: #d97706;
      font-size: 20px;
    }

    /* Results */
    .results-loading {
      text-align: center;
      padding: 48px;

      p {
        margin: 16px 0;
        font-size: 16px;
        color: #475569;
      }

      mat-progress-bar {
        max-width: 300px;
        margin: 0 auto;
      }
    }

    .results-container {
      text-align: center;
      padding: 32px;
    }

    .results-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;

      &.success { color: #059669; }
      &.failed { color: #dc2626; }
    }

    .results-summary {
      display: flex;
      gap: 24px;
      justify-content: center;
      margin: 24px 0;
    }

    .result-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-number {
      font-size: 36px;
      font-weight: 700;

      .created & { color: #059669; }
      .updated & { color: #2563eb; }
      .errors & { color: #dc2626; }
    }

    .stat-label {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }

    /* Error banner */
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      color: #dc2626;
      font-size: 14px;
      margin-top: 16px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
    }

    /* Source picker */
    .source-picker {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      max-width: 700px;
    }

    .source-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 32px 24px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fff;
      gap: 12px;

      &:hover {
        border-color: #4f46e5;
        background: #f8f9ff;
        box-shadow: 0 4px 16px rgba(79,70,229,0.08);
      }

      h3 { margin: 0; font-size: 17px; font-weight: 600; color: #0f172a; }
      p { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }
    }

    .source-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #4f46e5;
      &.hris { color: #7ab648; }
    }

    /* HRIS connection picker */
    .center-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px;
      color: #64748b;
    }

    .empty-connections {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px;
      text-align: center;
      color: #64748b;
      mat-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; }
      h3 { margin: 0; font-size: 18px; font-weight: 600; color: #0f172a; }
      p { margin: 0; font-size: 14px; }
    }

    .step-desc { font-size: 14px; color: #475569; margin: 0 0 20px; }

    .connection-picker {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-width: 600px;
      margin-bottom: 24px;
    }

    .connection-option {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px;
      border: 2px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      background: #fff;

      &:hover { border-color: #4f46e5; background: #f8f9ff; }
      &.selected { border-color: #4f46e5; background: #eef2ff; }
    }

    .conn-icon { font-size: 28px; width: 28px; height: 28px; }

    .conn-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .conn-name { font-size: 14px; font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 8px; }
    .provider-badge { font-size: 11px; font-weight: 500; padding: 1px 7px; border-radius: 10px; background: #f1f5f9; color: #475569; }
    .conn-sub { font-size: 12px; color: #555; font-family: monospace; }
    .conn-last { font-size: 11px; color: #94a3b8; }

    .selected-check { color: #4f46e5; margin-left: auto; }

    /* HRIS error notice */
    .hris-errors {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      color: #92400e;
      font-size: 13px;
      margin-top: 16px;
      mat-icon { color: #d97706; flex-shrink: 0; }
    }
  `],
})
export class ImportWizardComponent implements OnInit {
  @ViewChild('stepper') stepper!: MatStepper;
  @ViewChild('hrisStepper') hrisStepper!: MatStepper;

  private importService = inject(ImportService);
  private hrisService = inject(HrisService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Source selection
  importSource: 'csv' | 'hris' | null = null;

  // Step 1: Upload (CSV)
  selectedFile: File | null = null;
  uploading = false;
  uploadComplete = false;
  uploadError: string | null = null;
  isDragOver = false;

  // Step 2: Mapping (CSV)
  uploadResponse: (CsvUploadResponse & { mappingSource?: string }) | null = null;
  mappingRows: MappingRow[] = [];
  mappingColumns = ['field', 'csvColumn', 'sample', 'confidence'];
  mappingValidationError: string | null = null;
  mappingConfirmed = false;
  loadingPreview = false;
  aiMappingStatus: 'pending' | 'completed' | 'failed' | null = null;

  // Step 3: Preview (CSV)
  previewData: ImportPreview | null = null;
  previewColumns: string[] = [];
  mappedFields: { key: string; label: string }[] = [];
  importStarted = false;
  confirming = false;

  // Step 4: Results (shared)
  polling = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  importResult: any = null;

  // HRIS flow state
  hrisConnections: HrisConnection[] = [];
  hrisLoadingConnections = false;
  selectedHrisConnection: HrisConnection | null = null;
  hrisConnectionSelected = false;
  hrisLoadingPreview = false;
  hrisPreview: HrisSyncPreview | null = null;
  hrisSyncStarted = false;
  hrisConfirming = false;
  hrisPreviewColumns = ['employeeId', 'roleTitle', 'jobFamily', 'level', 'country', 'baseSalary'];

  ngOnInit() {
    // Pre-load HRIS connections in the background
    this.hrisService.listConnections().subscribe({
      next: (c) => { this.hrisConnections = c; this.cdr.markForCheck(); },
      error: () => {},
    });
  }

  providerLabel(provider: string | undefined): string {
    return provider ? (hrisProviderLabels[provider as keyof typeof hrisProviderLabels] ?? provider) : '';
  }

  providerIcon(provider: string | undefined): string {
    const icons: Record<string, string> = {
      bamboohr: 'account_tree',
      hibob: 'people_alt',
      rippling: 'corporate_fare',
      personio: 'badge',
    };
    return icons[provider ?? ''] ?? 'hub';
  }

  providerColor(provider: string | undefined): string {
    const colors: Record<string, string> = {
      bamboohr: '#7ab648',
      hibob: '#5b4fe9',
      rippling: '#ff5c35',
      personio: '#e5007d',
    };
    return colors[provider ?? ''] ?? '#64748b';
  }

  selectSource(source: 'csv' | 'hris') {
    this.importSource = source;
    if (source === 'hris') {
      this.hrisLoadingConnections = false;
    }
  }

  // --- HRIS flow ---

  selectHrisConnection(conn: HrisConnection) {
    this.selectedHrisConnection = conn;
  }

  loadHrisPreview() {
    if (!this.selectedHrisConnection) return;
    this.hrisLoadingPreview = true;
    this.hrisService.getPreview(this.selectedHrisConnection.id).subscribe({
      next: (preview) => {
        this.hrisPreview = preview;
        this.hrisLoadingPreview = false;
        this.hrisConnectionSelected = true;
        this.cdr.detectChanges();
        this.hrisStepper?.next();
      },
      error: () => {
        this.hrisLoadingPreview = false;
        this.cdr.markForCheck();
      },
    });
  }

  confirmHrisSync() {
    if (!this.selectedHrisConnection) return;
    this.hrisConfirming = true;
    this.hrisService.sync(this.selectedHrisConnection.id).subscribe({
      next: (r) => {
        this.hrisConfirming = false;
        this.hrisSyncStarted = true;
        this.polling = true;
        this.cdr.detectChanges();
        this.hrisStepper?.next();
        this.startPolling(r.importId);
      },
      error: () => {
        this.hrisConfirming = false;
        this.cdr.markForCheck();
      },
    });
  }

  goBack() {
    this.router.navigate(['/imports']);
  }

  // --- Step 1: Upload ---

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.csv')) {
      this.selectedFile = file;
      this.uploadError = null;
    } else {
      this.uploadError = 'Please drop a valid CSV file';
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.selectedFile = file;
      this.uploadError = null;
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  uploadFile() {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.uploadError = null;

    this.importService.uploadCsv(this.selectedFile).subscribe({
      next: (response) => {
        this.uploading = false;
        this.uploadResponse = response;
        this.buildMappingRows();
        this.aiMappingStatus = response.mappingSource === 'ai' ? 'completed' : 'failed';
        this.uploadComplete = true;
        this.advanceStep();
      },
      error: (err) => {
        this.uploading = false;
        this.uploadError = err.error?.error || 'Upload failed. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  // --- Step 2: Mapping ---

  private buildMappingRows() {
    if (!this.uploadResponse) return;

    this.mappingRows = STANDARD_EMPLOYEE_FIELDS.map((field) => {
      const csvColumn = this.uploadResponse!.suggestedMapping[field.key] ?? null;
      const confidence = this.uploadResponse!.aiConfidence?.[field.key] ?? 0;

      // Get sample values for this mapped column
      const sampleValues: string[] = [];
      if (csvColumn) {
        for (const row of this.uploadResponse!.sampleData.slice(0, 3)) {
          const val = row[csvColumn];
          if (val && !sampleValues.includes(val)) {
            sampleValues.push(val);
          }
        }
      }

      return {
        key: field.key,
        label: field.label,
        required: field.required,
        csvColumn,
        confidence,
        sampleValues,
      };
    });
  }

  onMappingChanged() {
    // Update sample values when mapping changes
    for (const row of this.mappingRows) {
      row.sampleValues = [];
      if (row.csvColumn && this.uploadResponse) {
        for (const dataRow of this.uploadResponse.sampleData.slice(0, 3)) {
          const val = dataRow[row.csvColumn];
          if (val && !row.sampleValues.includes(val)) {
            row.sampleValues.push(val);
          }
        }
        // Reset confidence for manually changed mappings
        row.confidence = 1.0;
      }
    }
    this.mappingValidationError = null;
  }

  isMappingValid(): boolean {
    return this.mappingRows
      .filter((r) => r.required)
      .every((r) => r.csvColumn !== null);
  }

  private getCurrentMapping(): Record<string, string> {
    const mapping: Record<string, string> = {};
    for (const row of this.mappingRows) {
      if (row.csvColumn) {
        mapping[row.key] = row.csvColumn;
      }
    }
    return mapping;
  }

  loadPreview() {
    if (!this.uploadResponse || !this.isMappingValid()) return;

    const missingRequired = this.mappingRows
      .filter((r) => r.required && !r.csvColumn)
      .map((r) => r.label);

    if (missingRequired.length > 0) {
      this.mappingValidationError = `Required fields not mapped: ${missingRequired.join(', ')}`;
      return;
    }

    this.loadingPreview = true;
    const mapping = this.getCurrentMapping();

    this.importService.getPreview(this.uploadResponse.importId, mapping).subscribe({
      next: (preview) => {
        this.loadingPreview = false;
        this.previewData = preview;

        // Build preview table columns
        this.mappedFields = this.mappingRows
          .filter((r) => r.csvColumn)
          .map((r) => ({ key: r.key, label: r.label }));
        this.previewColumns = ['rowNumber', ...this.mappedFields.map((f) => f.key), 'warnings'];
        this.mappingConfirmed = true;
        this.advanceStep();
      },
      error: (err) => {
        this.loadingPreview = false;
        this.mappingValidationError = err.error?.error || 'Failed to generate preview';
        this.cdr.markForCheck();
      },
    });
  }

  // --- Step 3: Preview ---

  hasWarningForField(row: PreviewRow, field: string): boolean {
    return row.warnings.some((w) => w.toLowerCase().includes(field.toLowerCase()));
  }

  confirmImport() {
    if (!this.uploadResponse) return;

    this.confirming = true;
    const mapping = this.getCurrentMapping();

    this.importService.confirmMapping(this.uploadResponse.importId, mapping).subscribe({
      next: () => {
        const importId = this.uploadResponse!.importId;
        this.confirming = false;
        this.importStarted = true;
        this.polling = true;
        this.advanceStep();
        this.startPolling(importId);
      },
      error: (err) => {
        this.confirming = false;
        console.error('Confirm failed', err);
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Advance the stepper to the next step.
   * With OnPush, we detectChanges first so the stepper sees updated [completed] bindings,
   * then advance. OnPush prevents the stepper's internal CD from re-checking this component.
   */
  private advanceStep() {
    this.cdr.detectChanges();
    this.stepper.next();
  }

  // --- Step 4: Results ---

  private startPolling(importId: string) {
    const poll = () => {
      this.importService.getImport(importId).subscribe({
        next: (result) => {
          if (result.status === 'PROCESSING') {
            setTimeout(poll, 2000);
          } else {
            this.polling = false;
            this.importResult = result;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.polling = false;
          this.importResult = { status: 'FAILED', createdCount: 0, updatedCount: 0, errorCount: 0 };
          this.cdr.markForCheck();
        },
      });
    };

    setTimeout(poll, 1500); // Initial delay
  }

  getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.8) return 'High confidence';
    if (confidence >= 0.5) return 'Medium confidence';
    return 'Low confidence';
  }

}

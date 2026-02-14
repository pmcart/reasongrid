import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiService } from '../core/api.service';

const ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_CREATED: 'Employee Created',
  EMPLOYEE_UPDATED: 'Employee Updated',
  EMPLOYEE_IMPORTED: 'Employee Imported',
  PAY_DECISION_CREATED: 'Pay Decision Created',
  PAY_DECISION_UPDATED: 'Pay Decision Updated',
  PAY_DECISION_FINALISED: 'Pay Decision Finalised',
  IMPORT_STARTED: 'Import Started',
  IMPORT_COMPLETED: 'Import Completed',
  IMPORT_FAILED: 'Import Failed',
  RISK_RUN_TRIGGERED: 'Risk Run Triggered',
  RISK_RUN_COMPLETED: 'Risk Run Completed',
  USER_LOGIN: 'User Login',
};

const ACTION_CATEGORIES: Record<string, string> = {
  EMPLOYEE_CREATED: 'employee',
  EMPLOYEE_UPDATED: 'employee',
  EMPLOYEE_IMPORTED: 'employee',
  PAY_DECISION_CREATED: 'decision',
  PAY_DECISION_UPDATED: 'decision',
  PAY_DECISION_FINALISED: 'decision',
  IMPORT_STARTED: 'import',
  IMPORT_COMPLETED: 'import',
  IMPORT_FAILED: 'import',
  RISK_RUN_TRIGGERED: 'risk',
  RISK_RUN_COMPLETED: 'risk',
  USER_LOGIN: 'auth',
};

interface AuditListResponse {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSelectModule, MatFormFieldModule,
    MatButtonModule, MatIconModule, MatPaginatorModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Audit Log</h1>
          <p class="page-description">Track all significant actions across your organization for compliance and governance</p>
        </div>
      </div>

      <div class="disclaimer">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>This log supports internal governance and transparency requirements. It does not constitute legal advice.</span>
      </div>

      <div class="filters-row">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Action Type</mat-label>
          <mat-select [(ngModel)]="filterAction" (selectionChange)="resetAndLoad()">
            <mat-option value="">All Actions</mat-option>
            @for (action of actionOptions; track action) {
              <mat-option [value]="action">{{ getActionLabel(action) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Entity Type</mat-label>
          <mat-select [(ngModel)]="filterEntityType" (selectionChange)="resetAndLoad()">
            <mat-option value="">All Entities</mat-option>
            <mat-option value="Employee">Employee</mat-option>
            <mat-option value="PayDecision">Pay Decision</mat-option>
            <mat-option value="ImportJob">Import</mat-option>
            <mat-option value="User">User</mat-option>
          </mat-select>
        </mat-form-field>

        @if (filterAction || filterEntityType) {
          <button mat-stroked-button (click)="clearFilters()">
            <mat-icon>clear</mat-icon>
            Clear Filters
          </button>
        }
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading audit log...</p>
        </div>
      } @else if (entries.length > 0) {
        <table mat-table [dataSource]="entries" class="audit-table">
          <ng-container matColumnDef="createdAt">
            <th mat-header-cell *matHeaderCellDef>Timestamp</th>
            <td mat-cell *matCellDef="let e">
              <span class="timestamp">{{ e.createdAt | date:'medium' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="action">
            <th mat-header-cell *matHeaderCellDef>Action</th>
            <td mat-cell *matCellDef="let e">
              <span class="action-badge" [class]="'action-' + getActionCategory(e.action)">
                {{ getActionLabel(e.action) }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="entityType">
            <th mat-header-cell *matHeaderCellDef>Entity</th>
            <td mat-cell *matCellDef="let e">
              <span class="entity-type">{{ e.entityType }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="entityId">
            <th mat-header-cell *matHeaderCellDef>Entity ID</th>
            <td mat-cell *matCellDef="let e">
              <span class="entity-id" [matTooltip]="e.entityId ?? ''">
                {{ e.entityId ? e.entityId.substring(0, 8) + '...' : '—' }}
              </span>
            </td>
          </ng-container>

          <ng-container matColumnDef="userId">
            <th mat-header-cell *matHeaderCellDef>User</th>
            <td mat-cell *matCellDef="let e">
              <span class="user-id">{{ e.userId ? e.userId.substring(0, 8) + '...' : 'System' }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="details">
            <th mat-header-cell *matHeaderCellDef>Details</th>
            <td mat-cell *matCellDef="let e">
              @if (e.metadata) {
                <span class="metadata-preview" [matTooltip]="formatMetadata(e.metadata)">
                  {{ getMetadataSummary(e.metadata) }}
                </span>
              } @else {
                <span class="no-details">—</span>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="audit-row"></tr>
        </table>

        <mat-paginator
          [length]="total"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPage($event)">
        </mat-paginator>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">history</mat-icon>
          <p class="empty-state-title">No audit entries found</p>
          <p class="empty-state-text">Audit entries will appear here as actions are performed in the system</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 16px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
    }

    .page-description {
      font-size: 14px;
      color: #64748b;
      margin: 0;
    }

    .disclaimer {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #64748b;
      font-size: 13px;
      margin-bottom: 20px;
    }

    .disclaimer-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #94a3b8;
    }

    .filters-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 20px;
    }

    .filter-field {
      width: 200px;
    }

    .audit-table {
      width: 100%;
    }

    .audit-row:hover {
      background: #f8fafc;
    }

    .timestamp {
      font-size: 13px;
      color: #64748b;
      white-space: nowrap;
    }

    .action-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
    }

    .action-decision {
      background: #eef2ff;
      color: #4338ca;
    }

    .action-import {
      background: #eff6ff;
      color: #1d4ed8;
    }

    .action-employee {
      background: #ecfdf5;
      color: #059669;
    }

    .action-auth {
      background: #f1f5f9;
      color: #475569;
    }

    .action-risk {
      background: #fffbeb;
      color: #b45309;
    }

    .entity-type {
      font-size: 13px;
      color: #475569;
    }

    .entity-id {
      font-family: 'Inter', monospace;
      font-size: 12px;
      color: #94a3b8;
    }

    .user-id {
      font-family: 'Inter', monospace;
      font-size: 12px;
      color: #94a3b8;
    }

    .metadata-preview {
      font-size: 12px;
      color: #64748b;
      cursor: help;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: inline-block;
    }

    .no-details {
      color: #cbd5e1;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #64748b;
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px dashed #e2e8f0;
    }

    .empty-state-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #cbd5e1;
      margin-bottom: 12px;
    }

    .empty-state-title {
      font-size: 16px;
      font-weight: 600;
      color: #475569;
      margin: 0 0 4px 0;
    }

    .empty-state-text {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }
  `],
})
export class AuditLogComponent implements OnInit {
  entries: any[] = [];
  total = 0;
  page = 1;
  pageSize = 25;
  loading = false;
  filterAction = '';
  filterEntityType = '';
  displayedColumns = ['createdAt', 'action', 'entityType', 'entityId', 'userId', 'details'];

  actionOptions = [
    'PAY_DECISION_CREATED', 'PAY_DECISION_UPDATED', 'PAY_DECISION_FINALISED',
    'IMPORT_STARTED', 'IMPORT_COMPLETED', 'IMPORT_FAILED',
    'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'EMPLOYEE_IMPORTED',
    'RISK_RUN_TRIGGERED', 'RISK_RUN_COMPLETED',
    'USER_LOGIN',
  ];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadEntries();
  }

  getActionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  getActionCategory(action: string): string {
    return ACTION_CATEGORIES[action] ?? 'auth';
  }

  getMetadataSummary(metadata: any): string {
    if (!metadata) return '';
    const keys = Object.keys(metadata);
    if (keys.length === 0) return '';
    // Show first few key-value pairs as summary
    return keys.slice(0, 3).map(k => `${k}: ${metadata[k]}`).join(', ');
  }

  formatMetadata(metadata: any): string {
    if (!metadata) return '';
    try {
      return JSON.stringify(metadata, null, 2);
    } catch {
      return String(metadata);
    }
  }

  resetAndLoad() {
    this.page = 1;
    this.loadEntries();
  }

  clearFilters() {
    this.filterAction = '';
    this.filterEntityType = '';
    this.resetAndLoad();
  }

  onPage(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }

  private loadEntries() {
    this.loading = true;
    const params: Record<string, string> = {
      page: String(this.page),
      pageSize: String(this.pageSize),
    };
    if (this.filterAction) params['action'] = this.filterAction;
    if (this.filterEntityType) params['entityType'] = this.filterEntityType;

    this.api.get<AuditListResponse>('/audit', params).subscribe({
      next: (res) => {
        this.entries = res.data;
        this.total = res.total;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load audit log:', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}

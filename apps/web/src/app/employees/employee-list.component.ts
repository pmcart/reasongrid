import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../core/api.service';

interface EmployeeListResponse {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
  coverage: { withDecisions: number; totalEmployees: number };
}

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    CommonModule, RouterModule, FormsModule,
    MatTableModule, MatInputModule, MatFormFieldModule,
    MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Employee Directory</h1>
          <p class="page-description">View and manage your organization's employee records</p>
        </div>
      </div>

      <div class="search-bar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-icon matPrefix class="search-icon">search</mat-icon>
          <mat-label>Search employees</mat-label>
          <input matInput [(ngModel)]="searchQuery" (keyup.enter)="loadEmployees()"
                 placeholder="Search by name, ID, or role..." />
          @if (searchQuery) {
            <button matSuffix mat-icon-button (click)="searchQuery = ''; loadEmployees()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </mat-form-field>
      </div>

      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading employees...</p>
        </div>
      } @else if (employees.length > 0) {
        @if (coverage) {
          <div class="coverage-bar">
            <mat-icon class="coverage-icon">assignment_turned_in</mat-icon>
            <span>
              <strong>{{ coverage.withDecisions }}</strong> of <strong>{{ coverage.totalEmployees }}</strong> employees have documented pay decisions
            </span>
            @if (coverage.withDecisions < coverage.totalEmployees) {
              <span class="coverage-gap">
                {{ coverage.totalEmployees - coverage.withDecisions }} without decisions
              </span>
            }
          </div>
        }

        <table mat-table [dataSource]="employees">
          <ng-container matColumnDef="employeeId">
            <th mat-header-cell *matHeaderCellDef>ID</th>
            <td mat-cell *matCellDef="let emp">
              <span class="emp-id">{{ emp.employeeId }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="roleTitle">
            <th mat-header-cell *matHeaderCellDef>Role</th>
            <td mat-cell *matCellDef="let emp">{{ emp.roleTitle }}</td>
          </ng-container>

          <ng-container matColumnDef="level">
            <th mat-header-cell *matHeaderCellDef>Level</th>
            <td mat-cell *matCellDef="let emp">
              <span class="level-badge">{{ emp.level }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="country">
            <th mat-header-cell *matHeaderCellDef>Country</th>
            <td mat-cell *matCellDef="let emp">{{ emp.country }}</td>
          </ng-container>

          <ng-container matColumnDef="baseSalary">
            <th mat-header-cell *matHeaderCellDef>Base Salary</th>
            <td mat-cell *matCellDef="let emp">
              <span class="salary">{{ emp.baseSalary | number:'1.0-0' }}</span>
              <span class="currency">{{ emp.currency }}</span>
            </td>
          </ng-container>

          <ng-container matColumnDef="decisions">
            <th mat-header-cell *matHeaderCellDef>Decisions</th>
            <td mat-cell *matCellDef="let emp">
              @if (emp.decisionCount > 0) {
                <span class="decision-count">{{ emp.decisionCount }}</span>
              } @else {
                <span class="decision-none">None</span>
              }
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let emp">
              <a mat-button color="primary" [routerLink]="['/employees', emp.id]" (click)="$event.stopPropagation()">
                <mat-icon>visibility</mat-icon>
                View
              </a>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"
              [routerLink]="['/employees', row.id]" class="clickable-row"></tr>
        </table>

        <mat-paginator
          [length]="total"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          (page)="onPage($event)">
        </mat-paginator>
      } @else {
        <div class="empty-state">
          <mat-icon class="empty-state-icon">people</mat-icon>
          <p class="empty-state-title">No employees found</p>
          <p class="empty-state-text">Import a CSV file to add employees to your directory</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page-header {
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px 0;
      }
    }

    .search-bar {
      margin-bottom: 20px;
    }

    .search-field {
      width: 100%;
      max-width: 480px;
    }

    .search-icon {
      color: #94a3b8;
      margin-right: 4px;
    }

    .clickable-row {
      cursor: pointer;
    }

    .clickable-row:hover {
      background: #f8fafc !important;
    }

    .emp-id {
      font-family: 'Inter', monospace;
      font-size: 13px;
      color: #64748b;
    }

    .emp-name {
      font-weight: 500;
    }

    .level-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .salary {
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    .currency {
      color: #94a3b8;
      font-size: 12px;
      margin-left: 4px;
    }

    .coverage-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 13px;
      color: #475569;
    }

    .coverage-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #4f46e5;
    }

    .coverage-gap {
      margin-left: auto;
      padding: 2px 10px;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .decision-count {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 500;
      color: #475569;
    }

    .decision-none {
      display: inline-block;
      padding: 2px 8px;
      background: #fef2f2;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      color: #dc2626;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px;
      color: #64748b;
    }
  `],
})
export class EmployeeListComponent implements OnInit {
  employees: any[] = [];
  total = 0;
  page = 1;
  pageSize = 25;
  searchQuery = '';
  loading = false;
  coverage: { withDecisions: number; totalEmployees: number } | null = null;
  displayedColumns = ['employeeId', 'roleTitle', 'level', 'country', 'baseSalary', 'decisions', 'actions'];

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadEmployees();
  }

  loadEmployees() {
    this.loading = true;
    const params: Record<string, string> = {
      page: String(this.page),
      pageSize: String(this.pageSize),
    };
    if (this.searchQuery) params['q'] = this.searchQuery;

    this.api.get<EmployeeListResponse>('/employees', params).subscribe({
      next: (res) => {
        this.employees = res.data;
        this.total = res.total;
        this.coverage = res.coverage;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load employees:', err);
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onPage(event: PageEvent) {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadEmployees();
  }
}

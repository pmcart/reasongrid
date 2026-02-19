import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SalaryRangeService, SalaryRange, EmployeeGroup } from '../core/salary-range.service';
import { SalaryRangeDialogComponent } from './salary-range-dialog.component';
import { UncoveredGroupsDialogComponent } from './uncovered-groups-dialog.component';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-salary-ranges',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSnackBarModule,
    MatDialogModule, MatTooltipModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1 class="page-title">Salary Ranges</h1>
          <p class="page-subtitle">Define salary ranges by country, job family, and level. These ranges are used to compute compa ratios and position-in-range for pay decision context.</p>
        </div>
        @if (canEdit) {
          <button mat-raised-button color="primary" (click)="openDialog(null)">
            <mat-icon>add</mat-icon>
            Add Range
          </button>
        }
      </div>

      @if (loading) {
        <div class="loading-state">Loading salary ranges...</div>
      } @else {
        <div class="filters-bar">
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

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Level</mat-label>
            <mat-select [(ngModel)]="filterLevel" (ngModelChange)="applyFilters()">
              <mat-option value="">All</mat-option>
              @for (l of levels; track l) {
                <mat-option [value]="l">{{ l }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <span class="filter-count">{{ filtered.length }} range{{ filtered.length !== 1 ? 's' : '' }}</span>
        </div>

        @if (uncoveredGroups.length > 0) {
          <div class="uncovered-banner">
            <div class="uncovered-header">
              <mat-icon>warning</mat-icon>
              <span><strong>{{ uncoveredGroups.length }}</strong> employee group{{ uncoveredGroups.length !== 1 ? 's' : '' }} without salary ranges</span>
            </div>
            <div class="uncovered-chips">
              @for (g of uncoveredGroups.slice(0, 20); track g.country + g.jobFamily + g.level) {
                <button class="uncovered-chip" (click)="openDialogForGroup(g)" matTooltip="Click to create range">
                  <span class="chip-country">{{ g.country }}</span>
                  <span class="chip-detail">{{ g.jobFamily || '(no family)' }} / {{ g.level }}</span>
                  <span class="chip-count">{{ g.employeeCount }} emp{{ g.employeeCount !== 1 ? 's' : '' }}</span>
                  @if (canEdit) {
                    <mat-icon class="chip-add">add_circle</mat-icon>
                  }
                </button>
              }
              @if (uncoveredGroups.length > 20) {
                <button class="show-all-btn" (click)="openUncoveredModal()">
                  Show all {{ uncoveredGroups.length }} groups
                  <mat-icon>open_in_new</mat-icon>
                </button>
              }
            </div>
          </div>
        }

        @if (filtered.length === 0) {
          <div class="empty-state">
            <mat-icon>paid</mat-icon>
            <p>No salary ranges defined yet.</p>
            @if (canEdit) {
              <button mat-stroked-button color="primary" (click)="openDialog(null)">
                <mat-icon>add</mat-icon> Add your first range
              </button>
            }
          </div>
        } @else {
          <div class="ranges-table">
            <div class="table-header">
              <span class="col-country">Country</span>
              <span class="col-jf">Job Family</span>
              <span class="col-level">Level</span>
              <span class="col-currency">Currency</span>
              <span class="col-num">Min</span>
              <span class="col-num">Mid</span>
              <span class="col-num">Max</span>
              <span class="col-spread">Spread</span>
              @if (canEdit) {
                <span class="col-actions">Actions</span>
              }
            </div>
            @for (range of filtered; track range.id) {
              <div class="table-row">
                <span class="col-country">
                  <span class="country-badge">{{ range.country }}</span>
                </span>
                <span class="col-jf">{{ range.jobFamily || '—' }}</span>
                <span class="col-level">{{ range.level }}</span>
                <span class="col-currency">{{ range.currency }}</span>
                <span class="col-num">{{ formatNum(range.min, range.currency) }}</span>
                <span class="col-num">{{ formatNum(range.mid, range.currency) }}</span>
                <span class="col-num">{{ formatNum(range.max, range.currency) }}</span>
                <span class="col-spread">
                  <span class="spread-badge">{{ getSpread(range) }}%</span>
                </span>
                @if (canEdit) {
                  <span class="col-actions">
                    <button mat-icon-button matTooltip="Edit" (click)="openDialog(range)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    @if (isAdmin) {
                      <button mat-icon-button matTooltip="Delete" (click)="deleteRange(range)">
                        <mat-icon>delete</mat-icon>
                      </button>
                    }
                  </span>
                }
              </div>
            }
          </div>
        }
      }

      <div class="disclaimer">
        <mat-icon>info</mat-icon>
        <span>Salary ranges inform compa ratio and position-in-range calculations captured in employee snapshots at pay decision time. Changes to ranges do not retroactively alter existing snapshots.</span>
      </div>
    </div>
  `,
  styles: [`
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

    .loading-state {
      text-align: center;
      padding: 48px;
      color: #94a3b8;
    }

    .filters-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .filter-field {
      width: 160px;
    }

    .filter-count {
      font-size: 13px;
      color: #94a3b8;
      margin-left: auto;
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

    .ranges-table {
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

    .col-country { width: 80px; flex-shrink: 0; }
    .col-jf { width: 160px; flex-shrink: 0; }
    .col-level { width: 100px; flex-shrink: 0; }
    .col-currency { width: 80px; flex-shrink: 0; }
    .col-num { width: 110px; flex-shrink: 0; text-align: right; font-variant-numeric: tabular-nums; }
    .col-spread { width: 80px; flex-shrink: 0; text-align: center; }
    .col-actions { margin-left: auto; display: flex; gap: 4px; }

    .country-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .spread-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f0fdf4;
      color: #16a34a;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }

    .uncovered-banner {
      margin-bottom: 20px;
      padding: 16px 20px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
    }

    .uncovered-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 14px;
      color: #92400e;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #d97706;
      }
    }

    .uncovered-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .uncovered-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: white;
      border: 1px solid #fde68a;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      color: #334155;
      transition: all 0.15s;

      &:hover {
        border-color: #f59e0b;
        background: #fef9c3;
      }
    }

    .chip-country {
      font-weight: 600;
      color: #4f46e5;
      background: #eef2ff;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 11px;
    }

    .chip-detail {
      color: #475569;
    }

    .chip-count {
      font-size: 11px;
      color: #94a3b8;
    }

    .chip-add {
      font-size: 16px !important;
      width: 16px !important;
      height: 16px !important;
      color: #16a34a;
    }

    .show-all-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
      background: #f59e0b;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      color: white;
      transition: background 0.15s;

      &:hover {
        background: #d97706;
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
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
export class SalaryRangesComponent implements OnInit {
  private salaryRangeService = inject(SalaryRangeService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  allRanges: SalaryRange[] = [];
  filtered: SalaryRange[] = [];
  uncoveredGroups: EmployeeGroup[] = [];
  loading = true;

  countries: string[] = [];
  jobFamilies: string[] = [];
  levels: string[] = [];

  filterCountry = '';
  filterJobFamily = '';
  filterLevel = '';

  get canEdit(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  ngOnInit() {
    this.loadRanges();
  }

  formatNum(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return value.toLocaleString();
    }
  }

  getSpread(range: SalaryRange): string {
    if (range.min === 0) return '0';
    return (((range.max - range.min) / range.min) * 100).toFixed(0);
  }

  applyFilters() {
    this.filtered = this.allRanges.filter((r) => {
      if (this.filterCountry && r.country !== this.filterCountry) return false;
      if (this.filterJobFamily && (r.jobFamily || '') !== this.filterJobFamily) return false;
      if (this.filterLevel && r.level !== this.filterLevel) return false;
      return true;
    });
  }

  openUncoveredModal() {
    const dialogRef = this.dialog.open(UncoveredGroupsDialogComponent, {
      width: '700px',
      maxHeight: '80vh',
      data: { groups: this.uncoveredGroups, canEdit: this.canEdit },
    });

    dialogRef.afterClosed().subscribe((group: EmployeeGroup | null) => {
      if (group) {
        this.openDialogForGroup(group);
      }
    });
  }

  openDialogForGroup(group: EmployeeGroup) {
    const dialogRef = this.dialog.open(SalaryRangeDialogComponent, {
      width: '560px',
      data: { range: null, uncoveredGroups: this.uncoveredGroups, prefill: group },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadRanges();
        this.snackBar.open('Salary range created', 'OK', { duration: 2500 });
      }
    });
  }

  openDialog(range: SalaryRange | null) {
    const dialogRef = this.dialog.open(SalaryRangeDialogComponent, {
      width: '560px',
      data: { range, uncoveredGroups: range ? [] : this.uncoveredGroups },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadRanges();
        this.snackBar.open(range ? 'Salary range updated' : 'Salary range created', 'OK', { duration: 2500 });
      }
    });
  }

  deleteRange(range: SalaryRange) {
    if (!confirm(`Delete salary range for ${range.country} / ${range.jobFamily || '(any)'} / ${range.level}?`)) return;

    this.salaryRangeService.delete(range.id).subscribe({
      next: () => {
        this.loadRanges();
        this.snackBar.open('Salary range deleted', 'OK', { duration: 2500 });
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to delete', 'OK', { duration: 3000 });
      },
    });
  }

  private loadRanges() {
    this.salaryRangeService.getAll().subscribe({
      next: (ranges) => {
        this.allRanges = ranges;
        this.countries = [...new Set(ranges.map((r) => r.country))].sort();
        this.jobFamilies = [...new Set(ranges.map((r) => r.jobFamily).filter(Boolean) as string[])].sort();
        this.levels = [...new Set(ranges.map((r) => r.level))].sort();
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });

    this.salaryRangeService.getCoverage().subscribe({
      next: (groups) => {
        this.uncoveredGroups = groups
          .filter((g) => !g.hasSalaryRange)
          .sort((a, b) => a.country.localeCompare(b.country) || (a.jobFamily ?? '').localeCompare(b.jobFamily ?? '') || a.level.localeCompare(b.level));
      },
    });
  }
}

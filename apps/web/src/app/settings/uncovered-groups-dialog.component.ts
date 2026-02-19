import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmployeeGroup } from '../core/salary-range.service';

@Component({
  selector: 'app-uncovered-groups-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatTooltipModule,
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon class="dialog-icon">warning</mat-icon>
      Employee Groups Without Salary Ranges
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search-field">
        <mat-label>Filter groups</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="search" placeholder="Country, job family, or level..." />
      </mat-form-field>

      <div class="groups-list">
        @for (g of filteredGroups; track g.country + g.jobFamily + g.level) {
          <div class="group-row" [class.clickable]="data.canEdit" (click)="selectGroup(g)">
            <span class="group-country">{{ g.country }}</span>
            <span class="group-info">
              <span class="group-family">{{ g.jobFamily || '(no family)' }}</span>
              <span class="group-level">{{ g.level }}</span>
            </span>
            <span class="group-currency">{{ g.currency }}</span>
            <span class="group-count">{{ g.employeeCount }} employee{{ g.employeeCount !== 1 ? 's' : '' }}</span>
            @if (data.canEdit) {
              <button mat-icon-button matTooltip="Create salary range" (click)="selectGroup(g); $event.stopPropagation()">
                <mat-icon>add_circle</mat-icon>
              </button>
            }
          </div>
        } @empty {
          <div class="empty-search">No groups match your filter.</div>
        }
      </div>

      <div class="summary">
        {{ filteredGroups.length }} of {{ data.groups.length }} group{{ data.groups.length !== 1 ? 's' : '' }} shown
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-icon {
      vertical-align: middle;
      margin-right: 8px;
      font-size: 22px;
      width: 22px;
      height: 22px;
      color: #d97706;
    }

    .search-field {
      width: 100%;
      margin-bottom: 8px;

      mat-icon {
        color: #94a3b8;
      }
    }

    .groups-list {
      max-height: 50vh;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }

    .group-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
      transition: background 0.15s;

      &:last-child {
        border-bottom: none;
      }

      &.clickable {
        cursor: pointer;
        &:hover {
          background: #fffbeb;
        }
      }
    }

    .group-country {
      font-weight: 600;
      color: #4f46e5;
      background: #eef2ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      flex-shrink: 0;
    }

    .group-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .group-family {
      font-weight: 500;
      color: #334155;
    }

    .group-level {
      font-size: 12px;
      color: #94a3b8;
    }

    .group-currency {
      font-size: 12px;
      color: #64748b;
      flex-shrink: 0;
    }

    .group-count {
      font-size: 12px;
      color: #94a3b8;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .empty-search {
      text-align: center;
      padding: 24px;
      color: #94a3b8;
      font-size: 14px;
    }

    .summary {
      margin-top: 8px;
      font-size: 12px;
      color: #94a3b8;
      text-align: right;
    }
  `],
})
export class UncoveredGroupsDialogComponent {
  search = '';

  constructor(
    private dialogRef: MatDialogRef<UncoveredGroupsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { groups: EmployeeGroup[]; canEdit: boolean },
  ) {}

  get filteredGroups(): EmployeeGroup[] {
    if (!this.search.trim()) return this.data.groups;
    const q = this.search.toLowerCase();
    return this.data.groups.filter((g) =>
      g.country.toLowerCase().includes(q) ||
      (g.jobFamily ?? '').toLowerCase().includes(q) ||
      g.level.toLowerCase().includes(q),
    );
  }

  selectGroup(group: EmployeeGroup) {
    if (this.data.canEdit) {
      this.dialogRef.close(group);
    }
  }
}

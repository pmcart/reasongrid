import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RationaleService, RationaleDefinition } from '../core/rationale.service';
import { AuthService } from '../core/auth.service';
import { RationaleDefinitionDialogComponent } from './rationale-definition-dialog.component';

const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURAL: 'Structural',
  MARKET: 'Market',
  PERFORMANCE: 'Performance',
  TEMPORARY: 'Temporary',
  OTHER: 'Other',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  STRUCTURAL: { bg: '#eef2ff', text: '#4338ca' },
  MARKET: { bg: '#ecfdf5', text: '#059669' },
  PERFORMANCE: { bg: '#fef3c7', text: '#92400e' },
  TEMPORARY: { bg: '#fce7f3', text: '#be185d' },
  OTHER: { bg: '#f1f5f9', text: '#475569' },
};

interface GroupedDefinitions {
  category: string;
  categoryLabel: string;
  color: { bg: string; text: string };
  definitions: RationaleDefinition[];
}

@Component({
  selector: 'app-rationale-library-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatSelectModule, MatFormFieldModule, MatChipsModule,
    MatDialogModule, MatSnackBarModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div class="header-info">
          <h1 class="page-title">Rationale Library</h1>
          <p class="page-subtitle">Manage the organisation's approved rationale definitions for pay decisions</p>
        </div>
        @if (canEdit) {
          <button mat-raised-button color="primary" (click)="createNew()">
            <mat-icon>add</mat-icon>
            New Rationale
          </button>
        }
      </div>

      <div class="filters-bar">
        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="filterStatus" (ngModelChange)="loadDefinitions()">
            <mat-option value="ACTIVE">Active</mat-option>
            <mat-option value="ARCHIVED">Archived</mat-option>
            <mat-option value="ALL">All</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="filter-field">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="filterCategory" (ngModelChange)="loadDefinitions()">
            <mat-option value="">All Categories</mat-option>
            <mat-option value="STRUCTURAL">Structural</mat-option>
            <mat-option value="MARKET">Market</mat-option>
            <mat-option value="PERFORMANCE">Performance</mat-option>
            <mat-option value="TEMPORARY">Temporary</mat-option>
            <mat-option value="OTHER">Other</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (groups.length === 0) {
        <mat-card class="empty-state">
          <mat-icon class="empty-icon">menu_book</mat-icon>
          <p>No rationale definitions found</p>
        </mat-card>
      } @else {
        @for (group of groups; track group.category) {
          <div class="category-section">
            <div class="category-header">
              <span class="category-chip" [style.background]="group.color.bg" [style.color]="group.color.text">
                {{ group.categoryLabel }}
              </span>
              <span class="category-count">{{ group.definitions.length }} definition{{ group.definitions.length !== 1 ? 's' : '' }}</span>
            </div>

            <div class="definitions-grid">
              @for (def of group.definitions; track def.id) {
                <mat-card class="definition-card" [class.archived]="def.status === 'ARCHIVED'">
                  <div class="def-header">
                    <div class="def-title-row">
                      <h3 class="def-name">{{ def.name }}</h3>
                      @if (def.status === 'ARCHIVED') {
                        <span class="status-chip archived">Archived</span>
                      }
                      @if (def.requiresSubstantiation) {
                        <span class="substantiation-chip" matTooltip="Requires supporting evidence">
                          <mat-icon class="chip-icon">verified</mat-icon>
                          Substantiation Required
                        </span>
                      }
                    </div>
                    <span class="def-code">{{ def.code }}</span>
                  </div>

                  <p class="def-description">{{ def.plainLanguageDescription || def.legalDescription }}</p>

                  <div class="def-meta">
                    <span class="meta-item">
                      <mat-icon class="meta-icon">tag</mat-icon>
                      v{{ def.version }}
                    </span>
                    <span class="meta-item">
                      <mat-icon class="meta-icon">calendar_today</mat-icon>
                      {{ def.effectiveFrom | date:'mediumDate' }}
                    </span>
                    @if (def.objectiveCriteriaTags && asArray(def.objectiveCriteriaTags).length > 0) {
                      <div class="tags-row">
                        @for (tag of asArray(def.objectiveCriteriaTags); track tag) {
                          <span class="tag-chip">{{ tag }}</span>
                        }
                      </div>
                    }
                  </div>

                  @if (def.applicableDecisionTypes && asArray(def.applicableDecisionTypes).length > 0) {
                    <div class="decision-types">
                      <span class="dt-label">Applies to:</span>
                      @for (dt of asArray(def.applicableDecisionTypes); track dt) {
                        <span class="dt-chip">{{ formatType(dt) }}</span>
                      }
                    </div>
                  }

                  @if (canEdit) {
                    <div class="def-actions">
                      <a mat-button [routerLink]="['/rationale-library', def.code, 'history']" class="history-link">
                        <mat-icon>history</mat-icon>
                        History
                      </a>
                      @if (def.status === 'ACTIVE') {
                        <button mat-button (click)="editDefinition(def)">
                          <mat-icon>edit</mat-icon>
                          Edit
                        </button>
                        @if (isAdmin) {
                          <button mat-button color="warn" (click)="archiveDefinition(def)">
                            <mat-icon>archive</mat-icon>
                            Archive
                          </button>
                        }
                      }
                    </div>
                  }
                </mat-card>
              }
            </div>
          </div>
        }
      }

      <div class="disclaimer">
        This information supports internal governance and transparency requirements.
        It does not constitute legal advice.
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
      margin: 4px 0 0 0;
    }

    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .filter-field { width: 180px; }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px 0;
    }

    .empty-state {
      text-align: center;
      padding: 48px !important;
      color: #94a3b8;
    }

    .empty-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .category-section { margin-bottom: 28px; }

    .category-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .category-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .category-count {
      font-size: 13px;
      color: #94a3b8;
    }

    .definitions-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .definition-card {
      padding: 20px !important;
    }

    .definition-card.archived {
      opacity: 0.7;
      border-left: 3px solid #e2e8f0;
    }

    .def-header {
      margin-bottom: 8px;
    }

    .def-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .def-name {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0;
    }

    .def-code {
      font-size: 12px;
      font-family: monospace;
      color: #94a3b8;
    }

    .status-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .status-chip.archived {
      background: #f1f5f9;
      color: #64748b;
    }

    .substantiation-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 8px;
      background: #fef3c7;
      color: #92400e;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
    }

    .chip-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .def-description {
      font-size: 14px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 12px 0;
    }

    .def-meta {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #94a3b8;
    }

    .meta-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .tags-row {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .tag-chip {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 3px;
      font-size: 11px;
    }

    .decision-types {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .dt-label {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
    }

    .dt-chip {
      display: inline-block;
      padding: 2px 8px;
      background: #eef2ff;
      color: #4338ca;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
    }

    .def-actions {
      display: flex;
      gap: 4px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }

    .history-link {
      text-decoration: none;
    }

    .disclaimer {
      margin-top: 32px;
      padding: 12px 16px;
      background: #f8fafc;
      border-radius: 8px;
      font-size: 12px;
      color: #94a3b8;
      font-style: italic;
      text-align: center;
    }
  `],
})
export class RationaleLibraryListComponent implements OnInit {
  groups: GroupedDefinitions[] = [];
  loading = true;
  filterStatus = 'ACTIVE';
  filterCategory = '';

  constructor(
    private rationaleService: RationaleService,
    private auth: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadDefinitions();
  }

  get canEdit(): boolean {
    const role = this.auth.user()?.role;
    return role === 'ADMIN' || role === 'HR_MANAGER';
  }

  get isAdmin(): boolean {
    return this.auth.user()?.role === 'ADMIN';
  }

  loadDefinitions() {
    this.loading = true;
    const params: Record<string, string> = {};
    if (this.filterStatus) params['status'] = this.filterStatus;
    if (this.filterCategory) params['category'] = this.filterCategory;

    this.rationaleService.getAll(params).subscribe({
      next: (defs) => {
        this.groups = this.groupByCategory(defs);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  createNew() {
    const dialogRef = this.dialog.open(RationaleDefinitionDialogComponent, {
      width: '640px',
      data: { mode: 'create' },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDefinitions();
        this.rationaleService.refreshCache();
      }
    });
  }

  editDefinition(def: RationaleDefinition) {
    const dialogRef = this.dialog.open(RationaleDefinitionDialogComponent, {
      width: '640px',
      data: { mode: 'edit', definition: def },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadDefinitions();
        this.rationaleService.refreshCache();
      }
    });
  }

  archiveDefinition(def: RationaleDefinition) {
    if (!confirm(`Archive "${def.name}"? It will no longer be available for new pay decisions.`)) {
      return;
    }
    this.rationaleService.archive(def.id).subscribe({
      next: () => {
        this.snackBar.open(`"${def.name}" archived`, 'OK', { duration: 3000 });
        this.loadDefinitions();
        this.rationaleService.refreshCache();
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to archive', 'OK', { duration: 3000 });
      },
    });
  }

  formatType(type: string): string {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  }

  asArray(val: unknown): string[] {
    return Array.isArray(val) ? val : [];
  }

  private groupByCategory(defs: RationaleDefinition[]): GroupedDefinitions[] {
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
        color: CATEGORY_COLORS[cat] ?? { bg: '#f1f5f9', text: '#475569' },
        definitions: map.get(cat)!,
      }));
  }
}

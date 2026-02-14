import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RationaleService, RationaleDefinition } from '../core/rationale.service';

const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURAL: 'Structural',
  MARKET: 'Market',
  PERFORMANCE: 'Performance',
  TEMPORARY: 'Temporary',
  OTHER: 'Other',
};

@Component({
  selector: 'app-rationale-version-history',
  standalone: true,
  imports: [
    CommonModule, RouterModule, MatCardModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-container">
      <div class="breadcrumb">
        <a routerLink="/rationale-library">Rationale Library</a>
        <mat-icon class="breadcrumb-sep">chevron_right</mat-icon>
        <span>{{ code }} — Version History</span>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else if (versions.length === 0) {
        <mat-card class="empty-state">
          <p>No versions found for code "{{ code }}"</p>
        </mat-card>
      } @else {
        <div class="header-card">
          <h1 class="page-title">{{ versions[0].name }}</h1>
          <p class="page-subtitle">{{ code }} &middot; {{ getCategoryLabel(versions[0].category) }} &middot; {{ versions.length }} version{{ versions.length !== 1 ? 's' : '' }}</p>
        </div>

        <div class="timeline">
          @for (v of versions; track v.id; let i = $index) {
            <div class="timeline-entry" [class.latest]="i === 0" [class.archived]="v.status === 'ARCHIVED'">
              <div class="timeline-marker">
                <div class="marker-dot" [class.active]="i === 0 && v.status === 'ACTIVE'"></div>
                @if (i < versions.length - 1) {
                  <div class="marker-line"></div>
                }
              </div>

              <mat-card class="version-card">
                <div class="version-header">
                  <span class="version-badge">v{{ v.version }}</span>
                  @if (i === 0 && v.status === 'ACTIVE') {
                    <span class="current-badge">Current</span>
                  }
                  @if (v.status === 'ARCHIVED') {
                    <span class="archived-badge">Archived</span>
                  }
                  <span class="version-date">
                    Effective from {{ v.effectiveFrom | date:'mediumDate' }}
                    @if (v.effectiveTo) {
                      to {{ v.effectiveTo | date:'mediumDate' }}
                    }
                  </span>
                </div>

                <div class="version-body">
                  <div class="field-group">
                    <div class="field-label">Name</div>
                    <div class="field-value">{{ v.name }}</div>
                  </div>
                  <div class="field-group">
                    <div class="field-label">Legal Description</div>
                    <div class="field-value description">{{ v.legalDescription }}</div>
                  </div>
                  @if (v.plainLanguageDescription) {
                    <div class="field-group">
                      <div class="field-label">Plain Language</div>
                      <div class="field-value description">{{ v.plainLanguageDescription }}</div>
                    </div>
                  }
                  <div class="field-row">
                    <div class="field-group">
                      <div class="field-label">Category</div>
                      <div class="field-value">{{ getCategoryLabel(v.category) }}</div>
                    </div>
                    <div class="field-group">
                      <div class="field-label">Substantiation</div>
                      <div class="field-value">{{ v.requiresSubstantiation ? 'Required' : 'Not required' }}</div>
                    </div>
                  </div>
                </div>

                <div class="version-footer">
                  <span class="footer-meta">Created {{ v.createdAt | date:'medium' }}</span>
                </div>
              </mat-card>
            </div>
          }
        </div>
      }

      <div class="back-link">
        <a mat-button routerLink="/rationale-library">
          <mat-icon>arrow_back</mat-icon>
          Back to Rationale Library
        </a>
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 800px; margin: 0 auto; }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 20px;
      font-size: 14px;
      color: #64748b;

      a {
        color: #4f46e5;
        text-decoration: none;
        font-weight: 500;
        &:hover { text-decoration: underline; }
      }
    }

    .breadcrumb-sep {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #cbd5e1;
    }

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

    .header-card { margin-bottom: 24px; }

    .page-title {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    .page-subtitle {
      font-size: 14px;
      color: #64748b;
      margin: 4px 0 0 0;
    }

    .timeline {
      display: flex;
      flex-direction: column;
    }

    .timeline-entry {
      display: flex;
      gap: 16px;
    }

    .timeline-marker {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 20px;
      flex-shrink: 0;
    }

    .marker-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #cbd5e1;
      border: 2px solid #e2e8f0;
      margin-top: 20px;
    }

    .marker-dot.active {
      background: #4f46e5;
      border-color: #c7d2fe;
    }

    .marker-line {
      flex: 1;
      width: 2px;
      background: #e2e8f0;
    }

    .version-card {
      flex: 1;
      padding: 16px 20px !important;
      margin-bottom: 16px;
    }

    .timeline-entry.archived .version-card {
      opacity: 0.7;
    }

    .version-header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .version-badge {
      display: inline-block;
      padding: 2px 10px;
      background: #eef2ff;
      color: #4338ca;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 700;
      font-family: monospace;
    }

    .current-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #d1fae5;
      color: #065f46;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .archived-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .version-date {
      font-size: 12px;
      color: #94a3b8;
    }

    .version-body {
      margin-bottom: 8px;
    }

    .field-group {
      margin-bottom: 10px;
    }

    .field-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
      margin-bottom: 2px;
    }

    .field-value {
      font-size: 14px;
      color: #1e293b;
    }

    .field-value.description {
      line-height: 1.5;
    }

    .field-row {
      display: flex;
      gap: 24px;
    }

    .version-footer {
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }

    .footer-meta {
      font-size: 12px;
      color: #94a3b8;
    }

    .back-link {
      margin-top: 24px;

      a {
        text-decoration: none;
        color: #4f46e5;
      }
    }
  `],
})
export class RationaleVersionHistoryComponent implements OnInit {
  code = '';
  versions: RationaleDefinition[] = [];
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private rationaleService: RationaleService,
  ) {}

  ngOnInit() {
    this.code = this.route.snapshot.paramMap.get('code')!;
    this.rationaleService.getVersionHistory(this.code).subscribe({
      next: (versions) => {
        this.versions = versions;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category;
  }
}

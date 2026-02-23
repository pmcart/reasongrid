import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ComplianceService, DisclosureTemplate, DisclosureResult } from '../core/compliance.service';
import { SalaryRangeService, SalaryRange } from '../core/salary-range.service';

interface SalaryRangeGroup {
  country: string;
  ranges: SalaryRange[];
}

@Component({
  selector: 'app-disclosure-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Salary Disclosure Generator</h1>
          <p class="page-subtitle">Generate standardised salary disclosure text for job postings and candidate communications</p>
        </div>
      </div>

      <div class="disclaimer-banner">
        <mat-icon class="disclaimer-icon">info</mat-icon>
        <span>
          This information supports internal governance and transparency requirements.
          It does not constitute legal advice.
        </span>
      </div>

      @if (salaryRanges.length === 0 && !loadingRanges) {
        <div class="warning-banner">
          <mat-icon>warning</mat-icon>
          <div>
            <strong>No salary ranges defined</strong>
            <p>You must define salary ranges before generating disclosure text. Go to Settings to configure salary ranges.</p>
          </div>
        </div>
      }

      <div class="generator-layout">
        <!-- Configuration Panel -->
        <mat-card class="config-card">
          <h2 class="section-title">Configuration</h2>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Disclosure Template</mat-label>
            <mat-select [(ngModel)]="selectedTemplateId">
              @for (tpl of templates; track tpl.id) {
                <mat-option [value]="tpl.id">{{ tpl.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Salary Range</mat-label>
            <mat-select [(ngModel)]="selectedRangeId" (selectionChange)="onRangeSelected()">
              @for (group of rangeGroups; track group.country) {
                <mat-optgroup [label]="group.country">
                  @for (range of group.ranges; track range.id) {
                    <mat-option [value]="range.id">
                      {{ range.jobFamily || '(Any)' }} / {{ range.level }} — {{ range.currency }}
                    </mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
          </mat-form-field>

          @if (selectedRange) {
            <div class="range-preview">
              <h3>Selected Range</h3>
              <div class="range-details">
                <div class="range-row">
                  <span class="range-label">Country</span>
                  <span class="range-value">{{ selectedRange.country }}</span>
                </div>
                <div class="range-row">
                  <span class="range-label">Job Family</span>
                  <span class="range-value">{{ selectedRange.jobFamily || '(Any)' }}</span>
                </div>
                <div class="range-row">
                  <span class="range-label">Level</span>
                  <span class="range-value">{{ selectedRange.level }}</span>
                </div>
                <div class="range-row">
                  <span class="range-label">Currency</span>
                  <span class="range-value">{{ selectedRange.currency }}</span>
                </div>
                <div class="range-values">
                  <div class="range-val-item">
                    <span class="val-label">Min</span>
                    <span class="val-num">{{ formatNum(selectedRange.min, selectedRange.currency) }}</span>
                  </div>
                  <div class="range-val-item mid">
                    <span class="val-label">Mid</span>
                    <span class="val-num">{{ formatNum(selectedRange.mid, selectedRange.currency) }}</span>
                  </div>
                  <div class="range-val-item">
                    <span class="val-label">Max</span>
                    <span class="val-num">{{ formatNum(selectedRange.max, selectedRange.currency) }}</span>
                  </div>
                </div>
              </div>
            </div>
          }

          <!-- Extra Variables -->
          <div class="extra-section">
            <h3>Additional Variables (optional)</h3>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Role Title</mat-label>
              <input matInput [(ngModel)]="extraRoleTitle" placeholder="e.g. Senior Software Engineer">
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Level</mat-label>
              <input matInput [(ngModel)]="extraLevel" placeholder="e.g. IC4">
            </mat-form-field>
          </div>

          <button mat-raised-button color="primary" class="generate-btn"
                  (click)="generate()"
                  [disabled]="!selectedTemplateId || !selectedRangeId || generating">
            <mat-icon>{{ generating ? 'hourglass_empty' : 'auto_awesome' }}</mat-icon>
            {{ generating ? 'Generating...' : 'Generate' }}
          </button>
        </mat-card>

        <!-- Output Panel -->
        <mat-card class="output-card">
          <h2 class="section-title">Generated Disclosure</h2>

          @if (generating) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p class="generating-text">Generating disclosure text...</p>
          }

          @if (result && !generating) {
            <div class="output-meta">
              <span class="template-badge">{{ result.templateName }}</span>
            </div>
            <div class="output-preview">
              <pre class="output-text">{{ result.text }}</pre>
            </div>
            <div class="output-actions">
              <button mat-stroked-button color="primary" (click)="copyToClipboard()">
                <mat-icon>content_copy</mat-icon>
                Copy to Clipboard
              </button>
            </div>
          }

          @if (!result && !generating) {
            <div class="empty-output">
              <mat-icon>description</mat-icon>
              <p>Select a template and salary range, then click "Generate" to create disclosure text.</p>
            </div>
          }
        </mat-card>
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

    .warning-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 16px 20px;
      margin-bottom: 24px;
      color: #92400e;

      mat-icon {
        color: #d97706;
        font-size: 22px;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        margin-top: 2px;
      }

      strong {
        display: block;
        font-size: 14px;
        margin-bottom: 4px;
      }

      p {
        font-size: 13px;
        margin: 0;
        line-height: 1.5;
      }
    }

    .generator-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
    }

    .config-card, .output-card {
      padding: 24px !important;
      border-radius: 12px !important;
    }

    .section-title {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 20px 0;
    }

    .full-width {
      width: 100%;
    }

    /* Range Preview */
    .range-preview {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .range-preview h3 {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin: 0 0 12px 0;
    }

    .range-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .range-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }

    .range-label {
      color: #64748b;
    }

    .range-value {
      font-weight: 500;
      color: #0f172a;
    }

    .range-values {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
    }

    .range-val-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      flex: 1;
    }

    .range-val-item.mid {
      background: #eef2ff;
      border-radius: 6px;
      padding: 6px 4px;
    }

    .val-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: uppercase;
    }

    .val-num {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
    }

    /* Extra Variables */
    .extra-section {
      margin-bottom: 16px;
    }

    .extra-section h3 {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      margin: 0 0 12px 0;
    }

    .generate-btn {
      width: 100%;
    }

    /* Output Panel */
    .generating-text {
      font-size: 13px;
      color: #64748b;
      margin: 12px 0 0 0;
    }

    .output-meta {
      margin-bottom: 12px;
    }

    .template-badge {
      display: inline-block;
      padding: 3px 10px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }

    .output-preview {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
    }

    .output-text {
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.7;
      color: #1e293b;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
    }

    .output-actions {
      display: flex;
      gap: 8px;
    }

    .empty-output {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 24px;
      text-align: center;
      color: #94a3b8;

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        color: #cbd5e1;
        margin-bottom: 12px;
      }

      p {
        font-size: 13px;
        margin: 0;
        max-width: 280px;
        line-height: 1.5;
      }
    }

    @media (max-width: 900px) {
      .generator-layout {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class DisclosureGeneratorComponent implements OnInit {
  private complianceService = inject(ComplianceService);
  private salaryRangeService = inject(SalaryRangeService);
  private snackBar = inject(MatSnackBar);

  templates: DisclosureTemplate[] = [];
  salaryRanges: SalaryRange[] = [];
  rangeGroups: SalaryRangeGroup[] = [];
  loadingRanges = true;

  selectedTemplateId = '';
  selectedRangeId = '';
  selectedRange: SalaryRange | null = null;

  extraRoleTitle = '';
  extraLevel = '';

  generating = false;
  result: DisclosureResult | null = null;

  ngOnInit() {
    this.loadTemplates();
    this.loadRanges();
  }

  loadTemplates() {
    this.complianceService.getTemplates().subscribe({
      next: (templates) => {
        this.templates = templates;
        if (templates.length > 0) {
          this.selectedTemplateId = templates[0].id;
        }
      },
    });
  }

  loadRanges() {
    this.loadingRanges = true;
    this.salaryRangeService.getAll().subscribe({
      next: (ranges) => {
        this.salaryRanges = ranges;
        this.buildGroups(ranges);
        this.loadingRanges = false;
      },
      error: () => {
        this.loadingRanges = false;
      },
    });
  }

  onRangeSelected() {
    this.selectedRange = this.salaryRanges.find((r) => r.id === this.selectedRangeId) || null;
  }

  generate() {
    if (!this.selectedTemplateId || !this.selectedRangeId) return;

    const variables: Record<string, string> = {};
    if (this.extraRoleTitle) variables['roleTitle'] = this.extraRoleTitle;
    if (this.extraLevel) variables['level'] = this.extraLevel;

    this.generating = true;
    this.result = null;

    this.complianceService.generateDisclosure(
      this.selectedTemplateId,
      this.selectedRangeId,
      Object.keys(variables).length > 0 ? variables : undefined,
    ).subscribe({
      next: (result) => {
        this.result = result;
        this.generating = false;
      },
      error: (err) => {
        this.snackBar.open(err?.error?.error || 'Failed to generate disclosure', 'OK', { duration: 3000 });
        this.generating = false;
      },
    });
  }

  copyToClipboard() {
    if (!this.result) return;
    navigator.clipboard.writeText(this.result.text).then(() => {
      this.snackBar.open('Copied to clipboard', 'OK', { duration: 2000 });
    });
  }

  formatNum(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
    } catch {
      return value.toLocaleString();
    }
  }

  private buildGroups(ranges: SalaryRange[]) {
    const map = new Map<string, SalaryRange[]>();
    for (const range of ranges) {
      const list = map.get(range.country) || [];
      list.push(range);
      map.set(range.country, list);
    }
    this.rangeGroups = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([country, ranges]) => ({ country, ranges }));
  }
}

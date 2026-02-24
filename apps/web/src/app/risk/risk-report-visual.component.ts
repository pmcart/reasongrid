import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface StructuredRiskReport {
  executiveSummary: {
    totalGroups: number;
    thresholdAlertCount: number;
    requiresReviewCount: number;
    withinRangeCount: number;
    insufficientDataCount: number;
    riskPosture: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
    summary: string;
  };
  keyFindings: string[];
  countryBreakdown: Array<{
    country: string;
    alertCount: number;
    reviewCount: number;
    withinRangeCount: number;
    blindSpotCount: number;
    topGapPct?: number;
  }>;
  jobFamilyBreakdown: Array<{
    jobFamily: string;
    alertCount: number;
    reviewCount: number;
    avgAlertGapPct?: number;
  }>;
  topRisks: Array<{
    groupKey: string;
    country: string;
    jobFamily: string;
    level: string;
    gapPct: number;
    womenCount: number;
    menCount: number;
    isLowSample: boolean;
    concern: string;
  }>;
  dataQualityInsights: {
    coverageScore: number;
    blindSpotCount: number;
    majorBlindSpotCountries: string[];
    recommendation: string;
  };
  recommendedActions: Array<{
    priority: number;
    title: string;
    description: string;
    category: 'INVESTIGATE' | 'DATA_QUALITY' | 'PROCESS' | 'MONITORING';
  }>;
}

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  offset: number;
  dash: number;
}

interface BarEntry {
  label: string;
  gapPct: number;
  absGap: number;
  color: string;
  isLowSample: boolean;
}

@Component({
  selector: 'app-risk-report-visual',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (data) {
      <!-- A. Executive Summary -->
      <div class="exec-summary">
        <div class="posture-row">
          <span class="posture-badge" [class]="'posture-' + data.executiveSummary.riskPosture.toLowerCase()">
            <mat-icon class="posture-icon">{{ postureIcon }}</mat-icon>
            {{ data.executiveSummary.riskPosture }} RISK
          </span>
          @if (aiEnhanced) {
            <span class="ai-badge">
              <mat-icon class="ai-badge-icon">auto_awesome</mat-icon>
              AI-enhanced
            </span>
          }
        </div>
        <p class="summary-text">{{ data.executiveSummary.summary }}</p>

        <div class="stat-chips">
          <div class="stat-chip">
            <span class="chip-value">{{ data.executiveSummary.totalGroups }}</span>
            <span class="chip-label">Total Groups</span>
          </div>
          <div class="stat-chip chip-alert">
            <span class="chip-value">{{ data.executiveSummary.thresholdAlertCount }}</span>
            <span class="chip-label">Threshold Alerts</span>
          </div>
          <div class="stat-chip chip-review">
            <span class="chip-value">{{ data.executiveSummary.requiresReviewCount }}</span>
            <span class="chip-label">Requires Review</span>
          </div>
          <div class="stat-chip chip-green">
            <span class="chip-value">{{ data.executiveSummary.withinRangeCount }}</span>
            <span class="chip-label">Within Range</span>
          </div>
          <div class="stat-chip chip-blind">
            <span class="chip-value">{{ data.executiveSummary.insufficientDataCount }}</span>
            <span class="chip-label">Blind Spots</span>
          </div>
        </div>
      </div>

      <!-- Key Findings -->
      @if (data.keyFindings.length > 0) {
        <div class="findings-row">
          @for (f of data.keyFindings; track $index) {
            <div class="finding-item">
              <mat-icon class="finding-icon">chevron_right</mat-icon>
              <span>{{ f }}</span>
            </div>
          }
        </div>
      }

      <!-- B. Charts row: donut + bar chart -->
      <div class="charts-row">
        <!-- Donut chart -->
        <div class="chart-panel donut-panel">
          <h3 class="chart-title">Risk Distribution</h3>
          <div class="donut-container">
            <svg viewBox="0 0 120 120" class="donut-svg">
              @for (seg of donutSegments; track seg.label) {
                @if (seg.value > 0) {
                  <circle
                    r="42"
                    cx="60"
                    cy="60"
                    fill="transparent"
                    [attr.stroke]="seg.color"
                    stroke-width="22"
                    [attr.stroke-dasharray]="seg.dash + ' ' + (circumference - seg.dash)"
                    [attr.stroke-dashoffset]="-seg.offset"
                    stroke-linecap="butt"
                  />
                }
              }
              <text x="60" y="56" text-anchor="middle" class="donut-center-value">{{ data.executiveSummary.totalGroups }}</text>
              <text x="60" y="68" text-anchor="middle" class="donut-center-label">groups</text>
            </svg>
            <div class="donut-legend">
              @for (seg of donutSegments; track seg.label) {
                <div class="legend-item">
                  <span class="legend-dot" [style.background]="seg.color"></span>
                  <span class="legend-label">{{ seg.label }}</span>
                  <span class="legend-count">{{ seg.value }}</span>
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Horizontal bar chart of top gaps -->
        @if (barEntries.length > 0) {
          <div class="chart-panel bar-panel">
            <h3 class="chart-title">Top Gap Groups ({{ barEntries.length }})</h3>
            <div class="bar-chart">
              @for (entry of barEntries; track entry.label) {
                <div class="bar-row">
                  <span class="bar-label" [title]="entry.label">{{ entry.label }}</span>
                  <div class="bar-track">
                    <div
                      class="bar-fill"
                      [style.width.%]="(entry.absGap / maxBarGap) * 100"
                      [style.background]="entry.color"
                    ></div>
                  </div>
                  <span class="bar-value" [style.color]="entry.color">
                    {{ entry.gapPct > 0 ? '+' : '' }}{{ entry.gapPct | number:'1.1-1' }}%
                    @if (entry.isLowSample) { <span class="low-sample-flag" title="Low sample size">*</span> }
                  </span>
                </div>
              }
            </div>
            <p class="bar-note">* Low sample size — treat with caution</p>
          </div>
        }
      </div>

      <!-- C. Country & Job Family breakdown -->
      <div class="breakdown-row">
        @if (data.countryBreakdown.length > 0) {
          <div class="breakdown-panel">
            <h3 class="chart-title">By Country</h3>
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th class="col-alert">Alerts</th>
                  <th class="col-review">Review</th>
                  <th class="col-within">Within</th>
                  <th class="col-blind">Blind</th>
                  <th>Top Gap</th>
                </tr>
              </thead>
              <tbody>
                @for (c of data.countryBreakdown; track c.country) {
                  <tr>
                    <td class="country-cell">{{ c.country }}</td>
                    <td class="col-alert">
                      @if (c.alertCount > 0) {
                        <span class="count-dot dot-alert">{{ c.alertCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td class="col-review">
                      @if (c.reviewCount > 0) {
                        <span class="count-dot dot-review">{{ c.reviewCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td class="col-within">
                      @if (c.withinRangeCount > 0) {
                        <span class="count-dot dot-within">{{ c.withinRangeCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td class="col-blind">
                      @if (c.blindSpotCount > 0) {
                        <span class="count-dot dot-blind">{{ c.blindSpotCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td>
                      @if (c.topGapPct) {
                        <span class="top-gap" [class.gap-high]="c.topGapPct >= 5">{{ c.topGapPct | number:'1.1-1' }}%</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (data.jobFamilyBreakdown.length > 0) {
          <div class="breakdown-panel">
            <h3 class="chart-title">By Job Family</h3>
            <table class="breakdown-table">
              <thead>
                <tr>
                  <th>Job Family</th>
                  <th class="col-alert">Alerts</th>
                  <th class="col-review">Review</th>
                  <th>Avg Gap</th>
                </tr>
              </thead>
              <tbody>
                @for (j of data.jobFamilyBreakdown; track j.jobFamily) {
                  <tr>
                    <td>{{ j.jobFamily }}</td>
                    <td class="col-alert">
                      @if (j.alertCount > 0) {
                        <span class="count-dot dot-alert">{{ j.alertCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td class="col-review">
                      @if (j.reviewCount > 0) {
                        <span class="count-dot dot-review">{{ j.reviewCount }}</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                    <td>
                      @if (j.avgAlertGapPct) {
                        <span class="top-gap gap-high">{{ j.avgAlertGapPct | number:'1.1-1' }}%</span>
                      } @else {
                        <span class="count-zero">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- D. Data Quality panel -->
      <div class="quality-panel">
        <div class="quality-header">
          <mat-icon class="quality-icon">data_check</mat-icon>
          <h3>Data Coverage</h3>
          <span class="coverage-score" [class]="coverageScoreClass">
            {{ data.dataQualityInsights.coverageScore }}% measurable
          </span>
        </div>
        <div class="coverage-bar-track">
          <div
            class="coverage-bar-fill"
            [style.width.%]="data.dataQualityInsights.coverageScore"
            [class]="coverageScoreClass"
          ></div>
        </div>
        @if (data.dataQualityInsights.majorBlindSpotCountries.length > 0) {
          <p class="quality-detail">
            <strong>Blind spot countries:</strong>
            {{ data.dataQualityInsights.majorBlindSpotCountries.join(', ') }}
          </p>
        }
        <p class="quality-rec">{{ data.dataQualityInsights.recommendation }}</p>
      </div>

      <!-- E. Recommended Actions -->
      @if (data.recommendedActions.length > 0) {
        <div class="actions-section">
          <h3 class="chart-title">Recommended Actions</h3>
          <div class="actions-grid">
            @for (action of data.recommendedActions; track action.priority) {
              <div class="action-card" [class]="'action-' + action.category.toLowerCase()">
                <div class="action-header">
                  <span class="action-priority">#{{ action.priority }}</span>
                  <span class="action-category-badge">{{ formatCategory(action.category) }}</span>
                </div>
                <p class="action-title">{{ action.title }}</p>
                <p class="action-desc">{{ action.description }}</p>
              </div>
            }
          </div>
        </div>
      }
    }
  `,
  styles: [`
    .exec-summary {
      margin-bottom: 20px;
    }

    .posture-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .posture-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }

    .posture-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .posture-low { background: #dcfce7; color: #15803d; }
    .posture-moderate { background: #dbeafe; color: #1d4ed8; }
    .posture-elevated { background: #fef3c7; color: #b45309; }
    .posture-high { background: #fee2e2; color: #b91c1c; }

    .ai-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      background: #ede9fe;
      color: #6d28d9;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .ai-badge-icon { font-size: 14px; width: 14px; height: 14px; }

    .summary-text {
      font-size: 14px;
      color: #374151;
      line-height: 1.6;
      margin: 0 0 14px 0;
    }

    .stat-chips {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .stat-chip {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 18px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      min-width: 80px;
    }

    .chip-alert { border-color: #fca5a5; background: #fef2f2; }
    .chip-review { border-color: #fcd34d; background: #fffbeb; }
    .chip-green { border-color: #6ee7b7; background: #ecfdf5; }
    .chip-blind { border-color: #cbd5e1; background: #f8fafc; }

    .chip-value {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1;
    }

    .chip-label {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
      white-space: nowrap;
    }

    .findings-row {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .finding-item {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      font-size: 13px;
      color: #374151;
      line-height: 1.5;
    }

    .finding-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #6366f1;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Charts row */
    .charts-row {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .chart-panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }

    .chart-title {
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin: 0 0 12px 0;
    }

    /* Donut chart */
    .donut-container {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .donut-svg {
      width: 110px;
      height: 110px;
      flex-shrink: 0;
    }

    .donut-center-value {
      font-size: 22px;
      font-weight: 700;
      fill: #0f172a;
      font-family: inherit;
    }

    .donut-center-label {
      font-size: 9px;
      fill: #94a3b8;
      font-family: inherit;
    }

    .donut-legend {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 7px;
      font-size: 12px;
      color: #374151;
    }

    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .legend-label { flex: 1; }
    .legend-count { font-weight: 600; color: #0f172a; }

    /* Bar chart */
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .bar-row {
      display: grid;
      grid-template-columns: 130px 1fr 58px;
      align-items: center;
      gap: 8px;
    }

    .bar-label {
      font-size: 11px;
      color: #475569;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .bar-track {
      height: 14px;
      background: #f1f5f9;
      border-radius: 3px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .bar-value {
      font-size: 11px;
      font-weight: 600;
      text-align: right;
      white-space: nowrap;
    }

    .low-sample-flag { color: #94a3b8; }

    .bar-note {
      font-size: 11px;
      color: #94a3b8;
      margin: 6px 0 0 0;
      font-style: italic;
    }

    /* Breakdown tables */
    .breakdown-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .breakdown-panel {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
    }

    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .breakdown-table th {
      text-align: left;
      padding: 4px 6px;
      color: #94a3b8;
      font-weight: 500;
      font-size: 11px;
      border-bottom: 1px solid #f1f5f9;
    }

    .breakdown-table td {
      padding: 5px 6px;
      border-bottom: 1px solid #f8fafc;
      color: #374151;
    }

    .breakdown-table tr:last-child td { border-bottom: none; }

    .country-cell { font-weight: 600; }

    .col-alert, .col-review, .col-within, .col-blind { text-align: center; }

    .count-dot {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-size: 11px;
      font-weight: 600;
    }

    .dot-alert { background: #fee2e2; color: #b91c1c; }
    .dot-review { background: #fef3c7; color: #b45309; }
    .dot-within { background: #dcfce7; color: #15803d; }
    .dot-blind { background: #f1f5f9; color: #64748b; }

    .count-zero { color: #cbd5e1; }

    .top-gap {
      font-weight: 600;
      font-size: 12px;
      color: #475569;
    }

    .gap-high { color: #b91c1c; }

    /* Data quality */
    .quality-panel {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .quality-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .quality-header h3 {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
      margin: 0;
      flex: 1;
    }

    .quality-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #6366f1;
    }

    .coverage-score {
      font-size: 12px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 10px;
    }

    .coverage-score.good { background: #dcfce7; color: #15803d; }
    .coverage-score.moderate { background: #fef3c7; color: #b45309; }
    .coverage-score.poor { background: #fee2e2; color: #b91c1c; }

    .coverage-bar-track {
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      margin-bottom: 10px;
      overflow: hidden;
    }

    .coverage-bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .coverage-bar-fill.good { background: #10b981; }
    .coverage-bar-fill.moderate { background: #f59e0b; }
    .coverage-bar-fill.poor { background: #ef4444; }

    .quality-detail {
      font-size: 12px;
      color: #374151;
      margin: 0 0 6px 0;
    }

    .quality-rec {
      font-size: 13px;
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }

    /* Actions */
    .actions-section {
      margin-bottom: 8px;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
    }

    .action-card {
      padding: 14px 16px;
      border-radius: 8px;
      border-left: 3px solid;
    }

    .action-investigate { background: #fff1f2; border-color: #ef4444; }
    .action-data_quality { background: #fffbeb; border-color: #f59e0b; }
    .action-process { background: #eff6ff; border-color: #3b82f6; }
    .action-monitoring { background: #f0fdf4; border-color: #10b981; }

    .action-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .action-priority {
      font-size: 11px;
      font-weight: 700;
      color: #94a3b8;
    }

    .action-category-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 7px;
      border-radius: 8px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .action-investigate .action-category-badge { background: #fee2e2; color: #b91c1c; }
    .action-data_quality .action-category-badge { background: #fef3c7; color: #92400e; }
    .action-process .action-category-badge { background: #dbeafe; color: #1e40af; }
    .action-monitoring .action-category-badge { background: #dcfce7; color: #15803d; }

    .action-title {
      font-size: 13px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 5px 0;
      line-height: 1.4;
    }

    .action-desc {
      font-size: 12px;
      color: #64748b;
      margin: 0;
      line-height: 1.5;
    }
  `],
})
export class RiskReportVisualComponent implements OnChanges {
  @Input() reportData: StructuredRiskReport | null = null;
  @Input() generatedAt = '';
  @Input() model = '';
  @Input() aiEnhanced = false;

  data: StructuredRiskReport | null = null;
  donutSegments: DonutSegment[] = [];
  barEntries: BarEntry[] = [];
  maxBarGap = 10;
  readonly circumference = 2 * Math.PI * 42;

  ngOnChanges() {
    this.data = this.reportData;
    if (this.data) {
      this.buildDonut();
      this.buildBars();
    }
  }

  get postureIcon(): string {
    switch (this.data?.executiveSummary.riskPosture) {
      case 'LOW': return 'check_circle';
      case 'MODERATE': return 'info';
      case 'ELEVATED': return 'warning';
      case 'HIGH': return 'error';
      default: return 'info';
    }
  }

  get coverageScoreClass(): string {
    const s = this.data?.dataQualityInsights.coverageScore ?? 0;
    if (s >= 70) return 'good';
    if (s >= 40) return 'moderate';
    return 'poor';
  }

  private buildDonut() {
    if (!this.data) return;
    const es = this.data.executiveSummary;
    const segments = [
      { label: 'Threshold Alert', value: es.thresholdAlertCount, color: '#ef4444' },
      { label: 'Requires Review', value: es.requiresReviewCount, color: '#f59e0b' },
      { label: 'Within Range', value: es.withinRangeCount, color: '#10b981' },
      { label: 'Blind Spot', value: es.insufficientDataCount, color: '#94a3b8' },
    ];
    const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
    let offset = 0;
    this.donutSegments = segments.map((seg) => {
      const dash = (seg.value / total) * this.circumference;
      const s: DonutSegment = { ...seg, offset, dash };
      offset += dash;
      return s;
    });
  }

  private buildBars() {
    if (!this.data) return;
    const entries: BarEntry[] = this.data.topRisks.map((r) => ({
      label: `${r.country}/${r.jobFamily}/${r.level}`,
      gapPct: r.gapPct,
      absGap: Math.abs(r.gapPct),
      color: r.gapPct >= 5 || r.gapPct <= -5 ? '#ef4444' : '#f59e0b',
      isLowSample: r.isLowSample,
    }));
    entries.sort((a, b) => b.absGap - a.absGap);
    this.barEntries = entries.slice(0, 15);
    this.maxBarGap = Math.max(...this.barEntries.map((e) => e.absGap), 10);
  }

  formatCategory(cat: string): string {
    return cat.replace(/_/g, ' ');
  }
}

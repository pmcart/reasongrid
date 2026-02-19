import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import type { EvaluationResult, CheckResult } from '../core/evaluation.service';

const CHECK_TYPE_LABELS: Record<string, string> = {
  GENDER_GAP_IMPACT: 'Gender Gap Impact',
  SALARY_RANGE_COMPLIANCE: 'Salary Range',
  MEDIAN_DEVIATION: 'Peer Median Deviation',
  HISTORICAL_CONSISTENCY: 'Historical Consistency',
  CHANGE_MAGNITUDE: 'Change Magnitude',
};

const CHECK_TYPE_ICONS: Record<string, string> = {
  GENDER_GAP_IMPACT: 'wc',
  SALARY_RANGE_COMPLIANCE: 'straighten',
  MEDIAN_DEVIATION: 'bar_chart',
  HISTORICAL_CONSISTENCY: 'history',
  CHANGE_MAGNITUDE: 'trending_up',
};

@Component({
  selector: 'app-evaluation-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatExpansionModule],
  template: `
    @if (result) {
      <div class="eval-panel">
        <!-- Overall status banner -->
        <div class="eval-banner" [class]="'banner-' + result.overallStatus.toLowerCase()">
          <mat-icon class="banner-icon">{{ getBannerIcon() }}</mat-icon>
          <div class="banner-content">
            <span class="banner-title">{{ getBannerTitle() }}</span>
            <span class="banner-subtitle">{{ getBannerSubtitle() }}</span>
          </div>
        </div>

        <!-- Individual checks -->
        <div class="eval-checks">
          @for (check of result.checks; track check.checkType) {
            <div class="eval-check" [class]="'check-' + check.status.toLowerCase()">
              <div class="check-header" (click)="toggleCheck(check.checkType)">
                <div class="check-status-icon">
                  <mat-icon>{{ getStatusIcon(check.status) }}</mat-icon>
                </div>
                <div class="check-info">
                  <div class="check-label">{{ getCheckLabel(check.checkType) }}</div>
                  <div class="check-headline">{{ check.headline }}</div>
                </div>
                <mat-icon class="check-expand">
                  {{ expandedChecks[check.checkType] ? 'expand_less' : 'expand_more' }}
                </mat-icon>
              </div>
              @if (expandedChecks[check.checkType]) {
                <div class="check-detail">
                  <p class="check-detail-text">{{ check.detail }}</p>
                  @if (check.currentValue != null || check.projectedValue != null) {
                    <div class="check-metrics">
                      @if (check.currentValue != null) {
                        <div class="metric">
                          <span class="metric-label">Current</span>
                          <span class="metric-value">{{ formatMetric(check) }}</span>
                        </div>
                      }
                      @if (check.projectedValue != null) {
                        <div class="metric">
                          <span class="metric-label">Projected</span>
                          <span class="metric-value projected">{{ check.projectedValue | number:'1.0-0' }}</span>
                        </div>
                      }
                      @if (check.threshold != null) {
                        <div class="metric">
                          <span class="metric-label">Threshold</span>
                          <span class="metric-value threshold">{{ formatThreshold(check) }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    }

    @if (loading) {
      <div class="eval-loading">
        <div class="eval-loading-bar"></div>
        <span class="eval-loading-text">Evaluating policy checks...</span>
      </div>
    }

    @if (error) {
      <div class="eval-error">
        <mat-icon>error_outline</mat-icon>
        <span>{{ error }}</span>
      </div>
    }
  `,
  styles: [`
    .eval-panel {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .eval-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
    }

    .banner-pass {
      background: #f0fdf4;
      border-bottom: 1px solid #bbf7d0;
    }

    .banner-warning {
      background: #fffbeb;
      border-bottom: 1px solid #fde68a;
    }

    .banner-block {
      background: #fef2f2;
      border-bottom: 1px solid #fecaca;
    }

    .banner-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .banner-pass .banner-icon { color: #16a34a; }
    .banner-warning .banner-icon { color: #d97706; }
    .banner-block .banner-icon { color: #dc2626; }

    .banner-content {
      display: flex;
      flex-direction: column;
    }

    .banner-title {
      font-size: 14px;
      font-weight: 600;
    }

    .banner-pass .banner-title { color: #166534; }
    .banner-warning .banner-title { color: #92400e; }
    .banner-block .banner-title { color: #991b1b; }

    .banner-subtitle {
      font-size: 12px;
      color: #64748b;
    }

    .eval-checks {
      display: flex;
      flex-direction: column;
    }

    .eval-check {
      border-bottom: 1px solid #f1f5f9;
    }

    .eval-check:last-child {
      border-bottom: none;
    }

    .check-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      cursor: pointer;
      transition: background 0.1s;
    }

    .check-header:hover {
      background: #f8fafc;
    }

    .check-status-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
    }

    .check-status-icon mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .check-pass .check-status-icon {
      background: #dcfce7;
      color: #16a34a;
    }

    .check-warning .check-status-icon {
      background: #fef3c7;
      color: #d97706;
    }

    .check-block .check-status-icon {
      background: #fee2e2;
      color: #dc2626;
    }

    .check-info {
      flex: 1;
      min-width: 0;
    }

    .check-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }

    .check-headline {
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .check-expand {
      color: #cbd5e1;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .check-detail {
      padding: 0 16px 12px 54px;
    }

    .check-detail-text {
      font-size: 13px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 10px 0;
    }

    .check-metrics {
      display: flex;
      gap: 16px;
    }

    .metric {
      display: flex;
      flex-direction: column;
      padding: 6px 12px;
      background: #f8fafc;
      border-radius: 6px;
    }

    .metric-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }

    .metric-value {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      font-variant-numeric: tabular-nums;
    }

    .metric-value.projected { color: #4f46e5; }
    .metric-value.threshold { color: #d97706; }

    .eval-loading {
      padding: 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .eval-loading-bar {
      width: 100%;
      height: 3px;
      background: #e2e8f0;
      border-radius: 2px;
      overflow: hidden;
      position: relative;
    }

    .eval-loading-bar::after {
      content: '';
      position: absolute;
      top: 0;
      left: -40%;
      width: 40%;
      height: 100%;
      background: #4f46e5;
      border-radius: 2px;
      animation: loading-slide 1.2s ease-in-out infinite;
    }

    @keyframes loading-slide {
      0% { left: -40%; }
      100% { left: 100%; }
    }

    .eval-loading-text {
      font-size: 12px;
      color: #94a3b8;
    }

    .eval-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #991b1b;
      font-size: 13px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #dc2626;
      }
    }
  `],
})
export class EvaluationPanelComponent {
  @Input() result: EvaluationResult | null = null;
  @Input() loading = false;
  @Input() error: string | null = null;

  expandedChecks: Record<string, boolean> = {};

  toggleCheck(checkType: string) {
    this.expandedChecks[checkType] = !this.expandedChecks[checkType];
  }

  getCheckLabel(checkType: string): string {
    return CHECK_TYPE_LABELS[checkType] ?? checkType;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'PASS': return 'check_circle';
      case 'WARNING': return 'warning';
      case 'BLOCK': return 'block';
      default: return 'help';
    }
  }

  getBannerIcon(): string {
    switch (this.result?.overallStatus) {
      case 'PASS': return 'check_circle';
      case 'WARNING': return 'warning_amber';
      case 'BLOCK': return 'gpp_bad';
      default: return 'info';
    }
  }

  getBannerTitle(): string {
    switch (this.result?.overallStatus) {
      case 'PASS': return 'All policy checks passed';
      case 'WARNING': return 'Warnings detected — review required';
      case 'BLOCK': return 'Blocked — policy violations found';
      default: return '';
    }
  }

  getBannerSubtitle(): string {
    if (!this.result) return '';
    const total = this.result.checks.length;
    const warnings = this.result.checks.filter(c => c.status === 'WARNING').length;
    const blocks = this.result.checks.filter(c => c.status === 'BLOCK').length;
    const passed = this.result.checks.filter(c => c.status === 'PASS').length;

    const parts: string[] = [];
    if (passed > 0) parts.push(`${passed} passed`);
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
    if (blocks > 0) parts.push(`${blocks} blocked`);
    return `${total} checks: ${parts.join(', ')}`;
  }

  formatMetric(check: CheckResult): string {
    if (check.currentValue == null) return '—';
    if (check.checkType === 'GENDER_GAP_IMPACT') return check.currentValue + '%';
    return check.currentValue.toLocaleString();
  }

  formatThreshold(check: CheckResult): string {
    if (check.threshold == null) return '—';
    if (check.checkType === 'GENDER_GAP_IMPACT' || check.checkType === 'MEDIAN_DEVIATION'
        || check.checkType === 'HISTORICAL_CONSISTENCY' || check.checkType === 'CHANGE_MAGNITUDE') {
      return check.threshold + '%';
    }
    return check.threshold.toLocaleString();
  }
}

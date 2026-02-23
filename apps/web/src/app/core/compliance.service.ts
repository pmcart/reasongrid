import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

export interface ReadinessMetric {
  covered: number;
  total: number;
  percentage: number;
}

export interface ReadinessMetrics {
  salaryRangeCoverage: ReadinessMetric;
  payDecisionDocumentation: ReadinessMetric;
  rationaleLibrary: {
    active: number;
    categoryCoverage: Record<string, number>;
  };
  riskAnalysis: {
    lastRunAt: string | null;
    alertCount: number;
    reviewCount: number;
  };
  genderDataCoverage: ReadinessMetric;
  classificationCoverage: ReadinessMetric;
  overallScore: number;
  status: 'INCOMPLETE' | 'PARTIAL' | 'COMPLETE';
}

export interface DisclosureTemplate {
  id: string;
  organizationId: string | null;
  country: string | null;
  templateType: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface DisclosureResult {
  text: string;
  templateName: string;
  variables: Record<string, string | number>;
}

@Injectable({ providedIn: 'root' })
export class ComplianceService {
  private api = inject(ApiService);
  private http = inject(HttpClient);

  getReadiness(): Observable<ReadinessMetrics> {
    return this.api.get<ReadinessMetrics>('/compliance/readiness');
  }

  getTemplates(): Observable<DisclosureTemplate[]> {
    return this.api.get<DisclosureTemplate[]>('/compliance/disclosure-templates');
  }

  generateDisclosure(templateId: string, salaryRangeId: string, variables?: Record<string, string>): Observable<DisclosureResult> {
    return this.api.post<DisclosureResult>('/compliance/generate-disclosure', {
      templateId,
      salaryRangeId,
      variables,
    });
  }

  exportAuditPack(dateRange?: { from: string; to: string }): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/compliance/audit-pack`, { dateRange }, {
      responseType: 'blob',
    });
  }
}

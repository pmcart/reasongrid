import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PolicyRule {
  id: string;
  organizationId: string;
  checkType: string;
  enabled: boolean;
  params: Record<string, any>;
  severity: string;
  appliesToDecisionTypes: string[];
  appliesToCountries: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PolicyRulesService {
  constructor(private api: ApiService) {}

  getPolicyRules(): Observable<PolicyRule[]> {
    return this.api.get<PolicyRule[]>('/policy-rules');
  }

  updatePolicyRule(id: string, updates: Partial<Pick<PolicyRule, 'enabled' | 'severity' | 'params'>>): Observable<PolicyRule> {
    return this.api.patch<PolicyRule>(`/policy-rules/${id}`, updates);
  }
}

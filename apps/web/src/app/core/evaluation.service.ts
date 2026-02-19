import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CheckResult {
  checkType: string;
  status: 'PASS' | 'WARNING' | 'BLOCK';
  severity: string;
  headline: string;
  detail: string;
  currentValue?: number;
  projectedValue?: number;
  threshold?: number;
}

export interface EvaluationResult {
  overallStatus: 'PASS' | 'WARNING' | 'BLOCK';
  checks: CheckResult[];
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  constructor(private api: ApiService) {}

  evaluate(
    employeeId: string,
    decisionType: string,
    payAfterBase: number,
  ): Observable<EvaluationResult> {
    return this.api.post<EvaluationResult>('/pay-decisions/evaluate', {
      employeeId,
      decisionType,
      payAfterBase,
    });
  }
}

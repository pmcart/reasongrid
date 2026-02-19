import { Injectable, inject } from '@angular/core';
import { Observable, BehaviorSubject, switchMap, shareReplay } from 'rxjs';
import { ApiService } from './api.service';

export interface SalaryRange {
  id: string;
  organizationId: string;
  country: string;
  jobFamily: string | null;
  level: string;
  currency: string;
  min: number;
  mid: number;
  max: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeGroup {
  country: string;
  jobFamily: string | null;
  level: string;
  currency: string;
  employeeCount: number;
  hasSalaryRange: boolean;
}

export interface SalaryRangePayload {
  country: string;
  jobFamily: string | null;
  level: string;
  currency: string;
  min: number;
  mid: number;
  max: number;
}

@Injectable({ providedIn: 'root' })
export class SalaryRangeService {
  private api = inject(ApiService);
  private refresh$ = new BehaviorSubject<void>(undefined);

  all$: Observable<SalaryRange[]> = this.refresh$.pipe(
    switchMap(() => this.api.get<SalaryRange[]>('/salary-ranges')),
    shareReplay(1),
  );

  getCoverage(): Observable<EmployeeGroup[]> {
    return this.api.get<EmployeeGroup[]>('/salary-ranges/coverage');
  }

  getAll(): Observable<SalaryRange[]> {
    return this.api.get<SalaryRange[]>('/salary-ranges');
  }

  create(data: SalaryRangePayload): Observable<SalaryRange> {
    return this.api.post<SalaryRange>('/salary-ranges', data);
  }

  update(id: string, data: Partial<SalaryRangePayload>): Observable<SalaryRange> {
    return this.api.patch<SalaryRange>(`/salary-ranges/${id}`, data);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/salary-ranges/${id}`);
  }

  refreshCache(): void {
    this.refresh$.next();
  }
}

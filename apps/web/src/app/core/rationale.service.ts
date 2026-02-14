import { Injectable, inject } from '@angular/core';
import { Observable, shareReplay, BehaviorSubject, switchMap } from 'rxjs';
import { ApiService } from './api.service';

export interface RationaleDefinition {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  legalDescription: string;
  plainLanguageDescription: string;
  category: string;
  objectiveCriteriaTags: string[];
  applicableDecisionTypes: string[];
  status: string;
  version: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  jurisdictionScope: string[];
  requiresSubstantiation: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class RationaleService {
  private api = inject(ApiService);
  private refresh$ = new BehaviorSubject<void>(undefined);

  /** Active definitions (latest version per code), auto-refreshed on mutations */
  active$: Observable<RationaleDefinition[]> = this.refresh$.pipe(
    switchMap(() => this.api.get<RationaleDefinition[]>('/rationale-definitions')),
    shareReplay(1),
  );

  getActive(): Observable<RationaleDefinition[]> {
    return this.api.get<RationaleDefinition[]>('/rationale-definitions');
  }

  getAll(params?: Record<string, string>): Observable<RationaleDefinition[]> {
    return this.api.get<RationaleDefinition[]>('/rationale-definitions', params);
  }

  getById(id: string): Observable<RationaleDefinition> {
    return this.api.get<RationaleDefinition>(`/rationale-definitions/${id}`);
  }

  getVersionHistory(code: string): Observable<RationaleDefinition[]> {
    return this.api.get<RationaleDefinition[]>(`/rationale-definitions/code/${code}/history`);
  }

  create(data: Record<string, unknown>): Observable<RationaleDefinition> {
    return this.api.post<RationaleDefinition>('/rationale-definitions', data);
  }

  update(id: string, data: Record<string, unknown>): Observable<RationaleDefinition> {
    return this.api.put<RationaleDefinition>(`/rationale-definitions/${id}`, data);
  }

  archive(id: string): Observable<RationaleDefinition> {
    return this.api.post<RationaleDefinition>(`/rationale-definitions/${id}/archive`, {});
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/rationale-definitions/${id}`);
  }

  /** Call after mutations to refresh the shared active$ cache */
  refreshCache(): void {
    this.refresh$.next();
  }
}

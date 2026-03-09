import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  HrisConnection,
  HrisTestResult,
  HrisSyncPreview,
  HrisSyncResponse,
} from '@cdi/shared';

@Injectable({ providedIn: 'root' })
export class HrisService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/hris`;

  listConnections(): Observable<HrisConnection[]> {
    return this.http.get<HrisConnection[]>(`${this.base}/connections`);
  }

  getConnection(id: string): Observable<HrisConnection> {
    return this.http.get<HrisConnection>(`${this.base}/connections/${id}`);
  }

  createConnection(payload: {
    provider: string;
    name: string;
    subdomain: string;
    apiKey: string;
    fieldMappingJson?: Record<string, string> | null;
  }): Observable<HrisConnection> {
    return this.http.post<HrisConnection>(`${this.base}/connections`, payload);
  }

  updateConnection(
    id: string,
    payload: {
      name?: string;
      subdomain?: string;
      apiKey?: string;
      fieldMappingJson?: Record<string, string> | null;
      isActive?: boolean;
    },
  ): Observable<HrisConnection> {
    return this.http.put<HrisConnection>(`${this.base}/connections/${id}`, payload);
  }

  deleteConnection(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/connections/${id}`);
  }

  testConnection(id: string): Observable<HrisTestResult> {
    return this.http.post<HrisTestResult>(`${this.base}/connections/${id}/test`, {});
  }

  testCredentials(subdomain: string, apiKey: string): Observable<HrisTestResult> {
    return this.http.post<HrisTestResult>(`${this.base}/test-credentials`, { subdomain, apiKey });
  }

  getPreview(id: string): Observable<HrisSyncPreview> {
    return this.http.get<HrisSyncPreview>(`${this.base}/connections/${id}/preview`);
  }

  sync(id: string): Observable<HrisSyncResponse> {
    return this.http.post<HrisSyncResponse>(`${this.base}/connections/${id}/sync`, {});
  }
}

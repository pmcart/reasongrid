import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, string>) {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          httpParams = httpParams.set(key, value);
        }
      });
    }
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: httpParams });
  }

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  put<T>(path: string, body: unknown) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  upload<T>(path: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<T>(`${this.baseUrl}${path}`, formData);
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ClassificationDimension {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  description: string;
  scaleType: string;
  scaleConfig: Record<string, unknown>;
  sortOrder: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleClassificationTag {
  id: string;
  roleClassificationId: string;
  dimensionId: string;
  value: string;
  numericValue: number | null;
  aiConfidence: number | null;
  notes: string | null;
  dimension: ClassificationDimension;
}

export interface RoleClassification {
  id: string;
  organizationId: string;
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitle: string;
  jobDescription: string | null;
  status: string;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  aiGeneratedAt: string | null;
  tags: RoleClassificationTag[];
  confirmedBy?: { id: string; email: string } | null;
  employeeCount?: number;
}

export interface UnclassifiedRole {
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitle: string;
  employeeCount: number;
}

export interface BulkClassifyResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

export interface CreateDimensionPayload {
  code: string;
  name: string;
  description: string;
  scaleType: string;
  scaleConfig: Record<string, unknown>;
  sortOrder?: number;
  isDefault?: boolean;
}

export interface CreateClassificationPayload {
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitle: string;
  jobDescription?: string;
  tags?: { dimensionId: string; value: string; numericValue?: number; notes?: string }[];
}

@Injectable({ providedIn: 'root' })
export class ClassificationService {
  private api = inject(ApiService);

  // Dimensions
  getDimensions(): Observable<ClassificationDimension[]> {
    return this.api.get<ClassificationDimension[]>('/classification-dimensions');
  }

  createDimension(data: CreateDimensionPayload): Observable<ClassificationDimension> {
    return this.api.post<ClassificationDimension>('/classification-dimensions', data);
  }

  updateDimension(id: string, data: Partial<CreateDimensionPayload>): Observable<ClassificationDimension> {
    return this.api.patch<ClassificationDimension>(`/classification-dimensions/${id}`, data);
  }

  deleteDimension(id: string): Observable<void> {
    return this.api.delete<void>(`/classification-dimensions/${id}`);
  }

  // Role Classifications
  getClassifications(filters?: Record<string, string>): Observable<RoleClassification[]> {
    return this.api.get<RoleClassification[]>('/role-classifications', filters);
  }

  getClassification(id: string): Observable<RoleClassification> {
    return this.api.get<RoleClassification>(`/role-classifications/${id}`);
  }

  getUnclassified(): Observable<UnclassifiedRole[]> {
    return this.api.get<UnclassifiedRole[]>('/role-classifications/unclassified');
  }

  createClassification(data: CreateClassificationPayload): Observable<RoleClassification> {
    return this.api.post<RoleClassification>('/role-classifications', data);
  }

  updateClassification(id: string, data: { jobDescription?: string; tags?: { dimensionId: string; value: string; numericValue?: number; notes?: string }[] }): Observable<RoleClassification> {
    return this.api.patch<RoleClassification>(`/role-classifications/${id}`, data);
  }

  confirmClassification(id: string, tags?: { dimensionId: string; value: string; numericValue?: number; notes?: string }[]): Observable<RoleClassification> {
    return this.api.patch<RoleClassification>(`/role-classifications/${id}/confirm`, { tags });
  }

  aiClassifySingle(id: string): Observable<RoleClassification> {
    return this.api.post<RoleClassification>(`/role-classifications/${id}/ai-classify`, {});
  }

  bulkAiClassify(roleIds?: string[]): Observable<BulkClassifyResult> {
    return this.api.post<BulkClassifyResult>('/role-classifications/bulk-ai-classify', { roleIds });
  }

  deleteClassification(id: string): Observable<void> {
    return this.api.delete<void>(`/role-classifications/${id}`);
  }
}

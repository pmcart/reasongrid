import { Injectable } from '@angular/core';
import { ApiService } from '../core/api.service';
import type { CsvUploadResponse, ImportPreview } from '@cdi/shared';

@Injectable({ providedIn: 'root' })
export class ImportService {
  constructor(private api: ApiService) {}

  uploadCsv(file: File) {
    return this.api.upload<CsvUploadResponse>('/imports/employees/csv', file);
  }

  getPreview(importId: string, mapping: Record<string, string>) {
    return this.api.post<ImportPreview>(`/imports/${importId}/preview`, { mapping });
  }

  confirmMapping(importId: string, mapping: Record<string, string>) {
    return this.api.post<{ importId: string; status: string; message: string }>(
      `/imports/${importId}/confirm-mapping`,
      { mapping },
    );
  }

  getImport(id: string) {
    return this.api.get<any>(`/imports/${id}`);
  }

  getImports() {
    return this.api.get<any[]>('/imports');
  }
}

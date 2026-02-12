import { z } from 'zod';
import { ImportJobStatus } from '../enums.js';

export const importJobSchema = z.object({
  id: z.string(),
  uploadedByUserId: z.string(),
  status: z.nativeEnum(ImportJobStatus),
  createdCount: z.number().nullable(),
  updatedCount: z.number().nullable(),
  errorCount: z.number().nullable(),
  mappingJson: z.record(z.string()).nullable(),
  errorReportPath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const confirmMappingSchema = z.object({
  mapping: z.record(z.string()),
});

// Upload response — returned after CSV upload with AI-suggested mappings
export const csvUploadResponseSchema = z.object({
  importId: z.string(),
  status: z.string(),
  fileName: z.string(),
  rowCount: z.number(),
  detectedColumns: z.array(z.string()),
  suggestedMapping: z.record(z.string().nullable()),
  sampleData: z.array(z.record(z.string())),
  aiConfidence: z.record(z.number()).optional(),
  mappingSource: z.enum(['ai', 'deterministic']).optional(),
});

// Import error detail
export const importErrorSchema = z.object({
  row: z.number(),
  field: z.string().optional(),
  message: z.string(),
});

// Import result with error details
export const importResultSchema = z.object({
  importId: z.string(),
  status: z.nativeEnum(ImportJobStatus),
  createdCount: z.number(),
  updatedCount: z.number(),
  errorCount: z.number(),
  errors: z.array(importErrorSchema),
});

// Preview row — normalized data preview before confirming import
export const previewRowSchema = z.object({
  rowNumber: z.number(),
  data: z.record(z.string().nullable()),
  warnings: z.array(z.string()),
});

export const importPreviewSchema = z.object({
  rows: z.array(previewRowSchema),
  totalRows: z.number(),
  validRows: z.number(),
  warningRows: z.number(),
});

export type ImportJob = z.infer<typeof importJobSchema>;
export type ConfirmMapping = z.infer<typeof confirmMappingSchema>;
export type CsvUploadResponse = z.infer<typeof csvUploadResponseSchema>;
export type ImportError = z.infer<typeof importErrorSchema>;
export type ImportResult = z.infer<typeof importResultSchema>;
export type PreviewRow = z.infer<typeof previewRowSchema>;
export type ImportPreview = z.infer<typeof importPreviewSchema>;

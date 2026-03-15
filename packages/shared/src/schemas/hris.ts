import { z } from 'zod';

export const SUPPORTED_HRIS_PROVIDERS = ['bamboohr', 'hibob'] as const;
export type HrisProvider = (typeof SUPPORTED_HRIS_PROVIDERS)[number];

export const hrisProviderLabels: Record<HrisProvider, string> = {
  bamboohr: 'BambooHR',
  hibob: 'HiBob',
};

export interface HrisConnection {
  id: string;
  provider: HrisProvider;
  name: string;
  subdomain: string;
  isActive: boolean;
  lastSyncAt: string | null;
  fieldMappingJson: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export const createHrisConnectionSchema = z.object({
  provider: z.enum(SUPPORTED_HRIS_PROVIDERS),
  name: z.string().min(1).max(100),
  subdomain: z.string().min(1).max(100),
  apiKey: z.string().min(1),
  fieldMappingJson: z.record(z.string()).nullable().optional(),
});

export const updateHrisConnectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subdomain: z.string().min(1).max(100).optional(),
  apiKey: z.string().min(1).optional(),
  fieldMappingJson: z.record(z.string()).nullable().optional(),
  isActive: z.boolean().optional(),
});

export interface HrisTestResult {
  success: boolean;
  message: string;
  employeeCount?: number;
}

export interface HrisSyncPreview {
  totalEmployees: number;
  fetchErrors: number;
  sample: Array<{
    employeeId: string;
    roleTitle: string;
    jobFamily: string | null;
    level: string;
    country: string;
    currency: string;
    baseSalary: number;
    hireDate: string | null;
  }>;
  errors: Array<{ id: string; message: string }>;
}

export interface HrisSyncResponse {
  importId: string;
  status: 'PROCESSING';
  message: string;
}

// BambooHR-specific field mapping options (for advanced config UI)
export const BAMBOOHR_LEVEL_FIELD_OPTIONS = [
  { value: 'customLevel', label: 'customLevel (BambooHR standard custom field)' },
  { value: 'customLevel1', label: 'customLevel1' },
  { value: 'customLevel2', label: 'customLevel2' },
  { value: 'customLevel3', label: 'customLevel3' },
  { value: 'department', label: 'Department (fallback)' },
];

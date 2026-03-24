import { z } from 'zod';

export const SUPPORTED_HRIS_PROVIDERS = ['bamboohr', 'hibob', 'rippling', 'personio'] as const;
export type HrisProvider = (typeof SUPPORTED_HRIS_PROVIDERS)[number];

export const hrisProviderLabels: Record<HrisProvider, string> = {
  bamboohr: 'BambooHR',
  hibob: 'HiBob',
  rippling: 'Rippling',
  personio: 'Personio',
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

// Rippling-specific field mapping hint
export const RIPPLING_LEVEL_FIELD_HINT =
  'Rippling has a native "Level" field (level.name) which CDI reads automatically. ' +
  'No custom field configuration is required for level.';

// BambooHR-specific field mapping options (for advanced config UI)
export const BAMBOOHR_LEVEL_FIELD_OPTIONS = [
  { value: 'customLevel', label: 'customLevel (BambooHR standard custom field)' },
  { value: 'customLevel1', label: 'customLevel1' },
  { value: 'customLevel2', label: 'customLevel2' },
  { value: 'customLevel3', label: 'customLevel3' },
  { value: 'department', label: 'Department (fallback)' },
];

// Personio-specific field mapping hint
export const PERSONIO_LEVEL_FIELD_HINT =
  'Personio has no standard Level field. It is stored as a custom attribute. ' +
  'Enter the attribute key (e.g. "dynamic_12345") or its label (e.g. "Level"). ' +
  'If left blank, CDI will attempt to auto-detect it by scanning attribute labels.';

import { z } from 'zod';

// --- Classification Dimensions ---

export const createClassificationDimensionSchema = z.object({
  code: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Must be UPPER_SNAKE_CASE'),
  name: z.string().min(1).max(100),
  description: z.string().min(1),
  scaleType: z.enum(['NUMERIC_1_5', 'NUMERIC_1_10', 'LEVEL_LOW_MED_HIGH', 'CUSTOM']),
  scaleConfig: z.record(z.unknown()).default({}),
  sortOrder: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export const updateClassificationDimensionSchema = createClassificationDimensionSchema.partial();

// --- Role Classifications ---

export const roleClassificationTagSchema = z.object({
  dimensionId: z.string().uuid(),
  value: z.string().min(1),
  numericValue: z.number().optional(),
  notes: z.string().optional(),
});

export const createRoleClassificationSchema = z.object({
  country: z.string().length(2),
  jobFamily: z.string().nullable().optional(),
  level: z.string().min(1),
  roleTitle: z.string().min(1),
  jobDescription: z.string().optional(),
  tags: z.array(roleClassificationTagSchema).optional(),
});

export const updateRoleClassificationSchema = z.object({
  jobDescription: z.string().optional(),
  tags: z.array(roleClassificationTagSchema).optional(),
});

export const bulkClassifyRequestSchema = z.object({
  roleIds: z.array(z.string().uuid()).optional(),
});

export const classificationQuerySchema = z.object({
  status: z.enum(['UNCLASSIFIED', 'AI_SUGGESTED', 'CONFIRMED']).optional(),
  country: z.string().optional(),
  jobFamily: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

import { z } from 'zod';

export const salaryRangeSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  country: z.string(),
  jobFamily: z.string().nullable(),
  level: z.string(),
  currency: z.string(),
  min: z.number(),
  mid: z.number(),
  max: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const salaryRangeFieldsSchema = z.object({
  country: z.string().min(2).max(2).toUpperCase(),
  jobFamily: z.string().nullable().default(null),
  level: z.string().min(1),
  currency: z.string().length(3).toUpperCase(),
  min: z.number().positive(),
  mid: z.number().positive(),
  max: z.number().positive(),
});

export const createSalaryRangeSchema = salaryRangeFieldsSchema.refine(
  data => data.min < data.mid && data.mid < data.max,
  { message: 'Salary range must satisfy: min < mid < max' },
);

export type SalaryRange = z.infer<typeof salaryRangeSchema>;
export type CreateSalaryRange = z.infer<typeof createSalaryRangeSchema>;

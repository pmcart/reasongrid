import { z } from 'zod';

export const employeeSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  roleTitle: z.string(),
  jobFamily: z.string().nullable(),
  level: z.string(),
  country: z.string(),
  location: z.string().nullable(),
  currency: z.string(),
  baseSalary: z.number(),
  bonusTarget: z.number().nullable(),
  ltiTarget: z.number().nullable(),
  hireDate: z.string().nullable(),
  employmentType: z.string().nullable(),
  gender: z.string().nullable(),
  performanceRating: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const employeeListQuerySchema = z.object({
  country: z.string().optional(),
  jobFamily: z.string().optional(),
  level: z.string().optional(),
  q: z.string().optional(),
  filter: z.enum(['no-decisions', 'no-classification', 'no-gender']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

// Only fields that may be manually corrected outside of CSV imports
export const updateEmployeeSchema = z.object({
  location: z.string().nullable().optional(),
  performanceRating: z.string().nullable().optional(),
  employmentType: z.string().nullable().optional(),
}).strict();

export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type UpdateEmployee = z.infer<typeof updateEmployeeSchema>;

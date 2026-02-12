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
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;

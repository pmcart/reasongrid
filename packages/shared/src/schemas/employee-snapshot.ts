import { z } from 'zod';

export const employeeSnapshotSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  importJobId: z.string().nullable(),
  organizationId: z.string(),
  employeeExternalId: z.string(),
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
  tenureYears: z.number().nullable(),
  compaRatio: z.number().nullable(),
  positionInRange: z.number().nullable(),
  comparatorGroupKey: z.string().nullable(),
  priorPromotionCount: z.number().nullable(),
  lastPromotionDate: z.string().nullable(),
  priorIncreaseCount: z.number().nullable(),
  priorIncreaseTotalPct: z.number().nullable(),
  snapshotAt: z.string(),
  createdAt: z.string(),
});

export type EmployeeSnapshot = z.infer<typeof employeeSnapshotSchema>;

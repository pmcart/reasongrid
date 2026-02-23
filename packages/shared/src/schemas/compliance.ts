import { z } from 'zod';

export const generateDisclosureRequestSchema = z.object({
  templateId: z.string().uuid(),
  salaryRangeId: z.string().uuid(),
  variables: z.record(z.string()).optional(),
});

export const generateAuditPackRequestSchema = z.object({
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }).optional(),
});

export const readinessMetricsSchema = z.object({
  salaryRangeCoverage: z.object({
    covered: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  payDecisionDocumentation: z.object({
    documented: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  rationaleLibrary: z.object({
    active: z.number(),
    categoryCoverage: z.record(z.number()),
  }),
  riskAnalysis: z.object({
    lastRunAt: z.string().nullable(),
    alertCount: z.number(),
    reviewCount: z.number(),
  }),
  genderDataCoverage: z.object({
    withGender: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  classificationCoverage: z.object({
    classified: z.number(),
    total: z.number(),
    percentage: z.number(),
  }),
  overallScore: z.number().min(0).max(100),
  status: z.enum(['INCOMPLETE', 'PARTIAL', 'COMPLETE']),
});
